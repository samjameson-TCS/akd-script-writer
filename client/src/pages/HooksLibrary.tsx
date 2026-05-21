import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Trash2, Pencil, Trophy, RefreshCw } from "lucide-react";

const CATEGORIES = [
  "Curiosity", "Betrayal", "Compensation", "Urgency", "Story",
  "Question", "Pattern", "Symptom", "Authority", "Family",
];

const CATEGORY_COLORS: Record<string, string> = {
  Curiosity: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Betrayal: "bg-red-500/20 text-red-300 border-red-500/30",
  Compensation: "bg-green-500/20 text-green-300 border-green-500/30",
  Urgency: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Story: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Question: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Pattern: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  Symptom: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Authority: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  Family: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

type Hook = {
  id: number;
  hookLine: string;
  category: string;
  source: string | null;
  lawsuitKey: string | null;
  isWinning: number;
  notes: string | null;
  createdAt: Date;
};

type HookFormData = {
  hookLine: string;
  category: string;
  source: string;
  lawsuitKey: string;
  isWinning: boolean;
  notes: string;
};

const emptyForm: HookFormData = {
  hookLine: "",
  category: "Curiosity",
  source: "manual",
  lawsuitKey: "",
  isWinning: false,
  notes: "",
};

export default function HooksLibrary() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterWinning, setFilterWinning] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHook, setEditingHook] = useState<Hook | null>(null);
  const [form, setForm] = useState<HookFormData>(emptyForm);

  const utils = trpc.useUtils();

  const { data: hooks = [], isLoading, refetch } = trpc.hooks.list.useQuery({});

  const addHook = trpc.hooks.add.useMutation({
    onSuccess: () => {
      toast.success("Hook added to library");
      utils.hooks.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateHook = trpc.hooks.update.useMutation({
    onSuccess: () => {
      toast.success("Hook updated");
      utils.hooks.list.invalidate();
      setDialogOpen(false);
      setEditingHook(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteHook = trpc.hooks.delete.useMutation({
    onSuccess: () => {
      toast.success("Hook deleted");
      utils.hooks.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    let result = hooks as Hook[];
    if (filterCategory !== "all") result = result.filter(h => h.category === filterCategory);
    if (filterWinning === "winning") result = result.filter(h => h.isWinning === 1);
    if (filterWinning === "template") result = result.filter(h => h.isWinning === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(h =>
        h.hookLine.toLowerCase().includes(q) ||
        (h.source ?? "").toLowerCase().includes(q) ||
        (h.lawsuitKey ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [hooks, filterCategory, filterWinning, search]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map: Record<string, Hook[]> = {};
    for (const h of filtered) {
      if (!map[h.category]) map[h.category] = [];
      map[h.category].push(h);
    }
    return map;
  }, [filtered]);

  const openAdd = () => {
    setEditingHook(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (hook: Hook) => {
    setEditingHook(hook);
    setForm({
      hookLine: hook.hookLine,
      category: hook.category,
      source: hook.source ?? "manual",
      lawsuitKey: hook.lawsuitKey ?? "",
      isWinning: hook.isWinning === 1,
      notes: hook.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.hookLine.trim()) return toast.error("Hook line is required");
    if (editingHook) {
      updateHook.mutate({
        id: editingHook.id,
        hookLine: form.hookLine.trim(),
        category: form.category,
        source: form.source || "manual",
        lawsuitKey: form.lawsuitKey || null,
        isWinning: form.isWinning,
        notes: form.notes || null,
      });
    } else {
      addHook.mutate({
        hookLine: form.hookLine.trim(),
        category: form.category,
        source: form.source || "manual",
        lawsuitKey: form.lawsuitKey || undefined,
        isWinning: form.isWinning,
        notes: form.notes || undefined,
      });
    }
  };

  const winningCount = (hooks as Hook[]).filter(h => h.isWinning === 1).length;
  const templateCount = (hooks as Hook[]).filter(h => h.isWinning === 0).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Hooks Library</h1>
            <p className="text-sm text-gray-400 mt-1">
              {(hooks as Hook[]).length} hooks total &mdash; {winningCount} winning &middot; {templateCount} templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-1 bg-cyan-600 hover:bg-cyan-700 text-white">
              <Plus className="w-4 h-4" />
              Add Hook
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => {
            const count = (hooks as Hook[]).filter(h => h.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filterCategory === cat
                    ? CATEGORY_COLORS[cat] + " ring-1 ring-current"
                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search hooks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
          <Select value={filterWinning} onValueChange={setFilterWinning}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="All hooks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All hooks</SelectItem>
              <SelectItem value="winning">Winning only</SelectItem>
              <SelectItem value="template">Templates only</SelectItem>
            </SelectContent>
          </Select>
          {(filterCategory !== "all" || filterWinning !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterCategory("all"); setFilterWinning("all"); setSearch(""); }}
              className="text-gray-400 hover:text-white"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading hooks...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No hooks match your filters.</div>
        ) : filterCategory !== "all" ? (
          // Single category flat list
          <div className="space-y-2">
            {filtered.map(hook => (
              <HookRow key={hook.id} hook={hook} onEdit={openEdit} onDelete={id => deleteHook.mutate({ id })} />
            ))}
          </div>
        ) : (
          // Grouped by category
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, catHooks]) => (
              <Card key={cat} className="bg-white/5 border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[cat] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
                      {cat}
                    </span>
                    <span className="text-gray-400 text-sm font-normal">{catHooks.length} hooks</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {catHooks.map(hook => (
                    <HookRow key={hook.id} hook={hook} onEdit={openEdit} onDelete={id => deleteHook.mutate({ id })} />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingHook ? "Edit Hook" : "Add Hook"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Hook Line *</Label>
              <Textarea
                value={form.hookLine}
                onChange={e => setForm(f => ({ ...f, hookLine: e.target.value }))}
                placeholder='e.g. "The shocking truth about [x]"'
                className="bg-white/5 border-white/10 text-white min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Input
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="e.g. HOOKS | Morane"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Lawsuit (optional)</Label>
                <Input
                  value={form.lawsuitKey}
                  onChange={e => setForm(f => ({ ...f, lawsuitKey: e.target.value }))}
                  placeholder="e.g. Hernia Mesh"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isWinning}
                    onChange={e => setForm(f => ({ ...f, isWinning: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <span className="text-sm text-gray-300">Mark as winning hook</span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes about when this hook works best..."
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={addHook.isPending || updateHook.isPending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {editingHook ? "Save Changes" : "Add Hook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HookRow({ hook, onEdit, onDelete }: { hook: Hook; onEdit: (h: Hook) => void; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-white/3 hover:bg-white/7 group transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 leading-relaxed">{hook.hookLine}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {hook.isWinning === 1 && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Trophy className="w-3 h-3" /> Winning
            </span>
          )}
          {hook.lawsuitKey && (
            <span className="text-xs text-gray-500">{hook.lawsuitKey}</span>
          )}
          {hook.source && (
            <span className="text-xs text-gray-600">{hook.source}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="w-7 h-7 text-gray-400 hover:text-white" onClick={() => onEdit(hook)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-gray-400 hover:text-red-400"
          onClick={() => {
            if (confirm("Delete this hook?")) onDelete(hook.id);
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
