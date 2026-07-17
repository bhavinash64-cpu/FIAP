import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoTextarea } from "@/components/survey/builder/AutoTextarea";
import { useBuilderStore } from "@/stores/builderStore";
import type { SurveySection } from "@/lib/surveys";
import { cn } from "@/lib/utils";

/**
 * A collapsible band grouping questions. Rendered for real sections and, in a
 * reduced form, for the implicit "Ungrouped" band that holds questions with a
 * null section_id.
 */
export const SectionBand = memo(function SectionBand({
  section,
  count,
  collapsed,
  onToggle,
  children,
}: {
  section: SurveySection | null;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const patchSection = useBuilderStore((s) => s.patchSection);
  const removeSection = useBuilderStore((s) => s.removeSection);
  const addQuestion = useBuilderStore((s) => s.addQuestion);

  const sectionId = section?.id ?? null;
  // Droppable so a question can be dragged into an empty section.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `section-drop:${sectionId ?? "ungrouped"}`,
    data: { sectionId },
  });

  const sortable = useSortable({ id: `section:${sectionId ?? "ungrouped"}`, disabled: !section });

  return (
    <section
      ref={section ? sortable.setNodeRef : undefined}
      style={section ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition } : undefined}
      className={cn("group/section", sortable.isDragging && "opacity-90")}
    >
      <header className="flex items-center gap-1.5 px-1 py-2">
        {section ? (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="grid h-6 w-5 place-items-center rounded text-muted-foreground/40 opacity-0 transition-opacity group-hover/section:opacity-100 cursor-grab active:cursor-grabbing touch-none"
            aria-label={`Reorder section ${section.title_en}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="w-5" />
        )}

        <button
          type="button"
          onClick={onToggle}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand section" : "Collapse section"}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-90")} />
        </button>

        {section ? (
          <AutoTextarea
            value={section.title_en}
            onChange={(e) => patchSection(section.id, { title_en: e.target.value })}
            placeholder="Section name"
            className="t-section min-w-0 flex-1 text-foreground"
            aria-label="Section title"
          />
        ) : (
          <span className="t-section flex-1 text-muted-foreground">Ungrouped</span>
        )}

        <span className="shrink-0 t-caption text-muted-foreground tabular-nums">
          {count} {count === 1 ? "question" : "questions"}
        </span>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => addQuestion("short_text", sectionId)}
            aria-label="Add question to this section"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {section && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeSection(section.id)}
              aria-label="Delete section — its questions move to Ungrouped"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </header>

      {!collapsed && (
        <div
          ref={setDropRef}
          className={cn(
            "space-y-2 rounded-surface pl-1 transition-colors",
            isOver && "bg-accent-tint/60",
            count === 0 && "min-h-16 border border-dashed border-border/70 grid place-items-center",
          )}
        >
          {count === 0 ? (
            <p className="t-caption text-muted-foreground">Drop questions here</p>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
});
