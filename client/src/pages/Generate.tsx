import { useState, useCallback } from "react";
import { X, RefreshCw, BookmarkPlus, BookmarkCheck, ArrowUpCircle, GitBranch, Wand2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Copy, MessageSquare, Loader2, CheckCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

type GenerationParams = {
  lawsuit: string;
  hookCategory?: string;
  aggressiveScale: number;
  avatar: string;
  platform: "Meta" | "TikTok" | "YouTube" | "Other";
  complianceLevel: 1 | 2 | 3;
  scriptNumberStart: number;
  referenceScript?: string;
  extraInstructions?: string;
};

type ThreadComment = {
  id?: number;
  text: string;
  savedAt: string;
  promoted?: boolean;
};

type IterationResult = {
  type: string;
  label: string;
  hook: string;
  body: string;
  cta: string;
};

// ─── ScriptCard ───────────────────────────────────────────────────────────────

type ScriptCardProps = {
  script: GeneratedScript;
  sessionId: number | null;
  index: number;
  isPairStart: boolean;
  generationParams: GenerationParams;
  onReplace: (index: number, newScript: GeneratedScript) => void;
};

function ScriptCard({ script, sessionId, index, isPairStart, generationParams, onReplace }: ScriptCardProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentThread, setCommentThread] = useState<ThreadComment[]>([]);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [savedToDashboard, setSavedToDashboard] = useState(false);

  const saveScriptMutation = trpc.savedScripts.save.useMutation({
    onSuccess: () => {
      setSavedToDashboard(true);
      toast.success("Saved to Dashboard", { description: script.name });
      if (commentThread.length > 0) {
        toast.info("Tip: You can promote your session notes to global KB rules", {
          description: "Open the feedback panel and click ↑ next to any comment",
          duration: 6000,
        });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveToDashboard = () => {
    if (savedToDashboard) return;
    saveScriptMutation.mutate({
      name: script.name,
      lawsuit: generationParams.lawsuit,
      hookCategory: generationParams.hookCategory,
      hookAngle: script.hookAngle,
      hook: script.hook,
      body: script.body,
      cta: script.cta,
      complianceLevel: generationParams.complianceLevel,
      platform: generationParams.platform,
      aggressiveScale: generationParams.aggressiveScale,
      sessionId: sessionId ?? undefined,
    });
  };

  const addComment = trpc.scriptComments.add.useMutation({
    onSuccess: (data) => {
      const saved: ThreadComment = { id: data.id, text: newComment.trim(), savedAt: new Date().toLocaleTimeString() };
      setCommentThread(prev => [...prev, saved]);
      setNewComment("");
      toast.success("Note saved to session thread");
    },
    onError: (err) => toast.error(err.message),
  });

  const promoteComment = trpc.scriptComments.promote.useMutation({
    onSuccess: (data, variables) => {
      setCommentThread(prev =>
        prev.map(c => c.id === variables.commentId ? { ...c, promoted: true } : c)
      );
      toast.success("Promoted to global KB rule", { description: `"${data.kbRule}"`, duration: 6000 });
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateOne = trpc.scripts.regenerateOne.useMutation({
    onSuccess: (data) => {
      onReplace(index, data.script as GeneratedScript);
      setIsRegenerating(false);
      toast.success("Script regenerated");
    },
    onError: (err) => {
      setIsRegenerating(false);
      toast.error(err.message);
    },
  });

  const fullText = `${script.name}\n\nHOOK\n${script.hook}\n\nBODY\n${script.body}\n\nCTA\n${script.cta}`;
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddComment = () => {
    if (!sessionId) return toast.error("No session ID — please regenerate the batch first");
    if (!newComment.trim()) return;
    addComment.mutate({ sessionId, scriptName: script.name, comment: newComment.trim() });
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    const scriptNum = generationParams.scriptNumberStart + script.pairIndex;
    const threadTexts = commentThread.map(c => c.text);
    if (newComment.trim()) threadTexts.push(newComment.trim());
    regenerateOne.mutate({
      lawsuit: generationParams.lawsuit,
      hookCategory: generationParams.hookCategory,
      aggressiveScale: generationParams.aggressiveScale,
      avatar: generationParams.avatar,
      platform: generationParams.platform,
      complianceLevel: generationParams.complianceLevel,
      scriptNumber: scriptNum,
      existingScript: script,
      feedbackText: newComment.trim() || undefined,
      _commentThread: threadTexts.length > 0 ? threadTexts : undefined,
      referenceScript: generationParams.referenceScript,
      extraInstructions: generationParams.extraInstructions,
    });
  };

  return (
    <>
      {isPairStart && index > 0 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border/30" />
          <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">Pair {script.pairIndex + 1}</span>
          <div className="flex-1 h-px bg-border/30" />
        </div>
      )}
      <Card className={`border bg-card relative overflow-hidden transition-opacity ${isRegenerating ? "opacity-50" : ""} ${script.variantIndex === 0 ? "border-primary/20" : "border-border/60"}`}>
        {script.variantIndex === 0 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
        )}
        {isRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/60 z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs font-medium">Regenerating with all notes...</span>
            </div>
          </div>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className={`text-xs font-mono ${script.variantIndex === 0 ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground border-border/40"}`}>
                  {script.variantIndex === 0 ? "Hook A" : "Hook B"}
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground/60 border-border/30">{wordCount}w</Badge>
                {commentThread.length > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/5">
                    {commentThread.length} note{commentThread.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-sm font-semibold text-foreground leading-relaxed font-mono">{script.name}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className={`h-8 w-8 shrink-0 transition-colors ${savedToDashboard ? "text-emerald-500 hover:text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`} onClick={handleSaveToDashboard} disabled={savedToDashboard || saveScriptMutation.isPending} title={savedToDashboard ? "Saved to Dashboard" : "Save to Dashboard"}>
                {saveScriptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedToDashboard ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0" onClick={handleCopy} title="Copy script">
                {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-primary/70 uppercase tracking-wider">Hook</p>
            <p className="text-sm text-foreground leading-relaxed">{script.hook}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</p>
            <p className="text-sm text-foreground leading-relaxed">{script.body}</p>
          </div>
          <div className="space-y-1 pb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA</p>
            <p className="text-sm text-foreground leading-relaxed">{script.cta}</p>
          </div>
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Button size="sm" variant="outline" className={`flex-1 h-8 text-xs gap-1.5 border-border/60 hover:border-primary/50 hover:text-primary ${commentThread.length > 0 ? "border-amber-500/30 text-amber-500 hover:border-amber-500/60" : ""}`} onClick={() => setFeedbackOpen(!feedbackOpen)} disabled={isRegenerating}>
              <MessageSquare className="h-3 w-3" />
              {commentThread.length > 0 ? `Notes (${commentThread.length})` : "Add Note"}
              {feedbackOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-border/60 hover:border-amber-500/50 hover:text-amber-500" onClick={handleRegenerate} disabled={isRegenerating || regenerateOne.isPending} title={commentThread.length > 0 ? `Regenerate applying all ${commentThread.length} notes` : "Regenerate this script"}>
              <RefreshCw className="h-3 w-3" /> Redo
            </Button>
          </div>
          {feedbackOpen && (
            <div className="space-y-3 pt-1">
              {commentThread.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session Notes</p>
                  <div className="space-y-1.5 rounded-md border border-border/40 bg-muted/20 p-2.5">
                    {commentThread.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 group">
                        <span className="text-xs text-muted-foreground/40 font-mono mt-0.5 shrink-0">{i + 1}.</span>
                        <p className="text-xs text-foreground flex-1 leading-relaxed">{c.text}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <span className="text-xs text-muted-foreground/40">{c.savedAt}</span>
                          {c.id && (
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground/40 hover:text-primary" title="Promote to global KB rule" onClick={() => promoteComment.mutate({ commentId: c.id!, comment: c.text, scriptName: script.name })} disabled={promoteComment.isPending}>
                              <ArrowUpCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Textarea placeholder="Add a note about this script — saved immediately, applied on every regeneration." value={newComment} onChange={(e) => setNewComment(e.target.value)} className="min-h-[72px] text-sm bg-muted/30 border-border/60 resize-none" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment(); }} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-border/60" disabled={!newComment.trim() || addComment.isPending} onClick={handleAddComment}>
                    {addComment.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</> : "Save Note"}
                  </Button>
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1.5" disabled={isRegenerating || regenerateOne.isPending} onClick={handleRegenerate}>
                    {isRegenerating || regenerateOne.isPending ? <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating...</> : <><RefreshCw className="h-3 w-3" /> Redo with All Notes</>}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/40">"Save Note" stores it in the session thread. "Redo with All Notes" regenerates applying every note. ⌘+Enter to save.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── IterationCard ────────────────────────────────────────────────────────────

const ITERATION_LABELS: Record<string, string> = {
  WINNING_ANGLE_REFRAMED: "Winning Angle Reframed",
  DIFFERENT_SEVERITY_TIER: "Different Severity Tier",
  DIFFERENT_ANGLE: "Different Angle / Type",
  MORE_AGGRESSIVE: "More Aggressive",
  SHORT_VERSION: "Short Version",
  COMPENSATION_VERSION: "Compensation Version",
  SYNONYM: "Synonym Swap",
  SLANG: "Slang Version",
  DIFFERENT_POV: "Different POV",
};

function IterationCard({ iteration, lawsuit, complianceLevel, platform }: { iteration: IterationResult; lawsuit: string; complianceLevel: 1 | 2 | 3; platform: "Meta" | "TikTok" | "YouTube" | "Other" }) {
  const [copied, setCopied] = useState(false);
  const [savedToDashboard, setSavedToDashboard] = useState(false);

  const saveScriptMutation = trpc.savedScripts.save.useMutation({
    onSuccess: () => {
      setSavedToDashboard(true);
      toast.success("Saved to Dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const fullText = `HOOK\n${iteration.hook}\n\nBODY\n${iteration.body}\n\nCTA\n${iteration.cta}`;
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const label = ITERATION_LABELS[iteration.type] ?? iteration.label ?? iteration.type;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (savedToDashboard) return;
    saveScriptMutation.mutate({
      name: `${lawsuit.substring(0, 3).toUpperCase()}-ITER-${iteration.type}`,
      lawsuit,
      hookAngle: iteration.type.toLowerCase().replace(/_/g, "-"),
      hook: iteration.hook,
      body: iteration.body,
      cta: iteration.cta,
      complianceLevel,
      platform,
      aggressiveScale: 3,
    });
  };

  return (
    <Card className="border border-border/60 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/5 mb-1.5">{label}</Badge>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground/60 border-border/30">{wordCount}w</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className={`h-8 w-8 shrink-0 transition-colors ${savedToDashboard ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`} onClick={handleSave} disabled={savedToDashboard || saveScriptMutation.isPending} title={savedToDashboard ? "Saved" : "Save to Dashboard"}>
              {saveScriptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedToDashboard ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0" onClick={handleCopy}>
              {copied ? <CheckCheck className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-primary/70 uppercase tracking-wider">Hook</p>
          <p className="text-sm text-foreground leading-relaxed">{iteration.hook}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</p>
          <p className="text-sm text-foreground leading-relaxed">{iteration.body}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTA</p>
          <p className="text-sm text-foreground leading-relaxed">{iteration.cta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── LawsuitSelect (shared) ───────────────────────────────────────────────────

function LawsuitSelect({ value, onChange, researchBackedLawsuits, otherLawsuits }: { value: string; onChange: (v: string) => void; researchBackedLawsuits: string[]; otherLawsuits: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-sm">
        <SelectValue placeholder="Select lawsuit..." />
      </SelectTrigger>
      <SelectContent>
        {researchBackedLawsuits.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs text-primary/70">Research-Backed</SelectLabel>
            {researchBackedLawsuits.map((l: string) => (
              <SelectItem key={l} value={l}>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                  {l}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {otherLawsuits.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground">Other Lawsuits</SelectLabel>
              {otherLawsuits.map((l: string) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

// ─── NewScripts Mode ──────────────────────────────────────────────────────────

function NewScriptsMode() {
  const [lawsuit, setLawsuit] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [hookCategories, setHookCategories] = useState<string[]>([]);
  const [aggressiveScale, setAggressiveScale] = useState(2);
  const [avatar, setAvatar] = useState("General Public");
  const [platform, setPlatform] = useState<"Meta" | "TikTok" | "YouTube" | "Other">("Other");
  const [complianceLevel, setComplianceLevel] = useState<1 | 2 | 3>(3);
  const [referenceScript, setReferenceScript] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [scriptNumberStart, setScriptNumberStart] = useState(300);
  const [pairsCount, setPairsCount] = useState(3);
  const [buyerSpecId, setBuyerSpecId] = useState<number | undefined>(undefined);
  const [results, setResults] = useState<{ scripts: GeneratedScript[]; sessionId: number | null } | null>(null);

  const generateMutation = trpc.scripts.generate.useMutation({
    onSuccess: (data) => {
      setResults({ scripts: data.scripts as GeneratedScript[], sessionId: data.sessionId ?? null });
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: metaData } = trpc.meta.useQuery();
  const { data: buyerSpecsList = [] } = trpc.buyerSpecs.list.useQuery();

  const researchBackedLawsuits = metaData?.researchBackedLawsuits ?? [];
  const otherLawsuits = metaData?.otherLawsuits ?? [];
  const hookCategoryOptions = metaData?.hookCategories ?? [];
  const avatarOptions = metaData?.avatars ?? [];

  const handleReplace = useCallback((index: number, newScript: GeneratedScript) => {
    setResults(prev => {
      if (!prev) return prev;
      const updated = [...prev.scripts];
      updated[index] = newScript;
      return { ...prev, scripts: updated };
    });
  }, []);

  const generationParams: GenerationParams = {
    lawsuit,
    hookCategory: hookCategories.length === 1 ? hookCategories[0] : undefined,
    aggressiveScale,
    avatar,
    platform,
    complianceLevel,
    scriptNumberStart,
    referenceScript: referenceScript.trim() || undefined,
    extraInstructions: extraInstructions.trim() || undefined,
  };

  const handleGenerate = () => {
    if (!lawsuit) return toast.error("Please select a lawsuit");
    generateMutation.mutate({
      lawsuit,
      hookCategory: hookCategories.length === 1 ? hookCategories[0] : undefined,
      aggressiveScale,
      avatar,
      platform,
      complianceLevel,
      pairsCount,
      scriptNumberStart,
      referenceScript: referenceScript.trim() || undefined,
      extraInstructions: extraInstructions.trim() || undefined,
      buyerSpecId,
    });
  };

  return (
    <div className="space-y-5">
      <Card className="border border-border/60 bg-card">
        <CardContent className="pt-6 space-y-5">
            {/* Primary: Lawsuit only */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lawsuit</Label>
            <LawsuitSelect value={lawsuit} onChange={setLawsuit} researchBackedLawsuits={researchBackedLawsuits} otherLawsuits={otherLawsuits} />
          </div>

          {/* Generate button — always visible */}
          <Button className="w-full h-10 text-sm font-semibold gap-2" onClick={handleGenerate} disabled={generateMutation.isPending || !lawsuit}>
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating {pairsCount * 2} scripts...</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Generate {pairsCount * 2} Scripts</>
            )}
          </Button>

          {/* Optional filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <div className="flex-1 h-px bg-border/30" />
            <span className="flex items-center gap-1.5 px-2">
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showFilters ? "Hide filters" : "Add filters (platform, compliance, hook, scale, buyer spec...)"}
            </span>
            <div className="flex-1 h-px bg-border/30" />
          </button>

          {showFilters && (
            <div className="space-y-5 pt-1">
              {/* Avatar */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avatar <span className="text-muted-foreground/50 normal-case font-normal">(default: General Public)</span></Label>
                <Select value={avatar} onValueChange={setAvatar}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select avatar..." /></SelectTrigger>
                  <SelectContent>
                    {avatarOptions.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Platform + Compliance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</Label>
                  <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Meta", "TikTok", "YouTube", "Other"].map((p) => (
                        <SelectItem key={p} value={p}>{p}{p === "Meta" ? " (75-100 words)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance Level</Label>
                  <Select value={String(complianceLevel)} onValueChange={(v) => setComplianceLevel(Number(v) as 1 | 2 | 3)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[{ level: 1, label: "Level 1 — Broughton Partners" }, { level: 2, label: "Level 2 — Pulaski / Aggregators" }, { level: 3, label: "Level 3 — LCA / Aggregators" }].map((cl) => (
                        <SelectItem key={cl.level} value={String(cl.level)}>{cl.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Buyer Spec */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buyer Spec <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></Label>
                <Select value={buyerSpecId !== undefined ? String(buyerSpecId) : "none"} onValueChange={(v) => setBuyerSpecId(v === "none" ? undefined : Number(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No buyer spec selected" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No buyer spec</SelectItem>
                    {(buyerSpecsList as Array<{id: number; buyerName: string; buyerCode: string | null}>).map((spec) => (
                      <SelectItem key={spec.id} value={String(spec.id)}>{spec.buyerName}{spec.buyerCode ? ` (${spec.buyerCode})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hook Categories */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hook Category <span className="text-muted-foreground/50 normal-case font-normal">(optional — AI picks if none selected)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {(hookCategoryOptions as string[]).map((cat) => {
                    const isSelected = hookCategories.includes(cat);
                    return (
                      <button key={cat} type="button" onClick={() => setHookCategories(prev => isSelected ? prev.filter(k => k !== cat) : [...prev, cat])} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${isSelected ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aggressive Scale */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aggressive Scale</Label>
                  <span className="text-sm font-bold text-primary">{aggressiveScale}/5</span>
                </div>
                <Slider min={1} max={5} step={1} value={[aggressiveScale]} onValueChange={([v]) => setAggressiveScale(v)} className="w-full" />
                <div className="flex justify-between text-xs text-muted-foreground/50">
                  <span>1 — Gentle</span><span>3 — Balanced</span><span>5 — Aggressive</span>
                </div>
              </div>

              {/* Pairs + Script Number */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pairs to Generate</Label>
                  <Select value={String(pairsCount)} onValueChange={(v) => setPairsCount(Number(v))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} pair{n > 1 ? "s" : ""} ({n * 2} scripts)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Script Number Start</Label>
                  <Select value={String(scriptNumberStart)} onValueChange={(v) => setScriptNumberStart(Number(v))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>HM {n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reference Script */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reference Script <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></Label>
                <Textarea placeholder="Paste a reference script here to guide the style and structure..." value={referenceScript} onChange={(e) => setReferenceScript(e.target.value)} className="min-h-[80px] text-sm bg-muted/30 border-border/60 resize-none" />
              </div>

              {/* Extra Instructions */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Extra Instructions <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></Label>
                <Textarea placeholder="Any specific instructions for this batch..." value={extraInstructions} onChange={(e) => setExtraInstructions(e.target.value)} className="min-h-[72px] text-sm bg-muted/30 border-border/60 resize-none" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{results.scripts.length} Scripts Generated</h2>
              {results.sessionId && <p className="text-xs text-muted-foreground/50 font-mono">Session #{results.sessionId}</p>}
            </div>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5" onClick={() => setResults(null)}>
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
          <div className="space-y-3">
            {results.scripts.map((script, i) => (
              <ScriptCard key={`${script.name}-${i}`} script={script} sessionId={results.sessionId} index={i} isPairStart={script.variantIndex === 0} generationParams={generationParams} onReplace={handleReplace} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Iterate Mode ─────────────────────────────────────────────────────────────

function IterateMode() {
  const [originalScript, setOriginalScript] = useState("");
  const [detectedLawsuit, setDetectedLawsuit] = useState<string | null>(null);
  const [detectionConfidence, setDetectionConfidence] = useState<string | null>(null);
  const [manualLawsuit, setManualLawsuit] = useState("");
  const [complianceLevel, setComplianceLevel] = useState<1 | 2 | 3>(3);
  const [platform, setPlatform] = useState<"Meta" | "TikTok" | "YouTube" | "Other">("Other");
  const [buyerSpecId, setBuyerSpecId] = useState<number | undefined>(undefined);
  const [iterations, setIterations] = useState<IterationResult[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const { data: metaData } = trpc.meta.useQuery();
  const { data: buyerSpecsList = [] } = trpc.buyerSpecs.list.useQuery();
  const researchBackedLawsuits = metaData?.researchBackedLawsuits ?? [];
  const otherLawsuits = metaData?.otherLawsuits ?? [];

  const detectMutation = trpc.scripts.detectLawsuit.useMutation({
    onSuccess: (data) => {
      if (data.lawsuit) {
        setDetectedLawsuit(data.lawsuit);
        setDetectionConfidence(data.confidence);
        setManualLawsuit(data.lawsuit);
        toast.success(`Detected: ${data.lawsuit}`, { description: `Confidence: ${data.confidence}` });
      } else {
        toast.warning("Could not auto-detect lawsuit", { description: "Please select it manually below" });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const iterateMutation = trpc.scripts.iterate.useMutation({
    onSuccess: (data) => {
      setIterations(data.iterations as IterationResult[]);
      setSessionId(data.sessionId ?? null);
    },
    onError: (err) => toast.error(err.message),
  });

  const activeLawsuit = manualLawsuit || detectedLawsuit || "";

  const handleDetect = () => {
    if (!originalScript.trim()) return toast.error("Please paste a script first");
    detectMutation.mutate({ scriptText: originalScript.trim() });
  };

  const handleIterate = () => {
    if (!originalScript.trim()) return toast.error("Please paste a script first");
    if (!activeLawsuit) return toast.error("Please select or detect the lawsuit");
    iterateMutation.mutate({
      originalScript: originalScript.trim(),
      lawsuit: activeLawsuit,
      complianceLevel,
      platform,
      buyerSpecId,
    });
  };

  return (
    <div className="space-y-5">
      <Card className="border border-border/60 bg-card">
        <CardContent className="pt-6 space-y-5">
          {/* Paste script */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Winning Script to Iterate</Label>
            <Textarea
              placeholder="Paste your winning script here (hook + body + CTA)..."
              value={originalScript}
              onChange={(e) => {
                setOriginalScript(e.target.value);
                // Reset detection when script changes
                if (detectedLawsuit) { setDetectedLawsuit(null); setDetectionConfidence(null); }
              }}
              className="min-h-[160px] text-sm bg-muted/30 border-border/60 resize-none font-mono"
            />
          </div>

          {/* Auto-detect + lawsuit selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-border/60 hover:border-primary/50 hover:text-primary"
                onClick={handleDetect}
                disabled={detectMutation.isPending || !originalScript.trim()}
              >
                {detectMutation.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Detecting...</>
                ) : (
                  <><Search className="h-3 w-3" /> Auto-detect Lawsuit</>
                )}
              </Button>
              {detectedLawsuit && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/5">
                    {detectedLawsuit}
                  </Badge>
                  <span className="text-xs text-muted-foreground/50">{detectionConfidence} confidence</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lawsuit {detectedLawsuit ? <span className="text-muted-foreground/50 normal-case font-normal">(auto-detected — override if needed)</span> : <span className="text-muted-foreground/50 normal-case font-normal">(select or auto-detect above)</span>}
              </Label>
              <LawsuitSelect value={manualLawsuit} onChange={setManualLawsuit} researchBackedLawsuits={researchBackedLawsuits} otherLawsuits={otherLawsuits} />
            </div>
          </div>

          {/* Compliance + Platform */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Meta", "TikTok", "YouTube", "Other"].map((p) => (
                    <SelectItem key={p} value={p}>{p}{p === "Meta" ? " (75-100 words)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance Level</Label>
              <Select value={String(complianceLevel)} onValueChange={(v) => setComplianceLevel(Number(v) as 1 | 2 | 3)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[{ level: 1, label: "Level 1 — Broughton Partners" }, { level: 2, label: "Level 2 — Pulaski / Aggregators" }, { level: 3, label: "Level 3 — LCA / Aggregators" }].map((cl) => (
                    <SelectItem key={cl.level} value={String(cl.level)}>{cl.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Buyer Spec */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Buyer Spec <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></Label>
            <Select value={buyerSpecId !== undefined ? String(buyerSpecId) : "none"} onValueChange={(v) => setBuyerSpecId(v === "none" ? undefined : Number(v))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No buyer spec" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No buyer spec</SelectItem>
                {(buyerSpecsList as Array<{id: number; buyerName: string; buyerCode: string | null}>).map((spec) => (
                  <SelectItem key={spec.id} value={String(spec.id)}>{spec.buyerName}{spec.buyerCode ? ` (${spec.buyerCode})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Iterate button */}
          <Button className="w-full h-10 text-sm font-semibold gap-2" onClick={handleIterate} disabled={iterateMutation.isPending || !originalScript.trim() || !activeLawsuit}>
            {iterateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating 9 iterations...</>
            ) : (
              <><GitBranch className="h-4 w-4" /> Generate 9 Iterations</>
            )}
          </Button>

          {/* Iteration types legend */}
          <div className="rounded-md border border-border/30 bg-muted/20 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">9 Iteration Types</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
              {Object.values(ITERATION_LABELS).map((label) => (
                <span key={label} className="text-xs text-muted-foreground/70 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary/40 shrink-0" />{label}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Iteration Results */}
      {iterations && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{iterations.length} Iterations Generated</h2>
              {sessionId && <p className="text-xs text-muted-foreground/50 font-mono">Session #{sessionId}</p>}
            </div>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5" onClick={() => setIterations(null)}>
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {iterations.map((it, i) => (
              <IterationCard key={i} iteration={it} lawsuit={activeLawsuit} complianceLevel={complianceLevel} platform={platform} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Generate Page ───────────────────────────────────────────────────────

export default function Generate() {
  const [activeTab, setActiveTab] = useState<"new" | "iterate">("new");

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Generate Scripts</h1>
        <p className="text-sm text-muted-foreground mt-1">Create new scripts or iterate on a winning one</p>
      </div>

      {/* Mode Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "new" | "iterate")}>
        <TabsList className="grid w-full grid-cols-2 h-10">
          <TabsTrigger value="new" className="gap-2 text-sm">
            <Wand2 className="h-3.5 w-3.5" /> New Scripts
          </TabsTrigger>
          <TabsTrigger value="iterate" className="gap-2 text-sm">
            <GitBranch className="h-3.5 w-3.5" /> Iterate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-5">
          <NewScriptsMode />
        </TabsContent>

        <TabsContent value="iterate" className="mt-5">
          <IterateMode />
        </TabsContent>
      </Tabs>
    </div>
  );
}
