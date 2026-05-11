import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Calendar, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Streamdown } from "streamdown";

// ─── Lawsuit colour map ───────────────────────────────────────────────────────
const LAWSUIT_COLORS: Record<string, string> = {
  "Hernia Mesh": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "PowerPort": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "NY Juvenile Detention": "bg-red-500/15 text-red-400 border-red-500/30",
  "Depo-Provera": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Social Media Addiction": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Illinois Juvenile Detention": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

const LAWSUIT_ICONS: Record<string, string> = {
  "Hernia Mesh": "🩺",
  "PowerPort": "💉",
  "NY Juvenile Detention": "🏛️",
  "Depo-Provera": "💊",
  "Social Media Addiction": "📱",
  "Illinois Juvenile Detention": "⚖️",
};

// ─── Doc Viewer ───────────────────────────────────────────────────────────────

function DocViewer({ docId, onBack }: { docId: number; onBack: () => void }) {
  const { data: doc, isLoading } = trpc.research.getById.useQuery({ id: docId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Library
        </Button>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Library
        </Button>
        <p className="text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  const colorClass = LAWSUIT_COLORS[doc.lawsuitKey] ?? "bg-muted text-muted-foreground border-border";
  const icon = LAWSUIT_ICONS[doc.lawsuitKey] ?? "📄";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground mt-1 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-2xl">{icon}</span>
            <Badge variant="outline" className={`text-xs ${colorClass}`}>
              {doc.lawsuitKey}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Updated {new Date(doc.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{doc.title}</h1>
          {doc.summary && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/40 pl-3">
              {doc.summary}
            </p>
          )}
        </div>
      </div>

      {/* Full content */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-foreground prose-headings:font-semibold
            prose-h1:text-xl prose-h2:text-lg prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-2 prose-h2:mb-4
            prose-h3:text-base prose-h3:text-primary/90
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-strong:text-foreground
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-table:text-sm prose-th:text-foreground prose-th:font-semibold prose-th:bg-muted/30
            prose-td:text-muted-foreground prose-td:align-top
            prose-code:text-primary/80 prose-code:bg-muted/40 prose-code:px-1 prose-code:rounded
            prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground
            prose-li:text-muted-foreground
          ">
            <Streamdown>{doc.content}</Streamdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Library Page ────────────────────────────────────────────────────────

export default function ResearchLibrary() {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: docs, isLoading } = trpc.research.list.useQuery();

  const filtered = docs?.filter((doc) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      doc.lawsuitKey.toLowerCase().includes(q) ||
      doc.title.toLowerCase().includes(q) ||
      (doc.summary ?? "").toLowerCase().includes(q)
    );
  });

  if (selectedDocId !== null) {
    return (
      <div className="max-w-5xl mx-auto py-2">
        <DocViewer docId={selectedDocId} onBack={() => setSelectedDocId(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Research Library</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Deep research briefs for each lawsuit. The AI uses these when generating scripts — click any brief to read the full document.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search lawsuits, topics, keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border/50"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6 mt-2" />
                <Skeleton className="h-4 w-4/6 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No research docs match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered?.map((doc) => {
            const colorClass = LAWSUIT_COLORS[doc.lawsuitKey] ?? "bg-muted text-muted-foreground border-border";
            const icon = LAWSUIT_ICONS[doc.lawsuitKey] ?? "📄";
            return (
              <Card
                key={doc.id}
                className="border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => setSelectedDocId(doc.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl">{icon}</span>
                      <Badge variant="outline" className={`text-xs ${colorClass}`}>
                        {doc.lawsuitKey}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                    {doc.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {doc.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {doc.summary}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-xs text-primary/70 group-hover:text-primary transition-colors">
                    <FileText className="h-3 w-3" />
                    <span>Read full brief →</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        {docs?.length ?? 0} research briefs loaded · AI automatically uses the matching brief when you generate scripts
      </p>
    </div>
  );
}
