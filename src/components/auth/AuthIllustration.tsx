import type { CSSProperties } from "react";

/*  ───────────────────────────────────────────────────────────────────────
    Jeevana Insight — sign-in illustration.

    A single cohesive sculpture: three floating survey/analytics/profile cards
    resting above a tiered ceramic pedestal, tied together by faint
    constellation lines and a few slow orbital particles. Everything sits inside
    one invisible ~700px circle and shares one perspective — nothing floats on
    its own.

    Built entirely in markup so every corner, shadow and gap is intentional and
    resolution-independent. All values come from the page's approved systems
    (spacing 4/8/12/16/24/32/48; radii 8/12/16/20/28/32/36; one purple palette;
    one shadow language). Motion is calm and driven by the authFloat/authOrbit
    keyframes in index.css, which the global reduced-motion rule freezes.
    ─────────────────────────────────────────────────────────────────────── */

const PALETTE = {
  primary: "#5E43F3",
  secondary: "#7B61FF",
  accent: "#A78BFA",
  highlight: "#EDE9FE",
  line: "#8F84FF",
  card: "rgba(255, 255, 255, 0.94)",
};

/** One shadow language — a single soft, purple-tinted cast at three depths. */
const SHADOW = {
  main: "0 40px 120px rgba(95, 70, 255, 0.10)",
  analytics: "0 32px 80px rgba(95, 70, 255, 0.08)",
  profile: "0 28px 70px rgba(95, 70, 255, 0.08)",
};

const HAIRLINE = "1px solid rgba(255, 255, 255, 0.70)";

/** A soft placeholder bar — the illustration's stand-in for text. */
function Bar({ w, h = 8, tone = "ink", style }: { w: number | string; h?: number; tone?: "ink" | "faint" | "primary"; style?: CSSProperties }) {
  const bg =
    tone === "primary"
      ? "rgba(94, 67, 243, 0.55)"
      : tone === "faint"
        ? "rgba(46, 42, 69, 0.08)"
        : "rgba(46, 42, 69, 0.16)";
  return <span style={{ display: "block", width: w, height: h, borderRadius: 8, background: bg, ...style }} />;
}

/** One tier of the ceramic pedestal: a matte disc with a thin shaded rim. */
function Platform({ w, thickness, top }: { w: number; thickness: number; top: number }) {
  const h = Math.round(w * 0.26);
  const left = (560 - w) / 2;
  return (
    <>
      {/* Rim / thickness — a darker disc peeking below the face. */}
      <div
        style={{
          position: "absolute",
          left,
          top: top + thickness,
          width: w,
          height: h,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #E4DFF7 0%, #D9D3F0 100%)",
        }}
      />
      {/* Matte face — soft ceramic with a faint purple ambient wash. */}
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: w,
          height: h,
          borderRadius: "50%",
          background:
            "radial-gradient(120% 150% at 42% 25%, #FFFFFF 0%, #F4F2FC 55%, #ECE8FA 100%)",
          boxShadow: "inset 0 2px 6px rgba(255,255,255,0.9), inset 0 -6px 14px rgba(94,67,243,0.05)",
        }}
      />
    </>
  );
}

/** A slow-orbiting particle. The outer ring spins; the dot rides its radius. */
function Particle({
  cx,
  cy,
  radius,
  size,
  opacity,
  duration,
  delay = 0,
}: {
  cx: number;
  cy: number;
  radius: number;
  size: number;
  opacity: number;
  duration: number;
  delay?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        width: 0,
        height: 0,
        animation: `authOrbit ${duration}s linear ${delay}s infinite`,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: radius,
          top: 0,
          width: size,
          height: size,
          borderRadius: "50%",
          background: PALETTE.secondary,
          opacity,
        }}
      />
    </div>
  );
}

