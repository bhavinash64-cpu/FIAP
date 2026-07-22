# PsyDigiHealth — Design System Overhaul Plan

Goal: one unified, tight, editorial design language across every screen — Apple / Linear /
Stripe / Notion / Cred calm. Every visual value comes from tokens. Calibrated to the
`HostelX` reference (small radii 10–16px, compact type, one indigo accent).

Source of truth: `src/index.css` (`:root` tokens) → `tailwind.config.ts` (theme map).

---

## ✅ Phase 1 — Token system (DONE)
- **Radius:** control **10** · field **12** · surface **16** · nav **14** · pill 999
  (was 14/20/28 — far less round)
- **Type scale:** display 56 · hero 40 · title **28** · section **20** · card **16** ·
  body **15** · caption 13 · eyebrow 12  (one scale, every page)
- **Color:** warm canvas `#F6F5F1`, one indigo accent, desaturated status
- **Shadows:** sm (cards) · md (hover) · float (overlays) + lit-edge highlight
- **Motion:** ease-out/in-out/spring · 140/220/380ms · respects reduced-motion

## ✅ Phase 2 — Primitives + consistency (DONE)
- Button (44px, 550, lit edge), Input/Textarea (soft wells, indigo focus),
  Card (**p-24**, radius 16, lit shadow), Badge (pill + status tints), Switch/Checkbox/
  Radio, Skeleton (shimmer), Tooltip/Popover/Dialog (float)
- **One page header everywhere:** `eyebrow + 28px sans title` on Overview, Question Bank,
  Analytics, Responses, Reports, Settings (serif reserved for Login/Landing)
- Every hardcoded `p-8` card → `p-6`

## ✅ Phase 3 — Sidebar + Login (DONE)
- **Sidebar:** attached (flush, no corner radius), collapse toggle, tabs fixed in place,
  content flush (no gap / no overlap)
- **Login:** split **2.9 : 1.1** (image ≈ 72.5% / login ≈ 27.5%, login min 460px so the
  form never breaks); illustration **fills the left panel edge-to-edge** (`object-cover`)
  with the editorial text on a legibility scrim; person-icon avatar; card p-6, radius 16

---

## ▶ Phase 4 — Two open decisions (NEED YOUR CALL)
1. **Language switcher** — keep `తెలుగు / English` pill, or swap to `🌐 English ▾` dropdown?
2. **"Access restricted"** — fix the Supabase role so `sindhuv.code@gmail.com` opens `/app`?

## ▶ Phase 5 — Deep per-page pass (PROPOSED — say "go Phase 5")
Screen by screen, pixel consistency:
1. Survey Builder — form rhythm, section hierarchy, sticky toolbar
2. Question Bank — instrument list + question rows density
3. Responses — collection rows, empty state
4. Analytics + Survey Analytics — KPI tiles, chart polish (one indigo ramp)
5. Reports + Survey Report — reading/print surface
6. Settings — grouped setting rows
7. Final optimize/dedupe sweep + full self-check (0 raw hex, 0 off-family radius) + build

---

### How to review
Hard-refresh (Ctrl+Shift+R) after each phase to clear the cached bundle.

### Verification gates (every phase)
`tsc --noEmit` · `eslint .` · `vite build` · self-check greps (hex / radius / font-size).
