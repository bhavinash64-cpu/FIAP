import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Layers, Plus, Quote, Search, Trash2, Copy, Pencil, ShieldAlert, ChevronLeft, Loader2, FileQuestion, X, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { BankItemCard } from "@/components/bank/BankItemCard";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import {
  listBank, createInstrument, updateInstrument, deleteInstrument, duplicateInstrument,
  createItem, updateItem, deleteItem, duplicateItem, reorderItems, changeItemKind,
  addOption, updateOption, deleteOption, reorderOptions, revertItem,
  isInstrumentModified, countModified, countIncomplete, instrumentIssues, BANK_KINDS,
  type BankInstrument, type BankItem,
} from "@/lib/questionBank";
import type { QuestionKind } from "@/lib/surveys";
import { staggerParent, staggerChild, easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Debounce key that is unique per (row, field) — see handleChangeField. */
const fieldKey = (id: string, patch: object) => `${id}:${Object.keys(patch).sort().join(",")}`;

export default function QuestionBank() {
  const [bank, setBank] = useState<BankInstrument[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [creatingInstrument, setCreatingInstrument] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<BankInstrument | null>(null);
  const [deletingInstrument, setDeletingInstrument] = useState<BankInstrument | null>(null);
  const [deletingItem, setDeletingItem] = useState<BankItem | null>(null);
  // Phones show one pane at a time: the instrument list, or the questions in it.
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  // Prompt/option typing is debounced per row so a keystroke is not a round-trip.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { void load(); }, []);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  async function load() {
    try {
      const data = await listBank();
      setBank(data);
      setActiveId((cur) => cur ?? data[0]?.id ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the question bank.");
      setBank([]);
    }
  }

  const active = useMemo(() => bank?.find((i) => i.id === activeId) ?? null, [bank, activeId]);
  const total = useMemo(() => (bank ?? []).reduce((n, i) => n + i.items.length, 0), [bank]);
  const modifiedTotal = useMemo(() => (bank ?? []).reduce((n, i) => n + countModified(i), 0), [bank]);
  const incompleteTotal = useMemo(() => (bank ?? []).reduce((n, i) => n + countIncomplete(i), 0), [bank]);

  const visibleItems = useMemo(() => {
    if (!active) return [];
    const q = query.trim().toLowerCase();
    if (!q) return active.items;
    return active.items.filter(
      (it) => it.prompt_en.toLowerCase().includes(q) || (it.prompt_te ?? "").toLowerCase().includes(q),
    );
  }, [active, query]);

  /** Optimistic local patch — the list must not flicker or lose scroll on every keystroke. */
  const patchItem = useCallback((itemId: string, patch: Partial<BankItem>) => {
    setBank((b) =>
      b?.map((inst) => ({ ...inst, items: inst.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) })) ?? b,
    );
  }, []);

  const debounce = useCallback((key: string, fn: () => Promise<unknown>) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      void fn().catch((e) => toast.error(e instanceof Error ? e.message : "Could not save."));
    }, 500);
  }, []);

  // ── Item handlers ─────────────────────────────────────────────────────
  const handleChangeField = useCallback(
    (item: BankItem, patch: Partial<Pick<BankItem, "prompt_en" | "prompt_te" | "required">>) => {
      patchItem(item.id, patch);
      // A toggle is a deliberate single act — persist it now; only typing waits.
      if ("required" in patch) {
        void updateItem(item.id, patch).catch((e) => toast.error(e instanceof Error ? e.message : "Could not save."));
      } else {
        // Key per FIELD, not per row. Keyed on item.id alone, typing the English
        // prompt and then the Telugu one within 500ms had the second keystroke
        // clear the first's timer — and since each patch carries only the field
        // that changed, the English edit was never sent at all.
        debounce(fieldKey(item.id, patch), () => updateItem(item.id, patch));
      }
    },
    [patchItem, debounce],
  );

  async function handleChangeKind(item: BankItem, kind: QuestionKind) {
    patchItem(item.id, { kind });
    try {
      const options = await changeItemKind(item, kind);
      patchItem(item.id, { options });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the response type.");
      void load();
    }
  }

  async function handleAddItem(kind: QuestionKind) {
    if (!active) return;
    try {
      const item = await createItem(active.id, { kind });
      setBank((b) => b?.map((i) => (i.id === active.id ? { ...i, items: [...i.items, item] } : i)) ?? b);
      setExpandedItem(item.id);
      toast.success("Question added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the question.");
    }
  }

  async function handleDeleteItem() {
    const item = deletingItem;
    if (!item) return;
    setDeletingItem(null);
    setBank((b) => b?.map((i) => ({ ...i, items: i.items.filter((x) => x.id !== item.id) })) ?? b);
    try {
      await deleteItem(item.id);
      toast.success("Question deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
      void load();
    }
  }

  async function handleDuplicateItem(item: BankItem) {
    try {
      const copy = await duplicateItem(item);
      setBank((b) => b?.map((i) => (i.id === item.instrument_id ? { ...i, items: [...i.items, copy] } : i)) ?? b);
      toast.success("Question duplicated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate.");
    }
  }

  async function handleRevert(item: BankItem) {
    try {
      const restored = await revertItem(item);
      patchItem(item.id, restored);
      toast.success("Restored to the published version");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revert.");
    }
  }

  async function handleReorder(e: DragEndEvent) {
    const { active: a, over } = e;
    if (!over || a.id === over.id || !active) return;
    // Reordering a filtered view would write the filtered order back to the
    // whole instrument, silently scrambling the hidden items.
    if (query.trim()) return;

    const ids = active.items.map((i) => i.id);
    const from = ids.indexOf(String(a.id));
    const to = ids.indexOf(String(over.id));
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, String(a.id));

    const byId = new Map(active.items.map((i) => [i.id, i]));
    const reordered = next.map((id, i) => ({ ...byId.get(id)!, order_index: i }));
    setBank((b) => b?.map((i) => (i.id === active.id ? { ...i, items: reordered } : i)) ?? b);
    try {
      await reorderItems(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the new order.");
      void load();
    }
  }

  // ── Option handlers ───────────────────────────────────────────────────
  async function handleAddOption(item: BankItem) {
    try {
      const o = await addOption(item.id, item.options.length);
      patchItem(item.id, { options: [...item.options, o] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the option.");
    }
  }

  function handleUpdateOption(item: BankItem, oid: string, patch: { label_en?: string; label_te?: string | null }) {
    patchItem(item.id, { options: item.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) });
    // Per-field key, same reason as handleChangeField: label_en and label_te
    // sit side by side and are routinely typed one after the other.
    debounce(fieldKey(oid, patch), () => updateOption(oid, patch));
  }

  async function handleDeleteOption(item: BankItem, oid: string) {
    patchItem(item.id, { options: item.options.filter((o) => o.id !== oid) });
    try {
      await deleteOption(oid);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the option.");
      void load();
    }
  }

  async function handleMoveOption(item: BankItem, oid: string, dir: -1 | 1) {
    const idx = item.options.findIndex((o) => o.id === oid);
    const swap = idx + dir;
    if (swap < 0 || swap >= item.options.length) return;
    const next = [...item.options];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    patchItem(item.id, { options: next });
    try {
      await reorderOptions(next.map((o) => o.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder.");
      void load();
    }
  }

  // ── Instrument handlers ───────────────────────────────────────────────
  async function handleDeleteInstrument() {
    const inst = deletingInstrument;
    if (!inst) return;
    setDeletingInstrument(null);
    try {
      await deleteInstrument(inst.id);
      const next = (bank ?? []).filter((i) => i.id !== inst.id);
      setBank(next);
      if (activeId === inst.id) setActiveId(next[0]?.id ?? null);
      toast.success(`"${inst.name_en}" deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    }
  }

  async function handleDuplicateInstrument(inst: BankInstrument) {
    try {
      await duplicateInstrument(inst);
      await load();
      toast.success(`"${inst.name_en}" duplicated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not duplicate.");
    }
  }

  if (bank === null) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="eyebrow">Masters</div>
          <h1 className="t-title mt-2">Question Bank</h1>
          <p className="mt-2 max-w-xl t-body text-muted-foreground">
            {total} question{total === 1 ? "" : "s"} across {bank.length} instrument{bank.length === 1 ? "" : "s"}. Edit
            any question, change its response type, or build your own set — then add them to a survey from the builder.
          </p>
          {/* Red before amber: an unanswerable question is a harder problem
              than one that drifted from its source. */}
          {incompleteTotal > 0 && (
            <p className="mt-2 flex items-center gap-1.5 t-caption font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {incompleteTotal} question{incompleteTotal === 1 ? " needs" : "s need"} attention — marked in red below
            </p>
          )}
          {modifiedTotal > 0 && (
            <p className="mt-2 flex items-center gap-1.5 t-caption text-warning">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {modifiedTotal} question{modifiedTotal === 1 ? "" : "s"} changed from the published version
            </p>
          )}
        </div>
        <Button onClick={() => setCreatingInstrument(true)} className="shrink-0">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> New instrument
        </Button>
      </header>

      {bank.length === 0 ? (
        <EmptyBank onCreate={() => setCreatingInstrument(true)} />
      ) : (
        <div className="mt-6 gap-6 sm:mt-8 lg:grid lg:grid-cols-[320px_1fr]">
          {/* ── Instrument list ──────────────────────────────────────────
              Its own pane on phones; a permanent sidebar from 1024px. */}
          <Card
            className={cn(
              "overflow-hidden lg:sticky lg:top-6 lg:block lg:self-start",
              mobilePane === "detail" && "hidden",
            )}
          >
            <motion.div
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="thin-scrollbar divide-y divide-border lg:max-h-[70vh] lg:overflow-y-auto"
            >
              {bank.map((inst) => (
                <InstrumentRow
                  key={inst.id}
                  inst={inst}
                  active={inst.id === activeId}
                  onSelect={() => {
                    setActiveId(inst.id);
                    setExpandedItem(null);
                    setQuery("");
                    setMobilePane("detail");
                  }}
                  onEdit={() => setEditingInstrument(inst)}
                  onDuplicate={() => handleDuplicateInstrument(inst)}
                  onDelete={() => setDeletingInstrument(inst)}
                />
              ))}
            </motion.div>
          </Card>

          {/* ── Detail ───────────────────────────────────────────────────── */}
          {active && (
            <section className={cn("min-w-0", mobilePane === "list" && "hidden lg:block")}>
              <Card className="p-4 sm:p-6">
                <button
                  type="button"
                  onClick={() => setMobilePane("list")}
                  className="-ml-1 mb-3 inline-flex h-11 items-center gap-1 rounded-control px-2 t-caption font-medium text-muted-foreground hover:bg-muted lg:hidden"
                >
                  <ChevronLeft className="h-4 w-4" /> All instruments
                </button>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="t-section">{active.name_en}</h2>
                      {active.is_builtin ? (
                        isInstrumentModified(active) ? (
                          <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                            <ShieldAlert className="h-3 w-3" /> Modified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Published version</Badge>
                        )
                      ) : (
                        <Badge variant="secondary">Custom</Badge>
                      )}
                    </div>
                    {active.name_te && <div className="mt-1 t-body text-muted-foreground">{active.name_te}</div>}
                    {active.blurb_en && <p className="mt-3 t-body text-muted-foreground">{active.blurb_en}</p>}
                    {active.source && (
                      <div className="mt-2 flex items-center gap-2 t-caption text-muted-foreground">
                        <Quote className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /> {active.source}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    {active.items.length} item{active.items.length === 1 ? "" : "s"}
                  </Badge>
                </div>

                {active.is_builtin && isInstrumentModified(active) && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-field border border-warning/30 bg-warning/5 p-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <p className="t-caption leading-relaxed">
                      This no longer matches the published instrument
                      {active.source_item_count != null && active.items.length !== active.source_item_count
                        ? ` (${active.items.length} of ${active.source_item_count} original items)`
                        : ""}
                      . Results are no longer comparable to its published norms. Individual changed questions are
                      marked below and can be reverted.
                    </p>
                  </div>
                )}

                {/* Search + add */}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" strokeWidth={1.5} />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search questions…"
                      className="pl-9"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="touch-halo absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-pill text-tertiary hover:bg-sunken hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="shrink-0">
                        <Plus className="h-4 w-4" strokeWidth={1.5} /> Add question
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {BANK_KINDS.map((k) => (
                        <DropdownMenuItem key={k.value} onClick={() => handleAddItem(k.value)} className="gap-2">
                          <QuestionTypeIcon kind={k.value} className="h-4 w-4 text-muted-foreground" />
                          {k.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {query.trim() && (
                  <p className="mt-3 t-caption text-muted-foreground">
                    {visibleItems.length} of {active.items.length} shown · reordering is disabled while searching
                  </p>
                )}

                {/* Items */}
                <div className="mt-4">
                  {active.items.length === 0 ? (
                    <EmptyInstrument onAdd={() => handleAddItem("multiple_choice")} />
                  ) : visibleItems.length === 0 ? (
                    <p className="rounded-field border border-dashed border-border px-4 py-10 text-center t-body text-muted-foreground">
                      No questions match “{query}”.
                    </p>
                  ) : (
                    <SortableItems
                      items={visibleItems}
                      disabled={!!query.trim()}
                      onReorder={handleReorder}
                      render={(item, index, drag) => (
                        <BankItemCard
                          item={item}
                          index={index}
                          dragHandleProps={drag.dragHandleProps}
                          dragging={drag.dragging}
                          expanded={expandedItem === item.id}
                          onToggleExpand={() => setExpandedItem((c) => (c === item.id ? null : item.id))}
                          onChangeField={(patch) => handleChangeField(item, patch)}
                          onChangeKind={(kind) => handleChangeKind(item, kind)}
                          onDelete={() => setDeletingItem(item)}
                          onDuplicate={() => handleDuplicateItem(item)}
                          onRevert={() => handleRevert(item)}
                          onAddOption={() => handleAddOption(item)}
                          onUpdateOption={(oid, patch) => handleUpdateOption(item, oid, patch)}
                          onDeleteOption={(oid) => handleDeleteOption(item, oid)}
                          onMoveOption={(oid, dir) => handleMoveOption(item, oid, dir)}
                        />
                      )}
                    />
                  )}
                </div>
              </Card>
            </section>
          )}
        </div>
      )}

      <InstrumentDialog
        open={creatingInstrument}
        onOpenChange={setCreatingInstrument}
        onSubmit={async (values) => {
          const inst = await createInstrument(values);
          setBank((b) => [...(b ?? []), inst]);
          setActiveId(inst.id);
          setMobilePane("detail");
          toast.success("Instrument created");
        }}
      />

      <InstrumentDialog
        open={!!editingInstrument}
        instrument={editingInstrument ?? undefined}
        onOpenChange={(v) => !v && setEditingInstrument(null)}
        onSubmit={async (values) => {
          if (!editingInstrument) return;
          await updateInstrument(editingInstrument.id, values);
          setBank((b) => b?.map((i) => (i.id === editingInstrument.id ? { ...i, ...values } : i)) ?? b);
          setEditingInstrument(null);
          toast.success("Instrument updated");
        }}
      />

      <AlertDialog open={!!deletingInstrument} onOpenChange={(v) => !v && setDeletingInstrument(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="t-section">Delete “{deletingInstrument?.name_en}”?</AlertDialogTitle>
            <AlertDialogDescription className="t-caption">
              This removes the instrument and its {deletingInstrument?.items.length} question
              {deletingInstrument?.items.length === 1 ? "" : "s"} from the bank. Surveys that already use these
              questions keep their own copies and are unaffected.
              {deletingInstrument?.is_builtin && " This is a published research instrument — deleting it cannot be undone from the app."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInstrument} className={buttonVariants({ variant: "destructive" })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingItem} onOpenChange={(v) => !v && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="t-section">Delete this question?</AlertDialogTitle>
            <AlertDialogDescription className="t-caption">
              “{deletingItem?.prompt_en || "Untitled question"}” will be removed from the bank. Surveys already using it
              are unaffected.
              {deletingItem?.is_builtin && " It is part of a published instrument, so removing it changes what that instrument measures."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className={buttonVariants({ variant: "destructive" })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Instrument row ─────────────────────────────────────────────────────── */

function InstrumentRow({
  inst, active, onSelect, onEdit, onDuplicate, onDelete,
}: {
  inst: BankInstrument;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const modified = isInstrumentModified(inst);
  const incomplete = countIncomplete(inst);
  return (
    <motion.div variants={staggerChild} className={cn("flex items-stretch", active ? "bg-primary-tint" : "hover:bg-sunken")}>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-3 px-4 py-4 text-left transition-colors sm:px-5"
      >
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-control transition-colors",
            active ? "bg-primary text-primary-foreground" : "bg-sunken text-muted-foreground",
          )}
        >
          <Layers className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate t-card">{inst.name_en}</span>
          {inst.blurb_en && <span className="mt-1 block truncate t-caption text-muted-foreground">{inst.blurb_en}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="tabular-nums">{inst.items.length}</Badge>
            {!inst.is_builtin && <span className="t-caption text-tertiary">Custom</span>}
            {/* Surfaced on the list row so an unfinished question is findable
                without opening every instrument. */}
            {incomplete > 0 && (
              <span className="inline-flex items-center gap-1 t-caption font-medium text-destructive">
                <AlertCircle className="h-3 w-3" /> {incomplete} incomplete
              </span>
            )}
            {modified && (
              <span className="inline-flex items-center gap-1 t-caption text-warning">
                <ShieldAlert className="h-3 w-3" /> Modified
              </span>
            )}
          </span>
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Actions for ${inst.name_en}`}
            className="my-2 mr-2 h-11 w-11 shrink-0 self-start text-muted-foreground lg:h-9 lg:w-9"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit} className="gap-2"><Pencil className="h-4 w-4" /> Rename / edit</DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate} className="gap-2"><Copy className="h-4 w-4" /> Duplicate</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}

/* ── Sortable wrapper ───────────────────────────────────────────────────── */

function SortableItems({
  items, disabled, onReorder, render,
}: {
  items: BankItem[];
  disabled: boolean;
  onReorder: (e: DragEndEvent) => void;
  render: (item: BankItem, index: number, drag: { dragHandleProps: React.HTMLAttributes<HTMLButtonElement>; dragging: boolean }) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // A delay, not a distance, on touch: without it the drag sensor swallows
    // the vertical swipe and the page cannot be scrolled past the list.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReorder}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <SortableRow key={item.id} id={item.id}>
              {(drag) => render(item, i, drag)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/** Hands the drag listeners to whichever element the card designates as its
 *  handle, rather than wiring them to the whole row — a row full of inputs
 *  cannot itself be draggable. */
function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (drag: { dragHandleProps: React.HTMLAttributes<HTMLButtonElement>; dragging: boolean }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: "relative" }}
    >
      {children({
        dragHandleProps: { ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>,
        dragging: isDragging,
      })}
    </div>
  );
}

/* ── Empty states ───────────────────────────────────────────────────────── */

function EmptyBank({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="mt-8 flex flex-col items-center rounded-surface border border-border bg-card px-6 py-16 text-center shadow-[var(--highlight-top),var(--shadow-sm)] sm:py-24"
    >
      <div className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
        <Layers className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="mt-6 t-section">The bank is empty</h2>
      <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">
        Create an instrument to group your questions, then add questions to it.
      </p>
      <Button onClick={onCreate} className="mt-6">
        <Plus className="h-4 w-4" strokeWidth={1.5} /> New instrument
      </Button>
    </motion.div>
  );
}

function EmptyInstrument({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-field border border-dashed border-border px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-pill bg-accent-tint">
        <FileQuestion className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <p className="mt-4 t-card">No questions yet</p>
      <p className="mt-1 t-caption text-muted-foreground">Add the first question to this instrument.</p>
      <Button size="sm" onClick={onAdd} className="mt-4">
        <Plus className="h-3.5 w-3.5" /> Add question
      </Button>
    </div>
  );
}

/* ── Create / edit instrument ───────────────────────────────────────────── */

function InstrumentDialog({
  open, onOpenChange, instrument, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instrument?: BankInstrument;
  onSubmit: (values: { name_en: string; name_te: string | null; blurb_en: string | null; source: string | null }) => Promise<void>;
}) {
  const editing = !!instrument;
  const [values, setValues] = useState({ name_en: "", name_te: "", blurb_en: "", source: "" });
  const [saving, setSaving] = useState(false);
  // Errors appear once the field has been visited or a save attempted — not
  // while the user is still typing their first character into a blank form.
  const [touchedName, setTouchedName] = useState(false);
  // Reuses the shared rule rather than restating the message here, so the
  // dialog and the bank cannot drift apart on what "valid" means.
  const nameError = touchedName
    ? (instrumentIssues({ ...(instrument ?? {}), name_en: values.name_en } as BankInstrument).find((i) => i.field === "name_en")?.message ?? null)
    : null;

  useEffect(() => {
    if (!open) return;
    setTouchedName(false);
    setValues({
      name_en: instrument?.name_en ?? "",
      name_te: instrument?.name_te ?? "",
      blurb_en: instrument?.blurb_en ?? "",
      source: instrument?.source ?? "",
    });
  }, [open, instrument]);

  async function submit() {
    if (!values.name_en.trim()) {
      setTouchedName(true);
      return;
    }
    setSaving(true);
    try {
      // null, not undefined: supabase-js omits undefined keys from the PATCH
      // body, so clearing an optional field used to leave the old value in the
      // database while the local spread showed it as cleared — the text came
      // back on reload. null actually writes the clear.
      await onSubmit({
        name_en: values.name_en.trim(),
        name_te: values.name_te.trim() || null,
        blurb_en: values.blurb_en.trim() || null,
        source: values.source.trim() || null,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="t-section">{editing ? "Edit instrument" : "New instrument"}</DialogTitle>
          <DialogDescription className="t-caption">
            An instrument is a named group of questions — a published scale, or a set of your own.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="inst-name" className={cn("t-caption", nameError && "text-destructive")}>
              Name <span aria-hidden className="text-destructive">*</span>
            </Label>
            <Input
              id="inst-name"
              value={values.name_en}
              onChange={(e) => setValues({ ...values, name_en: e.target.value })}
              onBlur={() => setTouchedName(true)}
              placeholder="Family well-being questions"
              autoFocus
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "inst-name-err" : undefined}
              className={cn(nameError && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30")}
            />
            {nameError && (
              <p id="inst-name-err" className="flex items-center gap-1.5 t-caption font-medium text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="t-caption">
              Name in Telugu <span className="font-normal text-tertiary">(optional)</span>
            </Label>
            <Input
              value={values.name_te}
              onChange={(e) => setValues({ ...values, name_te: e.target.value })}
              placeholder="తెలుగు పేరు"
              className="telugu-input"
            />
          </div>
          <div className="space-y-2">
            <Label className="t-caption">
              Description <span className="font-normal text-tertiary">(optional)</span>
            </Label>
            <Textarea
              value={values.blurb_en}
              onChange={(e) => setValues({ ...values, blurb_en: e.target.value })}
              rows={2}
              placeholder="What does this set measure?"
            />
          </div>
          <div className="space-y-2">
            <Label className="t-caption">
              Source / citation <span className="font-normal text-tertiary">(optional)</span>
            </Label>
            <Input
              value={values.source}
              onChange={(e) => setValues({ ...values, source: e.target.value })}
              placeholder="Author, year"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Create instrument"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
