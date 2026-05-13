import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ChevronRight,
  Loader2,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BuyerSpec = {
  id: number;
  buyerName: string;
  buyerCode: string | null;
  lawsuitKeys: string | null;
  content: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EditForm = {
  id?: number;
  buyerName: string;
  buyerCode: string;
  lawsuitKeys: string;
  content: string;
  notes: string;
};

const EMPTY_FORM: EditForm = {
  buyerName: "",
  buyerCode: "",
  lawsuitKeys: "",
  content: "",
  notes: "",
};

export default function BuyerSpecs() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");

  const { data: specs = [], isLoading, refetch } = trpc.buyerSpecs.list.useQuery();
  const upsertMutation = trpc.buyerSpecs.upsert.useMutation({
    onSuccess: () => {
      toast.success(form.id ? "Buyer spec updated" : "Buyer spec added");
      setEditOpen(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.buyerSpecs.delete.useMutation({
    onSuccess: () => {
      toast.success("Buyer spec deleted");
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = specs.filter((s: BuyerSpec) =>
    s.buyerName.toLowerCase().includes(search.toLowerCase()) ||
    (s.buyerCode ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.lawsuitKeys ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const selected = specs.find((s: BuyerSpec) => s.id === selectedId) ?? null;

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditOpen(true);
  };

  const openEdit = (spec: BuyerSpec) => {
    setForm({
      id: spec.id,
      buyerName: spec.buyerName,
      buyerCode: spec.buyerCode ?? "",
      lawsuitKeys: spec.lawsuitKeys ?? "",
      content: spec.content,
      notes: spec.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!form.buyerName.trim()) return toast.error("Buyer name is required");
    if (!form.content.trim()) return toast.error("Spec content is required");
    upsertMutation.mutate({
      id: form.id,
      buyerName: form.buyerName.trim(),
      buyerCode: form.buyerCode.trim() || undefined,
      lawsuitKeys: form.lawsuitKeys.trim() || undefined,
      content: form.content.trim(),
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Buyer Spec Sheets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage buyer-specific criteria. Select a buyer when generating scripts to apply their rules automatically.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Buyer
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-[600px]">
        {/* Left: list */}
        <Card className="border border-border/60 bg-card h-fit">
          <CardHeader className="pb-3">
            <Input
              placeholder="Search buyers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">{search ? "No matches" : "No buyer specs yet"}</p>
                {!search && (
                  <Button variant="outline" size="sm" onClick={openNew} className="mt-2 gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add first buyer
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map((spec: BuyerSpec) => (
                  <button
                    key={spec.id}
                    onClick={() => setSelectedId(spec.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center justify-between gap-2 ${
                      selectedId === spec.id ? "bg-primary/5 border-l-2 border-primary" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{spec.buyerName}</p>
                      {spec.buyerCode && (
                        <p className="text-xs text-muted-foreground font-mono">{spec.buyerCode}</p>
                      )}
                      {spec.lawsuitKeys && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {spec.lawsuitKeys.split(",").slice(0, 2).map((k) => (
                            <Badge key={k} variant="outline" className="text-[10px] px-1 py-0 h-4">
                              {k.trim()}
                            </Badge>
                          ))}
                          {spec.lawsuitKeys.split(",").length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                              +{spec.lawsuitKeys.split(",").length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform ${selectedId === spec.id ? "text-primary rotate-90" : ""}`} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: viewer */}
        {selected ? (
          <Card className="border border-border/60 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold">{selected.buyerName}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {selected.buyerCode && (
                      <Badge variant="secondary" className="font-mono text-xs">{selected.buyerCode}</Badge>
                    )}
                    {selected.lawsuitKeys && selected.lawsuitKeys.split(",").map((k) => (
                      <Badge key={k} variant="outline" className="text-xs">{k.trim()}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => openEdit(selected)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setDeleteId(selected.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Spec content */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Criteria / Spec Sheet</p>
                <div className="rounded-md border border-border/40 bg-muted/20 p-4">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.content}
                  </pre>
                </div>
              </div>
              {/* Notes */}
              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Additional Notes</p>
                  <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-sm text-foreground">{selected.notes}</p>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground/50">
                Last updated: {new Date(selected.updatedAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-dashed border-border/40 bg-transparent flex items-center justify-center">
            <div className="text-center text-muted-foreground space-y-2 p-12">
              <Users className="h-10 w-10 opacity-20 mx-auto" />
              <p className="text-sm">Select a buyer from the list to view their spec sheet</p>
            </div>
          </Card>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Buyer Spec" : "Add Buyer Spec"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Buyer Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. Broughton Partners"
                  value={form.buyerName}
                  onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Buyer Code
                </Label>
                <Input
                  placeholder="e.g. BP (optional)"
                  value={form.buyerCode}
                  onChange={(e) => setForm({ ...form, buyerCode: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Applicable Lawsuits (comma-separated)
              </Label>
              <Input
                placeholder="e.g. Hernia Mesh, PowerPort, Depo-Provera"
                value={form.lawsuitKeys}
                onChange={(e) => setForm({ ...form, lawsuitKeys: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Leave blank if this applies to all lawsuits</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Spec Sheet / Criteria <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Paste the full buyer criteria here — approved words, banned words, required disclosures, tone guidelines, etc."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="min-h-[240px] font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Additional Notes
              </Label>
              <Textarea
                placeholder="Any extra context or reminders for this buyer (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="gap-1.5">
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending} className="gap-1.5">
              {upsertMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {form.id ? "Save Changes" : "Add Buyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Buyer Spec?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the buyer spec sheet. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
