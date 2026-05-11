import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy, Trash2, CheckCheck, ChevronDown, ChevronUp,
  BookmarkCheck, LayoutDashboard, Loader2
} from "lucide-react";

const COMPLIANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "L1 Broughton", color: "text-red-400 border-red-400/30 bg-red-400/5" },
  2: { label: "L2 Pulaski", color: "text-amber-400 border-amber-400/30 bg-amber-400/5" },
  3: { label: "L3 LCA", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5" },
};

type SavedScript = {
  id: number;
  name: string;
  lawsuit: string;
  hookCategory: string | null;
  hookAngle: string | null;
  hook: string;
  body: string;
  cta: string;
  complianceLevel: number | null;
  platform: string | null;
  aggressiveScale: number | null;
  savedAt: Date;
};

function ScriptRow({ script, onDelete }: { script: SavedScript; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullText = `${script.name}\n\nHOOK\n${script.hook}\n\nBODY\n${script.body}\n\nCTA\n${script.cta}`;
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const compliance = script.complianceLevel ? COMPLIANCE_LABELS[script.complianceLevel] : null;

  return (
    <Card className="border border-border/50 bg-card/50 hover:bg-card transition-colors">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {compliance && (
                <Badge variant="outline" className={`text-xs ${compliance.color}`}>
                  {compliance.label}
                </Badge>
              )}
              {script.platform && (
                <Badge variant="outline" className="text-xs text-muted-foreground/60 border-border/30">
                  {script.platform}
                </Badge>
              )}
              {script.aggressiveScale && (
                <Badge variant="outline" className="text-xs text-muted-foreground/60 border-border/30">
                  {script.aggressiveScale}/5
                </Badge>
              )}
              <Badge variant="outline" className="text-xs text-muted-foreground/50 border-border/20">
                {wordCount}w
              </Badge>
            </div>
            {/* Script name */}
            <CardTitle className="text-sm font-semibold font-mono text-foreground leading-snug truncate">
              {script.name}
            </CardTitle>
            {/* Hook preview */}
            {!expanded && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {script.hook}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={handleCopy}
              title="Copy full script"
            >
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(script.id)}
              title="Remove from Dashboard"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 space-y-3">
          <div className="h-px bg-border/30" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-wider">Hook</p>
            <p className="text-sm text-foreground leading-relaxed">{script.hook}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</p>
            <p className="text-sm text-foreground leading-relaxed">{script.body}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA</p>
            <p className="text-sm text-foreground leading-relaxed">{script.cta}</p>
          </div>
          <p className="text-xs text-muted-foreground/40 pt-1">
            Saved {new Date(script.savedAt).toLocaleDateString()}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const [expandedLawsuits, setExpandedLawsuits] = useState<Record<string, boolean>>({});
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.savedScripts.list.useQuery();

  const deleteScript = trpc.savedScripts.delete.useMutation({
    onSuccess: () => {
      utils.savedScripts.list.invalidate();
      toast.success("Script removed from Dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleLawsuit = (lawsuit: string) => {
    setExpandedLawsuits(prev => ({ ...prev, [lawsuit]: !prev[lawsuit] }));
  };

  const grouped = data?.grouped ?? {};
  const lawsuitKeys = Object.keys(grouped).sort();
  const totalScripts = data?.scripts.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Script Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Your saved scripts — {totalScripts} script{totalScripts !== 1 ? "s" : ""} across {lawsuitKeys.length} lawsuit{lawsuitKeys.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {totalScripts === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookmarkCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-muted-foreground/60">No saved scripts yet</p>
          <p className="text-sm text-muted-foreground/40 mt-1 max-w-xs">
            Generate scripts and click the bookmark icon on any script card to save it here.
          </p>
        </div>
      )}

      {/* Grouped by lawsuit */}
      {lawsuitKeys.map((lawsuit) => {
        const scripts = grouped[lawsuit] as SavedScript[];
        const isExpanded = expandedLawsuits[lawsuit] !== false; // default expanded

        return (
          <div key={lawsuit} className="space-y-2">
            {/* Lawsuit header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/40 transition-colors"
              onClick={() => toggleLawsuit(lawsuit)}
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm text-foreground">{lawsuit}</span>
                <Badge variant="secondary" className="text-xs">
                  {scripts.length} script{scripts.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {/* Scripts list */}
            {isExpanded && (
              <div className="space-y-2 pl-2">
                {scripts.map((script) => (
                  <ScriptRow
                    key={script.id}
                    script={script}
                    onDelete={(id) => deleteScript.mutate({ id })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
