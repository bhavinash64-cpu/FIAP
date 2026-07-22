# PSYDIGIHEALTH — RESPONDENT EXPERIENCE
## LOCKED SPECIFICATION v1.0 · build this verbatim

Status: **LOCKED.** Every number here is a decision, not a suggestion. Where a value is absent from
this document, take the nearest existing token in `src/index.css`. No component may introduce a hex,
a raw px shadow, a raw easing, or a raw duration. Everything is a token.

Audience of record: a 62-year-old widow, right hand, 5-inch phone (320–390 CSS px), bright daylight,
reading Telugu, using **Listen**. Every metric below was chosen against that viewport budget.

**The organising sentence:** *one breath per screen — the question is the only dark thing on it, the
answers sit where the thumb already is, and the chrome talks about the person, never about the form.*

---

# AMENDMENT v1.1 — THE 20-QUESTION CAP

v1.0 was written against a 154-item single sitting. **That premise was wrong.** Published surveys are
capped at **20 questions**, enforced in the database by a trigger in
`supabase/migrations/20260718113000_submission_integrity_and_survey_limits.sql`:

> `'Published surveys are limited to 20 questions; split this survey into reviewed modules.'`

`MAX_ANSWER_COUNT = 20` in `supabase/functions/submit-response/index.ts` is the matching submission
guard, not a bug. This is a research-governance control that sits alongside
`docs/PsyDigiHealth_PII_Information_Security_and_Research_Ethics_Framework.docx`. **Do not raise either limit.**
The 8 instruments are split into separate reviewed modules, each its own survey. A family may complete
several modules over time; never 154 items in one run.

A ~20-question run is roughly **3–5 minutes**. That invalidates every endurance argument in v1.0. The
following sections are **overridden**; everything else stands.

| § | v1.0 said | v1.1 says |
|---|---|---|
| Audience line | "154 items in one sitting" | ≤20 items per module, 3–5 minutes |
| **C.1** progress | a `≥ 30 questions` branch showing `Question 47 of 154` | that branch is dead — delete it. Always the explicit `Question i of n`; at n≤20 the counter is never noisy |
| **G.6** encouragement | 5 moments: after Q5, 25%, 50%, 75%, 3-from-end | **at most 2**: one at the midpoint, one 2 questions from the end. Five messages across 20 screens is one every four — precisely the tiring, childish failure the brief warns against |
| **G.4** section transition | assumed on a long multi-instrument run | keep the component, but suppress it when the survey has <8 questions or the section has <3. A 20-item module usually has no sections at all, and an interstitial before 4 questions is an interruption, not a reset |
| **F** row 36 | review-row stagger capped at 12 (a 154-row stagger runs 3.7s) | cap is now academic at ≤20 rows; keep it, no virtualisation needed anywhere |
| **G.8** review | completion ring reading `134 of 154` | ring reads `n of ≤20`; the whole answer list fits without collapsing, so `reviewAllAnswers` may default to expanded |
| B.4, B.5, D.9.1 | rationale quantified as "×154 screens" | the reasoning holds; the magnitude is ×20. Do not re-tune the metrics — they were chosen for the 320px viewport, not for run length |

**Status of §0 P0 defects:** 0.1 (Telugu webfont) and 0.2 (`viewport-fit=cover`) are **FIXED** in
`index.html`. 0.3 (no `user-scalable=no`) is honoured. 0.4 (`documentElement.lang` before paint)
is **still open** — `useDocLang()` in `src/lib/i18n.ts` sets it in a React effect, i.e. after paint.

---

# 0. P0 DEFECTS — FIX BEFORE ANY OTHER WORK

Both are verified against the repository. Neither is optional; both silently break the primary user.

### 0.1 Telugu has no webfont
`index.html` loads only Inter + Fraunces. `src/index.css` names `"Noto Sans Telugu"` in three font
stacks and it is never fetched. Every Telugu prompt currently renders in whatever the device has
(Kohinoor on iOS, Noto on new Android, Nirmala UI on Windows, tofu on cheap devices). Fix:

```html
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=Noto+Sans+Telugu:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&display=swap" />
```
One request, existing preconnects, full subset (no `&text=`).

### 0.2 `viewport-fit=cover` is missing
`env(safe-area-inset-bottom)` therefore resolves to `0px` on every iPhone, which makes
`.bottom-nav-safe` and `.pb-bottom-nav` no-ops and puts the sticky action bar under the home
indicator. Fix:

```html
<meta name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
```

### 0.3 Deliberate override of the brief
The brief says "no pinch zoom". **Do NOT add `user-scalable=no` or `maximum-scale=1`.** That is a
WCAG 1.4.4 failure and is hostile to this exact audience. The intent is honoured properly: no
horizontal overflow anywhere, `touch-action: manipulation` on every tap target (kills the 300ms
double-tap-zoom), and **every text input ≥ 18px** — sub-16px input text is the actual cause of iOS
auto-zoom-on-focus, and this spec has none.

### 0.4 `document.documentElement.lang` must be set
The i18n store must write `lang="en" | "te"` and the class `lang-te` onto `<html>`, outside React,
the same way `pref-large-text` is applied — otherwise the `:lang(te)` typography in §A never fires on
the public route, and it must apply before first paint.

---

# A. DESIGN TOKENS

## A.1 `src/index.css` — add inside the existing `@layer base { :root { … } }`

```css
    /* ── Respondent-flow radius ────────────────────────────────────────── */
    --radius-answer: 20px;    /* every answer surface on the respondent flow */
    --radius-sheet:  28px;    /* bottom sheets (support, dropdown picker)    */

    /* ── Respondent-flow chrome heights ────────────────────────────────── */
    --rail-h:      56px;      /* 52 <375px · 64 ≥1024px — see §B.3          */
    --rail-bar-h:   3px;
    --action-h:    72px;      /* 68 <375px · 80 ≥1024px — excludes safe area */
    --answer-min:  56px;      /* absolute floor for an answer card           */
    --col-question: 760px;
    --col-reading:  640px;

    /* ── Motion ─────────────────────────────────────────────────────────── */
    --ease-emph:  cubic-bezier(0.22, 1, 0.36, 1);   /* anything that ARRIVES */
    --dur-tap:     90ms;      /* press down                                  */
    --dur-ack:    180ms;      /* selection acknowledgement                   */
    --dur-enter:  260ms;      /* a screen or block arriving                  */
    --dur-scene:  520ms;      /* section interstitial staging                */
    --dur-atmo:   900ms;      /* ambient hue cross-fade                      */

    /* ── Category atmosphere (defaults = neutral) ───────────────────────── */
    --atmo-h:   246;
    --atmo-s:    22%;
    --atmo-l:    62%;         /* PINNED per theme — see the rule below       */
    --atmo-ink-l: 34%;
    --wash-a-top: 0.10;
    --wash-a-bot: 0.05;

    /* ── Soft keyboard offset, written from VisualViewport (§D.7) ───────── */
    --kb: 0px;

    /* ── Prompt scale, written per question from prompt length (§B.6) ───── */
    --q-scale: 1;
```

```css
  /* inside the existing .dark { } block */
    --atmo-l:     68%;
    --atmo-ink-l: 80%;
    --wash-a-top: 0.14;
    --wash-a-bot: 0.07;
```

**The contrast rule that makes atmosphere safe:** only `--atmo-h` and `--atmo-s` ever change per
category. `--atmo-l` and both wash alphas are pinned per theme. Luminance behind text is therefore
mathematically identical across all nine atmospheres and cannot degrade legibility. A 10% overlay of
an L62% hue on `#F6F5F1` lands between `#F0EDE9` and `#F3EFEC`; `#1C1C1E` on the darkest of those is
**15.8:1**.

## A.2 Category atmosphere classes

Add at the end of `src/index.css`, outside `@layer` (they set variables only):

```css
/* Eight weathers, never eight verdicts. Only H and S vary; see A.1. */
.atmo-neutral    { --atmo-h: 246; --atmo-s: 22%; }
.atmo-family     { --atmo-h:  24; --atmo-s: 46%; }   /* warm terracotta  */
.atmo-empathy    { --atmo-h: 344; --atmo-s: 38%; }   /* dusty rose       */
.atmo-hope       { --atmo-h:  42; --atmo-s: 54%; }   /* low sun / amber  */
.atmo-wellbeing  { --atmo-h: 158; --atmo-s: 32%; }   /* eucalyptus       */
.atmo-depression { --atmo-h: 218; --atmo-s: 34%; }   /* slate blue       */
.atmo-stress     { --atmo-h: 268; --atmo-s: 26%; }   /* muted violet     */
.atmo-anger      { --atmo-h:   8; --atmo-s: 34%; }   /* clay, NOT signal */
.atmo-internet   { --atmo-h: 196; --atmo-s: 30%; }   /* cool steel       */

/* Resolved colours every component reads instead of composing HSL inline. */
:root, .atmo-neutral, [class*="atmo-"] {
  --atmo:     hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l));
  --atmo-ink: hsl(var(--atmo-h) var(--atmo-s) var(--atmo-ink-l));
}
```

Resolved dark-mode values are the same H/S at `L 68%` / ink `L 80%`. `anger` is `hsl(8 34% 62%)`,
never `--danger` (`4 50% 47%`) — a respondent must never see their own anger reported back as an
error state. `--danger` **must not appear anywhere on the respondent flow.**

## A.3 The ambient wash

```css
.atmo-wash {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(120% 78% at 50% -12%,
      hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l) / var(--wash-a-top)) 0%, transparent 62%),
    radial-gradient(90% 60% at 12% 106%,
      hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l) / var(--wash-a-bot)) 0%, transparent 70%);
  transition: background var(--dur-atmo) var(--ease-out);
}
.atmo-wash[data-scene="section"] { --wash-a-top: 0.20; --wash-a-bot: 0.09; }

html.pref-high-contrast .atmo-wash { --wash-a-top: 0.05; --wash-a-bot: 0.02; }
@media (prefers-contrast: more) { .atmo-wash { --wash-a-top: 0; --wash-a-bot: 0; } }
@media (prefers-reduced-motion: reduce) { .atmo-wash { transition: none; } }
```

Rendered **once**, by `AssessmentShell`, at `z-0`. Nothing else in the product paints an atmosphere.
Top-anchored and fully faded by 62% of viewport height, so it is never behind an answer card.

## A.4 New type classes

Replace the single `.t-question` with a length-responsive family. Add inside `@layer components`:

```css
  /* The prompt. Weight stays 500, not 600: at 32px a semibold clinical question
     reads as a demand, and this screen must read as someone asking. The class is
     chosen from prompt_en length (§B.6), never from the rendered string — classing
     on the rendered string would resize the whole screen when Telugu is toggled. */
  .t-question-hero { font-size: calc(clamp(1.75rem, 1.30rem + 2.2vw, 2.5rem)  * var(--q-scale,1)); line-height: 1.14; letter-spacing: -0.025em; font-weight: 600; text-wrap: balance; }
  .t-question-xl   { font-size: calc(clamp(1.50rem, 1.10rem + 2.1vw, 2.125rem)* var(--q-scale,1)); line-height: 1.24; letter-spacing: -0.022em; font-weight: 500; text-wrap: balance; }
  .t-question      { font-size: calc(clamp(1.3125rem,1.05rem + 1.6vw, 1.8125rem)*var(--q-scale,1)); line-height: 1.30; letter-spacing: -0.018em; font-weight: 500; text-wrap: pretty; }
  .t-question-sm   { font-size: calc(clamp(1.1875rem,1.00rem + 1.0vw, 1.5625rem)*var(--q-scale,1)); line-height: 1.38; letter-spacing: -0.012em; font-weight: 500; text-wrap: pretty; }
  .t-question-xs   { font-size: calc(clamp(1.125rem, 0.98rem + 0.6vw, 1.375rem)* var(--q-scale,1)); line-height: 1.45; letter-spacing: -0.006em; font-weight: 500; text-wrap: pretty; }

  /* Every prompt class reserves three lines, so the answer stack never jumps
     between a 7-char BDI header and a 128-char IRI item. */
  .t-question-hero, .t-question-xl, .t-question,
  .t-question-sm, .t-question-xs { max-inline-size: 41ch; min-block-size: calc(3 * 1lh); }

  /* The stem — the 13px line above the prompt that turns a clinical STATEMENT
     into a question someone asked. See §D.0.2. */
  .t-stem { font-size: 13px; line-height: 1.40; font-weight: 500;
            color: hsl(var(--text-secondary)); letter-spacing: 0.002em; }

  /* Rail numerals. Never bold — the question is the only prominent text. */
  .t-rail-count { font-size: 13px; line-height: 1.35; font-weight: 600;
                  font-variant-numeric: tabular-nums; color: hsl(var(--text-primary)); }
  .t-rail-meta  { font-size: 12px; line-height: 1.35; font-weight: 500;
                  font-variant-numeric: tabular-nums; color: hsl(var(--text-tertiary)); }
```

### Telugu typography

```css
html.lang-te {
  font-family: "Noto Sans Telugu", Inter, system-ui, sans-serif;
  font-feature-settings: normal;              /* Inter's cv02/ss01 mean nothing here */
}
html.lang-te .t-question-hero,
html.lang-te .t-question-xl,
html.lang-te .t-question,
html.lang-te .t-question-sm,
html.lang-te .t-question-xs {
  font-size: calc(var(--q-size, 1em) * 0.94); /* Telugu sets optically larger per px */
  line-height: 1.55;                          /* conjuncts stack above AND below      */
  letter-spacing: 0;                          /* negative tracking crushes vowel signs*/
  word-break: normal;
  overflow-wrap: break-word;                  /* NOT `anywhere` — breaks syllables    */
  hyphens: none;
}
html.lang-te .eyebrow { text-transform: none; letter-spacing: 0.04em; }
```
Implementation note: express the 0.94 factor by multiplying `--q-scale` by 0.94 in the `lang-te`
block rather than re-declaring `font-size`, so there is exactly one size expression per class.

**Never** apply the existing `.font-telugu` utility to a prompt — its `overflow-wrap: anywhere`
breaks mid-syllable-cluster. Any node whose string came from the English fallback of
`renderBilingual` must carry `lang="en"` so the font stack and leading revert for that node only.

## A.5 Component classes

