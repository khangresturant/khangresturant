"use client";

import React, { useState, useEffect } from "react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Calculator, Download, TrendingDown,
  ShoppingBag, Truck, Package, Users, ChevronRight,
  CreditCard, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type ReportTab =
  | "sales"
  | "sales_by_product"
  | "sales_by_customer"
  | "sales_by_payment"
  | "purchases"
  | "purchases_by_supplier"
  | "expenses"
  | "expense_category"
  | "pl"
  | "inventory"
  | "khata";

export default function ReportsPage() {
  const { shopId, userName, shopName } = useShop();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ReportTab>("sales");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  const [salesData, setSalesData] = useState<any[]>([]);
  const [purchasesData, setPurchasesData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [partiesData, setPartiesData] = useState<any[]>([]);

  const [plSummary, setPlSummary] = useState({
    revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0, marginPct: 0
  });
  const [stockSummary, setStockSummary] = useState({
    totalItems: 0, totalQuantity: 0, valuationCost: 0, valuationRetail: 0,
    expectedProfit: 0, lowStockCount: 0
  });

  useEffect(() => {
    if (shopId) fetchReportData();
  }, [shopId, activeTab, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const startDateTime = `${startDate}T00:00:00.000Z`;
      const endDateTime   = `${endDate}T23:59:59.999Z`;

      // Always fetch products (needed for COGS / valuation)
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select(`id, name, purchase_price_single, sale_price_single, current_stock, min_stock_level, unit,
          product_variants ( id, packing_name, purchase_price, sale_price, stock_quantity )`)
        .eq("shop_id", shopId);
      if (prodErr) throw prodErr;
      setProductsData(products || []);

      const productCostDict: Record<string, number> = {};
      const variantCostDict: Record<string, number> = {};
      (products || []).forEach((p: any) => {
        productCostDict[p.id] = Number(p.purchase_price_single || 0);
        (p.product_variants || []).forEach((v: any) => { variantCostDict[v.id] = Number(v.purchase_price || 0); });
      });

      const needSales    = ["sales","sales_by_product","sales_by_customer","sales_by_payment","pl"].includes(activeTab);
      const needPurchases= ["purchases","purchases_by_supplier","pl"].includes(activeTab);
      const needExpenses = ["expenses","expense_category","pl"].includes(activeTab);
      const needParties  = ["khata","sales_by_customer","purchases_by_supplier"].includes(activeTab);

      if (needSales) {
        const { data: sales, error: sErr } = await supabase
          .from("invoices")
          .select(`id, total_amount, paid_amount, status, payment_mode, created_at, party_id,
            parties ( name ),
            invoice_items ( id, product_id, variant_id, quantity, unit_price, subtotal )`)
          .eq("shop_id", shopId).eq("is_voided", false)
          .gte("created_at", startDateTime).lte("created_at", endDateTime)
          .order("created_at", { ascending: false });
        if (sErr) throw sErr;
        setSalesData((sales || []).map((inv: any) => {
          let cogs = 0;
          (inv.invoice_items || []).forEach((it: any) => {
            const c = it.variant_id && variantCostDict[it.variant_id] ? variantCostDict[it.variant_id] : (productCostDict[it.product_id] || 0);
            cogs += c * Number(it.quantity || 0);
          });
          return { ...inv, cogs, profit: Number(inv.total_amount || 0) - cogs };
        }));
      }

      if (needPurchases) {
        const { data: purchases, error: pErr } = await supabase
          .from("purchase_orders")
          .select(`id, total_amount, status, created_at, supplier_id, parties ( name )`)
          .eq("shop_id", shopId)
          .gte("created_at", startDateTime).lte("created_at", endDateTime)
          .order("created_at", { ascending: false });
        if (pErr) throw pErr;
        setPurchasesData(purchases || []);
      }

      if (needExpenses) {
        const { data: expenses, error: eErr } = await supabase
          .from("expenses")
          .select("id, name, amount, expense_type, remarks, created_at")
          .eq("shop_id", shopId)
          .gte("created_at", startDateTime).lte("created_at", endDateTime)
          .order("created_at", { ascending: false });
        if (eErr) throw eErr;
        setExpensesData(expenses || []);
      }

      if (needParties) {
        const { data: parties, error: ptErr } = await supabase
          .from("parties")
          .select("id, name, phone, type, current_balance, created_at")
          .eq("shop_id", shopId)
          .order("name", { ascending: true });
        if (ptErr) throw ptErr;
        setPartiesData(parties || []);
      }
    } catch (err: any) {
      toast.error("Failed to load report data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Lookup maps from productsData ──────────────────────────────────────────
  const { productCostMap, variantCostMap, productNameMap, variantNameMap } = React.useMemo(() => {
    const pCost: Record<string, number> = {};
    const vCost: Record<string, number> = {};
    const pName: Record<string, string> = {};
    const vName: Record<string, string> = {};
    productsData.forEach((p: any) => {
      pCost[p.id] = Number(p.purchase_price_single || 0);
      pName[p.id] = p.name;
      (p.product_variants || []).forEach((v: any) => {
        vCost[v.id] = Number(v.purchase_price || 0);
        vName[v.id] = `${p.name} (${v.packing_name})`;
      });
    });
    return { productCostMap: pCost, variantCostMap: vCost, productNameMap: pName, variantNameMap: vName };
  }, [productsData]);

  // ── P&L Summary ────────────────────────────────────────────────────────────
  useEffect(() => {
    const rev  = salesData.reduce((s, x) => s + Number(x.total_amount), 0);
    const cogs = salesData.reduce((s, x) => s + Number(x.cogs || 0), 0);
    const exp  = expensesData.reduce((s, x) => s + Number(x.amount || 0), 0);
    const gp   = rev - cogs;
    const np   = gp - exp;
    setPlSummary({ revenue: rev, cogs, expenses: exp, grossProfit: gp, netProfit: np, marginPct: rev > 0 ? (np / rev) * 100 : 0 });
  }, [salesData, expensesData]);

  // ── Stock Summary ──────────────────────────────────────────────────────────
  useEffect(() => {
    let ti = 0, tq = 0, cv = 0, rv = 0, lc = 0;
    productsData.forEach((p: any) => {
      ti++;
      const s = Number(p.current_stock || 0);
      tq += s;
      if (p.product_variants?.length > 0) {
        p.product_variants.forEach((v: any) => {
          const vs = Number(v.stock_quantity || 0);
          cv += vs * Number(v.purchase_price || 0);
          rv += vs * Number(v.sale_price || 0);
        });
      } else {
        cv += s * Number(p.purchase_price_single || 0);
        rv += s * Number(p.sale_price_single || 0);
      }
      if (s <= Number(p.min_stock_level || 0)) lc++;
    });
    setStockSummary({ totalItems: ti, totalQuantity: tq, valuationCost: cv, valuationRetail: rv, expectedProfit: rv - cv, lowStockCount: lc });
  }, [productsData]);

  // ── Advanced aggregations (client-side) ───────────────────────────────────
  const salesByProduct = React.useMemo(() => {
    const agg: Record<string, { name: string; qty: number; revenue: number; cost: number; profit: number }> = {};
    salesData.forEach((inv: any) => {
      (inv.invoice_items || []).forEach((it: any) => {
        const key = it.variant_id || it.product_id || "unknown";
        if (key === "unknown") return;
        const name = (it.variant_id && variantNameMap[it.variant_id]) ? variantNameMap[it.variant_id] : (productNameMap[it.product_id] || "Unknown");
        const cp   = (it.variant_id && variantCostMap[it.variant_id]) ? variantCostMap[it.variant_id] : (productCostMap[it.product_id] || 0);
        const qty  = Number(it.quantity || 0);
        const rev  = Number(it.subtotal || 0);
        const cost = qty * cp;
        if (!agg[key]) agg[key] = { name, qty: 0, revenue: 0, cost: 0, profit: 0 };
        agg[key].qty     += qty;
        agg[key].revenue += rev;
        agg[key].cost    += cost;
        agg[key].profit  += rev - cost;
      });
    });
    return Object.values(agg).sort((a, b) => b.revenue - a.revenue);
  }, [salesData, productNameMap, variantNameMap, productCostMap, variantCostMap]);

  const salesByCustomer = React.useMemo(() => {
    const agg: Record<string, { name: string; count: number; total: number; paid: number; balance: number }> = {};
    salesData.forEach((inv: any) => {
      const key  = inv.party_id || "walk-in";
      const name = inv.parties?.name || "Walk-in Customer";
      const tot  = Number(inv.total_amount || 0);
      const paid = Number(inv.paid_amount || 0);
      if (!agg[key]) agg[key] = { name, count: 0, total: 0, paid: 0, balance: 0 };
      agg[key].count++;
      agg[key].total   += tot;
      agg[key].paid    += paid;
      agg[key].balance += tot - paid;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [salesData]);

  const salesByPayment = React.useMemo(() => {
    const agg: Record<string, { mode: string; count: number; total: number }> = {};
    salesData.forEach((inv: any) => {
      const mode = inv.payment_mode || "cash";
      const tot  = Number(inv.total_amount || 0);
      if (!agg[mode]) agg[mode] = { mode, count: 0, total: 0 };
      agg[mode].count++;
      agg[mode].total += tot;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [salesData]);

  const purchasesBySupplier = React.useMemo(() => {
    const agg: Record<string, { name: string; count: number; total: number }> = {};
    purchasesData.forEach((po: any) => {
      const key  = po.supplier_id || "generic";
      const name = po.parties?.name || "Generic Supplier";
      const tot  = Number(po.total_amount || 0);
      if (!agg[key]) agg[key] = { name, count: 0, total: 0 };
      agg[key].count++;
      agg[key].total += tot;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [purchasesData]);

  const expenseByCategory = React.useMemo(() => {
    const agg: Record<string, { category: string; count: number; total: number }> = {};
    expensesData.forEach((e: any) => {
      const cat = e.expense_type || "general";
      const amt = Number(e.amount || 0);
      if (!agg[cat]) agg[cat] = { category: cat, count: 0, total: 0 };
      agg[cat].count++;
      agg[cat].total += amt;
    });
    return Object.values(agg).sort((a, b) => b.total - a.total);
  }, [expensesData]);

  // ── Date presets ───────────────────────────────────────────────────────────
  const setPreset = (days: number, type: "days" | "month" | "year") => {
    const end = new Date(), start = new Date();
    if (type === "days")  start.setDate(end.getDate() - days);
    else if (type === "month") start.setDate(1);
    else if (type === "year")  start.setMonth(0, 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  // ── PDF Generation ─────────────────────────────────────────────────────────
  const generatePDF = () => {
    setDownloading(true);
    try {
      const doc  = new jsPDF();
      const pm   = 15;
      const blue = [30, 41, 59] as [number, number, number];

      // Header band
      doc.setFillColor(...blue); doc.rect(0, 0, 210, 40, "F");
      doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold");   doc.setFontSize(20); doc.text(shopName || "HISAB X", pm, 17);
      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text("Business Audit & Reports Statement", pm, 25);
      doc.text(`Generated By: ${userName || "Operator"}`, pm, 32);
      doc.text(`Date: ${startDate}  →  ${endDate}`, 130, 18);
      doc.text(`Exported: ${new Date().toLocaleString()}`, 130, 25);
      doc.text(`Report: ${activeTab.toUpperCase().replace(/_/g," ")}`, 130, 32);

      let y = 55;

      const box = (label: string, val: string, x: number, w: number) => {
        doc.setFillColor(248,250,252); doc.rect(x, y, w, 22, "F");
        doc.setDrawColor(226,232,240); doc.rect(x, y, w, 22, "S");
        doc.setTextColor(100,116,139); doc.setFontSize(7.5); doc.setFont("helvetica","bold");
        doc.text(label.toUpperCase(), x+4, y+7);
        doc.setTextColor(15,23,42);   doc.setFontSize(11);
        doc.text(val, x+4, y+16);
      };

      let head: string[][] = [];
      let rows: any[][] = [];

      if (activeTab === "sales") {
        box("Total Invoices", `${salesData.length}`, pm, 38);
        box("Total Revenue", `Rs ${Math.round(plSummary.revenue).toLocaleString()}`, pm+43, 65);
        box("Est. Gross Profit", `Rs ${Math.round(plSummary.grossProfit).toLocaleString()}`, pm+113, 67);
        y += 32;
        head = [["Date","Invoice ID","Customer","Mode","Received (Rs)","Total (Rs)","Profit (Rs)"]];
        rows = salesData.map(s => [
          new Date(s.created_at).toLocaleDateString(),
          s.id.substring(0,8).toUpperCase(),
          s.parties?.name || "Walk-in",
          s.payment_mode || "cash",
          Number(s.paid_amount||0).toFixed(0),
          Number(s.total_amount||0).toFixed(0),
          Number(s.profit||0).toFixed(0)
        ]);

      } else if (activeTab === "sales_by_product") {
        const totQty = salesByProduct.reduce((s,p)=>s+p.qty,0);
        const totRev = salesByProduct.reduce((s,p)=>s+p.revenue,0);
        const totPrf = salesByProduct.reduce((s,p)=>s+p.profit,0);
        box("Total Units Sold", `${totQty.toLocaleString()}`, pm, 50);
        box("Product Revenue", `Rs ${Math.round(totRev).toLocaleString()}`, pm+55, 62);
        box("Estimated Profit", `Rs ${Math.round(totPrf).toLocaleString()}`, pm+122, 58);
        y += 32;
        head = [["Product / Variant","Qty Sold","Avg Price","Total Sales (Rs)","Total Cost (Rs)","Net Profit (Rs)","Margin (%)"]];
        rows = salesByProduct.map(p => [
          p.name,
          p.qty.toString(),
          (p.revenue/(p.qty||1)).toFixed(0),
          p.revenue.toFixed(0),
          p.cost.toFixed(0),
          p.profit.toFixed(0),
          `${(p.revenue>0?(p.profit/p.revenue)*100:0).toFixed(1)}%`
        ]);

      } else if (activeTab === "sales_by_customer") {
        const totPur  = salesByCustomer.reduce((s,c)=>s+c.total,0);
        const totBal  = salesByCustomer.reduce((s,c)=>s+c.balance,0);
        box("Active Customers", `${salesByCustomer.length}`, pm, 45);
        box("Total Purchased", `Rs ${Math.round(totPur).toLocaleString()}`, pm+50, 67);
        box("Outstanding Udhaar", `Rs ${Math.round(totBal).toLocaleString()}`, pm+122, 58);
        y += 32;
        head = [["Customer Name","Invoices","Total Purchased (Rs)","Paid (Rs)","Udhaar / Balance (Rs)"]];
        rows = salesByCustomer.map(c=>[c.name,c.count.toString(),c.total.toFixed(0),c.paid.toFixed(0),c.balance.toFixed(0)]);

      } else if (activeTab === "sales_by_payment") {
        const totRev = salesByPayment.reduce((s,p)=>s+p.total,0);
        box("Total Sale Inflow", `Rs ${Math.round(totRev).toLocaleString()}`, pm, 65);
        box("Cash (نقد)", `Rs ${Math.round(salesByPayment.find(p=>p.mode==="cash")?.total||0).toLocaleString()}`, pm+70, 55);
        box("Udhaar (ادھار)", `Rs ${Math.round(salesByPayment.find(p=>p.mode==="credit")?.total||0).toLocaleString()}`, pm+130, 50);
        y += 32;
        head = [["Payment Method","Invoice Count","Total (Rs)","Share (%)"]];
        rows = salesByPayment.map(p=>[
          p.mode.toUpperCase(),
          p.count.toString(),
          p.total.toFixed(0),
          `${(salesByPayment.reduce((s,x)=>s+x.total,0)>0?(p.total/salesByPayment.reduce((s,x)=>s+x.total,0))*100:0).toFixed(1)}%`
        ]);

      } else if (activeTab === "purchases") {
        const totPur = purchasesData.reduce((s,p)=>s+Number(p.total_amount),0);
        box("Purchase Orders", `${purchasesData.length}`, pm, 50);
        box("Total Spending", `Rs ${Math.round(totPur).toLocaleString()}`, pm+55, 125);
        y += 32;
        head = [["Date","PO ID","Supplier","Status","Total (Rs)"]];
        rows = purchasesData.map(p=>[
          new Date(p.created_at).toLocaleDateString(),
          p.id.substring(0,8).toUpperCase(),
          p.parties?.name||"Generic Supplier",
          p.status||"completed",
          Number(p.total_amount||0).toFixed(0)
        ]);

      } else if (activeTab === "purchases_by_supplier") {
        const totSp = purchasesBySupplier.reduce((s,x)=>s+x.total,0);
        box("Suppliers", `${purchasesBySupplier.length}`, pm, 50);
        box("Total Procurement Spend", `Rs ${Math.round(totSp).toLocaleString()}`, pm+55, 125);
        y += 32;
        head = [["Supplier Name","Restock Orders","Total Spent (Rs)"]];
        rows = purchasesBySupplier.map(s=>[s.name,s.count.toString(),s.total.toFixed(0)]);

      } else if (activeTab === "expenses") {
        box("Expense Entries", `${expensesData.length}`, pm, 50);
        box("Total Expense", `Rs ${Math.round(plSummary.expenses).toLocaleString()}`, pm+55, 125);
        y += 32;
        head = [["Date","Name","Category","Remarks","Amount (Rs)"]];
        rows = expensesData.map(e=>[
          new Date(e.created_at).toLocaleDateString(),
          e.name,
          e.expense_type||"general",
          e.remarks||"-",
          Number(e.amount||0).toFixed(0)
        ]);

      } else if (activeTab === "expense_category") {
        const totExp = expenseByCategory.reduce((s,c)=>s+c.total,0);
        box("Categories", `${expenseByCategory.length}`, pm, 50);
        box("Total Expenses", `Rs ${Math.round(totExp).toLocaleString()}`, pm+55, 125);
        y += 32;
        head = [["Category","Transactions","Total Spent (Rs)","Share (%)"]];
        rows = expenseByCategory.map(c=>[
          c.category.toUpperCase(),
          c.count.toString(),
          c.total.toFixed(0),
          `${(expenseByCategory.reduce((s,x)=>s+x.total,0)>0?(c.total/expenseByCategory.reduce((s,x)=>s+x.total,0))*100:0).toFixed(1)}%`
        ]);

      } else if (activeTab === "pl") {
        box("Sales Revenue", `Rs ${Math.round(plSummary.revenue).toLocaleString()}`, pm, 55);
        box("COGS", `Rs ${Math.round(plSummary.cogs).toLocaleString()}`, pm+60, 60);
        box("Expenses", `Rs ${Math.round(plSummary.expenses).toLocaleString()}`, pm+125, 55);
        doc.setFillColor(...blue); doc.rect(pm, y+28, 180, 12, "F");
        doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont("helvetica","bold");
        doc.text(`NET PROFIT: Rs ${Math.round(plSummary.netProfit).toLocaleString()}  (Margin: ${plSummary.marginPct.toFixed(1)}%)`, pm+5, y+36);
        y += 50;
        head = [["P&L Account","Value (Rs)"]];
        rows = [
          ["Gross Sales Revenue",plSummary.revenue.toFixed(0)],
          ["Cost of Goods Sold (COGS)",plSummary.cogs.toFixed(0)],
          ["Gross Profit",plSummary.grossProfit.toFixed(0)],
          ["Operating Expenses",plSummary.expenses.toFixed(0)],
          ["Net Profit",plSummary.netProfit.toFixed(0)]
        ];

      } else if (activeTab === "inventory") {
        box("Stock Valuation (Cost)", `Rs ${Math.round(stockSummary.valuationCost).toLocaleString()}`, pm, 55);
        box("Stock Retail Value", `Rs ${Math.round(stockSummary.valuationRetail).toLocaleString()}`, pm+60, 60);
        box("Expected Profit", `Rs ${Math.round(stockSummary.expectedProfit).toLocaleString()}`, pm+125, 55);
        y += 32;
        head = [["ID","Product Name","Stock","Alert Level","Cost (Rs)","Retail (Rs)"]];
        rows = productsData.map(p=>[
          p.id.substring(0,8).toUpperCase(),
          p.name,
          `${p.current_stock} ${p.unit||"pcs"}`,
          `${p.min_stock_level} ${p.unit||"pcs"}`,
          (Number(p.current_stock||0)*Number(p.purchase_price_single||0)).toFixed(0),
          (Number(p.current_stock||0)*Number(p.sale_price_single||0)).toFixed(0)
        ]);

      } else if (activeTab === "khata") {
        const totRec = partiesData.filter(p=>p.type==="customer").reduce((s,p)=>s+Number(p.current_balance||0),0);
        const totPay = partiesData.filter(p=>p.type==="supplier").reduce((s,p)=>s+Number(p.current_balance||0),0);
        box("Customer Receivables", `Rs ${Math.round(totRec).toLocaleString()}`, pm, 88);
        box("Supplier Payables",    `Rs ${Math.round(totPay).toLocaleString()}`, pm+95, 85);
        y += 32;
        head = [["Party Name","Phone","Type","Outstanding Balance (Rs)"]];
        rows = partiesData.map(p=>[
          p.name, p.phone||"-",
          p.type==="customer"?"Customer":"Supplier",
          Number(p.current_balance||0).toFixed(0)
        ]);
      }

      autoTable(doc, {
        startY: y,
        head,
        body: rows,
        margin: { left: pm, right: pm },
        styles: { fontSize: 8, font: "helvetica" },
        headStyles: { fillColor: blue, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: () => {},
      });

      doc.save(`HisabX_${activeTab}_${startDate}_to_${endDate}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (err: any) {
      toast.error("PDF generation failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Sidebar tab config ─────────────────────────────────────────────────────
  const tabs: { id: ReportTab; label: string; urdu: string; icon: React.ReactNode; group: string }[] = [
    { id:"sales",               label:"Sales Summary",         urdu:"سیلز سمری",       icon:<ShoppingBag size={13}/>, group:"Sales (فروخت)" },
    { id:"sales_by_product",    label:"Sales by Product",      urdu:"پروڈکٹ سیلز",     icon:<Layers size={13}/>,      group:"Sales (فروخت)" },
    { id:"sales_by_customer",   label:"Sales by Customer",     urdu:"کسٹمر سیلز",      icon:<Users size={13}/>,       group:"Sales (فروخت)" },
    { id:"sales_by_payment",    label:"Sales by Payment",      urdu:"ادائیگی رپورٹ",   icon:<CreditCard size={13}/>,  group:"Sales (فروخت)" },
    { id:"purchases",           label:"Purchases Summary",     urdu:"خریداری سمری",    icon:<Truck size={13}/>,       group:"Purchases (خریداری)" },
    { id:"purchases_by_supplier",label:"Purchases by Supplier",urdu:"سپلائر خریداری", icon:<Truck size={13}/>,       group:"Purchases (خریداری)" },
    { id:"expenses",            label:"Expense Statements",    urdu:"اخراجات تفصیل",  icon:<TrendingDown size={13}/>, group:"Expenses (اخراجات)" },
    { id:"expense_category",    label:"Expense by Category",   urdu:"اخراجات اقسام",  icon:<Layers size={13}/>,      group:"Expenses (اخراجات)" },
    { id:"pl",                  label:"Profit & Loss",         urdu:"نفع و نقصان",     icon:<Calculator size={13}/>,  group:"Analytics (تجزیہ)" },
    { id:"inventory",           label:"Stock Valuation",       urdu:"اسٹاک مالیت",     icon:<Package size={13}/>,     group:"Analytics (تجزیہ)" },
    { id:"khata",               label:"Khata / Udhaar",        urdu:"بقایا ادھار",     icon:<Users size={13}/>,       group:"Analytics (تجزیہ)" },
  ];
  const groups = [...new Set(tabs.map(t=>t.group))];

  return (
    <div className="space-y-5 animate-in fade-in duration-500 font-sans text-slate-800">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
            Auditing &amp; Reports Center
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            11 comprehensive business reports — each exportable as a professional PDF.
          </p>
        </div>
        <Button
          onClick={generatePDF}
          disabled={loading || downloading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 shadow-md shadow-blue-200 self-start md:self-auto cursor-pointer"
        >
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
          Download PDF Report
        </Button>
      </div>

      {/* ── Date Controls ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">From</span>
            <Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="h-8 text-xs w-36 font-semibold"/>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">To</span>
            <Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="h-8 text-xs w-36 font-semibold"/>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            {label:"Today",    cb:()=>setPreset(0,"days")},
            {label:"Yesterday",cb:()=>setPreset(1,"days")},
            {label:"7 Days",   cb:()=>setPreset(7,"days")},
            {label:"30 Days",  cb:()=>setPreset(30,"days")},
            {label:"This Month",cb:()=>setPreset(0,"month")},
            {label:"This Year", cb:()=>setPreset(0,"year")},
          ].map(btn=>(
            <button key={btn.label} onClick={btn.cb}
              className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-200 text-[11px] font-bold text-slate-600 rounded-xl transition-all cursor-pointer">
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main layout: Sidebar + Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: Tab Navigator */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 h-fit space-y-4">
          {groups.map(group => (
            <div key={group}>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-2">{group}</p>
              <div className="space-y-0.5">
                {tabs.filter(t=>t.group===group).map(t=>(
                  <button
                    key={t.id}
                    onClick={()=>setActiveTab(t.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-[11px] font-extrabold transition-all cursor-pointer ${
                      activeTab===t.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2">{t.icon} {t.label}</span>
                    <span className={`text-[9px] font-bold ${activeTab===t.id?"text-blue-200":"text-slate-400"}`}>{t.urdu}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Report Content */}
        <div className="lg:col-span-9 space-y-5">

          {loading ? (
            <div className="h-[45vh] flex flex-col justify-center items-center bg-white rounded-3xl border border-slate-200/80 shadow-sm text-slate-400">
              <Loader2 className="h-9 w-9 animate-spin mb-3 text-blue-500"/>
              <p className="font-semibold text-sm">Loading report data...</p>
            </div>
          ) : (
            <>
              {/* ── KPI Summary Cards ── */}

              {/* SALES SUMMARY */}
              {activeTab==="sales" && (
                <div className="grid md:grid-cols-3 gap-4">
                  <KpiCard label="Total Invoices" value={`${salesData.length}`} sub="Issued in date range" color="blue"/>
                  <KpiCard label="Total Revenue" value={`Rs ${Math.round(plSummary.revenue).toLocaleString()}`} sub="All invoice totals" color="slate"/>
                  <KpiCard label="Gross Profit" value={`Rs ${Math.round(plSummary.grossProfit).toLocaleString()}`} sub={`Margin: ${plSummary.revenue>0?((plSummary.grossProfit/plSummary.revenue)*100).toFixed(1):0}%`} color="green"/>
                </div>
              )}

              {/* SALES BY PRODUCT */}
              {activeTab==="sales_by_product" && (
                <div className="grid md:grid-cols-3 gap-4">
                  <KpiCard label="Products Ranked" value={`${salesByProduct.length}`} sub="SKUs with sales activity" color="blue"/>
                  <KpiCard label="Total Revenue" value={`Rs ${Math.round(salesByProduct.reduce((s,p)=>s+p.revenue,0)).toLocaleString()}`} sub="Product sales combined" color="slate"/>
                  <KpiCard label="Estimated Profit" value={`Rs ${Math.round(salesByProduct.reduce((s,p)=>s+p.profit,0)).toLocaleString()}`} sub="Revenue minus purchase cost" color="green"/>
                </div>
              )}

              {/* SALES BY CUSTOMER */}
              {activeTab==="sales_by_customer" && (
                <div className="grid md:grid-cols-3 gap-4">
                  <KpiCard label="Customers" value={`${salesByCustomer.length}`} sub="Unique buyers in period" color="blue"/>
                  <KpiCard label="Total Purchased" value={`Rs ${Math.round(salesByCustomer.reduce((s,c)=>s+c.total,0)).toLocaleString()}`} sub="Gross ledger billing" color="slate"/>
                  <KpiCard label="Outstanding Udhaar" value={`Rs ${Math.round(salesByCustomer.reduce((s,c)=>s+c.balance,0)).toLocaleString()}`} sub="Unpaid balances due" color="red"/>
                </div>
              )}

              {/* SALES BY PAYMENT */}
              {activeTab==="sales_by_payment" && (() => {
                const totRev = salesByPayment.reduce((s,p)=>s+p.total,0);
                return (
                  <div className="grid md:grid-cols-3 gap-4">
                    <KpiCard label="Cash (نقد)" value={`Rs ${Math.round(salesByPayment.find(p=>p.mode==="cash")?.total||0).toLocaleString()}`} sub={`${salesByPayment.find(p=>p.mode==="cash")?.count||0} transactions`} color="green"/>
                    <KpiCard label="Card (کارڈ)" value={`Rs ${Math.round(salesByPayment.find(p=>p.mode==="card")?.total||0).toLocaleString()}`} sub={`${salesByPayment.find(p=>p.mode==="card")?.count||0} transactions`} color="blue"/>
                    <KpiCard label="Udhaar (ادھار)" value={`Rs ${Math.round(salesByPayment.find(p=>p.mode==="credit")?.total||0).toLocaleString()}`} sub={`${salesByPayment.find(p=>p.mode==="credit")?.count||0} credit bills`} color="red"/>
                  </div>
                );
              })()}

              {/* PURCHASES SUMMARY */}
              {activeTab==="purchases" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <KpiCard label="Purchase Orders" value={`${purchasesData.length}`} sub="Supplier restocks received" color="blue"/>
                  <KpiCard label="Total Spend" value={`Rs ${Math.round(purchasesData.reduce((s,p)=>s+Number(p.total_amount||0),0)).toLocaleString()}`} sub="Procurement capital outflow" color="slate"/>
                </div>
              )}

              {/* PURCHASES BY SUPPLIER */}
              {activeTab==="purchases_by_supplier" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <KpiCard label="Active Suppliers" value={`${purchasesBySupplier.length}`} sub="Suppliers with restocks" color="blue"/>
                  <KpiCard label="Total Procurement" value={`Rs ${Math.round(purchasesBySupplier.reduce((s,x)=>s+x.total,0)).toLocaleString()}`} sub="Total wholesale spend" color="slate"/>
                </div>
              )}

              {/* EXPENSE DETAILS */}
              {activeTab==="expenses" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <KpiCard label="Expense Entries" value={`${expensesData.length}`} sub="Logged operations costs" color="blue"/>
                  <KpiCard label="Total Expenses" value={`Rs ${Math.round(plSummary.expenses).toLocaleString()}`} sub="Non-product outflow" color="red"/>
                </div>
              )}

              {/* EXPENSE BY CATEGORY */}
              {activeTab==="expense_category" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <KpiCard label="Expense Categories" value={`${expenseByCategory.length}`} sub="Distinct types logged" color="blue"/>
                  <KpiCard label="Total Expenses" value={`Rs ${Math.round(expenseByCategory.reduce((s,c)=>s+c.total,0)).toLocaleString()}`} sub="Total outflow sum" color="red"/>
                </div>
              )}

              {/* PROFIT & LOSS */}
              {activeTab==="pl" && (
                <div className="grid md:grid-cols-3 gap-4">
                  <KpiCard label="Gross Revenue" value={`Rs ${Math.round(plSummary.revenue).toLocaleString()}`} sub="Total billings" color="slate" dark/>
                  <KpiCard label="Total COGS" value={`Rs ${Math.round(plSummary.cogs).toLocaleString()}`} sub="Purchase cost of sold goods" color="slate"/>
                  <KpiCard label="Net Profit" value={`Rs ${Math.round(plSummary.netProfit).toLocaleString()}`} sub={`Margin: ${plSummary.marginPct.toFixed(1)}%`} color="green"/>
                </div>
              )}

              {/* INVENTORY */}
              {activeTab==="inventory" && (
                <div className="grid md:grid-cols-3 gap-4">
                  <KpiCard label="Stock at Cost" value={`Rs ${Math.round(stockSummary.valuationCost).toLocaleString()}`} sub="Procurement asset value" color="slate"/>
                  <KpiCard label="Stock at Retail" value={`Rs ${Math.round(stockSummary.valuationRetail).toLocaleString()}`} sub="Expected sale revenue" color="blue"/>
                  <KpiCard label="Expected Profit" value={`Rs ${Math.round(stockSummary.expectedProfit).toLocaleString()}`} sub={`${stockSummary.lowStockCount} items low on stock`} color="green"/>
                </div>
              )}

              {/* KHATA */}
              {activeTab==="khata" && (
                <div className="grid md:grid-cols-3 gap-4">
                  <KpiCard label="Customer Receivables" value={`Rs ${Math.round(partiesData.filter(p=>p.type==="customer").reduce((s,p)=>s+Number(p.current_balance||0),0)).toLocaleString()}`} sub="Udhaar to collect" color="red"/>
                  <KpiCard label="Supplier Payables" value={`Rs ${Math.round(partiesData.filter(p=>p.type==="supplier").reduce((s,p)=>s+Number(p.current_balance||0),0)).toLocaleString()}`} sub="Amount owed to suppliers" color="slate"/>
                  <KpiCard label="Registered Parties" value={`${partiesData.length}`} sub="Customers + Suppliers" color="blue" dark/>
                </div>
              )}

              {/* ── Data Table ── */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Statement Details</h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                    {startDate} → {endDate}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-600">
                    <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                      <ReportTableHead activeTab={activeTab}/>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      <ReportTableBody
                        activeTab={activeTab}
                        salesData={salesData}
                        salesByProduct={salesByProduct}
                        salesByCustomer={salesByCustomer}
                        salesByPayment={salesByPayment}
                        purchasesData={purchasesData}
                        purchasesBySupplier={purchasesBySupplier}
                        expensesData={expensesData}
                        expenseByCategory={expenseByCategory}
                        plSummary={plSummary}
                        productsData={productsData}
                        partiesData={partiesData}
                      />
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, dark }: {
  label: string; value: string; sub: string;
  color: "blue"|"green"|"red"|"slate"; dark?: boolean;
}) {
  const colors: Record<string, string> = {
    blue:  "text-blue-600",
    green: "text-emerald-600",
    red:   "text-rose-600",
    slate: "text-slate-800",
  };
  return (
    <div className={`p-4.5 rounded-2xl border ${dark?"bg-slate-900 border-slate-700":"bg-white border-slate-200/80"} shadow-sm`}>
      <span className={`text-[9px] font-black uppercase tracking-widest block ${dark?"text-slate-400":"text-slate-400"}`}>{label}</span>
      <h3 className={`text-xl font-black mt-1 ${dark?"text-white":colors[color]}`}>{value}</h3>
      <p className={`text-[10px] font-bold mt-1.5 ${dark?"text-slate-500":"text-slate-400"}`}>{sub}</p>
    </div>
  );
}

function ReportTableHead({ activeTab }: { activeTab: ReportTab }) {
  const th = (text: string, right = false) => (
    <th className={`py-3 px-4 ${right?"text-right":""}`}>{text}</th>
  );
  if (activeTab==="sales") return <tr>{th("Date")}{th("Invoice ID")}{th("Customer")}{th("Mode")}{th("Received",true)}{th("Total",true)}{th("Est. Profit",true)}</tr>;
  if (activeTab==="sales_by_product") return <tr>{th("Product / Variant")}{th("Units Sold",true)}{th("Avg Price",true)}{th("Sales Revenue",true)}{th("Cost (COGS)",true)}{th("Net Profit",true)}{th("Margin",true)}</tr>;
  if (activeTab==="sales_by_customer") return <tr>{th("Customer")}{th("Invoices",true)}{th("Total Purchased",true)}{th("Paid",true)}{th("Balance / Udhaar",true)}</tr>;
  if (activeTab==="sales_by_payment") return <tr>{th("Payment Method")}{th("Invoice Count",true)}{th("Total Revenue",true)}{th("Share %",true)}</tr>;
  if (activeTab==="purchases") return <tr>{th("Date")}{th("PO ID")}{th("Supplier")}{th("Status")}{th("Total Amount",true)}</tr>;
  if (activeTab==="purchases_by_supplier") return <tr>{th("Supplier Name")}{th("Orders",true)}{th("Total Spend",true)}</tr>;
  if (activeTab==="expenses") return <tr>{th("Date")}{th("Expense Name")}{th("Category")}{th("Remarks")}{th("Amount",true)}</tr>;
  if (activeTab==="expense_category") return <tr>{th("Category")}{th("Count",true)}{th("Total Amount",true)}{th("Share %",true)}</tr>;
  if (activeTab==="pl") return <tr>{th("P&L Account")}{th("Value (Rs)",true)}</tr>;
  if (activeTab==="inventory") return <tr>{th("Code")}{th("Product Name")}{th("Stock")}{th("Alert")}{th("Cost (Rs)",true)}{th("Retail (Rs)",true)}</tr>;
  if (activeTab==="khata") return <tr>{th("Party Name")}{th("Phone")}{th("Type")}{th("Balance (Rs)",true)}</tr>;
  return null;
}

function ReportTableBody({ activeTab, salesData, salesByProduct, salesByCustomer, salesByPayment,
  purchasesData, purchasesBySupplier, expensesData, expenseByCategory,
  plSummary, productsData, partiesData }: {
  activeTab: ReportTab;
  salesData: any[]; salesByProduct: any[]; salesByCustomer: any[];
  salesByPayment: any[]; purchasesData: any[]; purchasesBySupplier: any[];
  expensesData: any[]; expenseByCategory: any[];
  plSummary: any; productsData: any[]; partiesData: any[];
}) {
  const td  = (v: React.ReactNode, right=false, bold=false, cls="") => (
    <td className={`py-3 px-4 ${right?"text-right":""} ${bold?"font-bold":""} ${cls}`}>{v}</td>
  );
  const badge = (text: string, color: string) => (
    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${color}`}>{text}</span>
  );
  const empty = (cols: number, msg: string) => (
    <tr><td colSpan={cols} className="py-10 text-center text-slate-400 text-sm font-semibold">{msg}</td></tr>
  );

  if (activeTab==="sales") {
    if (!salesData.length) return empty(7,"No invoices in selected date range.");
    return <>{salesData.map(s=>(
      <tr key={s.id} className="hover:bg-slate-50/60">
        {td(new Date(s.created_at).toLocaleDateString(),false,false,"text-slate-500")}
        {td(<span className="font-mono text-[10px] text-slate-500">{s.id.substring(0,8).toUpperCase()}</span>)}
        {td(s.parties?.name||"Walk-in",false,true)}
        {td(badge(s.payment_mode||"cash", s.payment_mode==="credit"?"bg-rose-50 text-rose-700":s.payment_mode==="card"?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"))}
        {td(`Rs ${Math.round(s.paid_amount||0).toLocaleString()}`,true)}
        {td(`Rs ${Math.round(s.total_amount||0).toLocaleString()}`,true,true)}
        {td(<span className="font-bold text-emerald-600">Rs {Math.round(s.profit||0).toLocaleString()}</span>,true)}
      </tr>
    ))}</>;
  }

  if (activeTab==="sales_by_product") {
    if (!salesByProduct.length) return empty(7,"No product sales in selected date range.");
    return <>{salesByProduct.map(p=>(
      <tr key={p.name} className="hover:bg-slate-50/60">
        {td(p.name,false,true)}
        {td(`${p.qty.toLocaleString()} units`,true,false,"text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(p.revenue/(p.qty||1)).toLocaleString()}`,true)}
        {td(`Rs ${Math.round(p.revenue).toLocaleString()}`,true,true)}
        {td(`Rs ${Math.round(p.cost).toLocaleString()}`,true,false,"text-slate-400")}
        {td(<span className="font-black text-emerald-600">Rs {Math.round(p.profit).toLocaleString()}</span>,true)}
        {td(`${(p.revenue>0?(p.profit/p.revenue)*100:0).toFixed(1)}%`,true,false,"text-slate-500 font-bold")}
      </tr>
    ))}</>;
  }

  if (activeTab==="sales_by_customer") {
    if (!salesByCustomer.length) return empty(5,"No customer data in range.");
    return <>{salesByCustomer.map(c=>(
      <tr key={c.name} className="hover:bg-slate-50/60">
        {td(c.name,false,true)}
        {td(`${c.count} bills`,true,false,"text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(c.total).toLocaleString()}`,true,true)}
        {td(`Rs ${Math.round(c.paid).toLocaleString()}`,true,false,"text-emerald-600")}
        {td(<span className={`font-black ${c.balance>0?"text-rose-600":"text-emerald-600"}`}>Rs {Math.round(c.balance).toLocaleString()}</span>,true)}
      </tr>
    ))}</>;
  }

  if (activeTab==="sales_by_payment") {
    if (!salesByPayment.length) return empty(4,"No payment data in range.");
    const tot = salesByPayment.reduce((s,p)=>s+p.total,0);
    return <>{salesByPayment.map(p=>(
      <tr key={p.mode} className="hover:bg-slate-50/60">
        {td(<span className="font-black uppercase">{p.mode}</span>)}
        {td(`${p.count} invoices`,true,false,"text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(p.total).toLocaleString()}`,true,true)}
        {td(`${tot>0?((p.total/tot)*100).toFixed(1):0}%`,true,false,"text-slate-500 font-bold")}
      </tr>
    ))}</>;
  }

  if (activeTab==="purchases") {
    if (!purchasesData.length) return empty(5,"No purchase orders in range.");
    return <>{purchasesData.map(p=>(
      <tr key={p.id} className="hover:bg-slate-50/60">
        {td(new Date(p.created_at).toLocaleDateString(),false,false,"text-slate-500")}
        {td(<span className="font-mono text-[10px] text-slate-400">{p.id.substring(0,8).toUpperCase()}</span>)}
        {td(p.parties?.name||"Generic Supplier",false,true)}
        {td(badge(p.status||"completed","bg-emerald-50 text-emerald-700"))}
        {td(`Rs ${Math.round(p.total_amount||0).toLocaleString()}`,true,true)}
      </tr>
    ))}</>;
  }

  if (activeTab==="purchases_by_supplier") {
    if (!purchasesBySupplier.length) return empty(3,"No supplier procurement data.");
    return <>{purchasesBySupplier.map(s=>(
      <tr key={s.name} className="hover:bg-slate-50/60">
        {td(s.name,false,true)}
        {td(`${s.count} orders`,true,false,"text-slate-500 font-mono text-[10px]")}
        {td(`Rs ${Math.round(s.total).toLocaleString()}`,true,true)}
      </tr>
    ))}</>;
  }

  if (activeTab==="expenses") {
    if (!expensesData.length) return empty(5,"No expenses logged in range.");
    return <>{expensesData.map(e=>(
      <tr key={e.id} className="hover:bg-slate-50/60">
        {td(new Date(e.created_at).toLocaleDateString(),false,false,"text-slate-500")}
        {td(e.name,false,true)}
        {td(<span className="text-[9px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{e.expense_type||"general"}</span>)}
        {td(e.remarks||"-",false,false,"truncate max-w-[120px] text-slate-400")}
        {td(<span className="font-bold text-rose-600">Rs {Math.round(e.amount||0).toLocaleString()}</span>,true)}
      </tr>
    ))}</>;
  }

  if (activeTab==="expense_category") {
    if (!expenseByCategory.length) return empty(4,"No expense categories found.");
    const tot = expenseByCategory.reduce((s,c)=>s+c.total,0);
    return <>{expenseByCategory.map(c=>(
      <tr key={c.category} className="hover:bg-slate-50/60">
        {td(<span className="font-black uppercase">{c.category}</span>)}
        {td(`${c.count} logs`,true,false,"text-slate-500 font-mono text-[10px]")}
        {td(<span className="font-bold text-rose-600">Rs {Math.round(c.total).toLocaleString()}</span>,true)}
        {td(`${tot>0?((c.total/tot)*100).toFixed(1):0}%`,true,false,"text-slate-500 font-bold")}
      </tr>
    ))}</>;
  }

  if (activeTab==="pl") {
    const rows = [
      {label:"Gross Sales Revenue (کل فروخت)", val:plSummary.revenue, cls:"text-slate-800"},
      {label:"Cost of Goods Sold / COGS (خریداری قیمت)", val:-plSummary.cogs, cls:"text-slate-500"},
      {label:"Gross Profit (مجموعی منافع)", val:plSummary.grossProfit, cls:"text-blue-700 bg-blue-50", bold:true},
      {label:"Operating Expenses (دوکان کے خرچے)", val:-plSummary.expenses, cls:"text-slate-500"},
      {label:"Net Profit (خالص منافع)", val:plSummary.netProfit, cls:"text-emerald-700 bg-emerald-50 font-black text-base", bold:true},
    ];
    return <>{rows.map((r,i)=>(
      <tr key={i} className={`${r.cls.includes("bg-")?"":"hover:bg-slate-50/60"}`}>
        <td className={`py-3.5 px-4 font-bold ${r.cls}`}>{r.label}</td>
        <td className={`py-3.5 px-4 text-right font-black ${r.cls}`}>Rs {Math.round(Math.abs(r.val)).toLocaleString()}</td>
      </tr>
    ))}</>;
  }

  if (activeTab==="inventory") {
    if (!productsData.length) return empty(6,"No products in database.");
    return <>{productsData.map((p: any)=>{
      const stock = Number(p.current_stock||0);
      const alert = stock<=Number(p.min_stock_level||0);
      return (
        <tr key={p.id} className={`hover:bg-slate-50/60 ${alert?"bg-amber-50/30":""}`}>
          {td(<span className="font-mono text-[10px] text-slate-400">{p.id.substring(0,8).toUpperCase()}</span>)}
          {td(p.name,false,true)}
          {td(<span className={`font-bold px-2 py-0.5 rounded ${alert?"bg-amber-100 text-amber-800":""}`}>{stock} {p.unit||"pcs"}</span>)}
          {td(`${p.min_stock_level||0} ${p.unit||"pcs"}`,false,false,"text-slate-400")}
          {td(`Rs ${Math.round(Number(p.purchase_price_single||0)).toLocaleString()}`,true)}
          {td(`Rs ${Math.round(Number(p.sale_price_single||0)).toLocaleString()}`,true,true)}
        </tr>
      );
    })}</>;
  }

  if (activeTab==="khata") {
    if (!partiesData.length) return empty(4,"No parties registered.");
    return <>{partiesData.map((p: any)=>{
      const bal = Number(p.current_balance||0);
      return (
        <tr key={p.id} className="hover:bg-slate-50/60">
          {td(p.name,false,true)}
          {td(p.phone||"-",false,false,"font-mono text-slate-500")}
          {td(badge(p.type==="customer"?"Customer":"Supplier", p.type==="customer"?"bg-blue-50 text-blue-700 border border-blue-100":"bg-orange-50 text-orange-700 border border-orange-100"))}
          {td(<span className={`font-black ${bal>0?(p.type==="customer"?"text-rose-600":"text-slate-700"):"text-emerald-600"}`}>Rs {Math.round(bal).toLocaleString()}</span>,true)}
        </tr>
      );
    })}</>;
  }

  return null;
}
