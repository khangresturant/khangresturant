"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
  ArrowLeft,
  Loader2,
  Ban,
  Printer,
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import { mergePrintSettingsFromRow } from "@/lib/merge-print-settings";
import { printRestaurantKOTSlip } from "@/lib/restaurant-receipt-print";
import {
  syncRestaurantOrderStatus,
  startOrderPreparation,
  cancelRestaurantOrder,
  normalizeOrderStatus,
  type RestaurantOrderStatus,
} from "@/lib/restaurant-orders";
import { fetchStations } from "@/lib/restaurant-ops";
import {
  KITCHEN_POLL_INTERVAL_MS,
  shouldPollKitchenLive,
} from "@/lib/restaurant-kitchen";

type KdsTicket = {
  id: string;
  created_at: string;
  status: "cooking" | "ready";
  invoice_id: string | null;
  table_id: string | null;
  table_name: string;
  service_type: string;
  order_number: string | null;
  station_id: string | null;
  kitchen_hub: string | null;
  invoice_status: RestaurantOrderStatus | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  special_instructions?: string | null;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    remarks?: string | null;
  }[];
};

export default function KitchenDisplayPage() {
  const { shopId, shopName, shopPhone, shopAddress, shopEmail } = useShop();
  const supabase = createClient();

  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptSettings, setReceiptSettings] = useState(DEFAULT_RECEIPT_SETTINGS);
  const [companyDetails, setCompanyDetails] = useState<{
    name?: string;
    phone?: string;
    address?: string;
    email?: string;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState<Date>(new Date());
  const [stations, setStations] = useState<{ id: string; name: string; kitchen_hub: string | null }[]>([]);
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [hubFilter, setHubFilter] = useState<string>("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const playAlert = () => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          "https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav"
        );
      }
      audioRef.current.play().catch(() => {});
    } catch {
      /* autoplay blocked */
    }
  };

  const fetchActiveTickets = async (announceNew = false) => {
    if (!shopId) return;
    try {
      const baseSelect = `
          id,
          status,
          created_at,
          table_id,
          invoice_id,
          restaurant_tables ( name ),
          kitchen_order_items (
            id,
            quantity,
            remarks,
            product_id,
            products ( name )
          )
        `;
      const withStations = `
          id,
          status,
          created_at,
          table_id,
          invoice_id,
          station_id,
          kitchen_hub,
          restaurant_tables ( name ),
          kitchen_order_items (
            id,
            quantity,
            remarks,
            product_id,
            products ( name )
          )
        `;

      let { data, error } = await supabase
        .from("kitchen_orders")
        .select(withStations)
        .eq("shop_id", shopId)
        .in("status", ["cooking", "ready"])
        .order("created_at", { ascending: true });

      if (
        error &&
        (error.message?.includes("station_id") ||
          error.message?.includes("kitchen_hub") ||
          error.message?.includes("schema cache") ||
          error.message?.includes("does not exist"))
      ) {
        ({ data, error } = await supabase
          .from("kitchen_orders")
          .select(baseSelect)
          .eq("shop_id", shopId)
          .in("status", ["cooking", "ready"])
          .order("created_at", { ascending: true }));
      }

      if (error) throw error;

      const invoiceIds = [
        ...new Set(
          (data || [])
            .map((o: any) => o.invoice_id)
            .filter(Boolean) as string[]
        ),
      ];

      let invoiceMeta: Record<
        string,
        {
          service_type?: string | null;
          order_number?: string | null;
          restaurant_order_status?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_address?: string | null;
          special_instructions?: string | null;
        }
      > = {};

      if (invoiceIds.length > 0) {
        const { data: invRows } = await supabase
          .from("invoices")
          .select(
            "id, service_type, order_number, restaurant_order_status, customer_name, customer_phone, customer_address, special_instructions"
          )
          .in("id", invoiceIds);
        for (const row of invRows || []) {
          invoiceMeta[row.id] = {
            service_type: row.service_type,
            order_number: row.order_number,
            restaurant_order_status: row.restaurant_order_status,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            customer_address: row.customer_address,
            special_instructions: row.special_instructions,
          };
        }
      }

      const formatted: KdsTicket[] = (data || []).map((o: any) => {
        const meta = o.invoice_id ? invoiceMeta[o.invoice_id] : undefined;
        return {
          id: o.id,
          created_at: o.created_at,
          status: o.status as "cooking" | "ready",
          invoice_id: o.invoice_id || null,
          table_id: o.table_id,
          table_name: o.restaurant_tables?.name || "Counter",
          service_type: meta?.service_type || (o.table_id ? "dining" : "takeaway"),
          order_number: meta?.order_number || null,
          station_id: o.station_id || null,
          kitchen_hub: o.kitchen_hub || null,
          invoice_status: normalizeOrderStatus(meta?.restaurant_order_status) || "pending",
          customer_name: meta?.customer_name || null,
          customer_phone: meta?.customer_phone || null,
          customer_address: meta?.customer_address || null,
          special_instructions: meta?.special_instructions || null,
          items: (o.kitchen_order_items || []).map((item: any) => ({
            id: item.id,
            quantity: Number(item.quantity),
            remarks: item.remarks || null,
            product_name: item.products?.name || "Item",
          })),
        };
      });

      if (announceNew) {
        const nextIds = new Set(formatted.map((t) => t.id));
        for (const id of nextIds) {
          if (!knownIdsRef.current.has(id)) {
            playAlert();
            toast.success("New KOT on kitchen display", {
              description: `Ticket #${id.slice(0, 6).toUpperCase()}`,
            });
            break;
          }
        }
        knownIdsRef.current = nextIds;
      } else {
        knownIdsRef.current = new Set(formatted.map((t) => t.id));
      }

      setTickets(formatted);
    } catch (err: any) {
      console.error("KDS error:", err?.message || err);
      toast.error("Failed to load kitchen tickets: " + (err?.message || "unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const [printRes, companyRes] = await Promise.all([
        supabase.from("print_settings").select("*").eq("shop_id", shopId).maybeSingle(),
        supabase.from("company_details").select("name, phone, address, email").eq("shop_id", shopId).maybeSingle(),
      ]);
      if (printRes.data) setReceiptSettings(mergePrintSettingsFromRow(printRes.data as Record<string, unknown>));
      if (companyRes.data) setCompanyDetails(companyRes.data);
    })();
  }, [shopId, supabase]);

  const reprintKot = (t: KdsTicket) => {
    printRestaurantKOTSlip(
      {
        orderNumber: t.order_number,
        tableName: t.table_name,
        serviceType: t.service_type,
        customerName: t.customer_name,
        customerPhone: t.customer_phone,
        customerAddress: t.customer_address,
        specialInstructions: t.special_instructions,
        items: t.items.map((i) => ({
          name: i.product_name,
          quantity: i.quantity,
          remarks: i.remarks,
        })),
        settings: receiptSettings,
        shopDetails: {
          name: companyDetails?.name || shopName || "Restaurant",
          phone: companyDetails?.phone || shopPhone,
          address: companyDetails?.address || shopAddress,
          email: companyDetails?.email || shopEmail,
        },
        isReprint: true,
        kotTicketId: t.id,
      },
      {
        onError: (msg) => toast.error(msg),
      }
    );
    toast.success("KOT reprint sent to thermal printer");
  };

  useEffect(() => {
    if (!shopId) return;
    fetchStations(supabase, shopId).then(setStations);
    fetchActiveTickets(false);

    let pollId: ReturnType<typeof setInterval> | undefined;
    if (shouldPollKitchenLive()) {
      pollId = setInterval(() => fetchActiveTickets(false), KITCHEN_POLL_INTERVAL_MS);
    }

    const channel = supabase
      .channel(`kds_kitchen_orders_${shopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kitchen_orders",
          filter: `shop_id=eq.${shopId}`,
        },
        () => fetchActiveTickets(true)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kitchen_order_items" },
        () => fetchActiveTickets(false)
      )
      .subscribe();

    return () => {
      if (pollId) clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  const startCooking = async (ticket: KdsTicket) => {
    if (!ticket.invoice_id) {
      toast.error("This ticket is not linked to an order.");
      return;
    }
    try {
      await startOrderPreparation(supabase, ticket.invoice_id);
      toast.success("Cooking started");
      fetchActiveTickets(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to start");
    }
  };

  const cancelPendingTicket = async (ticket: KdsTicket) => {
    if (ticket.invoice_status !== "pending") {
      toast.error("Only pending (not started) orders can be cancelled from kitchen.");
      return;
    }
    if (!ticket.invoice_id) return;
    if (!window.confirm(`Cancel order ${ticket.order_number || ticket.id.slice(0, 6)} before cooking? Stock and cost will be reversed.`)) {
      return;
    }
    try {
      await cancelRestaurantOrder(supabase, ticket.invoice_id, ticket.table_id);
      toast.success("Order cancelled - stock restored, no cost.");
      fetchActiveTickets(false);
    } catch (err: any) {
      toast.error(err.message || "Cancel failed");
    }
  };

  const updateTicketStatus = async (
    ticket: KdsTicket,
    newStatus: "ready" | "served"
  ) => {
    try {
      const { error } = await supabase
        .from("kitchen_orders")
        .update({ status: newStatus })
        .eq("id", ticket.id);
      if (error) throw error;

      if (ticket.invoice_id) {
        await syncRestaurantOrderStatus(supabase, ticket.invoice_id);
      }

      toast.success(
        newStatus === "ready"
          ? "Ticket marked READY - waitstaff can pick up"
          : "Ticket bumped / served"
      );
      fetchActiveTickets(false);
    } catch (err: any) {
      toast.error("Failed to update ticket: " + err.message);
    }
  };

  const getTicketAge = (createdAt: string) => {
    const diffMs = now.getTime() - new Date(createdAt).getTime();
    return Math.floor(diffMs / 1000 / 60);
  };

  const serviceLabel = (t: KdsTicket) => {
    if (t.service_type === "delivery") return "Delivery";
    if (t.service_type === "takeaway") return "Takeaway";
    return `Table ${t.table_name}`;
  };

  const visibleTickets = tickets.filter((t) => {
    if (stationFilter !== "all" && t.station_id !== stationFilter) return false;
    if (hubFilter !== "all" && (t.kitchen_hub || "Main Kitchen") !== hubFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-900 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/restaurant/pos">
            <button
              type="button"
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition"
            >
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500 rounded-xl text-slate-950">
              <ChefHat className="h-4 w-4 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-400 font-bold hidden sm:block">
              Live Kitchen Queue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={hubFilter}
            onChange={(e) => setHubFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl h-9 px-2"
          >
            <option value="all">All kitchens</option>
            {Array.from(new Set(stations.map((s) => s.kitchen_hub || "Main Kitchen"))).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl h-9 px-2"
          >
            <option value="all">All stations</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="border-slate-800 bg-slate-900 text-slate-300 font-bold hover:bg-slate-850 h-9 rounded-xl px-3"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchActiveTickets(false)}
            className="border-slate-800 bg-slate-900 text-slate-300 font-bold hover:bg-slate-850 h-9 rounded-xl px-3"
          >
            <RefreshCw
              size={14}
              className={`mr-1.5 ${loading ? "animate-spin text-amber-500" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 flex gap-6 items-start">
        {loading ? (
          <div className="flex-1 h-80 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="animate-spin h-8 w-8 text-amber-500 mb-3" />
            <p className="text-xs">Loading live kitchen queue...</p>
          </div>
        ) : visibleTickets.length === 0 ? (
          <div className="flex-1 h-80 flex flex-col items-center justify-center text-slate-600 border border-dashed border-slate-900 rounded-3xl p-12 bg-slate-950/20">
            <ChefHat size={48} className="text-slate-800 mb-3" />
            <p className="text-sm font-bold text-slate-400">All caught up!</p>
            <p className="text-[11px] text-slate-600 mt-1">
              No cooking/ready KOTs right now.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {visibleTickets.map((t) => {
              const age = getTicketAge(t.created_at);
              let ageColor =
                "border-emerald-500 bg-emerald-500/10 text-emerald-400";
              let badgePulse = "";
              if (age >= 10 && age < 20) {
                ageColor = "border-amber-500 bg-amber-500/10 text-amber-400";
              } else if (age >= 20) {
                ageColor = "border-rose-600 bg-rose-950/20 text-rose-500";
                badgePulse = "animate-pulse";
              }

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`w-72 border bg-slate-900/60 backdrop-blur rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-lg ${
                    t.status === "ready"
                      ? "border-emerald-500/50 shadow-emerald-950/10"
                      : "border-amber-500/40 shadow-amber-950/10"
                  }`}
                >
                  <div
                    className={`p-4 border-b border-slate-800 flex justify-between items-start gap-2 ${
                      t.status === "ready" ? "bg-emerald-500/5" : "bg-amber-500/5"
                    }`}
                  >
                    <div>
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                        {serviceLabel(t)}
                      </div>
                      <h4 className="font-black text-sm text-white mt-0.5">
                        {t.order_number
                          ? `Order ${t.order_number}`
                          : `KOT #${t.id.slice(0, 6).toUpperCase()}`}
                      </h4>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        {t.status === "cooking" ? "Cooking" : "Ready for pickup"}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full ${ageColor} ${badgePulse}`}
                    >
                      <Clock size={10} />
                      <div>{age}m</div>
                    </div>
                  </div>

                  <div className="flex-1 p-4 space-y-3.5 overflow-y-auto max-h-[300px]">
                    {t.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start gap-3">
                        <div>
                          <p className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
                            <div className="text-amber-500 font-mono text-base font-black">
                              x{item.quantity}
                            </div>
                            {item.product_name}
                          </p>
                          {item.remarks ? (
                            <div className="text-[10px] text-amber-400 font-bold block bg-amber-950/20 border border-amber-900/40 px-2 py-0.5 rounded mt-1">
                              Note: {item.remarks}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-950/80 border-t border-slate-850 flex gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => reprintKot(t)}
                      className="h-9 px-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-[10px] font-bold flex items-center gap-1"
                      title="Reprint KOT thermal"
                    >
                      <Printer size={13} /> KOT
                    </button>
                    {t.status === "cooking" && t.invoice_status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startCooking(t)}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black h-9 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <Play size={13} className="fill-current" /> Start
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelPendingTicket(t)}
                          className="h-9 px-3 rounded-xl border border-rose-800 text-rose-400 hover:bg-rose-950/40 transition"
                          title="Cancel before cooking"
                        >
                          <Ban size={14} />
                        </button>
                      </>
                    ) : t.status === "cooking" ? (
                      <button
                        type="button"
                        onClick={() => updateTicketStatus(t, "ready")}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black h-9 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Play size={13} className="fill-current" /> Mark Ready
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateTicketStatus(t, "served")}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black h-9 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <CheckCircle2 size={13} /> Bump / Served
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
