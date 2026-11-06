"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, Loader2, RefreshCw, Phone, Wallet } from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";
import {
  filterRiderStaff,
  isDeliveryService,
  restaurantPaymentLabel,
  riderLabel,
  staffPhone,
  type RestaurantStaffPerson,
} from "@/lib/restaurant-riders";

type DateRange = "today" | "yesterday" | "week" | "month" | "all";

type DeliveryOrder = {
  id: string;
  order_number: string | null;
  created_at: string;
  total_amount: number;
  paid_amount: number | null;
  payment_mode: string | null;
  status: string;
  restaurant_order_status: string | null;
  rider_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
};

type RiderSummary = {
  key: string;
  riderId: string | null;
  name: string;
  phone: string | null;
  orders: DeliveryOrder[];
  total: number;
  cash: number;
  bank: number;
  online: number;
  card: number;
  credit: number;
};

function dateBounds(range: DateRange): { start: string | null; end: string | null } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "today") return { start: start.toISOString(), end: null };
  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (range === "week") {
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - (weekday - 1));
    return { start: start.toISOString(), end: null };
  }
  if (range === "month") {
    start.setDate(1);
    return { start: start.toISOString(), end: null };
  }
  return { start: null, end: null };
}

function paymentBucket(mode?: string | null): "cash" | "bank" | "online" | "card" | "credit" {
  const m = String(mode || "cash").toLowerCase();
  if (m === "bank" || m === "bank_transfer") return "bank";
  if (m === "online" || m === "jazzcash" || m === "easypaisa" || m === "wallet") return "online";
  if (m === "card") return "card";
  if (m === "credit") return "credit";
  return "cash";
}

function formatRs(n: number) {
  return `Rs ${Number(n || 0).toLocaleString()}`;
}

