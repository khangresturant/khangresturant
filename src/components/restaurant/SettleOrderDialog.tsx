"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { settleRestaurantOrder } from "@/lib/restaurant-orders";
import {
  isDeliveryService,
  pickAccountForPayment,
  RESTAURANT_PAYMENT_MODES,
  type RestaurantPaymentMode,
} from "@/lib/restaurant-riders";
import { printRestaurantPaidReceipt } from "@/lib/restaurant-receipt-print";
import { mergeRestaurantPrintProfile } from "@/lib/restaurant-print-profile";
import { DEFAULT_RECEIPT_SETTINGS, type ReceiptSettings } from "@/components/ReceiptTemplate";

export type SettleOrderData = {
  id: string;
  order_number: string | null;
  total_amount: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  party_id: string | null;
  table_id: string | null;
  waiter_id?: string | null;
  rider_id?: string | null;
  service_type: string | null;
  tableName?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  waiterName?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  special_instructions?: string | null;
  delivery_fee?: number | null;
  additional_charges?: number | null;
  invoice_items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    menu_size_id?: string | null;
    menu_size_name?: string | null;
    packing_name?: string | null;
  }[];
  /** Display names for thermal receipt (cart / invoice lines). */
  line_items?: { name: string; quantity: number; unit_price: number }[];
};

type Props = {
  open: boolean;
  order: SettleOrderData | null;
  onClose: () => void;
  onSettled: () => void;
  receiptSettings?: Partial<ReceiptSettings>;
  shopDetails?: {
    name: string;
    phone?: string | null;
    address?: string | null;
    email?: string | null;
  };
  printThermalReceipt?: boolean;
};