```css
@layer components {
  /* ── The answer card primitive ──────────────────────────────────────── */
  .answer-card {
    position: relative; overflow: hidden;
    display: flex; align-items: center; gap: 12px;
    inline-size: 100%; min-block-size: 68px;
    padding: 14px 16px;
    border-radius: var(--radius-answer);
    border: 1.5px solid hsl(var(--border-strong));
    background: hsl(var(--bg-surface));
    box-shadow: var(--highlight-top), var(--shadow-xs);
    text-align: start; touch-action: manipulation;
    transition:
      background-color var(--dur-ack) var(--ease-out),
      border-color     var(--dur-fast) var(--ease-out),
      box-shadow       var(--dur-ack) var(--ease-out),
      transform        160ms var(--ease-out);
  }
  .answer-card[data-selected="true"] {
    border-color: hsl(var(--primary));
    background:
      linear-gradient(hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l) / 0.07) 0 100%),
      hsl(var(--bg-surface));
    box-shadow:
      var(--highlight-top),
      0 0 0 4px hsl(var(--primary) / 0.09),
      0 8px 22px -12px hsl(var(--primary) / 0.50);
  }
  .dark .answer-card[data-selected="true"] {
    background:
      linear-gradient(hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l) / 0.12) 0 100%),
      hsl(var(--bg-surface));
  }
  .answer-card:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px hsl(var(--bg-canvas)), 0 0 0 5px hsl(var(--focus-ring) / 0.45);
  }
  @media (hover: hover) and (pointer: fine) {
    .answer-card:not([data-selected="true"]):hover {
      transform: translateY(-2px);
      border-color: hsl(var(--primary) / 0.35);
      box-shadow: var(--highlight-top), var(--shadow-md);
    }
  }

  /* The ink wipe: the tint arrives FROM the tap point rather than cross-fading.
     This is the brief's "tiny ripple", implemented as the fill itself. */
  .answer-card::before {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l) / 0.07) 0 100%);
    clip-path: circle(0% at var(--tap-x, 50%) var(--tap-y, 50%));
    transition: clip-path var(--dur-ack) var(--ease-out);
  }
  .answer-card[data-selected="true"]::before { clip-path: circle(140% at var(--tap-x,50%) var(--tap-y,50%)); }

  /* ── The scale spine (§D.0.3) ───────────────────────────────────────── */
  .spine-rail  { inline-size: 2px; border-radius: var(--radius-pill);
                 background: hsl(var(--text-primary) / 0.10); }
  .spine-fill  { inline-size: 2px; border-radius: var(--radius-pill);
                 background: hsl(var(--primary) / 0.35); transform-origin: var(--spine-origin, bottom); }
  .spine-node  { inline-size: 28px; block-size: 28px; border-radius: var(--radius-pill);
                 display: grid; place-items: center; flex: 0 0 auto;
                 background: hsl(var(--bg-surface));
                 border: 1.5px solid hsl(var(--border-strong));
                 overflow: hidden;
                 transition: border-color var(--dur-fast) var(--ease-out); }
  .spine-node[data-selected="true"] { border-color: hsl(var(--primary)); border-width: 2px; }

  /* ── The writing line (short_text) ──────────────────────────────────── */
  .answer-line { position: relative; min-block-size: 72px;
                 border-block-end: 1.5px solid hsl(var(--border-strong));
                 transition: background-color var(--dur-ack) var(--ease-out); }
  .answer-line::after {
    content: ""; position: absolute; inset-inline: 0; inset-block-end: -1.5px;
    block-size: 2px; background: hsl(var(--primary));
    transform: scaleX(0); transform-origin: left;
    transition: transform var(--dur-enter) var(--ease-emph);
  }
  .answer-line:focus-within::after { transform: scaleX(1); }
  .answer-line:focus-within {
    background: hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l) / 0.05);
    border-start-start-radius: var(--radius-answer);
    border-start-end-radius: var(--radius-answer);
  }

  /* ── Hairline list — the ONLY grouping device outside answer surfaces ── */
  .rule-list > * + * { border-block-start: 1px solid hsl(var(--text-primary) / 0.07); }
  .rule-row { display: flex; align-items: center; gap: 14px; min-block-size: 56px; }
}
```

## A.6 Keyframes

```css
@keyframes tick-draw   { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes spine-grow  { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes sheet-up    { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes pour        { from { transform: scaleY(0.001); } to { transform: scaleY(1); } }
```
All four are frozen by the existing global `prefers-reduced-motion` rule at the top of `index.css`.
No new looping keyframes are permitted on the respondent flow — nothing on this route breathes,
pulses, floats or shimmers.

## A.7 `tailwind.config.ts` — add to `theme.extend`

```ts
      borderRadius: { /* …existing… */ answer: "var(--radius-answer)", sheet: "var(--radius-sheet)" },
      maxWidth:     { question: "var(--col-question)", reading: "var(--col-reading)" },
      height:       { rail: "var(--rail-h)", action: "var(--action-h)" },
      transitionTimingFunction: { /* …existing… */ emph: "var(--ease-emph)" },
      transitionDuration: { /* …existing… */ tap: "90ms", ack: "180ms", enter: "260ms", scene: "520ms", atmo: "900ms" },
      colors: { /* …existing… */ atmo: { DEFAULT: "var(--atmo)", ink: "var(--atmo-ink)" } },
```

---

# B. LAYOUT — THE QUESTION SCREEN

## B.1 The frame

The question stage abandons `min-h-dvh` + document scroll. On iOS the URL-bar collapse re-lays-out a
sticky header mid-scroll, which is a visible jump on every one of 154 screens.

```
<div class="stage atmo-{category}">          height:100dvh; display:grid;
                                             grid-template-rows: auto minmax(0,1fr) auto;
  <header class="rail">      …               ZONE A · rail + 3px bar        (never scrolls)
  <main   class="reading">   …               ZONE B/C · the ONLY scroller
  <footer class="action-bar">…               ZONE D · Previous · Saved · Next (never scrolls)
</div>
<div class="atmo-wash" />                    fixed inset-0 z-0
<SupportButton />                            fixed z-40
```
`@supports not (height: 100dvh) { .stage { height: 100vh } }`.
`main { overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; }`
`html`/`body` never scroll on this route.

**Consequence:** `QuestionStage`'s `window.scrollTo(0, 0)` becomes `mainRef.current?.scrollTo({ top: 0 })`.

## B.2 Content order inside `main`

| # | element | note |
|---|---|---|
| 1 | Section chip | only when the survey has sections; hidden < 375px (it folds into rail line 1) |
| 2 | **Stem line** (`.t-stem`) | always present · §D.0.2 |
| 3 | Prompt `h1` | `tabIndex={-1}`, focused on mount |
| 4 | Voice row | 40px · collapsed VoiceControl |
| 5 | **Flex spacer** | `flex: 1 1 auto`, `min-height`/`max-height` per breakpoint — **all slack lives here** |
| 6 | Answer surface | bottom-anchored by the spacer above it |
| 7 | Skip line | 44px, centred, borderless · §D.9.2 |
| 8 | Bottom pad | 20 / 24 / 32px |

**The governing rule: Zone B absorbs slack, Zone C is bottom-anchored.** Answers grow *upward* from
the action bar, so the last card is always nearest the thumb and card positions barely move between
consecutive items of the same kind. Constancy below, variation above — that is what a person talking
to you looks like, and it is the single biggest ergonomic win available on a 24-item yes/no run.

## B.3 Exact metrics

| | **320px** | **390px** | **1024px** |
|---|---|---|---|
| `--rail-h` | 52 | 56 | 64 |
| progress bar | 3 | 3 | 3 |
| `--action-h` | 68 | 72 | 80 (not full-bleed) |
| outer column | 100% | 100% | **760px**, centred |
| padding-inline | 16 | 20 | 50 |
| content measure | 288 | 350 | **660** |
| chip → stem | — | 12 | 14 |
| stem → prompt | 6 | 8 | 10 |
| prompt → voice | 12 | 16 | 20 |
| spacer min / max | 16 / 40 | 24 / 64 | 32 / 96 |
| answers → skip line | 12 | 12 | 16 |
| skip line → bottom | 8 | 12 | 20 |
| main band (typical) | ~372 | ~600 | ~600 |

**Desktop (≥1024px).** Outer column 760px, 50px internal gutters, content measure 660px. Prompt,
stem, cards, Previous, Skip and Next all share one left edge — that shared edge is what makes the
screen read as one object rather than a page with a toolbar. The action bar is **not** full-bleed at
this width; it is a 760px row with a 1px top hairline. Support button sits outside the column at
`left: calc(50% + 380px + 24px)`.

**Reading stages use a narrower column.** Question stage = 760px. Welcome / consent / instructions /
section / review / thank-you = **640px**. 15px body across 760px is 105 characters per line.

## B.4 The rail (Zone A) — 56px replaces today's 104px

Today the question screen spends 64px on identity plus ~40px on the progress strip. That 104px is one
and a half answer cards on a 5-inch phone. Merge them. **The app name and org line are dropped from
the question stage only** — identity was established on welcome/consent/instructions and repeating it
154 times costs a card. They return on every other stage.

```
320px : [◧22] 8 [ two text lines, flex ] 8 [ 🔊 44 circle ] 6 [ అ/A 36 ]
≥375px: [◧22] 8 [ two text lines, flex ] 8 [ 🔊 Listen ~108 pill ] 8 [ అ/A 40 ]
        └───────────────────────────────────────────────────────────────┘
        3px full-bleed progress bar, flush to the rail's bottom edge, radius 0
```
- `background: hsl(var(--bg-canvas) / 0.92); backdrop-filter: blur(20px);` **no bottom border** — the
  3px bar is the edge. Gains `box-shadow: 0 6px 16px -12px rgba(28,28,30,.35)` (160ms) once
  `main.scrollTop > 4`.
- The 22px logo mark keeps the government identity present without a word of text.
- LangToggle collapses to a 36–40px pill showing `అ` / `A`, with the full language name as
  `aria-label`. The full-word toggle stays on every non-question stage.
- **No back chevron in the rail.** Previous is bottom-left, where a thumb reaches.

## B.5 The action bar (Zone D)

```
[ ← 48×52 ghost ] ………… [ ✓ Saved ] ………… [ Next → 52 tall, min 132 ]
```
- Padding `12px 16px`, `padding-block-end: calc(12px + env(safe-area-inset-bottom))`.
- `background: hsl(var(--bg-canvas) / 0.92); backdrop-filter: blur(20px);` + 1px top hairline at
  `hsl(var(--text-primary)/0.06)`. It must read as the canvas continuing, not as a toolbar.
- **Previous**: ghost, `--text-tertiary`, icon-only < 375px with `aria-label`. Low prominence on
  purpose — it is pressed perhaps four times per run against Next's 154.
- **Next**: 52px pill, min-width 132 (mobile) / 148 (≥640). **Bordered ghost while the current
  question is unanswered; filled `--primary` once it has an answer.** One rule, all eight kinds. On
  auto-advance kinds you barely notice it; on checkboxes and text kinds it is the quiet, wordless
  "you're done here". An unfilled Next also stops shouting *click here* 154 times.
  Border while ghost: `1.5px solid hsl(var(--text-secondary))`, label `--text-secondary` (6.6:1).
- **"Saved"**: currently `hidden sm:inline-flex`, i.e. invisible on every phone. Make it always
  present — 18px `Check` in `--success` alone at < 375px, icon + 13px word above. `aria-live="polite"`.
- The bar translates with `--kb` so a soft keyboard never buries Next (§D.7).
- On the last question, Next's label becomes `goToReview`.

## B.6 Prompt sizing — deterministic, no measurement

Chosen from `prompt_en`, **never the rendered string** (a rendered-string rule would resize the whole
screen when the language toggles; Telugu runs ~15% longer). Comment this in the code.

```ts
const words = q.prompt_en.trim().split(/\s+/).length;
const len   = q.prompt_en.length;
const cls =
  words <= 3 && len <= 26 ? "t-question-hero" :   // BDI headers: "Sadness"
  len <= 60               ? "t-question-xl"   :
  len <= 120              ? "t-question"      :
  len <= 200              ? "t-question-sm"   :
                            "t-question-xs";
```
Real behaviour: BDI `"Sadness"` → hero, 28px@320 / 40px desktop. IRI #26 (128 chars) → `sm`.
CIUS #11 (118 chars) → base. PID-5 items → xl. Hopelessness → xl.

**The BDI inversion is deliberate and is the best screen in the product:** one enormous quiet word
over four long statements, with the section name as an eyebrow above it. Ship it that way.

## B.7 Overflow — three behaviours, one boolean

Measured once per question in a `useLayoutEffect` (`main.scrollHeight > main.clientHeight`), stored in
state. Never a `ResizeObserver` — that is layout thrash on a 150ms budget.

1. **The prompt goes sticky.** `position: sticky; top: 0; z-index: 1; background: hsl(var(--bg-canvas));
   padding-block: 8px 12px;` plus a 20px `::after` canvas→transparent gradient. After 40px of scroll,
   `--q-scale` steps to `0.86` over 200ms. The question **shrinks but never disappears** — an elderly
   reader must never choose between four long BDI statements with the question off-screen. This is the
   most important rule in §B.
2. **An explicit "more below" control**, not a scrollbar hint. 44px circle, centred, 10px above the
   action bar, `bg hsl(var(--bg-surface)/0.94)`, `backdrop-blur(12px)`, `shadow-float`, 20px
   `ChevronDown`, `aria-label` = `moreChoicesBelow` with the count. Tap scrolls `main` by
   `0.82 × clientHeight` (`behavior:"smooth"`, instant under reduced motion). Fades out over 240ms at
   `scrollTop + clientHeight >= scrollHeight - 8`.
3. **The rail's scroll shadow** (§B.4).

**Never** truncate a prompt, hide options behind "show more", or paginate an option set. Clinical
content is shown in full or not at all.

## B.8 Density ladder — how the stack fits without measuring

```ts
type Density = "comfortable" | "regular" | "compact" | "statement";
const longest = Math.max(...labelsEn.map(l => l.trim().split(/\s+/).length));
const density: Density =
  longest >= 9                      ? "statement"   :  // BDI
  count <= 3                        ? "comfortable" :
  count <= 5 && longest <= 6        ? "regular"     :
                                      "compact";
```

