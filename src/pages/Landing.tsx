import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, ArrowRight, Lock, BarChart3, ClipboardCheck, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";

export default function Landing() {
  const t = useT();

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60 bg-white/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl brand-gradient grid place-items-center shadow-md">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">{t("appShort")}</div>
              <div className="text-[11px] text-muted-foreground">AP Police</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            <Button asChild variant="ghost" className="rounded-lg">
              <Link to="/auth">{t("signIn")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="hero-gradient">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-14 sm:pt-16 sm:pb-20 md:pt-24 md:pb-28">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 backdrop-blur px-3 py-1 text-[11px] sm:text-xs font-medium text-primary shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("govOf")}
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .05 }}
              className="mt-5 sm:mt-6 text-[2rem] sm:text-4xl md:text-6xl font-semibold tracking-tight text-balance leading-[1.05]">
              {t("appName")}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .15 }}
              className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl text-balance leading-relaxed">
              The official survey platform of the Andhra Pradesh Police. Build a survey,
              publish it to a shareable link and QR code, and collect responses from the
              public — no account or login required to respond.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .25 }}
              className="mt-7 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <Button asChild size="lg" className="rounded-xl h-12 px-6 shadow-md hover:shadow-lg w-full sm:w-auto">
                <Link to="/auth">
                  Admin sign in <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>

          <div className="mt-12 sm:mt-16 grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ClipboardCheck, title: "Build in minutes", body: "Bilingual questions in eight formats, drag-and-drop reordering, live preview." },
              { icon: QrCode, title: "Publish anywhere", body: "One shareable link and a scannable QR code — no app to install." },
              { icon: Smartphone, title: "No login to respond", body: "Mobile-first, Google Forms–style: open the link, answer, submit." },
              { icon: Lock, title: "Secure & audited", body: "Single administrator account, encrypted storage, full audit trail." },
            ].map((f) => (
              <div key={f.title} className="premium-card p-5 hover:shadow-lg transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-accent grid place-items-center">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 font-semibold">{f.title}</div>
                <div className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-start">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">How it works</div>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
              From draft to responses in three steps
            </h2>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Sign in as administrator and create a survey",
                "Add questions, reorder by drag-and-drop, preview exactly as the public will see it",
                "Publish — share the link or QR code, and watch responses arrive",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="premium-card p-8 subtle-gradient">
            <div className="text-sm font-semibold text-muted-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4" />Question types available</div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
              {["Multiple choice", "Checkboxes", "Likert scale", "Yes / No", "Rating (stars)", "Short text", "Long text", "Dropdown"].map((n) => (
                <div key={n} className="rounded-xl bg-white/70 border border-border/60 px-3 py-2.5">{n}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        <div>{t("govOf")}</div>
        <div className="mt-1 opacity-70">For authorised personnel only. All admin access is audited.</div>
      </footer>
    </div>
  );
}
