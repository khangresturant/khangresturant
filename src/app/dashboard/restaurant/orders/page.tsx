"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ClipboardList, Search, Loader2, RefreshCw, ChefHat, CreditCard,
  Printer, Ban, ExternalLink, ChevronLeft, ChevronRight, AlertTriangle,
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type RestaurantOrderStatus,
  RESTAURANT_ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  ACTIVE_ORDER_STATUSES,
  getPaymentStatus,
  updateOrderStatus,
  cancelRestaurantOrder,
  markBillPrinted,
  canMarkPaidInHistory,
  normalizeOrderStatus,
} from "@/lib/restaurant-orders";
import { SettleOrderDialog, type SettleOrderData } from "@/components/restaurant/SettleOrderDialog";

type OrderRow = {
  id: string;
  order_number: string | null;
  created_at: string;
  total_amount: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  status: string;
  restaurant_order_status: RestaurantOrderStatus | null;
  service_type: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  party_id: string | null;
  table_id: string | null;
  waiter_id?: string | null;
  rider_id?: string | null;
  parties: { name: string } | null;
  invoice_items: { product_id: string; quantity: number; unit_price: number; products: { name: string } | null }[];
  tableName?: string;
};

const STATUS_OPTIONS = ["all", "pending", "preparing", "ready", "delivered", "bill_printed", "settled", "cancelled"];
const PAYMENT_OPTIONS = ["all", "pending", "paid", "partial", "unpaid", "cancelled"];
const DATE_OPTIONS = ["today", "yesterday", "week", "month", "all"];
const SERVICE_OPTIONS = ["all", "dining", "takeaway", "delivery"];

function computeDateRange(dateFilter: string) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (dateFilter === "today") return { start: start.toISOString(), end: null as string | null };
  if (dateFilter === "yesterday") {
    start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (dateFilter === "week") {
    start.setDate(start.getDate() - 7);
    return { start: start.toISOString(), end: null };
  }
  if (dateFilter === "month") {
    start.setMonth(start.getMonth() - 1);
    return { start: start.toISOString(), end: null };
  }
  return { start: null, end: null };
}

/** Skip re-render if visible order data unchanged */
function ordersSnapshotKey(rows: OrderRow[]): string {
  return rows
    .map(
      (o) =>
        `${o.id}:${o.restaurant_order_status}:${o.status}:${o.total_amount}:${o.order_number}:${o.customer_name}`
    )
    .join("|");
}

