import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const emailSchema = z.string().trim().email();

export default function Auth() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav("/app", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) nav("/app", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));

    if (!emailSchema.safeParse(email).success) return setError("Enter a valid email address.");
    if (password.length < 1) return setError("Enter your password.");

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError("Incorrect email or password.");
    toast.success("Welcome back");
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 hero-gradient border-r border-border/60">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl brand-gradient grid place-items-center shadow-md">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">AP Police</div>
            <div className="text-xs text-muted-foreground">Family Assessment Platform</div>
          </div>
        </Link>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Administrator access only
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Create, publish and analyse family assessment surveys. Every action
            in this console is audited.
          </p>
        </div>

        <div className="text-xs text-muted-foreground">
          Government of Andhra Pradesh · Department of Police
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 sm:mb-8 flex lg:hidden items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl brand-gradient grid place-items-center shadow-md">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="text-sm font-semibold">AP Police Family Assessment Platform</div>
          </div>

          <Card className="border-border/60 rounded-2xl shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl">Admin sign in</CardTitle>
              <CardDescription>Use the official super-admin credentials for this platform.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>{error}</div>
                </div>
              )}
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-password">Password</Label>
                  <Input id="si-password" name="password" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" disabled={loading} className="w-full rounded-xl h-11">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
