"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Receipt, Calendar, DollarSign, CreditCard, CheckCircle, 
  AlertCircle, Trash2, Edit, Eye, X, Printer, Loader2, Filter, 
  ArrowUpRight, ShoppingCart, RefreshCcw, Download, Car, FileText, ExternalLink,
  MessageCircle, Share2, Package
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isMoneyRpcEnabled, restoreInvoiceRpc, voidInvoiceRpc } from "@/lib/money/rpc";
import { withOfflineRead } from "@/lib/sync/offlineData";
import { MobileCardList, MobileDataCard } from "@/components/mobile/MobileDataCard";
import { ReceiptTemplate, DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import { ShowroomDeedPrintModal } from "@/components/showroom/ShowroomDeedPrintModal";
import { printReceiptDirect } from "@/lib/thermalPrinter";
import { formatDateTime, isTodayInTimezone, isWithinDaysInTimezone, getDateStringInTimezone } from "@/lib/timezone";

type Invoice = {
  id: string;
  created_at: string;
  total_amount: number;
  tax_amount: number;
  discount: number;
  status: "paid" | "unpaid" | "partial" | "quotation";
  paid_amount: number;
  is_edited: boolean | null;
  is_voided: boolean | null;
  party_id: string | null;
  edit_history?: any[] | null;
  remarks?: string | null;
  parties: {
    name: string;
    phone: string | null;
    current_balance?: number | null;
  } | null;
  is_showroom_inst?: boolean;
  is_showroom_veh?: boolean;
  showroom_data?: any;
  items_summary?: string;
  invoice_items_list?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    name: string;
    unit?: string | null;
    packing_name?: string | null;
  }>;
};

type InvoiceItem = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    unit: string | null;
  } | null;
  variant_id: string | null;
  product_variants?: {
    packing_name: string;
  } | null;
  sold_imeis?: string | null;
  warranty?: string | null;
};

