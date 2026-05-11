import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Upload, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function KnowledgeBase() {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: kbData, isLoading: kbLoading, refetch } = trpc.kb.getContent.useQuery();
  const { data: docs } = trpc.kb.getDocuments.useQuery();

  const uploadDoc = trpc.kb.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("Document added to Knowledge Base");
      refetch();
      setUploading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      uploadDoc.mutate({ filename: file.name, content });
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground">The permanent memory of the AKD AI Script Writer. All rules, scripts, and feedback are stored here.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border/60 hover:border-primary/50 hover:text-primary"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload Document
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Uploaded docs sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Uploaded Documents</h2>
          {(!docs || docs.length === 0) && (
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          )}
          {docs?.map((doc: any) => (
            <div key={doc.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/10">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-1">
            <p className="text-xs font-semibold text-primary">Upload formats</p>
            <p className="text-xs text-muted-foreground">Supports .txt and .md files. Content is immediately available for the next generation.</p>
          </div>
        </div>

        {/* KB content viewer */}
        <Card className="lg:col-span-3 border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Current Knowledge Base</CardTitle>
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">
                {kbData?.content ? `${kbData.content.split('\n').length} lines` : "Loading..."}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {kbLoading && (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {kbData && (
              <pre className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono bg-muted/20 rounded-lg p-4 max-h-[600px] overflow-y-auto border border-border/40">
                {kbData.content}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