export function SettleOrderDialog({
  open,
  order,
  onClose,
  onSettled,
  receiptSettings: receiptSettingsProp,
  shopDetails: shopDetailsProp,
  printThermalReceipt = true,
}: Props) {
  const { shopId, shopName, shopPhone, shopAddress, shopEmail } = useShop();
  const { language } = useLanguage();
  const supabase = createClient();
  const isEn = language === "en";

  const [paymentMode, setPaymentMode] = useState<RestaurantPaymentMode>("cash");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("walkin");
  const [discountVal, setDiscountVal] = useState(0);
  const [taxRateVal, setTaxRateVal] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [cashAccounts, setCashAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string | null; current_balance?: number }[]>([]);
  const [activeSession, setActiveSession] = useState<{ id: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !shopId) return;
    (async () => {
      const [accRes, custRes, sessRes] = await Promise.all([
        supabase.from("cash_accounts").select("id, name, current_balance").eq("shop_id", shopId),
        supabase.from("parties").select("id, name, phone, current_balance").eq("shop_id", shopId).eq("type", "customer"),
        supabase.from("register_sessions").select("id").eq("shop_id", shopId).eq("status", "open").limit(1).maybeSingle(),
      ]);
      setCashAccounts(accRes.data || []);
      setCustomers(custRes.data || []);
      setActiveSession(sessRes.data);
      if (accRes.data?.length) {
        setSelectedAccountId(pickAccountForPayment(accRes.data, "cash"));
      }
    })();
  }, [open, shopId, supabase]);

  useEffect(() => {
    if (!order) return;
    setDiscountVal(Number(order.discount) || 0);
    setTaxRateVal(Number(order.tax_rate) || 0);
    setReceivedAmount(Number(order.total_amount) || 0);
    setSelectedCustomerId(order.party_id || "walkin");
    setPaymentMode("cash");
    if (cashAccounts.length) {
      setSelectedAccountId(pickAccountForPayment(cashAccounts, "cash"));
    }
  }, [order]);

  const subtotal = useMemo(
    () => order?.invoice_items.reduce((s, i) => s + i.unit_price * i.quantity, 0) || 0,
    [order]
  );
  const taxAmount = (subtotal * taxRateVal) / 100;
  const netTotal = Math.max(0, subtotal + taxAmount - discountVal);
  const remainingDue = Math.max(0, netTotal - receivedAmount);

  const handleSettle = async () => {
    if (!order || !shopId) return;
    if (paymentMode === "credit" && selectedCustomerId === "walkin") {
      toast.error(isEn ? "Select a customer for credit sales" : "ادھار کے لیے گاہک منتخب کریں");
      return;
    }
    if (isDeliveryService(order.service_type) && !order.rider_id && !order.riderName) {
      toast.error(
        isEn
          ? "Assign a rider on this delivery order before payment."
          : "ڈیلیوری ادائیگی سے پہلے رائیڈر لگائیں۔"
      );
      return;
    }
    setSubmitting(true);
    try {
      await settleRestaurantOrder(supabase, {
        shopId,
        invoiceId: order.id,
        items: order.invoice_items,
        netTotal,
        taxAmount,
        taxRate: taxRateVal,
        discount: discountVal,
        paymentMode,
        receivedAmount: paymentMode === "credit" ? receivedAmount : netTotal,
        partyId: selectedCustomerId === "walkin" ? null : selectedCustomerId,
        accountId: paymentMode !== "credit" ? selectedAccountId : null,
        registerSessionId: activeSession?.id || null,
        waiterId: order.waiter_id,
        riderId: order.rider_id,
        tableId: order.table_id,
      });

      if (printThermalReceipt) {
        let settings = receiptSettingsProp;
        let companyRow: Record<string, unknown> | null = null;
        if (shopId) {
          const [{ data: printRow }, { data: company }] = await Promise.all([
            supabase
              .from("print_settings")
              .select("receipt_page_size, receipt_font, receipt_font_size, receipt_design_settings")
              .eq("shop_id", shopId)
              .maybeSingle(),
            supabase.from("company_details").select("*").eq("shop_id", shopId).maybeSingle(),
          ]);
          companyRow = (company as Record<string, unknown>) || null;
          if (!settings) {
            settings = mergeRestaurantPrintProfile(companyRow, printRow as Record<string, unknown>);
          }
        }
        const selectedParty = customers.find((c) => c.id === selectedCustomerId);
        const customer =
          order.customer_name ||
          selectedParty?.name ||
          (selectedCustomerId === "walkin" ? "Walk-in Guest" : null);
        const lines =
          order.line_items?.length
            ? order.line_items
            : order.invoice_items.map((i) => ({
                name: "Item",
                quantity: i.quantity,
                unit_price: i.unit_price,
              }));
        printRestaurantPaidReceipt(
          {
            invoiceId: order.id,
            orderNumber: order.order_number,
            tableName: order.tableName || null,
            serviceType: order.service_type,
            customerName: customer,
            customerPhone: order.customer_phone || selectedParty?.phone || null,
            customerAddress: order.customer_address || null,
            waiterName: order.waiterName || null,
            riderName: order.riderName || null,
            riderPhone: order.riderPhone || null,
            specialInstructions: order.special_instructions || null,
            deliveryFee: order.delivery_fee || 0,
            additionalCharges: order.additional_charges || 0,
            paymentMode,
            items: lines,
            subtotal,
            discount: discountVal,
            taxRate: taxRateVal,
            taxAmount,
            netTotal,
            paidAmount: paymentMode === "credit" ? receivedAmount : netTotal,
            remainingDue,
            settings: settings || DEFAULT_RECEIPT_SETTINGS,
            shopDetails: shopDetailsProp || {
              name: shopName || "Restaurant",
              phone: shopPhone,
              address: shopAddress,
              email: shopEmail,
            },
            companyRow,
          },
          {
            onError: (msg) => {
              toast.error(
                isEn
                  ? `${msg} (Windows: Settings → Printers → set thermal as default)`
                  : `${msg} - Windows میں تھرمل پرنٹر ڈیفالٹ بنائیں`
              );
            },
          }
        );
        // Let browser open print dialog before closing modal
        await new Promise((r) => setTimeout(r, 500));
      }

      toast.success(
        isEn
          ? "Payment done - check thermal printer / print dialog."
          : "ادائیگی مکمل - تھرمل رسید پرنٹ کریں۔"
      );
      onSettled();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden"
      >
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="text-blue-600" size={18} />
              {isEn ? "Payment & thermal receipt" : "ادائیگی + تھرمل رسید"}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              #{order.order_number || order.id.slice(0, 8).toUpperCase()} · {order.tableName || order.service_type}
            </p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-1">
              {isEn
                ? "After you confirm, the paid thermal bill prints (80/58mm)."
                : "Confirm کے بعد ادائیگی کی تھرمل رسید پرنٹ ہوگی۔"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-5 gap-1.5">
            {RESTAURANT_PAYMENT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setPaymentMode(mode.id);
                  setReceivedAmount(mode.id === "credit" ? 0 : netTotal);
                  if (mode.id !== "credit" && cashAccounts.length) {
                    setSelectedAccountId(pickAccountForPayment(cashAccounts, mode.id));
                  }
                }}
                className={`py-2 text-[10px] font-bold rounded-lg border ${
                  paymentMode === mode.id ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200"
                }`}
              >
                {isEn ? mode.label : mode.labelUr}
              </button>
            ))}
          </div>
          {isDeliveryService(order.service_type) && (
            <p className="text-[10px] text-slate-600">
              {isEn ? "Rider:" : "رائیڈر:"}{" "}
              <strong>
                {order.riderName
                  ? `${order.riderName}${order.riderPhone ? ` · ${order.riderPhone}` : ""}`
                  : isEn
                    ? "Not assigned"
                    : "غیر مقرر"}
              </strong>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Discount</label>
              <Input type="number" value={discountVal} onChange={(e) => setDiscountVal(Number(e.target.value))} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Tax %</label>
              <Input type="number" value={taxRateVal} onChange={(e) => setTaxRateVal(Number(e.target.value))} className="h-8 text-xs mt-1" />
            </div>
          </div>

          {paymentMode !== "credit" && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                {paymentMode === "cash"
                  ? isEn
                    ? "Cash account"
                    : "نقد اکاؤنٹ"
                  : paymentMode === "online"
                    ? isEn
                      ? "Online / wallet account"
                      : "آن لائن اکاؤنٹ"
                    : isEn
                      ? "Bank account"
                      : "بینک اکاؤنٹ"}
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full mt-1 border rounded-lg h-9 text-xs px-2"
              >
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} (Rs {Number(a.current_balance).toLocaleString()})</option>
                ))}
              </select>
            </div>
          )}

          {paymentMode === "credit" && (
            <>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full mt-1 border rounded-lg h-9 text-xs px-2"
                >
                  <option value="walkin">Walk-in (no credit)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Paid amount</label>
                <Input type="number" value={receivedAmount} onChange={(e) => setReceivedAmount(Number(e.target.value))} className="h-8 text-xs mt-1" />
              </div>
            </>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex justify-between font-bold text-sm">
            <div>{isEn ? "Net payable" : "کل رقم"}</div>
            <div className="font-mono text-blue-700">Rs {netTotal.toLocaleString()}</div>
          </div>
          {paymentMode === "credit" && remainingDue > 0 && (
            <p className="text-xs text-amber-700 font-semibold">Credit due: Rs {remainingDue.toLocaleString()}</p>
          )}

          <Button
            onClick={handleSettle}
            disabled={submitting || (paymentMode === "credit" && selectedCustomerId === "walkin")}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
          >
            {submitting ? (
              <Loader2 className="animate-spin" />
            ) : isEn ? (
              "Confirm payment & print thermal receipt"
            ) : (
              "ادائیگی کریں - تھرمل رسید"
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