| density | card min-h | gap | label | node/glyph |
|---|---|---|---|---|
| comfortable | 76 | 12 | 19px / 1.35 | 32 |
| regular | 68 | 10 | 17px / 1.35 | 28 |
| compact | 60 | 8 | 16px / 1.35 | 24 |
| statement | auto (min 56), padding 16px 18px | 8 | 16.5px / 1.48 | none |

Cards are `flex: 0 0 auto` — they never squash their text. `< 375px` subtracts 4px from every
min-height and 1px from every label; nothing ever goes below **56px card / 16px label**.

---

# C. THE PROGRESS RAIL

## C.1 Composition

Two stacked text lines on the rail's left, plus the 3px bar at its bottom edge.

```
Line 1   .t-rail-count    13px/600 tabular   --text-primary
Line 2   .t-rail-meta     12px/500 tabular   --text-tertiary
Bar      3px, full-bleed, radius 0
```

| total | line 1 | line 2 | bar |
|---|---|---|---|
| ≤ 6 | `1 of 3` | *(omitted — "about 1 minute remaining" on a 3-item survey is comic)* | **segments**: n pills, `flex:1`, gap 4px |
| 7 – 29 | `Question 4 of 18` | `22% complete · about 4 minutes left` | continuous |
| ≥ 30, no sections | `Question 47 of 154` | `29% complete · about 22 minutes left` | continuous |
| ≥ 30, with sections | `Family life · 3 of 21` | `29% complete · about 22 minutes left` | continuous + **chapter notches** |

**Chapter notches** are the highest-value morale device in this spec: a 1px full-height gap punched
through track *and* fill at each section boundary, painted in `hsl(var(--bg-canvas))`. 154 items
become eight visible chapters. It is the difference between "endless" and "eight chapters, I'm in the
third."

Responsive trimming: at `< 360px`, or when the rendered `timeLeft` string exceeds 20 characters, drop
the percent and keep the time. Never drop the time — it is the only number that falls as you work,
and it is the one that carries the emotional weight.

**Whenever the voice transport is expanded (§G.7) and viewport < 640px, both text lines hide**
(opacity + height, 220ms) and the transport takes that space. While listening, the count is not what
anyone needs.

## C.2 What the bar measures — a correctness fix

`QuestionStage` today computes `percent = (index / total) * 100`. That is *position*, labelled as
progress: it reads 0% on question 1 (looks broken), and it rewards skipping.

**Fill = `countAnswered(questions, answers) / total`, floored at 2%.** The percent numeral is the same
figure. Consequences, all correct: the bar moves when you *answer*, not when you navigate; skipping
honestly leaves it still; the review screen's completion % and the bar finally agree; and the 2% floor
means question 1 shows a visible sliver rather than a dead track.

**Position tick.** A 2px × 7px rounded mark in `hsl(var(--text-primary)/0.22)` sitting on the track at
`index / total`, rendered **only** when `index/total − answered/total > 0.02`. Two honest facts, one
hairline, and it appears exactly when it is informative.

## C.3 Motion

```tsx
<motion.div
  style={{ transformOrigin: "left" }}
  initial={false}
  animate={{ scaleX: Math.max(0.02, completion) }}
  transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.33, 1, 0.68, 1] }}
  className="h-[var(--rail-bar-h)] w-full origin-left bg-primary"
/>
```
- `scaleX`, never `width` — `width` triggers layout on every frame.
- **Not a spring.** The current `{stiffness:140, damping:24}` overshoots and reads as playful on a
  well-being instrument. 220ms ease-out reads as certain.
- Fill is **always `--primary`**, flat, never a gradient, never an atmosphere hue. One constant colour
  across 154 questions is what makes it read as one journey.
- Leading edge: `box-shadow: 0 0 6px 1px hsl(var(--primary) / 0.5)`.
- The percent numeral cross-fades `opacity 0→1` over 140ms linear when its rendered value changes. It
  never counts up — a count-up on a 0.6% step is noise.
- Reduced motion: **kept** at 120ms linear. A bar that teleports loses its meaning; this is
  information, not decoration.

## C.4 ARIA

```html
<div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentAnswered}
     aria-valuetext={t("progressSpoken", { i: index+1, n: total, p: percentAnswered })} />
```
The two visible text lines are `aria-hidden`. `aria-valuetext` matters: without it a screen reader
announces "29 percent", the least useful of the four numbers.

---

# D. ANSWER SURFACES — ALL EIGHT KINDS

## D.0 Shared machinery

### D.0.1 The card state machine

| state | spec | duration / easing |
|---|---|---|
| rest | `.answer-card` base (A.5) | — |
| hover *(pointer:fine only)* | `translateY(-2px)`, border `primary/.35`, `shadow-md` | 160ms `--ease-out` |
| focus-visible | 5px ring, **no transform** | 90ms |
| pressed | `scale(0.985)` | 90ms down / 140ms up |
| selected | `data-selected="true"` (A.5) | see the acknowledgement below |
| selected + hover | no lift — it is already the answer | — |
| sibling of a selection | label → `--text-secondary`, border → `--border-subtle`, node fill `opacity .5` | 140ms |

**Never fade a sibling card with `opacity`.** `#1C1C1E` at 0.55 on white is 3.6:1 and fails AA.
Colour-shifting the label keeps it at 7.0:1. Sibling quietening is **disabled entirely** under
`html.pref-high-contrast`, and is **not applied** for `checkboxes` (you may still be choosing).

**The label never changes font-weight on selection.** The current build swaps `font-medium →
font-semibold`, which shifts text width by 1–3px and repaints — a visible twitch at the exact moment
the respondent is looking. Label is weight 500 in every state.

### The selection acknowledgement — the most important 180ms in the product

1. **Ink wipe, 180ms.** `--tap-x` / `--tap-y` are set from the pointer event on `pointerdown`
   (defaults `50% 50%` for keyboard); the `::before` fill wipes from that point. This is the brief's
   "tiny ripple", implemented as the fill itself rather than a Material puddle on top.
2. **Tick drawn, +60ms, 200ms.** SVG `path`, `pathLength=1`, `strokeDasharray=1`,
   `strokeDashoffset 1→0`, `stroke: hsl(var(--primary))`, `stroke-width 2.6`, round caps.
   **A drawn tick reads as "noted"; a popped icon reads as "correct answer".** That distinction is the
   entire tone of the product.
3. **Node beat.** `scale 1 → 1.12 → 1`, spring `{ stiffness: 520, damping: 20, mass: 0.7 }`. An emoji
   settles at `1.16` with `drop-shadow(0 2px 8px hsl(var(--primary)/0.42))`.
4. **Spine fill** (ordered scales only), +40ms, 260ms — see D.0.3.
5. **Card settle**, `scale .985 → 1`, 200ms `--ease-spring`.

Then the auto-advance dwell. Felt sequence: tap → fill by 180ms → tick drawn by 280ms → screen leaves
at 420ms. The advance begins while the tick is still settling, so the answer feels like it *pushed*
the conversation forward.

**`onCommit` semantics are unchanged and protected:** it fires only when a question goes from
unanswered to answered by a single tap. A correction must never fling the screen forward.

### The trailing indicator — resolved

The current `h-6 w-6` bordered circle at each card's trailing edge **is a radio button**; a 68px card
around it does not change what it is. But deleting all confirmation glyphs costs a signal that
low-vision and high-contrast users depend on. The resolution: **the form-control tell is the empty
rest-state ring, not the tick.**

- **Single-select** (`multiple_choice`, `dropdown`, `likert5`, `yes_no`): the trailing slot is
  **empty at rest** — no ring, no box, nothing. On selection an 18px indigo tick *draws* into it,
  unenclosed. Rest state carries zero form furniture; selected state carries a clear mark.
- **Multi-select** (`checkboxes`): a 26px rounded square (`radius 9px`, `border 2px --border-strong`)
  **is** visible at rest, because a checkbox set genuinely must show that these are togglable and that
  none are on yet. This is the only box that survives in the design, and its squareness is what
  distinguishes multi- from single-select at a glance.
- `aria-checked` on `role="radio"` / `role="checkbox"` carries state for assistive tech, which is
  where a "checked" concept belongs.

### D.0.2 The stem line

Every question carries a 13px `.t-stem` line **above** the prompt, generated from `classifyScale()`
and `kind` — never authored per item, always translated. Rationale: the instruments' phrasing is often
a bare **statement** (*"I have seen things that weren't really there."*), so the respondent must supply
the missing frame, and the frame they supply is *"I am being assessed."*

| shape / kind | English stem | key |
|---|---|---|
| `description` (IRI) | How well does this describe you? | `stemDescribe` |
| `frequency` (CIUS, WHO-5) | Over the last while, how often? | `stemFrequency` |
| `truth` (PID-5-BF, Hopelessness) | How true is this for you? | `stemTruth` |
| `agreement` (likert5) | How much do you agree? | `stemAgreement` |
| `binary` (Impulsiveness) | Yes or no? | `stemBinary` |
| `none` + statement density (BDI) | Choose the sentence closest to how you have been feeling. | `stemStatement` |
| `checkboxes` | Choose all that apply. | `chooseAllThatApply` |
| `rating5` | Where would you put it? | `stemRating` |
| `short_text` / `long_text` | In your own words. | `stemWords` |
| anything else | Choose one. | `chooseOne` |

**The stem must be prepended to `narrationText()`** so a listener receives the same framing a reader
does. The existing prompt-then-every-option ordering is otherwise preserved exactly, and is extended
to speak the numeric-anchor rows (D.1b) and the rating captions (D.6).

### D.0.3 The Scale Spine — the signature element

This is the answer to *"elevate the neutral ramp into something premium rather than downgrading the
clinical rule."* It **replaces** `ScaleMeter` in the card gutter (`ScaleMeter.tsx` survives, redesigned,
same `{ level, total, active }` props plus optional `variant`).

Rendered exactly when `visualsForQuestion(q).visuals[i].level` exists — i.e. the ordered-scale
detection in `answerVisuals.ts`, **unchanged**. Never rendered for `shape === "none"` (BDI's grouped
statements, a city list), never for `checkboxes`, never for `binary`.

```
[ gutter 40px ][ gap 12 ][ card ]
   rail 2px, hsl(--text-primary/.10), from centre-of-first-node to centre-of-last-node
   node 28px disc on the rail at each card's vertical centre
```

**The node is one object with three interiors, chosen by `answerVisuals` and nothing else:**

| `answerVisuals` says | node interior |
|---|---|
| `visual.emoji` (face domains) | the face at 20px |
| `visual.level` only (behaviour, generic frequency — the neutral ramp) | a **vertical fill**: `hsl(var(--text-primary)/.28)`, `clip-path: inset(calc((1 - level/total) * 100%) 0 0 0)`. Option 4 of 5 shows a disc 80% full. |
| a bare numeral anchor (D.1b) | the numeral, 14px/600 tabular, `--text-tertiary` |

**This is the key move.** The clinical distinction (face vs no face) stays exactly where
`answerVisuals.ts` puts it, while the *visual composition* stays constant between an IRI item and a
CIUS item. The respondent never sees the screen change shape between instruments; they only see
whether there is a face in the circle. Ordered, neutral, expressive, animated — and it says nothing
about whether the answer is good.

**The rail fill** (`.spine-fill`, `scaleY 0→1`, 260ms `--ease-out`, +40ms delay):

| shape | anchor | reads as |
|---|---|---|
| `agreement` with an **odd** count (likert5) | from the middle node outward toward the selection | displacement from neutral, in the direction and magnitude reported |
| every other ordered shape (`frequency`, `truth`, `description`, `intensity`, even-count agreement) | from the first node up to the selection | how far along the axis |
| `none` / `binary` / `checkboxes` | **no rail at all** | — |

Selected node: border → 2px `--primary`, interior fill → `--primary`, plus a 44px halo ring
(`hsl(var(--primary)/0.16)`) scaling `0.6 → 1` on spring `{ 520, 20, 0.7 }`. Under framer-motion the
halo carries `layoutId="spine-thumb"` so it **slides** between nodes on a correction (260ms
`--ease-emph`) — a correction is the one moment where continuity of the thumb is worth animating.

Never tint the nodes below the selection ("thermometer" fill of the discs themselves). It reads as
multi-selection and it edges toward scoring the respondent back at themselves. The **rail** fills; the
**nodes** do not.

The whole gutter is `aria-hidden`. The option's text label remains the accessible name.

### D.0.4 The `sameSurfaceAsPrevious` rule

When the incoming question has the same `kind` **and** an identical rendered option-label array as the
outgoing one — true for 27 consecutive IRI items, 13 consecutive CIUS items, 24 consecutive
Impulsiveness items — **suppress the answer-block entrance animation entirely.** Only the prompt
animates; the cards do not move, flicker or re-stagger.

The eye then stops tracking the stack and goes straight to the question, which is the only thing that
is new. This is the largest single perceived-quality win in the spec and it costs one `useRef`
comparison. When the option set *does* differ, the full stagger plays and the eye is correctly pulled
down to re-read the choices. **Motion as a signal about what changed, not decoration.**

---

## D.1 `multiple_choice` — the workhorse

IRI, CIUS, PID-5-BF, WHO-5, Trait Anger, Hopelessness and BDI all arrive as this kind. Three
renderings, chosen by **content**, never by kind. **All three store `option.id`.**

### (a) Spined stack — the default
`classifyScale() !== "none"`. Gutter spine + nodes (D.0.3), cards at the D.B.8 density.
- **2 options** (Hopelessness False/True) → comfortable, 76px each. Two cards under a huge prompt is
  the right screen for *"My future seems dark to me."* Do not fill the space.
- **4–5** (IRI, CIUS, PID-5-BF, Trait Anger) → regular, 68px, gap 10.
- **6** (WHO-5) → compact, 60px, gap 8 = 400px. Fits 390px; scrolls at 320 via §B.7.
- **≥ 8** → compact + `mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent)`.

### (b) Numeric-anchored stack — IRI
IRI's options are `["0 — Does not describe me well", "1", "2", "3", "4 — Describes me very well"]`.
Five identical 68px cards labelled `1`, `2`, `3` is the worst surface in the current build — three of
the five carry no meaning at all.

