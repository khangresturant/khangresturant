import { NextRequest, NextResponse } from "next/server";
import { resolvePlan, getEffectiveTierId } from "@/lib/planMatrix";
import { requireApiUser, resolveApiShopId } from "@/lib/auth/apiAuth";

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();

  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  let phone: string;
  let message: string;
  let type: "whatsapp" | "sms";
  let bodyShopId: string | undefined;

  try {
    const body = await req.json();
    phone = body.phone;
    message = body.message;
    type = body.type || "whatsapp";
    bodyShopId = body.shopId;

    if (!phone || !message) {
      throw new Error("Phone and message are required fields.");
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "INVALID_PAYLOAD", message: e.message }, timestamp },
      { status: 400 }
    );
  }

  const resolved = await resolveApiShopId(auth.ctx, bodyShopId);
  if ("error" in resolved) return resolved.error;
  const shopId = resolved.shopId;
  const supabase = auth.ctx.supabase;
  const user = auth.ctx.user;

  try {
    // 1. Resolve shop plan features
    const { data: shop, error: shopErr } = await supabase
      .from("shops")
      .select("subscription_tier, subscription_expires_at")
      .eq("id", shopId)
      .single();

    if (shopErr || !shop) {
      throw new Error("Failed to verify shop subscription details.");
    }

    const tier = getEffectiveTierId(shop.subscription_tier, shop.subscription_expires_at);
    const plan = resolvePlan(tier);

    // 2. Check feature gates
    if (type === "whatsapp" && !plan.allow_whatsapp) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: "PLAN_GATE_BLOCKED",
            message: "WhatsApp notifications require a Premium POS ERP subscription."
          },
          timestamp
        },
        { status: 403 }
      );
    }

    // 3. Dispatch notification
    let status = "sent";
    let gatewayResponse = "simulated_success";

    if (type === "whatsapp") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. whatsapp:+14155238886

      if (accountSid && authToken && twilioNumber) {
        // Real Twilio API Call
        const formattedTo = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
        const formData = new URLSearchParams();
        formData.append("To", formattedTo);
        formData.append("From", twilioNumber);
        formData.append("Body", message);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData.toString()
          }
        );

        const resData = await response.json();
        if (!response.ok) {
          status = "failed";
          gatewayResponse = resData.message || "Twilio error";
        } else {
          gatewayResponse = resData.sid;
        }
      } else {
        // Fallback: Console Logging Simulation
        console.log(`[SIMULATED WHATSAPP TO ${phone}]: ${message}`);
        gatewayResponse = "SIMULATED_TWILIO_SID";
      }
    } else {
      // SMS gateway simulation (mock or integration)
      console.log(`[SIMULATED SMS TO ${phone}]: ${message}`);
      gatewayResponse = "SIMULATED_SMS_SID";
    }

    // 4. Log notification in database (optional audit trail)
    await supabase.from("audit_logs").insert({
      shop_id: shopId,
      user_id: user.id,
      action: `NOTIFICATION_${type.toUpperCase()}`,
      table_name: "invoices",
      record_id: shopId, // reference id
      payload: { phone, message, status, gatewayResponse }
    });

    if (status === "failed") {
      return NextResponse.json(
        { success: false, data: null, error: { code: "GATEWAY_ERROR", message: gatewayResponse }, timestamp },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        status,
        gatewayResponse
      },
      error: null,
      timestamp
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, data: null, error: { code: "NOTIFICATION_FAILED", message: err.message }, timestamp },
      { status: 500 }
    );
  }
}
