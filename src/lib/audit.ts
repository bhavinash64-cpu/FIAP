import { supabase } from "@/integrations/supabase/client";

export async function logAudit(action: string, entity?: string, entity_id?: string, meta?: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action,
    entity,
    entity_id,
    meta: meta as never,
  });
}