```ts
function isNumericAnchored(labelsEn: string[]): boolean {
  const n = labelsEn.length;
  if (n < 4 || n > 7) return false;
  const bare     = labelsEn.filter(l => /^\s*\d+\s*$/.test(l)).length;
  const anchored = labelsEn.filter(l => /^\s*\d+\s*[—–-]\s*\S/.test(l)).length;
  return bare >= 2 && bare + anchored === n;
}
```
This is **not a new surface** — it is (a) with two changes:
1. The node interior carries the parsed numeral instead of a fill or a face.
2. The card label strips the leading `"0 — "` / `"4 — "` prefix; bare-numeral rows show **no label
   text at all** and the card's accessible name is the full authored anchor.

Middle rows carry no invented words. Inventing *"somewhat like me"* is exactly the editorialising the
clinical rule forbids. Height 5×68 + 4×10 = **380px**, and it is far more legible than five word-cards.

### (c) Statement stack — BDI
`classifyScale() === "none"` **and** `density === "statement"`. Four statements of 8–17 words with no
verifiable order.
- **No gutter, no spine, no glyph, no numeral.** `answerVisuals.ts` returns blanks and that stands.
  Numbering the statements 0–3 on screen would surface the severity score to the respondent.
- `align-items: flex-start`; the trailing tick gets `margin-block-start: 1px` so it aligns to the
  first line. `min-block-size: 56px` auto-growing, `padding: 16px 18px`, label **16.5px / 1.48 /
  weight 500**, `text-wrap: pretty`, gap 8.
- Selection mark is the **in-card left spine**: a 4px bar inset 5px from the leading edge,
  `border-radius: var(--radius-pill)`, `scaleY .2 → 1` in `--primary`, 220ms `--ease-emph`. This is the
  one place the in-card spine appears — it exists precisely where the gutter spine does not.
- Selected label weight goes to 550, **not** 600: a 3-line statement at 600 is shouty.
- Worst case ("I am worried about physical problems…") at 390px = 3 lines × 25px + 32px padding =
  107px; four of them + gaps = **452px**, under a one-line hero prompt. Fits at 390; scrolls at 320.

Beauty here is restraint: four white cards, 20px radius, one hairline, perfect leading, and the ink
wipe. Paired with the hero-scale prompt (§B.6) this is the flagship screen. Ship it.

---

## D.2 `dropdown` — never a `<select>`

Both renderings store `option.id`.

- **≤ 7 options → renders exactly as D.1.** A dropdown is an authoring convenience; on this screen the
  options have room to simply exist. The existing code already does this and its comment is right.
- **> 7 options → a search-first bottom sheet.** A 30-item district list cannot be 30 cards on a phone.
  - **Trigger:** 64px full-width pill, `--radius-answer`, `1.5px --border-strong`, `--bg-surface`.
    Leading: the selected label at 17px/500, or the `chooseOne` placeholder in `--text-tertiary`.
    Trailing: 20px `ChevronDown` in `--text-tertiary`. Selected → standard selected-card treatment.
  - **Sheet:** Radix Dialog styled as a bottom sheet. `block-size: min(88dvh, 720px)`,
    `border-radius: var(--radius-sheet) var(--radius-sheet) 0 0`, `--bg-surface`, `shadow-float`.
    Enters `translateY(100%) → 0` over 300ms `--ease-emph`; backdrop `rgba(28,28,30,.28)` over 200ms.
    36×4px grabber, `--border-strong`, 10px from the top; drag-to-dismiss on the top 56px.
  - **Search field** appears only when `options.length > 12`: 52px, `--radius-field`, sunken bg,
    **18px** text, `inputmode="search"`, `enterkeyhint="search"`, 20px leading `Search` icon. Filters
    case-insensitively on the **rendered** label, so Telugu filters in Telugu. Empty result → a 56px
    row reading `noMatches` at 15px `--text-tertiary`.
  - **Rows:** 56px, 17px, full-bleed within a 16px gutter, 1px hairline dividers. Selected row: atmo
    fill + a 20px trailing `Check` in `--primary`. **A trailing check is correct here** — this
    genuinely is a list, not a card set.
  - Select → row flashes selected (160ms) → sheet slides out (220ms) → commit → auto-advance at 420ms.
  - Focus returns to the trigger on dismiss. `Escape` and backdrop tap close without changing the value.

---

## D.3 `likert5` — the continuum

Always exactly 5 anchors from `LIKERT_LABELS`, always `shape: "agreement"`, stored **1–5** in the
instrument's own order.

**Do not attempt a horizontal 5-stop dial.** `"పూర్తిగా విభేదిస్తా"` cannot be laid out under a
64px-wide stop legibly for a 70-year-old. Horizontal likert is the single most common premium-survey
mistake.

Therefore: the spined stack of D.1(a) at regular density (5 × 68 + 4 × 10 = 380px), faces in the
nodes, and the **bipolar rail fill from the middle node outward** (D.0.3) — which is what makes
likert5 visibly a *continuum with a neutral centre* rather than five menu items.

Emoji treatment inside the node:

| state | transform | filter | opacity |
|---|---|---|---|
| rest | `scale(1)` | `saturate(0.85)` | 0.72 |
| selected | `scale(1.16)` | `saturate(1.15) drop-shadow(0 2px 8px hsl(var(--primary)/0.42))` | 1 |

Spring `{ 520, 20, 0.7 }`. Under reduced motion, opacity only (0.72 → 1).

---

## D.4 `yes_no` — the pair

Impulsiveness runs **24 consecutive** yes/no items. This is the highest fatigue risk in the whole flow,
and the cost of a moving target compounds 24 times.

- **Always two stacked cards, never side by side.** Yes is always the upper card. 88px each, gap 12,
  total 188px. Side-by-side saves vertical space but a horizontal pair sits at two different distances
  from the thumb; a vertical pair with a bottom-anchored stack puts both targets on **identical pixels
  across all 24 items**. The thumb stops moving entirely and the eyes do all the work.
- **Never randomise left/right or top/bottom.** The rhythm is the point.
- Leading slot: 36px circle, `2px --border-strong`, containing `Check` (Yes) / `Minus` (No) at 18px in
  `--text-tertiary`. Selected: circle fills `--primary`, glyph `--primary-foreground`, spring
  `{ 520, 20 }` on `scale .85 → 1`.
- **Never 👍 / 👎, never any emoji.** `visualsForShape("binary")` already returns blanks and that is
  right: a thumbs-down against *"Are you an impulsive person? — No"* is a verdict, and a 😊 against
  *"Would you often like to get high?"* would be a catastrophe. `Check` / `Minus` are neutral marks of
  choice.
- Label 19px / weight 500. No spine, no rail.
- **Auto-advance 340ms** (not 420) — it is the fastest decision in the instrument and 24 of them add
  up.

---

## D.5 `checkboxes` — the plural stack

Stored value: an array of option ids. Four deliberate differences from single-select.

1. The stem reads **"Choose all that apply."**
2. **No spine, ever** — a checkbox set is unordered by construction here.
3. The visible 26px rounded-square box at rest (D.0.1) is the one surviving box.
   Selected: fills `--primary` over 90ms, then a `Check` draws via `pathLength 0 → 1` over 200ms
   `--ease-out`, `strokeWidth 3`, round caps. Deselect reverses: tick `1 → 0` in 140ms, then the fill
   drains over 90ms, with the ink wipe running backwards from the tap point.
4. **No sibling quietening** and **no `onCommit`** — the respondent is still choosing.

Completion signals, because nothing moves you on:
- A live count chip below the stack: 32px pill, `bg hsl(var(--primary)/0.10)`, 13px/600 `--primary`,
  `nSelected`, `aria-live="polite"`. Appears at n ≥ 1, 180ms fade + 4px rise. At n = 0 it reads
  `noneSelectedFine` — *"None selected — that's fine"*.
- The action bar's Next fills (§B.5) and its label changes from `next` to `doneChoosing` at n ≥ 1.

No exclusivity logic ("None of the above" clearing the rest). The data model has no exclusivity flag,
and inferring one from a label would change what the instrument records.

---

## D.6 `rating5` — the staircase

Five lucide stars are the most form-like surface in the product *and* semantically wrong: nobody rates
their hopelessness five stars, and gold stars encode "more = better" on scales where more is worse.
Delete them from the respondent flow. `RatingStars.tsx` **survives unchanged for the admin preview.**

Stored value stays **1–5**.

```
                          4
                         😟

   ▁▁    ▂▂    ▃▃    ▅▅    ██
  ┗━━┛  ┗━━┛  ┗━━┛  ┗━━┛  ┗━━┛
  Not at all                A great deal
```
- **Row:** 5 capsules, `border-radius: var(--radius-pill)`, heights ramping **34 / 41 / 48 / 56 / 64px**,
  all bottom-aligned in a 64px box. Widths `flex: 1`, gap 5px at < 375px (52px each at 320), gap 8px
  at ≥ 375 (62px at 390). Each capsule's hit area is its full 52 × 64 — comfortably over 44 × 44.
- Rest fill `hsl(var(--text-primary)/0.09)`. Hover (fine pointer) `/0.16` + `translateY(-2px)`.
- **Selection pour:** capsules 1..n fill `hsl(var(--atmo-h) var(--atmo-s) calc(var(--atmo-l) - 14%))`
  at 88% opacity, each over 140ms `--ease-out`, staggered **40ms left → right**; 300ms total for n=5.
  Capsules above n drain over 120ms. This is the one place the atmosphere hue carries a large area,
  and it is justified: it is the answer itself. Cumulative fill is the star metaphor's one genuinely
  good idea and it survives.
- **Above the row:** the numeral at 24px/600 tabular, fading in + rising 6px over 180ms. If
  `visualsForQuestion` yields a face ramp for this domain, **one** face — for the current value only —
  sits left of the numeral at 26px, spring `{ 520, 18 }`. One face for the chosen value, never five
  faces down a column: the clinical rule is about not labelling *options*; this labels the answer the
  respondent just gave, which is exactly what `AnswerMeta.emoji` already records.
- **Below the row:** two 13px `--text-secondary` captions, `justify-content: space-between` —
  `ratingLow` / `ratingHigh`. A bare 1–5 with no anchors is meaningless.
- Optional pointer drag across the row updates live and commits on `pointerup`.
- Total height 64 + 30 + 26 + 16 = **136px**. Against 5 stars at ~48px this costs 88px and is worth
  every one.
- Auto-advance 420ms.

---

## D.7 `short_text` — the writing line

Today: `<Input className="h-14 rounded-field" placeholder="Your answer" />` — a form field, full stop.

- **No box at rest.** `.answer-line` (A.5): a transparent input over a 1.5px bottom rule spanning the
  full measure.
- Input: transparent, borderless, **20px / 1.45 / weight 450**, `--text-primary`,
  `caret-color: hsl(var(--primary))`, padding `0 2px 14px`. 20px is well above iOS's 16px force-zoom
  threshold.
- Placeholder: `--text-tertiary`, same 20px, and it must be a **real example in the respondent's
  language**, not "Your answer" — `textPlaceholderExample`.
- Focus: the 2px underline draws `scaleX(0) → 1` from the left over 260ms `--ease-emph`, and the
  wrapper takes the 5% atmosphere tint with rounded top corners over 180ms. The line becomes a
  surface as you commit to writing.
- `enterkeyhint="next"`, `autocapitalize="sentences"`, `autocomplete="off"`, `spellcheck="true"`,
  `maxLength={300}`. **Enter commits and advances** — the only kind where it does.
- Counter (`charactersLeft`) appears only past 240/300, right-aligned 13px `--text-tertiary`,
  `aria-live="polite"` throttled.
- **No autofocus.** Autofocus raises the keyboard, eats 45% of the viewport and hides the question.

### The soft-keyboard contract (mandatory for D.7 and D.8)

```ts
// The soft keyboard shrinks the visual viewport but not the layout viewport, so a
// sticky footer ends up underneath it — Next becomes untappable at exactly the
// moment a respondent has finished typing.
const vv = window.visualViewport;
const kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
document.documentElement.style.setProperty("--kb", `${kb}px`);
```
`.action-bar { transform: translateY(calc(-1 * var(--kb))); }` and
`main { padding-block-end: var(--kb); }`. When `--kb > 120px`: the voice row hides, the sticky prompt
drops to `--q-scale: 0.86` (200ms), and the SupportButton hides. All restore on the inverse condition.

---

## D.8 `long_text` — the note surface

- Card: `--radius-answer`, `1px hsl(var(--border-subtle))`, `--bg-surface`, `shadow-xs`,
  `padding: 16px 16px 44px`.
- Textarea inside: transparent, borderless, `resize: none`, **18px / 1.62** (Telugu 1.78),
  `min-block-size: 132px`, auto-growing to `min(46dvh, 340px)` then scrolling internally
  (`overscroll-behavior: contain`). Auto-grow via `field-sizing: content` with a `scrollHeight` sync
  inside `requestAnimationFrame` as the Safari/Firefox fallback.
