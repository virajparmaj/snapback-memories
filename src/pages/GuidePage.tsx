import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, Edit, Save, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_GUIDE = `# SnapBack Setup Guide

Welcome to SnapBack! This guide will help you get your Snapchat memories imported and organized.

## Step 1: Request Your Snapchat Data

1. Open Snapchat on your phone
2. Go to **Settings** > **My Data** > **Submit Request**
3. Select **Include your Memories** 
4. Wait for Snapchat to email you (can take 24-48 hours)
5. Download the data archive from the email link

## Step 2: Download Your Memories

The data archive contains links to your actual media files. Here's how to download them:

### Using Chrome (Recommended)

1. Open Chrome settings and allow **multiple file downloads** for the Snapchat domain
2. Open the \`memories_history.html\` file from your data archive
3. Use a batch download extension or click each link
4. Create a dedicated folder like \`~/Snapchat/Memories\` for all files

### Alternative: Use a Download Script

If you have many files, using a script is faster:

\`\`\`bash
# Example using wget (details in technical docs)
./download-memories.sh memories_history.json ~/Snapchat/Memories
\`\`\`

## Step 3: Run the Extraction Script

SnapBack uses a separate metadata extraction script to index your files:

\`\`\`bash
# Install the script
npm install -g snapback-extractor

# Run extraction
snapback-extract ~/Snapchat/Memories --output ./library
\`\`\`

This creates:
- Thumbnail images for fast browsing
- A metadata index file (JSON)
- Location labels (if GPS data exists)

## Step 4: Import into SnapBack

1. Go to the **Import** tab in SnapBack
2. Enter your library folder path
3. Click **Start Indexing**
4. Wait for the process to complete

## Tips

- **Keep backups**: Always keep your original downloaded files safe
- **SSD recommended**: Indexing is much faster on SSD storage
- **Large libraries**: 8,000+ files may take several minutes to index
- **Incremental updates**: Use "Incremental Update" for newly added files

## Troubleshooting

### Files not appearing?

- Check that the folder path is correct
- Ensure files have standard extensions (.jpg, .mp4, etc.)
- Try re-indexing the library

### Missing location data?

- Not all Snapchat photos include GPS coordinates
- Location resolution requires internet connection

### Slow performance?

- Enable thumbnail generation for faster browsing
- Use the timeline filters to narrow down results
- Consider indexing in smaller batches

---

*Need more help? Visit our documentation or open an issue on GitHub.*
`;

const STORAGE_KEY = "snapback-guide-content";

export default function GuidePage() {
  const { toast } = useToast();
  const [content, setContent] = useState(DEFAULT_GUIDE);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  // Load saved content
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setContent(saved);
    }
  }, []);

  const handleSave = () => {
    setContent(editContent);
    localStorage.setItem(STORAGE_KEY, editContent);
    setIsEditing(false);
    toast({ title: "Guide saved", description: "Your changes have been saved locally" });
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleReset = () => {
    setContent(DEFAULT_GUIDE);
    setEditContent(DEFAULT_GUIDE);
    localStorage.removeItem(STORAGE_KEY);
    setIsEditing(false);
    toast({ title: "Guide reset", description: "Restored to default content" });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Hero section */}
      <div className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container max-w-screen-lg px-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Setup Guide</h1>
                <p className="text-muted-foreground">
                  How to export and import your Snapchat memories
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                  <Button variant="secondary" onClick={() => {
                    setEditContent(content);
                    setIsEditing(true);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-screen-lg px-4 pb-12">
        {isEditing ? (
          <div className="bg-card border border-border rounded-2xl p-6">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[600px] font-mono text-sm bg-background border-border"
              placeholder="Write your guide in Markdown..."
            />
          </div>
        ) : (
          <div className="prose prose-invert max-w-none bg-card border border-border rounded-2xl p-8">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold text-foreground mb-6">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-bold text-foreground mt-8 mb-4 pb-2 border-b border-border">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-muted-foreground space-y-2 mb-4">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="ml-2">{children}</li>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="bg-background p-4 rounded-lg overflow-x-auto mb-4">
                        <code className="text-sm font-mono text-foreground">
                          {children}
                        </code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-secondary px-1.5 py-0.5 rounded text-sm font-mono text-primary">
                      {children}
                    </code>
                  );
                },
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                hr: () => <hr className="border-border my-8" />,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
