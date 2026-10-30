"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Plus, Search, Trash2, ArrowRight, Loader2, ArrowUpRight, ArrowDownLeft, Sparkles, Layers, Calendar, AlertTriangle } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface DBProduct {
  id: string;
  name: string;
  unit: string | null;
  current_stock: number;
  sale_price_single?: number;
  purchase_price_single?: number;
}

interface Party {
  id: string;
  name: string;
  type: string; // 'customer' | 'supplier'
}

interface ProductBatch {
  id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string | null;
  stock_quantity: number;
  sale_price?: number;
  purchase_price?: number;
}

interface ReturnCartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  maxQty: number; // original quantity
  batchNumber?: string | null;
  expiryDate?: string | null;
  batchId?: string | null;
}

export default function ReturnsPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"sale" | "purchase" | "adjust">("sale");
  const [loading, setLoading] = useState(false);

  // Core lists
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [productBatches, setProductBatches] = useState<Record<string, ProductBatch[]>>({});

  // Selection states
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [pastDocuments, setPastDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");

  // Mode and inputs for Open Return / Invoice Search
  const [returnMode, setReturnMode] = useState<"invoice" | "open">("invoice");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [isSearchingInvoice, setIsSearchingInvoice] = useState(false);
  const [openReturnProductId, setOpenReturnProductId] = useState("");
  const [openReturnQty, setOpenReturnQty] = useState(1);
  const [openReturnPrice, setOpenReturnPrice] = useState(0);

  // Batch fields for Open Return
  const [openReturnBatchNumber, setOpenReturnBatchNumber] = useState("");
  const [openReturnExpiryDate, setOpenReturnExpiryDate] = useState("");
  const [isCustomBatchOpenReturn, setIsCustomBatchOpenReturn] = useState(false);

  // Return items cart
  const [returnItems, setReturnItems] = useState<ReturnCartItem[]>([]);
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Stock Adjustment Form
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustBatchNumber, setAdjustBatchNumber] = useState("");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState<"damaged" | "expired" | "stolen">("damaged");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    loadBaseData();
  }, [shopId]);

  // Load past documents when party selection changes
  useEffect(() => {
    if (!selectedPartyId || !shopId) {
      setPastDocuments([]);
      setReturnItems([]);
      return;
    }
    loadPastDocuments();
  }, [selectedPartyId, activeTab]);

  // Load items when document changes
  useEffect(() => {
    if (!selectedDocId) {
      setReturnItems([]);
      return;
    }
    const doc = pastDocuments.find(d => d.id === selectedDocId);
    if (doc) {
      const items: ReturnCartItem[] = activeTab === "sale" 
        ? doc.invoice_items.map((i: any) => ({
            productId: i.product_id,
            productName: i.productName || "Product",
            quantity: 0,
            price: Number(i.unit_price),
            maxQty: Number(i.quantity),
            batchNumber: i.batch_number || null,
            expiryDate: i.expiry_date || null,
            batchId: i.batch_id || null,
          }))
        : doc.purchase_order_items.map((i: any) => ({
            productId: i.product_id,
            productName: i.productName || "Product",
            quantity: 0,
            price: Number(i.unit_price),
            maxQty: Number(i.quantity),
            batchNumber: i.batch_number || null,
            expiryDate: i.expiry_date || null,
          }));
      setReturnItems(items);
    }
  }, [selectedDocId]);

  // Reset states on tab/mode change
  useEffect(() => {
    setSelectedPartyId("");
    setSelectedDocId("");
    setReturnItems([]);
    setReturnNotes("");
    setReturnMode("invoice");
    setInvoiceSearchQuery("");
    setOpenReturnProductId("");
    setOpenReturnQty(1);
    setOpenReturnPrice(0);
    setOpenReturnBatchNumber("");
    setOpenReturnExpiryDate("");
    setIsCustomBatchOpenReturn(false);
    setAdjustProductId("");
    setAdjustBatchNumber("");
  }, [activeTab]);

  // Update open return batch defaults when product changes
  useEffect(() => {
    if (!openReturnProductId) {
      setOpenReturnBatchNumber("");
      setOpenReturnExpiryDate("");
      setIsCustomBatchOpenReturn(false);
      return;
    }
    const batches = productBatches[openReturnProductId] || [];
    if (batches.length > 0) {
      setOpenReturnBatchNumber(batches[0].batch_number);
      setOpenReturnExpiryDate(batches[0].expiry_date || "");
      setIsCustomBatchOpenReturn(false);
    } else {
      setOpenReturnBatchNumber("");
      setOpenReturnExpiryDate("");
      setIsCustomBatchOpenReturn(true);
    }
  }, [openReturnProductId, productBatches]);

  async function loadBaseData() {
    if (!shopId) return;
    try {
      const [{ data: pts }, { data: prds }, { data: bData }] = await Promise.all([
        supabase.from("parties").select("id,name,type").eq("shop_id", shopId).order("name"),
        supabase.from("products").select("id,name,unit,current_stock,sale_price_single,purchase_price_single").eq("shop_id", shopId).order("name"),
        supabase.from("product_batches").select("id,product_id,batch_number,expiry_date,stock_quantity,sale_price,purchase_price").eq("shop_id", shopId)
      ]);
      setParties(pts || []);
      setProducts(prds || []);

      const batchMap: Record<string, ProductBatch[]> = {};
      if (bData) {
        bData.forEach((b: any) => {
          if (!b.product_id) return;
          if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
          batchMap[b.product_id].push(b);
        });
      }
      setProductBatches(batchMap);
    } catch (err: any) {
      toast.error("Failed to load setup data: " + err.message);
    }
  }

  async function loadPastDocuments() {
    setLoading(true);
    try {
      if (activeTab === "sale") {
        let query = supabase.from("invoices").select("id,created_at,total_amount,invoice_items(id,product_id,variant_id,quantity,unit_price,subtotal,batch_number,expiry_date,batch_id)");
        if (selectedPartyId === "walkin") {
          query = query.is("party_id", null);
        } else {
          query = query.eq("party_id", selectedPartyId);
        }

        const { data: invs, error } = await query
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        const populated = [];
        for (const inv of (invs || [])) {
          const items = [];
          for (const item of (inv.invoice_items || [])) {
            const pName = products.find(p => p.id === item.product_id)?.name || "Unknown Product";
            items.push({ ...item, productName: pName });
          }
          populated.push({ ...inv, invoice_items: items });
        }
        setPastDocuments(populated);
      } else {
        let query = supabase.from("purchase_orders").select("id,created_at,total_amount,purchase_order_items(id,product_id,quantity,unit_price,subtotal,batch_number,expiry_date)");
        if (selectedPartyId === "cash") {
          query = query.is("supplier_id", null);
        } else {
          query = query.eq("supplier_id", selectedPartyId);
        }

        const { data: pos, error } = await query
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        const populated = [];
        for (const po of (pos || [])) {
          const items = [];
          for (const item of (po.purchase_order_items || [])) {
            const pName = products.find(p => p.id === item.product_id)?.name || "Unknown Product";
            items.push({ ...item, productName: pName });
          }
          populated.push({ ...po, purchase_order_items: items });
        }
        setPastDocuments(populated);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvoiceSearch() {
    if (!invoiceSearchQuery.trim() || !shopId) return;
    setIsSearchingInvoice(true);
    try {
      const q = invoiceSearchQuery.trim();
      let foundDoc = null;

      // Direct UUID lookup
      if (q.length === 36) {
        if (activeTab === "sale") {
          const { data } = await supabase
            .from("invoices")
            .select("*, invoice_items(id,product_id,variant_id,quantity,unit_price,subtotal,batch_number,expiry_date,batch_id)")
            .eq("id", q)
            .maybeSingle();
          if (data) foundDoc = data;
        } else {
          const { data } = await supabase
            .from("purchase_orders")
            .select("*, purchase_order_items(id,product_id,quantity,unit_price,subtotal,batch_number,expiry_date)")
            .eq("id", q)
            .maybeSingle();
          if (data) foundDoc = data;
        }
      }

      // If not found, search recent documents for a partial ID match
      if (!foundDoc) {
        if (activeTab === "sale") {
          const { data } = await supabase
            .from("invoices")
            .select("*, invoice_items(id,product_id,variant_id,quantity,unit_price,subtotal,batch_number,expiry_date,batch_id)")
            .eq("shop_id", shopId)
            .order("created_at", { ascending: false })
            .limit(200);
          
          if (data) {
            foundDoc = data.find((inv: any) => inv.id.toLowerCase().includes(q.toLowerCase()));
          }
        } else {
          const { data } = await supabase
            .from("purchase_orders")
            .select("*, purchase_order_items(id,product_id,quantity,unit_price,subtotal,batch_number,expiry_date)")
            .eq("shop_id", shopId)
            .order("created_at", { ascending: false })
            .limit(200);
          
          if (data) {
            foundDoc = data.find((po: any) => po.id.toLowerCase().includes(q.toLowerCase()));
          }
        }
      }

      if (foundDoc) {
        setSelectedDocId(foundDoc.id);
        if (activeTab === "sale") {
          setSelectedPartyId(foundDoc.party_id || "walkin");
        } else {
          setSelectedPartyId(foundDoc.supplier_id || "cash");
        }
        
        const items: ReturnCartItem[] = activeTab === "sale" 
          ? foundDoc.invoice_items.map((i: any) => ({
              productId: i.product_id,
              productName: products.find(p => p.id === i.product_id)?.name || "Product",
              quantity: 0,
              price: Number(i.unit_price),
              maxQty: Number(i.quantity),
              batchNumber: i.batch_number || null,
              expiryDate: i.expiry_date || null,
              batchId: i.batch_id || null,
            }))
          : foundDoc.purchase_order_items.map((i: any) => ({
              productId: i.product_id,
              productName: products.find(p => p.id === i.product_id)?.name || "Product",
              quantity: 0,
              price: Number(i.unit_price),
              maxQty: Number(i.quantity),
              batchNumber: i.batch_number || null,
              expiryDate: i.expiry_date || null,
            }));
        setReturnItems(items);
        toast.success(`Found document: #${foundDoc.id.slice(0, 8).toUpperCase()}`);
      } else {
        toast.error("Document not found. Please verify the ID.");
      }
    } catch (err: any) {
      toast.error("Search failed: " + err.message);
    } finally {
      setIsSearchingInvoice(false);
    }
  }

  function handleAddOpenReturnItem() {
    if (!openReturnProductId) {
      toast.error("Please select a product");
      return;
    }
    if (openReturnQty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (openReturnPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    const prod = products.find(p => p.id === openReturnProductId);
    if (!prod) return;

    const trimmedBatch = openReturnBatchNumber.trim() || null;
    const trimmedExpiry = openReturnExpiryDate.trim() || null;

    const existingIdx = returnItems.findIndex(
      item => item.productId === openReturnProductId && item.batchNumber === trimmedBatch
    );

    if (existingIdx !== -1) {
      setReturnItems(prev => prev.map((item, idx) => 
        idx === existingIdx 
          ? { ...item, quantity: item.quantity + openReturnQty } 
          : item
      ));
    } else {
      setReturnItems(prev => [...prev, {
        productId: openReturnProductId,
        productName: prod.name,
        quantity: openReturnQty,
        price: openReturnPrice,
        maxQty: 999999, // no limit
        batchNumber: trimmedBatch,
        expiryDate: trimmedExpiry,
      }]);
    }

    setOpenReturnProductId("");
    setOpenReturnQty(1);
    setOpenReturnPrice(0);
    setOpenReturnBatchNumber("");
    setOpenReturnExpiryDate("");
    setIsCustomBatchOpenReturn(false);
    toast.success("Added to return cart with Batch details!");
  }

  async function handleSaveReturn(e: React.FormEvent) {
    e.preventDefault();
    const itemsToReturn = returnItems.filter(item => item.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error("Please specify return quantities for at least one item.");
      return;
    }

    setSubmittingReturn(true);
    try {
      const returnTotal = itemsToReturn.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const isWalkinOrCash = selectedPartyId === "walkin" || selectedPartyId === "cash" || !selectedPartyId;
      const dbPartyId = isWalkinOrCash ? null : selectedPartyId;

      // 1. Insert return record
      const { data: ret, error: retErr } = await supabase
        .from("returns")
        .insert({
          shop_id: shopId,
          invoice_id: (activeTab === "sale" && selectedDocId) ? selectedDocId : null,
          purchase_order_id: (activeTab === "purchase" && selectedDocId) ? selectedDocId : null,
          party_id: dbPartyId,
          type: activeTab,
          total_amount: returnTotal,
          notes: returnNotes.trim() || null
        })
        .select()
        .single();

      if (retErr) throw retErr;

      // 2. Insert items and update product overall stock + batch stock
      for (const item of itemsToReturn) {
        await supabase.from("return_items").insert({
          return_id: ret.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.price * item.quantity,
          batch_number: item.batchNumber || null,
          expiry_date: item.expiryDate || null,
        });

        // Update product overall stock
        const currentStock = products.find(p => p.id === item.productId)?.current_stock || 0;
        const newStock = activeTab === "sale"
          ? currentStock + item.quantity // Sale return -> increment stock
          : Math.max(0, currentStock - item.quantity); // Purchase return -> decrement stock
        
        await supabase.from("products").update({ current_stock: newStock }).eq("id", item.productId);

        // Update batch stock in product_batches if batch_number is specified
        if (item.batchNumber) {
          const { data: existingBatch } = await supabase
            .from("product_batches")
            .select("id, stock_quantity, expiry_date")
            .eq("shop_id", shopId)
            .eq("product_id", item.productId)
            .eq("batch_number", item.batchNumber)
            .maybeSingle();

          if (activeTab === "sale") {
            // Customer returning medicine -> RESTOCK into batch
            if (existingBatch) {
              await supabase
                .from("product_batches")
                .update({
                  stock_quantity: (existingBatch.stock_quantity || 0) + item.quantity,
                  expiry_date: item.expiryDate || existingBatch.expiry_date
                })
                .eq("id", existingBatch.id);
            } else {
              // Create new batch record if not previously found
              await supabase
                .from("product_batches")
                .insert({
                  shop_id: shopId,
                  product_id: item.productId,
                  batch_number: item.batchNumber,
                  expiry_date: item.expiryDate || null,
                  stock_quantity: item.quantity,
                  sale_price: item.price,
                });
            }
          } else {
            // Purchase Return (Debit Note to supplier) -> DEDUCT from batch
            if (existingBatch) {
              const updatedBatchStock = Math.max(0, (existingBatch.stock_quantity || 0) - item.quantity);
              await supabase
                .from("product_batches")
                .update({ stock_quantity: updatedBatchStock })
                .eq("id", existingBatch.id);
            }
          }
        }
      }

      // 3. Update customer/supplier Khata balance
      if (dbPartyId) {
        const balanceChange = -returnTotal;
        await supabase.rpc("increment_party_balance", {
          p_party_id: dbPartyId,
          p_amount: balanceChange
        });

        // Log in credit transactions
        await supabase.from("credit_transactions").insert({
          shop_id: shopId,
          customer_id: dbPartyId,
          transaction_type: "payment",
          amount: returnTotal,
          remarks: `${activeTab === "sale" ? "Sale Return (Credit Note)" : "Purchase Return (Debit Note)"} ${selectedDocId ? `for Invoice #${selectedDocId.slice(0,8).toUpperCase()}` : "(Open Return)"} | Ref #${ret.id.slice(0, 8).toUpperCase()}`
        });
      }

      toast.success(`${activeTab === "sale" ? "Credit Note & Batch Restocked" : "Debit Note"} saved successfully! 📦`);
      setSelectedPartyId("");
      setSelectedDocId("");
      setReturnNotes("");
      setReturnItems([]);
      setReturnMode("invoice");
      setInvoiceSearchQuery("");
      loadBaseData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingReturn(false);
    }
  }

  async function handleSaveStockAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustProductId || adjustQty <= 0) {
      toast.error("Please select a product and enter a valid quantity.");
      return;
    }

    setSubmittingAdjust(true);
    try {
      const prod = products.find(p => p.id === adjustProductId);
      if (!prod) return;

      const adjustedQty = -adjustQty;

      // 1. Insert adjustment record
      await supabase.from("stock_adjustments").insert({
        shop_id: shopId,
        product_id: adjustProductId,
        quantity: adjustedQty,
        reason: adjustReason,
        notes: adjustNotes.trim() || (adjustBatchNumber ? `Batch: ${adjustBatchNumber}` : null)
      });

      // 2. Update product stock level
      const newStock = Math.max(0, (prod.current_stock || 0) + adjustedQty);
      await supabase.from("products").update({ current_stock: newStock }).eq("id", adjustProductId);

      // 3. If a batch was specified, deduct from product_batches
      if (adjustBatchNumber) {
        const { data: bRow } = await supabase
          .from("product_batches")
          .select("id, stock_quantity")
          .eq("shop_id", shopId)
          .eq("product_id", adjustProductId)
          .eq("batch_number", adjustBatchNumber)
          .maybeSingle();

        if (bRow) {
          const updatedQty = Math.max(0, (bRow.stock_quantity || 0) - adjustQty);
          await supabase.from("product_batches").update({ stock_quantity: updatedQty }).eq("id", bRow.id);
        }
      }

      toast.success(`Inventory stock & batch adjusted successfully! 🗑️`);
      setAdjustProductId("");
      setAdjustBatchNumber("");
      setAdjustQty(0);
      setAdjustNotes("");
      loadBaseData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingAdjust(false);
    }
  }

  const selectedPartyType = activeTab === "sale" ? "customer" : "supplier";
  const filteredParties = parties.filter(p => p.type === selectedPartyType);
  const openReturnProductBatches = openReturnProductId ? (productBatches[openReturnProductId] || []) : [];
  const adjustProductBatches = adjustProductId ? (productBatches[adjustProductId] || []) : [];

  const productOptions = products.map(p => ({
    value: p.id,
    label: `${p.name} (Stock: ${Number(p.current_stock).toLocaleString()})`
  }));

  const partyOptions = [
    ...(activeTab === "sale" ? [{ value: "walkin", label: "Walk-in Customer (Cash Refund)" }] : [{ value: "cash", label: "Cash PO (Cash Supplier)" }]),
    ...filteredParties.map(p => ({ value: p.id, label: p.name }))
  ];

  return (
    <div className="space-y-3 font-sans text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/80">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl text-white shadow-2xs">
              <RotateCcw className="h-4 w-4" />
            </span>
            Returns & Stock Adjustments
          </h1>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Manage Credit Notes (customer returns & batch restock), Debit Notes (supplier returns) and stock damages
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border border-slate-200 bg-white rounded-lg p-0.5 shadow-2xs gap-0.5 select-none shrink-0">
          {(["sale", "purchase", "adjust"] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                activeTab === tab 
                  ? "bg-slate-900 text-white shadow-2xs font-black" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {tab === "sale" && <ArrowDownLeft size={12} className="text-emerald-400" />}
              {tab === "purchase" && <ArrowUpRight size={12} className="text-rose-400" />}
              {tab === "adjust" && <Sparkles size={12} className="text-amber-400" />}
              {tab === "sale" ? "Sales Return (Credit Note)" : tab === "purchase" ? "Purchase Return (Debit Note)" : "Damage / Wastage"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* Left Form: Select / Search Document or Adjust stock */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
          {activeTab !== "adjust" ? (
            <form onSubmit={handleSaveReturn} className="space-y-3">
              
              {/* Return mode tabs */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg mb-2 text-xs font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setReturnMode("invoice")}
                  className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                    returnMode === "invoice" ? "bg-white text-slate-800 shadow-2xs font-black" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  By Past Bill / PO
                </button>
                <button
                  type="button"
                  onClick={() => setReturnMode("open")}
                  className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                    returnMode === "open" ? "bg-white text-slate-800 shadow-2xs font-black" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Open Return (With Batch)
                </button>
              </div>

              {returnMode === "invoice" ? (
                <div className="space-y-4">
                  {/* Invoice Search Input */}
                  <div className="space-y-1.5 pb-3 border-b border-slate-100">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Search by Bill # / Invoice ID (e.g. walk-in or any customer)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter Bill # / UUID (e.g. 9c2b...)"
                        value={invoiceSearchQuery}
                        onChange={e => setInvoiceSearchQuery(e.target.value)}
                        className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleInvoiceSearch}
                        disabled={isSearchingInvoice}
                        className="px-3.5 h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        {isSearchingInvoice ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />} Search
                      </button>
                    </div>
                  </div>

                  {/* Browse by Customer */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Or Browse By {activeTab === "sale" ? "Customer" : "Supplier"}
                      </label>
                      <SearchableSelect 
                        options={partyOptions}
                        value={selectedPartyId}
                        onChange={val => { setSelectedPartyId(val); setSelectedDocId(""); }}
                        placeholder={`Choose ${activeTab === "sale" ? "customer" : "supplier"}...`}
                      />
                    </div>

                    {selectedPartyId && (
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                          Select {activeTab === "sale" ? "Invoice" : "Purchase Order"}
                        </label>
                        {loading ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-450 p-2"><Loader2 size={13} className="animate-spin" /> Loading documents...</div>
                        ) : pastDocuments.length === 0 ? (
                          <p className="text-xs text-rose-500 font-bold p-1">No past entries found for this selection.</p>
                        ) : (
                          <select 
                            value={selectedDocId}
                            onChange={e => setSelectedDocId(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-bold text-slate-600"
                          >
                            <option value="">Select entry...</option>
                            {pastDocuments.map(d => (
                              <option key={d.id} value={d.id}>
                                #{d.id.slice(0,8).toUpperCase()} ({new Date(d.created_at).toLocaleDateString()}) - Rs {Number(d.total_amount).toLocaleString()}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 animate-fade-in">
                  {/* Open Return selection */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Return Customer / Supplier
                    </label>
                    <SearchableSelect 
                      options={partyOptions}
                      value={selectedPartyId}
                      onChange={setSelectedPartyId}
                      placeholder="Select customer / supplier..."
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Product to Return</label>
                    <SearchableSelect 
                      options={productOptions}
                      value={openReturnProductId}
                      onChange={pid => {
                        setOpenReturnProductId(pid);
                        const prod = products.find(p => p.id === pid);
                        if (prod) {
                          setOpenReturnPrice(activeTab === "sale" ? Number(prod.sale_price_single || 0) : Number(prod.purchase_price_single || 0));
                        } else {
                          setOpenReturnPrice(0);
                        }
                      }}
                      placeholder="Search & choose product..."
                    />
                  </div>

                  {/* Batch Selection for Open Return */}
                  {openReturnProductId && (
                    <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1">
                          <Layers size={11} className="text-indigo-600" /> Restock Batch & Expiry
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCustomBatchOpenReturn(!isCustomBatchOpenReturn)}
                          className="text-[9.5px] font-extrabold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                        >
                          {isCustomBatchOpenReturn ? "Select Existing Batch" : "+ Custom Batch"}
                        </button>
                      </div>

                      {!isCustomBatchOpenReturn && openReturnProductBatches.length > 0 ? (
                        <div>
                          <select
                            value={openReturnBatchNumber}
                            onChange={e => {
                              const bNum = e.target.value;
                              setOpenReturnBatchNumber(bNum);
                              const matched = openReturnProductBatches.find(b => b.batch_number === bNum);
                              setOpenReturnExpiryDate(matched?.expiry_date || "");
                            }}
                            className="w-full h-8 px-2.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-700"
                          >
                            {openReturnProductBatches.map(b => (
                              <option key={b.id} value={b.batch_number}>
                                Batch: {b.batch_number} {b.expiry_date ? `(Exp: ${b.expiry_date})` : ""} · Current: {b.stock_quantity} units
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <input
                              type="text"
                              placeholder="Batch No (e.g. PZ002L)"
                              value={openReturnBatchNumber}
                              onChange={e => setOpenReturnBatchNumber(e.target.value)}
                              className="w-full h-8 px-2.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <div>
                            <input
                              type="date"
                              placeholder="Expiry Date"
                              value={openReturnExpiryDate}
                              onChange={e => setOpenReturnExpiryDate(e.target.value)}
                              className="w-full h-8 px-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Return Qty</label>
                      <input 
                        type="number" 
                        value={openReturnQty || ""}
                        onChange={e => setOpenReturnQty(Number(e.target.value))}
                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        placeholder="0"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Return Unit Price (Rs)</label>
                      <input 
                        type="number" 
                        value={openReturnPrice || ""}
                        onChange={e => setOpenReturnPrice(Number(e.target.value))}
                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddOpenReturnItem}
                    className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add to Return Cart
                  </button>
                </div>
              )}

              {returnItems.length > 0 && (
                <div className="pt-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Remarks / Return Reason</label>
                  <textarea 
                    placeholder="Provide details about return reason..." 
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-bold h-16 resize-none"
                  />
                </div>
              )}

              {returnItems.length > 0 && (
                <button 
                  type="submit" 
                  disabled={submittingReturn}
                  className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-200 disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {submittingReturn && <Loader2 size={13} className="animate-spin" />} Save Return & Restock Batches
                </button>
              )}

            </form>
          ) : (
            <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
              <h3 className="font-black text-slate-800 text-sm mb-4 pb-2 border-b border-slate-50 flex items-center gap-1.5">
                <Sparkles size={16} className="text-violet-600" /> Log Stock Damage / Adjustment
              </h3>
              
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Product</label>
                <SearchableSelect 
                  options={productOptions}
                  value={adjustProductId}
                  onChange={pid => {
                    setAdjustProductId(pid);
                    const b = productBatches[pid] || [];
                    setAdjustBatchNumber(b.length > 0 ? b[0].batch_number : "");
                  }}
                  placeholder="Search & choose product to adjust..."
                />
              </div>

              {adjustProductId && adjustProductBatches.length > 0 && (
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Specific Batch to Deduct</label>
                  <select
                    value={adjustBatchNumber}
                    onChange={e => setAdjustBatchNumber(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-bold text-slate-600"
                  >
                    <option value="">General Stock (No Batch)</option>
                    {adjustProductBatches.map(b => (
                      <option key={b.id} value={b.batch_number}>
                        Batch: {b.batch_number} {b.expiry_date ? `(Exp: ${b.expiry_date})` : ""} · Available: {b.stock_quantity} units
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Wastage / Damage Quantity</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={adjustQty || ""}
                  onChange={e => setAdjustQty(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-bold"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Adjustment Reason</label>
                <select 
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value as any)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-bold text-slate-600"
                >
                  <option value="damaged">Damaged / Broken</option>
                  <option value="expired">Expired Stock</option>
                  <option value="stolen">Stolen / Lost</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Remarks / Details</label>
                <textarea 
                  placeholder="Optional notes..." 
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 font-bold h-20 resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={submittingAdjust}
                className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-200 disabled:opacity-50 cursor-pointer"
              >
                {submittingAdjust && <Loader2 size={13} className="animate-spin" />} Adjust Inventory Stock
              </button>

            </form>
          )}
        </div>

        {/* Right itemization list / log */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[420px]">
          {activeTab !== "adjust" ? (
            <>
              <div>
                <h3 className="font-black text-slate-800 text-sm mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                  <span>Returned Items Cart</span>
                  {returnItems.length > 0 && (
                    <span className="text-[9px] text-slate-400 font-bold uppercase font-mono bg-slate-50 border px-2 py-0.5 rounded-md">
                      {returnItems.length} {returnItems.length === 1 ? "Item" : "Items"} in cart
                    </span>
                  )}
                </h3>

                {returnItems.length === 0 ? (
                  <div className="text-center py-24 text-slate-400 text-xs font-medium">
                    {returnMode === "invoice" ? "Select or search a document to choose items for return" : "Search and add products to the return cart"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                      {returnItems.map((item, idx) => (
                        <div key={`${item.productId}-${idx}`} className="flex items-center justify-between p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                          <div className="min-w-0 flex-1 pr-3">
                            <h4 className="font-extrabold text-slate-800 text-xs leading-snug truncate">{item.productName}</h4>
                            
                            {/* Batch & Expiry Badge */}
                            {(item.batchNumber || item.expiryDate) && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                                  <Layers size={10} className="text-emerald-600" />
                                  Batch: {item.batchNumber || "FEFO"}
                                  {item.expiryDate && <span>· Exp: {item.expiryDate}</span>}
                                </span>
                              </div>
                            )}

                            <p className="text-[9px] text-slate-400 font-semibold mt-1">
                              Refund Rate: Rs {item.price.toLocaleString()} {item.maxQty < 999999 && `• Original Bill Qty: ${item.maxQty}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase font-sans">Return Qty:</span>
                            <input 
                              type="number" 
                              value={item.quantity || ""}
                              onChange={e => {
                                const val = item.maxQty < 999999 
                                  ? Math.min(item.maxQty, Math.max(0, Number(e.target.value)))
                                  : Math.max(0, Number(e.target.value));
                                setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                              }}
                              className="w-16 h-8 text-center bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                              placeholder="0"
                              min="0"
                              max={item.maxQty < 999999 ? item.maxQty : undefined}
                            />
                            <button
                              type="button"
                              onClick={() => setReturnItems(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-all cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {returnItems.length > 0 && (
                <div className="border-t border-slate-100 pt-4 mt-4 flex items-baseline justify-between">
                  <span className="text-slate-450 font-bold text-xs">Total Refund/Credit:</span>
                  <span className="text-lg font-black text-violet-600">
                    Rs {returnItems.reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString()}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <h3 className="font-black text-slate-800 text-sm mb-4 pb-3 border-b border-slate-100">
                  Wastage & Damage Adjustments Log
                </h3>
                <div className="text-center py-24 text-slate-400 text-xs font-medium">
                  Verify stock adjustments in your database logs or complete form on the left.
                </div>
              </div>
              <div className="h-4" />
            </>
          )}
        </div>

      </div>

    </div>
  );
}
