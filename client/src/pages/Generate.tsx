import { useState } from "react";
import { X, RefreshCw, BookmarkPlus, BookmarkCheck, ArrowUpCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  // Local comment thread — accumulates all comments for this script in this session
  // Comments are saved to DB immediately on submit, never lost
  const [commentThread, setCommentThread] = useState<ThreadComment[]>([]);
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [savedToDashboard, setSavedToDashboard] = useState(false);

  const saveScriptMutation = trpc.savedScripts.save.useMutation({
    onSuccess: () => {
      setSavedToDashboard(true);
      toast.success("Saved to Dashboard", { description: script.name });
      // If there are unpromoted session comments, suggest promoting them
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

  // Add comment — saves immediately to DB, never lost
  const addComment = trpc.scriptComments.add.useMutation({
    onSuccess: (data) => {
      const saved: ThreadComment = { id: data.id, text: newComment.trim(), savedAt: new Date().toLocaleTimeString() };
      setCommentThread(prev => [...prev, saved]);
      setNewComment("");
      toast.success("Note saved to session thread", {
        description: "Will be applied on every regeneration of this script",
      });
    },
    onError: (err) => toast.error(err.message),
  });

  // Promote a session comment to a global KB rule
  const promoteComment = trpc.scriptComments.promote.useMutation({
    onSuccess: (data, variables) => {
      // Mark as promoted in local state
      setCommentThread(prev =>
        prev.map(c => c.id === variables.commentId ? { ...c, promoted: true } : c)
      );
      toast.success("Promoted to global KB rule", {
        description: `"${data.kbRule}"`,
        duration: 6000,
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const regenerateOne = trpc.scripts.regenerateOne.useMutation({
    onSuccess: (data) => {
      onReplace(index, data.script as GeneratedScript);
      setIsRegenerating(false);
      toast.success("Script regenerated", {
        description: commentThread.length > 0
          ? `Applied ${commentThread.length} session note${commentThread.length > 1 ? "s" : ""}`
          : "Improved based on your feedback",
      });
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
    addComment.mutate({
      sessionId,
      scriptName: script.name,
      comment: newComment.trim(),
    });
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    const scriptNum = generationParams.scriptNumberStart + script.pairIndex;
    // Pass the full accumulated comment thread — AI never forgets earlier notes
    const threadTexts = commentThread.map(c => c.text);
    // Also include the current unsaved comment if any
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
        {/* Gold accent top border on variant A */}
        {script.variantIndex === 0 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
        )}

        {/* Regenerating overlay */}
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
                <Badge
                  variant="outline"
                  className={`text-xs font-mono ${script.variantIndex === 0 ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground border-border/40"}`}
                >
                  {script.variantIndex === 0 ? "Hook A" : "Hook B"}
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground/60 border-border/30">
                  {wordCount}w
                </Badge>
                {commentThread.length > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30 bg-amber-500/5">
                    {commentThread.length} note{commentThread.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-sm font-semibold text-foreground leading-relaxed font-mono">
                {script.name}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 shrink-0 transition-colors ${
                  savedToDashboard
                    ? "text-emerald-500 hover:text-emerald-500"
                    : "text-muted-foreground hover:text-emerald-500"
                }`}
                onClick={handleSaveToDashboard}
                disabled={savedToDashboard || saveScriptMutation.isPending}
                title={savedToDashboard ? "Saved to Dashboard" : "Save to Dashboard"}
              >
                {saveScriptMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : savedToDashboard ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
              </Button>
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
              className={`flex-1 h-8 text-xs gap-1.5 border-border/60 hover:border-primary/50 hover:text-primary ${commentThread.length > 0 ? "border-amber-500/30 text-amber-500 hover:border-amber-500/60" : ""}`}
              onClick={() => setFeedbackOpen(!feedbackOpen)}
              disabled={isRegenerating}
            >
              <MessageSquare className="h-3 w-3" />
              {commentThread.length > 0 ? `Notes (${commentThread.length})` : "Add Note"}
              {feedbackOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-border/60 hover:border-amber-500/50 hover:text-amber-500"
              onClick={handleRegenerate}
              disabled={isRegenerating || regenerateOne.isPending}
              title={commentThread.length > 0 ? `Regenerate applying all ${commentThread.length} notes` : "Regenerate this script"}
            >
              <RefreshCw className="h-3 w-3" />
              Redo
            </Button>
          </div>

          {/* Feedback / Notes panel */}
          {feedbackOpen && (
            <div className="space-y-3 pt-1">

              {/* Existing comment thread */}
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
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5 text-muted-foreground/40 hover:text-primary"
                              title="Promote to global KB rule (applies to all future scripts)"
                              onClick={() => promoteComment.mutate({ commentId: c.id!, comment: c.text, scriptName: script.name })}
                              disabled={promoteComment.isPending}
                            >
                              <ArrowUpCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/40">
                    All notes above will be applied on the next regeneration. Hover a note and click ↑ to promote it to a global KB rule.
                  </p>
                </div>
              )}

              {/* New comment input */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note about this script — saved immediately, applied on every regeneration. E.g. 'Include compensation in the hook' or 'Too formal, make it more casual'"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[72px] text-sm bg-muted/30 border-border/60 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment();
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs border-border/60"
                    disabled={!newComment.trim() || addComment.isPending}
                    onClick={handleAddComment}
                  >
                    {addComment.isPending ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</>
                    ) : (
                      "Save Note"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                    disabled={isRegenerating || regenerateOne.isPending}
                    onClick={handleRegenerate}
                  >
                    {isRegenerating || regenerateOne.isPending ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Regenerating...</>
                    ) : (
                      <><RefreshCw className="h-3 w-3" /> Redo with All Notes</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground/40">
                  "Save Note" stores it in the session thread. "Redo with All Notes" regenerates applying every note in the thread. ⌘+Enter to save.
                </p>
              </div>
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
  const [complianceLevel, setComplianceLevel] = useState<1 | 2 | 3>(3);
  const [referenceScript, setReferenceScript] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [scriptNumberStart, setScriptNumberStart] = useState(1);
  const [pairsCount, setPairsCount] = useState(3);
  const [results, setResults] = useState<{ scripts: GeneratedScript[]; sessionId: number | null } | null>(null);

  const generateMutation = trpc.scripts.generate.useMutation({
    onSuccess: (data) => {
      setResults({ scripts: data.scripts as GeneratedScript[], sessionId: data.sessionId ?? null });
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: metaData } = trpc.meta.useQuery();

  const researchBackedLawsuits = metaData?.researchBackedLawsuits ?? [];
  const otherLawsuits = metaData?.otherLawsuits ?? [];
  const hookCategoryOptions = metaData?.hookCategories ?? [];
  const avatarOptions = metaData?.avatars ?? [];

  const handleReplace = (index: number, newScript: GeneratedScript) => {
    if (!results) return;
    const updated = [...results.scripts];
    updated[index] = newScript;
    setResults({ ...results, scripts: updated });
  };

  // Build generation params object to pass down to each ScriptCard
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
    if (!avatar) return toast.error("Please select an avatar");
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
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Generate Scripts</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your parameters and generate paired scripts</p>
      </div>

      {/* Form */}
      <Card className="border border-border/60 bg-card">
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Lawsuit */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lawsuit</Label>
              <Select value={lawsuit} onValueChange={setLawsuit}>
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
            </div>

            {/* Avatar */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avatar</Label>
              <Select value={avatar} onValueChange={setAvatar}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select avatar..." />
                </SelectTrigger>
                <SelectContent>
                  {avatarOptions.map((a: string) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Meta", "TikTok", "YouTube", "Other"].map((p) => (
                    <SelectItem key={p} value={p}>{p}{p === "Meta" ? " (75-100 words)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Compliance Level */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance Level</Label>
              <Select value={String(complianceLevel)} onValueChange={(v) => setComplianceLevel(Number(v) as 1 | 2 | 3)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { level: 1, label: "Level 1 — Broughton Partners" },
                    { level: 2, label: "Level 2 — Pulaski / Aggregators" },
                    { level: 3, label: "Level 3 — LCA / Aggregators" },
                  ].map((cl) => (
                    <SelectItem key={cl.level} value={String(cl.level)}>
                      {cl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Hook Categories */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hook Category <span className="text-muted-foreground/50 normal-case font-normal">(optional — AI picks if none selected)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
                  {(hookCategoryOptions as string[]).map((cat) => {
                const isSelected = hookCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setHookCategories(prev =>
                        isSelected ? prev.filter(k => k !== cat) : [...prev, cat]
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isSelected
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
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
            <Slider
              min={1}
              max={5}
              step={1}
              value={[aggressiveScale]}
              onValueChange={([v]) => setAggressiveScale(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground/50">
              <span>1 — Gentle</span>
              <span>3 — Balanced</span>
              <span>5 — Aggressive</span>
            </div>
          </div>

          {/* Pairs Count + Script Number Start */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pairs to Generate</Label>
              <Select value={String(pairsCount)} onValueChange={(v) => setPairsCount(Number(v))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} pair{n > 1 ? "s" : ""} ({n * 2} scripts)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Script Number Start</Label>
              <Select value={String(scriptNumberStart)} onValueChange={(v) => setScriptNumberStart(Number(v))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                    <SelectItem key={n} value={String(n)}>HM {n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reference Script */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reference Script <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Paste a reference script here to guide the style and structure..."
              value={referenceScript}
              onChange={(e) => setReferenceScript(e.target.value)}
              className="min-h-[80px] text-sm bg-muted/30 border-border/60 resize-none"
            />
          </div>

          {/* Extra Instructions */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Extra Instructions <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Any specific instructions for this batch — e.g. 'Focus on the settlement amount' or 'Use the recent study about meningioma'"
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              className="min-h-[72px] text-sm bg-muted/30 border-border/60 resize-none"
            />
          </div>

          {/* Generate Button */}
          <Button
            className="w-full h-10 text-sm font-semibold gap-2"
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !lawsuit || !avatar}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating {pairsCount * 2} scripts...</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Generate {pairsCount * 2} Scripts</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{results.scripts.length} Scripts Generated</h2>
              {results.sessionId && (
                <p className="text-xs text-muted-foreground/50 font-mono">Session #{results.sessionId}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => setResults(null)}
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>

          <div className="space-y-3">
            {results.scripts.map((script, i) => (
              <ScriptCard
                key={`${script.name}-${i}`}
                script={script}
                sessionId={results.sessionId}
                index={i}
                isPairStart={script.variantIndex === 0}
                generationParams={generationParams}
                onReplace={handleReplace}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