export default function RestaurantRidersPage() {
  const { shopId, allowReports } = useShop();
  const { language } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const isEn = language === "en";

  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<RestaurantStaffPerson[]>([]);
  const [paidOrders, setPaidOrders] = useState<DeliveryOrder[]>([]);
  const [openDeliveries, setOpenDeliveries] = useState<DeliveryOrder[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { start, end } = dateBounds(dateRange);
      let paidQ = supabase
        .from("invoices")
        .select(
          "id, order_number, created_at, total_amount, paid_amount, payment_mode, status, restaurant_order_status, rider_id, customer_name, customer_phone, customer_address, service_type"
        )
        .eq("shop_id", shopId)
        .eq("service_type", "delivery")
        .neq("status", "cancelled")
        .neq("restaurant_order_status", "cancelled")
        .neq("status", "draft")
        .order("created_at", { ascending: false });
      if (start) paidQ = paidQ.gte("created_at", start);
      if (end) paidQ = paidQ.lt("created_at", end);

      const openQ = supabase
        .from("invoices")
        .select(
          "id, order_number, created_at, total_amount, paid_amount, payment_mode, status, restaurant_order_status, rider_id, customer_name, customer_phone, customer_address, service_type"
        )
        .eq("shop_id", shopId)
        .eq("service_type", "delivery")
        .eq("status", "draft")
        .neq("restaurant_order_status", "cancelled")
        .order("created_at", { ascending: false });

      const [staffRes, paidRes, openRes] = await Promise.all([
        supabase.from("user_profiles").select("id, name, role, phone, permissions").eq("shop_id", shopId).order("name"),
        paidQ,
        openQ,
      ]);

      setStaff((staffRes.data || []) as RestaurantStaffPerson[]);
      setPaidOrders((paidRes.data || []).filter((o: any) => isDeliveryService(o.service_type)) as DeliveryOrder[]);
      setOpenDeliveries((openRes.data || []).filter((o: any) => isDeliveryService(o.service_type)) as DeliveryOrder[]);
    } finally {
      setLoading(false);
    }
  }, [shopId, dateRange, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const staffById = useMemo(() => {
    const map: Record<string, RestaurantStaffPerson> = {};
    staff.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [staff]);

  const summaries = useMemo((): RiderSummary[] => {
    const byKey = new Map<string, RiderSummary>();
    const bump = (order: DeliveryOrder) => {
      const person = order.rider_id ? staffById[order.rider_id] : null;
      const key = person?.id || "__unassigned";
      const amount = Number(order.total_amount || 0);
      const bucket = paymentBucket(order.payment_mode);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          riderId: person?.id || null,
          name: person?.name || (isEn ? "(Unassigned)" : "(غیر مقرر)"),
          phone: staffPhone(person),
          orders: [],
          total: 0,
          cash: 0,
          bank: 0,
          online: 0,
          card: 0,
          credit: 0,
        });
      }
      const row = byKey.get(key)!;
      row.orders.push(order);
      row.total += amount;
      row[bucket] += amount;
    };
    paidOrders.forEach(bump);
    return Array.from(byKey.values()).sort((a, b) => {
      if (a.key === "__unassigned") return 1;
      if (b.key === "__unassigned") return -1;
      return b.total - a.total;
    });
  }, [paidOrders, staffById, isEn]);

  useEffect(() => {
    if (!summaries.length) {
      setSelectedKey("");
      return;
    }
    if (!summaries.some((s) => s.key === selectedKey)) {
      setSelectedKey(summaries[0].key);
    }
  }, [summaries, selectedKey]);

  const selected = summaries.find((s) => s.key === selectedKey) || null;
  const riderStaff = filterRiderStaff(staff);
  const grandTotal = summaries.reduce((s, r) => s + r.total, 0);
  const cashTotal = summaries.reduce((s, r) => s + r.cash, 0);
  const bankTotal = summaries.reduce((s, r) => s + r.bank + r.online + r.card, 0);
  const unassignedCount = summaries.find((s) => s.key === "__unassigned")?.orders.length || 0;
  const onRideIds = new Set(openDeliveries.filter((o) => o.rider_id).map((o) => o.rider_id as string));

  if (!allowReports) {
    return <SubscriptionBlocker featureName="Delivery Riders & Reports" requiredPlan="Premium" />;
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            {isEn
              ? "Assign riders only on delivery. Dine-in uses waiter. Takeaway needs no rider. Cash / bank / online split is below."
              : "رائیڈر صرف ڈیلیوری پر۔ ڈائن ان پر ویٹر۔ ٹیک اوے پر رائیڈر نہیں۔ نقد / بینک / آن لائن نیچے ہے۔"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="h-8 text-xs border rounded-lg px-2 bg-white"
          >
            <option value="today">{isEn ? "Today" : "آج"}</option>
            <option value="yesterday">{isEn ? "Yesterday" : "کل"}</option>
            <option value="week">{isEn ? "This week" : "اس ہفتے"}</option>
            <option value="month">{isEn ? "This month" : "اس مہینے"}</option>
            <option value="all">{isEn ? "All" : "سب"}</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => load()} className="h-8 text-xs">
            <RefreshCw size={12} className="mr-1" /> {isEn ? "Refresh" : "تازہ"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={isEn ? "Paid deliveries" : "ادا شدہ ڈیلیوری"} value={String(paidOrders.length)} sub={formatRs(grandTotal)} />
        <StatCard label={isEn ? "Cash collected" : "نقد وصولی"} value={formatRs(cashTotal)} tone="emerald" />
        <StatCard label={isEn ? "Bank / online / card" : "بینک / آن لائن"} value={formatRs(bankTotal)} tone="sky" />
        <StatCard
          label={isEn ? "Open / unassigned" : "کھلے / بغیر رائیڈر"}
          value={`${openDeliveries.length} / ${unassignedCount}`}
          tone="amber"
        />
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-4">
        <h2 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-3">
          {isEn ? "Restaurant rider roster" : "ریستوران رائیڈر فہرست"}
        </h2>
        {riderStaff.length === 0 ? (
          <p className="text-xs text-slate-500">
            {isEn
              ? "No staff role named rider/delivery yet. You can still pick any staff on a delivery order. Set role to Rider on Staff so the list stays clean."
              : "رائیڈر رول والا سٹاف نہیں۔ ڈیلیوری پر کوئی بھی سٹاف لگ سکتا ہے۔ سٹاف میں رول Rider رکھیں۔"}
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {riderStaff.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{r.name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Phone size={10} /> {staffPhone(r) || "-"}
                  </p>
                </div>
                <div
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    onRideIds.has(r.id) ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {onRideIds.has(r.id) ? (isEn ? "On ride" : "راہ میں") : isEn ? "Free" : "فارغ"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openDeliveries.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <h2 className="text-xs font-black uppercase tracking-wide text-amber-800 mb-2">
            {isEn ? "Open delivery orders (not paid yet)" : "کھلے ڈیلیوری آرڈرز"}
          </h2>
          <div className="space-y-1.5">
            {openDeliveries.map((o) => {
              const rider = o.rider_id ? staffById[o.rider_id] : null;
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 text-xs bg-white/80 rounded-lg px-3 py-2">
                  <div className="min-w-0 flex items-center gap-1">
                    <strong className="font-bold">#{o.order_number || o.id.slice(0, 6)}</strong>
                    <div className="text-slate-500"> · {o.customer_name || "Guest"}</div>
                    {o.customer_phone ? <div className="text-slate-400"> · {o.customer_phone}</div> : null}
                  </div>
                  <div className={rider ? "text-emerald-700 font-semibold" : "text-rose-600 font-bold"}>
                    {rider ? riderLabel(rider) : isEn ? "No rider" : "رائیڈر نہیں"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b bg-slate-50 text-[11px] font-bold text-slate-600">
            {isEn ? "Riders · paid deliveries" : "رائیڈرز · ادا شدہ"}
          </div>
          {loading ? (
            <div className="p-8 flex justify-center text-slate-400">
              <Loader2 className="animate-spin" size={18} />
            </div>
          ) : summaries.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">{isEn ? "No paid delivery orders in this period." : "اس مدت میں ڈیلیوری نہیں۔"}</p>
          ) : (
            <div className="divide-y">
              {summaries.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setSelectedKey(row.key)}
                  className={`w-full text-left px-3 py-2.5 ${selectedKey === row.key ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{row.name}</p>
                    <p className="text-xs font-mono font-bold">{formatRs(row.total)}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {row.orders.length} {isEn ? "orders" : "آرڈرز"}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-600">
              {selected ? selected.name : isEn ? "Select a rider" : "رائیڈر چنیں"}
            </p>
            {selected?.phone ? (
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Phone size={10} /> {selected.phone}
              </div>
            ) : null}
          </div>
          {selected ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 border-b">
                <MiniStat label="Cash" value={formatRs(selected.cash)} />
                <MiniStat label="Bank" value={formatRs(selected.bank)} />
                <MiniStat label="Online" value={formatRs(selected.online)} />
                <MiniStat label="Card" value={formatRs(selected.card)} />
                <MiniStat label="Credit" value={formatRs(selected.credit)} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b">
                      <th className="px-3 py-2 font-bold">#</th>
                      <th className="px-3 py-2 font-bold">{isEn ? "Time" : "وقت"}</th>
                      <th className="px-3 py-2 font-bold">{isEn ? "Customer" : "گاہک"}</th>
                      <th className="px-3 py-2 font-bold">{isEn ? "Pay" : "ادائیگی"}</th>
                      <th className="px-3 py-2 font-bold text-right">{isEn ? "Total" : "کل"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.orders.map((o) => (
                      <tr key={o.id} className="border-b border-slate-50">
                        <td className="px-3 py-2 font-bold">#{o.order_number || o.id.slice(0, 6)}</td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {new Date(o.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold">{o.customer_name || "Guest"}</div>
                          <div className="text-[10px] text-slate-400">{o.customer_phone || o.customer_address || "-"}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="inline-flex items-center gap-1 font-bold text-[10px] uppercase">
                            <Wallet size={10} /> {restaurantPaymentLabel(o.payment_mode)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{formatRs(o.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="p-6 text-xs text-slate-400">{isEn ? "Pick a rider on the left." : "بائیں سے رائیڈر چنیں۔"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "emerald" | "sky" | "amber";
}) {
  const tones = {
    slate: "bg-white border-slate-100",
    emerald: "bg-emerald-50 border-emerald-100",
    sky: "bg-sky-50 border-sky-100",
    amber: "bg-amber-50 border-amber-100",
  };
  return (
    <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-black text-slate-800 mt-1">{value}</p>
      {sub ? <p className="text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className="text-[9px] font-black uppercase text-slate-400">{label}</p>
      <p className="text-[11px] font-bold font-mono">{value}</p>
    </div>
  );
}
