import os, zipfile, shutil, argparse
from pathlib import Path
from PIL import Image

def flatten_one(main_path: Path, overlay_path: Path, out_path: Path):
    base = Image.open(main_path).convert("RGBA")
    ov = Image.open(overlay_path).convert("RGBA")

    # If sizes differ, resize overlay to base size (Snap export usually matches)
    if ov.size != base.size:
        ov = ov.resize(base.size, Image.Resampling.LANCZOS)

    merged = Image.alpha_composite(base, ov).convert("RGB")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    merged.save(out_path, quality=95)

def process_zip(zip_path: Path, extract_root: Path, out_dir: Path, keep_extract=False):
    tmp_dir = extract_root / zip_path.stem
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(tmp_dir)

    # Find main + overlay
    mains = list(tmp_dir.glob("*-main.jpg")) + list(tmp_dir.glob("*-main.jpeg")) + list(tmp_dir.glob("*-main.png"))
    overlays = list(tmp_dir.glob("*-overlay.png"))

    if not mains:
        return ("skip", zip_path.name, "no main found")
    if not overlays:
        return ("skip", zip_path.name, "no overlay found")

    main_path = mains[0]
    overlay_path = overlays[0]

    # Output filename: keep same stem as main, but "FINAL"
    out_name = main_path.name.replace("-main", "-FINAL")
    out_path = out_dir / out_name

    flatten_one(main_path, overlay_path, out_path)

    if not keep_extract:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return ("ok", zip_path.name, str(out_path))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zips", required=True, help="Folder containing zip files")
    ap.add_argument("--extract", required=True, help="Temp extract folder")
    ap.add_argument("--out", required=True, help="Output folder for flattened images")
    ap.add_argument("--keep-extract", action="store_true")
    args = ap.parse_args()

    zips_dir = Path(args.zips)
    extract_root = Path(args.extract)
    out_dir = Path(args.out)

    results = []
    for zp in sorted(zips_dir.glob("*.zip")):
        try:
            results.append(process_zip(zp, extract_root, out_dir, keep_extract=args.keep_extract))
        except Exception as e:
            results.append(("error", zp.name, repr(e)))

    # Write log
    log_path = out_dir.parent / "logs" / "flatten_images_log.csv"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "w") as f:
        f.write("status,zip,detail\n")
        for r in results:
            f.write(",".join([r[0], r[1], r[2].replace(",", " ")]) + "\n")

    print(f"Done. Log: {log_path}")

if __name__ == "__main__":
    main()