/** A floating wrapper: gentle vertical drift with a per-card amplitude/rhythm. */
function Float({
  amp,
  duration,
  delay,
  children,
  style,
}: {
  amp: number;
  duration: number;
  delay: number;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  // `--amp` feeds the shared authFloat keyframe (index.css); custom properties
  // need the cast to satisfy CSSProperties.
  const floatStyle = {
    position: "absolute",
    "--amp": `${amp}px`,
    // Per-wrapper perspective so each card's rotateX/Y is a real foreshortened
    // tilt (shared angle across all three), not a flat skew.
    perspective: 1600,
    animation: `authFloat ${duration}s ease-in-out ${delay}s infinite`,
    ...style,
  } as CSSProperties;
  return <div style={floatStyle}>{children}</div>;
}

export function AuthIllustration() {
  // Anchor points (card centres) for the constellation lines, in stage space.
  const MAIN = { x: 280, y: 266 };
  const ANALYTICS = { x: 420, y: 112 };
  const PROFILE = { x: 132, y: 442 };

  return (
    <div
      aria-hidden
      className="pointer-events-none relative select-none"
      style={{ width: 560, height: 600, perspective: 1600 }}
    >
      {/* Ambient halo — the warm purple light the sculpture sits in. */}
      <div
        style={{
          position: "absolute",
          inset: "40px",
          borderRadius: "50%",
          background: "radial-gradient(50% 50% at 50% 42%, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0) 70%)",
          animation: "authAmbient 9s ease-in-out infinite",
        }}
      />

      {/* Tiered ceramic pedestal (bottom → top). */}
      <Platform w={320} thickness={20} top={498} />
      <Platform w={280} thickness={18} top={484} />
      <Platform w={240} thickness={16} top={470} />

      {/* Constellation lines — barely-there dashed links between the cards. */}
      <svg width={560} height={600} viewBox="0 0 560 600" style={{ position: "absolute", inset: 0 }} fill="none">
        <g stroke={PALETTE.line} strokeWidth={1} strokeOpacity={0.1} strokeDasharray="2 8" strokeLinecap="round">
          <line x1={MAIN.x} y1={MAIN.y} x2={ANALYTICS.x} y2={ANALYTICS.y} />
          <line x1={MAIN.x} y1={MAIN.y} x2={PROFILE.x} y2={PROFILE.y} />
          <line x1={ANALYTICS.x} y1={ANALYTICS.y} x2={PROFILE.x} y2={PROFILE.y} />
        </g>
      </svg>

      {/* Particles — 11, three sizes, low opacity, slow orbits. */}
      <Particle cx={470} cy={210} radius={26} size={8} opacity={0.22} duration={22} />
      <Particle cx={90} cy={180} radius={20} size={6} opacity={0.18} duration={26} delay={2} />
      <Particle cx={430} cy={330} radius={30} size={10} opacity={0.2} duration={24} delay={1} />
      <Particle cx={150} cy={330} radius={18} size={6} opacity={0.16} duration={28} delay={3} />
      <Particle cx={300} cy={90} radius={22} size={8} opacity={0.2} duration={23} delay={1.5} />
      <Particle cx={500} cy={120} radius={16} size={6} opacity={0.15} duration={27} delay={2.5} />
      <Particle cx={60} cy={300} radius={24} size={8} opacity={0.18} duration={25} delay={0.5} />
      <Particle cx={360} cy={470} radius={20} size={10} opacity={0.18} duration={24} delay={3.5} />
      <Particle cx={210} cy={520} radius={18} size={6} opacity={0.15} duration={26} delay={1.2} />
      <Particle cx={460} cy={420} radius={22} size={8} opacity={0.17} duration={22} delay={2.8} />
      <Particle cx={120} cy={470} radius={16} size={6} opacity={0.16} duration={29} delay={0.8} />

      {/* ── Profile card (behind, lower-left) ─────────────────────────────── */}
      <Float amp={10} duration={9} delay={0.5} style={{ left: 8, top: 372 }}>
        <ProfileCard />
      </Float>

      {/* ── Main survey card (hero, centre) ───────────────────────────────── */}
      <Float amp={14} duration={8} delay={0} style={{ left: 100, top: 56 }}>
        <SurveyCard />
      </Float>

      {/* ── Analytics card (front, upper-right) ───────────────────────────── */}
      <Float amp={12} duration={7} delay={0.9} style={{ left: 290, top: 24 }}>
        <AnalyticsCard />
      </Float>
    </div>
  );
}

/* ── Cards ──────────────────────────────────────────────────────────────── */

function SurveyCard() {
  return (
    <div
      style={{
        width: 360,
        height: 420,
        borderRadius: 32,
        background: PALETTE.card,
        border: HAIRLINE,
        boxShadow: SHADOW.main,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        transform: "rotateY(-8deg) rotateX(6deg)",
        transformStyle: "preserve-3d",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header — brand dot, title, step marker */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            background: `linear-gradient(180deg, ${PALETTE.secondary}, ${PALETTE.primary})`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 6px 16px rgba(94,67,243,0.28)",
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.2 4.2L19 7" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <Bar w={128} h={9} />
          <Bar w={80} h={7} tone="faint" />
        </div>
        <Bar w={32} h={7} tone="primary" />
      </div>

      {/* Progress rail */}
      <div style={{ height: 6, borderRadius: 8, background: "rgba(46,42,69,0.06)", overflow: "hidden" }}>
        <div style={{ width: "38%", height: "100%", borderRadius: 8, background: `linear-gradient(90deg, ${PALETTE.secondary}, ${PALETTE.primary})` }} />
      </div>

      {/* Q1 — Likert scale */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Bar w="82%" h={8} />
        <div style={{ display: "flex", gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: i === 3 ? `2px solid ${PALETTE.primary}` : "2px solid rgba(46,42,69,0.12)",
                background: i === 3 ? PALETTE.primary : "transparent",
                boxShadow: i === 3 ? "0 4px 10px rgba(94,67,243,0.28)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Q2 — two option chips, one selected */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Bar w="66%" h={8} />
        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              flex: 1,
              height: 40,
              borderRadius: 12,
              border: `1.5px solid ${PALETTE.primary}`,
              background: PALETTE.highlight,
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              gap: 10,
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: "50%", border: `4px solid ${PALETTE.primary}` }} />
            <Bar w={62} h={7} tone="primary" />
          </div>
          <div
            style={{
              flex: 1,
              height: 40,
              borderRadius: 12,
              border: "1.5px solid rgba(46,42,69,0.10)",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              gap: 10,
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(46,42,69,0.18)" }} />
            <Bar w={52} h={7} tone="faint" />
          </div>
        </div>
      </div>

      {/* Submit affordance */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            flex: 1,
            height: 44,
            borderRadius: 16,
            background: `linear-gradient(180deg, ${PALETTE.secondary}, ${PALETTE.primary})`,
            boxShadow: "0 12px 28px rgba(94,67,243,0.28)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Bar w={72} h={8} style={{ background: "rgba(255,255,255,0.9)" }} />
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard() {
  const bars = [46, 74, 58, 96, 68, 84];
  return (
    <div
      style={{
        width: 260,
        height: 170,
        borderRadius: 28,
        background: "#FFFFFF",
        border: HAIRLINE,
        boxShadow: SHADOW.analytics,
        transform: "rotateY(-8deg) rotateX(6deg)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Bar w={92} h={8} />
          <Bar w={56} h={7} tone="faint" />
        </div>
        <span
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            background: PALETTE.highlight,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Bar w={30} h={7} tone="primary" />
        </span>
      </div>

      {/* Rounded bar chart — equal spacing, 8px radius */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 12 }}>
        {bars.map((hPct, i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-end", height: "100%" }}>
            <div
              style={{
                width: "100%",
                height: `${hPct}%`,
                borderRadius: 8,
                background:
                  i === 3
                    ? `linear-gradient(180deg, ${PALETTE.secondary}, ${PALETTE.primary})`
                    : "linear-gradient(180deg, rgba(167,139,250,0.55), rgba(123,97,255,0.35))",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileCard() {
  return (
    <div
      style={{
        width: 240,
        height: 140,
        borderRadius: 28,
        background: "#FFFFFF",
        border: HAIRLINE,
        boxShadow: SHADOW.profile,
        transform: "rotateY(-8deg) rotateX(6deg)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* A minimal family: two overlapping avatars — a parent and a child. */}
        <span style={{ position: "relative", width: 48, height: 40 }}>
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 3,
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: `linear-gradient(180deg, ${PALETTE.accent}, ${PALETTE.secondary})`,
              boxShadow: "0 4px 10px rgba(94,67,243,0.20)",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 0,
              top: 6,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: `linear-gradient(180deg, #C4B5FD, ${PALETTE.accent})`,
              border: "2.5px solid #fff",
            }}
          />
        </span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Bar w={96} h={8} />
          <Bar w={64} h={7} tone="faint" />
        </div>
      </div>

      {/* A secure/verified line */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 8,
            background: PALETTE.highlight,
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.2 4.2L19 7" stroke={PALETTE.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <Bar w={110} h={7} tone="faint" />
      </div>
    </div>
  );
}
