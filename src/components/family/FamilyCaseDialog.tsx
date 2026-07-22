import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Loader2,
  Plus,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CaseSlipSheet } from "@/components/family/CaseSlipSheet";
import { renderBilingual, useLangMode, useT } from "@/lib/i18n";
import { downloadQrPng, printSheetOnly } from "@/lib/share";
import { listSurveys } from "@/lib/surveys";
import {
  RELATIONSHIPS,
  caseQrFileName,
  createFamilyCase,
  familyLinkUrl,
  formatPhone,
  isValidPhone,
  type FamilyCase,
  type FamilyCaseRow,
} from "@/lib/familyCases";
import { cn } from "@/lib/utils";

/**
 * Family case intake — the officer's form, and the credentials it mints.
 *
 * The rule that governs this surface: it does NOT close on success. The officer
 * is still standing in the family's front room when the case is created, and the
 * PIN, the link and the QR are the only things they came to hand over. Burying
 * them one click deeper in a list would mean a second visit.
 */

/** Ink-on-paper QR needs a near-black module colour, not brand indigo. */
const QR_PRINT_FG = "#111111";
const QR_SCREEN_FG = "hsl(226, 64%, 24%)";

/** Field validity windows an officer actually uses. 90 is the programme default. */
const VALIDITY_DAYS = [30, 60, 90, 180] as const;

/** The option that turns the select into a question. Kept as a constant because
 *  three separate pieces of logic below key off the exact string. */
const OTHER = "Other";

const schema = z
  .object({
    deceased_name: z.string().trim().min(2, "Enter the deceased person's name"),
    family_head_name: z.string().trim().min(2, "Enter the family head's name"),
    relationship: z.string().min(1, "Choose a relationship"),
    // Never submitted under this name. When the officer picks "Other" this is
    // what gets stored as `relationship`, because "Other" is not a finding — a
    // researcher reading a relationship column needs the actual kinship.
    relationship_other: z.string().optional(),
    // The one field with a real-world format. isValidPhone() normalises +91 and a
    // leading 0 first, so an officer can type the number the way the family said it.
    phone: z.string().refine(isValidPhone, "Enter a valid 10-digit mobile number"),
    district: z.string().trim().min(2, "Enter a district"),
    village: z.string().trim().optional(),
    preferred_language: z.enum(["en", "te"]),
    survey_id: z.string().min(1, "Choose an assessment"),
    notes: z.string().trim().optional(),
    valid_days: z.number(),
  })
  // A cross-field rule, so it cannot live on the field itself. The explicit
  // `path` is what puts the message under the text input instead of stranding it
  // at the form root where nothing renders it.
  .superRefine((values, ctx) => {
    if (values.relationship !== OTHER) return;
    const written = values.relationship_other?.trim() ?? "";
    if (written.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relationship_other"],
        message: "Describe how they are related",
      });
    } else if (written.length < 2 || written.length > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relationship_other"],
        message: "Use between 2 and 40 characters",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  deceased_name: "",
  family_head_name: "",
  relationship: "",
  relationship_other: "",
  phone: "",
  district: "",
  village: "",
  // Telugu, not the console's own language. The default belongs to the family
  // being enrolled, and in the field that is overwhelmingly Telugu.
  preferred_language: "te",
  survey_id: "",
  notes: "",
  valid_days: 90,
};

/**
 * Step 1 is WHO, step 2 is WHAT. The split is not cosmetic: "Continue" validates
 * exactly this list, so a field that moves between panels must move here too or
 * the officer will be blocked by an error they cannot see.
 */
const STEP_ONE_FIELDS = [
  "deceased_name",
  "family_head_name",
  "relationship",
  "relationship_other",
  "phone",
  "district",
  "village",
] as const satisfies readonly (keyof FormValues)[];

type StepNumber = 1 | 2;

/** Labelled the way the officer thinks about the visit — who the family is, then
 *  what they are being asked to answer. */
const STEPS: { n: StepNumber; label: string }[] = [
  { n: 1, label: "Family" },
  { n: 2, label: "Assessment" },
];

