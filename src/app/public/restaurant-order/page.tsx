"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

function QrOrderInner() {
  const params = useSearchParams();
  const shopId = params.get("shop") || "";
  const tableId = params.get("table") || "";
  const supabase = createClient();

  const [tableName, setTableName] = useState("Table");
  const [guestName, setGuestName] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!tableId) return;
    supabase
      .from("restaurant_tables")
      .select("name")
      .eq("id", tableId)
      .maybeSingle()
      .then(({ data }: { data: { name: string } | null }) => {
        if (data?.name) setTableName(data.name);
      });
  }, [tableId]);

  const submit = async () => {
    if (!shopId || !tableId || !itemsText.trim()) {
      toast.error("Please enter your order items");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("restaurant_qr_orders").insert({
      shop_id: shopId,
      table_id: tableId,
      guest_name: guestName || null,
      items_json: itemsText.trim(),
      notes: notes || null,
      status: "pending",
    });
    setSending(false);
    if (error) {
      toast.error(error.message || "Could not send — ask staff for help");
      return;
    }
    setDone(true);
    toast.success("Order sent to kitchen staff!");
  };

  if (!shopId || !tableId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-slate-600">
        Invalid QR link
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-bold text-emerald-900">Request received</h1>
          <p className="text-sm text-emerald-800 mt-2">
            A waiter will confirm your order for {tableName}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-5 font-sans">
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-black text-slate-900">Order · {tableName}</h1>
        <p className="text-xs text-slate-500">Guest menu request — staff will confirm prices at the counter.</p>
        <Input placeholder="Your name (optional)" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
        <textarea
          className="w-full min-h-[140px] border rounded-xl p-3 text-sm"
          placeholder={"Items, one per line\ne.g.\n2x Chicken Karahi\n1x Large Pepsi"}
          value={itemsText}
          onChange={(e) => setItemsText(e.target.value)}
        />
        <Input placeholder="Notes (spicy, no onion…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button onClick={submit} disabled={sending} className="w-full bg-slate-900 text-white h-11">
          {sending ? <Loader2 className="animate-spin h-4 w-4" /> : "Send to kitchen"}
        </Button>
      </div>
    </div>
  );
}

export default function PublicRestaurantOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div>}>
      <QrOrderInner />
    </Suspense>
  );
}
