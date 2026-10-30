"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Receipt, Calendar, DollarSign, CreditCard, CheckCircle, 
  AlertCircle, Trash2, Edit, Eye, X, Printer, Loader2, Filter, 
  ArrowUpRight, ShoppingCart, RefreshCcw, Download
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Invoice = {
  id: string;
  created_at: string;
  total_amount: number;
  tax_amount: number;
  discount: number;
  status: "paid" | "unpaid" | "partial";
  paid_amount: number;
  is_edited: boolean | null;
  is_voided: boolean | null;
  party_id: string | null;
  parties: {
    name: string;
    phone: string | null;
  } | null;
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
};

export default function SalesHistoryPage() {
  const { shopId, shopName, permissions } = useShop();
  const supabase = createClient();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Active subtab state ("active" vs "trash")
  const [activeSubTab, setActiveSubTab] = useState<"active" | "trash">("active");

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

  // Voiding/Restoring Loaders
  const [voidingInvoiceId, setVoidingInvoiceId] = useState<string | null>(null);
  const [restoringInvoiceId, setRestoringInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (shopId) {
      fetchInvoices();
    }
  }, [shopId]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          created_at,
          total_amount,
          tax_amount,
          discount,
          status,
          paid_amount,
          is_edited,
          is_voided,
          party_id,
          parties ( name, phone )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mappedInvoices = (data || []).map((inv: any) => {
        let customerInfo = null;
        if (inv.parties) {
          if (Array.isArray(inv.parties)) {
            customerInfo = inv.parties[0] || null;
          } else {
            customerInfo = inv.parties;
          }
        }
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
          parties: customerInfo
        };
      });

      setInvoices(mappedInvoices);
    } catch (err: any) {
      toast.error("Failed to load sales invoices: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = async (invoice: Invoice) => {
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
          products ( name, unit ),
          variant_id
        `)
        .eq("invoice_id", invoice.id);

      if (error) throw error;

      const items = data || [];
      const populatedItems: InvoiceItem[] = [];

      for (const item of items) {
        let productInfo = null;
        if (item.products) {
          if (Array.isArray(item.products)) {
            productInfo = item.products[0] || null;
          } else {
            productInfo = item.products;
          }
        }

        let variantInfo = null;
        if (item.variant_id) {
          const { data: vData } = await supabase
            .from("product_variants")
            .select("packing_name")
            .eq("id", item.variant_id)
            .maybeSingle();
          variantInfo = vData;
        }
        populatedItems.push({
          id: item.id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
          products: productInfo,
          variant_id: item.variant_id,
          product_variants: variantInfo
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
      // 1. Fetch invoice items
      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("product_id, variant_id, quantity")
        .eq("invoice_id", invoice.id);

      if (itemsError) throw itemsError;

      // 2. Restock items (Call decrement stock with negative qty)
      if (items && items.length > 0) {
        for (const item of items) {
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

      // 3. Rollback old customer Khata balances if partial or unpaid
      if (invoice.party_id && invoice.status !== "paid") {
        const unpaidAmt = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);
        if (unpaidAmt > 0) {
          const { error: khataError } = await supabase.rpc("increment_party_balance", {
            p_id: invoice.party_id,
            amount: -unpaidAmt
          });
          if (khataError) throw khataError;
        }
      }

      // 4. Soft-delete invoice (marks as voided)
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
      // 1. Fetch invoice items
      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("product_id, variant_id, quantity")
        .eq("invoice_id", invoice.id);

      if (itemsError) throw itemsError;

      // 2. Re-deduct stock (Call decrement stock with positive qty)
      if (items && items.length > 0) {
        for (const item of items) {
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

      // 3. Re-increment customer Khata balance if partial or unpaid
      if (invoice.party_id && invoice.status !== "paid") {
        const unpaidAmt = Number(invoice.total_amount) - Number(invoice.paid_amount || 0);
        if (unpaidAmt > 0) {
          const { error: khataError } = await supabase.rpc("increment_party_balance", {
            p_id: invoice.party_id,
            amount: unpaidAmt
          });
          if (khataError) throw khataError;
        }
      }

      // 4. Set is_voided = false
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

  // Download Sales History as PDF
  const handleDownloadPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(shopName || "HISAB X", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Sales Invoices Ledger Report", 15, 26);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      const subTabLabel = activeSubTab === "active" ? "Active Invoices" : "Voided / Trash Invoices";
      doc.text(`Scope: ${subTabLabel}`, 130, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date Generated: ${new Date().toLocaleString()}`, 130, 26);

      // Draw horizontal divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 30, 195, 30);

      // Summary statistics block in the PDF
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
          new Date(inv.created_at).toLocaleString(),
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
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" }, // Indigo header
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
      doc.text("Powered by Hisab X POS", 15, 285);

      doc.save(`sales_report_${activeSubTab}_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("Sales report PDF downloaded successfully! 📄");
    } catch (err: any) {
      toast.error("Failed to generate Sales Report PDF: " + err.message);
    }
  };

  // Memoized Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Split by Active vs Trash subtab
      const isVoided = inv.is_voided === true;
      const matchesSubTab = activeSubTab === "trash" ? isVoided : !isVoided;
      if (!matchesSubTab) return false;

      // 1. Search Query (Invoice ID or Customer Name/Phone)
      const matchesSearch = 
        inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.parties?.name || "Walk-in Customer").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.parties?.phone || "").includes(searchQuery);

      // 2. Status Filter
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

      // 3. Payment Mode Filter
      let matchesPaymentMode = true;
      if (paymentModeFilter === "cash") {
        matchesPaymentMode = inv.status === "paid" && (inv.party_id === null || Number(inv.paid_amount) === Number(inv.total_amount));
      } else if (paymentModeFilter === "credit") {
        matchesPaymentMode = inv.status === "unpaid" || inv.status === "partial" || (inv.party_id !== null && Number(inv.paid_amount) < Number(inv.total_amount));
      }

      // 4. Date Filter
      let matchesDate = true;
      if (dateFilter !== "all") {
        const invDate = new Date(inv.created_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === "today") {
          matchesDate = invDate >= today;
        } else if (dateFilter === "week") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          matchesDate = invDate >= sevenDaysAgo;
        } else if (dateFilter === "month") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          matchesDate = invDate >= thirtyDaysAgo;
        } else if (dateFilter === "custom" && startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = endDate ? new Date(endDate) : new Date();
          end.setHours(23, 59, 59, 999);
          matchesDate = invDate >= start && invDate <= end;
        }
      }

      return matchesSearch && matchesStatus && matchesPaymentMode && matchesDate;
    });
  }, [invoices, activeSubTab, searchQuery, statusFilter, paymentModeFilter, dateFilter, startDate, endDate]);

  // Aggregate Calculations (Active Invoices Only)
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let cashReceived = 0;
    let outstandingCredit = 0;

    const activeFiltered = invoices.filter(inv => {
      if (inv.is_voided === true) return false;

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
        const invDate = new Date(inv.created_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === "today") {
          matchesDate = invDate >= today;
        } else if (dateFilter === "week") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          matchesDate = invDate >= sevenDaysAgo;
        } else if (dateFilter === "month") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          matchesDate = invDate >= thirtyDaysAgo;
        } else if (dateFilter === "custom" && startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const end = endDate ? new Date(endDate) : new Date();
          end.setHours(23, 59, 59, 999);
          matchesDate = invDate >= start && invDate <= end;
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
            <Receipt className="text-indigo-600 h-7 w-7" />
            Sales Ledger & Invoices
          </h1>
          <p className="text-xs text-slate-455 font-medium mt-1">
            View history, edit bills, void/trash transactions, and manage store ledger outstanding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredInvoices.length > 0 && (
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              className="rounded-xl h-10 text-xs font-bold text-indigo-650 hover:bg-indigo-50 border-indigo-200 shadow-sm"
            >
              <Download size={14} className="mr-1.5" /> Download PDF Report
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={fetchInvoices} 
            className="rounded-xl h-10 text-xs font-bold text-slate-600 hover:bg-slate-50 border-slate-200"
          >
            <RefreshCcw size={14} className="mr-1.5" /> Reload
          </Button>
          <Link href="/dashboard/pos">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-10 rounded-xl text-xs shadow-lg shadow-indigo-500/15">
              <ShoppingCart size={14} className="mr-1.5" /> POS Billing Terminal
            </Button>
          </Link>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { 
            label: "Total Revenue", 
            val: `Rs ${Math.round(stats.totalRevenue).toLocaleString()}`, 
            icon: DollarSign, 
            bg: "bg-indigo-50 text-indigo-600 border-indigo-100/50" 
          },
          { 
            label: "Total Invoices", 
            val: stats.invoiceCount.toString(), 
            icon: Receipt, 
            bg: "bg-sky-50 text-sky-600 border-sky-100/50" 
          },
          { 
            label: "Cash Collected", 
            val: `Rs ${Math.round(stats.cashReceived).toLocaleString()}`, 
            icon: CheckCircle, 
            bg: "bg-emerald-50 text-emerald-600 border-emerald-100/50" 
          },
          { 
            label: "Outstanding Credit (Udhaar)", 
            val: `Rs ${Math.round(stats.outstandingCredit).toLocaleString()}`, 
            icon: AlertCircle, 
            bg: "bg-amber-50 text-amber-600 border-amber-100/50" 
          }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -2 }}
            className={`p-5 bg-white border rounded-3xl shadow-sm flex items-center justify-between transition-all ${stat.bg}`}
          >
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-xl font-black text-slate-800 mt-1">{stat.val}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-white shadow-sm border border-slate-50">
              <stat.icon className="h-5 w-5" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
          <Filter size={16} className="text-slate-500" />
          <h4 className="font-extrabold text-slate-700 text-xs uppercase tracking-wider">Search & Filters</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search by Bill ID, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9.5 text-xs bg-slate-50 border-slate-200 focus-visible:ring-indigo-500/20 rounded-xl"
            />
          </div>

          {/* Payment Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="w-full h-9.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid (Fully Cleared)</option>
              <option value="partial">Partial Payment</option>
              <option value="unpaid">Unpaid (Full Credit)</option>
            </select>
          </div>

          {/* Payment Mode filter */}
          <div>
            <select
              value={paymentModeFilter}
              onChange={(e: any) => setPaymentModeFilter(e.target.value)}
              className="w-full h-9.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash / Card</option>
              <option value="credit">Credit / Udhaar</option>
            </select>
          </div>

          {/* Date range filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="w-full h-9.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Picker inputs */}
        {dateFilter === "custom" && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 border-t border-dashed border-slate-100"
          >
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
              <Input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">End Date</label>
              <Input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Invoice Ledger List Container */}
      <div className="space-y-3 font-sans">
        {/* Sub-Tabs for Active Invoices vs Trash */}
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
              {invoices.filter(i => !i.is_voided).length}
            </span>
          </button>
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
              {activeSubTab === "active" 
                ? "No active invoices found matching the filters." 
                : "No voided bills in trash."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50/50">
                    <th className="py-3 px-5">Invoice ID</th>
                    <th className="py-3 px-5">Date & Time</th>
                    <th className="py-3 px-5">Customer Account</th>
                    <th className="py-3 px-5 text-right">Invoice Total</th>
                    <th className="py-3 px-5 text-right">Cash Paid</th>
                    <th className="py-3 px-5 text-right">Due Balance</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredInvoices.map((inv) => {
                    const outstanding = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount || 0));
                    return (
                      <tr key={inv.id} className="hover:bg-slate-55/20 transition-all font-medium text-slate-700">
                        <td className="py-3.5 px-5 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          #{inv.id.slice(0, 8).toUpperCase()}
                          {inv.is_edited && (
                            <span className="bg-amber-100 border border-amber-200 text-amber-700 font-extrabold text-[8px] px-1 py-0.5 rounded leading-none">
                              Edited
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-slate-400">
                          {new Date(inv.created_at).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5">
                          {inv.parties ? (
                            <div>
                              <span className="font-extrabold text-slate-800">{inv.parties.name}</span>
                              {inv.parties.phone && (
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{inv.parties.phone}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Walk-in Customer</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-slate-800">
                          Rs {Math.round(inv.total_amount)}
                        </td>
                        <td className="py-3.5 px-5 text-right text-emerald-650 font-bold">
                          Rs {Math.round(inv.paid_amount || 0)}
                        </td>
                        <td className="py-3.5 px-5 text-right text-amber-600 font-bold">
                          Rs {Math.round(outstanding)}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider border leading-none ${
                            inv.status === "paid" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                              : inv.status === "partial"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-red-50 text-red-700 border-red-100"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Common: View Receipt */}
                            <button
                              onClick={() => handleViewReceipt(inv)}
                              className="p-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-650 rounded-xl transition-all border border-slate-100"
                              title="Print / View Thermal Receipt"
                            >
                              <Eye size={13} />
                            </button>

                            {/* Active Tab Actions */}
                            {activeSubTab === "active" ? (
                              <>
                                {permissions?.actions?.edit_bill !== false && (
                                  <Link href={`/dashboard/pos?edit=${inv.id}`}>
                                    <button
                                      className="p-1.5 bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-sky-650 rounded-xl transition-all border border-slate-100"
                                      title="Edit Bill in POS"
                                    >
                                      <Edit size={13} />
                                    </button>
                                  </Link>
                                )}
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
                              </>
                            ) : (
                              /* Trash Tab Actions: Restore */
                              <button
                                onClick={() => handleRestoreInvoice(inv)}
                                disabled={restoringInvoiceId === inv.id || permissions?.actions?.delete_bill === false}
                                className="p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-550 hover:text-emerald-655 rounded-xl transition-all border border-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
          )}
        </div>
      </div>

      {/* MODAL: Thermal Receipt Preview */}
      <AnimatePresence>
        {isReceiptOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 relative my-8"
            >
              <button 
                onClick={() => {
                  setIsReceiptOpen(false);
                  setSelectedInvoice(null);
                  setSelectedInvoiceItems([]);
                }} 
                className="absolute top-4 right-4 text-slate-450 hover:text-slate-650 print:hidden"
              >
                <X size={16} />
              </button>

              {/* Receipt Body (Simulated MM80 Thermal Print) */}
              <div id="sales-thermal-receipt" className="font-mono text-[11px] text-slate-800 p-4 border border-zinc-200 bg-white rounded shadow-inner">
                <div className="text-center space-y-1 mb-4 border-b border-dashed border-slate-300 pb-3">
                  <h2 className="text-sm font-black uppercase tracking-tight">Hisab X Store</h2>
                  <p className="text-[9px] text-slate-500">Global ERP POS System</p>
                  <p className="text-[9px] text-slate-400">Date: {new Date(selectedInvoice.created_at).toLocaleString()}</p>
                  <p className="text-[9px] text-slate-455">Inv: #{selectedInvoice.id.slice(0, 8).toUpperCase()}</p>
                  {selectedInvoice.is_voided && (
                    <p className="bg-red-100 text-red-800 font-extrabold text-[8px] inline-block px-1 py-0.5 rounded tracking-wide mt-1">
                      * VOIDED / TRASHED BILL *
                    </p>
                  )}
                  {selectedInvoice.is_edited && !selectedInvoice.is_voided && (
                    <p className="bg-amber-100 text-amber-800 font-extrabold text-[8px] inline-block px-1 py-0.5 rounded tracking-wide mt-1">
                      * EDITED INVOICE *
                    </p>
                  )}
                </div>

                <div className="space-y-1 mb-4 border-b border-dashed border-slate-300 pb-3">
                  <p className="font-bold">Customer: {selectedInvoice.parties?.name || "Walk-in Customer"}</p>
                  {selectedInvoice.parties?.phone && (
                    <p className="text-slate-550">Phone: {selectedInvoice.parties.phone}</p>
                  )}
                  <p className="text-slate-550">Status: {selectedInvoice.status.toUpperCase()}</p>
                </div>

                {/* Items Table */}
                {loadingItems ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                    <Loader2 size={16} className="animate-spin text-indigo-500 mb-1" />
                    <span className="text-[9px]">Loading items...</span>
                  </div>
                ) : (
                  <table className="w-full text-left mb-4">
                    <thead>
                      <tr className="border-b border-slate-200 font-bold">
                        <th className="pb-1">Item</th>
                        <th className="text-center pb-1">Qty</th>
                        <th className="text-right pb-1">Amt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoiceItems.map((item, idx) => (
                        <tr key={idx} className="py-1">
                          <td className="py-1 pr-2">
                            <p className="font-bold leading-tight">{item.products?.name || "Product"}</p>
                            {item.product_variants?.packing_name && (
                              <p className="text-[9px] text-indigo-650">({item.product_variants.packing_name})</p>
                            )}
                          </td>
                          <td className="text-center py-1 font-mono">{Number(item.quantity)}</td>
                          <td className="text-right py-1 font-mono">Rs {Math.round(item.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Summary Totals */}
                <div className="space-y-1 text-right border-t border-dashed border-slate-300 pt-3">
                  {Number(selectedInvoice.tax_amount) > 0 && (
                    <p className="text-[9px] text-slate-500">Tax: Rs {Number(selectedInvoice.tax_amount).toFixed(2)}</p>
                  )}
                  {Number(selectedInvoice.discount) > 0 && (
                    <p className="text-[9px] text-red-500">Discount: -Rs {Number(selectedInvoice.discount)}</p>
                  )}
                  <p className="text-xs font-black text-slate-900 border-t border-slate-200 pt-1.5">
                    Total: Rs {Number(selectedInvoice.total_amount).toFixed(2)}
                  </p>
                  <p className="text-[9px] font-bold text-slate-700">Cash Paid: Rs {Number(selectedInvoice.paid_amount || 0).toFixed(2)}</p>
                  <p className="text-[9px] font-bold text-slate-800 border-t border-dashed border-slate-100 pt-1">
                    Remaining Udhaar: Rs {Math.max(0, Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount || 0)).toFixed(2)}
                  </p>
                </div>

                <div className="text-center text-[8px] text-slate-400 mt-6 pt-4 border-t border-dashed border-slate-300">
                  <p>Thank you for shopping with us!</p>
                  <p>Powered by Hisab X</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-5 print:hidden">
                <Button 
                  onClick={() => {
                    const printContents = document.getElementById("sales-thermal-receipt")?.innerHTML;
                    const originalContents = document.body.innerHTML;
                    if (printContents) {
                      document.body.innerHTML = printContents;
                      window.print();
                      document.body.innerHTML = originalContents;
                      window.location.reload(); 
                    }
                  }} 
                  className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-bold h-10 rounded-xl text-xs"
                >
                  <Printer size={14} className="mr-2" /> Print Receipt
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsReceiptOpen(false);
                    setSelectedInvoice(null);
                    setSelectedInvoiceItems([]);
                  }}
                  className="flex-1 text-slate-600 hover:bg-slate-50 font-bold h-10 rounded-xl text-xs"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
