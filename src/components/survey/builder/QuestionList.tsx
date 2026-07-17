import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useShallow } from "zustand/react/shallow";
import { QuestionRow } from "@/components/survey/builder/QuestionRow";
import { SectionBand } from "@/components/survey/builder/SectionBand";
import { useBuilderStore, selectVisibleIds } from "@/stores/builderStore";

export function QuestionList() {
  const visibleIds = useBuilderStore(useShallow(selectVisibleIds));
  const sections = useBuilderStore(useShallow((s) => s.sections));
  const moveQuestion = useBuilderStore((s) => s.moveQuestion);
  const moveSection = useBuilderStore((s) => s.moveSection);
  const toggleCollapse = useBuilderStore((s) => s.toggleCollapse);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Group visible ids by section. Recomputed only when membership or sections
  // change — not on every keystroke, because visibleIds is shallow-compared.
  const { grouped, indexOf } = useMemo(() => {
    const byId = useBuilderStore.getState().byId;
    const map = new Map<string | null, string[]>();
    map.set(null, []);
    for (const s of sections) map.set(s.id, []);
    const idx = new Map<string, number>();
    visibleIds.forEach((id, i) => {
      idx.set(id, i);
      const key = byId[id]?.section_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(id);
    });
    return { grouped: map, indexOf: idx };
  }, [visibleIds, sections]);

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(String(e.active.id)), []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;
      const activeKey = String(active.id);
      const overKey = String(over.id);
      if (activeKey === overKey) return;

      // Section reorder
      if (activeKey.startsWith("section:")) {
        if (!overKey.startsWith("section:")) return;
        const a = activeKey.slice("section:".length);
        const b = overKey.slice("section:".length);
        if (a === "ungrouped" || b === "ungrouped") return;
        moveSection(a, b);
        return;
      }

      const byId = useBuilderStore.getState().byId;

      // Dropped on a section's empty area → move into that section, at its end.
      if (overKey.startsWith("section-drop:")) {
        const raw = overKey.slice("section-drop:".length);
        const target = raw === "ungrouped" ? null : raw;
        moveQuestion(activeKey, null, target);
        return;
      }

      // Dropped on another question → take that question's section.
      const target = byId[overKey]?.section_id ?? null;
      moveQuestion(activeKey, overKey, target);
    },
    [moveQuestion, moveSection],
  );

  const sectionSortIds = useMemo(() => sections.map((s) => `section:${s.id}`), [sections]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={sectionSortIds} strategy={verticalListSortingStrategy}>
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {/* Ungrouped first, then sections in order. */}
            {[null, ...sections.map((s) => s.id)].map((sid) => {
              const section = sid === null ? null : sections.find((s) => s.id === sid) ?? null;
              const ids = grouped.get(sid) ?? [];
              // Hide the implicit Ungrouped band when it's empty and real sections exist.
              if (sid === null && ids.length === 0 && sections.length > 0) return null;
              return (
                <SectionBand
                  key={sid ?? "ungrouped"}
                  section={section}
                  count={ids.length}
                  collapsed={section?.collapsed ?? false}
                  onToggle={() => section && toggleCollapse(section.id)}
                >
                  {ids.map((id) => (
                    <QuestionRow key={id} id={id} index={indexOf.get(id) ?? 0} />
                  ))}
                </SectionBand>
              );
            })}
          </div>
        </SortableContext>
      </SortableContext>

      <DragOverlay>
        {activeId && !activeId.startsWith("section:") ? (
          <div className="rounded-surface border border-primary/40 bg-card px-4 py-3 shadow-[var(--highlight-top),var(--shadow-md)]">
            <span className="t-card font-semibold">
              {useBuilderStore.getState().byId[activeId]?.prompt_en || "Untitled question"}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