export function FamilyCaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (created: FamilyCase) => void;
}) {
  const t = useT();
  const mode = useLangMode();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"form" | "created">("form");
  const [step, setStep] = useState<StepNumber>(1);
  const [created, setCreated] = useState<FamilyCase | null>(null);
  // "Create another" deliberately clears `created` to return to a blank form, so
  // the state alone cannot answer "did this sitting mint anything?". This ref can,
  // and closing has to know: see closeDialog().
  const lastCreated = useRef<FamilyCase | null>(null);

  const { data: surveys, isPending: surveysPending } = useQuery({
    queryKey: ["surveys"],
    queryFn: listSurveys,
    enabled: open,
  });

  // Only a published assessment can be answered, so an unpublished one in this
  // list would be a trap: the case would mint fine and the family would hit a
  // closed survey.
  const published = useMemo(() => (surveys ?? []).filter((s) => s.status === "published"), [surveys]);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const submitting = form.formState.isSubmitting;

  // A dialog that reopens onto the previous family's details is a data-entry
  // hazard, so a fresh open is always a fresh form.
  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setStep(1);
    setCreated(null);
    lastCreated.current = null;
    form.reset(EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Changing step unmounts the button that was pressed, so focus falls back to
   * the dialog container and a keyboard user has to tab down from the top again.
   * Hand it to the panel that just arrived instead. The ref is what keeps this
   * off a fresh open, where the dialog's own autofocus should reach the first
   * field rather than being overruled here.
   */
  const stepPanel = useRef<HTMLDivElement>(null);
  const focusPanelOnStep = useRef(false);
  useEffect(() => {
    if (!focusPanelOnStep.current) return;
    focusPanelOnStep.current = false;
    stepPanel.current?.focus();
  }, [step]);

  function goToStep(next: StepNumber) {
    focusPanelOnStep.current = true;
    setStep(next);
  }

  /**
   * Step 1 validates itself and nothing else. Running the whole schema here would
   * fail on the assessment the officer has not reached yet, so `trigger` is given
   * the step's own field list — the resolver still runs over every value, but RHF
   * only reports (and only gates on) the names it was handed.
   */
  async function goToStepTwo() {
    if (await form.trigger([...STEP_ONE_FIELDS])) goToStep(2);
  }

  /**
   * Submitting from step 2 can only fail on step-1 data if something slipped past
   * "Continue" — but that error would render on an unmounted panel, and the button
   * would read as simply dead. Send the officer back to where the problem is.
   */
  function onInvalid(errors: FieldErrors<FormValues>) {
    if (STEP_ONE_FIELDS.some((name) => errors[name])) goToStep(1);
  }

  async function onSubmit(values: FormValues) {
    try {
      const row = await createFamilyCase({
        deceased_name: values.deceased_name,
        family_head_name: values.family_head_name,
        // "Other" is a routing answer, not data. What reaches the column is the
        // kinship the officer typed; the schema has already guaranteed it exists.
        relationship:
          values.relationship === OTHER ? (values.relationship_other ?? "").trim() : values.relationship,
        phone: values.phone,
        district: values.district,
        village: values.village || undefined,
        preferred_language: values.preferred_language,
        survey_id: values.survey_id,
        notes: values.notes || undefined,
        valid_days: values.valid_days,
      });
      lastCreated.current = row;
      setCreated(row);
      setPhase("created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("somethingWrongTitle"));
    }
  }

  /** An officer works a village at a time — locality, assessment and language
   *  carry over; everything that identifies a person does not. */
  function createAnother() {
    const keep = form.getValues();
    setCreated(null);
    setPhase("form");
    setStep(1);
    form.reset({
      ...EMPTY,
      district: keep.district,
      survey_id: keep.survey_id,
      preferred_language: keep.preferred_language,
      valid_days: keep.valid_days,
    });
  }

  /**
   * The single exit. Every way out of this dialog — the primary button, Cancel,
   * the X, Escape, the overlay — goes through here.
   *
   * It reports the last case minted rather than only the one currently on screen.
   * An officer who created a case, pressed "Create another", then thought better
   * of it and cancelled would otherwise leave with the list never told anything
   * happened: the case exists in the database and is invisible until a reload.
   */
  function closeDialog() {
    const last = created ?? lastCreated.current;
    if (last) onCreated(last);
    onOpenChange(false);
  }

  const selectedSurvey = published.find((s) => s.id === form.watch("survey_id"));
  const relationship = form.watch("relationship");

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto thin-scrollbar">
        {phase === "created" && created ? (
          <CreatedPanel
            created={created}
            surveyTitleEn={selectedSurvey?.title_en ?? "—"}
            surveyTitleTe={selectedSurvey?.title_te ?? null}
            onCreateAnother={createAnother}
            onDone={closeDialog}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("caseCreateTitle")}</DialogTitle>
              <DialogDescription>{t("caseCreateIntro")}</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                onKeyDown={(e) => {
                  // Enter in a step-1 text field would otherwise reach the form and
                  // fire a submit for a case whose assessment has not been chosen.
                  // Only inputs are intercepted — Enter on a select trigger belongs
                  // to Radix, and there is no textarea on this step. isComposing is
                  // the Telugu case: that Enter is committing an IME candidate, and
                  // swallowing it would advance the step mid-word.
                  if (
                    step === 1 &&
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    e.target instanceof HTMLInputElement
                  ) {
                    e.preventDefault();
                    void goToStepTwo();
                  }
                }}
                className="space-y-5"
              >
                <StepRail step={step} onGoBack={() => goToStep(1)} disabled={submitting} />

                {/* Keyed on the step so each panel animates in on its own. RHF keeps
                    the unmounted panel's values (shouldUnregister stays false), so
                    stepping back and forth is lossless. tabIndex is not for tabbing —
                    it only makes the panel a legal target for the focus handover above. */}
                <motion.div
                  key={step}
                  ref={stepPanel}
                  tabIndex={-1}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: step === 1 ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5 outline-none"
                >
                  {step === 1 ? (
                    <>
                      {/* The reference ID is issued by the database. Showing it as a
                          disabled field stops an officer hunting for where to type it. */}
                      <div className="flex items-center justify-between gap-3 rounded-field border border-dashed border-border bg-sunken px-4 py-2.5">
                        <span className="eyebrow">{t("referenceId")}</span>
                        <span className="t-caption text-tertiary">Auto-generated on save</span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="deceased_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("caseDeceased")}</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="off" placeholder="Full name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="family_head_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("caseFamilyHead")}</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="off" placeholder="Full name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Select and its follow-up share one grid cell so the reveal
                            grows under the control it belongs to, instead of shunting
                            the rest of the grid sideways. */}
                        <div className="space-y-3">
                          <FormField
                            control={form.control}
                            name="relationship"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("caseRelationship")}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={(next) => {
                                    field.onChange(next);
                                    // Leaving "Other" must not strand the text the
                                    // officer typed there — it would be invisible and
                                    // still submittable if they came back.
                                    if (next !== OTHER) {
                                      form.setValue("relationship_other", "", { shouldValidate: false });
                                      form.clearErrors("relationship_other");
                                    }
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Relationship to the deceased" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {RELATIONSHIPS.map((r) => (
                                      <SelectItem key={r} value={r}>
                                        {r}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <AnimatePresence initial={false}>
                            {relationship === OTHER && (
                              <motion.div
                                key="relationship-other"
                                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                className="overflow-hidden"
                              >
                                <FormField
                                  control={form.control}
                                  name="relationship_other"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>How are they related?</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          value={field.value ?? ""}
                                          autoComplete="off"
                                          maxLength={40}
                                          placeholder="Daughter-in-law, nephew, neighbour…"
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        This is stored as the relationship — "Other" never is.
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("casePhone")}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="tel"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  maxLength={16}
                                  placeholder="98765 43210"
                                />
                              </FormControl>
                              <FormDescription>
                                This number is the family's username at sign in.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="district"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("caseDistrict")}</FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="off" placeholder="District" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="village"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("caseVillage")}{" "}
                                <span className="t-caption font-normal text-tertiary">({t("optional")})</span>
                              </FormLabel>
                              <FormControl>
                                <Input {...field} autoComplete="off" placeholder="Village or mandal" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/*
                        Said on step ONE, not step two.

                        Splitting the form moved the "nothing to assign" notice
                        behind Continue, so an officer standing in a family's
                        front room could fill six fields before finding out the
                        case cannot be created at all. The blocking condition
                        belongs at the first point it is known, not at the first
                        point the old single-page layout happened to show it.
                      */}
                      {!surveysPending && published.length === 0 && (
                        <div className="flex flex-wrap items-center gap-3 rounded-field border border-border bg-sunken px-4 py-3">
                          <AlertCircle className="h-[18px] w-[18px] shrink-0 text-tertiary" strokeWidth={1.7} />
                          <p className="min-w-0 flex-1 t-caption text-muted-foreground">
                            No published assessment to assign yet. Publish one first — a family cannot answer a draft.
                          </p>
                          <Button asChild variant="outline" size="sm">
                            <Link to="/app/surveys">Go to Surveys</Link>
                          </Button>
                        </div>
                      )}

                      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                          {t("cancel")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void goToStepTwo()}
                          disabled={!surveysPending && published.length === 0}
                        >
                          {t("continue")}
                          <ArrowRight strokeWidth={1.7} />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="survey_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("caseSurvey")}</FormLabel>
                            {surveysPending ? (
                              <div className="h-12 animate-pulse rounded-field bg-sunken lg:h-11" />
                            ) : published.length === 0 ? (
                              <div className="flex flex-wrap items-center gap-3 rounded-field border border-border bg-sunken px-4 py-3">
                                <AlertCircle className="h-[18px] w-[18px] shrink-0 text-tertiary" strokeWidth={1.7} />
                                <p className="min-w-0 flex-1 t-caption text-muted-foreground">
                                  No published assessment to assign yet. Publish one first — a family cannot answer a draft.
                                </p>
                                <Button asChild variant="outline" size="sm">
                                  <Link to="/app/surveys">Go to Surveys</Link>
                                </Button>
                              </div>
                            ) : (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a published assessment" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {published.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {renderBilingual(mode, s.title_en, s.title_te).primary}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="preferred_language"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("caseLanguage")}</FormLabel>
                            <FormControl>
                              <LanguageSegment value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormDescription>
                              The assessment opens in this language. The family can still switch it.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="valid_days"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("caseValidity")}</FormLabel>
                            <FormControl>
                              <div className="flex flex-wrap gap-2">
                                {VALIDITY_DAYS.map((d) => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => field.onChange(d)}
                                    aria-pressed={field.value === d}
                                    className={cn(
                                      "h-11 rounded-pill border px-4 t-caption font-semibold transition-colors duration-fast",
                                      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)]",
                                      field.value === d
                                        ? "border-primary bg-primary-tint text-primary"
                                        : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
                                    )}
                                  >
                                    {t("caseNDays", { n: d })}
                                  </button>
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("caseNotes")}{" "}
                              <span className="t-caption font-normal text-tertiary">({t("optional")})</span>
                            </FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={3} placeholder="Anything the research team should know before contacting this family." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <Button type="button" variant="ghost" onClick={() => goToStep(1)} disabled={submitting}>
                          <ArrowLeft strokeWidth={1.7} />
                          {t("back")}
                        </Button>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                          <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                            {t("cancel")}
                          </Button>
                          <Button type="submit" disabled={submitting || published.length === 0}>
                            {submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck strokeWidth={1.7} />}
                            {t("caseCreateAction")}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The step indicator, which is also the only backwards navigation.
 *
 * A completed step is a button; the current step and any step ahead are inert
 * text. That asymmetry is the point — clicking forward would skip the validation
 * that "Continue" exists to run, so there is deliberately nothing to click.
 */
function StepRail({
  step,
  onGoBack,
  disabled,
}: {
  step: StepNumber;
  onGoBack: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {STEPS.map((s, i) => {
        const current = s.n === step;
        const done = s.n < step;

        const badge = (
          <span
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center rounded-pill border t-caption font-semibold tabular-nums",
              current
                ? "border-primary bg-primary-tint text-primary"
                : done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-sunken text-tertiary",
            )}
          >
            {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : s.n}
          </span>
        );

        return (
          <Fragment key={s.n}>
            {i > 0 && <span aria-hidden className="h-px flex-1 bg-border" />}
            {done ? (
              <button
                type="button"
                onClick={onGoBack}
                // In flight, the rail is the one remaining way to yank the form
                // out from under a submit that is already running.
                disabled={disabled}
                className={cn(
                  "inline-flex items-center gap-2 rounded-pill px-2.5 py-1.5 t-caption font-semibold text-foreground",
                  "transition-colors duration-fast hover:bg-sunken disabled:pointer-events-none disabled:opacity-50",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)]",
                )}
              >
                {badge}
                {s.label}
              </button>
            ) : (
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 px-2.5 py-1.5 t-caption font-semibold",
                  current ? "text-foreground" : "text-tertiary",
                )}
              >
                {badge}
                {s.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** The handover screen. Everything the family needs, on one surface, once. */
function CreatedPanel({
  created,
  surveyTitleEn,
  surveyTitleTe,
  onCreateAnother,
  onDone,
}: {
  created: FamilyCase;
  surveyTitleEn: string;
  surveyTitleTe: string | null;
  onCreateAnother: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const url = familyLinkUrl(created.access_token);

  // CaseSlipSheet renders into the print portal, so the printable slip needs the
  // row shape the list uses. Nothing has been submitted yet, hence the nulls.
  const caseRow: FamilyCaseRow = {
    ...created,
    survey_title_en: surveyTitleEn,
    survey_title_te: surveyTitleTe,
    completion_pct: null,
    submitted_at: null,
  };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("somethingWrongTitle"));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("caseCreated")}</DialogTitle>
        <DialogDescription>
          Hand these to the family before you leave. The PIN is shown here only — after this it lives in the case inspector.
        </DialogDescription>
      </DialogHeader>

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-3 rounded-field bg-sunken px-4 py-3">
          <span className="eyebrow">{t("referenceId")}</span>
          <span className="font-mono text-sm font-semibold tabular-nums tracking-wide">{created.reference_id}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="grid place-items-center rounded-surface border border-border bg-white p-3 shadow-sm">
              <QRCodeSVG value={url} size={144} level="M" bgColor="transparent" fgColor={QR_SCREEN_FG} />
            </div>
            <span className="t-caption text-tertiary">{t("caseQrCode")}</span>
            {/* Print-resolution copy, off-screen, purely as the PNG source. */}
            <div ref={qrRef} className="sr-only" aria-hidden>
              <QRCodeCanvas value={url} size={1024} level="M" marginSize={2} bgColor="#FFFFFF" fgColor={QR_PRINT_FG} />
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <div className="eyebrow">{t("casePhone")}</div>
              <div className="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-[0.14em] text-foreground">
                {formatPhone(created.phone)}
              </div>
              <p className="mt-1 t-caption text-muted-foreground">
                The family opens the link, then types this number. There is no PIN.
              </p>
            </div>

            <div className="min-w-0">
              <div className="eyebrow">{t("caseSecureLink")}</div>
              <div className="mt-1 break-all rounded-field border border-border/60 bg-muted/60 px-3 py-2 font-mono text-xs">
                {url}
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void copyLink()}>
                {copied ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.8} />}
                {copied ? t("copied") : t("copyLink")}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={printSheetOnly}>
            <Printer strokeWidth={1.7} />
            {t("casePrintSlip")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!downloadQrPng(qrRef.current, caseQrFileName(created.reference_id, created.family_head_name))) {
                toast.error(t("somethingWrongTitle"));
              }
            }}
          >
            <Download strokeWidth={1.7} />
            {t("caseDownloadQr")}
          </Button>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCreateAnother}>
            <Plus strokeWidth={1.7} />
            Create another
          </Button>
          <Button type="button" onClick={onDone}>
            <ArrowLeft strokeWidth={1.7} />
            Back to cases
          </Button>
        </div>
      </motion.div>

      <CaseSlipSheet caseRow={caseRow} />
    </>
  );
}

/** Two options, one control — a Select for a binary choice hides half of it. */
function LanguageSegment({ value, onChange }: { value: "en" | "te"; onChange: (v: "en" | "te") => void }) {
  const options: { value: "en" | "te"; label: string }[] = [
    { value: "te", label: "తెలుగు" },
    { value: "en", label: "English" },
  ];
  return (
    <div role="group" className="inline-flex rounded-pill border border-border bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "h-10 rounded-pill px-5 t-caption font-semibold transition-colors duration-fast",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)]",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
