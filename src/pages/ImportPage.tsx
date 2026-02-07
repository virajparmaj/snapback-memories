import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  FolderInput, 
  FolderOpen, 
  RefreshCw, 
  Check, 
  AlertCircle,
  HardDrive,
  Clock,
  Image,
  MapPin,
} from "lucide-react";
import { api } from "@/lib/api/adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export default function ImportPage() {
  const { isLibraryConnected, libraryPath, totalItems, lastIndexedAt } = useAppStore();

  // Form state
  const [folderPath, setFolderPath] = useState(libraryPath || "");
  const [generateThumbs, setGenerateThumbs] = useState(true);
  const [resolveLocations, setResolveLocations] = useState(true);
  const [renameStrategy, setRenameStrategy] = useState<"none" | "copy_organized" | "in_place_safe">("none");

  // Fetch library status
  const { data: libraryStatus } = useQuery({
    queryKey: ["library-status"],
    queryFn: () => api.getLibraryStatus(),
  });

  // Fetch indexing status
  const { data: indexingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["indexing-status"],
    queryFn: () => api.getIndexingStatus(),
    refetchInterval: (query) =>
      query.state.data?.state === "running" ? 1000 : false,
  });

  // Start indexing mutation
  const startIndexing = useMutation({
    mutationFn: () =>
      api.startIndexing({
        folderPath,
        options: {
          generateThumbs,
          resolveLocations,
          renameStrategy,
        },
      }),
    onSuccess: () => {
      refetchStatus();
    },
  });

  const isIndexing = indexingStatus?.state === "running";
  const progress =
    indexingStatus?.progress.total > 0
      ? (indexingStatus.progress.scanned / indexingStatus.progress.total) * 100
      : 0;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Hero section */}
      <div className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container max-w-screen-xl px-4 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <FolderInput className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Import & Index</h1>
              <p className="text-muted-foreground">
                Connect your Snapchat memories folder
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-screen-xl px-4 pb-12">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Current library status */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                Library Status
              </CardTitle>
              <CardDescription>Current indexed library information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLibraryConnected ? (
                <>
                  <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <Check className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-400">Library Connected</p>
                      <p className="text-sm text-muted-foreground break-all">
                        {libraryPath}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-secondary rounded-lg">
                      <p className="text-2xl font-bold">{totalItems.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Total items</p>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg">
                      <p className="text-sm font-medium">
                        {lastIndexedAt
                          ? new Date(lastIndexedAt).toLocaleDateString()
                          : "Never"}
                      </p>
                      <p className="text-sm text-muted-foreground">Last indexed</p>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => startIndexing.mutate()}
                    disabled={isIndexing}
                  >
                    <RefreshCw
                      className={cn("h-4 w-4 mr-2", isIndexing && "animate-spin")}
                    />
                    Re-index
                  </Button>
                </>
              ) : (
                <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-400">No Library Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Connect your Snapchat memories folder to get started
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import form */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                Index New Folder
              </CardTitle>
              <CardDescription>
                Select a folder containing your Snapchat memories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="folder-path">Folder Path</Label>
                <Input
                  id="folder-path"
                  placeholder="/Users/you/Snapchat/Memories"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="mt-1.5 bg-secondary border-border"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Enter the full path to your memories folder. In a desktop app, this
                  would be a folder picker.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Indexing Options</Label>

                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div className="flex items-center gap-3">
                    <Image className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Generate Thumbnails</p>
                      <p className="text-xs text-muted-foreground">
                        Create preview images for faster browsing
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={generateThumbs}
                    onCheckedChange={setGenerateThumbs}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Resolve Locations</p>
                      <p className="text-xs text-muted-foreground">
                        Convert GPS coordinates to place names
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={resolveLocations}
                    onCheckedChange={setResolveLocations}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => startIndexing.mutate()}
                disabled={isIndexing || !folderPath}
              >
                {isIndexing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Indexing...
                  </>
                ) : (
                  <>
                    <FolderInput className="h-4 w-4 mr-2" />
                    Start Indexing
                  </>
                )}
              </Button>

              <div className="p-3 bg-secondary/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Important:</strong> Keep your SSD
                  connected and don't move files during indexing. This process may take
                  several minutes for large libraries.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Indexing progress */}
          {(isIndexing || indexingStatus?.state === "done") && (
            <Card className="bg-card border-border lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Indexing Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      {indexingStatus?.progress.scanned.toLocaleString()} /{" "}
                      {indexingStatus?.progress.total.toLocaleString()} items
                    </span>
                    <span className="text-sm font-medium">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {indexingStatus?.state === "done" && (
                  <div className="flex items-center gap-2 text-green-400">
                    <Check className="h-5 w-5" />
                    <span>Indexing complete!</span>
                  </div>
                )}

                {/* Logs */}
                <div>
                  <p className="text-sm font-medium mb-2">Logs</p>
                  <ScrollArea className="h-32 bg-background rounded-lg p-3">
                    {indexingStatus?.logs.map((log, i) => (
                      <p key={i} className="text-xs text-muted-foreground font-mono">
                        {log}
                      </p>
                    ))}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
