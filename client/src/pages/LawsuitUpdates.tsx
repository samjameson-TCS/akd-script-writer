import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, ExternalLink, Newspaper, Clock, AlertCircle } from "lucide-react";

const RESEARCH_BACKED = [
  "Hernia Mesh",
  "PowerPort",
  "Depo-Provera",
  "Social Media Addiction",
  "NY Juvenile Detention",
  "Illinois Juvenile Detention",
];

const LAWSUIT_ICONS: Record<string, string> = {
  "Hernia Mesh": "🩺",
  "PowerPort": "💉",
  "Depo-Provera": "💊",
  "Social Media Addiction": "📱",
  "NY Juvenile Detention": "⚖️",
  "Illinois Juvenile Detention": "⚖️",
};

export default function LawsuitUpdates() {
  const [selectedLawsuit, setSelectedLawsuit] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.updates.getAll.useQuery(
    { lawsuitKey: selectedLawsuit ?? undefined },
    { refetchOnWindowFocus: false }
  );

  const scrapeAll = trpc.updates.scrapeAll.useMutation({
    onSuccess: (result) => {
      toast.success(`Refreshed — ${result.totalSaved} articles saved across all lawsuits`);
      refetch();
    },
    onError: (err) => toast.error(`Refresh failed: ${err.message}`),
  });

  const scrapeOne = trpc.updates.scrapeOne.useMutation({
    onSuccess: (result) => {
      toast.success(`Refreshed — ${result.count} articles saved`);
      refetch();
    },
    onError: (err) => toast.error(`Refresh failed: ${err.message}`),
  });

  const lastScrape = data?.lastScrape;
  const updates = data?.updates ?? [];

  // Group updates by lawsuit key
  const grouped: Record<string, typeof updates> = {};
  for (const u of updates) {
    if (!grouped[u.lawsuitKey]) grouped[u.lawsuitKey] = [];
    grouped[u.lawsuitKey].push(u);
  }

  const displayLawsuits = selectedLawsuit ? [selectedLawsuit] : RESEARCH_BACKED;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lawsuit Updates</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Latest news from{" "}
              <a
                href="https://www.lawsuit-information-center.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                lawsuit-information-center.com
              </a>
              {lastScrape && (
                <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  Last updated {new Date(lastScrape).toLocaleString()}
                </span>
              )}
            </p>
          </div>
          <Button
            onClick={() => scrapeAll.mutate()}
            disabled={scrapeAll.isPending}
            className="shrink-0 gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${scrapeAll.isPending ? "animate-spin" : ""}`} />
            {scrapeAll.isPending ? "Refreshing all…" : "Refresh All"}
          </Button>
        </div>

        {/* Lawsuit filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedLawsuit(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              selectedLawsuit === null
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
            }`}
          >
            All Lawsuits
          </button>
          {RESEARCH_BACKED.map((l) => (
            <button
              key={l}
              onClick={() => setSelectedLawsuit(selectedLawsuit === l ? null : l)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                selectedLawsuit === l
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
              }`}
            >
              {LAWSUIT_ICONS[l]} {l}
            </button>
          ))}
        </div>

        {/* Empty state — no scrape done yet */}
        {!isLoading && updates.length === 0 && (
          <Card className="border-dashed border-border/60">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <Newspaper className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium text-foreground">No updates yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click <strong>Refresh All</strong> to pull the latest news from the site.
                </p>
              </div>
              <Button onClick={() => scrapeAll.mutate()} disabled={scrapeAll.isPending} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${scrapeAll.isPending ? "animate-spin" : ""}`} />
                {scrapeAll.isPending ? "Fetching…" : "Fetch Now"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-4 w-32 bg-muted rounded" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-3/4 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Lawsuit cards */}
        {!isLoading && updates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {displayLawsuits.map((lawsuitKey) => {
              const lawsuitUpdates = grouped[lawsuitKey] ?? [];
              return (
                <Card key={lawsuitKey} className="border-border bg-card flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <span>{LAWSUIT_ICONS[lawsuitKey]}</span>
                        <span>{lawsuitKey}</span>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {lawsuitUpdates.length} articles
                        </Badge>
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => scrapeOne.mutate({ lawsuitKey })}
                        disabled={scrapeOne.isPending}
                      >
                        <RefreshCw className={`h-3 w-3 ${scrapeOne.isPending ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    {lawsuitUpdates.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        No articles found — click Refresh to try again
                      </div>
                    ) : (
                      lawsuitUpdates.map((update) => (
                        <div
                          key={update.id}
                          className="border border-border/50 rounded-lg p-3 space-y-1.5 hover:border-border transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={update.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-foreground hover:text-primary transition-colors leading-snug flex-1"
                            >
                              {update.title}
                            </a>
                            <a
                              href={update.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                          {update.summary && (
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                              {update.summary}
                            </p>
                          )}
                          {update.publishedAt && (
                            <p className="text-xs text-muted-foreground/60">{update.publishedAt}</p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}
