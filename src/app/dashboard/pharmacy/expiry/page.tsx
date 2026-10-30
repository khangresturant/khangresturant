"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Pill, AlertTriangle, CheckCircle, Search, Calendar, 
  Trash2, FileText, Loader2, RefreshCw, Archive, Plus, 
  MapPin, Clock, Edit3, X, Save, Truck, ArrowUpDown, 
  ArrowUp, ArrowDown, Settings2, Share2, Printer, 
  Download, ChevronLeft, ChevronRight, ChevronsLeft, 
  ChevronsRight, Building2, Receipt, Phone, MessageSquare, 
  ShieldAlert, Sparkles, Filter, Factory, Tag, Layers, 
  HelpCircle, Check, Info
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CustomExpiryRule = {
  id: string;
  type: "supplier" | "company" | "medicine";
  targetId: string;
  targetName: string;
  criticalDays: number;
  nearExpiryDays: number;
  advanceDays?: number;
  notes?: string;
};

type StockBatch = {
  id: string;
  sourceTable: "product_batches" | "purchase_order_items" | "stock";
  product_id: string;
  batch_number: string | null;
  expiry_date: string | null;
  stock_quantity: number;
  purchase_price?: number | null;
  sale_price?: number | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  invoice_number?: string | null;
  purchase_date?: string | null;
  products?: {
    id?: string;
    name?: string;
    unit?: string | null;
    shelf_location?: string | null;
    brand_id?: string | null;
    brands?: {
      id?: string;
      name?: string;
    } | null;
  } | null;
};

type DBProductOption = {
  id: string;
  name: string;
  unit: string | null;
  shelf_location: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
};

type SupplierOption = {
  id: string;
  name: string;
  phone: string | null;
};

type BrandOption = {
  id: string;
  name: string;
};

type ExpiryThresholds = {
  criticalDays: number;
  nearExpiryDays: number;
  advanceDays: number;
};

const DEFAULT_THRESHOLDS: ExpiryThresholds = {
  criticalDays: 30,
  nearExpiryDays: 90,
  advanceDays: 180
};