export default function SalesHistoryPage() {
  const { shopId, shopName, permissions, industryType, activeClosingBook, timezone } = useShop();
  const supabase = createClient();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Active subtab state ("active" vs "trash" vs "quotation")
  const [activeSubTab, setActiveSubTab] = useState<"active" | "trash" | "quotation">("active");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid" | "partial">("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState<"all" | "cash" | "credit">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Receipt Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Showroom Deed & Legal Agreement Modal State
  const [selectedDeedTarget, setSelectedDeedTarget] = useState<{
    vehicle: any;
    buyer: any;
    seller?: any;
    installment?: any;
    schedules?: any[];
    saleType: "cash" | "installment";
    salePrice: number;
    downPayment?: number;
    saleDate?: string;
  } | null>(null);
  const [isDeedOpen, setIsDeedOpen] = useState(false);

  // Voiding/Restoring Loaders
  const [voidingInvoiceId, setVoidingInvoiceId] = useState<string | null>(null);
  const [restoringInvoiceId, setRestoringInvoiceId] = useState<string | null>(null);

  // Edit History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyTitle, setHistoryTitle] = useState("");

  // Receipt Settings & Shop Details State
  const [receiptSettings, setReceiptSettings] = useState<any>(DEFAULT_RECEIPT_SETTINGS);
  const [shopDetails, setShopDetails] = useState<{ name: string; phone?: string; address?: string; email?: string; website?: string }>({
    name: shopName || "The Accounts Store"
  });

  useEffect(() => {
    if (shopId) {
      fetchInvoices();
      fetchReceiptAndShopDetails();
    }
  }, [shopId, activeClosingBook]);

  const fetchReceiptAndShopDetails = async () => {
    try {
      const { data: shopData } = await supabase
        .from("shops")
        .select("name, phone, address, email, website, receipt_page_size, receipt_font, receipt_font_size, receipt_design_settings")
        .eq("id", shopId!)
        .single();

      if (shopData) {
        const storedCustomSettings = shopData.receipt_design_settings || {};
        setReceiptSettings({
          ...DEFAULT_RECEIPT_SETTINGS,
          pageSize: (shopData.receipt_page_size as any) || DEFAULT_RECEIPT_SETTINGS.pageSize,
          fontFamily: shopData.receipt_font || DEFAULT_RECEIPT_SETTINGS.fontFamily,
          fontSize: shopData.receipt_font_size || DEFAULT_RECEIPT_SETTINGS.fontSize,
          ...storedCustomSettings
        });
        setShopDetails({
          name: shopData.name || shopName || "The Accounts Store",
          phone: shopData.phone || undefined,
          address: shopData.address || undefined,
          email: shopData.email || undefined,
          website: shopData.website || undefined,
        });
      }
    } catch (err) {
      console.error("Error loading receipt settings in sales history:", err);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const mapInvoices = (data: any[]) =>
        (data || []).map((inv: any) => {
          let customerInfo = null;
          if (inv.parties) {
            customerInfo = Array.isArray(inv.parties) ? inv.parties[0] || null : inv.parties;
          }

          const rawItems = Array.isArray(inv.invoice_items) ? inv.invoice_items : [];
          const itemsList = rawItems.map((it: any) => {
            const p = Array.isArray(it.products) ? it.products[0] : it.products;
            const v = Array.isArray(it.product_variants) ? it.product_variants[0] : it.product_variants;
            return {
              id: it.id,
              quantity: Number(it.quantity || 1),
              unit_price: Number(it.unit_price || 0),
              name: p?.name || it.custom_name || "Item",
              unit: p?.unit || null,
              packing_name: v?.packing_name || null,
            };
          });

          const summary = itemsList
            .map((it: any) => `${it.name}${it.packing_name ? ` (${it.packing_name})` : ""}${it.quantity > 1 ? ` (x${it.quantity})` : ""}`)
            .join(", ");

          return {
            id: inv.id,
            created_at: inv.created_at,
            total_amount: Number(inv.total_amount),
            tax_amount: Number(inv.tax_amount),
            discount: Number(inv.discount),
            status: inv.status,
            paid_amount: Number(inv.paid_amount || 0),
            is_edited: inv.is_edited,
            is_voided: inv.is_voided,
            party_id: inv.party_id,
            edit_history: inv.edit_history,
            remarks: inv.remarks,
            parties: customerInfo,
            items_summary: summary,
            invoice_items_list: itemsList,
          };
        });

      const mappedInvoices = await withOfflineRead({
        shopId: shopId!,
        online: async () => {
          let query = supabase
            .from("invoices")
            .select(`
              id, created_at, total_amount, tax_amount, discount, status, paid_amount,
              is_edited, is_voided, party_id, edit_history, remarks,
              parties ( name, phone, current_balance ),
              invoice_items (
                id, quantity, unit_price, subtotal,
                products ( name, unit ),
                product_variants ( packing_name )
              )
            `)
            .eq("shop_id", shopId)
            .neq("status", "draft");

          const [invRes, instRes, vehRes] = await Promise.all([
            query.order("created_at", { ascending: false }).limit(2000),
            supabase
              .from("showroom_installments")
              .select(`*, showroom_vehicles (*)`)
              .eq("shop_id", shopId)
              .order("created_at", { ascending: false }),
            supabase
              .from("showroom_vehicles")
              .select("*")
              .eq("shop_id", shopId)
              .eq("status", "sold")
              .order("sold_at", { ascending: false }),
          ]);

          if (invRes.error) throw invRes.error;

          const regularInvoices = mapInvoices(invRes.data || []);

          const showroomInstInvoices = (instRes.data || []).map((inst: any) => {
            const v = inst.showroom_vehicles;
            const vName = v
              ? `${v.make} ${v.model} (${v.year || ""}) - ${v.is_applied_for ? "Applied For" : (v.plate_number || "")}`
              : "Vehicle";
            const paid = Number(inst.total_paid || 0);
            const total = Number(inst.total_price || 0);
            const rem = Number(inst.remaining_balance ?? (total - paid));
            const status = rem <= 0 ? "paid" : (paid > 0 ? "partial" : "unpaid");

            return {
              id: `AGR-${inst.agreement_number || inst.id.slice(0, 8).toUpperCase()}`,
              created_at: inst.start_date || inst.created_at,
              total_amount: total,
              tax_amount: 0,
              discount: 0,
              status: status as "paid" | "partial" | "unpaid",
              paid_amount: paid,
              is_edited: false,
              is_voided: false,
              party_id: inst.party_id || null,
              edit_history: null,
              remarks: `🚗 Vehicle Installment Agreement: ${vName}`,
              parties: {
                name: inst.customer_name,
                phone: inst.customer_phone || null,
              },
              is_showroom_inst: true,
              showroom_data: inst,
              items_summary: vName,
              invoice_items_list: [{ id: "inst-v", quantity: 1, unit_price: total, name: vName }],
            };
          });

          const showroomVehInvoices = (vehRes.data || []).map((v: any) => {
            const vName = `${v.make} ${v.model} (${v.year || ""}) - ${v.is_applied_for ? "Applied For" : (v.plate_number || "")}`;
            const price = Number(v.sold_price || v.price || 0);
            return {
              id: `VEH-${v.id.slice(0, 8).toUpperCase()}`,
              created_at: v.sold_at || v.updated_at || v.created_at,
              total_amount: price,
              tax_amount: 0,
              discount: 0,
              status: "paid" as const,
              paid_amount: price,
              is_edited: false,
              is_voided: false,
              party_id: v.purchase_party_id || null,
              edit_history: null,
              remarks: `🚗 Vehicle Cash Sale: ${vName}`,
              parties: {
                name: v.buyer_name || "Cash Buyer",
                phone: v.buyer_phone || null,
              },
              is_showroom_veh: true,
              showroom_data: v,
              items_summary: vName,
              invoice_items_list: [{ id: "veh-v", quantity: 1, unit_price: price, name: vName }],
            };
          });

          const combined = [...regularInvoices, ...showroomInstInvoices, ...showroomVehInvoices];
          combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return combined;
        },
        offline: (snap) => mapInvoices(snap.invoices),
        onOfflineUsed: (savedAt) => {
          toast.message("Offline mode — showing cached sales", {
            description: savedAt ? `Last synced ${new Date(savedAt).toLocaleString()}` : undefined,
          });
        },
      });

      setInvoices(mappedInvoices);
    } catch (err: any) {
      toast.error("Failed to load sales invoices: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShowHistory = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setHistoryItems(invoice.edit_history || []);
    setHistoryTitle(`Bill Edit History: #${invoice.id.slice(0, 8).toUpperCase()}`);
    setIsHistoryOpen(true);
    setLoadingItems(true);

    if (invoice.is_showroom_inst || invoice.is_showroom_veh) {
      setSelectedInvoiceItems([
        {
          id: "shw-item-history",
          quantity: 1,
          unit_price: invoice.total_amount,
          subtotal: invoice.total_amount,
          products: {
            name: invoice.remarks || "Vehicle",
            unit: "Unit",
          },
          variant_id: null,
        },
      ]);
      setLoadingItems(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("invoice_items")
        .select(`
          id, quantity, unit_price, subtotal, sold_imeis, warranty,
          products ( name, unit ),
          product_variants ( packing_name )
        `)
        .eq("invoice_id", invoice.id);
      
      if (!error && data) {
        setSelectedInvoiceItems(data as any[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleViewReceipt = async (invoice: Invoice) => {
    if (invoice.is_showroom_inst) {
      const inst = invoice.showroom_data || {};
      const veh = inst.showroom_vehicles || {
        id: inst.vehicle_id || "v-unknown",
        make: "Vehicle",
        model: "",
        year: null,
        plate_number: "",
        is_applied_for: false,
        chassis_number: "",
        engine_number: "",
        price: inst.total_price,
      };

      let scheds: any[] = [];
      try {
        const { data: sData } = await supabase
          .from("showroom_installment_schedules")
          .select("*")
          .eq("installment_id", inst.id)
          .order("installment_no", { ascending: true });
        if (sData) scheds = sData;
      } catch (e) {
        console.error("Error fetching schedules for deed:", e);
      }

      setSelectedDeedTarget({
        vehicle: veh,
        buyer: {
          name: inst.customer_name,
          father_name: inst.customer_father_name,
          caste: inst.customer_caste,
          cnic: inst.customer_cnic,
          phone: inst.customer_phone,
          address: inst.customer_address,
        },
        installment: inst,
        schedules: scheds,
        saleType: "installment",
        salePrice: Number(inst.total_price || invoice.total_amount),
        downPayment: Number(inst.down_payment || 0),
        saleDate: inst.start_date || invoice.created_at,
      });
      setIsDeedOpen(true);
      return;
    }

    if (invoice.is_showroom_veh) {
      const veh = invoice.showroom_data || {};
      setSelectedDeedTarget({
        vehicle: veh,
        buyer: {
          name: veh.buyer_name || invoice.parties?.name || "Cash Buyer",
          phone: veh.buyer_phone || invoice.parties?.phone,
          cnic: veh.buyer_cnic,
        },
        installment: null,
        schedules: [],
        saleType: "cash",
        salePrice: Number(veh.sold_price || invoice.total_amount),
        downPayment: Number(veh.sold_price || invoice.total_amount),
        saleDate: veh.sold_at || invoice.created_at,
      });
      setIsDeedOpen(true);
      return;
    }

    setSelectedInvoice(invoice);
    setIsReceiptOpen(true);
    setLoadingItems(true);

    try {
      const { data, error } = await supabase
        .from("invoice_items")
        .select(`
          id,
          quantity,
          unit_price,
          subtotal,
          products ( name, unit, translated_names ),
          variant_id,
          packing_name,
          sold_imeis,
          warranty
        `)
        .eq("invoice_id", invoice.id);

      if (error) throw error;

      const items = data || [];
      const populatedItems: InvoiceItem[] = [];
      const missingVariantIds = items
        .filter((item: any) => item.variant_id && !item.packing_name)
        .map((item: any) => item.variant_id);

      let variantMap: Record<string, string> = {};
      if (missingVariantIds.length > 0) {
        const { data: vData } = await supabase
          .from("product_variants")
          .select("id, packing_name")
          .in("id", Array.from(new Set(missingVariantIds)));
        if (vData) {
          vData.forEach((v: any) => {
            variantMap[v.id] = v.packing_name;
          });
        }
      }

      for (const item of items) {
        let productInfo = null;
        if (item.products) {
          if (Array.isArray(item.products)) {
            productInfo = item.products[0] || null;
          } else {
            productInfo = item.products;
          }
        }

        const packingName = (item as any).packing_name || (item.variant_id ? variantMap[item.variant_id] : null);
        const finalVariantInfo = packingName ? { packing_name: packingName } : null;

        populatedItems.push({
          id: item.id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
          products: productInfo,
          variant_id: item.variant_id,
          product_variants: finalVariantInfo,
          sold_imeis: item.sold_imeis,
          warranty: item.warranty
        });
      }

      setSelectedInvoiceItems(populatedItems);
    } catch (err: any) {
      toast.error("Failed to load invoice items: " + err.message);
    } finally {
      setLoadingItems(false);
    }
  };

  // Void/Delete sale (Soft delete)
  const handleVoidInvoice = async (invoice: Invoice) => {
    if (permissions?.actions?.delete_bill === false) {
      toast.error("Access Denied: You do not have permission to void bills.");
      return;
    }
    const isConfirmed = window.confirm(
      `⚠️ WARNING: Are you sure you want to VOID invoice #${invoice.id.slice(0, 8).toUpperCase()}?\n\nThis will:\n1. Restock all items back into inventory.\n2. Deduct credit balance from customer's Khata.\n3. Move this bill to the Trash Ledger.`
    );
    if (!isConfirmed) return;

    setVoidingInvoiceId(invoice.id);
    try {
      // Phase 2: atomic void_invoice RPC
      if (isMoneyRpcEnabled()) {
        try {
          await voidInvoiceRpc(supabase, invoice.id);
          toast.success(`Invoice #${invoice.id.slice(0, 8).toUpperCase()} voided successfully!`);
          fetchInvoices();
          return;
        } catch (rpcErr: any) {
          const msg = String(rpcErr?.message || "");
          if (!/function|does not exist|Could not find|schema cache/i.test(msg)) throw rpcErr;
          console.warn("[Sales] void_invoice RPC unavailable, legacy path:", msg);
        }
      }

      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("product_id, variant_id, quantity, batch_number")
        .eq("invoice_id", invoice.id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        for (const item of items) {
          // Restock into batch if batch_number was recorded
          if (item.batch_number && shopId) {
            const { data: bRow } = await supabase
              .from("product_batches")
              .select("id, stock_quantity")
              .eq("shop_id", shopId)
              .eq("product_id", item.product_id)
              .eq("batch_number", item.batch_number)
              .maybeSingle();

            if (bRow) {
              await supabase
                .from("product_batches")
                .update({ stock_quantity: (bRow.stock_quantity || 0) + Number(item.quantity) })
                .eq("id", bRow.id);
            }
          }

          if (item.variant_id) {
            const { data: v } = await supabase
              .from("product_variants")
              .select("is_packing, pack_size")
              .eq("id", item.variant_id)
              .maybeSingle();

            if (v && v.is_packing && v.pack_size && v.pack_size > 0) {
              await supabase.rpc("decrement_product_stock", {
                p_id: item.product_id,
                qty: -Number(item.quantity) * v.pack_size
              });
            } else {
              await supabase.rpc("decrement_variant_stock", {
                v_id: item.variant_id,
                qty: -Number(item.quantity)
              });
            }
          } else {
            await supabase.rpc("decrement_product_stock", {
              p_id: item.product_id,
              qty: -Number(item.quantity)
            });
          }
        }
      }

      if (invoice.party_id && invoice.status !== "paid" && invoice.status !== "quotation") {
        const unpaidAmt = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);
        if (unpaidAmt > 0) {
          const { error: khataError } = await supabase.rpc("increment_party_balance", {
            p_id: invoice.party_id,
            amount: -unpaidAmt
          });
          if (khataError) throw khataError;
        }
      }

      const { error: voidError } = await supabase
        .from("invoices")
        .update({ is_voided: true })
        .eq("id", invoice.id);

      if (voidError) throw voidError;

      toast.success(`Invoice #${invoice.id.slice(0, 8).toUpperCase()} voided successfully!`);
      fetchInvoices();
    } catch (err: any) {
      toast.error("Failed to void invoice: " + err.message);
    } finally {
      setVoidingInvoiceId(null);
    }
  };

  // Restore Voided/Soft-deleted invoice
  const handleRestoreInvoice = async (invoice: Invoice) => {
    if (permissions?.actions?.delete_bill === false) {
      toast.error("Access Denied: You do not have permission to restore bills.");
      return;
    }
    const isConfirmed = window.confirm(
      `🔄 Are you sure you want to RESTORE invoice #${invoice.id.slice(0, 8).toUpperCase()}?\n\nThis will:\n1. Re-deduct items from inventory stock.\n2. Re-apply unpaid credit balance to customer's Khata.\n3. Return this bill to the Active Sales ledger.`
    );
    if (!isConfirmed) return;

    setRestoringInvoiceId(invoice.id);
    try {
      if (isMoneyRpcEnabled()) {
        try {
          await restoreInvoiceRpc(supabase, invoice.id);
          toast.success(`Invoice #${invoice.id.slice(0, 8).toUpperCase()} restored successfully!`);
          fetchInvoices();
          return;
        } catch (rpcErr: any) {
          const msg = String(rpcErr?.message || "");
          if (!/function|does not exist|Could not find|schema cache/i.test(msg)) throw rpcErr;
          console.warn("[Sales] restore_invoice RPC unavailable, legacy path:", msg);
        }
      }

      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("product_id, variant_id, quantity, batch_number")
        .eq("invoice_id", invoice.id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        for (const item of items) {
          // Re-deduct from batch if batch_number was recorded
          if (item.batch_number && shopId) {
            const { data: bRow } = await supabase
              .from("product_batches")
              .select("id, stock_quantity")
              .eq("shop_id", shopId)
              .eq("product_id", item.product_id)
              .eq("batch_number", item.batch_number)
              .maybeSingle();

            if (bRow) {
              const newQty = Math.max(0, (bRow.stock_quantity || 0) - Number(item.quantity));
              await supabase
                .from("product_batches")
                .update({ stock_quantity: newQty })
                .eq("id", bRow.id);
            }
          }

          if (item.variant_id) {
            await supabase.rpc("decrement_variant_stock", {
              v_id: item.variant_id,
              qty: Number(item.quantity)
            });
          } else {
            await supabase.rpc("decrement_product_stock", {
              p_id: item.product_id,
              qty: Number(item.quantity)
            });
          }
        }
      }

      if (invoice.party_id && invoice.status !== "paid" && invoice.status !== "quotation") {
        const unpaidAmt = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);
        if (unpaidAmt > 0) {
          const { error: khataError } = await supabase.rpc("increment_party_balance", {
            p_id: invoice.party_id,
            amount: unpaidAmt
          });
          if (khataError) throw khataError;
        }
      }

      const { error: restoreError } = await supabase
        .from("invoices")
        .update({ is_voided: false })
        .eq("id", invoice.id);

      if (restoreError) throw restoreError;

      toast.success(`Invoice #${invoice.id.slice(0, 8).toUpperCase()} restored successfully!`);
      fetchInvoices();
    } catch (err: any) {
      toast.error("Failed to restore invoice: " + err.message);
    } finally {
      setRestoringInvoiceId(null);
    }
  };

  const handleShareWhatsApp = (inv: Invoice) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let billLink = `${origin}/public/receipt/${inv.id}`;
    if (inv.is_showroom_inst && inv.showroom_data?.id) {
      billLink = `${origin}/dashboard/showroom/installments/agreement/${inv.showroom_data.id}`;
    }

    const cName = inv.parties?.name || "Customer";
    const phone = (inv.parties?.phone || "").replace(/[^0-9]/g, "");
    const cleanPhone = phone.startsWith("0") ? "92" + phone.slice(1) : phone;

    const message =
      `السلام علیکم محترم *${cName}* صاحب!\n\n` +
      `*${shopName || "Our Store"}* کی جانب سے آپ کے بل کی مکمل تفصیل درج ذیل ہے:\n\n` +
      `📄 *بل نمبر:* #${inv.id.slice(0, 8).toUpperCase()}\n` +
      `📅 *تاریخ:* ${new Date(inv.created_at).toLocaleDateString("en-PK")}\n` +
      (inv.items_summary ? `🛍️ *خریداری اشیاء:* ${inv.items_summary}\n` : "") +
      `💰 *کُل بل:* Rs ${Number(inv.total_amount || 0).toLocaleString()}\n` +
      `💵 *نقد وصولی (Cash Received):* Rs ${Number(inv.paid_amount || 0).toLocaleString()}\n` +
      (Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)) > 0
        ? `⚠️ *بقیہ ادھار (Bill Balance):* Rs ${Math.max(0, Number(inv.total_amount || 0) - Number(inv.paid_amount || 0)).toLocaleString()}\n`
        : `✅ *اسٹیٹس:* مکمل ادا شدہ (Fully Paid)\n`) +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📥 *مکمل ڈیجیٹل بل دیکھیں / ڈاؤن لوڈ کریں (Digital Receipt):*\n👉 ${billLink}\n\n` +
      `خریداری کا بہت شکریہ! 🤝\n` +
      `منجانب: *${shopName || "Our Store"}*`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleDownloadPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(shopName || "THE ACCOUNTS", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Sales Invoices Ledger Report", 15, 26);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      const subTabLabel = activeSubTab === "active" ? "Active Invoices" : activeSubTab === "quotation" ? "Quotations" : "Voided / Trash Invoices";
      doc.text(`Scope: ${subTabLabel}`, 130, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date Generated: ${formatDateTime(new Date(), timezone)}`, 130, 26);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 30, 195, 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Total Sales Count: ${stats.invoiceCount}`, 15, 37);
      doc.text(`Total Revenue: Rs ${Math.round(stats.totalRevenue).toLocaleString()}`, 65, 37);
      doc.text(`Cash Collected: Rs ${Math.round(stats.cashReceived).toLocaleString()}`, 125, 37);

      const body = filteredInvoices.map(inv => {
        const customer = inv.parties ? `${inv.parties.name} (${inv.parties.phone || ""})` : "Walk-in Customer";
        const outstanding = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount || 0));
        return [
          `#${inv.id.slice(0, 8).toUpperCase()}`,
          formatDateTime(inv.created_at, timezone),
          customer,
          `Rs ${Math.round(inv.total_amount).toLocaleString()}`,
          `Rs ${Math.round(inv.paid_amount || 0).toLocaleString()}`,
          `Rs ${Math.round(outstanding).toLocaleString()}`,
          inv.status.toUpperCase()
        ];
      });

      autoTable(doc, {
        head: [["Invoice ID", "Date / Time", "Customer Account", "Invoice Total", "Cash Paid", "Due Balance", "Status"]],
        body: body,
        startY: 42,
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
        columnStyles: { 
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "center", fontStyle: "bold" }
        },
        margin: { left: 15, right: 15 }
      });

      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Powered by The Accounts POS", 15, 285);

      doc.save(`sales_report_${activeSubTab}_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("Sales report PDF downloaded successfully! 📄");
    } catch (err: any) {
      toast.error("Failed to generate Sales Report PDF: " + err.message);
    }
  };

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return invoices.filter(inv => {
      const isVoided = inv.is_voided === true;
      const isQuot = inv.status === "quotation";
      
      let matchesSubTab = false;
      if (activeSubTab === "quotation") {
        matchesSubTab = isQuot && !isVoided;
      } else if (activeSubTab === "trash") {
        matchesSubTab = isVoided;
      } else {
        matchesSubTab = !isVoided && !isQuot;
      }
      if (!matchesSubTab) return false;

      const matchesSearch = 
        !q ||
        inv.id.toLowerCase().includes(q) ||
        (inv.parties?.name || "Walk-in Customer").toLowerCase().includes(q) ||
        (inv.parties?.phone || "").includes(q) ||
        (inv.items_summary && inv.items_summary.toLowerCase().includes(q)) ||
        (inv.invoice_items_list && inv.invoice_items_list.some(it => 
          it.name.toLowerCase().includes(q) || 
          (it.packing_name && it.packing_name.toLowerCase().includes(q))
        )) ||
        (inv.remarks && inv.remarks.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

      let matchesPaymentMode = true;
      if (paymentModeFilter === "cash") {
        matchesPaymentMode = inv.status === "paid" && (inv.party_id === null || Number(inv.paid_amount) === Number(inv.total_amount));
      } else if (paymentModeFilter === "credit") {
        matchesPaymentMode = inv.status === "unpaid" || inv.status === "partial" || (inv.party_id !== null && Number(inv.paid_amount) < Number(inv.total_amount));
      }

      let matchesDate = true;
      if (dateFilter !== "all") {
        if (dateFilter === "today") {
          matchesDate = isTodayInTimezone(inv.created_at, timezone);
        } else if (dateFilter === "week") {
          matchesDate = isWithinDaysInTimezone(inv.created_at, 7, timezone);
        } else if (dateFilter === "month") {
          matchesDate = isWithinDaysInTimezone(inv.created_at, 30, timezone);
        } else if (dateFilter === "custom" && startDate) {
          const invDateStr = getDateStringInTimezone(inv.created_at, timezone);
          const end = endDate || startDate;
          matchesDate = invDateStr >= startDate && invDateStr <= end;
        }
      }

      return matchesSearch && matchesStatus && matchesPaymentMode && matchesDate;
    });
  }, [invoices, activeSubTab, searchQuery, statusFilter, paymentModeFilter, dateFilter, startDate, endDate]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let cashReceived = 0;
    let outstandingCredit = 0;

    const activeFiltered = invoices.filter(inv => {
      if (inv.is_voided === true) return false;
      if (inv.status === "quotation") return false;

      const matchesSearch = 
        inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.parties?.name || "Walk-in Customer").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.parties?.phone || "").includes(searchQuery);

      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

      let matchesPaymentMode = true;
      if (paymentModeFilter === "cash") {
        matchesPaymentMode = inv.status === "paid" && (inv.party_id === null || Number(inv.paid_amount) === Number(inv.total_amount));
      } else if (paymentModeFilter === "credit") {
        matchesPaymentMode = inv.status === "unpaid" || inv.status === "partial" || (inv.party_id !== null && Number(inv.paid_amount) < Number(inv.total_amount));
      }

      let matchesDate = true;
      if (dateFilter !== "all") {
        if (dateFilter === "today") {
          matchesDate = isTodayInTimezone(inv.created_at, timezone);
        } else if (dateFilter === "week") {
          matchesDate = isWithinDaysInTimezone(inv.created_at, 7, timezone);
        } else if (dateFilter === "month") {
          matchesDate = isWithinDaysInTimezone(inv.created_at, 30, timezone);
        } else if (dateFilter === "custom" && startDate) {
          const invDateStr = getDateStringInTimezone(inv.created_at, timezone);
          const end = endDate || startDate;
          matchesDate = invDateStr >= startDate && invDateStr <= end;
        }
      }

      return matchesSearch && matchesStatus && matchesPaymentMode && matchesDate;
    });

    let invoiceCount = activeFiltered.length;

    activeFiltered.forEach(inv => {
      const tot = Number(inv.total_amount);
      const paid = Number(inv.paid_amount || 0);
      
      totalRevenue += tot;
      cashReceived += paid;
      outstandingCredit += Math.max(0, tot - paid);
    });

    return {
      totalRevenue,
      cashReceived,
      outstandingCredit,
      invoiceCount
    };
  }, [invoices, searchQuery, statusFilter, paymentModeFilter, dateFilter, startDate, endDate]);

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-200/80 pb-2.5">
        <div>
          <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-800 flex items-center gap-2">
            <Receipt className="text-indigo-600 h-5 w-5" />
            Sales Ledger & Invoices
          </h1>
        </div>
        <div className="flex items-center gap-2 mobile-hide-actions-bar">
          {filteredInvoices.length > 0 && (
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              className="rounded-lg h-8 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border-indigo-200 shadow-2xs"
            >
              <Download size={13} className="mr-1.5" /> PDF Report
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={fetchInvoices} 
            className="rounded-lg h-8 text-xs font-bold text-slate-600 hover:bg-slate-50 border-slate-200 shadow-2xs"
          >
            <RefreshCcw size={13} className="mr-1.5" /> Reload
          </Button>
          <Link href="/dashboard/pos">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-8 rounded-lg text-xs shadow-2xs">
              <ShoppingCart size={13} className="mr-1.5" /> POS Terminal
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { 
            label: "Total Revenue", 
            val: `Rs ${Math.round(stats.totalRevenue).toLocaleString()}`, 
            icon: DollarSign, 
            bg: "bg-indigo-50/70 text-indigo-600 border-indigo-100" 
          },
          { 
            label: "Total Invoices", 
            val: stats.invoiceCount.toString(), 
            icon: Receipt, 
            bg: "bg-sky-50/70 text-sky-600 border-sky-100" 
          },
          { 
            label: "Cash Collected", 
            val: `Rs ${Math.round(stats.cashReceived).toLocaleString()}`, 
            icon: CheckCircle, 
            bg: "bg-emerald-50/70 text-emerald-600 border-emerald-100" 
          },
          { 
            label: "Udhaar (Outstanding)", 
            val: `Rs ${Math.round(stats.outstandingCredit).toLocaleString()}`, 
            icon: AlertCircle, 
            bg: "bg-rose-50/70 text-rose-600 border-rose-100" 
          }
        ].map((stat, i) => (
          <div 
            key={i}
            className={`p-3 bg-white border rounded-2xl shadow-2xs flex items-center justify-between transition-all ${stat.bg}`}
          >
            <div className="min-w-0 pr-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate">{stat.label}</p>
              <h3 className="text-base md:text-lg font-black text-slate-800 mt-0.5 truncate">{stat.val}</h3>
            </div>
            <div className="p-2 rounded-xl bg-white shadow-2xs border border-slate-100 shrink-0">
              <stat.icon className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search by Bill #, Customer, Phone, or Item Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 pr-7 h-8.5 text-xs bg-slate-50 border-slate-200 focus-visible:ring-indigo-500/20 rounded-lg shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Clear Search"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="w-full h-8.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer shadow-2xs"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid (Cleared)</option>
              <option value="partial">Partial Payment</option>
              <option value="unpaid">Unpaid (Credit)</option>
            </select>
          </div>
          <div>
            <select
              value={paymentModeFilter}
              onChange={(e: any) => setPaymentModeFilter(e.target.value)}
              className="w-full h-8.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer shadow-2xs"
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash / Card</option>
              <option value="credit">Credit / Udhaar</option>
            </select>
          </div>
          <div>
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="w-full h-8.5 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer shadow-2xs"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {dateFilter === "custom" && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-dashed border-slate-100"
          >
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
              <Input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">End Date</label>
              <Input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs rounded-lg"
              />
            </div>
          </motion.div>
        )}
      </div>

      <div className="space-y-3 font-sans">
        <div className="flex border-b border-slate-200 bg-white rounded-t-3xl border-t border-x border-slate-200/80 p-1.5 pb-0 shrink-0 select-none">
          <button
            onClick={() => setActiveSubTab("active")}
            className={`py-2.5 px-5 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 ${
              activeSubTab === "active"
                ? "border-indigo-600 text-indigo-600 font-black"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Active Bills
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              activeSubTab === "active" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "bg-slate-100 text-slate-500"
            }`}>
              {invoices.filter(i => !i.is_voided && i.status !== "quotation").length}
            </span>
          </button>
          {industryType === "hardware" && (
            <button
              onClick={() => setActiveSubTab("quotation")}
              className={`py-2.5 px-5 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 ${
                activeSubTab === "quotation"
                  ? "border-purple-600 text-purple-600 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              📄 Quotations / Estimates
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                activeSubTab === "quotation" ? "bg-purple-50 text-purple-700 shadow-sm" : "bg-slate-100 text-slate-500"
              }`}>
                {invoices.filter(i => i.status === "quotation" && !i.is_voided).length}
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveSubTab("trash")}
            className={`py-2.5 px-5 font-extrabold text-xs transition-all border-b-2 flex items-center gap-1.5 ${
              activeSubTab === "trash"
                ? "border-red-600 text-red-600 font-black"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            🗑 Trash / Voided Bills
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              activeSubTab === "trash" ? "bg-red-50 text-red-700 shadow-sm" : "bg-slate-100 text-slate-500"
            }`}>
              {invoices.filter(i => i.is_voided).length}
            </span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-b-3xl rounded-tr-3xl shadow-sm overflow-hidden p-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
              <span className="text-xs font-semibold">Loading ledger transactions...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-xs font-medium">
              No results found matching the filters.
            </div>
          ) : (
            <>
            <MobileCardList>
              {filteredInvoices.map((inv) => {
                const outstanding = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount || 0));
                const statusTone =
                  inv.status === "paid"
                    ? "success"
                    : inv.status === "partial"
                      ? "warning"
                      : inv.status === "quotation"
                        ? "purple"
                        : "danger";

                return (
                  <MobileDataCard
                    key={inv.id}
                    title={`#${inv.id.slice(0, 8).toUpperCase()}`}
                    subtitle={
                      inv.items_summary
                        ? `${inv.parties?.name || "Walk-in Customer"} • ${inv.items_summary}`
                        : (inv.parties?.name || "Walk-in Customer")
                    }
                    meta={new Date(inv.created_at).toLocaleString()}
                    badge={{
                      label: inv.status === "quotation" ? "Quote" : inv.status,
                      tone: statusTone,
                    }}
                    primaryAmount={`Rs ${Math.round(inv.total_amount).toLocaleString()}`}
                    secondaryAmount={
                      outstanding > 0
                        ? `Rs ${Math.round(outstanding).toLocaleString()}`
                        : undefined
                    }
                    secondaryLabel="Due"
                    actions={
                      <div className="flex items-center gap-1.5 w-full justify-end">
                        {inv.is_showroom_inst ? (
                          <>
                            <button
                              onClick={() => handleViewReceipt(inv)}
                              className="h-10 px-3 flex items-center gap-1.5 bg-violet-50 text-violet-700 font-bold text-xs rounded-xl border border-violet-200"
                              title="بیع نامہ اور اقساط معاہدہ پرنٹ کریں"
                            >
                              <FileText size={15} />
                              <span>بیع نامہ</span>
                            </button>
                            {inv.showroom_data?.id && (
                              <Link
                                href={`/dashboard/showroom/installments/agreement/${inv.showroom_data.id}`}
                                target="_blank"
                              >
                                <span className="h-10 w-10 flex items-center justify-center bg-slate-100 text-slate-700 rounded-xl border border-slate-200">
                                  <ExternalLink size={15} />
                                </span>
                              </Link>
                            )}
                          </>
                        ) : inv.is_showroom_veh ? (
                          <button
                            onClick={() => handleViewReceipt(inv)}
                            className="h-10 px-3 flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200"
                            title="گاڑی کی فروخت کا بیع نامہ پرنٹ کریں"
                          >
                            <FileText size={15} />
                            <span>بیع نامہ</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleViewReceipt(inv)}
                            className="h-10 w-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100"
                            title="View / Print Receipt"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleShareWhatsApp(inv)}
                          className="h-10 w-10 flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl border border-emerald-200"
                          title="Share Bill on WhatsApp with Download Link"
                        >
                          <MessageCircle size={16} />
                        </button>
                        {activeSubTab === "active" && !inv.is_showroom_inst && !inv.is_showroom_veh && permissions?.actions?.edit_bill !== false && (
                          <Link href={`/dashboard/pos?edit=${inv.id}`}>
                            <span className="h-10 w-10 flex items-center justify-center bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                              <Edit size={16} />
                            </span>
                          </Link>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </MobileCardList>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                    <th className="py-2.5 px-3.5">Invoice ID</th>
                    <th className="py-2.5 px-3.5">Date & Time</th>
                    <th className="py-2.5 px-3.5">Customer Account</th>
                    <th className="py-2.5 px-3.5 text-right">Invoice Total</th>
                    <th className="py-2.5 px-3.5 text-right">Cash Paid</th>
                    <th className="py-2.5 px-3.5 text-right">Due Balance</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                    <th className="py-2.5 px-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredInvoices.map((inv) => {
                    const outstanding = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount || 0));
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                        <td className="py-2 px-3.5 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          #{inv.id.slice(0, 8).toUpperCase()}
                          {inv.is_showroom_inst && (
                            <span className="bg-violet-50 text-violet-700 border border-violet-200 text-[8px] font-black px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5">
                              🚗 اقساط
                            </span>
                          )}
                          {inv.is_showroom_veh && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-black px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5">
                              🚗 گاڑی نقد
                            </span>
                          )}
                          {inv.is_edited && (
                            <button
                              onClick={() => handleShowHistory(inv)}
                              className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-extrabold text-[8px] px-1 py-0.5 rounded leading-none ml-1 flex items-center gap-0.5 cursor-pointer shadow-2xs"
                              title="Click to view edits history"
                            >
                              Edited 📖
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-3.5 text-slate-400 font-medium text-[11px]">
                          {formatDateTime(inv.created_at, timezone)}
                        </td>
                        <td className="py-2 px-3.5">
                          {inv.parties ? (
                            <div>
                              <span className="font-extrabold text-slate-800 text-xs">{inv.parties.name}</span>
                              {inv.parties.phone && (
                                <p className="text-[8.5px] text-slate-400 font-mono leading-none mt-0.5">{inv.parties.phone}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs font-semibold">Walk-in Customer</span>
                          )}

                          {inv.items_summary && (
                            <div className="mt-1 flex items-center gap-1 max-w-[240px]">
                              <Package size={10} className="text-indigo-500 shrink-0" />
                              <span 
                                className="text-[10px] text-slate-500 truncate font-normal bg-slate-50 px-1 py-0.5 rounded border border-slate-200/60"
                                title={inv.items_summary}
                              >
                                {inv.items_summary}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3.5 text-right font-bold text-slate-800">
                          Rs {Math.round(inv.total_amount).toLocaleString()}
                        </td>
                        <td className="py-2 px-3.5 text-right text-emerald-600 font-bold">
                          Rs {Math.round(inv.paid_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3.5 text-right text-rose-600 font-bold">
                          Rs {Math.round(outstanding).toLocaleString()}
                        </td>
                        <td className="py-2 px-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-extrabold border ${
                            inv.status === "quotation"
                              ? "bg-purple-50 text-purple-700 border-purple-100"
                              : inv.status === "paid" 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                : inv.status === "partial"
                                  ? "bg-amber-50 text-amber-700 border-amber-100"
                                  : "bg-red-50 text-red-700 border-red-100"
                          }`}>
                            {inv.status === "quotation" ? "Quotation" : inv.status}
                          </span>
                        </td>
                        <td className="py-2 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {inv.is_showroom_inst ? (
                              <>
                                <button
                                  onClick={() => handleViewReceipt(inv)}
                                  className="px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg transition-all border border-violet-200 shadow-2xs text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="بیع نامہ اور اقساط معاہدہ پرنٹ کریں"
                                >
                                  <FileText size={12} />
                                  <span>بیع نامہ / رسید</span>
                                </button>
                                {inv.showroom_data?.id && (
                                  <Link
                                    href={`/dashboard/showroom/installments/agreement/${inv.showroom_data.id}`}
                                    target="_blank"
                                  >
                                    <button
                                      className="p-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-all border border-slate-200 shadow-2xs"
                                      title="مکمل قانونی معاہدہ پیج کھولیں (Full Legal Agreement Page)"
                                    >
                                      <ExternalLink size={13} />
                                    </button>
                                  </Link>
                                )}
                              </>
                            ) : inv.is_showroom_veh ? (
                              <button
                                onClick={() => handleViewReceipt(inv)}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-all border border-emerald-200 shadow-2xs text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
                                title="گاڑی کی فروخت کا بیع نامہ پرنٹ کریں"
                              >
                                <FileText size={12} />
                                <span>بیع نامہ</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleViewReceipt(inv)}
                                className="p-1 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-lg transition-all border border-slate-200 shadow-2xs"
                                title="Print / View Thermal Receipt"
                              >
                                <Eye size={13} />
                              </button>
                            )}

                            <button
                              onClick={() => handleShareWhatsApp(inv)}
                              className="p-1 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-all border border-emerald-200/80 shadow-2xs"
                              title="Share Digital Bill on WhatsApp (ڈاؤن لوڈ لنک بھیجیں)"
                            >
                              <MessageCircle size={13} />
                            </button>

                             {activeSubTab === "quotation" ? (
                               <Link href={`/dashboard/pos?load_quotation=${inv.id}`}>
                                 <button
                                   className="p-1.5 bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-650 rounded-xl transition-all border border-slate-100 flex items-center justify-center"
                                   title="Convert to Sale"
                                 >
                                   <ShoppingCart size={13} />
                                 </button>
                               </Link>
                             ) : activeSubTab === "active" ? (
                               <>
                                 {!inv.is_showroom_inst && !inv.is_showroom_veh && permissions?.actions?.edit_bill !== false && (
                                   <Link href={`/dashboard/pos?edit=${inv.id}`}>
                                     <button
                                       className="p-1.5 bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-sky-650 rounded-xl transition-all border border-slate-100"
                                       title="Edit Bill in POS"
                                     >
                                       <Edit size={13} />
                                     </button>
                                   </Link>
                                 )}
                                 {!inv.is_showroom_inst && !inv.is_showroom_veh && (
                                   <button
                                     onClick={() => handleVoidInvoice(inv)}
                                     disabled={voidingInvoiceId === inv.id || permissions?.actions?.delete_bill === false}
                                     className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-650 rounded-xl transition-all border border-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                     title={permissions?.actions?.delete_bill === false ? "Access Denied" : "Void Bill (Move to Trash)"}
                                   >
                                     {voidingInvoiceId === inv.id ? (
                                       <Loader2 size={13} className="animate-spin" />
                                     ) : (
                                       <Trash2 size={13} />
                                     )}
                                   </button>
                                 )}
                               </>
                             ) : (
                               <button
                                 onClick={() => handleRestoreInvoice(inv)}
                                 disabled={restoringInvoiceId === inv.id || permissions?.actions?.delete_bill === false}
                                 className="p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-555 hover:text-emerald-655 rounded-xl transition-all border border-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                 title={permissions?.actions?.delete_bill === false ? "Access Denied" : "Restore Voided Bill"}
                               >
                                 {restoringInvoiceId === inv.id ? (
                                   <Loader2 size={13} className="animate-spin" />
                                 ) : (
                                   <RefreshCcw size={13} />
                                 )}
                               </button>
                             )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL: Thermal Receipt Preview */}
      <AnimatePresence>
        {isReceiptOpen && selectedInvoice && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md border border-slate-200 relative my-auto flex flex-col items-center max-h-[90vh]"
            >
              <button 
                onClick={() => {
                  setIsReceiptOpen(false);
                  setSelectedInvoice(null);
                  setSelectedInvoiceItems([]);
                }} 
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors print:hidden z-10"
              >
                <X size={18} />
              </button>

              {loadingItems ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-indigo-600 mb-2" />
                  <span className="text-xs font-semibold">Loading receipt details...</span>
                </div>
              ) : (
                <div id="sales-thermal-receipt" className="w-full flex justify-center py-2 overflow-y-auto custom-scrollbar max-h-[70vh]">
                  <ReceiptTemplate 
                    settings={receiptSettings}
                    shopDetails={shopDetails}
                    invoice={{
                      id: selectedInvoice.id,
                      created_at: selectedInvoice.created_at,
                      customer_name: selectedInvoice.parties?.name || "Walk-in Customer",
                      customer_phone: selectedInvoice.parties?.phone || "",
                      payment_mode: selectedInvoice.status === "paid" ? "cash" : selectedInvoice.status,
                      received_amount: selectedInvoice.paid_amount,
                      tax_amount: selectedInvoice.tax_amount,
                      discount: selectedInvoice.discount,
                      total_amount: selectedInvoice.total_amount,
                      remarks: selectedInvoice.remarks,
                      is_voided: selectedInvoice.is_voided,
                      is_edited: selectedInvoice.is_edited,
                      customer_balance: selectedInvoice.parties?.current_balance !== undefined
                        ? Number(selectedInvoice.parties.current_balance)
                        : undefined,
                      items: selectedInvoiceItems.map(item => ({
                        name: item.products?.name || "Product",
                        quantity: Number(item.quantity),
                        price: Number(item.unit_price),
                        subtotal: Number(item.subtotal),
                        packingName: item.product_variants?.packing_name || "",
                        warranty: item.warranty || "",
                        sold_imeis: item.sold_imeis || "",
                      }))
                    }}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 w-full mt-4 print:hidden shrink-0">
                <Button 
                  onClick={() => {
                    const printContents = document.getElementById("sales-thermal-receipt")?.innerHTML;
                    if (printContents && selectedInvoice) {
                      printReceiptDirect({
                        receiptHtml: printContents,
                        settings: receiptSettings,
                        title: `Sales Invoice #${selectedInvoice.id?.slice(0, 8).toUpperCase()}`,
                        onSuccess: () => toast.success("Printing receipt..."),
                        onError: (err) => toast.error("Printing failed: " + (err?.message || "Check printer"))
                      });
                    }
                  }} 
                  className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-bold h-10 rounded-xl text-xs cursor-pointer"
                >
                  <Printer size={15} className="mr-2" /> Print Receipt
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsReceiptOpen(false);
                    setSelectedInvoice(null);
                    setSelectedInvoiceItems([]);
                  }}
                  className="flex-1 text-slate-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors font-bold h-10 rounded-xl text-xs border-slate-200"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal: Edit History Viewer */}
      <AnimatePresence>
        {isHistoryOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => {
                setIsHistoryOpen(false);
                setSelectedInvoice(null);
                setSelectedInvoiceItems([]);
              }}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl relative z-10 font-sans max-h-[85vh] flex flex-col border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4 border-b pb-3 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{historyTitle}</h3>
                  
                </div>
                <button 
                  onClick={() => {
                    setIsHistoryOpen(false);
                    setSelectedInvoice(null);
                    setSelectedInvoiceItems([]);
                  }} 
                  className="text-slate-400 hover:text-slate-650 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar py-2 text-slate-650">
                {loadingItems ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500 mr-2" />
                    <span className="text-xs text-slate-450">Loading current items...</span>
                  </div>
                ) : historyItems.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-xs">No edit history logged for this invoice.</p>
                ) : (
                  historyItems.map((hist, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-xs space-y-3.5">
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/50 pb-1.5">
                        <span>Version #{historyItems.length - idx} (Previous State)</span>
                        <span className="text-slate-500 font-bold bg-slate-200/50 px-2 py-0.5 rounded-lg flex items-center gap-1 normal-case font-sans">
                          🕒 Edited on: {new Date(hist.edited_at).toLocaleString()} {hist.edited_by ? `by ${hist.edited_by}` : ""}
                        </span>
                      </div>

                      {/* Side-by-Side Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Old Bill Version Column */}
                        <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100/70">
                          <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest block mb-2">⏮ OLD BILL (Before Edit)</span>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Invoice Total:</span>
                              <span className="font-extrabold text-slate-800">Rs {Math.round(hist.total_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Discount:</span>
                              <span className="font-bold text-slate-700">Rs {Math.round(hist.discount || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cash Paid:</span>
                              <span className="font-bold text-slate-700">Rs {Math.round(hist.paid_amount || 0)}</span>
                            </div>

                            {/* Items list before edit */}
                            {hist.items && hist.items.length > 0 && (
                              <div className="pt-2 border-t border-slate-250/50 mt-2">
                                <span className="text-[8px] font-black text-slate-400 block mb-1">ITEMS BEFORE EDIT:</span>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {hist.items.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between text-[10px] text-slate-600 font-semibold">
                                      <span className="truncate max-w-[130px]">{item.product_name || "Product"}</span>
                                      <span className="font-mono">{item.quantity} x Rs {Math.round(item.unit_price)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Current Bill Version Column */}
                        <div className="bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-100/70">
                          <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest block mb-2">⏭ CURRENT BILL (Latest)</span>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Invoice Total:</span>
                              <span className="font-extrabold text-slate-800">Rs {Math.round(selectedInvoice.total_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Discount:</span>
                              <span className="font-bold text-slate-700">Rs {Math.round(selectedInvoice.discount || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cash Paid:</span>
                              <span className="font-bold text-slate-700">Rs {Math.round(selectedInvoice.paid_amount || 0)}</span>
                            </div>

                            {/* Current invoice items */}
                            {selectedInvoiceItems && selectedInvoiceItems.length > 0 && (
                              <div className="pt-2 border-t border-slate-250/50 mt-2">
                                <span className="text-[8px] font-black text-slate-400 block mb-1">ITEMS AFTER EDIT:</span>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {selectedInvoiceItems.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between text-[10px] text-slate-600 font-semibold">
                                      <span className="truncate max-w-[130px]">{item.products?.name || "Product"}</span>
                                      <span className="font-mono">{item.quantity} x Rs {Math.round(item.unit_price)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Showroom Vehicle Legal Deed / Installment Agreement Modal */}
      {selectedDeedTarget && (
        <ShowroomDeedPrintModal
          isOpen={isDeedOpen}
          onClose={() => {
            setIsDeedOpen(false);
            setSelectedDeedTarget(null);
          }}
          shopName={shopName || "Showroom"}
          shopAddress={shopDetails.address}
          shopPhone={shopDetails.phone}
          vehicle={selectedDeedTarget.vehicle}
          buyer={selectedDeedTarget.buyer}
          installment={selectedDeedTarget.installment}
          schedules={selectedDeedTarget.schedules || []}
          saleType={selectedDeedTarget.saleType}
          salePrice={selectedDeedTarget.salePrice}
          downPayment={selectedDeedTarget.downPayment || 0}
          saleDate={
            selectedDeedTarget.saleDate
              ? new Date(selectedDeedTarget.saleDate).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0]
          }
        />
      )}
    </div>
  );
}