export default function RestaurantOrdersPage() {
  const { shopId } = useShop();
  const { language } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const isEn = language === "en";
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSilentRefreshRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);
  const loadOrdersRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [page, setPage] = useState(1);
  const [settleOrder, setSettleOrder] = useState<SettleOrderData | null>(null);
  const pageSize = 50;

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    if (!shopId) return;
    const silent = opts?.silent === true || hasLoadedOnceRef.current;
    if (!silent) setInitialLoading(true);
    try {
      const { data: tables } = await supabase.from("restaurant_tables").select("id, name, active_invoice_id").eq("shop_id", shopId);

      let q = supabase
        .from("invoices")
        .select(`
          id, order_number, created_at, total_amount, discount, tax_rate, tax_amount, status,
          restaurant_order_status, service_type, customer_name, customer_phone, table_id, party_id,
          waiter_id, rider_id,
          parties ( name ),
          invoice_items ( product_id, quantity, unit_price, products ( name ) )
        `)
        .eq("shop_id", shopId)
        .not("service_type", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);

      const { start, end } = computeDateRange(dateFilter);
      if (start) q = q.gte("created_at", start);
      if (end) q = q.lt("created_at", end);

      const { data, error } = await q;
      if (error) {
        if (error.message.includes("service_type") || error.message.includes("restaurant_order_status")) {
          setMigrationNeeded(true);
          setOrders([]);
          return;
        }
        throw error;
      }

      setMigrationNeeded(false);
      const tableList = tables || [];
      const mapped: OrderRow[] = (data || []).map((inv: any) => {
        const t = tableList.find((x: any) => x.id === inv.table_id || x.active_invoice_id === inv.id);
        return {
          ...inv,
          restaurant_order_status: normalizeOrderStatus(inv.restaurant_order_status),
          tableName: t?.name || (inv.service_type === "takeaway" ? "Takeaway" : inv.service_type === "delivery" ? "Delivery" : "Dine-In"),
        };
      });

      const nextKey = ordersSnapshotKey(mapped);
      setOrders((prev) => (ordersSnapshotKey(prev) === nextKey ? prev : mapped));
      hasLoadedOnceRef.current = true;
    } catch (err: any) {
      if (!silent) toast.error(err.message);
    } finally {
      setInitialLoading(false);
    }
  }, [shopId, supabase, dateFilter]);

  loadOrdersRef.current = loadOrders;

  const scheduleSilentRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastSilentRefreshRef.current < 2500) return;

    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      lastSilentRefreshRef.current = Date.now();
      void loadOrdersRef.current({ silent: true });
    }, 800);
  }, []);

  const onInvoiceUpdate = useCallback(
    (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
      if (!payload.new?.service_type) return;
      const watch = [
        "restaurant_order_status",
        "status",
        "total_amount",
        "order_number",
        "customer_name",
        "customer_phone",
        "table_id",
      ];
      if (watch.some((k) => payload.new[k] !== payload.old[k])) {
        scheduleSilentRefresh();
      }
    },
    [scheduleSilentRefresh]
  );

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    setInitialLoading(true);
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    void loadOrdersRef.current({ silent: hasLoadedOnceRef.current });
  }, [shopId, dateFilter]);

  useEffect(() => {
    if (!shopId) return;

    const channel = supabase
      .channel(`restaurant_order_history_${shopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "invoices", filter: `shop_id=eq.${shopId}` },
        (payload: { new: Record<string, unknown> | null }) => {
          if (payload.new && (payload.new as { service_type?: string }).service_type) {
            scheduleSilentRefresh();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "invoices", filter: `shop_id=eq.${shopId}` },
        (payload: any) => onInvoiceUpdate(payload as { new: Record<string, unknown>; old: Record<string, unknown> })
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "invoices", filter: `shop_id=eq.${shopId}` },
        () => scheduleSilentRefresh()
      )
      .subscribe();

    return () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [shopId, supabase, scheduleSilentRefresh, onInvoiceUpdate]);

  const filtered = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const cust = o.customer_name || o.parties?.name || "";
    const matchesSearch =
      !q ||
      (o.order_number || "").toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      cust.toLowerCase().includes(q) ||
      (o.tableName || "").toLowerCase().includes(q);

    const st = o.restaurant_order_status || (o.status !== "draft" ? "settled" : "pending");
    const pay = getPaymentStatus(o);

    if (statusFilter !== "all" && st !== statusFilter) return false;
    if (paymentFilter !== "all" && pay !== paymentFilter) return false;
    if (serviceFilter !== "all" && (o.service_type || "dining") !== serviceFilter) return false;
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleStatusChange = async (order: OrderRow, newStatus: RestaurantOrderStatus) => {
    try {
      await updateOrderStatus(supabase, order.id, newStatus);
      toast.success(`Order status → ${newStatus}`);
      scheduleSilentRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCancel = async (order: OrderRow) => {
    if (!window.confirm(isEn ? `Cancel order ${order.order_number || order.id.slice(0, 8)}?` : "آرڈر منسوخ کریں؟")) return;
    try {
      await cancelRestaurantOrder(supabase, order.id);
      toast.success("Order cancelled");
      scheduleSilentRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handlePrintBill = async (order: OrderRow) => {
    if (order.status !== "draft") {
      window.open(`/public/receipt/${order.id}`, "_blank");
      return;
    }
    try {
      await markBillPrinted(supabase, order.id);
      toast.success(isEn ? "Bill printed — tap Settle / Mark Paid" : "بل پرنٹ — اب Settle کریں");
      scheduleSilentRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openSettle = (order: OrderRow) => {
    const st = order.restaurant_order_status || "pending";
    if (!canMarkPaidInHistory(st, order.status)) {
      toast.error(
        isEn
          ? "Print guest bill first (or wait until order is ready), then settle."
          : "پہلے بل پرنٹ کریں یا آرڈر تیار ہونے کا انتظار کریں۔"
      );
      return;
    }
    setSettleOrder({
      id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      discount: order.discount,
      tax_rate: order.tax_rate,
      tax_amount: order.tax_amount,
      party_id: order.party_id,
      table_id: order.table_id,
      waiter_id: order.waiter_id,
      rider_id: order.rider_id,
      service_type: order.service_type,
      tableName: order.tableName,
      invoice_items: order.invoice_items.map((i) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
      })),
      line_items: order.invoice_items.map((i) => ({
        name: i.products?.name || "Item",
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
      })),
      customer_name: order.customer_name || order.parties?.name || null,
    });
  };

  const fmtDate = (s: string) => new Date(s).toLocaleString();

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ClipboardList className="text-blue-600" /> {isEn ? "Order History & Management" : "آرڈر ہسٹری"}
          </h2>
          
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-emerald-600 font-semibold hidden sm:inline" title={isEn ? "Live updates — no page blink" : "لائیو اپڈیٹ"}>
            ● Live
          </span>
          <Button
            variant="outline"
            onClick={() => {
              void loadOrdersRef.current({ silent: true });
              toast.success(isEn ? "List updated" : "فہرست اپڈیٹ");
            }}
          >
            <RefreshCw size={14} className="mr-1" /> Refresh
          </Button>
          <Link href="/dashboard/restaurant/pos"><Button className="bg-blue-600 text-white"><ChefHat size={14} className="mr-1" /> New Order</Button></Link>
        </div>
      </div>

      {migrationNeeded && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-900 text-sm"><AlertTriangle size={18} /> {isEn ? "Run DB migration first" : "پہلے DB migration چلائیں"}</div>
          <Link href="/dashboard/restaurant/setup-migration"><Button size="sm" className="bg-amber-600 text-white">Setup</Button></Link>
        </div>
      )}

      {/* Filters — like src OrderHistoryDialog */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="block mt-1 border rounded-lg px-2 py-1.5 text-xs">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "all" ? "All" : RESTAURANT_ORDER_STATUS_LABELS[s as RestaurantOrderStatus]?.en || s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Payment</label>
          <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} className="block mt-1 border rounded-lg px-2 py-1.5 text-xs">
            {PAYMENT_OPTIONS.map((p) => <option key={p} value={p}>{p === "all" ? "All" : p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Service</label>
          <select value={serviceFilter} onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }} className="block mt-1 border rounded-lg px-2 py-1.5 text-xs">
            {SERVICE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All" : s === "dining" ? "Dine-In" : s === "takeaway" ? "Takeaway" : "Delivery"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
          <select value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} className="block mt-1 border rounded-lg px-2 py-1.5 text-xs">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Search</label>
          <div className="relative mt-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Order #, customer, table..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Table — only full spinner on first load */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm min-h-[200px]">
        {initialLoading && orders.length === 0 ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : paged.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">{isEn ? "No orders found" : "کوئی آرڈر نہیں"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-3 font-bold">Order #</th>
                  <th className="p-3 font-bold">Date/Time</th>
                  <th className="p-3 font-bold">Customer</th>
                  <th className="p-3 font-bold">Table/Type</th>
                  <th className="p-3 font-bold">Items</th>
                  <th className="p-3 font-bold">Status</th>
                  <th className="p-3 font-bold">Payment</th>
                  <th className="p-3 font-bold text-right">Total</th>
                  <th className="p-3 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((o) => {
                  const st = o.restaurant_order_status || (o.status !== "draft" ? "settled" : "pending");
                  const pay = getPaymentStatus(o);
                  const canSettle = o.status === "draft" && canMarkPaidInHistory(st, o.status);
                  const itemSummary = o.invoice_items?.slice(0, 3).map((i) => `${i.quantity}x ${i.products?.name}`).join(", ") || "—";
                  const cust = o.customer_name || o.parties?.name || "Walk-in";
                  return (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-700">{o.order_number || o.id.slice(0, 8).toUpperCase()}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                      <td className="p-3 font-semibold">{cust}{o.customer_phone ? <span className="text-slate-400 block">{o.customer_phone}</span> : null}</td>
                      <td className="p-3">{o.tableName}</td>
                      <td className="p-3 text-slate-600 max-w-[160px] truncate" title={itemSummary}>{itemSummary}</td>
                      <td className="p-3">
                        {o.status === "draft" ? (
                          <select
                            value={st}
                            onChange={(e) => handleStatusChange(o, e.target.value as RestaurantOrderStatus)}
                            className={`text-[10px] font-bold rounded px-1.5 py-0.5 border ${RESTAURANT_ORDER_STATUS_LABELS[st]?.color || ""}`}
                          >
                            {ACTIVE_ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>{RESTAURANT_ORDER_STATUS_LABELS[s].en}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${RESTAURANT_ORDER_STATUS_LABELS.settled.color}`}>Completed</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${PAYMENT_STATUS_LABELS[pay]?.color || ""}`}>
                          {PAYMENT_STATUS_LABELS[pay]?.en || pay}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">Rs {Number(o.total_amount).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {o.status === "draft" && (
                            <>
                              <Link href={`/dashboard/restaurant/pos?reopen=${o.id}`}>
                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2">Edit</Button>
                              </Link>
                              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handlePrintBill(o)} title="Print bill">
                                <Printer size={10} className="mr-0.5" /> Bill
                              </Button>
                              <Button
                                size="sm"
                                className={`h-7 text-[10px] px-2 text-white ${canSettle ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-300"}`}
                                onClick={() => openSettle(o)}
                                disabled={!canSettle}
                                title={isEn ? "Settle / Mark paid" : "ادائیگی / سیٹل"}
                              >
                                <CreditCard size={10} className="mr-0.5" /> {isEn ? "Settle" : "ادائیگی"}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 text-red-600" onClick={() => handleCancel(o)}>
                                <Ban size={10} />
                              </Button>
                            </>
                          )}
                          {o.status !== "draft" && (
                            <>
                              <a href={`/public/receipt/${o.id}`} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2">
                                  <ExternalLink size={10} className="mr-0.5" /> {isEn ? "Receipt" : "رسید"}
                                </Button>
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Total: {filtered.length} orders</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /></Button>
          <span>Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={14} /></Button>
        </div>
      </div>

      <SettleOrderDialog
        open={!!settleOrder}
        order={settleOrder}
        onClose={() => setSettleOrder(null)}
        onSettled={() => {
          void loadOrdersRef.current({ silent: true });
        }}
      />
    </div>
  );
}
