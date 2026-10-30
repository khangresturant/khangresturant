import { createClient } from "@/lib/supabase/client";

export const logAudit = async (
  shopId: string,
  userId: string | null | undefined,
  action: string,
  tableName: string | null = null,
  recordId: string | null = null,
  details: any = {}
) => {
  try {
    const supabase = createClient();
    const payload: any = {
      shop_id: shopId,
      action,
      details,
      table_name: tableName,
      created_at: new Date().toISOString()
    };
    if (userId) payload.user_id = userId;
    if (recordId) payload.record_id = recordId;

    // Fetch IP client-side using a free JSON API as fallback
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const ipData = await res.json();
      if (ipData.ip) payload.ip_address = ipData.ip;
    } catch {
      // ignore IP fetch failure
    }

    await supabase.from("audit_logs").insert(payload);
  } catch (err) {
    console.error("Error logging audit trail:", err);
  }
};
