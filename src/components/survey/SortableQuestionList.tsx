import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { QuestionEditorCard } from "@/components/survey/QuestionEditorCard";
import type { QuestionKind, SurveyQuestion } from "@/lib/surveys";

function SortableItem({ id, children }: { id: string; children: (args: { dragHandleProps: React.HTMLAttributes<HTMLButtonElement>; dragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ dragHandleProps: { ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>, dragging: isDragging })}
    </div>
  );
}

export function SortableQuestionList({
  questions,
  onReorder,
  onChangeField,
  onChangeKind,
  onDelete,
  onDuplicate,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onMoveOption,
}: {
  questions: SurveyQuestion[];
  onReorder: (orderedIds: string[]) => void;
  onChangeField: (id: string, patch: Partial<Pick<SurveyQuestion, "prompt_en" | "prompt_te" | "required">>) => void;
  onChangeKind: (id: string, kind: QuestionKind) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddOption: (id: string) => void;
  onUpdateOption: (questionId: string, optionId: string, patch: { label_en?: string; label_te?: string }) => void;
  onDeleteOption: (questionId: string, optionId: string) => void;
  onMoveOption: (questionId: string, optionId: string, dir: -1 | 1) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = questions.map((q) => q.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, String(active.id));
    onReorder(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {questions.map((q, i) => (
              <motion.div key={q.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                <SortableItem id={q.id}>
                  {({ dragHandleProps, dragging }) => (
                    <QuestionEditorCard
                      question={q}
                      index={i}
                      dragHandleProps={dragHandleProps}
                      dragging={dragging}
                      onChangeField={(patch) => onChangeField(q.id, patch)}
                      onChangeKind={(kind) => onChangeKind(q.id, kind)}
                      onDelete={() => onDelete(q.id)}
                      onDuplicate={() => onDuplicate(q.id)}
                      onAddOption={() => onAddOption(q.id)}
                      onUpdateOption={(optionId, patch) => onUpdateOption(q.id, optionId, patch)}
                      onDeleteOption={(optionId) => onDeleteOption(q.id, optionId)}
                      onMoveOption={(optionId, dir) => onMoveOption(q.id, optionId, dir)}
                    />
                  )}
                </SortableItem>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}