export default function ExpiryTrackerPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [productList, setProductList] = useState<DBProductOption[]>([]);
  const [supplierList, setSupplierList] = useState<SupplierOption[]>([]);
  const [brandList, setBrandList] = useState<BrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("all");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("all");
  const [selectedShelfFilter, setSelectedShelfFilter] = useState("all");
  const [stockStatusFilter, setStockStatusFilter] = useState("all"); // 'all' | 'in_stock' | 'zero_stock'

  // Sorting State
  const [sortColumn, setSortColumn] = useState<"expiry_date" | "name" | "batch_number" | "stock" | "supplier" | "company" | "invoice" | "days">("expiry_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Global & Custom Expiry Thresholds
  const [thresholds, setThresholds] = useState<ExpiryThresholds>(DEFAULT_THRESHOLDS);
  const [customRules, setCustomRules] = useState<CustomExpiryRule[]>([]);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"global" | "supplier" | "company" | "medicine">("global");
  const [tempThresholds, setTempThresholds] = useState<ExpiryThresholds>(DEFAULT_THRESHOLDS);

  // New Rule Form State inside Settings Modal
  const [ruleType, setRuleType] = useState<"supplier" | "company" | "medicine">("supplier");
  const [ruleTargetId, setRuleTargetId] = useState("");
  const [ruleTargetName, setRuleTargetName] = useState("");
  const [ruleCriticalDays, setRuleCriticalDays] = useState("60");
  const [ruleNearExpiryDays, setRuleNearExpiryDays] = useState("120");
  const [ruleNotes, setRuleNotes] = useState("");

  // Modals for batch add/edit
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<StockBatch | null>(null);

  // Form State for Add/Edit Batch
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formBatchNumber, setFormBatchNumber] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formQuantity, setFormQuantity] = useState("10");
  const [formPurchasePrice, setFormPurchasePrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load custom thresholds and granular rules from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && shopId) {
      try {
        const savedGlobal = localStorage.getItem(`pharmacy_expiry_thresholds_${shopId}`);
        if (savedGlobal) {
          const parsed = JSON.parse(savedGlobal);
          if (parsed.criticalDays && parsed.nearExpiryDays && parsed.advanceDays) {
            setThresholds(parsed);
            setTempThresholds(parsed);
          }
        }

        const savedRules = localStorage.getItem(`pharmacy_custom_expiry_rules_${shopId}`);
        if (savedRules) {
          setCustomRules(JSON.parse(savedRules));
        }
      } catch {
        // ignore fallback
      }
    }
  }, [shopId]);

  useEffect(() => {
    if (shopId) {
      fetchStockBatches();
      fetchProducts();
      fetchSuppliers();
      fetchBrands();
    }
  }, [shopId]);

  const fetchProducts = async () => {
    if (!shopId) return;
    try {
      const [prodRes, brandsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, unit, shelf_location, brand_id")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("brands")
          .select("id, name")
          .eq("shop_id", shopId)
          .order("name", { ascending: true })
      ]);
      
      const brandsMap: Record<string, string> = {};
      (brandsRes.data || []).forEach((b: any) => {
        if (b.id) brandsMap[b.id] = b.name;
      });

      const mapped = (prodRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        shelf_location: p.shelf_location,
        brand_id: p.brand_id,
        brand_name: p.brand_id ? brandsMap[p.brand_id] || null : null
      }));
      setProductList(mapped);
      setBrandList(brandsRes.data || []);
    } catch (err) {
      console.warn("fetchProducts error:", err);
    }
  };

  const fetchSuppliers = async () => {
    if (!shopId) return;
    try {
      const { data } = await supabase
        .from("parties")
        .select("id, name, phone")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      setSupplierList(data || []);
    } catch (err) {
      console.warn("fetchSuppliers error:", err);
    }
  };

  const fetchBrands = async () => {
    if (!shopId) return;
    try {
      const { data } = await supabase
        .from("brands")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      setBrandList(data || []);
    } catch (err) {
      console.warn("fetchBrands error:", err);
    }
  };

  const fetchStockBatches = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      // 1. Fetch from product_batches, purchase_orders (with items), and stock
      const [productBatchesRes, purchaseOrdersRes, stockRes] = await Promise.all([
        supabase
          .from("product_batches")
          .select(`
            id, product_id, batch_number, expiry_date, stock_quantity, purchase_price,
            products ( id, name, unit, shelf_location )
          `)
          .eq("shop_id", shopId)
          .order("expiry_date", { ascending: true }),

        supabase
          .from("purchase_orders")
          .select(`
            id, invoice_number, supplier_id, created_at, shop_id,
            parties ( id, name, phone ),
            purchase_order_items (
              id, product_id, batch_number, expiry_date, quantity, bonus_quantity, purchase_price, created_at,
              products ( id, name, unit, shelf_location )
            )
          `)
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),

        supabase
          .from("stock")
          .select(`
            id, product_id, batch_number, expiry_date, quantity_pack, quantity_single,
            products ( id, name, unit, shelf_location )
          `)
          .eq("shop_id", shopId)
          .not("batch_number", "is", null)
          .order("expiry_date", { ascending: true })
      ]);

      // Build a lookup map of PO item metadata (supplier, invoice #, etc.) keyed by `product_id::batch_number`
      const poMetadataMap: Record<string, {
        supplier_id?: string;
        supplier_name?: string;
        supplier_phone?: string;
        invoice_number?: string;
        purchase_date?: string;
      }> = {};

      const poItemsList: any[] = [];

      (purchaseOrdersRes.data || []).forEach((po: any) => {
        const party = po?.parties;
        const invNum = po.invoice_number || (po.id ? `#${po.id.slice(0, 8).toUpperCase()}` : undefined);
        const supName = party?.name || "Direct Purchase";
        const supPhone = party?.phone || "";
        const supId = po.supplier_id || party?.id;

        (po.purchase_order_items || []).forEach((p: any) => {
          if (!p.product_id || !p.batch_number) return;
          const key = `${p.product_id}::${p.batch_number.trim()}`;
          if (!poMetadataMap[key]) {
            poMetadataMap[key] = {
              supplier_id: supId,
              supplier_name: supName,
              supplier_phone: supPhone,
              invoice_number: invNum,
              purchase_date: po.created_at || p.created_at
            };
          }
          poItemsList.push({
            ...p,
            parent_po: {
              id: po.id,
              supplier_id: supId,
              supplier_name: supName,
              supplier_phone: supPhone,
              invoice_number: invNum,
              created_at: po.created_at
            }
          });
        });
      });

      const combinedMap: Record<string, StockBatch> = {};

      // Priority 1: product_batches
      (productBatchesRes.data || []).forEach((b: any) => {
        if (!b.product_id) return;
        const rawBatch = b.batch_number?.trim() || "N/A";
        const key = `${b.product_id}::${rawBatch}`;
        const meta = poMetadataMap[key] || {};

        combinedMap[key] = {
          id: b.id,
          sourceTable: "product_batches",
          product_id: b.product_id,
          batch_number: b.batch_number,
          expiry_date: b.expiry_date,
          stock_quantity: Number(b.stock_quantity) || 0,
          purchase_price: b.purchase_price,
          sale_price: b.sale_price,
          supplier_id: meta.supplier_id || null,
          supplier_name: meta.supplier_name || null,
          supplier_phone: meta.supplier_phone || null,
          invoice_number: meta.invoice_number || null,
          purchase_date: meta.purchase_date || null,
          products: b.products,
        };
      });

      // Priority 2: purchase_order_items (if not yet in product_batches)
      poItemsList.forEach((p: any) => {
        if (!p.product_id) return;
        const rawBatch = p.batch_number?.trim() || "N/A";
        const key = `${p.product_id}::${rawBatch}`;
        if (!combinedMap[key]) {
          const parent = p.parent_po;
          combinedMap[key] = {
            id: p.id,
            sourceTable: "purchase_order_items",
            product_id: p.product_id,
            batch_number: p.batch_number,
            expiry_date: p.expiry_date,
            stock_quantity: (Number(p.quantity) || 0) + (Number(p.bonus_quantity) || 0),
            purchase_price: p.purchase_price,
            supplier_id: parent?.supplier_id || null,
            supplier_name: parent?.supplier_name || "Direct Purchase",
            supplier_phone: parent?.supplier_phone || null,
            invoice_number: parent?.invoice_number || null,
            purchase_date: parent?.created_at || p.created_at,
            products: p.products,
          };
        }
      });

      // Priority 3: stock table
      (stockRes.data || []).forEach((s: any) => {
        if (!s.product_id) return;
        const rawBatch = s.batch_number?.trim() || "N/A";
        const key = `${s.product_id}::${rawBatch}`;
        if (!combinedMap[key]) {
          const meta = poMetadataMap[key] || {};
          combinedMap[key] = {
            id: s.id,
            sourceTable: "stock",
            product_id: s.product_id,
            batch_number: s.batch_number,
            expiry_date: s.expiry_date,
            stock_quantity: (Number(s.quantity_pack) || 0) + (Number(s.quantity_single) || 0),
            supplier_id: meta.supplier_id || null,
            supplier_name: meta.supplier_name || null,
            supplier_phone: meta.supplier_phone || null,
            invoice_number: meta.invoice_number || null,
            purchase_date: meta.purchase_date || null,
            products: s.products,
          };
        }
      });

      const list = Object.values(combinedMap);
      setBatches(list);
    } catch (err: any) {
      console.error("Expiry tracker error:", err);
      toast.error("Failed to load expiry logs: " + err.message);
    } finally {
      setLoading(false);
    }
  };



  const handleSaveThresholds = () => {
    if (tempThresholds.criticalDays <= 0 || tempThresholds.nearExpiryDays <= 0 || tempThresholds.advanceDays <= 0) {
      toast.error("Please enter valid positive days for all alert thresholds.");
      return;
    }
    setThresholds(tempThresholds);
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem(`pharmacy_expiry_thresholds_${shopId}`, JSON.stringify(tempThresholds));
    }
    toast.success("Global expiry alert thresholds saved! 🌐⚡");
  };

  const handleAddCustomRule = () => {
    if (!ruleTargetName.trim()) {
      toast.error("Please specify target entity (Supplier, Company, or Medicine).");
      return;
    }
    const cDays = parseInt(ruleCriticalDays, 10);
    const nDays = parseInt(ruleNearExpiryDays, 10);
    if (isNaN(cDays) || cDays <= 0 || isNaN(nDays) || nDays <= 0) {
      toast.error("Please enter valid alert days.");
      return;
    }

    const newRule: CustomExpiryRule = {
      id: "rule_" + Date.now(),
      type: ruleType,
      targetId: ruleTargetId || ruleTargetName.trim(),
      targetName: ruleTargetName.trim(),
      criticalDays: cDays,
      nearExpiryDays: nDays,
      notes: ruleNotes.trim() || undefined
    };

    const updated = [...customRules.filter(r => !(r.type === ruleType && r.targetName.toLowerCase() === ruleTargetName.toLowerCase().trim())), newRule];
    setCustomRules(updated);
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem(`pharmacy_custom_expiry_rules_${shopId}`, JSON.stringify(updated));
    }
    toast.success(`Custom rule for "${newRule.targetName}" added successfully! 🎯`);
    setRuleTargetId("");
    setRuleTargetName("");
    setRuleNotes("");
  };

  const handleDeleteCustomRule = (id: string) => {
    const updated = customRules.filter(r => r.id !== id);
    setCustomRules(updated);
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem(`pharmacy_custom_expiry_rules_${shopId}`, JSON.stringify(updated));
    }
    toast.success("Custom rule removed.");
  };

  const handleCreateBatch = async () => {
    if (!selectedProductId) {
      toast.error("Please select a medicine.");
      return;
    }
    if (!formBatchNumber.trim()) {
      toast.error("Please enter a batch number.");
      return;
    }
    if (!formExpiryDate) {
      toast.error("Please select an expiry date.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("product_batches")
        .insert({
          shop_id: shopId,
          product_id: selectedProductId,
          batch_number: formBatchNumber.trim(),
          expiry_date: formExpiryDate,
          stock_quantity: Number(formQuantity) || 0,
          purchase_price: Number(formPurchasePrice) || 0
        });

      if (error) throw error;
      toast.success("Batch successfully registered!");
      setIsAddModalOpen(false);
      setSelectedProductId("");
      setFormBatchNumber("");
      setFormExpiryDate("");
      setFormQuantity("10");
      setFormPurchasePrice("");
      fetchStockBatches();
    } catch (err: any) {
      toast.error("Failed to register batch: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBatch = async () => {
    if (!editingBatch) return;
    if (!formBatchNumber.trim()) {
      toast.error("Batch number is required.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingBatch.sourceTable === "product_batches") {
        const { error } = await supabase
          .from("product_batches")
          .update({
            batch_number: formBatchNumber.trim(),
            expiry_date: formExpiryDate || null,
            stock_quantity: Number(formQuantity) || 0
          })
          .eq("id", editingBatch.id);
        if (error) throw error;
      } else {
        // Upsert into product_batches for reliable persistence
        const { error } = await supabase
          .from("product_batches")
          .upsert({
            shop_id: shopId,
            product_id: editingBatch.product_id,
            batch_number: formBatchNumber.trim(),
            expiry_date: formExpiryDate || null,
            stock_quantity: Number(formQuantity) || 0
          });
        if (error) throw error;
      }

      toast.success("Batch details updated successfully!");
      setIsEditModalOpen(false);
      setEditingBatch(null);
      fetchStockBatches();
    } catch (err: any) {
      toast.error("Failed to update batch: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDispose = async (batch: StockBatch) => {
    const medName = getProductName(batch.products);
    if (!confirm(`Are you sure you want to quarantine/dispose batch "${batch.batch_number}" of ${medName}? This will set stock to 0.`)) return;
    try {
      if (batch.sourceTable === "product_batches") {
        const { error } = await supabase
          .from("product_batches")
          .delete()
          .eq("id", batch.id);
        if (error) throw error;
      } else if (batch.sourceTable === "stock") {
        const { error } = await supabase
          .from("stock")
          .delete()
          .eq("id", batch.id);
        if (error) throw error;
      } else {
        // Zero out stock in product_batches
        await supabase
          .from("product_batches")
          .upsert({
            shop_id: shopId,
            product_id: batch.product_id,
            batch_number: batch.batch_number,
            stock_quantity: 0,
            expiry_date: batch.expiry_date
          });
      }

      toast.success("Expired batch stock removed/disposed successfully.");
      fetchStockBatches();
    } catch (err: any) {
      toast.error("Failed to dispose batch: " + err.message);
    }
  };

  const openEditModal = (batch: StockBatch) => {
    setEditingBatch(batch);
    setFormBatchNumber(batch.batch_number || "");
    setFormExpiryDate(batch.expiry_date || "");
    setFormQuantity(String(batch.stock_quantity || 0));
    setIsEditModalOpen(true);
  };

  const getProductName = (products: any) => {
    if (!products) return "Unknown Medicine";
    if (Array.isArray(products)) {
      return products[0]?.name || "Unknown Medicine";
    }
    return products.name || "Unknown Medicine";
  };

  const getProductCompanyName = (products: any) => {
    if (!products) return null;
    const p = Array.isArray(products) ? products[0] : products;
    if (p?.brands?.name) return p.brands.name;
    return null;
  };

  const getShelfLocation = (products: any) => {
    if (!products) return null;
    if (Array.isArray(products)) {
      return products[0]?.shelf_location || null;
    }
    return products.shelf_location || null;
  };

  // Granular Expiry Evaluation Engine (Medicine -> Supplier -> Company -> Global)
  const getExpiryStatus = (expiryDateStr: string | null, batch?: StockBatch) => {
    if (!expiryDateStr) {
      return { 
        text: "No Expiry", 
        color: "text-slate-500 bg-slate-100 border-slate-200", 
        days: 9999, 
        level: "none", 
        rule: null as CustomExpiryRule | null 
      };
    }
    
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let activeCritical = thresholds.criticalDays;
    let activeNear = thresholds.nearExpiryDays;
    let activeAdvance = thresholds.advanceDays;
    let matchedRule: CustomExpiryRule | null = null;

    if (batch) {
      const medName = getProductName(batch.products).toLowerCase();
      const medId = batch.product_id;
      const supName = (batch.supplier_name || "").toLowerCase();
      const supId = batch.supplier_id;
      const brandName = (getProductCompanyName(batch.products) || "").toLowerCase();

      // 1. Check Medicine-specific rule
      const medRule = customRules.find(r => r.type === "medicine" && (r.targetId === medId || r.targetName.toLowerCase() === medName));
      if (medRule) {
        activeCritical = medRule.criticalDays;
        activeNear = medRule.nearExpiryDays;
        activeAdvance = medRule.advanceDays || activeAdvance;
        matchedRule = medRule;
      } else {
        // 2. Check Supplier-specific rule
        const supRule = customRules.find(r => r.type === "supplier" && (r.targetId === supId || r.targetName.toLowerCase() === supName));
        if (supRule) {
          activeCritical = supRule.criticalDays;
          activeNear = supRule.nearExpiryDays;
          activeAdvance = supRule.advanceDays || activeAdvance;
          matchedRule = supRule;
        } else {
          // 3. Check Company/Brand rule
          const compRule = customRules.find(r => r.type === "company" && (
            (brandName && r.targetName.toLowerCase() === brandName) || 
            medName.includes(r.targetName.toLowerCase())
          ));
          if (compRule) {
            activeCritical = compRule.criticalDays;
            activeNear = compRule.nearExpiryDays;
            activeAdvance = compRule.advanceDays || activeAdvance;
            matchedRule = compRule;
          }
        }
      }
    }

    if (diffDays < 0) {
      return { 
        text: `Expired (${Math.abs(diffDays)}d ago)`, 
        color: "bg-rose-50 border-rose-200 text-rose-700 font-black", 
        days: diffDays, 
        level: "expired", 
        rule: matchedRule 
      };
    } else if (diffDays <= activeCritical) {
      return { 
        text: `Critical (${diffDays}d)`, 
        color: "bg-orange-50 border-orange-200 text-orange-700 font-black animate-pulse", 
        days: diffDays, 
        level: "critical", 
        rule: matchedRule 
      };
    } else if (diffDays <= activeNear) {
      return { 
        text: `Near Expiry (${diffDays}d)`, 
        color: "bg-amber-50 border-amber-200 text-amber-800 font-extrabold", 
        days: diffDays, 
        level: "warning", 
        rule: matchedRule 
      };
    } else if (diffDays <= activeAdvance) {
      return { 
        text: `Advance (${diffDays}d)`, 
        color: "bg-blue-50 border-blue-200 text-blue-700 font-bold", 
        days: diffDays, 
        level: "advance", 
        rule: matchedRule 
      };
    } else {
      return { 
        text: `Safe (${diffDays}d)`, 
        color: "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold", 
        days: diffDays, 
        level: "safe", 
        rule: matchedRule 
      };
    }
  };

  // WhatsApp Alert Generator
  const sendWhatsAppSupplierAlert = (batch: StockBatch) => {
    const medName = getProductName(batch.products);
    const status = getExpiryStatus(batch.expiry_date, batch);
    const supplierName = batch.supplier_name || "Supplier";
    const phone = batch.supplier_phone ? batch.supplier_phone.replace(/[^0-9]/g, "") : "";
    
    let message = `*EXPIRY RETURN ALERT - ${shopName || "Pharmacy"}*\n\n`;
    message += `Dear ${supplierName},\n`;
    message += `The following batch purchased from your distribution is expiring/expired:\n\n`;
    message += `💊 *Medicine:* ${medName}\n`;
    message += `🏷️ *Batch #:* ${batch.batch_number || "N/A"}\n`;
    message += `📅 *Expiry Date:* ${batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : "N/A"}\n`;
    message += `📦 *Stock Quantity:* ${batch.stock_quantity} units\n`;
    if (batch.invoice_number) message += `🧾 *Invoice #:* ${batch.invoice_number}\n`;
    message += `⚠️ *Status:* ${status.text}\n`;
    if (status.rule) {
      message += `🎯 *Applicable Return Rule:* ${status.rule.type.toUpperCase()} Rule (${status.rule.targetName} - Alert at ${status.rule.nearExpiryDays}d)\n`;
    }
    message += `\nKindly arrange an expiry replacement or process return claim at your earliest convenience.\nThank you!`;

    const encoded = encodeURIComponent(message);
    const targetUrl = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(targetUrl, "_blank");
  };

  // Extract unique shelves for filter
  const allShelves = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => {
      const shelf = getShelfLocation(b.products);
      if (shelf && shelf.trim()) set.add(shelf.trim());
    });
    return Array.from(set).sort();
  }, [batches]);

  // Extract unique suppliers for filter
  const allBatchSuppliers = useMemo(() => {
    const map = new Map<string, string>();
    batches.forEach(b => {
      if (b.supplier_name && b.supplier_name.trim()) {
        map.set(b.supplier_name.trim(), b.supplier_name.trim());
      }
    });
    return Array.from(map.values()).sort();
  }, [batches]);

  // Extract unique companies/brands for filter
  const allBatchCompanies = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => {
      const c = getProductCompanyName(b.products);
      if (c && c.trim()) set.add(c.trim());
    });
    return Array.from(set).sort();
  }, [batches]);

  // Filter and Sort Engine
  const filteredAndSortedBatches = useMemo(() => {
    let list = batches.filter(b => {
      const pName = getProductName(b.products);
      const bNumber = b.batch_number || "";
      const shelf = getShelfLocation(b.products) || "";
      const supplier = b.supplier_name || "";
      const company = getProductCompanyName(b.products) || "";
      const invoice = b.invoice_number || "";

      // Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        pName.toLowerCase().includes(q) || 
        bNumber.toLowerCase().includes(q) || 
        shelf.toLowerCase().includes(q) || 
        supplier.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q) ||
        invoice.toLowerCase().includes(q);
        
      if (!matchesSearch) return false;

      // Supplier Filter
      if (selectedSupplierFilter !== "all") {
        if ((b.supplier_name || "Direct Purchase") !== selectedSupplierFilter) return false;
      }

      // Company Filter
      if (selectedCompanyFilter !== "all") {
        if ((company || "Other") !== selectedCompanyFilter) return false;
      }

      // Shelf Filter
      if (selectedShelfFilter !== "all") {
        if (shelf !== selectedShelfFilter) return false;
      }

      // Stock Status Filter
      if (stockStatusFilter === "in_stock" && b.stock_quantity <= 0) return false;
      if (stockStatusFilter === "zero_stock" && b.stock_quantity > 0) return false;

      // Expiry Filter Tab with Granular Rules
      const status = getExpiryStatus(b.expiry_date, b);

      if (expiryFilter === "all") return true;
      if (expiryFilter === "custom_rules") return !!status.rule;
      if (expiryFilter === "expired") return status.level === "expired";
      if (expiryFilter === "critical") return status.level === "critical";
      if (expiryFilter === "near") return status.level === "warning";
      if (expiryFilter === "advance") return status.level === "advance";
      if (expiryFilter === "safe") return status.level === "safe";

      return true;
    });

    // Multi-column sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === "expiry_date" || sortColumn === "days") {
        const timeA = a.expiry_date ? new Date(a.expiry_date).getTime() : 9999999999999;
        const timeB = b.expiry_date ? new Date(b.expiry_date).getTime() : 9999999999999;
        comparison = timeA - timeB;
      } else if (sortColumn === "name") {
        const nameA = getProductName(a.products).toLowerCase();
        const nameB = getProductName(b.products).toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortColumn === "batch_number") {
        const bA = (a.batch_number || "").toLowerCase();
        const bB = (b.batch_number || "").toLowerCase();
        comparison = bA.localeCompare(bB);
      } else if (sortColumn === "stock") {
        comparison = a.stock_quantity - b.stock_quantity;
      } else if (sortColumn === "supplier") {
        const sA = (a.supplier_name || "").toLowerCase();
        const sB = (b.supplier_name || "").toLowerCase();
        comparison = sA.localeCompare(sB);
      } else if (sortColumn === "company") {
        const cA = (getProductCompanyName(a.products) || "").toLowerCase();
        const cB = (getProductCompanyName(b.products) || "").toLowerCase();
        comparison = cA.localeCompare(cB);
      } else if (sortColumn === "invoice") {
        const iA = (a.invoice_number || "").toLowerCase();
        const iB = (b.invoice_number || "").toLowerCase();
        comparison = iA.localeCompare(iB);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [
    batches, searchQuery, expiryFilter, selectedSupplierFilter, selectedCompanyFilter,
    selectedShelfFilter, stockStatusFilter, sortColumn, sortDirection, thresholds, customRules
  ]);

  // Dynamic Statistics
  const stats = useMemo(() => {
    let expired = 0;
    let critical = 0;
    let near = 0;
    let safe = 0;
    let customRuleCount = 0;

    batches.forEach(b => {
      const status = getExpiryStatus(b.expiry_date, b);
      if (status.rule) customRuleCount++;
      if (status.level === "expired") expired++;
      else if (status.level === "critical") critical++;
      else if (status.level === "warning") near++;
      else safe++;
    });

    return { expired, critical, near, safe, customRuleCount };
  }, [batches, thresholds, customRules]);

  // Pagination calculation
  const totalItems = filteredAndSortedBatches.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);

  const paginatedBatches = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedBatches;
    const start = (effectivePage - 1) * pageSize;
    return filteredAndSortedBatches.slice(start, start + pageSize);
  }, [filteredAndSortedBatches, effectivePage, pageSize]);

  const handleSort = (col: typeof sortColumn) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Export / Print Table
  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const rowsHtml = filteredAndSortedBatches.map((item, idx) => {
      const status = getExpiryStatus(item.expiry_date, item);
      const shelf = getShelfLocation(item.products);
      const company = getProductCompanyName(item.products);
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px 8px; font-weight: bold;">${getProductName(item.products)}</td>
          <td style="padding: 6px 8px;">${company || "—"}</td>
          <td style="padding: 6px 8px;">${shelf || "—"}</td>
          <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">${item.batch_number || "—"}</td>
          <td style="padding: 6px 8px;">${item.supplier_name || "Direct Purchase"}</td>
          <td style="padding: 6px 8px; font-family: monospace;">${item.invoice_number || "—"}</td>
          <td style="padding: 6px 8px;">${item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "No Expiry"}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${item.stock_quantity}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${status.text}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pharmacy Medicine Expiry Report - ${shopName || "The Accounts"}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            h1 { font-size: 18px; margin: 0 0 4px 0; }
            p { font-size: 12px; color: #64748b; margin: 0 0 16px 0; }
            table { width: 100%; border-collapse: collapse; text-align: left; }
            th { background-color: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; padding: 8px; border-bottom: 2px solid #cbd5e1; }
            @media print {
              body { padding: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <h1>🏥 ${shopName || "Pharmacy"} — Medicine Expiry & Batch Report</h1>
          <p>Generated on ${new Date().toLocaleString()} | Total Filtered Batches: ${filteredAndSortedBatches.length}</p>
          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>Medicine Name</th>
                <th>Company / Brand</th>
                <th>Shelf</th>
                <th>Batch #</th>
                <th>Supplier / Distributor</th>
                <th>Invoice / Bill #</th>
                <th>Expiry Date</th>
                <th style="text-align: center;">Stock</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ["Index", "Medicine Name", "Company / Brand", "Shelf Location", "Batch Number", "Supplier Name", "Supplier Phone", "Invoice Number", "Expiry Date", "Stock Quantity", "Status", "Days Remaining", "Custom Rule Applied"];
    const rows = filteredAndSortedBatches.map((b, idx) => {
      const status = getExpiryStatus(b.expiry_date, b);
      return [
        idx + 1,
        `"${getProductName(b.products).replace(/"/g, '""')}"`,
        `"${(getProductCompanyName(b.products) || "").replace(/"/g, '""')}"`,
        `"${(getShelfLocation(b.products) || "").replace(/"/g, '""')}"`,
        `"${(b.batch_number || "").replace(/"/g, '""')}"`,
        `"${(b.supplier_name || "Direct Purchase").replace(/"/g, '""')}"`,
        `"${(b.supplier_phone || "").replace(/"/g, '""')}"`,
        `"${(b.invoice_number || "").replace(/"/g, '""')}"`,
        b.expiry_date || "",
        b.stock_quantity,
        `"${status.text.replace(/"/g, '""')}"`,
        status.days,
        status.rule ? `"${status.rule.type.toUpperCase()}: ${status.rule.targetName} (${status.rule.nearExpiryDays}d)"` : '""'
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `medicine_expiry_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Expiry CSV report downloaded! 📊");
  };

  // Grouped custom rules for tab display
  const supplierRules = customRules.filter(r => r.type === "supplier");
  const companyRules = customRules.filter(r => r.type === "company");
  const medicineRules = customRules.filter(r => r.type === "medicine");

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <span className="text-2xl">💊</span> Medicine Expiry & Batch Tracker
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time batch tracing, company/supplier/medicine custom alert policies, and DLD compliance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Custom Rules & Settings Button */}
          <Button
            onClick={() => {
              setTempThresholds(thresholds);
              setIsThresholdModalOpen(true);
            }}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50 text-slate-800 font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 h-10 px-3 bg-white cursor-pointer ring-1 ring-slate-100"
            title="Configure Granular Expiry Alert Rules (Company, Supplier, Medicine)"
          >
            <Settings2 size={15} className="text-indigo-600" />
            <span>Alert Policies ({customRules.length})</span>
          </Button>

          {/* Claims Navigation Button */}
          <Link href="/dashboard/pharmacy/claims">
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 h-10 px-3.5 cursor-pointer"
            >
              <Truck size={15} /> Expiry Return Claims
            </Button>
          </Link>

          {/* Add Batch Button */}
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 h-10 px-3.5 cursor-pointer"
          >
            <Plus size={16} /> Add / Register Batch
          </Button>

          {/* Refresh Button */}
          <Button 
            onClick={fetchStockBatches} 
            variant="outline" 
            className="border-slate-200 rounded-xl h-10 px-3 bg-white cursor-pointer"
            title="Refresh Batches"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-600'}`} />
          </Button>
        </div>
      </div>

      {/* Expiry Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Expired */}
        <div 
          onClick={() => setExpiryFilter("expired")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            expiryFilter === "expired" ? "bg-red-50/80 border-red-300 ring-2 ring-red-400" : "bg-white border-red-200 hover:bg-red-50/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Expired Medicines</span>
            <div className="h-7 w-7 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <AlertTriangle size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-red-600 mt-1">{stats.expired} Batches</p>
          <p className="text-[10px] text-red-500 font-bold mt-0.5">Immediate return / quarantine</p>
        </div>

        {/* Critical Alert */}
        <div 
          onClick={() => setExpiryFilter("critical")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            expiryFilter === "critical" ? "bg-orange-50/80 border-orange-300 ring-2 ring-orange-400" : "bg-white border-orange-200 hover:bg-orange-50/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Critical Alerts</span>
            <div className="h-7 w-7 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
              <ShieldAlert size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-orange-600 mt-1">{stats.critical} Batches</p>
          <p className="text-[10px] text-orange-500 font-bold mt-0.5">Policy return deadline close</p>
        </div>

        {/* Near Expiry */}
        <div 
          onClick={() => setExpiryFilter("near")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            expiryFilter === "near" ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-400" : "bg-white border-amber-200 hover:bg-amber-50/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Near Expiry</span>
            <div className="h-7 w-7 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
              <Calendar size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-amber-700 mt-1">{stats.near} Batches</p>
          <p className="text-[10px] text-amber-600 font-bold mt-0.5">Prioritize FEFO dispensing</p>
        </div>

        {/* Total Active Batches */}
        <div 
          onClick={() => setExpiryFilter("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
            expiryFilter === "all" ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400" : "bg-white border-emerald-200 hover:bg-emerald-50/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Active Batches</span>
            <div className="h-7 w-7 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
              <CheckCircle size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-700 mt-1">{batches.length} Batches</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{stats.safe} Safe batches in stock</p>
        </div>
      </div>

      {/* Action and Filter Hub */}
      <div className="bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        {/* Row 1: Expiry Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/70">
            {[
              { key: "all", label: `All Batches (${batches.length})` },
              { key: "expired", label: `🔴 Expired (${stats.expired})` },
              { key: "critical", label: `🟠 Critical (${stats.critical})` },
              { key: "near", label: `🟡 Warning (${stats.near})` },
              { key: "custom_rules", label: `⚡ Custom Policy Batches (${stats.customRuleCount})` },
              { key: "advance", label: `🔵 Advance Notice` },
              { key: "safe", label: `🟢 Safe (${stats.safe})` }
            ].map(pill => (
              <button
                key={pill.key}
                onClick={() => { setExpiryFilter(pill.key); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  expiryFilter === pill.key
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Print & Export Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              onClick={handlePrintReport}
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-bold text-slate-700 border-slate-200 bg-white hover:bg-slate-50 rounded-lg cursor-pointer"
              title="Print Expiry Inspection Report"
            >
              <Printer size={13} className="mr-1 text-slate-500" /> Print Report
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-bold text-slate-700 border-slate-200 bg-white hover:bg-slate-50 rounded-lg cursor-pointer"
              title="Download CSV for Excel"
            >
              <Download size={13} className="mr-1 text-emerald-600" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Row 2: Search and Specific Attribute Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-center">
          {/* Search Box */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              placeholder="Search medicine, batch, company..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-8 h-9 bg-slate-50 border-slate-200 rounded-xl text-xs font-bold"
            />
          </div>

          {/* Company / Brand Filter */}
          <div>
            <select
              value={selectedCompanyFilter}
              onChange={(e) => { setSelectedCompanyFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">🏭 All Pharma Brands / Companies</option>
              {allBatchCompanies.map(comp => (
                <option key={comp} value={comp}>{comp}</option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div>
            <select
              value={selectedSupplierFilter}
              onChange={(e) => { setSelectedSupplierFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">🏢 All Suppliers / Distributors</option>
              {allBatchSuppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>

          {/* Shelf Location Filter */}
          <div>
            <select
              value={selectedShelfFilter}
              onChange={(e) => { setSelectedShelfFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">📍 All Shelf / Racks</option>
              {allShelves.map(sh => (
                <option key={sh} value={sh}>Shelf: {sh}</option>
              ))}
            </select>
          </div>

          {/* Stock Status Filter & Rows per page */}
          <div className="flex items-center gap-2">
            <select
              value={stockStatusFilter}
              onChange={(e) => { setStockStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl px-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="in_stock">📦 In Stock (&gt; 0)</option>
              <option value="all">📦 All Batches</option>
              <option value="zero_stock">📦 Zero / Depleted</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="w-24 h-9 bg-slate-50 border border-slate-200 rounded-xl px-2 text-xs font-black text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              title="Rows per page"
            >
              <option value={10}>10 / pg</option>
              <option value={25}>25 / pg</option>
              <option value={50}>50 / pg</option>
              <option value={100}>100 / pg</option>
              <option value={-1}>All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[1050px]">
            <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[10px] select-none">
              <tr>
                {/* Medicine */}
                <th 
                  onClick={() => handleSort("name")}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Medicine & Shelf</span>
                    {sortColumn === "name" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* Company / Brand */}
                <th 
                  onClick={() => handleSort("company")}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Company / Brand</span>
                    {sortColumn === "company" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* Batch Number */}
                <th 
                  onClick={() => handleSort("batch_number")}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Batch Number</span>
                    {sortColumn === "batch_number" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* Supplier & Invoice */}
                <th 
                  onClick={() => handleSort("supplier")}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Supplier / Invoice</span>
                    {sortColumn === "supplier" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* Expiry Date */}
                <th 
                  onClick={() => handleSort("expiry_date")}
                  className="px-3 py-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Expiry Date</span>
                    {sortColumn === "expiry_date" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* Available Stock */}
                <th 
                  onClick={() => handleSort("stock")}
                  className="px-3 py-3 text-center cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Available Stock</span>
                    {sortColumn === "stock" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* Status / Policy */}
                <th 
                  onClick={() => handleSort("days")}
                  className="px-3 py-3 text-center cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status & Return Policy</span>
                    {sortColumn === "days" ? (
                      sortDirection === "asc" ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                    ) : <ArrowUpDown size={11} className="text-slate-400" />}
                  </div>
                </th>

                {/* Actions */}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Loader2 className="h-7 w-7 animate-spin mx-auto text-emerald-600 mb-2" />
                    Loading all pharmacy batches and purchase records...
                  </td>
                </tr>
              ) : paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Pill className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    No medicine batches found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((item) => {
                  const status = getExpiryStatus(item.expiry_date, item);
                  const isExpired = status.level === "expired";
                  const isCritical = status.level === "critical";
                  const shelf = getShelfLocation(item.products);
                  const company = getProductCompanyName(item.products);
                  const medName = getProductName(item.products);

                  return (
                    <tr 
                      key={`${item.product_id}_${item.batch_number}_${item.id}`} 
                      className={`hover:bg-slate-50/90 transition-colors ${
                        isExpired ? 'bg-rose-50/25' : isCritical ? 'bg-orange-50/20' : ''
                      }`}
                    >
                      {/* Medicine & Shelf */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <div className={`p-1 rounded-lg mt-0.5 ${isExpired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            <Pill size={14} />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-[13px] leading-snug">{medName}</p>
                            {shelf && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 border border-amber-200 mt-0.5">
                                <MapPin size={8} /> Shelf: {shelf}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Company / Brand */}
                      <td className="px-3 py-2.5">
                        {company ? (
                          <span className="inline-flex items-center gap-1 font-extrabold text-indigo-900 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                            <Factory size={10} className="text-indigo-600 shrink-0" />
                            <span className="truncate max-w-[120px]" title={company}>{company}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">General Pharma</span>
                        )}
                      </td>

                      {/* Batch Number */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                          {item.batch_number || "—"}
                        </span>
                      </td>

                      {/* Supplier & Invoice */}
                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-slate-800 text-[11px]">
                            <Building2 size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[130px]" title={item.supplier_name || "Direct Purchase"}>
                              {item.supplier_name || "Direct Purchase"}
                            </span>
                          </div>
                          {item.invoice_number && (
                            <div className="flex items-center gap-1 font-mono text-[9.5px] text-slate-500">
                              <Receipt size={10} className="text-slate-400 shrink-0" />
                              <span>{item.invoice_number}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Expiry Date */}
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-700">
                        {item.expiry_date ? (
                          <div className="flex items-center gap-1.5">
                            <Clock size={11} className="text-slate-400" />
                            <span>{new Date(item.expiry_date).toLocaleDateString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric'
                            })}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">No Expiry</span>
                        )}
                      </td>

                      {/* Available Stock */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-mono font-black px-2 py-0.5 rounded-lg border text-[11px] ${
                          item.stock_quantity > 0 
                            ? 'bg-slate-50 text-slate-800 border-slate-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {item.stock_quantity} units
                        </span>
                      </td>

                      {/* Status & Custom Rule Badge */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${status.color}`}>
                            {status.text}
                          </span>
                          {status.rule && (
                            <span 
                              className="inline-flex items-center gap-0.5 text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-tighter"
                              title={`Applied ${status.rule.type.toUpperCase()} Policy: Alert at ${status.rule.nearExpiryDays} days${status.rule.notes ? ` (${status.rule.notes})` : ''}`}
                            >
                              <Sparkles size={8} className="text-indigo-500" /> {status.rule.type}: {status.rule.targetName} ({status.rule.nearExpiryDays}d)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* WhatsApp Alert to Supplier */}
                          <button
                            onClick={() => sendWhatsAppSupplierAlert(item)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer transition-colors"
                            title="Send WhatsApp Expiry Alert to Supplier"
                          >
                            <MessageSquare size={13} />
                          </button>

                          {/* 1-Click Return Claim */}
                          <Link href={`/dashboard/pharmacy/claims`}>
                            <button
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition-colors"
                              title="Create Return Claim for this Batch"
                            >
                              <Truck size={13} />
                            </button>
                          </Link>

                          {/* Edit Batch */}
                          <button 
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer transition-colors"
                            title="Edit Batch Expiry / Stock"
                          >
                            <Edit3 size={13} />
                          </button>

                          {/* Dispose / Quarantine */}
                          {isExpired && (
                            <button 
                              onClick={() => handleDispose(item)}
                              className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 cursor-pointer transition-colors"
                              title="Dispose / Zero-out Expired Stock"
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalItems > 0 && pageSize !== -1 && (
          <div className="bg-slate-50/80 border-t border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="text-slate-500 font-bold">
              Showing <span className="text-slate-800 font-black">{(effectivePage - 1) * pageSize + 1}</span> to{" "}
              <span className="text-slate-800 font-black">{Math.min(effectivePage * pageSize, totalItems)}</span> of{" "}
              <span className="text-slate-800 font-black">{totalItems}</span> batches
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={effectivePage <= 1}
                className="h-7 w-7 p-0 rounded-lg border-slate-200 bg-white"
                title="First Page"
              >
                <ChevronsLeft size={13} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={effectivePage <= 1}
                className="h-7 px-2 rounded-lg border-slate-200 bg-white text-xs font-bold"
              >
                <ChevronLeft size={13} className="mr-0.5" /> Prev
              </Button>

              <span className="px-2.5 text-xs font-black text-slate-700">
                Page {effectivePage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={effectivePage >= totalPages}
                className="h-7 px-2 rounded-lg border-slate-200 bg-white text-xs font-bold"
              >
                Next <ChevronRight size={13} className="ml-0.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={effectivePage >= totalPages}
                className="h-7 w-7 p-0 rounded-lg border-slate-200 bg-white"
                title="Last Page"
              >
                <ChevronsRight size={13} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Granular Alert Settings Modal (Global, Supplier, Company, Medicine) */}
      <AnimatePresence>
        {isThresholdModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                <div>
                  <h3 className="font-black text-slate-900 flex items-center gap-2 text-sm">
                    <Settings2 className="text-indigo-600" size={18} />
                    Custom Expiry Alert Policies
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Configure company-specific, distributor-specific, or medicine-specific expiry return notice periods.
                  </p>
                </div>
                <button onClick={() => setIsThresholdModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 pt-2 gap-1">
                {[
                  { id: "global", label: "🌐 Global Defaults", count: null },
                  { id: "supplier", label: "🏢 Supplier Wise", count: supplierRules.length },
                  { id: "company", label: "🏭 Company / Brand", count: companyRules.length },
                  { id: "medicine", label: "💊 Medicine Wise", count: medicineRules.length }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveSettingsTab(t.id as any)}
                    className={`px-3 py-2 text-xs font-black rounded-t-xl transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                      activeSettingsTab === t.id
                        ? "border-indigo-600 text-indigo-700 bg-white shadow-2xs"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span>{t.label}</span>
                    {t.count !== null && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                        activeSettingsTab === t.id ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-600"
                      }`}>
                        {t.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                
                {/* Tab 1: Global Defaults */}
                {activeSettingsTab === "global" && (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
                      <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      <span>
                        Global default alert thresholds are used for all batches that don't have a specific Company, Supplier, or Medicine custom rule.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-black text-orange-700 flex items-center gap-1 mb-1">
                          <ShieldAlert size={13} /> Critical Alert (Days)
                        </label>
                        <Input 
                          type="number"
                          min="1"
                          value={tempThresholds.criticalDays} 
                          onChange={(e) => setTempThresholds({ ...tempThresholds, criticalDays: Number(e.target.value) || 1 })}
                          className="h-10 rounded-xl text-xs font-black border-orange-200 bg-orange-50/30"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Default: 30 days</p>
                      </div>

                      <div>
                        <label className="text-xs font-black text-amber-800 flex items-center gap-1 mb-1">
                          <Calendar size={13} /> Warning / Near Expiry (Days)
                        </label>
                        <Input 
                          type="number"
                          min="1"
                          value={tempThresholds.nearExpiryDays} 
                          onChange={(e) => setTempThresholds({ ...tempThresholds, nearExpiryDays: Number(e.target.value) || 1 })}
                          className="h-10 rounded-xl text-xs font-black border-amber-200 bg-amber-50/30"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Default: 90 days</p>
                      </div>

                      <div>
                        <label className="text-xs font-black text-blue-700 flex items-center gap-1 mb-1">
                          <Sparkles size={13} /> Advance Planning (Days)
                        </label>
                        <Input 
                          type="number"
                          min="1"
                          value={tempThresholds.advanceDays} 
                          onChange={(e) => setTempThresholds({ ...tempThresholds, advanceDays: Number(e.target.value) || 1 })}
                          className="h-10 rounded-xl text-xs font-black border-blue-200 bg-blue-50/30"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Default: 180 days</p>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        onClick={handleSaveThresholds}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                      >
                        <Save size={14} className="mr-1.5" /> Save Global Defaults
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Supplier Rules */}
                {activeSettingsTab === "supplier" && (
                  <div className="space-y-4">
                    {/* Add Supplier Rule Form */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Plus size={14} className="text-indigo-600" /> Add Distributor / Supplier Expiry Policy
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Select Supplier *</label>
                          <select
                            value={ruleTargetId}
                            onChange={(e) => {
                              const sel = supplierList.find(s => s.id === e.target.value);
                              setRuleTargetId(e.target.value);
                              setRuleTargetName(sel?.name || "");
                              setRuleType("supplier");
                            }}
                            className="w-full h-9 bg-white border border-slate-200 rounded-xl px-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="">-- Choose Supplier --</option>
                            {supplierList.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Warning Alert (Days) *</label>
                          <Input 
                            type="number"
                            placeholder="e.g. 120"
                            value={ruleNearExpiryDays}
                            onChange={(e) => setRuleNearExpiryDays(e.target.value)}
                            className="h-9 rounded-xl text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Critical Return (Days) *</label>
                          <Input 
                            type="number"
                            placeholder="e.g. 60"
                            value={ruleCriticalDays}
                            onChange={(e) => setRuleCriticalDays(e.target.value)}
                            className="h-9 rounded-xl text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input 
                          placeholder="Notes (e.g. Supplier requires 4 months notice for claim)"
                          value={ruleNotes}
                          onChange={(e) => setRuleNotes(e.target.value)}
                          className="h-9 rounded-xl text-xs bg-white"
                        />
                        <Button
                          onClick={() => {
                            setRuleType("supplier");
                            handleAddCustomRule();
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0 cursor-pointer"
                        >
                          Add Policy
                        </Button>
                      </div>
                    </div>

                    {/* Existing Supplier Rules List */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Configured Supplier Return Policies ({supplierRules.length})
                      </span>
                      {supplierRules.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          No custom supplier policies set yet. All suppliers follow global defaults.
                        </div>
                      ) : (
                        supplierRules.map(rule => (
                          <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50/60 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-xs">{rule.targetName}</span>
                                <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Warning: {rule.nearExpiryDays}d | Critical: {rule.criticalDays}d
                                </span>
                              </div>
                              {rule.notes && <p className="text-[10px] text-slate-500">{rule.notes}</p>}
                            </div>
                            <button
                              onClick={() => handleDeleteCustomRule(rule.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 3: Company / Brand Rules */}
                {activeSettingsTab === "company" && (
                  <div className="space-y-4">
                    {/* Add Company Rule Form */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Plus size={14} className="text-indigo-600" /> Add Pharma Company / Manufacturer Return Policy
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Company / Brand Name *</label>
                          <select
                            value={ruleTargetName}
                            onChange={(e) => {
                              setRuleTargetName(e.target.value);
                              setRuleTargetId(e.target.value);
                              setRuleType("company");
                            }}
                            className="w-full h-9 bg-white border border-slate-200 rounded-xl px-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="">-- Choose Company / Brand --</option>
                            {brandList.map(b => (
                              <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                            {allBatchCompanies.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Warning Alert (Days) *</label>
                          <Input 
                            type="number"
                            placeholder="e.g. 180 (6 months)"
                            value={ruleNearExpiryDays}
                            onChange={(e) => setRuleNearExpiryDays(e.target.value)}
                            className="h-9 rounded-xl text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Critical Return (Days) *</label>
                          <Input 
                            type="number"
                            placeholder="e.g. 90 (3 months)"
                            value={ruleCriticalDays}
                            onChange={(e) => setRuleCriticalDays(e.target.value)}
                            className="h-9 rounded-xl text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input 
                          placeholder="Notes (e.g. Multinational brand requires 6-month claim lead time)"
                          value={ruleNotes}
                          onChange={(e) => setRuleNotes(e.target.value)}
                          className="h-9 rounded-xl text-xs bg-white"
                        />
                        <Button
                          onClick={() => {
                            setRuleType("company");
                            handleAddCustomRule();
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0 cursor-pointer"
                        >
                          Add Policy
                        </Button>
                      </div>
                    </div>

                    {/* Existing Company Rules List */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Configured Company Policies ({companyRules.length})
                      </span>
                      {companyRules.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          No company-specific return policies set. All pharma brands follow global defaults.
                        </div>
                      ) : (
                        companyRules.map(rule => (
                          <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50/60 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-indigo-950 text-xs">{rule.targetName}</span>
                                <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Warning: {rule.nearExpiryDays}d | Critical: {rule.criticalDays}d
                                </span>
                              </div>
                              {rule.notes && <p className="text-[10px] text-slate-500">{rule.notes}</p>}
                            </div>
                            <button
                              onClick={() => handleDeleteCustomRule(rule.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: Medicine-Specific Rules */}
                {activeSettingsTab === "medicine" && (
                  <div className="space-y-4">
                    {/* Add Medicine Rule Form */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Plus size={14} className="text-indigo-600" /> Add Medicine-Specific Expiry Return Policy
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Select Medicine *</label>
                          <select
                            value={ruleTargetId}
                            onChange={(e) => {
                              const sel = productList.find(p => p.id === e.target.value);
                              setRuleTargetId(e.target.value);
                              setRuleTargetName(sel?.name || "");
                              setRuleType("medicine");
                            }}
                            className="w-full h-9 bg-white border border-slate-200 rounded-xl px-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="">-- Choose Medicine --</option>
                            {productList.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Warning Alert (Days) *</label>
                          <Input 
                            type="number"
                            placeholder="e.g. 150"
                            value={ruleNearExpiryDays}
                            onChange={(e) => setRuleNearExpiryDays(e.target.value)}
                            className="h-9 rounded-xl text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">Critical Return (Days) *</label>
                          <Input 
                            type="number"
                            placeholder="e.g. 75"
                            value={ruleCriticalDays}
                            onChange={(e) => setRuleCriticalDays(e.target.value)}
                            className="h-9 rounded-xl text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input 
                          placeholder="Notes (e.g. High-value biological item / short shelf-life)"
                          value={ruleNotes}
                          onChange={(e) => setRuleNotes(e.target.value)}
                          className="h-9 rounded-xl text-xs bg-white"
                        />
                        <Button
                          onClick={() => {
                            setRuleType("medicine");
                            handleAddCustomRule();
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl shrink-0 cursor-pointer"
                        >
                          Add Policy
                        </Button>
                      </div>
                    </div>

                    {/* Existing Medicine Rules List */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Configured Medicine Policies ({medicineRules.length})
                      </span>
                      {medicineRules.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          No medicine-specific rules set yet.
                        </div>
                      ) : (
                        medicineRules.map(rule => (
                          <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-2xs hover:bg-slate-50/60 transition-colors">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-xs">{rule.targetName}</span>
                                <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Warning: {rule.nearExpiryDays}d | Critical: {rule.criticalDays}d
                                </span>
                              </div>
                              {rule.notes && <p className="text-[10px] text-slate-500">{rule.notes}</p>}
                            </div>
                            <button
                              onClick={() => handleDeleteCustomRule(rule.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                <Button 
                  onClick={() => setIsThresholdModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add New Batch Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                <h3 className="font-black text-slate-900 flex items-center gap-2 text-sm">
                  <Plus className="text-emerald-600" size={18} />
                  Register New Medicine Batch
                </h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">Select Medicine *</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="">-- Choose Medicine --</option>
                    {productList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.shelf_location ? `(Shelf: ${p.shelf_location})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">Batch Number *</label>
                    <Input 
                      placeholder="e.g. BT-902" 
                      value={formBatchNumber} 
                      onChange={(e) => setFormBatchNumber(e.target.value)}
                      className="h-10 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">Expiry Date *</label>
                    <Input 
                      type="date" 
                      value={formExpiryDate} 
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="h-10 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">Stock Quantity (Units)</label>
                    <Input 
                      type="number"
                      min="0"
                      value={formQuantity} 
                      onChange={(e) => setFormQuantity(e.target.value)}
                      className="h-10 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">Purchase Price (Optional)</label>
                    <Input 
                      type="number"
                      placeholder="0.00"
                      value={formPurchasePrice} 
                      onChange={(e) => setFormPurchasePrice(e.target.value)}
                      className="h-10 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleCreateBatch}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
                  Save Batch
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Batch Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingBatch && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                <div>
                  <h3 className="font-black text-slate-900 flex items-center gap-2 text-sm">
                    <Edit3 className="text-emerald-600" size={16} />
                    Edit Batch Information
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{getProductName(editingBatch.products)}</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">Batch Number *</label>
                    <Input 
                      value={formBatchNumber} 
                      onChange={(e) => setFormBatchNumber(e.target.value)}
                      className="h-10 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-700 block mb-1">Expiry Date</label>
                    <Input 
                      type="date" 
                      value={formExpiryDate} 
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="h-10 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">Stock Quantity (Units)</label>
                  <Input 
                    type="number"
                    min="0"
                    value={formQuantity} 
                    onChange={(e) => setFormQuantity(e.target.value)}
                    className="h-10 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleUpdateBatch}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
                  Update Batch
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
