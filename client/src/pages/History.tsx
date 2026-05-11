import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History as HistoryIcon, Copy, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function History() {
  const [filterLawsuit, setFilterLawsuit] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: meta } = trpc.meta.useQuery();
  const { data: history, isLoading } = trpc.scripts.history.useQuery(
    filterLawsuit && filterLawsuit !== "all" ? { lawsuit: filterLawsuit } : {}
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-primary" />
            Script History
          </h1>
          <p className="text-sm text-muted-foreground">All previously generated scripts, organized by lawsuit.</p>
        </div>
        <Select value={filterLawsuit} onValueChange={setFilterLawsuit}>
          <SelectTrigger className="w-48 h-9 text-sm bg-muted/30 border-border/60">
            <SelectValue placeholder="Filter by lawsuit..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lawsuits</SelectItem>
            {meta?.lawsuits.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (!history || history.length === 0) && (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground border border-dashed border-border/40 rounded-xl">
          <HistoryIcon className="h-8 w-8 opacity-30" />
          <p className="text-sm">No scripts generated yet</p>
        </div>
      )}

      <div className="space-y-3">
        {history?.map((session: any) => (
          <Card key={session.id} className="border-border bg-card">
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">
                    {session.lawsuit}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {session.hookCategory}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Scale {session.aggressiveScale}/5
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(session.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {expandedId === session.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            </CardHeader>

            {expandedId === session.id && (
              <CardContent className="space-y-4 pt-0">
                {session.scripts?.map((script: any, i: number) => (
                  <div key={i} className="border border-border/50 rounded-lg p-4 space-y-3 bg-muted/10">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xs font-semibold text-foreground font-mono">{script.name}</CardTitle>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => handleCopy(`${script.name}\n\nHOOK A\n${script.hookA}\n\nHOOK B\n${script.hookB}\n\nBODY\n${script.body}\n\nCTA\n${script.cta}`)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-primary/70 text-xs font-semibold uppercase tracking-wider">Hook A</span><p className="text-foreground mt-0.5">{script.hookA}</p></div>
                      <div><span className="text-primary/70 text-xs font-semibold uppercase tracking-wider">Hook B</span><p className="text-foreground mt-0.5">{script.hookB}</p></div>
                      <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Body</span><p className="text-foreground mt-0.5">{script.body}</p></div>
                      <div><span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">CTA</span><p className="text-foreground mt-0.5">{script.cta}</p></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
