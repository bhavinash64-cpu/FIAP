import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { TextAnswerList } from "@/components/analytics/TextAnswerList";
import { getQuestionBreakdown, averageScore, type ValueCount } from "@/lib/analytics";
import type { SurveyQuestion } from "@/lib/surveys";

const BAR_COLOR = "hsl(226 64% 24%)";
const SCALE_COLORS = ["hsl(4 68% 58%)", "hsl(38 88% 55%)", "hsl(220 14% 65%)", "hsl(152 55% 45%)", "hsl(226 64% 34%)"];

export function QuestionBreakdownCard({ question, since }: { question: SurveyQuestion; since?: Date }) {
  const [counts, setCounts] = useState<ValueCount[] | null>(null);
  const isText = question.kind === "short_text" || question.kind === "long_text";
  const isScale = question.kind === "likert5" || question.kind === "rating5";

  useEffect(() => {
    if (isText) return;
    setCounts(null);
    getQuestionBreakdown(question, since).then(setCounts);
  }, [question, since, isText]);

  const total = counts?.reduce((a, c) => a + c.count, 0) ?? 0;
  const avg = counts ? averageScore(counts) : null;

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent grid place-items-center shrink-0 mt-0.5">
            <QuestionTypeIcon kind={question.kind} className="h-4 w-4 text-primary" />
          </div>
          <span className="leading-snug">{question.prompt_en}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isText ? (
          <TextAnswerList questionId={question.id} />
        ) : counts === null ? (
          <div className="py-10 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : total === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No answers yet.</div>
        ) : isScale ? (
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{avg?.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">average of 5 · {total} answer{total === 1 ? "" : "s"}</span>
            </div>
            <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
              {counts.map((c, i) => (
                <div key={c.value} style={{ width: `${c.pct * 100}%`, backgroundColor: SCALE_COLORS[i % SCALE_COLORS.length] }} title={`${c.label}: ${c.count}`} />
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-[11px] text-muted-foreground">
              {counts.map((c, i) => (
                <div key={c.value} className="text-center">
                  <div className="h-2 w-2 rounded-full mx-auto mb-1" style={{ backgroundColor: SCALE_COLORS[i % SCALE_COLORS.length] }} />
                  {Math.round(c.pct * 100)}%
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ height: Math.max(120, counts.length * 44) }}>
            <ResponsiveContainer>
              <BarChart data={counts} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number, _n, p) => [`${v} (${Math.round((p.payload as ValueCount).pct * 100)}%)`, "Responses"]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                  {counts.map((c) => <Cell key={c.value} fill={BAR_COLOR} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
      {!isText && total > 0 && (
        <div className="px-6 pb-4 -mt-2">
          <Badge variant="secondary" className="text-[10px]">{total} response{total === 1 ? "" : "s"}</Badge>
        </div>
      )}
    </Card>
  );
}