- Inset bottom row (36px, inside the card's padding): leading = 13px `--text-tertiary`
  `writeAsMuchAsYouLike`; trailing = counter, only past 1700/2000.
- Focus: `border-color: hsl(var(--primary)/0.55)` + `box-shadow: 0 0 0 4px hsl(var(--focus-ring)/0.10)`,
  180ms. **No lift while typing.**
- While focused, a 44px circular `Check` button pins at the card's bottom-trailing corner inside the
  padding → blurs the field and advances. Enter is a newline here, so this is the only advance
  affordance while the keyboard is up.
- `enterkeyhint="enter"`, `maxLength={2000}`.
- **No dictation button.** The platform has TTS but no STT, and there is no reliable browser Telugu
  STT. A microphone icon that silently fails is worse than no microphone icon.

---

## D.9 The two things in the answer region that would still read as a form

### D.9.1 Skip in the action bar
`[← Previous] [Skip] [Next →]` is the visual grammar of a wizard — Google Forms' page navigation,
verbatim — and it is on all 154 screens. It also lies about frequency.

**Skip leaves the bar entirely** and becomes the last row of the answer region: a 44px borderless,
centred, 15px `--text-tertiary` text button reading `skipForNow`, above a 12px gap and a 1px dotted
`--border-subtle` rule. It reads as the last thing you could say, not as a control you must consider.
Rendered on every unanswered question — the promise must be visible, or the instructions screen lied.

Because Next never blocks, `onSkip(question.id)` also fires whenever the respondent advances **forward**
from an unanswered question by **any** route (Next, arrow key, swipe). That keeps the review screen's
"Skipped" vs "Not seen" distinction truthful regardless of which affordance was used.

### D.9.2 Validation copy
**Delete the word "Required" from the respondent flow entirely.** There is no state in which the
respondent is told they did something wrong. No validation copy appears on any question screen, ever.
Requiredness is surfaced exactly once, softly, in the review confirmation sheet (§G.8).

---

# E. CATEGORY ATMOSPHERE

## E.1 The classification heuristic

`src/lib/questionCategory.ts`. Resolved **per section**, memoised, and applied at section boundaries
only. A hue that shifts every screen is a visible theme flicker — precisely the failure mode this
feature must avoid.

```
1. section.title_en keyword match (first hit wins, ordered):
     /famil|spouse|children|home|household|marriage/i  → family
     /empath|perspective|other people|understand|compassion/i → empathy
     /hope|future|outlook|optimis|despair/i            → hope
     /internet|online|screen|digital|phone|social media/i → internet
     /well[- ]?being|quality of life|WHO|daily life/i   → wellbeing
     /mood|depress|sad|grief|low|beck/i                 → depression
     /stress|pressure|cope|coping|strain|tension/i      → stress
     /anger|temper|irritab|rage|frustrat/i              → anger

2. instrument key from the section's questions' `source_ref` (majority):
     iri → empathy · cius → internet · bdi → depression · who5 → wellbeing
     trait_anger → anger · hopelessness → hope
     pid5bf → neutral · impulsiveness → neutral

3. MAJORITY VOTE of classifyDomain(prompt_en) across the section's questions, mapped:
     loneliness | support        → family
     anger                       → anger
     stress | fear | concern     → stress
     mood | health               → depression
     hope | confidence           → hope
     happiness | energy | sleep | comfort → wellbeing
     behaviour                   → internet
     generic                     → neutral

4. neutral
```

**Majority vote across the section, never per question.** `categorizeQuestion(q)` (the locked
signature) therefore resolves through a section-level memo keyed on `q.section_id`; for a question
with `section_id === null` it falls through to steps 2–4 over that question alone.

`categoryLabelKey(c)` returns the dictionary key for an optional quiet chip
(`catFamily` … `catNeutral`), or `null` for `neutral` — the neutral atmosphere is never named.

## E.2 Where it renders — exactly four places, and nowhere else

1. **The ambient wash** (`.atmo-wash`, A.3) — one fixed layer at `z-0`, alpha ≤ 0.10 light / ≤ 0.14
   dark, top-anchored, faded out by 62% of viewport height so it is never behind an answer card.
2. **The selected answer card's fill** — `0.07` light / `0.12` dark, layered *under* `--bg-surface`.
   Border, spine, tick and focus ring all stay `--primary`.
3. **The section chip** — `background: hsl(var(--atmo-h) var(--atmo-s) var(--atmo-l) / .12)`,
   `color: var(--atmo-ink)`, 6px leading dot at `var(--atmo)`.
4. **The section interstitial** — the wash at `0.20`, plus a 72px orb: an atmosphere disc at `/0.14`,
   a 1.5px ring at `/0.24`, and a 26px Lucide icon in `var(--atmo-ink)`.

Plus `rating5`'s pour (D.6), which is a selected-answer fill and therefore case 2.

## E.3 The transition

You cannot cross-fade a gradient in one layer. Render **two stacked `.atmo-wash` layers**; on change
the incoming goes `opacity 0 → 1` and the outgoing `1 → 0` over **900ms** `--ease-out`. Deliberately
slower than every other change on the route: the colour arrives after you have already started
reading, so you feel it and never catch it happening. **The hue changes only during a section
interstitial**, where a 900ms cross-fade is covered by a screen change and is literally unseeable.
Reduced motion: 0ms swap (still changes — never remove a state change, only its interpolation).

## E.4 What we explicitly do NOT do

- **No per-question colour change of any kind.** Section boundaries only.
- No change to `--bg-canvas`. A wash at ≤10% is atmosphere; a tinted page is a theme.
- No coloured question text, ever.
- **No atmosphere on the progress bar, the Next button, the focus ring, any border, any tick, or any
  rail icon.** Brand indigo `--primary` is the only interactive colour in the product.
- No signal red for anger, no signal green for wellbeing. `--danger` never appears on this route.
- **No darkened or desaturated treatment for the depression section.** Depression is a light slate
  blue that could equally be a calm evening sky. Pathologising the UI is a form of comment on the
  respondent, and a person answering the BDI does not need the interface agreeing with them.
- No category illustration, photograph, pattern, or icon on the *question* screen. The icon exists
  only on the interstitial.
- No animated, breathing or pulsing wash. It is static within a section.
- No alpha above 0.14 anywhere in the wash, and no atmosphere colour behind text.
- No sound. No haptic beyond the OS default tap.
- No user-facing theme control. There is no affordance, no label, and the mapping is never exposed —
  no category name appears anywhere except in an authored section title.

---

# F. MOTION INVENTORY

Presets:
```ts
const EASE_OUT  = [0.33, 1, 0.68, 1] as const;    // existing --ease-out
const EASE_EMPH = [0.22, 1, 0.36, 1] as const;    // arrivals
const ACK    = { type: "spring", stiffness: 520, damping: 20, mass: 0.7 } as const;
const SETTLE = { type: "spring", stiffness: 300, damping: 26 } as const;
```

| # | moment | property | duration | easing | reduced motion |
|---|---|---|---|---|---|
| 1 | question enter | `opacity 0→1` | 200ms | linear | 120ms opacity |
| 2 | question enter | `y: dir*10 → 0` — **vertical, not horizontal** (replaces today's `x: dir*24`; horizontal reads as pages of a form, vertical as a transcript advancing) | 260ms | `EASE_EMPH` | none |
| 3 | question enter, children | stem 0 · prompt 0 · voice +40 · answers +70ms, each `opacity/y 6→0` | 220ms | `EASE_OUT` | none |
| 4 | answer-stack stagger | child delay `i × 22ms`, capped at 5 children (110ms) | 220ms each | `EASE_OUT` | none |
| 5 | **`sameSurfaceAsPrevious`** | answer block entrance **suppressed entirely** (D.0.4) | — | — | — |
| 6 | question exit | **none.** Keyed remount. Never add `AnimatePresence mode="wait"` — that is the lag this redesign exists to remove. | 0 | — | — |
| 7 | card hover *(fine pointer)* | `translateY(-2px)` + `shadow-md` | 160ms | `EASE_OUT` | none |
| 8 | card press | `scale(.985)` | 90 down / 140 up | `EASE_OUT` | none |
| 9 | ink wipe | `clip-path: circle(0→140% at tap)` | 180ms | `EASE_OUT` | instant fill |
| 10 | tick draw | `strokeDashoffset 1→0`, +60ms delay | 200ms | `EASE_OUT` | instant |
| 11 | node beat | `scale 1→1.12→1`; emoji settles 1.16 | spring | `ACK` | opacity only |
| 12 | spine rail fill | `scaleY 0→1` from anchor, +40ms | 260ms | `EASE_OUT` | instant |
| 13 | spine thumb (correction only) | `layoutId` slide | 260ms | `EASE_EMPH` | 120ms opacity crossfade |
| 14 | sibling quieten | label/border colour, node `opacity .5` | 140ms | `EASE_OUT` | 0ms · disabled in high-contrast |
| 15 | card settle | `scale .985→1` | 200ms | `--ease-spring` | none |
| 16 | checkbox draw / undraw | `pathLength 0→1` (+40ms) / `1→0` | 200 / 140ms | `EASE_OUT` | instant |
| 17 | rating5 pour | per-capsule, 40ms stagger | 300ms total | `EASE_OUT` | instant, no stagger |
| 18 | **auto-advance dwell** | timer after a first answer | **420ms** · `yes_no` **340ms** | — | **600ms** — with no animation the static selected state is the only cue, and it needs longer to be seen |
| 19 | progress bar | `scaleX` | 220ms | `EASE_OUT` | **kept**, 120ms linear |
| 20 | progress percent | `opacity` cross-fade on value change | 140ms | linear | 0ms |
| 21 | progress dots (`total ≤ 6`) | new dot `scale .6→1` | 220ms | `--ease-spring` | 0ms |
| 22 | atmosphere wash | two-layer `opacity` cross-fade | **900ms** | `EASE_OUT` | 0ms swap |
| 23 | sticky prompt shrink | `--q-scale 1→0.86` | 200ms | `EASE_OUT` | instant |
| 24 | "more below" chevron | `opacity + y 6→0` / out | 200 / 240ms | `EASE_OUT` | opacity only |
| 25 | interstitial in — orb | `scale .86→1`, +80ms | spring | `SETTLE` | opacity 200ms |
| 26 | interstitial in — title / meta / button | `y 12→0 + opacity`, delays 140 / 220 / 300ms | 380ms | `EASE_EMPH` | opacity 200ms, no stagger |
| 27 | interstitial out | `opacity 1→0`, `scale 1→1.01`, **cross-fading with** the first question's entrance (never sequenced) | 220ms | `--ease-in-out` | 120ms opacity |
| 28 | encouragement | in / hold / out | 240 / 2600 / 320ms | `EASE_OUT` | 120ms in, same hold |
| 29 | voice pill expand / collapse | `width` + child fade | 220ms | `EASE_EMPH` | 120ms, no width anim |
| 30 | support sheet in (mobile) | `translateY 100%→0`; scrim `opacity` | 300 / 200ms | `EASE_EMPH` | 140ms opacity |
| 31 | support dialog in (≥640) | `scale .97→1 + opacity` | 260ms | `EASE_EMPH` | 140ms opacity |
| 32 | support button collapse | pill → 44px circle, once, after question 12 | label 120ms then width 260ms | `EASE_OUT` | instant |
| 33 | language switch | `main opacity 1→.4→1`, text swaps at the trough, **nothing moves** | 140 + 140ms | `EASE_OUT` | 0ms swap |
| 34 | "Saved" chip | `opacity 0→1, x -4→0` | 180ms | `EASE_OUT` | opacity 120ms |
| 35 | review ring | `pathLength 0→completion`, +120ms | 900ms | `EASE_EMPH` | opacity 200ms |
| 36 | review rows | 24ms stagger, capped at 12 rows then instant (a 154-row stagger runs 3.7s) | 200ms | `EASE_OUT` | none |
| 37 | review disclosure | `height auto` | 240ms | `EASE_OUT` | instant |
| 38 | thank-you rings | `pathLength 0→1`, 120ms stagger, outermost first, **ONCE — never looping** | 900ms total | `EASE_OUT` | opacity 300ms |

## F.1 Reduced motion, in one sentence

Every transform and every stagger is removed; opacity transitions survive but shorten to ≤ 200ms; the
atmosphere still changes, instantly; the progress bar and the tick still animate because they are
information, not decoration; the auto-advance dwell **lengthens** to 600ms because the static selected
state is now the only cue that the tap registered. The screen never becomes *static* — feedback still
exists, it just stops moving.

**The rule: never remove a state change under reduced motion — only its interpolation.**
Removed entirely: the ink wipe (instant fill instead), the hover lift, the emoji scale, every
interstitial stagger, and the thank-you ring draw.

Mechanism: framer-motion's `useReducedMotion()` (the existing pattern) plus the global CSS block
already in `index.css`. **Do not add a third mechanism.**

## F.2 Performance contract

- Only `transform`, `opacity`, `clip-path`, `background-color`, `border-color` and `box-shadow`
  animate. **Nothing animates `width`, `height`, `top` or `margin`** — including the progress bar
  (`scaleX`) and the voice pill (`width` is permitted there only because it is a 220ms one-shot on a
  108px element, outside the question-change budget).
- `AnswerCards` is `React.memo`'d on `(question.id, value, mode)`. Without it every keystroke in a
  `long_text` item re-renders the entire motion tree.
- `will-change: transform` is set only on the pressed card, only for the press.
- `filter` animates on at most one element at a time (the 28px node emoji is the sole exception).
- **Question change budget: < 150ms to first paint of the new prompt.** Guaranteed because the whole
  instrument is already in memory (`getPublicSurvey` is one round trip) and the exit animation is zero.

---

# G. SCREEN BY SCREEN

Common to every non-question stage: the full identity header returns (Logo 36 · `appShort` ·
`orgLine` · full-word LangToggle), the atmosphere is `neutral` (except the interstitial), the column
is `--col-reading` (640px), and there is no progress rail.

**The boxes rule, enforceable in review:** in the entire respondent flow the only bordered surfaces
are (i) the answer card, (ii) the long-text sheet, (iii) the dropdown/support sheet, (iv) the consent
affirmation card, (v) the reference-id block on thank-you. Everything else is a hairline-divided
`.rule-list` sitting directly on the canvas. Every bordered rectangle that is not an answer target
reads as a form field, and the current build has them on welcome (2), consent (5), instructions (4),
review (2) and thank-you (1). This single change removes the visual grammar of a form from four of the
six screens and is worth more than every animation in §F.

## G.1 Welcome — *you are expected, and this is safe*

640px column, vertically centred.

1. **First-run language choice, above everything else.** Two 76px cards, side by side at ≥ 360px,
   stacked below: `తెలుగు` (26px, Noto Sans Telugu) / `English` (22px, Inter). **Shown only when no
   language preference is stored.** A Telugu-reading widow should meet her own script before she meets
   anything else; a 36px toggle in the top-right corner is not that.
2. Logo 56px, centred; entrance `scale .94→1 + opacity`, `SETTLE`. Nothing moves after 600ms.
3. `eyebrow` → **`welcomeEyebrow`: "A private conversation about how you are"** (replacing "A
   well-being conversation" — the eyebrow is the promise, not a label).
4. `h1.t-hero` = survey title. Body 16px/1.65 `--text-secondary`, max 44ch.
5. A three-row `.rule-list`, 52px rows, 18px Lucide icons: `Clock` *About 24 minutes* ·
   `ListChecks` *154 questions* · `Lock` *Confidential · no login needed*.
6. `privacyBody` at 13px `--text-tertiary`, max 46ch. **The two bordered NoteCards go** — two boxes on
   a welcome screen is the form tell.
7. `beginAssessment` — 56px full-width primary pill.

**Resume variant**, above the button, no card:
```
Welcome back                                          17px / 600
You answered 46 of 154 questions on 18 July.          14px --text-tertiary   → resumeBodyCount
[   Continue where I left off   ]                     56px primary
  Start over                                          44px text button, tertiary
```
The real count and date is a small change that makes resume feel like the app remembered *them*.
Resume logic is unchanged (`onResume` → `firstUnansweredIndex`, consent not re-asked).

## G.2 Consent — *you are in control*

- `h1.t-title` `consentTitle`, 15px `--text-secondary` intro.
- The four points become a **`.rule-list`**, 56px rows — not four bordered cards. Leading glyph is a
  **24px numeral in a `--bg-sunken` circle**, not a green check: a green tick reads as *already done*;
  these are things to read, not things achieved.
- The affirmation stays a full-width **76px `.answer-card`** with the 26px square check. It is the one
  control on the screen that must look like a control, and it is the best thing in the current build.
- **`Continue` is never `disabled`.** A greyed-out primary is the most form-like element on any screen,
  and a disabled button cannot even receive the tap that would explain itself. Instead: tapping it
  before the tick moves focus to the affirmation card and fades in a 13px line above the button —
  `consentTickFirst` — wired via `aria-describedby`. No shake, no theatre.
- One extra 13px tertiary line under the points: `consentNothingSent` — *"You can stop at any time,
  and nothing is sent until you press Submit."* That sentence removes the biggest unspoken fear in
  the flow.
- Motion: points stagger at 60ms; affirmation card at 260ms.

## G.3 Instructions — *here is how this will feel*

A `.rule-list` of five 56px rows, 18px Lucide icons:

| icon | key | text |
|---|---|---|
| `ListChecks` | `instructionOneAtATime` | You will see one question at a time, in large clear text. |
| `Volume2` | `instructionListen` | Tap Listen to hear any question read aloud. |
| `SkipForward` | **`instructionSkip`** | If a question doesn't apply to you, you can move past it. Nothing is required. |
| `Save` | `instructionAutoSave` | Every answer is saved automatically. You can close and come back. |
| `Undo2` | `instructionGoBack` | You can go back and change any answer before submitting. |

- **A live `VoiceControl` reads this list aloud.** Someone who cannot read the screen discovers the
  Listen button where it costs nothing. Highest-leverage addition on this screen.
- **No demo question.** A fake item inside an instrument screen risks a respondent believing it was
  recorded. Rejected.
- Primary CTA: **`startWithSection` — "Start · {title}"** when the survey has sections, otherwise
  **`startWithQuestionOne` — "Start — question 1 of {n}"**. The first number the respondent sees is 1,
  not 154.

## G.4 Section transition

**Prerequisite:** `getPublicSurvey` must return sections (§J).

**When it appears:** on forward navigation into a question whose `section_id` differs from the
previous question's, when the incoming section has ≥ 2 questions. **Never on the first section** —
instructions has just run, and a fourth consecutive intro screen before a single question is
punishing; the instructions CTA carries the first section's name instead (G.3). Never on backward
navigation. Never after the last section (review is the closer). Never when the survey has ≤ 1 section.

Seen sections are tracked in a component-level `Set<string>`, **not persisted**: a resumed session
re-shows the interstitial for the section it lands in, because that re-orients. If a resume lands
mid-section, the interstitial is skipped.

Own stage (`Stage` gains `"section"`), centred 400px column, no rail, no action bar, LangToggle kept
top-right, wash at `0.20`.

```
              ╭───────╮
              │   ☾   │       72px orb: disc /0.14 + ring 1.5px /0.24 + 26px Lucide, strokeWidth 1.5
              ╰───────╯
          PART 3 OF 7          .eyebrow · 12px/600/.08em · --text-tertiary     → partXofY
        How you have been      .t-title 28px/600, text-wrap:balance
   Twelve short questions about how you have
   been feeling over the past two weeks.        15px/1.6 --text-secondary, max 42ch
        ─────────────────
   12 questions · about 4 minutes               13px --text-secondary, tabular
     [           Continue           ]           56px full-width primary pill  → sectionContinue
              Back                              15px ghost, --text-secondary, 48px
       You're 38% through.                      13px --text-tertiary
```

Icons (Lucide, `strokeWidth: 1.5`): family `Home` · empathy `HeartHandshake` · hope `Sunrise` ·
wellbeing `Leaf` · **depression `Moon`** · stress `Wind` · **anger `Waves`** · internet `Smartphone` ·
neutral `Compass`. `Moon` and `Waves` are deliberate: rest and tide, not cloud and flame. A rain cloud
over a depression section, or a flame over an anger section, is a comment on the respondent.

- Title = `renderBilingual(mode, section.title_en, section.title_te)`. Description = the authored
  `description_*`; **when absent, omit the paragraph entirely — never generate filler.**
- **The interstitial never shows a clinical instrument name.** A grieving parent must not be told they
  are about to take a *Beck Depression Inventory*. When `title_en` is blank, use the category fallback
  (§H). `source_ref` is **never** rendered anywhere in the respondent flow.
- Counts from the section's own items; minutes from `minutesFromSeconds(estimateSeconds(...))`.
- **Never auto-dismisses.** A tap is required. It is a breath, and a breath you cannot control is not a
  breath. No "skip section" — skipping is per question.
- `You're 38% through` is **the only place a percent is spelled out mid-flow**, and it lands where a
  number is genuinely encouraging rather than where a stubborn small number would be demoralising.
- This is where the atmosphere hue cross-fades (900ms), fully covered by the screen change.
- Keyboard: the `h1` takes focus; `Enter` / `Space` / `ArrowRight` are bound to Continue while mounted.

## G.5 The question screen

Fully specified in §B, §C, §D. `Encouragement` renders into the rail (G.6). `SupportButton` floats
(G.7).

## G.6 Encouragement

**Form: not a toast, not a card, not a modal.** It **replaces line 2 of the progress rail for 2.6
seconds**, then the meta line cross-fades back.

13px / weight 500 / `--text-secondary`, preceded by a 5px `--primary` dot. `aria-live="polite"`,
`role="status"`. Out 140ms → in 300ms (`y 6→0`) → hold 2600ms → meta returns 400ms.

Why there: it lands where the eye already goes for *"how am I doing"*; it consumes zero extra pixels;
it cannot cover an answer; and it is **structurally incapable of stacking into a pile of toasts.** A
toast over the content is a notification, and a notification during a suicidal-ideation item is
indefensible.

**Budget: at most 5 in an entire run**, only when `total >= 20`.

| trigger | key |
|---|---|
| after question 5 | `encourageStart` |
| crossing 25% answered | `encourageQuarter` |
| crossing 50% answered | `encourageHalfway` |
| crossing 75% answered | `encourageThreeQuarter` |
| 3 questions from the end | `encourageNearlyDone` |

**Suppression rules — all mandatory, checked in this order:**
1. Never twice within 12 questions.
2. Never on the same screen as, or the screen immediately after, a section interstitial.
3. Never immediately after a skip.
4. Never on the first or last question.
5. **Never after an item whose `prompt_en` or chosen option label matches
   `/kill|suicid|hurt myself|end my life|hopeless|worthless|die/i`, and never after an answer at the
   distressed end of an ordered scale** (`visual.level >= visual.total - 1`) whose `classifyDomain` is
   in `{ mood, hope, loneliness, concern, stress, fear }`.

> Rule 5 is not a heuristic and is not optional. *"You're doing well."* landing on the screen after
> someone selects *"I would kill myself if I had the chance."* is the single most damaging thing this
> product could do. **This rule must carry a comment in the code saying so.**

Copy rules: acknowledge effort or state a fact; **never evaluate the person**; no exclamation marks;
no "great / awesome / amazing"; never congratulate an *answer*, only progress.

## G.7 Support

Keep the three constraints in `SupportButton.tsx`'s header comment verbatim — they are right. Change
the form.

**The button.** On the question screen: a 44px circle, `LifeBuoy` 20px `--primary`,
`background hsl(var(--card)/0.92)`, `1px hsl(var(--border-subtle))`, `shadow-float`, `blur(20px)`.
Position `inset-inline-end: max(16px, env(safe-area-inset-right) + 8px)`;
`inset-block-end: calc(var(--action-h) + env(safe-area-inset-bottom) + 12px)` on stages with an action
bar, `calc(env(safe-area-inset-bottom) + 16px)` otherwise. At ≥ 1024px it moves outside the column
entirely: `left: calc(50% + 380px + 24px); bottom: 32px`.

- **Discoverability, then quiet.** It renders as the labelled pill (`supportButtonLabel`) through
  question 12; from question 13's mount it collapses once to the circle (label `opacity→0` 120ms, then
  `width` 260ms `EASE_OUT`). Discovered once, quiet forever. It re-expands to the labelled pill on
  review and thank-you, and stays a labelled pill permanently at ≥ 1024px where the margin is dead.
- **It never pulses, badges, bounces or auto-opens.** Entrance once, `opacity/y 8→0`, 400ms, +600ms.
- On < 640px it sits 12px above the action bar and the skip line's `max-inline-size` becomes
  `calc(100% - 60px)`, so it can never overlap an answer or the skip affordance.

**The sheet.** Bottom sheet < 768px (`--radius-sheet` top corners, `max-block-size: 78dvh`, 36×4px
grabber, drag-to-dismiss); centred 480px dialog ≥ 768px.

```
( ● LifeBuoy, 44px disc, accent-tint )

You are not alone                                    .t-section 20px/600      → sosTitle
If answering these questions feels difficult,        15px/1.65 --text-secondary → sosBody
please remember that support is available.
You can pause at any time.
──── .rule-list, four 64px rows, 20px Lucide strokeWidth 1.7 ────
[HeartHandshake] Mental health support               → sosMentalHealth
                 Tele-MANAS · 14416 · free, 24×7…    → sosMentalHealthDetail   [ Call ] tel:14416
[Phone]          KIRAN helpline                      → sosKiran
                 1800-599-0019 · free, 24×7          → sosKiranDetail          [ Call ] tel:18005990019
[Siren]          Emergency                           → sosEmergency
                 112                                 → sosEmergencyDetail      [ Call ] tel:112
[Users]          Talk to someone you trust           → sosTrusted
                 A family member, a friend, or your  → sosTrustedDetail        (no link)
                 unit's welfare officer.
────────────────────────────────────────
[        Continue assessment        ]                52px full-width primary   → sosContinue
```

Two calls worth defending. **(a) Real numbers.** The instinct not to invent a crisis line is right,
but the conclusion was wrong: 112, 14416 (Tele-MANAS, Government of India) and 1800-599-0019 (KIRAN,
MoSJE) are real, national, free and 24×7. Naming them is not inventing a referral. Expose them as one
exported `SUPPORT_CONTACTS` constant so a deployment can add its own number as data, not a code change.
**(b) One button, not two.** `Continue assessment` promises the return, which is what someone
hesitating to open the sheet needs to know before they tap. There is only one thing to do here.

**Behaviour — hard requirements:** the sheet is a sibling of the stage and **never unmounts
`QuestionStage`**. Opening it cancels any pending auto-advance timer and pauses narration (which does
not resume on close). On close, focus returns to the trigger and the respondent is on exactly the
question they left — no lost position, no re-narration, no re-fired autoplay. Hoist the dialog state
above the keyed question wrapper.

## G.8 Review — *nothing is hidden from you, and nothing is withheld from you*

```
  Before you send this                                    → reviewTitle (recopy, warmer)
  You can change any answer before submitting.

            ╭─────────╮
            │   87%   │        128px SVG ring, stroke 8, track --text-primary/.08, fill --primary
            ╰─────────╯        numeral 32px/600 tabular centred          → estimatedCompletion
             134 of 154

  ┌──────────┬──────────┬──────────┐
  │ Completed│ Skipped  │ Not seen │   three 88px tiles, radius 20, 13px eyebrow + 22px tabular
  │   134    │    12    │     8    │   --success / --warning / --text-tertiary
  └──────────┴──────────┴──────────┘

  ── Questions you skipped ─────────────────────  15px/600  + [ 20 ] chip
  72px rows, hairline dividers:
   [23]  How often are you short of sleep…        15px, 2-line clamp
         Skipped                       [ Answer now ]   40px pill, bg primary/.08, 13px
  …
  [  Answer these 20 now  ]                       52px secondary button   → answerRemainingNote

  ▸ Show all 154 answers                          56px collapsed disclosure → reviewAllAnswers

  ┌─ sticky action bar ─────────────────────────────────────┐
  │ ← Back                          [ Submit my answers ]   │
  └─────────────────────────────────────────────────────────┘
```

- **Skipped vs Not seen** is a real distinction the data already carries (`AnswerMeta.skipped`) and it
  changes how the row reads. Surface it. This is the honest version and it comes free.
- The pending group is **first**, above the full list — this is the brief's "skipped items are
  surfaced with a per-question Answer now".
- The full list is **collapsed by default**. Always-expanded, 154 rows is a ~12,000px scroll that
  buries Submit. Expanded rows carry `content-visibility: auto; contain-intrinsic-size: 0 84px` —
  virtualisation for free, correct scrollbar, zero new dependencies.
- **Review-return mode — mandatory, and the single best UX catch in the whole spec.** Tapping
  `Answer now` opens that question with a 13px bar above the action bar reading `answeringFromReview`
  + a `backToReview` link, and answering it returns to **review** after the dwell instead of advancing
  to the next question. Without this, "Answer now" dumps the respondent back into the linear flow at
  item 23 — the most disorienting moment in the current design. `Answer these 20 now` walks the pending
  set in order and returns to review at the end of it.
- **The primary button is always `submitAssessment` — "Submit my answers".** The current build swaps it
  to "Answer 6 remaining", which makes submission feel blocked; that is the exact opposite of the
  brief. Nothing blocks. Ever.
- A confirmation sheet appears **only when > 20%** of items are unanswered:
  > **34 questions are still blank.**
  > You can send your answers as they are.
  > `[ Submit anyway ]` (primary) · `[ Answer them first ]` (ghost)

  Never a blocking alert, never a `window.confirm`.
- Under Submit, 13px `--text-tertiary`: `submitFinalNote` — *"Once you send this, it can't be changed."*
  Said before, not after.
- Ring animates `pathLength 0 → completion` over 900ms `EASE_EMPH`, +120ms. The completion ring is the
  only place a big number belongs in this product.

## G.9 Thank-you — *it is received, and it mattered*

- **Replace the green `CheckCircle2`.** A green tick is a form's success state and this is not a form.
  Instead: **three concentric rings**, 120px total, `stroke: hsl(var(--primary) / .55 · .35 · .20)`,
  `strokeWidth 2`, drawn `pathLength 0→1` over 900ms with a 120ms stagger, outermost first. Then they
  hold. It reads as something settling, not something passing. **It runs once and never loops** — a
  looping animation on a completion screen is anxious. No confetti, ever.
- `h1.t-hero` `thankYou`; `thankYouBody` 16px/1.65, max 42ch, `--text-secondary`.
- One line acknowledging the cost, not just thanking for it: `timeSpentNote` — *"You spent 22 minutes
  with this."*, derived from `startedAt`. 15px `--text-secondary`.
- `submissionSecure` — *"Your responses have been securely submitted."*
- A two-row `.rule-list`:
  `Reference ID` → `1A2B-3C4D-5E6F` at 22px, tabular, `letter-spacing .08em`, with a 44px `Copy`
  button beside it (a phone-line reference that cannot be copied is a transcription error waiting to
  happen) · `Submitted on` → `21 July 2026, 4:12 pm`.
- 52px outline button → `window.print()`. **The print acknowledgement sheet must survive verbatim.**
- 44px text button `returnHome`.
- The rail here returns to the full identity bar. This is the screen a family may photograph.
- **Nothing else.** No share, no retake, no score, no summary, no "how was this?". The screen ends.

---

# H. COPY — every new string, English final

All Telugu must be authored in respectful, plain, non-clinical Telugu an elderly reader can follow —
**never a literal machine gloss.** Every key below goes in `dict` in `src/lib/i18n.ts`.

### Progress & chrome
| key | English |
|---|---|
| `percentComplete` | {n}% complete |
| `questionNumberOnly` | Question {n} |
| `timeLeftLabel` | Estimated time left |
| `partXofY` | Part {i} of {n} |
| `countOfTotal` | {i} of {n} |
| `progressSpoken` | Question {i} of {n}, {p} percent answered |
| `sectionAndCount` | {title} · {i} of {n} |

### Skip / pending
| key | English |
|---|---|
| `skipForNow` | Skip for now |
| `skippedLabel` | Skipped |
| `pendingLabel` | Pending |
| `notSeenLabel` | Not seen |
| `nQuestionsLeft` | {n} questions left |
| `oneQuestionLeft` | 1 question left |
| `answerNow` | Answer now |
| `submitAnyway` | Submit anyway |
| `reviewSkipped` | Review skipped questions |
| `nothingSkipped` | You have answered everything. |
| `skippedNote` | You can come back to these before submitting. |
| `answeringFromReview` | Answering from review |
| `backToReview` | Back to review |
| `answerRemainingNote` | Answer these {n} now |
| `blanksRemainTitle` | {n} questions are still blank. |
| `blanksRemainBody` | You can send your answers as they are. |
| `answerThemFirst` | Answer them first |

### Review
| key | English |
|---|---|
| `assessmentSummary` | Assessment summary |
| `completedLabel` | Completed |
| `estimatedCompletion` | Estimated completion |
| `submitAssessment` | Submit my answers |
| `reviewAllAnswers` | Show all {n} answers |
| `hideAllAnswers` | Hide all answers |
| `submitFinalNote` | Once you send this, it can't be changed. |

### Encouragement
| key | English |
|---|---|
| `encourageStart` | You're doing well. |
| `encourageQuarter` | Every answer matters. |
| `encourageHalfway` | Halfway there. |
| `encourageThreeQuarter` | Thank you for your patience. |
| `encourageNearlyDone` | Almost finished. |

### Support
| key | English |
|---|---|
| `supportButtonLabel` | Need support? |
| `sosTitle` | You are not alone |
| `sosBody` | If answering these questions feels difficult, please remember that support is available. You can pause at any time. |
| `sosMentalHealth` | Mental health support |
| `sosMentalHealthDetail` | Tele-MANAS · 14416 · free, 24×7, in Telugu and English |
| `sosKiran` | KIRAN helpline |
| `sosKiranDetail` | 1800-599-0019 · free, 24×7 |
| `sosEmergency` | Emergency |
| `sosEmergencyDetail` | 112 |
| `sosTrusted` | Talk to someone you trust |
| `sosTrustedDetail` | A family member, a friend, or your unit's welfare officer. |
| `sosContinue` | Continue assessment |
| `sosCall` | Call |

### Sections
| key | English |
|---|---|
| `sectionAhead` | Coming up |
| `sectionQuestionCount` | {n} questions |
| `sectionAboutMinutes` | About {n} minutes |
| `sectionContinue` | Continue |
| `sectionProgressNote` | You're {n}% through. |

### Section fallback titles (used only when `title_en` is blank — never an instrument name)
| key | English |
|---|---|
| `sectionFallbackFamily` | How things are at home |
| `sectionFallbackEmpathy` | Understanding others |
| `sectionFallbackHope` | Looking ahead |
| `sectionFallbackWellbeing` | Rest and daily life |
| `sectionFallbackDepression` | When things feel heavy |
| `sectionFallbackStress` | Pressure and coping |
| `sectionFallbackAnger` | Everyday reactions |
| `sectionFallbackInternet` | Time online |
| `sectionFallbackNeutral` | A few more questions |

### Category chip labels (`categoryLabelKey`)
`catFamily` Home life · `catEmpathy` Understanding others · `catHope` Looking ahead ·
`catWellbeing` Daily life · `catDepression` How you've been feeling · `catStress` Pressure ·
`catAnger` Everyday reactions · `catInternet` Time online · *(neutral → `null`)*

### Answer surfaces
| key | English |
|---|---|
| `tapToChoose` | Tap an answer to continue |
| `chooseAllThatApply` | Choose all that apply |
| `chooseOne` | Choose one |
| `writeYourAnswer` | Write your answer |
| `yourWordsMatter` | There are no right or wrong answers. |
| `clearSelection` | Clear |
| `nSelected` | {n} selected |
| `noneSelectedFine` | None selected — that's fine |
| `doneChoosing` | Done |
| `noMatches` | No matches |
| `moreChoicesBelow` | {n} more choices below |
| `ratingLow` | Not at all |
| `ratingHigh` | A great deal |
| `ratingOfFive` | {n} of 5 |
| `textPlaceholderExample` | For example, a few words about how things have been |
| `writeAsMuchAsYouLike` | Write as much or as little as you like |

### Stems
| key | English |
|---|---|
| `stemDescribe` | How well does this describe you? |
| `stemFrequency` | Over the last while, how often? |
| `stemTruth` | How true is this for you? |
| `stemAgreement` | How much do you agree? |
| `stemBinary` | Yes or no? |
| `stemStatement` | Choose the sentence closest to how you have been feeling. |
| `stemRating` | Where would you put it? |
| `stemWords` | In your own words. |

### Intro / completion
| key | English |
|---|---|
| `welcomeEyebrow` *(recopy)* | A private conversation about how you are |
| `resumeBodyCount` | You answered {a} of {n} questions on {d}. |
| `consentTickFirst` | Please tick this to continue. |
| `consentNothingSent` | You can stop at any time, and nothing is sent until you press Submit. |
| `instructionSkip` | If a question doesn't apply to you, you can move past it. Nothing is required. |
| `startWithSection` | Start · {title} |
| `startWithQuestionOne` | Start — question 1 of {n} |
| `returnHome` | Return home |
| `submissionSecure` | Your responses have been securely submitted. |
| `timeSpentNote` | You spent {n} minutes with this. |
| `copyReference` | Copy reference |

### Translation
| key | English |
|---|---|
| `autoTranslated` | Translated automatically |

### Voice
| key | English |
|---|---|
| `voiceStop` | Stop |
| `voiceReplay` | Replay |
| `voiceSpeed` | Speed |

**Removed from the respondent route:** `requiredAnswer` and every use of the word "Required".

---

# I. ACCESSIBILITY CONTRACT

## I.1 Roles and names

| element | role / semantics |
|---|---|
| single-select stack | `role="radiogroup"` with `aria-label` = the rendered prompt; children `role="radio"` + `aria-checked` |
| checkbox stack | `role="group"`; children `role="checkbox"` + `aria-checked` |
| `rating5` capsules | `role="radiogroup"`; each capsule `role="radio"`, `aria-checked`, `aria-label={t("ratingOfFive",{n})}` |
| dropdown trigger | `<button aria-haspopup="dialog" aria-expanded>`; sheet is a Radix `Dialog` with `aria-label` = the prompt |
| progress bar | `role="progressbar"` + `aria-valuemin/max/now/valuetext` (§C.4) |
| spine, nodes, rail fill, ScaleMeter, emoji, ink wipe, tick | **`aria-hidden`** — the option's text label is the accessible name |
| numeric-anchored bare rows (D.1b) | the card's accessible name is the **full authored anchor** (`"2"`), never empty |
| section chip / eyebrow | plain text, not a heading |
| the prompt | `<h1 tabIndex={-1}>` — one `h1` per screen |

## I.2 Focus

- On every question change, focus moves to the `h1` (`focus({ preventScroll: true })`). Without it a
  keyboard/screen-reader user is left on the Next button of a question that no longer exists.
- Focus order: `h1` → Listen → answer options (in stored order) → skip line → Previous → Next →
  support button. The rail's LangToggle precedes `h1` in DOM order.
- Every dialog/sheet traps focus and returns it to its trigger on close (Radix default; verify for the
  dropdown sheet and the support sheet).
- **The support sheet must not remount the question stage** (§G.7).
- `:focus-visible` only — never `:focus`. Focus rings are 3px at `hsl(var(--focus-ring)/0.45)` with a
  2px canvas offset, and are **never** replaced by a transform.

## I.3 Live regions

| region | politeness | content |
|---|---|---|
| "Saved" chip | `polite` | `saved` |
| encouragement slot in the rail | `polite`, `role="status"` | one sentence, announced once |
| checkbox count chip | `polite` | `nSelected` / `noneSelectedFine` |
| `rating5` value line | `polite` | `ratingOfFive` |
| text counters | `polite`, throttled | `charactersLeft` |
| submit error toast | `assertive` | existing behaviour, unchanged |

Nothing else on the route is a live region. In particular the progress rail's numbers are
`aria-hidden` and are carried by `aria-valuetext` instead.

## I.4 Keyboard model

Universal: `Tab` / `Shift+Tab` traverse; `Enter` / `Space` activate.

| key | action | guard |
|---|---|---|
| `ArrowRight` / `ArrowLeft` | next / previous question | **only when focus is not on an interactive control.** Preserve the existing `closest('input, textarea, select, button, a, [role="radio"], [role="checkbox"], [contenteditable="true"]')` guard and extend it to the new keys. |
| `ArrowUp` / `ArrowDown` | move between options within a radiogroup | standard roving tabindex |
| `Home` / `End` | first / last option | `rating5`, radiogroups |
| `1`–`9` | select the nth option | **desktop only** (`pointer: fine`) |
| `Y` / `N` | yes / no | desktop only, `yes_no` only |
| `Enter` | Next | when focus is on the page, not in a `long_text` |
| `S` | skip | desktop only |
| `L` | Listen / pause | desktop only |
| `Escape` | close a sheet | always |

**Desktop keyboard hints are earned, never decorative.** After the first `Tab`, arrow, or digit press,
a 20px tertiary numeral chip fades into each card's leading edge and a 12px line appears in the action
bar: `↑ ↓ to choose · ↵ to continue`. Never shown before a key is pressed. Never rendered on coarse
pointers. Hiding it until earned is what keeps this from looking like Typeform.

## I.5 Contrast floors

| pairing | minimum | note |
|---|---|---|
| prompt on canvas | 12:1 | `#1C1C1E` on `#F6F5F1` = 15.8:1, and the wash cannot change it (§A.1) |
| option label on card (rest **and** selected) | 7:1 | weight never changes, colour never changes |
| quietened sibling label | **4.5:1** | this is why siblings colour-shift rather than fade; opacity fading lands at 3.6:1 and fails |
| `--text-tertiary` chrome (rail meta, skip line, captions) | 4.5:1 | `#9A9AA3` on canvas is 3.4:1 → **rail meta and the skip line must use `--text-secondary` (#5C5C66, 6.4:1) at ≤ 13px.** `--text-tertiary` is permitted only at ≥ 15px or for non-text decoration. |
| ghost `Next` border | 3:1 | `1.5px --text-secondary` = 6.6:1 |
| card border at rest | 3:1 | `--border-strong` is below 3:1 on its own, so the card's identity is carried by its **shadow + fill**, and `pref-high-contrast` raises `--border-strong` to `240 8% 45%` (4.9:1) |
| focus ring | 3:1 vs both card and canvas | `--primary` at 0.45 over canvas = 3.4:1 |
| atmosphere wash | must not change any of the above | guaranteed by pinning `--atmo-l` and both alphas |

## I.6 Elderly-first floors, non-negotiable

- Minimum tap target **44 × 44** anywhere; answer cards are ≥ 56px tall and full-width.
- Minimum body text **15px**; minimum option label **16px**; minimum input text **18px**.
- `html.pref-large-text` (118%) must not break any layout in this spec — every prompt class and card
  height is rem/clamp-derived or has an explicit overflow story (§B.7).
- `html.pref-high-contrast` disables sibling quietening, the ruled-line decoration, and drops the wash
  to 0.05.
- Nothing on this route is conveyed by colour alone: selection is card fill + border + node + drawn
  tick + `aria-checked`.

---

# J. IMPLEMENTATION NOTES PER FILE

**The locked module contracts in the brief are authoritative.** Required props and exports below match
them exactly. Optional additions are marked and exist to preserve behaviour that must not regress.

### `index.html`
Noto Sans Telugu in the existing stylesheet request; `viewport-fit=cover` +
`interactive-widget=resizes-content` on the viewport meta. **No `user-scalable=no`.** (§0)

### `src/index.css`
All of §A. The `.t-question` replacement family, `html.lang-te`, `.atmo-*`, `.atmo-wash`,
`.answer-card`, `.spine-*`, `.answer-line`, `.rule-list`, the four keyframes, and every new token.
**No component may introduce a value that is not defined here.**

### `tailwind.config.ts`
§A.7 only. Do not touch `future.hoverOnlyWhenSupported` — it is what stops a lifted card staying
transformed after a tap.

### `src/lib/questionCategory.ts` — NEW
```ts
export type QuestionCategory =
  | "family" | "empathy" | "hope" | "depression" | "internet"
  | "wellbeing" | "stress" | "anger" | "neutral";
export function categorizeQuestion(q: SurveyQuestion): QuestionCategory;
export function categoryClass(c: QuestionCategory): string;              // "atmo-depression"
export function categoryLabelKey(c: QuestionCategory): DictKey | null;
```
Additional exports permitted and expected:
`categorizeSection(section, questions): QuestionCategory` (the real workhorse — §E.1),
`categoryIcon(c): LucideIcon`, `categoryFallbackTitleKey(c): DictKey`.
Requires `export type DictKey = keyof typeof dict;` from `src/lib/i18n.ts`.
Memoise per `section_id`. This module **imports** `classifyDomain` from `answerVisuals.ts` and must not
modify it.

### `src/lib/translate.ts` — NEW
```ts
export async function translateBatch(texts: string[]): Promise<(string | null)[]>;
export function useAutoTelugu(texts: string[]): Record<string, string>;   // en -> te
export function cachedTelugu(en: string): string | null;
```
- Cache in `localStorage` under `jix:te:v1`, `{ [en]: te }`, with the same 30-day max age as the draft
  store, and the same fail-silent try/catch shape used throughout `assessmentSession.ts`.
- **No new npm dependency.** `translateBatch` posts to a Supabase edge function when one is configured
  and otherwise resolves `texts.map(() => null)` — a miss returns `null` and every caller falls back
  to English. Never throw; never block a render.
- `useAutoTelugu` reads the cache synchronously, fires one batched request for misses on mount, and
  returns only what it has. Callers show `autoTranslated` **only** for strings that came from this
  module, never for authored `label_te`.

### `src/lib/surveys.ts`
`PublicSurveyState`'s `"open"` variant gains `sections: SurveySection[]`:
```ts
| { kind: "open"; survey: Survey; questions: SurveyQuestion[]; sections: SurveySection[] }
```
`getPublicSurvey` becomes
`const [questions, sections] = await Promise.all([loadQuestions(survey.id), listSections(survey.id)]);`
`listSections` already exists. **Verify the anon-role RLS policy on `survey_sections` permits reading
sections of a `published` survey** — that belongs in the pending
`20260718100000_tighten_public_read_rls.sql` migration. If the policy is missing, the interstitial
silently disappears and nothing else breaks; ship the migration.
Nothing else in this file changes. `submitSurveyResponse` and every stored answer shape are untouched.

### `src/lib/assessmentSession.ts` — extend, every existing export keeps working
```ts
export type Stage = "welcome" | "consent" | "instructions" | "section" | "questions" | "review" | "done";

export interface SessionSnapshot {
  v: 2;
  answers: Record<string, AnswerValue>;
  meta?: Record<string, AnswerMeta>;
  index: number;
  stage: Stage;
  consented: boolean;
  startedAt: string;
  updatedAt: string;
  skipped: string[];
}

export function completionPercent(questions, answers): number;   // 0..100, rounded
export function pendingQuestions(questions, answers, skipped): { question: SurveyQuestion; index: number }[];
export interface SectionRun { section: SurveySection | null; startIndex: number; questionCount: number; seconds: number; }
export function planSections(questions: SurveyQuestion[], sections: SurveySection[]): SectionRun[];
export function sectionRunAt(runs: SectionRun[], index: number): SectionRun | null;
```
- **`loadSession` must MIGRATE a `v:1` draft, not discard it.** `{ ...parsed, v: 2, skipped: [] }`. A
  family mid-assessment must never lose their answers to a schema bump.
- `planSections` groups by `section_id` **in question order**, emits a `SectionRun` per contiguous run,
  and puts `section_id === null` questions in a run with `section: null` (which never gets an
  interstitial). `seconds` uses the existing `estimateSeconds`.
- Do not change `SECONDS_BY_KIND`, `remainingSeconds`, `minutesFromSeconds`, `isAnswered`,
  `countAnswered`, `firstUnansweredIndex`, `formatReferenceId`, or the submission-record shape.
  `unansweredQuestions` and `completionRatio` stay exported — `ReviewStage` and the tests use them.

### `src/lib/i18n.ts`
Every key in §H, bilingual. Export `DictKey`. Write `document.documentElement.lang` and the
`lang-te` class from the store, outside React, before first paint (§0.4). Admin pages stay English —
do not touch any admin key.

### `src/lib/answerVisuals.ts`
**No behavioural change. The clinical rule stands exactly as written.** The spine/node geometry is a
display elevation of the neutral ramp, not a relaxation of the rule. Faces still only where the domain
is emotive and the count is 3–7; `behaviour`, `generic` frequency/truth/description, `binary` and
unordered sets never get faces. Optionally add `export function isNumericAnchored(labelsEn: string[]): boolean`
(D.1b) here, since it is a scale-shape question and belongs beside `classifyScale`.

### `src/lib/voice.ts`
Extend only; do not rewrite. `useNarrator`, `useVoiceSettings`, `VOICE_RATES`, `chunkText`, the
`voiceschanged` cache, the Chrome 15s chunking, the Android `pause()` fallback and the 8s heartbeat all
stay. Add nothing but a `stop()` surface if one is not already exported.

### `src/components/assessment/AssessmentShell.tsx`
```ts
export function AssessmentShell(props: {
  children: ReactNode; progress?: ReactNode; footer?: ReactNode;
  center?: boolean;                 // default true
  atmosphere?: QuestionCategory;    // default "neutral"
  showSupport?: boolean;            // default true
}): JSX.Element;
export function AssessmentFooter(props: { children: ReactNode }): JSX.Element;
```
- Renders the two stacked `.atmo-wash` layers and owns the cross-fade; applies `categoryClass()` to the
  stage root.
- Two skeletons behind one component: the **question skeleton** (§B.1, `100dvh` grid, single internal
  scroller, 56px rail, `--kb` handling, `--col-question`) when a `progress` node is supplied, and the
  **reading skeleton** (`--col-reading`, centred, document flow) otherwise.
- Keeps the existing mount-focus behaviour on the stage heading.
- `AssessmentFooter` keeps `bottom-nav-safe` and adds `transform: translateY(calc(-1 * var(--kb)))`.

### `src/components/assessment/ProgressRail.tsx` — NEW
```ts
export function ProgressRail(props: {
  index: number; total: number; secondsLeft: number; sectionTitle?: string | null;
}): JSX.Element;
```
§C in full. Optional additions: `answeredCount`, `sectionBoundaries: number[]` (for the notches),
`encouragement?: string | null` (the slot that replaces line 2). Since `completion` needs
`answeredCount`, add it as an optional prop defaulting to `index` and pass it from `QuestionStage`.

### `src/components/assessment/ScaleMeter.tsx`
Keeps `{ level, total, active }` and gains `variant?: "node" | "bars"` (default `"node"`). `"node"` is
the 28px disc with the vertical clip-path fill (D.0.3); `"bars"` is the existing ramp, retained for
any non-spine use. Stays `aria-hidden`.

### `src/components/assessment/AnswerCards.tsx`
```ts
export function AnswerCards(props: {
  question: SurveyQuestion; mode: LangMode; value: AnswerValue;
  onChange: (v: AnswerValue) => void; onCommit?: () => void;
}): JSX.Element;
export function describeAnswer(q: SurveyQuestion, v: AnswerValue, mode: LangMode): string | null;
```
- **`describeAnswer`'s export and signature are load-bearing** — `ReviewStage` and the exports depend
  on it. Do not touch it.
- `onCommit` semantics unchanged: first-answer-by-tap only, never a correction.
- Implement §D.0 through §D.8. `LIKERT_LABELS` stays exactly as authored.
- `React.memo` on `(question.id, value, mode)`.
- Stored values unchanged for all eight kinds. Option order and ids are the instrument's.

### `src/components/assessment/QuestionStage.tsx`
```ts
export function QuestionStage(props: {
  questions: SurveyQuestion[]; index: number; answers: Record<string, AnswerValue>;
  skipped: Set<string>; mode: LangMode; sectionTitle?: string | null;
  onAnswer: (id: string, v: AnswerValue) => void;
  onSkip: (id: string) => void;
  onNavigate: (nextIndex: number) => void;
  onBackToIntro: () => void;
  onReview: () => void;
}): JSX.Element;
```
Plus these **optional** props, which must be kept and kept wired — the metadata they capture is on the
protected list: `meta?: Record<string, AnswerMeta>`, `onDwell?: (id, seconds) => void`,
`onVoice?: (id) => void`, `answeredCount?: number`, `sectionBoundaries?: number[]`,
`returnToReview?: boolean`, `onBackToReview?: () => void`.

Changes: rail composition (§B.4); progress = `countAnswered / total` via `scaleX` (§C); the stem line
(§D.0.2) prepended to `narrationText`; skip moved out of the footer into the answer region (§D.9.1);
overflow detection + sticky prompt + "more below" (§B.7); the `sameSurfaceAsPrevious` ref (§D.0.4);
the encouragement scheduler (§G.6) including the mandatory distress gate; auto-advance cancelled while
narration is speaking **and** while the support sheet is open; `window.scrollTo` → `mainRef.scrollTo`.

**Keep the keyed remount.** Do not introduce `AnimatePresence mode="wait"` — the existing comment about
it adding lag is correct, and the whole 150ms budget depends on a zero-cost exit.
**Keep the arrow-key focus guard** and extend it to the new desktop keys.
**Keep the dwell clock** and its 900s cap.

### `src/components/assessment/SectionTransition.tsx` — NEW
```ts
export function SectionTransition(props: {
  title: string; description?: string | null; questionCount: number; minutes: number;
  index: number; total: number;
  onContinue: () => void; onBack: () => void;
}): JSX.Element;
```
§G.4. Optional: `category?: QuestionCategory`, `percentThrough?: number`.

### `src/components/assessment/Encouragement.tsx` — NEW
```ts
export function Encouragement(props: { index: number; total: number }): JSX.Element | null;
```
Returns `null` on most questions — at most five moments across an entire run. §G.6. Optional props for
the suppression gate: `lastAnswerLevel?: number | null`, `lastAnswerTotal?: number | null`,
`lastPromptEn?: string`, `lastOptionLabelEn?: string | null`, `justSkipped?: boolean`,
`afterSection?: boolean`. **The distress gate is inside this component, not at the call site**, so it
cannot be forgotten.

### `src/components/assessment/SupportSheet.tsx` — NEW
```ts
export function SupportButton(): JSX.Element;   // self-contained: button + its own sheet
```
§G.7. Also `export const SUPPORT_CONTACTS`. Replaces `SupportButton.tsx` (delete the old file, or keep
it as a re-export for one release). The `raised` prop is gone — position is derived from whether the
shell rendered a footer, via context or a data attribute on the stage root.

### `src/components/assessment/VoiceControl.tsx`
```ts
export function VoiceControl(props: { text: string; resetKey: string; compact?: boolean }): JSX.Element;
```
Keep the existing optional `onSpoken`. Collapsed: 44px circle (< 375px) or a 44px labelled pill.
Expanded: grows in place over 220ms revealing `Pause`/`Play` · `RotateCcw` replay · **`X` stop (missing
today, required by the brief)** · the existing speed popover. Collapses 3s after narration ends or
immediately on stop. While expanded at < 640px, the rail's two text lines hide.

### `src/components/assessment/ReviewStage.tsx`
```ts
export function ReviewStage(props: {
  questions: SurveyQuestion[]; answers: Record<string, AnswerValue>; skipped: Set<string>;
  mode: LangMode; submitting: boolean;
  onEdit: (index: number) => void; onBack: () => void; onSubmit: () => void;
}): JSX.Element;
```
§G.8. Keeps `describeAnswer` and `emojiForAnswer`. `onEdit` now enters review-return mode — the
runner sets a flag so answering returns to review.

### `src/components/assessment/IntroStages.tsx`
Signatures unchanged:
`WelcomeStage({ survey, mode, minutes, questionCount, canResume, onBegin, onResume, onStartOver })`,
`ConsentStage({ onAgree, onBack })`, `InstructionsStage({ onStart, onBack })`.
Add optional `answeredCount?`, `lastUpdatedAt?` to `WelcomeStage` for `resumeBodyCount`, and optional
`firstSectionTitle?` to `InstructionsStage` for `startWithSection`. §G.1–G.3.

### `src/components/assessment/ThankYouStage.tsx`
`ThankYouStage({ survey, mode, referenceId, submittedAt })` unchanged; optional `minutesSpent?`.
§G.9. **The print acknowledgement sheet must survive verbatim.**

### `src/pages/public/SurveyRunner.tsx`
Route `"section"` in the stage machine; pass `sections` through; own the `Set<string>` of seen
sections; own `skipped: Set<string>` and persist it in the v:2 snapshot; own review-return mode. The
local `StatusScreen` for `not_found` / `closed` / `error` is unchanged.

---

## PROTECTED — do not break, do not touch

Stored answer values for all eight kinds · the frozen `question_kind` enum (8 values, no additions) ·
`answerVisuals.ts` classification, ramps and the clinical rule · `emojiForAnswer`'s capture-at-choice
behaviour and everything it writes into `AnswerMeta` · `describeAnswer`'s signature and export ·
`narrationText`'s prompt-then-every-option ordering · `voice.ts` · autosave and resume · the
duplicate-submit guard · `trackSurveyView` · `formatReferenceId` · the print acknowledgement ·
`RatingStars` for the admin preview · the admin console staying English.

TypeScript strict throughout — no `any`, no `@ts-ignore`. Comments explain **why** a non-obvious
decision was made, never what the line does.
