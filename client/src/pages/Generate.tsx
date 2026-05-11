import { useState } from "react";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Wand2, Copy, MessageSquare, ChevronDown, ChevronUp, Loader2, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type GeneratedScript = {
  name: string;
  hook: string;
  hookAngle: string;
  body: string;
  cta: string;
  pairIndex: number;
  variantIndex: number;
};

// ─── ScriptCard ───────────────────────────────────────────────────────────────

type ScriptCardProps = {
  script: GeneratedScript;
  sessionId: number | null;
  index: number;
  isPairStart: boolean; // true = first of a pair, show pair divider
};

function ScriptCard({ script, sessionId, index, isPairStart }: ScriptCardProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [copied, setCopied] = useState(false);

  const saveFeedback = trpc.feedback.save.useMutation({
    onSuccess: () => {
      toast.success("Feedback saved to Knowledge Base");
      setFeedbackText("");
      setFeedbackOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const fullText = `${script.name}\n\nHOOK\n${script.hook}\n\nBODY\n${script.body}\n\nCTA\n${script.cta}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Word count
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  return (
    <>
      {isPairStart && index > 0 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border/30" />
          <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">Pair {script.pairIndex + 1}</span>
          <div className="flex-1 h-px bg-border/30" />
        </div>
      )}
      <Card className={`border bg-card relative overflow-hidden ${script.variantIndex === 0 ? "border-primary/20" : "border-border/60"}`}>
        {/* Gold accent top border on variant A */}
        {script.variantIndex === 0 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
        )}

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className={`text-xs font-mono ${script.variantIndex === 0 ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground border-border/40"}`}
                >
                  {script.variantIndex === 0 ? "Hook A" : "Hook B"}
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground/60 border-border/30">
                  {wordCount}w
                </Badge>
              </div>
              <CardTitle className="text-sm font-semibold text-foreground leading-relaxed font-mono">
                {script.name}
              </CardTitle>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
              onClick={handleCopy}
              title="Copy script"
            >
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Hook */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-wider">Hook</p>
            <p className="text-sm text-foreground leading-relaxed">{script.hook}</p>
          </div>

          {/* Body */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</p>
            <p className="text-sm text-foreground leading-relaxed">{script.body}</p>
          </div>

          {/* CTA */}
          <div className="space-y-1 pb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA</p>
            <p className="text-sm text-foreground leading-relaxed">{script.cta}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs gap-1.5 border-border/60 hover:border-primary/50 hover:text-primary"
              onClick={() => setFeedbackOpen(!feedbackOpen)}
            >
              <MessageSquare className="h-3 w-3" />
              Feedback
              {feedbackOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </Button>
          </div>

          {/* Feedback panel */}
          {feedbackOpen && (
            <div className="space-y-2 pt-1">
              <Textarea
                placeholder="What's wrong with this script? What should be improved? This feedback will be stored permanently in the Knowledge Base."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="min-h-[80px] text-sm bg-muted/30 border-border/60 resize-none"
              />
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                disabled={!feedbackText.trim() || saveFeedback.isPending}
                onClick={() => {
                  if (!sessionId) return toast.error("No session ID — please regenerate");
                  saveFeedback.mutate({
                    scriptId: sessionId,
                    scriptName: script.name,
                    feedbackText: feedbackText.trim(),
                  });
                }}
              >
                {saveFeedback.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Feedback to KB"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Main Generate Page ───────────────────────────────────────────────────────

export default function Generate() {
  const [lawsuit, setLawsuit] = useState("");
  const [hookCategories, setHookCategories] = useState<string[]>([]);
  const [aggressiveScale, setAggressiveScale] = useState(2);
  const [avatar, setAvatar] = useState("");
  const [platform, setPlatform] = useState<"Meta" | "TikTok" | "YouTube" | "Other">("Other");
  const [referenceScript, setReferenceScript] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [scriptNumberStart, setScriptNumberStart] = useState(1);
  const [pairsCount, setPairsCount] = useState(3);
  const [results, setResults] = useState<{ scripts: GeneratedScript[]; sessionId: number | null } | null>(null);

  const { data: meta } = trpc.meta.useQuery();

  const generate = trpc.scripts.generate.useMutation({
    onSuccess: (data) => {
      setResults({ scripts: data.scripts as GeneratedScript[], sessionId: data.sessionId ?? null });
      toast.success(`${data.scripts.length} scripts generated (${pairsCount} pairs)`);
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!lawsuit || !avatar) {
      toast.error("Please select a lawsuit and avatar");
      return;
    }
    generate.mutate({
      lawsuit,
      hookCategory: hookCategories.join(", ") || undefined,
      aggressiveScale,
      avatar,
      platform,
      referenceScript: referenceScript || undefined,
      extraInstructions: extraInstructions || undefined,
      scriptNumberStart,
      pairsCount,
    });
  };

  const aggressiveLabels = ["", "1 — Very Safe", "2 — Safe", "3 — Moderate", "4 — Aggressive", "5 — Very Aggressive"];

  // Hook category display labels with emoji
  const hookCategoryLabels: Record<string, string> = {
    "Symptom": "🚨 Symptom",
    "Compensation": "💰 Compensation",
    "Betrayal": "😤 Betrayal",
    "Curiosity": "🤔 Curiosity",
    "Story": "👤 Story",
    "Pattern": "😂 Pattern",
    "Urgency": "⏰ Urgency",
    "Family": "🧒 Family",
    "Question": "❓ Question",
    "Authority": "🔍 Authority",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-2">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          Generate Scripts
        </h1>
        <p className="text-sm text-muted-foreground">Each generation produces pairs of scripts — same body, two different hooks, each named with its own hook angle.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Lawsuit */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Lawsuit *</Label>
              <Select value={lawsuit} onValueChange={setLawsuit}>
                <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                  <SelectValue placeholder="Select lawsuit..." />
                </SelectTrigger>
                <SelectContent>
                  {meta?.lawsuits.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Hook Category — optional multi-select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Hook Category <span className="text-muted-foreground">(optional — AI decides if empty)</span></Label>
              <Select
                onValueChange={(val) => {
                  if (!hookCategories.includes(val)) {
                    setHookCategories(prev => [...prev, val]);
                  }
                }}
              >
                <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                  <SelectValue placeholder="Add hook category..." />
                </SelectTrigger>
                <SelectContent>
                  {meta?.hookCategories.map(h => (
                    <SelectItem key={h} value={h} disabled={hookCategories.includes(h)}>
                      {hookCategoryLabels[h] ?? h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hookCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {hookCategories.map(cat => (
                    <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                      {hookCategoryLabels[cat] ?? cat}
                      <button onClick={() => setHookCategories(prev => prev.filter(c => c !== cat))} className="hover:text-destructive transition-colors">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Target Avatar *</Label>
              <Select value={avatar} onValueChange={setAvatar}>
                <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                  <SelectValue placeholder="Select avatar..." />
                </SelectTrigger>
                <SelectContent>
                  {meta?.avatars.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Platform <span className="text-muted-foreground">(affects word count)</span></Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Meta">Meta (Facebook / Instagram) — 75–100 words</SelectItem>
                  <SelectItem value="TikTok">TikTok — 100–150 words</SelectItem>
                  <SelectItem value="YouTube">YouTube Shorts — 100–150 words</SelectItem>
                  <SelectItem value="Other">Other / Unspecified — 100–150 words</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aggressive Scale */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">Aggressive Scale</Label>
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs font-mono">
                  {aggressiveLabels[aggressiveScale]}
                </Badge>
              </div>
              <Slider
                value={[aggressiveScale]}
                onValueChange={([v]) => setAggressiveScale(v)}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 Safe</span>
                <span>5 Aggressive</span>
              </div>
            </div>

            {/* Pairs Count + Script Number Start — side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Pairs to Generate</Label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={pairsCount}
                  onChange={(e) => setPairsCount(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-muted/30 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Starting Number</Label>
                <input
                  type="number"
                  min={1}
                  value={scriptNumberStart}
                  onChange={(e) => setScriptNumberStart(parseInt(e.target.value) || 1)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border/60 bg-muted/30 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Reference Script */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Reference Script <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="Paste a winning script to iterate from..."
                value={referenceScript}
                onChange={(e) => setReferenceScript(e.target.value)}
                className="min-h-[100px] text-sm bg-muted/30 border-border/60 resize-none"
              />
            </div>

            {/* Extra Instructions */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">Extra Instructions <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="Any additional context or constraints for this generation..."
                value={extraInstructions}
                onChange={(e) => setExtraInstructions(e.target.value)}
                className="min-h-[80px] text-sm bg-muted/30 border-border/60 resize-none"
              />
            </div>

            <Button
              className="w-full gap-2 font-medium"
              onClick={handleGenerate}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate {pairsCount} Pair{pairsCount !== 1 ? "s" : ""} ({pairsCount * 2} Scripts)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output */}
        <div className="lg:col-span-3 space-y-3">
          {generate.isPending && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Generating script pairs with AKD Knowledge Base...</p>
            </div>
          )}

          {!generate.isPending && !results && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground border border-dashed border-border/40 rounded-xl">
              <Wand2 className="h-8 w-8 opacity-30" />
              <p className="text-sm">Configure parameters and click Generate</p>
              <p className="text-xs opacity-60">Each pair = 2 scripts with different hook angles</p>
            </div>
          )}

          {results && (
            <>
              {/* Pair header for first pair */}
              {results.scripts.length > 0 && (
                <div className="flex items-center gap-3 pb-1">
                  <div className="flex-1 h-px bg-border/30" />
                  <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">Pair 1</span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
              )}
              {results.scripts.map((script, i) => (
                <ScriptCard
                  key={i}
                  script={script}
                  sessionId={results.sessionId}
                  index={i}
                  isPairStart={script.variantIndex === 0 && i > 0}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
