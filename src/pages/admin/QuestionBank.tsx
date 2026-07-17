import { useState } from "react";
import { motion } from "framer-motion";
import { Layers, ListChecks, Quote } from "lucide-react";
import { INSTRUMENTS, type Instrument } from "@/lib/instruments";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { staggerParent, staggerChild, easeOut } from "@/lib/motion";

export default function QuestionBank() {
  const [activeKey, setActiveKey] = useState(INSTRUMENTS[0]?.key);
  const active = INSTRUMENTS.find((i) => i.key === activeKey) ?? INSTRUMENTS[0];
  const total = INSTRUMENTS.reduce((n, i) => n + i.items.length, 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8">
      <header>
        <div className="eyebrow">Library</div>
        <h1 className="t-title mt-2">Question Bank</h1>
        <p className="t-body mt-3 max-w-xl text-muted-foreground">
          {total} validated questions across {INSTRUMENTS.length} research instruments — each reproduced from its source with the exact response scale. Add any of these to a survey from the builder.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Instrument list */}
        <Card className="overflow-hidden lg:sticky lg:top-6 lg:self-start">
          <motion.div variants={staggerParent} initial="hidden" animate="show" className="thin-scrollbar max-h-[70vh] divide-y divide-border overflow-y-auto">
            {INSTRUMENTS.map((inst) => (
              <motion.button
                key={inst.key}
                variants={staggerChild}
                onClick={() => setActiveKey(inst.key)}
                className={cn(
                  "flex w-full items-start gap-3 px-6 py-4 text-left transition-colors duration-base ease-out active:scale-[0.99]",
                  inst.key === active?.key ? "bg-primary-tint" : "hover:bg-sunken",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-control transition-colors duration-base ease-out",
                    inst.key === active?.key ? "bg-primary text-primary-foreground" : "bg-sunken text-muted-foreground",
                  )}
                >
                  <Layers className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-card block truncate">{inst.name}</span>
                  <span className="t-caption mt-1 block truncate text-muted-foreground">{inst.blurb}</span>
                </span>
                <Badge variant="secondary" className="mt-1 shrink-0 tabular-nums">{inst.items.length}</Badge>
              </motion.button>
            ))}
          </motion.div>
        </Card>

        {/* Detail */}
        {active && <InstrumentDetail key={active.key} inst={active} />}
      </div>
    </div>
  );
}

function InstrumentDetail({ inst }: { inst: Instrument }) {
  const sharedScale = inst.defaultScale;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: easeOut }}
    >
      <Card className="p-6 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="t-section">{inst.name}</h2>
            {inst.nameTe && <div className="t-body mt-1 text-muted-foreground">{inst.nameTe}</div>}
          </div>
          <Badge variant="secondary" className="shrink-0 tabular-nums">{inst.items.length} items</Badge>
        </div>
        <p className="t-body mt-4 text-muted-foreground">{inst.blurb}</p>
        <div className="mt-2 flex items-center gap-2 t-caption text-muted-foreground">
          <Quote className="h-3.5 w-3.5" strokeWidth={1.5} /> {inst.source}
        </div>

        {sharedScale && (
          <div className="mt-6 rounded-field border border-border bg-sunken p-4">
            <div className="eyebrow mb-2 flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5" strokeWidth={1.5} /> Response scale
            </div>
            <div className="flex flex-wrap gap-2">
              {sharedScale.map((p, i) => (
                <span key={i} className="t-caption rounded-control border border-border bg-card px-3 py-1 text-muted-foreground">
                  {p.en}
                </span>
              ))}
            </div>
          </div>
        )}

        <motion.ol variants={staggerParent} initial="hidden" animate="show" className="mt-6 divide-y divide-border">
          {inst.items.map((item, i) => (
            <motion.li key={i} variants={staggerChild} className="flex gap-3 py-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-sunken t-caption tabular-nums text-tertiary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="t-card">{item.en}</div>
                {item.te && <div className="t-caption mt-1 text-muted-foreground">{item.te}</div>}
                {item.scale && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.scale.map((p, j) => (
                      <span key={j} className="t-caption rounded-control bg-sunken px-3 py-1 text-muted-foreground">
                        {p.en}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.li>
          ))}
        </motion.ol>
      </Card>
    </motion.section>
  );
}
