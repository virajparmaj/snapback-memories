import argparse
import csv
import os
import shutil
import subprocess
import zipfile
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTS = {".mp4", ".mov"}
MEDIA_EXTS = IMAGE_EXTS | VIDEO_EXTS


def run(cmd: List[str]) -> None:
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\nSTDERR:\n{p.stderr[:4000]}")
    # ffmpeg writes progress to stderr; we only care on failure


def flatten_image(main_path: Path, overlay_paths: List[Path], out_path: Path) -> None:
    base = Image.open(main_path).convert("RGBA")

    for ovp in overlay_paths:
        ov = Image.open(ovp).convert("RGBA")
        if ov.size != base.size:
            ov = ov.resize(base.size, Image.Resampling.LANCZOS)
        base = Image.alpha_composite(base, ov)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out_path, quality=95)


def flatten_video(main_path: Path, overlay_paths: List[Path], out_path: Path) -> None:
    """
    Burn PNG overlay(s) onto video for the full duration.
    """
    input_args = ["-i", str(main_path)]

    # Loop overlays so they persist for entire video
    for ovp in overlay_paths:
        input_args += ["-loop", "1", "-i", str(ovp)]

    # Build filter chain
    # [0:v][1:v]overlay=0:0[v1]; [v1][2:v]overlay=0:0[v2] ...
    filters = []
    last = "[0:v]"
    for i in range(1, len(overlay_paths) + 1):
        out_tag = f"[v{i}]"
        filters.append(f"{last}[{i}:v]overlay=0:0{out_tag}")
        last = out_tag

    filter_complex = ";".join(filters)

    cmd = [
        "ffmpeg",
        "-y",
        *input_args,
        "-filter_complex",
        filter_complex,
        "-map",
        last,
        "-map",
        "0:a?",
        "-shortest",              # 🔑 stop when base video ends
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",                # 🔑 QuickTime compatibility
        "-crf",
        "18",
        "-preset",
        "veryfast",
        "-c:a",
        "copy",
        str(out_path),
    ]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    run(cmd)


def is_overlay_name(p: Path) -> bool:
    name = p.name.lower()
    return ("overlay" in name) or name.endswith("-overlay.png")


def pick_main_and_overlays(extracted_dir: Path) -> Tuple[Optional[Path], List[Path]]:
    files = [p for p in extracted_dir.rglob("*") if p.is_file()]
    media = [p for p in files if p.suffix.lower() in MEDIA_EXTS]

    if not media:
        return None, []

    # Overlays: prefer files with overlay in name (usually png)
    overlays = [p for p in media if p.suffix.lower() == ".png" and is_overlay_name(p)]
    # If no explicit overlay files, treat pngs (except main) as overlays later.

    # Main: prefer files with "-main" in name; otherwise pick the largest non-overlay media.
    mains = [p for p in media if "-main" in p.name.lower() and not is_overlay_name(p)]
    if mains:
        main = sorted(mains, key=lambda p: p.stat().st_size, reverse=True)[0]
    else:
        candidates = [p for p in media if not is_overlay_name(p)]
        main = sorted(candidates, key=lambda p: p.stat().st_size, reverse=True)[0] if candidates else None

    if main is None:
        return None, []

    # If overlays list empty, fallback:
    # - if main is image: overlays are png files excluding main
    # - if main is video: overlays are png files in folder
    if not overlays:
        overlays = [p for p in media if p.suffix.lower() == ".png" and p.resolve() != main.resolve()]

    # Final overlay sort: stable, name order (Snap generally uses a single overlay anyway)
    overlays = sorted(overlays, key=lambda p: p.name.lower())
    return main, overlays


def process_zip(zip_path: Path, extract_root: Path, out_dir: Path, keep_extract: bool, dry_run: bool) -> Tuple[str, str, str]:
    tmp_dir = extract_root / zip_path.stem
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(tmp_dir)

        main, overlays = pick_main_and_overlays(tmp_dir)
        if main is None:
            return ("skip", zip_path.name, "no media found inside zip")

        if not overlays:
            # Nothing to flatten; just export the main as-is
            out_ext = main.suffix.lower()
            out_path = out_dir / f"{zip_path.stem}-FINAL{out_ext}"
            if not dry_run:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(main, out_path)
            return ("ok", zip_path.name, f"copied main only -> {out_path.name}")

        # Produce final file name based on main type
        if main.suffix.lower() in IMAGE_EXTS:
            out_path = out_dir / f"{zip_path.stem}-FINAL.jpg"
            if not dry_run:
                flatten_image(main, overlays, out_path)
            return ("ok", zip_path.name, f"flattened image -> {out_path.name}")

        if main.suffix.lower() in VIDEO_EXTS:
            out_path = out_dir / f"{zip_path.stem}-FINAL.mp4"
            if not dry_run:
                flatten_video(main, overlays, out_path)
            return ("ok", zip_path.name, f"flattened video -> {out_path.name}")

        return ("skip", zip_path.name, f"unsupported main type: {main.suffix.lower()}")

    finally:
        if not keep_extract:
            shutil.rmtree(tmp_dir, ignore_errors=True)


def copy_standalone(file_path: Path, out_dir: Path, dry_run: bool) -> Tuple[str, str, str]:
    # Copy standalone media unchanged; suffix "-RAW" to avoid collisions with -FINAL outputs.
    out_path = out_dir / f"{file_path.stem}-RAW{file_path.suffix.lower()}"
    if not dry_run:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file_path, out_path)
    return ("ok", file_path.name, f"copied standalone -> {out_path.name}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Folder that contains mixed .zip and media files (your Snapchat folder)")
    ap.add_argument("--extract", required=True, help="Temp extraction folder (on SSD is fine)")
    ap.add_argument("--out", required=True, help="Output folder for final flattened media")
    ap.add_argument("--keep-extract", action="store_true", help="Keep extracted folders for debugging")
    ap.add_argument("--dry-run", action="store_true", help="Scan and log only, do not write files")
    args = ap.parse_args()

    inp = Path(args.input)
    extract_root = Path(args.extract)
    out_dir = Path(args.out)

    logs_dir = out_dir.parent / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = logs_dir / "ingest_log.csv"

    results = []

    # Process zips + standalone (top-level only, since your Snapchat folder is flat)
    for p in sorted(inp.iterdir()):
        if not p.is_file():
            continue

        # Ignore macOS AppleDouble files
        if p.name.startswith("._"):
            continue

        ext = p.suffix.lower()

        try:
            if ext == ".zip":
                results.append(process_zip(p, extract_root, out_dir, args.keep_extract, args.dry_run))
            elif ext in MEDIA_EXTS:
                results.append(copy_standalone(p, out_dir, args.dry_run))
            else:
                # ignore non-media files
                continue
        except Exception as e:
            results.append(("error", p.name, repr(e)))

    with open(log_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["status", "input", "detail"])
        for status, name, detail in results:
            writer.writerow([status, name, detail])

    print(f"Done. Wrote log: {log_file}")
    print(f"Output folder: {out_dir}")
    if args.dry_run:
        print("Dry run enabled: no files were written.")


if __name__ == "__main__":
    main()
