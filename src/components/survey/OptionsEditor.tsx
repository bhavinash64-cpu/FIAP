import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SurveyOption } from "@/lib/surveys";

export function OptionsEditor({
  options,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: {
  options: SurveyOption[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Pick<SurveyOption, "label_en" | "label_te">>) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      {options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <div className="flex flex-col shrink-0">
            <button type="button" disabled={i === 0} onClick={() => onMove(o.id, -1)} className="h-4 text-muted-foreground disabled:opacity-25 hover:text-foreground">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={i === options.length - 1} onClick={() => onMove(o.id, 1)} className="h-4 text-muted-foreground disabled:opacity-25 hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <Input
            value={o.label_en}
            onChange={(e) => onUpdate(o.id, { label_en: e.target.value })}
            placeholder="Option (English)"
            className="h-9 rounded-lg text-sm"
          />
          <Input
            value={o.label_te ?? ""}
            onChange={(e) => onUpdate(o.id, { label_te: e.target.value })}
            placeholder="తెలుగు"
            className="h-9 rounded-lg text-sm"
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => onDelete(o.id)} disabled={options.length <= 2} className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={onAdd} className="rounded-lg h-8 text-xs">
        <Plus className="h-3.5 w-3.5 mr-1" /> Add option
      </Button>
    </div>
  );
}
