import { Settings, Clock, Globe, Trash2, RefreshCw, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/stores/app-store";
import { useToast } from "@/hooks/use-toast";
import { TimeDisplayMode } from "@/types/memory";

export default function SettingsPage() {
  const { toast } = useToast();
  const { timeDisplayMode, setTimeDisplayMode, libraryPath, totalItems } = useAppStore();

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleClearCache = () => {
    // Stub - would clear thumbnail cache
    toast({ title: "Cache cleared", description: "Thumbnail cache has been cleared" });
  };

  const handleRebuildThumbnails = () => {
    // Stub - would rebuild thumbnails
    toast({ title: "Rebuilding thumbnails", description: "This may take a few minutes..." });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Hero section */}
      <div className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container max-w-screen-lg px-4 relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Settings className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Configure SnapBack preferences</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-screen-lg px-4 pb-12 space-y-6">
        {/* Time display */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Time Display
            </CardTitle>
            <CardDescription>
              Choose how dates and times are displayed throughout the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={timeDisplayMode}
              onValueChange={(v) => setTimeDisplayMode(v as TimeDisplayMode)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 bg-secondary rounded-lg">
                <RadioGroupItem value="local" id="local" />
                <Label htmlFor="local" className="flex-1 cursor-pointer">
                  <p className="font-medium">Local Time</p>
                  <p className="text-sm text-muted-foreground">
                    Display times in your local timezone
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-secondary rounded-lg">
                <RadioGroupItem value="utc" id="utc" />
                <Label htmlFor="utc" className="flex-1 cursor-pointer">
                  <p className="font-medium">UTC Time</p>
                  <p className="text-sm text-muted-foreground">
                    Display times in Coordinated Universal Time
                  </p>
                </Label>
              </div>
            </RadioGroup>

            <div className="mt-4 p-3 bg-secondary/50 rounded-lg flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Detected Timezone</p>
                <p className="text-sm text-muted-foreground">{detectedTimezone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Theme preview */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" />
              Theme
            </CardTitle>
            <CardDescription>SnapBack uses a violet angel dark theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {/* Color swatches */}
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-background border border-border" />
                <p className="text-xs text-muted-foreground text-center">Background</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-card border border-border" />
                <p className="text-xs text-muted-foreground text-center">Card</p>
              </div>
              <div className="space-y-2">
                <div className="h-12 rounded-lg bg-primary" />
                <p className="text-xs text-muted-foreground text-center">Primary</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              Theme customization coming in a future update.
            </p>
          </CardContent>
        </Card>

        {/* Data actions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-primary" />
              Data Actions
            </CardTitle>
            <CardDescription>Manage cached data and thumbnails</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Library info */}
            {libraryPath && (
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Current Library</p>
                    <p className="text-xs text-muted-foreground break-all">{libraryPath}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {totalItems.toLocaleString()} items
                  </p>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleClearCache}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
              <Button variant="secondary" onClick={handleRebuildThumbnails}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rebuild Thumbnails
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Clearing cache will remove temporary files. Rebuilding thumbnails may take
              several minutes for large libraries.
            </p>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-lg font-bold text-primary">SnapBack</p>
              <p className="text-sm text-muted-foreground">
                Your Snapchat Memories, organized and searchable — offline.
              </p>
              <p className="text-xs text-muted-foreground mt-2">Version 1.0.0</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
