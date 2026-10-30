"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import { 
  Truck, Plus, FileText, Keyboard, Search, ShoppingCart, 
  Trash2, Check, X, Minus, CreditCard, Loader2, Banknote, ReceiptText, Save, Smartphone, Sparkles, Lock, Edit, Edit3
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAudit } from "@/utils/audit";
import { isMoneyRpcEnabled, receivePurchaseRpc, updatePurchaseRpc } from "@/lib/money/rpc";
import { withOfflineRead, executeOrQueue } from "@/lib/sync/offlineData";
import { filterAndRankProducts } from "@/utils/productSearch";

// ── Modular Components ──────────────────────────────────────────────────────
import { SupplierSelector }  from "./_components/SupplierSelector";
import { AddSupplierModal }  from "./_components/AddSupplierModal";
import { PurchaseHistory }   from "./_components/PurchaseHistory";
import { PODetailModal }     from "./_components/PODetailModal";
import { ShortcutsHelp }     from "./_components/ShortcutsHelp";
import { AIInvoiceModal }    from "./_components/AIInvoiceModal";
import { AutoPOGeneratorModal } from "./_components/AutoPOGeneratorModal";
import { PurchaseCartMobile } from "./_components/PurchaseCartMobile";
import { HeldPurchasesModal, HeldPurchase } from "./_components/HeldPurchasesModal";
import EditPackingModal from "./_components/EditPackingModal";
import { Pause, Play, ExternalLink, Clock } from "lucide-react";
import type { DBProduct, Supplier, Category, CartItem, PurchaseOrder, PODetailItem } from "./_components/types";

const QuickAddProductModal = dynamic(
  () => import("../pos/components/QuickAddProductModal").then((m) => m.QuickAddProductModal),
  { ssr: false }
);

export default function PurchasePage() {
  const { shopId, userId, shopName, industryType, hasTax, activeClosingBook, subscriptionTier, subscriptionExpiresAt } = useShop();
  const supabase = createClient();

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [isLive,    setIsLive]    = useState(false);

  // ── Base data ──
  const [products,   setProducts]   = useState<DBProduct[]>([]);
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts,   setAccounts]   = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loading,    setLoading]    = useState(true);

  // ── Cart state ──
  const [cart,               setCart]               = useState<CartItem[]>([]);
  const [searchQuery,        setSearchQuery]        = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState("walkin");
  const [discount,           setDiscount]           = useState(0);
  const [discountType,       setDiscountType]       = useState<"flat" | "percentage">("flat");
  const [taxRate,            setTaxRate]            = useState(0);
  const [taxType,            setTaxType]            = useState<"flat" | "percentage">("percentage");
  const [paymentMode,        setPaymentMode]        = useState<"cash" | "bank" | "credit">("cash");
  const [paidNow,            setPaidNow]            = useState(0);
  const [invoiceNumber,      setInvoiceNumber]      = useState("");
  const [notes,              setNotes]              = useState("");
  const [isSubmitting,       setIsSubmitting]       = useState(false);

  // ── Edit PO State ──
  const [editingPOId,     setEditingPOId]     = useState<string | null>(null);
  const [editingPONumber, setEditingPONumber] = useState<string | null>(null);

  // ── Draft & Held Purchases State (Multi-Tab & Crash-Proof Recovery) ──
  const [isHeldModalOpen,       setIsHeldModalOpen]       = useState(false);
  const [heldPurchases,         setHeldPurchases]         = useState<HeldPurchase[]>([]);
  const [isDraftRestored,       setIsDraftRestored]       = useState(false);
  const [draftSavedTime,        setDraftSavedTime]        = useState<string | null>(null);
  const isInitialMount = useRef(true);

  // ── Quick Add Product Modal state ──
  const [isQuickAddProductOpen, setIsQuickAddProductOpen] = useState(false);
  const [quickAddInitialName,   setQuickAddInitialName]   = useState("");

  // ── Cart keyboard focus ──
  const [isCartFocused,       setIsCartFocused]       = useState(false);
  const [selectedCartIdx,     setSelectedCartIdx]     = useState(-1);

  // ── Search dropdown focus & index state ──
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedSearchProductIndex, setSelectedSearchProductIndex] = useState(0);

  // ── Modals ──
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isShortcutsOpen,   setIsShortcutsOpen]   = useState(false);
  const [isAIModalOpen,     setIsAIModalOpen]     = useState(false);
  const [isAutoPOOpen,    setIsAutoPOOpen]    = useState(false);
  const [isDetailOpen,      setIsDetailOpen]      = useState(false);
  const [activeProductForVariants, setActiveProductForVariants] = useState<DBProduct | null>(null);
  const [selectedModalIndex, setSelectedModalIndex] = useState<number>(0);

  // IMEI manual input states for Purchase
  const [isImeiPurchaseModalOpen, setIsImeiPurchaseModalOpen] = useState(false);
  const [imeiPurchaseProduct, setImeiPurchaseProduct] = useState<DBProduct | null>(null);
  const [imeiPurchaseInputs, setImeiPurchaseInputs] = useState<Array<{ imei1: string; imei2?: string }>>([]);
  const [imeiBulkText, setImeiBulkText] = useState("");
  const [imeiEntryTab, setImeiEntryTab] = useState<"bulk" | "rows">("bulk");
  const [rapidScanInput, setRapidScanInput] = useState("");
  
  // Pharmacy manual input states for Purchase
  const [isPharmacyPurchaseModalOpen, setIsPharmacyPurchaseModalOpen] = useState(false);
  const [pharmacyPurchaseCartIdx, setPharmacyPurchaseCartIdx] = useState<number | null>(null);
  const [pharmacyInputs, setPharmacyInputs] = useState<{ bonusQty: number; discount: number; batchNumber: string; expiryDate: string }>({ bonusQty: 0, discount: 0, batchNumber: "", expiryDate: "" });
  
  // Hardware Calculator States (ft + in split inputs)
  const [hardwareCalcProduct, setHardwareCalcProduct] = useState<DBProduct | null>(null);
  const [hardwareCalcLengthFt, setHardwareCalcLengthFt] = useState<number>(0);
  const [hardwareCalcLengthIn, setHardwareCalcLengthIn] = useState<number>(0);
  const [hardwareCalcWidthFt, setHardwareCalcWidthFt] = useState<number>(0);
  const [hardwareCalcWidthIn, setHardwareCalcWidthIn] = useState<number>(0);
  const [hardwareCalcQty, setHardwareCalcQty] = useState<number>(1);

  // Quick Packing / Variant Manager Modal States
  const [isEditPackingModalOpen, setIsEditPackingModalOpen] = useState<boolean>(false);
  const [editingPackingProduct, setEditingPackingProduct] = useState<DBProduct | null>(null);
  const [editingPackingCartIndex, setEditingPackingCartIndex] = useState<number | null>(null);

  const openEditPackingModal = (product: DBProduct, cartIndex?: number) => {
    setEditingPackingProduct(product);
    setEditingPackingCartIndex(cartIndex !== undefined ? cartIndex : null);
    setIsEditPackingModalOpen(true);
  };

  const handlePackingUpdated = (
    updatedProduct: DBProduct,
    selectedVariant?: {
      id: string;
      packing_name: string;
      pack_size: number;
      purchase_price: number;
      sale_price: number;
    }
  ) => {
    // 1. Update in-memory product list
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );

    // 2. If opened from a specific cart row, update that row with the chosen variant / single unit
    if (editingPackingCartIndex !== null) {
      setCart((prev) =>
        prev.map((c, i) => {
          if (i !== editingPackingCartIndex) return c;
          if (selectedVariant) {
            return {
              ...c,
              variantId: selectedVariant.id,
              packingName: selectedVariant.packing_name,
              purchasePrice: selectedVariant.purchase_price,
              salePrice: selectedVariant.sale_price,
            };
          } else {
            return {
              ...c,
              variantId: undefined,
              packingName: undefined,
              purchasePrice: updatedProduct.purchase_price_single || 0,
              salePrice: updatedProduct.sale_price_single || 0,
            };
          }
        })
      );
    }
  };

  const [selectedPO,        setSelectedPO]        = useState<any>(null);
  const [selectedPOItems,   setSelectedPOItems]   = useState<PODetailItem[]>([]);
  const [loadingDetail,     setLoadingDetail]     = useState(false);
  const [voidingId,         setVoidingId]         = useState<string | null>(null);

  const isPremium = useMemo(() => {
    const isExpired = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) < new Date() : true;
    return !isExpired && subscriptionTier === "premium";
  }, [subscriptionTier, subscriptionExpiresAt]);

  const isPharmacyOrAgri = industryType === "pharmacy" || industryType === "fertilizer";
  const isElectronics = industryType === "electronics";

  const handleOpenAIModal = () => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    setIsAIModalOpen(true);
  };

  // ── History ──
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Realtime ──
  useEffect(() => {
    if (!shopId) return;
    fetchBaseData();
    
    let channel: any = null;
    if (!activeClosingBook) {
      channel = supabase
        .channel(`purchase-rt-${shopId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "products",        filter: `shop_id=eq.${shopId}` }, fetchBaseData)
        .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders", filter: `shop_id=eq.${shopId}` }, () => { fetchBaseData(); if (activeTab === "history") fetchHistory(); })
        .subscribe((s: any) => setIsLive(s === "SUBSCRIBED"));
    } else {
      setIsLive(false);
    }

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [shopId, activeClosingBook, activeTab]);

  useEffect(() => { if (activeTab === "history" && shopId) fetchHistory(); }, [activeTab, shopId, activeClosingBook]);

  // ── 1. Restore Active Draft & Held Purchases on Mount ──
  useEffect(() => {
    if (!shopId) return;
    try {
      // Restore Held Purchases list
      const savedHeld = localStorage.getItem(`theaccounts_held_purchases_${shopId}`);
      if (savedHeld) {
        setHeldPurchases(JSON.parse(savedHeld));
      }

      // Restore Active Purchase Draft
      const activeDraftStr = localStorage.getItem(`theaccounts_purchase_draft_${shopId}`);
      if (activeDraftStr) {
        const draft = JSON.parse(activeDraftStr);
        if (draft && Array.isArray(draft.cart) && draft.cart.length > 0) {
          setCart(draft.cart);
          if (draft.selectedSupplierId) setSelectedSupplierId(draft.selectedSupplierId);
          if (draft.invoiceNumber) setInvoiceNumber(draft.invoiceNumber);
          if (draft.discount !== undefined) setDiscount(draft.discount);
          if (draft.discountType) setDiscountType(draft.discountType);
          if (draft.taxRate !== undefined) setTaxRate(draft.taxRate);
          if (draft.taxType) setTaxType(draft.taxType);
          if (draft.paymentMode) setPaymentMode(draft.paymentMode);
          if (draft.paidNow !== undefined) setPaidNow(draft.paidNow);
          if (draft.notes) setNotes(draft.notes);
          if (draft.selectedAccountId) setSelectedAccountId(draft.selectedAccountId);

          setIsDraftRestored(true);
          if (draft.savedAt) {
            setDraftSavedTime(new Date(draft.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          }
        }
      }
    } catch (err) {
      console.warn("Failed to restore purchase draft:", err);
    }
    isInitialMount.current = false;
  }, [shopId]);

  // ── 2. Auto-persist Active Draft on changes ──
  useEffect(() => {
    if (isInitialMount.current || !shopId || editingPOId) return;

    if (cart.length > 0 || invoiceNumber.trim()) {
      const payload = {
        cart,
        selectedSupplierId,
        invoiceNumber,
        discount,
        discountType,
        taxRate,
        taxType,
        paymentMode,
        paidNow,
        notes,
        selectedAccountId,
        savedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(`theaccounts_purchase_draft_${shopId}`, JSON.stringify(payload));
      } catch (err) {}
    } else {
      try {
        localStorage.removeItem(`theaccounts_purchase_draft_${shopId}`);
      } catch (err) {}
    }
  }, [cart, selectedSupplierId, invoiceNumber, discount, discountType, taxRate, taxType, paymentMode, paidNow, notes, selectedAccountId, shopId]);

  // ── 3. Multi-Tab Real-time Broadcast Channel Sync ──
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window) || !shopId) return;
    const bc = new BroadcastChannel("theaccounts_inventory_channel");
    bc.onmessage = (event) => {
      if (event.data?.shopId === shopId) {
        if (event.data?.type === "SALE_SAVED" || event.data?.type === "PURCHASE_SAVED" || event.data?.type === "STOCK_UPDATED") {
          // Re-fetch products stock in background without resetting active draft
          fetchBaseData();
        }
      }
    };
    return () => bc.close();
  }, [shopId]);

  // ── Computed totals ──
  const rawSubtotal  = cart.reduce((acc, c) => acc + c.purchasePrice * c.quantity, 0);
  
  const totalItemDiscounts = cart.reduce((acc, c) => {
    const lineGross = c.purchasePrice * c.quantity;
    const val = c.discount || 0;
    const itemDisc = c.discountType === "percentage" ? (lineGross * val) / 100 : val;
    return acc + itemDisc;
  }, 0);

  const totalItemTaxes = cart.reduce((acc, c) => {
    const lineGross = c.purchasePrice * c.quantity;
    const discVal = c.discount || 0;
    const itemDisc = c.discountType === "percentage" ? (lineGross * discVal) / 100 : discVal;
    const netCost = Math.max(0, lineGross - itemDisc);
    const taxVal = c.taxPercent || 0;
    const itemTax = c.taxType === "flat" ? taxVal : (netCost * taxVal) / 100;
    return acc + itemTax;
  }, 0);

  const subtotal = Math.max(0, rawSubtotal - totalItemDiscounts + totalItemTaxes);

  const calculatedTaxAmount = taxType === "flat" 
    ? taxRate 
    : (subtotal * taxRate) / 100;

  const calculatedDiscountAmount = discountType === "percentage"
    ? (subtotal * discount) / 100
    : discount;

  const taxAmount = calculatedTaxAmount;
  const total     = Math.max(0, subtotal + calculatedTaxAmount - calculatedDiscountAmount);
  const remaining = Math.max(0, total - paidNow);
  useEffect(() => { if (paymentMode !== "credit") setPaidNow(total); else setPaidNow(0); }, [paymentMode, total]);

  // Pharma profit & bonus realization metrics
  const totalBilledQty = cart.reduce((acc, c) => acc + (c.quantity || 0), 0);
  const totalBonusQty = cart.reduce((acc, c) => acc + (c.bonusQty || 0), 0);
  const totalBonusValue = cart.reduce((acc, c) => acc + ((c.bonusQty || 0) * (c.salePrice || c.purchasePrice || 0)), 0);
  const totalExpectedRetail = cart.reduce((acc, c) => acc + (((c.quantity || 0) + (c.bonusQty || 0)) * (c.salePrice || c.purchasePrice || 0)), 0);
  const projectedGrossProfit = Math.max(0, totalExpectedRetail - total);
  const grossMarginPercent = totalExpectedRetail > 0 ? Math.round((projectedGrossProfit / totalExpectedRetail) * 100) : 0;

  // ── Filtered products (Multi-token Word Order Agnostic & Ranked) ──
  const filteredProducts = useMemo(() => {
    return filterAndRankProducts(products, searchQuery, {
      categoryId: selectedCategoryId
    });
  }, [products, selectedCategoryId, searchQuery]);

  // ── Autocomplete Results ──
  const autocompleteResults = useMemo(() => {
    if (searchQuery.trim() === "") return [];
    return filteredProducts.slice(0, 15);
  }, [filteredProducts, searchQuery]);

  // ── Dynamic live debounced remote search for massive catalogs (10,000+ items) ──
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2 || !shopId) return;

    const timer = setTimeout(async () => {
      try {
        const tokens = trimmed.split(/\s+/).filter(Boolean);
        const selectStr = "id,name,code,unit,purchase_price_single,sale_price_single,current_stock,category_id,pack_size,measurement_type,has_imei,product_variants(id,packing_name,purchase_price,sale_price,stock_quantity,is_packing,pack_size)";
        let q = supabase
          .from("products")
          .select(selectStr)
          .eq("shop_id", shopId);

        if (tokens.length === 1) {
          q = q.or(`name.ilike.%${tokens[0]}%,code.ilike.%${tokens[0]}%`);
        } else {
          for (const token of tokens) {
            q = q.or(`name.ilike.%${token}%,code.ilike.%${token}%`);
          }
        }

        const { data, error } = await q.limit(40);

        if (!error && data && data.length > 0) {
          setProducts(prev => {
            const existingIds = new Set(prev.map((p: any) => p.id));
            const newItems = data.filter((p: any) => !existingIds.has(p.id));
            if (newItems.length > 0) {
              return [...newItems, ...prev];
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("Dynamic purchase search error:", err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, shopId, supabase]);

  // ── Modal Choices for Variations ──
  const modalChoices = useMemo<any[]>(() => {
    if (!activeProductForVariants) return [];
    return [
      { id: "base", name: `Base Unit (${activeProductForVariants.unit || "unit"})`, purchasePrice: activeProductForVariants.purchase_price_single || 0, price: activeProductForVariants.sale_price_single || 0, stock: activeProductForVariants.current_stock, isBase: true },
      ...getProductUnitOptions(activeProductForVariants)
    ];
  }, [activeProductForVariants]);

  useEffect(() => {
    setSelectedModalIndex(0);
  }, [activeProductForVariants]);

  // ── Helper to retrieve packing options ──
  function getProductUnitOptions(product: DBProduct) {
    const options: { 
      id: string; 
      name: string; 
      price: number; 
      purchasePrice: number;
      stock: number; 
    }[] = [];

    if (product.product_variants && product.product_variants.length > 0) {
      for (const v of product.product_variants) {
        if (!options.some(o => o.name.toLowerCase() === v.packing_name.toLowerCase())) {
          const isPacking = !!v.is_packing;
          const stockVal = isPacking && v.pack_size ? Math.floor(product.current_stock / v.pack_size) : v.stock_quantity;
          
          options.push({
            id: v.id,
            name: v.packing_name,
            price: v.sale_price,
            purchasePrice: v.purchase_price || 0,
            stock: stockVal
          });
        }
      }
    }
    return options;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ════════════════════════════════════════════════════════════════════════════
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const activeEl = document.activeElement;

    // ── Intercept keys if activeProductForVariants modal is open ──
    if (activeProductForVariants) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedModalIndex(prev => (prev + 1 < modalChoices.length ? prev + 1 : prev));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedModalIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const choice = modalChoices[selectedModalIndex];
        if (choice) {
          if (choice.isBase) {
            addToCart(activeProductForVariants);
          } else {
            addToCart(activeProductForVariants, choice.id, choice.name, choice.purchasePrice, choice.price);
          }
        }
        setActiveProductForVariants(null);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setActiveProductForVariants(null);
        return;
      }
    }

    const isEditingInputOrSelect = 
      (activeEl?.tagName === "INPUT" && activeEl.id !== "purchase-search-input") || 
      activeEl?.tagName === "SELECT" || 
      activeEl?.tagName === "TEXTAREA";

    if (isEditingInputOrSelect) {
      const allowedKeys = ["F1", "F2", "F3", "F4", "F7", "F8", "F9", "F10", "Escape"];
      if (!allowedKeys.includes(e.key)) {
        return;
      }
    }

    // INTERCEPT keys if autocomplete dropdown is open
    if (isSearchDropdownOpen && autocompleteResults.length > 0 && activeEl?.id === "purchase-search-input") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSearchProductIndex(prev => (prev + 1 < autocompleteResults.length ? prev + 1 : prev));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSearchProductIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selectedProd = autocompleteResults[selectedSearchProductIndex];
        if (selectedProd) {
          const options = getProductUnitOptions(selectedProd);
          if (options.length > 0) {
            setActiveProductForVariants(selectedProd);
          } else {
            addToCart(selectedProd);
          }
        }
        setSearchQuery("");
        setIsSearchDropdownOpen(false);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsSearchDropdownOpen(false);
        return;
      }
    }

    // ── Cart-focused mode ──
    if (isCartFocused && cart.length > 0) {
      if (e.key === "Escape" || e.key === "F3" || (e.altKey && e.key.toLowerCase() === "a")) {
        e.preventDefault();
        setIsCartFocused(false); setSelectedCartIdx(-1);
        document.getElementById("purchase-search-input")?.focus();
        return;
      }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedCartIdx(p => Math.min(p + 1, cart.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedCartIdx(p => Math.max(p - 1, 0)); return; }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (selectedCartIdx >= 0) {
          const activeId = document.activeElement?.id;
          if (!activeId || !activeId.startsWith("purchase-")) {
            document.getElementById(`purchase-rate-${selectedCartIdx}`)?.focus();
          } else if (activeId === `purchase-rate-${selectedCartIdx}`) {
            document.getElementById(`purchase-salerate-${selectedCartIdx}`)?.focus();
          } else if (activeId === `purchase-salerate-${selectedCartIdx}`) {
            document.getElementById(`purchase-qty-${selectedCartIdx}`)?.focus();
          }
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (selectedCartIdx >= 0) {
          const activeId = document.activeElement?.id;
          if (!activeId || !activeId.startsWith("purchase-")) {
            document.getElementById(`purchase-qty-${selectedCartIdx}`)?.focus();
          } else if (activeId === `purchase-qty-${selectedCartIdx}`) {
            document.getElementById(`purchase-salerate-${selectedCartIdx}`)?.focus();
          } else if (activeId === `purchase-salerate-${selectedCartIdx}`) {
            document.getElementById(`purchase-rate-${selectedCartIdx}`)?.focus();
          }
        }
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        setCart(prev => prev.filter((_, i) => i !== selectedCartIdx));
        setSelectedCartIdx(prev => {
          if (cart.length <= 1) {
            setIsCartFocused(false);
            return -1;
          }
          return Math.min(prev, cart.length - 2);
        });
        return;
      }
      if (e.key === "F8") { e.preventDefault(); setPaymentMode(p => p === "cash" ? "bank" : p === "bank" ? "credit" : "cash"); return; }
      if (e.key === "F9" || (e.altKey && e.key === "Enter")) { e.preventDefault(); handleSavePurchase(); return; }
    }

    // ── Global shortcuts ──
    if (e.key === "Enter" && activeEl?.id === "purchase-search-input" && searchQuery.trim() !== "") {
      e.preventDefault();
      const query = searchQuery.trim().toLowerCase();
      
      const matchedProduct = products.find(p => p.code && p.code.toLowerCase() === query);
      if (matchedProduct) {
        const options = getProductUnitOptions(matchedProduct);
        if (options.length > 0) {
          setActiveProductForVariants(matchedProduct);
        } else {
          addToCart(matchedProduct);
        }
        setSearchQuery("");
        setIsSearchDropdownOpen(false);
        return;
      } else {
        if (autocompleteResults.length === 1) {
          const prod = autocompleteResults[0];
          const options = getProductUnitOptions(prod);
          if (options.length > 0) {
            setActiveProductForVariants(prod);
          } else {
            addToCart(prod);
          }
          setSearchQuery("");
          setIsSearchDropdownOpen(false);
          return;
        }
      }
    }

    if (e.key === "F1" || (e.altKey && e.key.toLowerCase() === "s")) {
      e.preventDefault();
      setIsCartFocused(false); setSelectedCartIdx(-1);
      document.getElementById("purchase-search-input")?.focus();
      setIsSearchDropdownOpen(true);
    }
    if (e.key === "F2" || (e.altKey && e.key.toLowerCase() === "u")) {
      e.preventDefault();
      document.getElementById("purchase-supplier-btn")?.click();
    }
    if ((e.key === "F3" || (e.altKey && e.key.toLowerCase() === "a")) && !isCartFocused) {
      e.preventDefault();
      if (cart.length === 0) { toast.warning("Cart is empty!"); return; }
      setIsCartFocused(true); setSelectedCartIdx(0);
      document.getElementById("purchase-search-input")?.blur();
      toast.info("Cart focused — use ↑↓ to navigate, ← to edit price, → to edit qty, Del to remove");
    }
    if (e.key === "F4" || (e.altKey && e.key.toLowerCase() === "d")) {
      e.preventDefault();
      document.getElementById("purchase-discount-input")?.focus();
    }
    if (e.key === "F6") {
      e.preventDefault();
      handleHoldPurchase();
      return;
    }
    if (e.key === "F7" || (e.altKey && e.key.toLowerCase() === "t")) {
      e.preventDefault();
      document.getElementById("purchase-tax-input")?.focus();
    }
    if (e.key === "F8") {
      e.preventDefault();
      setPaymentMode(p => p === "cash" ? "bank" : p === "bank" ? "credit" : "cash");
    }
    if (e.key === "F9" || (e.altKey && e.key === "Enter")) {
      e.preventDefault();
      handleSavePurchase();
    }
    if (e.key === "F10" || (e.altKey && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      setIsShortcutsOpen(p => !p);
    }
    if (e.key === "Escape") {
      setSearchQuery("");
      setIsSearchDropdownOpen(false);
      setIsCartFocused(false); setSelectedCartIdx(-1);
    }
  }, [isCartFocused, cart, selectedCartIdx, paymentMode, discount, taxRate, selectedSupplierId, isSearchDropdownOpen, autocompleteResults, selectedSearchProductIndex, searchQuery, products, suppliers, heldPurchases, total]);

  useEffect(() => {
    if (activeTab !== "new") return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, handleKeyDown]);

  // ── Fetch functions ──
  async function fetchBaseData() {
    if (!shopId) return;
    setLoading(true);
    try {
      const result = await withOfflineRead({
        shopId,
        online: async () => {
          const selectWithIngredient = "id,name,code,unit,purchase_price_single,sale_price_single,current_stock,category_id,pack_size,measurement_type,has_imei,is_ingredient,product_variants(id,packing_name,purchase_price,sale_price,stock_quantity,is_packing,pack_size)";
          const selectBase = "id,name,code,unit,purchase_price_single,sale_price_single,current_stock,category_id,pack_size,measurement_type,has_imei,product_variants(id,packing_name,purchase_price,sale_price,stock_quantity,is_packing,pack_size)";

          // Parallelize initial database fetches for instant load (<300ms)
          const [prodRes, { data: sups }, { data: cats }, { data: accs }] = await Promise.all([
            supabase.from("products")
              .select(selectWithIngredient)
              .eq("shop_id", shopId)
              .order("name")
              .limit(1000),
            supabase.from("parties").select("id,name,phone,current_balance,address").eq("shop_id", shopId).in("type", ["supplier", "dual"]).order("name"),
            supabase.from("categories").select("id,name").eq("shop_id", shopId).order("name"),
            supabase.from("cash_accounts").select("id,name,current_balance").eq("shop_id", shopId).order("name"),
          ]);

          let initialProducts = prodRes.data || [];
          if (prodRes.error) {
            const fallbackRes = await supabase.from("products")
              .select(selectBase)
              .eq("shop_id", shopId)
              .order("name")
              .limit(1000);
            initialProducts = fallbackRes.data || [];
          }

          // Trigger asynchronous background stream if shop has >= 1000 items without blocking the UI
          if (initialProducts.length >= 1000) {
            (async () => {
              try {
                let offset = 1000;
                const limit = 1000;
                let more = true;
                while (more) {
                  const { data } = await supabase.from("products")
                    .select(selectBase)
                    .eq("shop_id", shopId)
                    .order("name")
                    .range(offset, offset + limit - 1);
                  const chunk = data || [];
                  if (chunk.length > 0) {
                    setProducts(prev => {
                      const existingIds = new Set(prev.map((p: any) => p.id));
                      const newItems = chunk.filter((p: any) => !existingIds.has(p.id));
                      return [...prev, ...newItems];
                    });
                  }
                  more = chunk.length === limit;
                  offset += limit;
                  if (offset > 30000) break;
                }
              } catch (bgErr) {
                console.warn("Background purchase product sync error:", bgErr);
              }
            })();
          }

          return {
            products: initialProducts,
            suppliers: sups || [],
            categories: cats || [],
            accounts: accs || [],
          };
        },
        offline: (snap) => ({
          products: snap.products,
          suppliers: snap.parties.filter((p) => p.type === "supplier" || p.type === "dual"),
          categories: snap.categories,
          accounts: snap.cashAccounts,
        }),
        onOfflineUsed: (savedAt) => {
          toast.message("Offline mode — showing cached purchase data", {
            description: savedAt ? `Last synced ${new Date(savedAt).toLocaleString()}` : undefined,
          });
        },
      });

      setProducts(result.products as any);
      setSuppliers(result.suppliers);
      setCategories(result.categories);
      setAccounts(result.accounts);
      if (result.accounts.length > 0) {
        const cashInHandAcc = result.accounts.find((a: any) => a.name.toLowerCase() === "cash in hand");
        setSelectedAccountId(prev => prev || (cashInHandAcc ? cashInHandAcc.id : result.accounts[0].id));
      }

      // Check for incoming draft PO items from Low Stock panel
      try {
        const draftItemsRaw = sessionStorage.getItem("theaccounts_draft_po_items");
        if (draftItemsRaw) {
          const draftItems = JSON.parse(draftItemsRaw);
          if (Array.isArray(draftItems) && draftItems.length > 0) {
            const mappedCart: CartItem[] = draftItems.map((d: any) => {
              const matchedProd = (result.products || []).find((p: any) => p.id === d.product_id);
              return {
                productId: d.product_id,
                name: d.product_name || matchedProd?.name || "Item",
                purchasePrice: Number(d.purchase_price ?? matchedProd?.purchase_price_single ?? 0),
                salePrice: Number(matchedProd?.sale_price_single ?? 0),
                quantity: Number(d.quantity || 1),
                stock: Number(matchedProd?.current_stock ?? 0),
                bonusQty: 0,
                discount: 0,
              };
            });
            setCart(mappedCart);
            sessionStorage.removeItem("theaccounts_draft_po_items");
            toast.success(`Loaded ${mappedCart.length} low-stock deficit items into Purchase cart! 🛒`);
          }
        }
      } catch (e) {
        console.error("Draft PO items load error:", e);
      }
    } catch (err: any) { toast.error("Load failed: " + err.message); }
    finally { setLoading(false); }
  }

  async function fetchHistory() {
    if (!shopId) return;
    setHistoryLoading(true);
    try {
      let poQuery = supabase
        .from("purchase_orders")
        .select("id,created_at,total_amount,paid_amount,discount,tax_amount,status,payment_mode,notes,invoice_number,is_voided,supplier_id")
        .eq("shop_id", shopId);

      if (activeClosingBook) {
        poQuery = poQuery.eq("closing_book_id", activeClosingBook.id);
      } else {
        poQuery = poQuery.is("closing_book_id", null);
      }

      const { data, error } = await poQuery.order("created_at", { ascending: false });
      if (error) throw error;

      const pMap: Record<string, string> = {};
      const psRes = await supabase.from("parties").select("id,name").eq("shop_id", shopId).in("type", ["supplier", "dual"]);
      (psRes.data || []).forEach((p: any) => { pMap[p.id] = p.name; });

      const itemsRes = await supabase.from("purchase_order_items").select("purchase_order_id");
      const cMap: Record<string, number> = {};
      (itemsRes.data || []).forEach((r: any) => { cMap[r.purchase_order_id] = (cMap[r.purchase_order_id] || 0) + 1; });

      setPurchaseOrders((data || []).map((po: any) => ({
        ...po,
        total_amount: Number(po.total_amount), paid_amount: Number(po.paid_amount),
        discount: Number(po.discount), tax_amount: Number(po.tax_amount),
        supplierName: po.supplier_id ? (pMap[po.supplier_id] || "Unknown") : "Cash Purchase",
        itemCount: cMap[po.id] || 0,
      })));
    } catch (err: any) { toast.error("History load failed: " + err.message); }
    finally { setHistoryLoading(false); }
  }

  // ── Cart helpers ──
  const handleConfirmHardwareCalculation = () => {
    if (!hardwareCalcProduct) return;

    const isDimension = hardwareCalcProduct.measurement_type === "dimension";

    // Convert ft+in to total feet
    const totalLengthFt = hardwareCalcLengthFt + hardwareCalcLengthIn / 12;
    const totalWidthFt  = hardwareCalcWidthFt  + hardwareCalcWidthIn  / 12;

    if (totalLengthFt <= 0) {
      toast.error("Please enter a valid length.");
      return;
    }
    if (isDimension && totalWidthFt <= 0) {
      toast.error("Please enter a valid width.");
      return;
    }

    let totalQty = 0;
    if (isDimension) {
      totalQty = totalLengthFt * totalWidthFt * hardwareCalcQty;
    } else {
      totalQty = totalLengthFt * hardwareCalcQty;
    }
    totalQty = Math.round(totalQty * 1000) / 1000;

    const fmtFtIn = (ft: number, inches: number) => {
      const parts: string[] = [];
      if (ft > 0) parts.push(`${ft} ft`);
      if (inches > 0) parts.push(`${inches} in`);
      return parts.length > 0 ? parts.join(' ') : '0 ft';
    };
    const descSuffix = isDimension
      ? `${fmtFtIn(hardwareCalcLengthFt, hardwareCalcLengthIn)} × ${fmtFtIn(hardwareCalcWidthFt, hardwareCalcWidthIn)} (${hardwareCalcQty} pcs)`
      : `${fmtFtIn(hardwareCalcLengthFt, hardwareCalcLengthIn)} (${hardwareCalcQty} pcs)`;

    const purchasePrice = hardwareCalcProduct.purchase_price_single || 0;
    const salePrice = hardwareCalcProduct.sale_price_single || 0;
    const stock = hardwareCalcProduct.current_stock;

    const existIdx = cart.findIndex(c => c.productId === hardwareCalcProduct.id && c.packingName === descSuffix);
    if (existIdx !== -1) {
      setCart(prev => prev.map((c, i) => i === existIdx ? { ...c, quantity: c.quantity + totalQty } : c));
    } else {
      setCart(prev => [...prev, {
        productId: hardwareCalcProduct.id,
        variantId: undefined,
        name: hardwareCalcProduct.name,
        packingName: descSuffix,
        purchasePrice,
        salePrice,
        quantity: totalQty,
        stock
      }]);
    }

    setHardwareCalcProduct(null);
  };

  const openImeiPurchaseModal = (item: CartItem, cartIndex: number) => {
    const prod = products.find(p => p.id === item.productId);
    if (!prod) return;
    setImeiPurchaseProduct(prod);
    const existing = item.imeis || [{ imei1: "", imei2: "" }];
    setImeiPurchaseInputs(existing);
    setImeiBulkText(
      item.imeis && item.imeis.length > 0
        ? item.imeis.map(i => (i.imei2 ? `${i.imei1}, ${i.imei2}` : i.imei1)).join("\n")
        : ""
    );
    setImeiEntryTab(item.imeis && item.imeis.length > 2 ? "bulk" : "rows");
    setRapidScanInput("");
    setIsImeiPurchaseModalOpen(true);
  };

  const handleParseBulkImeis = () => {
    if (!imeiBulkText.trim()) {
      toast.error("Please paste IMEIs into the box first.");
      return;
    }
    const lines = imeiBulkText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: Array<{ imei1: string; imei2?: string }> = [];

    lines.forEach(line => {
      const parts = line.split(/[,\t/ ]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        parsed.push({ imei1: parts[0], imei2: parts[1] });
      } else if (parts.length === 1) {
        parsed.push({ imei1: parts[0] });
      }
    });

    if (parsed.length === 0) {
      toast.error("Could not parse any valid IMEIs.");
      return;
    }

    setImeiPurchaseInputs(parsed);
    toast.success(`Successfully parsed ${parsed.length} device IMEI(s)! 🎉`);
  };

  const handleRapidScanAdd = (scannedVal: string) => {
    const val = scannedVal.trim();
    if (!val) return;
    setImeiPurchaseInputs(prev => {
      const cleanList = prev.filter(p => p.imei1.trim().length > 0);
      if (cleanList.some(i => i.imei1 === val || i.imei2 === val)) {
        toast.warning(`IMEI ${val} is already scanned in this list.`);
        return cleanList;
      }
      return [...cleanList, { imei1: val, imei2: "" }];
    });
    setRapidScanInput("");
  };

  const openPharmacyPurchaseModal = (item: CartItem, cartIndex: number) => {
    setPharmacyPurchaseCartIdx(cartIndex);
    setPharmacyInputs({
      bonusQty: item.bonusQty || 0,
      discount: item.discount || 0,
      batchNumber: item.batchNumber || "",
      expiryDate: item.expiryDate || "",
    });
    setIsPharmacyPurchaseModalOpen(true);
  };

  const handleConfirmImeiPurchase = () => {
    if (!imeiPurchaseProduct) return;

    // Validate that all rows have imei1 filled
    const invalidRowIndex = imeiPurchaseInputs.findIndex(input => !input.imei1.trim());
    if (invalidRowIndex !== -1) {
      toast.error(`Please enter IMEI 1 for device #${invalidRowIndex + 1}`);
      return;
    }

    // Validate uniqueness of IMEI 1 in the list
    const imei1s = imeiPurchaseInputs.map(input => input.imei1.trim());
    const hasDuplicates = imei1s.some((val, i) => imei1s.indexOf(val) !== i);
    if (hasDuplicates) {
      toast.error("Duplicate IMEI 1 numbers are not allowed in the same item.");
      return;
    }

    const qty = imeiPurchaseInputs.length;
    const purchasePrice = imeiPurchaseProduct.purchase_price_single || 0;
    const salePrice = imeiPurchaseProduct.sale_price_single || 0;

    const existIdx = cart.findIndex(c => c.productId === imeiPurchaseProduct.id && !c.variantId);
    if (existIdx !== -1) {
      setCart(prev => prev.map((c, i) => i === existIdx ? { 
        ...c, 
        quantity: qty, 
        imeis: imeiPurchaseInputs 
      } : c));
      toast.success(`Updated ${imeiPurchaseProduct.name} IMEIs (${qty} units)`);
    } else {
      setCart(prev => [...prev, {
        productId: imeiPurchaseProduct.id,
        variantId: undefined,
        name: imeiPurchaseProduct.name,
        purchasePrice,
        salePrice,
        quantity: qty,
        stock: imeiPurchaseProduct.current_stock,
        has_imei: true,
        imeis: imeiPurchaseInputs
      }]);
      toast.success(`Added ${imeiPurchaseProduct.name} (${qty} units) to cart`);
    }

    setIsImeiPurchaseModalOpen(false);
    setImeiPurchaseProduct(null);
    setImeiPurchaseInputs([]);
  };

  function addToCart(
    product: DBProduct,
    variantId?: string,
    variantName?: string,
    variantPrice?: number,
    variantSalePrice?: number,
    batchNumber?: string,
    expiryDate?: string
  ) {
    let finalVariantId = variantId;
    let finalVariantName = variantName;
    let finalPurchasePrice = variantPrice;
    let finalSalePrice = variantSalePrice;

    // By default for pharmacy/stock-in, if no specific variant clicked and product has packing variants, select the Pack variant!
    if (!finalVariantId && product.product_variants && product.product_variants.length > 0) {
      const firstVariant = product.product_variants[0];
      finalVariantId = firstVariant.id;
      finalVariantName = firstVariant.packing_name;
      finalPurchasePrice = firstVariant.purchase_price;
      finalSalePrice = firstVariant.sale_price;
    }

    if (product.has_imei) {
      const existIdx = cart.findIndex(c => c.productId === product.id && c.variantId === finalVariantId);
      if (existIdx !== -1) {
        openImeiPurchaseModal(cart[existIdx], existIdx);
      } else {
        setImeiPurchaseProduct(product);
        setImeiPurchaseInputs([{ imei1: "", imei2: "" }]);
        setIsImeiPurchaseModalOpen(true);
      }
      return;
    }

    if (industryType === "hardware" && (product.measurement_type === "dimension" || product.measurement_type === "length")) {
      if (!finalVariantId) {
        setHardwareCalcProduct(product);
        setHardwareCalcLengthFt(0);
        setHardwareCalcLengthIn(0);
        setHardwareCalcWidthFt(0);
        setHardwareCalcWidthIn(0);
        setHardwareCalcQty(1);
        return;
      }
    }

    const existIdx = cart.findIndex(c => c.productId === product.id && c.variantId === finalVariantId);
    if (existIdx !== -1) {
      setCart(prev => prev.map((c, i) => i === existIdx ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      const itemBatch = batchNumber || (product as any).batchNumber || (industryType === "pharmacy" ? "BATCH-01" : undefined);
      const itemExpiry = expiryDate || (product as any).expiryDate || undefined;
      setCart(prev => [...prev, {
        productId: product.id,
        variantId: finalVariantId,
        name: product.name,
        packingName: finalVariantName,
        purchasePrice: finalVariantId ? (finalPurchasePrice ?? product.purchase_price_single ?? 0) : (product.purchase_price_single || 0),
        salePrice: finalVariantId ? (finalSalePrice ?? 0) : (product.sale_price_single || 0),
        quantity: 1,
        stock: product.current_stock,
        batchNumber: itemBatch,
        expiryDate: itemExpiry,
      }]);
    }
  }

  function resetCart() {
    setCart([]); setSelectedSupplierId("walkin"); setDiscount(0); setTaxRate(0);
    setPaymentMode("cash"); setPaidNow(0); setInvoiceNumber(""); setNotes("");
    setIsCartFocused(false); setSelectedCartIdx(-1);
    setIsDraftRestored(false);
    setEditingPOId(null);
    setEditingPONumber(null);
    if (shopId) {
      try {
        localStorage.removeItem(`theaccounts_purchase_draft_${shopId}`);
      } catch (e) {}
    }
    if (accounts.length > 0) {
      const cashInHandAcc = accounts.find(a => a.name.toLowerCase() === "cash in hand");
      setSelectedAccountId(cashInHandAcc ? cashInHandAcc.id : accounts[0].id);
    }
  }

  function handleCancelEdit() {
    if (confirm("Are you sure you want to cancel editing this purchase bill? Any unsaved changes will be lost.")) {
      resetCart();
      toast.info("Purchase bill edit cancelled");
    }
  }

  const saveHeldPurchasesList = (list: HeldPurchase[]) => {
    setHeldPurchases(list);
    if (shopId) {
      try {
        localStorage.setItem(`theaccounts_held_purchases_${shopId}`, JSON.stringify(list));
      } catch (err) {}
    }
  };

  const handleHoldPurchase = () => {
    if (cart.length === 0) {
      toast.warning("Purchase grid is empty! Nothing to hold.");
      return;
    }
    const sup = suppliers.find(s => s.id === selectedSupplierId);
    const defaultTag = sup ? `${sup.name} (${cart.length} items)` : `Purchase Draft (${cart.length} items)`;
    const tag = prompt("Enter a label/note for this held purchase (optional):", defaultTag) || defaultTag;

    const newHeld: HeldPurchase = {
      id: Math.random().toString(36).substring(2, 9),
      tag,
      cart,
      selectedSupplierId,
      invoiceNumber,
      discount,
      discountType,
      taxRate,
      taxType,
      paymentMode,
      paidNow,
      notes,
      selectedAccountId,
      created_at: new Date().toISOString(),
      total
    };

    saveHeldPurchasesList([newHeld, ...heldPurchases]);
    resetCart();
    toast.success(`Purchase held as "${tag}" ⏸️`);
  };

  const handleResumePurchase = (held: HeldPurchase) => {
    if (cart.length > 0) {
      if (!confirm("Your current unsaved purchase grid will be replaced by the resumed draft. Continue?")) {
        return;
      }
    }
    setCart(held.cart || []);
    setSelectedSupplierId(held.selectedSupplierId || "walkin");
    setInvoiceNumber(held.invoiceNumber || "");
    setDiscount(held.discount || 0);
    setDiscountType(held.discountType || "flat");
    setTaxRate(held.taxRate || 0);
    setTaxType(held.taxType || "percentage");
    setPaymentMode(held.paymentMode || "cash");
    setPaidNow(held.paidNow || 0);
    setNotes(held.notes || "");
    if (held.selectedAccountId) setSelectedAccountId(held.selectedAccountId);

    saveHeldPurchasesList(heldPurchases.filter(h => h.id !== held.id));
    setIsHeldModalOpen(false);
    setIsDraftRestored(true);
    setDraftSavedTime(new Date(held.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    toast.success(`Resumed purchase: ${held.tag} ▶️`);
  };

  const handleDeleteHeldPurchase = (id: string) => {
    saveHeldPurchasesList(heldPurchases.filter(h => h.id !== id));
    toast.info("Held purchase draft deleted");
  };

  const handleAIImport = (parsed: {
    supplierName?: string;
    invoiceNumber?: string;
    items: Array<{
      productId: string;
      variantId?: string;
      name: string;
      packingName?: string;
      purchasePrice: number;
      salePrice: number;
      quantity: number;
      stock: number;
      batchNumber?: string;
      expiryDate?: string;
      bonusQty?: number;
      discount?: number;
    }>;
    taxRate?: number;
    discount?: number;
  }) => {
    setCart(prev => {
      const updated = [...prev];
      parsed.items.forEach(newItem => {
        const existIdx = updated.findIndex(
          c => c.productId === newItem.productId && 
               c.variantId === newItem.variantId &&
               c.batchNumber === newItem.batchNumber
        );
        if (existIdx !== -1) {
          updated[existIdx].quantity += newItem.quantity;
          updated[existIdx].purchasePrice = newItem.purchasePrice;
          if (newItem.bonusQty) updated[existIdx].bonusQty = (updated[existIdx].bonusQty || 0) + newItem.bonusQty;
          if (newItem.discount) updated[existIdx].discount = (updated[existIdx].discount || 0) + newItem.discount;
        } else {
          updated.push({
            productId: newItem.productId,
            variantId: newItem.variantId,
            name: newItem.name,
            packingName: newItem.packingName,
            purchasePrice: newItem.purchasePrice,
            salePrice: newItem.salePrice,
            quantity: newItem.quantity,
            stock: newItem.stock,
            batchNumber: newItem.batchNumber || "",
            expiryDate: newItem.expiryDate || "",
            bonusQty: newItem.bonusQty || 0,
            discount: newItem.discount || 0
          });
        }
      });
      return updated;
    });

    if (parsed.supplierName) {
      const sName = parsed.supplierName.toLowerCase();
      const match = suppliers.find(s => s.name.toLowerCase().includes(sName) || sName.includes(s.name.toLowerCase()));
      if (match) {
        setSelectedSupplierId(match.id);
      }
    }
    if (parsed.invoiceNumber) setInvoiceNumber(parsed.invoiceNumber);
    if (parsed.taxRate) setTaxRate(parsed.taxRate);
    if (parsed.discount) setDiscount(parsed.discount);
  };

  // ── Save / Update Purchase with Weighted Average Cost ──────────────────────
  async function handleSavePurchase() {
    if (activeClosingBook) {
      toast.error("Cannot perform purchases in a closed fiscal period!");
      return;
    }
    if (cart.length === 0) { toast.warning("Add at least one product!"); return; }
    if (!shopId) return;
    setIsSubmitting(true);
    try {
      const effectivePaid = paymentMode !== "credit" ? total : paidNow;
      const status = effectivePaid >= total ? "PAID" : effectivePaid > 0 ? "PARTIAL" : "CREDIT";

      const poId = editingPOId || crypto.randomUUID();
      const purchasePayload = {
        purchase_order_id: poId,
        shop_id: shopId,
        supplier_id: selectedSupplierId !== "walkin" ? selectedSupplierId : null,
        total_amount: total,
        paid_amount: effectivePaid,
        discount: calculatedDiscountAmount,
        tax_amount: calculatedTaxAmount,
        status,
        payment_mode: paymentMode,
        notes: notes.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        account_id: effectivePaid > 0 && selectedAccountId ? selectedAccountId : null,
        items: cart.map((item) => {
          const parentProd = products.find((p) => p.id === item.productId);
          const v = item.variantId
            ? parentProd?.product_variants?.find((x) => x.id === item.variantId)
            : undefined;
          const lineGross = item.purchasePrice * item.quantity;
          const lineDisc = item.discountType === "percentage" 
            ? (lineGross * (item.discount || 0)) / 100 
            : (item.discount || 0);
          return {
            product_id: item.productId,
            variant_id: item.variantId || null,
            quantity: item.quantity,
            bonus_quantity: item.bonusQty || 0,
            purchase_price: item.purchasePrice,
            sale_price: item.salePrice ?? null,
            discount_amount: lineDisc,
            batch_number: item.batchNumber || null,
            expiry_date: item.expiryDate || null,
            is_packing: !!v?.is_packing,
            pack_size: v?.pack_size ?? null,
            imeis: item.imeis || null,
          };
        }),
      };

      if (editingPOId) {
        // Atomic update of existing purchase order
        await updatePurchaseRpc(supabase, purchasePayload);

        logAudit(shopId, userId, "PURCHASE_ORDER_UPDATED", "purchase_orders", poId, {
          purchase_order_id: poId,
          total_amount: total,
          supplier_id: selectedSupplierId || "walkin",
          items_count: cart.length,
          via: "atomic_update_purchase_order",
        });
        toast.success("Purchase bill updated successfully! Stock & ledgers recalculated ✏️📦");
      } else {
        const saveResult = await executeOrQueue({
          shopId,
          action: "PURCHASE",
          tableName: "purchase_orders",
          payload: purchasePayload,
          label: `Purchase ${invoiceNumber.trim() || poId.slice(0, 8).toUpperCase()}`,
          online: async () =>
            receivePurchaseRpc(supabase, purchasePayload),
        });

        if (saveResult.queued) {
          toast.success("Purchase saved offline — will sync when online 📦");
          resetCart();
          setIsSubmitting(false);
          return;
        }

        const result = saveResult.result;

        logAudit(shopId, userId, "PURCHASE_ORDER_CREATED", "purchase_orders", result.purchase_order_id, {
          purchase_order_id: result.purchase_order_id,
          total_amount: total,
          supplier_id: selectedSupplierId || "walkin",
          items_count: cart.length,
          via: "receive_purchase_rpc",
        });
        toast.success("Purchase saved! Stock & weighted avg price updated 📦");
      }
      
      // Multi-tab broadcast event
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("theaccounts_inventory_channel");
          bc.postMessage({ type: "PURCHASE_SAVED", shopId });
          bc.close();
        } catch (e) {}
      }

      resetCart();
      await fetchBaseData();
      if (activeTab === "history") {
        await fetchHistory();
      }
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Edit PO ──
  async function handleEditPO(poId: string) {
    if (cart.length > 0 && !editingPOId) {
      if (!confirm("Loading this purchase bill for editing will replace the current items in the purchase grid. Continue?")) {
        return;
      }
    }
    try {
      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", poId)
        .single();

      if (poErr || !po) {
        toast.error("Failed to load purchase order: " + (poErr?.message || "Not found"));
        return;
      }

      if (po.is_voided) {
        toast.error("Cannot edit a voided purchase order!");
        return;
      }

      const { data: items, error: itemsErr } = await supabase
        .from("purchase_order_items")
        .select("*, products(id, name, unit, purchase_price_single, sale_price_single, current_stock, has_imei)")
        .eq("purchase_order_id", poId);

      if (itemsErr) {
        toast.error("Failed to load purchase items: " + itemsErr.message);
        return;
      }

      const populatedCart: CartItem[] = [];
      for (const it of (items || [])) {
        const prod = products.find(p => p.id === it.product_id) || it.products;
        let packingName: string | undefined = undefined;
        let vSalePrice: number | undefined = prod?.sale_price_single;

        if (it.variant_id) {
          const v = prod?.product_variants?.find((pv: any) => pv.id === it.variant_id);
          if (v) {
            packingName = v.packing_name;
            vSalePrice = v.sale_price;
          } else {
            const { data: vDb } = await supabase
              .from("product_variants")
              .select("packing_name, sale_price")
              .eq("id", it.variant_id)
              .maybeSingle();
            if (vDb) {
              packingName = vDb.packing_name;
              vSalePrice = vDb.sale_price;
            }
          }
        }

        populatedCart.push({
          productId: it.product_id,
          variantId: it.variant_id || undefined,
          name: prod?.name || "Product",
          packingName,
          purchasePrice: Number(it.unit_price) || 0,
          quantity: Number(it.quantity) || 1,
          stock: prod?.current_stock ?? 0,
          salePrice: vSalePrice,
          has_imei: !!prod?.has_imei,
          imeis: undefined,
          bonusQty: Number(it.bonus_quantity) || 0,
          discount: Number(it.discount_amount) || 0,
          discountType: "flat",
          batchNumber: it.batch_number || "",
          expiryDate: it.expiry_date || "",
        });
      }

      setEditingPOId(po.id);
      setEditingPONumber(po.invoice_number || po.id.slice(0, 8).toUpperCase());
      setSelectedSupplierId(po.supplier_id || "walkin");
      setInvoiceNumber(po.invoice_number || "");
      setNotes(po.notes || "");
      setPaymentMode((po.payment_mode as any) || "cash");
      setPaidNow(Number(po.paid_amount) || 0);
      setDiscount(Number(po.discount) || 0);
      setDiscountType("flat");
      setTaxRate(Number(po.tax_amount) || 0);
      setTaxType("flat");
      if (po.account_id) {
        setSelectedAccountId(po.account_id);
      }
      setCart(populatedCart);
      setIsDetailOpen(false);
      setActiveTab("new");
      toast.info(`Editing Purchase Bill #${po.invoice_number || po.id.slice(0, 8).toUpperCase()} ✏️`);
    } catch (err: any) {
      toast.error("Failed to load PO for editing: " + err.message);
    }
  }

  // ── View PO ──
  async function handleViewPO(poId: string) {
    setIsDetailOpen(true); setLoadingDetail(true);
    try {
      const [{ data: po }, { data: items }] = await Promise.all([
        supabase.from("purchase_orders").select("*").eq("id", poId).single(),
        supabase.from("purchase_order_items").select("*, products(name, unit)").eq("purchase_order_id", poId),
      ]);
      const sup = suppliers.find(s => s.id === po?.supplier_id);
      setSelectedPO({ ...po, supplierName: sup?.name || "Cash Purchase", supplierPhone: sup?.phone || "" });
      const populated: PODetailItem[] = [];
      for (const it of (items || [])) {
        let variantName = "";
        if (it.variant_id) {
          const { data: v } = await supabase.from("product_variants").select("packing_name").eq("id", it.variant_id).maybeSingle();
          variantName = v?.packing_name || "";
        }
        populated.push({ ...it, productName: it.products?.name || "Unknown", unit: it.products?.unit || "unit", variantName });
      }
      setSelectedPOItems(populated);
    } catch (err: any) { toast.error("Failed to load: " + err.message); }
    finally { setLoadingDetail(false); }
  }

  // ── Void PO ──
  async function handleVoidPO(poId: string) {
    if (!confirm("Void this purchase? Stock will be reversed.")) return;
    setVoidingId(poId);
    try {
      const { data: result, error: rpcErr } = await supabase.rpc("atomic_void_purchase_order", {
        p_po_id: poId,
        p_reason: "Voided by operator",
      });
      if (rpcErr) throw rpcErr;
      if (result?.status === "failed") {
        throw new Error(result.error || "Void RPC failed");
      }

      // ── Audit Log ─────────────────────────────────────────────────────────
      logAudit(
        shopId!,
        userId,
        "PURCHASE_ORDER_VOIDED",
        "purchase_orders",
        poId,
        {
          purchase_order_id: poId,
          via: "atomic_void_purchase_order"
        }
      );

      toast.success("Purchase voided & stock reversed!");
      setIsDetailOpen(false);
      fetchHistory();
      fetchBaseData();
    } catch (err: any) { toast.error("Void failed: " + err.message); }
    finally { setVoidingId(null); }
  }

  // ── PDF ──
  async function handleDownloadPDF(po: any, items: PODetailItem[]) {
    try {
      const { default: jsPDF }     = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFont("helvetica","bold");   doc.setFontSize(18); doc.setTextColor(30,41,59);
      doc.text(shopName || "THE ACCOUNTS", 15, 20);
      doc.setFont("helvetica","normal"); doc.setFontSize(9);  doc.setTextColor(100,116,139);
      doc.text("Purchase / Stock-In Bill", 15, 26);
      doc.setFont("helvetica","bold");   doc.setFontSize(12); doc.setTextColor(30,41,59);
      doc.text("PURCHASE RECEIPT", 130, 20);
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5);doc.setTextColor(71,85,105);
      doc.text(`PO #: ${po.id.slice(0,8).toUpperCase()}`, 130, 26);
      doc.text(`Date: ${new Date(po.created_at).toLocaleString()}`, 130, 31);
      if (po.invoice_number) doc.text(`Supplier Inv: ${po.invoice_number}`, 130, 36);
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.4); doc.line(15,40,195,40);
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(71,85,105);
      doc.text("SUPPLIER", 15, 47);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(30,41,59);
      doc.text(po.supplierName||"Cash Purchase", 15, 53);
      if (po.supplierPhone) doc.text(`Phone: ${po.supplierPhone}`, 15, 58);
      autoTable(doc, {
        head: [["#","Product / Batch","Variant/Unit","Qty","Purchase Price","Subtotal"]],
        body: items.map((it,i) => [
          i + 1,
          it.batch_number 
            ? `${it.productName}\nBatch: ${it.batch_number}${it.expiry_date ? ` · Exp: ${it.expiry_date}` : ""}`
            : it.productName,
          it.variantName || it.unit || "-",
          it.bonus_quantity ? `${it.quantity} (+${it.bonus_quantity} Free)` : it.quantity,
          `Rs ${Number(it.unit_price).toLocaleString()}`,
          `Rs ${Number(it.subtotal).toLocaleString()}`
        ]),
        startY: 65, theme: "striped",
        headStyles: { fillColor:[88,28,135], textColor:[255,255,255], fontSize:8.5, fontStyle:"bold" },
        bodyStyles: { fontSize:8, textColor:[51,65,85] },
        columnStyles: { 3:{halign:"right"}, 4:{halign:"right"}, 5:{halign:"right",fontStyle:"bold"} },
        margin: { left:15, right:15 },
      });
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(30,41,59);
      doc.text(`Total: Rs ${Number(po.total_amount).toLocaleString()}`, 130, finalY);
      doc.setFontSize(9); doc.setTextColor(5,150,105);
      doc.text(`Paid: Rs ${Number(po.paid_amount).toLocaleString()}`, 130, finalY+6);
      const bal = Number(po.total_amount)-Number(po.paid_amount);
      if (bal > 0) { doc.setTextColor(220,38,38); doc.text(`Outstanding: Rs ${bal.toLocaleString()}`, 130, finalY+12); }
      doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(148,163,184);
      doc.text("Powered by The Accounts POS", 15, 285);
      doc.save(`purchase_${po.id.slice(0,8)}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err: any) { toast.error("PDF failed: " + err.message); }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-0 font-sans text-slate-800">

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 mb-3 max-w-full overflow-hidden font-sans">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-2xs">
              <Truck className="h-4 w-4" />
            </span>
            Purchase / Stock-In
          </h1>
          <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1.5">
            Record purchases · weighted avg cost · supplier Khata · F10 for shortcuts
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-black border ${isLive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
              <span className={`w-1 h-1 rounded-full ${isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {isLive ? "LIVE" : "Connecting..."}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full">
          {/* Shortcuts hint button */}
          <button onClick={() => setIsShortcutsOpen(true)}
            className="flex items-center gap-1 px-2.5 h-8 bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-500 rounded-lg text-[10px] font-black transition-all border border-slate-200 shadow-2xs cursor-pointer">
            <Keyboard size={12} /> F10
          </button>
          {/* Pharmacy Short-Book & AI Auto-PO Reorder Trigger */}
          <button
            onClick={() => setIsAutoPOOpen(true)}
            className="flex items-center gap-1.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer h-8 shrink-0"
          >
            <Sparkles size={12} className="animate-pulse" />
            <span>{industryType === "pharmacy" ? "Short-Book" : "Auto-PO"}</span>
          </button>

          {/* AI Invoice Import Trigger */}
          <button 
            onClick={handleOpenAIModal}
            className="flex items-center gap-1.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer h-8 shrink-0"
          >
            <Sparkles size={12} className="animate-pulse" />
            <span>AI Import</span>
            {!isPremium && <Lock size={9} className="ml-0.5 text-indigo-200" />}
          </button>

          {/* Tab Switcher */}
          <div className="flex border border-slate-200 bg-white rounded-2xl p-1 shadow-sm gap-1 h-9 items-center shrink-0">
            {(["new", "history"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === tab ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/70 transition-colors"}`}>
                {tab === "new" ? <><Plus size={13} /> New Purchase</> : <><FileText size={13} /> History</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Showroom Industry Quick Switch Banner */}
      {industryType === "showroom" && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-violet-950 via-slate-900 to-indigo-950 border border-violet-700/50 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/30">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">Automotive Showroom Vehicle Sourcing Active (گاڑیوں کی خریداری)</p>
              <p className="text-xs text-slate-300">
                To purchase cars/motorcycles with Chassis, Engine No, CC, and Dealer/Seller details, use the dedicated Showroom Vehicle Master.
              </p>
            </div>
          </div>
          <Link href="/dashboard/showroom/vehicles">
            <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shrink-0 rounded-xl cursor-pointer">
              Go to Vehicle Sourcing Desk →
            </Button>
          </Link>
        </div>
      )}


      <AnimatePresence>
          {isPharmacyPurchaseModalOpen && pharmacyPurchaseCartIdx !== null && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Plus className="text-emerald-500" size={18} />
                    {industryType === "fertilizer" ? "Agri Item Details (Batch/Expiry)" : "Pharmacy Item Details"}
                  </h3>
                  <button onClick={() => setIsPharmacyPurchaseModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Batch Number *</label>
                      <Input
                        value={pharmacyInputs.batchNumber}
                        onChange={(e) => setPharmacyInputs({...pharmacyInputs, batchNumber: e.target.value})}
                        className="h-9 focus-visible:ring-emerald-500"
                        placeholder="e.g. BT-2024"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Expiry Date *</label>
                      <Input
                        type="date"
                        value={pharmacyInputs.expiryDate}
                        onChange={(e) => setPharmacyInputs({...pharmacyInputs, expiryDate: e.target.value})}
                        className="h-9 focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Bonus Quantity</label>
                      <Input
                        type="number"
                        min="0"
                        value={pharmacyInputs.bonusQty}
                        onChange={(e) => setPharmacyInputs({...pharmacyInputs, bonusQty: parseFloat(e.target.value) || 0})}
                        className="h-9 focus-visible:ring-emerald-500"
                        placeholder="0"
                      />
                      <p className="text-[10px] text-slate-400">Free items received</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Extra Discount (Rs)</label>
                      <Input
                        type="number"
                        min="0"
                        value={pharmacyInputs.discount}
                        onChange={(e) => setPharmacyInputs({...pharmacyInputs, discount: parseFloat(e.target.value) || 0})}
                        className="h-9 focus-visible:ring-emerald-500"
                        placeholder="0"
                      />
                      <p className="text-[10px] text-slate-400">Discount on this item</p>
                    </div>
                  </div>

                  {/* Live WAC Rate Preview */}
                  {pharmacyPurchaseCartIdx !== null && cart[pharmacyPurchaseCartIdx] && (() => {
                    const item = cart[pharmacyPurchaseCartIdx];
                    const q = item.quantity || 1;
                    const b = pharmacyInputs.bonusQty || 0;
                    const p = item.purchasePrice || 0;
                    const d = pharmacyInputs.discount || 0;
                    const netTotalCost = Math.max(0, (p * q) - d);
                    const totalUnitsReceived = q + b;
                    const effectiveAvgUnitCost = totalUnitsReceived > 0 ? (netTotalCost / totalUnitsReceived) : p;

                    return (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5 text-xs">
                        <div className="flex justify-between font-bold text-purple-900">
                          <span>Paid Qty: {q} | Bonus Free Qty: {b}</span>
                          <span className="font-extrabold">Total Stock Received: {totalUnitsReceived}</span>
                        </div>
                        <div className="flex justify-between items-center font-black text-purple-950 text-[11px] pt-1.5 border-t border-purple-200">
                          <span>Net Item Bill Cost: Rs {netTotalCost.toLocaleString()}</span>
                          <span className="bg-purple-600 text-white px-2 py-0.5 rounded-md text-[10.5px]">
                            Avg Rate: Rs {effectiveAvgUnitCost.toFixed(2)} / unit
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                  <Button variant="ghost" onClick={() => setIsPharmacyPurchaseModalOpen(false)}>Cancel</Button>
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      if (!pharmacyInputs.batchNumber.trim() || !pharmacyInputs.expiryDate) {
                        toast.error("Batch Number and Expiry Date are required.");
                        return;
                      }
                      setCart(prev => prev.map((c, i) => i === pharmacyPurchaseCartIdx ? { ...c, ...pharmacyInputs } : c));
                      setIsPharmacyPurchaseModalOpen(false);
                      toast.success("Pharmacy details added");
                    }}
                  >
                    Save Details
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── Tab: New Purchase ── */}
        {activeTab === "new" && (
          <motion.div key="new" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.2 }}
            className="flex flex-col gap-3.5 min-h-0 relative pb-20 md:pb-24">

            {/* Top Workspace: Full Width Search & Excel Spreadsheet Grid */}
            <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-4 overflow-hidden flex flex-col relative min-h-[460px]">
              
              {/* Autocomplete Search Bar & Quick Controls Header */}
              <div className="relative mb-3 flex-shrink-0 flex flex-col md:flex-row gap-2.5 items-center justify-between">
                <div className="relative flex-1 w-full">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <Input 
                        id="purchase-search-input"
                        placeholder={
                          isElectronics 
                            ? "Search product by name, barcode or IMEI/Serial... (F1, Arrows to nav, Enter to select)" 
                            : isPharmacyOrAgri 
                              ? "Search product by name, barcode or generic formula... (F1, Arrows to nav, Enter to select)" 
                              : "Search product by name, barcode or SKU... (F1, Arrows to nav, Enter to select)"
                        } 
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setIsSearchDropdownOpen(true);
                          setSelectedSearchProductIndex(0);
                        }}
                        onFocus={() => {
                          setIsSearchDropdownOpen(true);
                          setSelectedSearchProductIndex(0);
                        }}
                        className="pl-11 pr-10 h-11 bg-slate-50 border-slate-200 text-slate-800 text-sm rounded-2xl focus-visible:ring-violet-500/20 font-medium"
                        autoFocus
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => {
                            setSearchQuery("");
                            setIsSearchDropdownOpen(false);
                          }} 
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Quick Add Product Button */}
                    <Button
                      type="button"
                      onClick={() => {
                        setQuickAddInitialName(searchQuery);
                        setIsQuickAddProductOpen(true);
                      }}
                      className="h-11 px-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                      title="Quickly add new product / medicine to catalog & purchase cart"
                    >
                      <Plus size={15} />
                      <span className="hidden sm:inline">+ Add Item</span>
                    </Button>
                  </div>

                  {/* Autocomplete Floating Dropdown */}
                  {isSearchDropdownOpen && searchQuery.trim() !== "" && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsSearchDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1.5 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-40 max-h-[340px] overflow-y-auto custom-scrollbar p-2">
                        {autocompleteResults.length === 0 ? (
                          <div className="py-6 px-4 text-center space-y-2.5">
                            <div className="text-xs text-zinc-300 font-bold">
                              No products found matching &quot;{searchQuery}&quot;.
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              Create this product right now and add it to your purchase invoice.
                            </p>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSearchDropdownOpen(false);
                                  setQuickAddInitialName(searchQuery);
                                  setIsQuickAddProductOpen(true);
                                }}
                                className="h-8.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <Plus size={14} />
                                <span>+ Add &quot;{searchQuery}&quot; as New Item</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-2.5 py-1 mb-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] text-zinc-400">
                              <span className="font-bold">Found {autocompleteResults.length} matching items</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSearchDropdownOpen(false);
                                  setQuickAddInitialName(searchQuery);
                                  setIsQuickAddProductOpen(true);
                                }}
                                className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-0.5 cursor-pointer bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700"
                              >
                                <Plus size={11} />
                                <span>+ Add &quot;{searchQuery.slice(0, 15)}&quot;</span>
                              </button>
                            </div>
                            {autocompleteResults.map((product, pIdx) => {
                            const isHighlighted = selectedSearchProductIndex === pIdx;
                            const options = getProductUnitOptions(product);
                            return (
                              <div
                                key={product.id}
                                onClick={() => {
                                  addToCart(product);
                                  setSearchQuery("");
                                  setIsSearchDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                                  isHighlighted 
                                    ? "bg-violet-600/90 border-violet-500/30 text-white" 
                                    : "hover:bg-zinc-900 border-transparent text-zinc-300"
                                }`}
                              >
                                <div className="flex-1 min-w-0 pr-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-xs truncate text-white">
                                      {product.name}
                                    </span>
                                    {product.code && (
                                      <span className={`text-[9px] font-mono tracking-wider ${isHighlighted ? "text-violet-200" : "text-zinc-500"}`}>
                                        {product.code}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className={`text-[9.5px] font-bold ${isHighlighted ? "text-violet-200" : "text-zinc-400"}`}>
                                      Stock: {product.current_stock} {product.unit || "unit"}
                                    </span>
                                    <span className={`text-[9.5px] font-bold ${isHighlighted ? "text-violet-200" : "text-violet-400"}`}>
                                      Cost: Rs {product.purchase_price_single}
                                    </span>
                                  </div>
                                </div>

                                {/* Quick packings pills */}
                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => {
                                      addToCart(product);
                                      setSearchQuery("");
                                      setIsSearchDropdownOpen(false);
                                    }}
                                    className={`text-[9px] font-black px-2 py-1 rounded border transition-all ${
                                      isHighlighted 
                                        ? "bg-zinc-900 border-zinc-800 text-white hover:bg-white hover:text-black" 
                                        : "bg-zinc-900 border-zinc-850 text-zinc-350 hover:bg-violet-650 hover:text-white"
                                    }`}
                                  >
                                    {product.unit || "Base"}
                                  </button>
                                  {options.map(opt => (
                                    <button
                                      key={opt.id}
                                      onClick={() => {
                                        addToCart(product, opt.id, opt.name, opt.purchasePrice);
                                        setSearchQuery("");
                                        setIsSearchDropdownOpen(false);
                                      }}
                                      className={`text-[9px] font-black px-2 py-1 rounded border transition-all ${
                                        isHighlighted
                                          ? "bg-violet-700 border-violet-600 text-white hover:bg-white hover:text-black"
                                          : "bg-violet-950/40 border-violet-900/30 text-violet-400 hover:bg-violet-650 hover:text-white"
                                      }`}
                                    >
                                      {opt.name}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openEditPackingModal(product);
                                      setIsSearchDropdownOpen(false);
                                    }}
                                    className="text-[9px] font-black px-1.5 py-1 rounded border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-600 hover:text-white transition-all flex items-center gap-0.5"
                                    title="Edit or Add Packing / Pack Size in Product Directory"
                                  >
                                    <span>⚙️ Packing</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Info & Action Badges */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {/* Open POS in New Tab Quick Action */}
                  <a
                    href="/dashboard/pos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-xl border border-emerald-200 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Open Retail POS in a new tab for instant customer billing without closing this purchase"
                  >
                    <ExternalLink size={12} />
                    <span>Open POS (2nd Tab)</span>
                  </a>

                  {/* Hold Bill Button */}
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleHoldPurchase}
                      className="text-[11px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-xl border border-amber-200 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Hold / Park this purchase order (F6)"
                    >
                      <Pause size={12} />
                      <span>Hold (F6)</span>
                    </button>
                  )}

                  {/* Parked / Held Purchases Dropdown/Modal Trigger */}
                  {heldPurchases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsHeldModalOpen(true)}
                      className="text-[11px] font-black text-violet-700 bg-violet-100 hover:bg-violet-200 px-2.5 py-1.5 rounded-xl border border-violet-300 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer animate-pulse"
                      title="View and resume held purchase bills"
                    >
                      <Play size={11} className="fill-current" />
                      <span>Held ({heldPurchases.length})</span>
                    </button>
                  )}

                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-1">
                    <ShoppingCart size={13} className="text-violet-600" />
                    Items: <strong className="text-slate-900 font-mono">{cart.length}</strong>
                  </span>
                  {cart.length > 0 && (
                    <button 
                      onClick={resetCart} 
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1.5 rounded-xl border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Cart Table List — Professional Excel Grid View */}
              <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white custom-scrollbar min-h-0 shadow-inner">
                {/* Active Edit Mode Banner */}
                {editingPOId && (
                  <div className="m-2 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-orange-500/10 border border-amber-300 rounded-xl p-2.5 px-3 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className="font-black text-amber-950 flex items-center gap-1.5">
                        <Edit3 size={14} className="text-amber-600" />
                        Editing Purchase Bill #{editingPONumber}
                      </span>
                      <span className="text-amber-700 font-medium text-[11px] hidden sm:inline">
                        (Mistakes can be corrected; changes will recalculate stock & ledger)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-300/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <X size={12} /> Cancel Edit
                      </button>
                    </div>
                  </div>
                )}

                {/* Auto-Recovered Active Draft Banner */}
                {isDraftRestored && cart.length > 0 && (
                  <div className="m-2 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-2 px-3 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-violet-600 animate-ping" />
                      <span className="font-bold text-violet-900">
                        ⚡ Active Purchase Draft Auto-Recovered
                      </span>
                      <span className="text-violet-600 font-medium text-[11px] hidden sm:inline">
                        ({cart.length} items{draftSavedTime ? ` · Last active ${draftSavedTime}` : ""})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsDraftRestored(false)}
                        className="px-2 py-0.5 text-[11px] font-bold text-violet-700 hover:bg-violet-200/60 rounded-md transition-colors cursor-pointer"
                      >
                        Keep Working
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetCart();
                          setIsDraftRestored(false);
                        }}
                        className="px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                    <ShoppingCart size={40} className="text-slate-200 mb-3" />
                    <p className="text-sm font-extrabold text-slate-700">Purchase grid is empty</p>
                    <p className="text-xs text-slate-450 mt-1">Search products above or scan barcodes to populate Excel stock-in spreadsheet.</p>
                  </div>
                ) : (
                  <>
                  <PurchaseCartMobile
                    cart={cart}
                    onUpdateQty={(idx, qty) =>
                      setCart((prev) =>
                        prev.map((c, i) => (i === idx ? { ...c, quantity: qty } : c))
                      )
                    }
                    onRemove={(idx) => setCart((prev) => prev.filter((_, i) => i !== idx))}
                  />
                  <div className="hidden md:block w-full overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs font-sans">
                      <thead>
                        <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider sticky top-0 z-10 shadow-2xs">
                          <th className="py-2.5 px-2 w-[35px] text-center border-r border-slate-200">#</th>
                          <th className="py-2.5 px-3 min-w-[180px] border-r border-slate-200">Product Name & Variant</th>
                          {isPharmacyOrAgri && <th className="py-2.5 px-2 w-[100px] border-r border-slate-200">Batch #</th>}
                          {isPharmacyOrAgri && <th className="py-2.5 px-2 w-[115px] border-r border-slate-200">Expiry Date</th>}
                          <th className="py-2.5 px-2 w-[95px] text-center border-r border-slate-200">{isPharmacyOrAgri ? "Qty (Packs)" : "Qty"}</th>
                          {isPharmacyOrAgri && <th className="py-2.5 px-2 w-[85px] text-center border-r border-slate-200">Bonus (Free)</th>}
                          <th className="py-2.5 px-2 w-[100px] text-right border-r border-slate-200">Trade Cost (Rs)</th>
                          <th className="py-2.5 px-2 w-[105px] text-center border-r border-slate-200">Extra Disc</th>
                          <th className="py-2.5 px-2 w-[95px] text-center border-r border-slate-200 text-blue-700">Tax</th>
                          <th className="py-2.5 px-2 w-[100px] text-right border-r border-slate-200">Sale Retail (Rs)</th>
                          <th className="py-2.5 px-2 w-[85px] text-right border-r border-slate-200">Eff. Cost</th>
                          <th className="py-2.5 px-2 w-[80px] text-center border-r border-slate-200 text-purple-700">Profit %</th>
                          <th className="py-2.5 px-2.5 w-[105px] text-right border-r border-slate-200">Net Total (Rs)</th>
                          <th className="py-2.5 px-2 w-[40px] text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {cart.map((item, idx) => {
                          const isItemHighlighted = isCartFocused && selectedCartIdx === idx;
                          const q = item.quantity || 1;
                          const b = item.bonusQty || 0;
                          const p = item.purchasePrice || 0;
                          const dVal = item.discount || 0;
                          const lineTradeCost = p * q;
                          const d = item.discountType === "percentage" ? (lineTradeCost * dVal) / 100 : dVal;
                          const netBeforeTax = Math.max(0, lineTradeCost - d);
                          const taxVal = item.taxPercent || 0;
                          const lineTax = item.taxType === "flat" ? taxVal : netBeforeTax * (taxVal / 100);
                          const totalCost = netBeforeTax + lineTax;
                          const totalReceived = q + b;
                          const effRate = totalReceived > 0 ? (totalCost / totalReceived) : p;

                          const s = item.salePrice || 0;
                          const marginPct = effRate > 0 ? Math.round(((s - effRate) / effRate) * 100) : 0;

                          return (
                            <tr 
                              key={`${item.productId}-${item.variantId || "base"}-${idx}`}
                              className={`transition-all border-b border-slate-100 ${
                                isItemHighlighted ? "bg-violet-50/60" : "hover:bg-slate-50/80"
                              }`}
                            >
                              {/* SR # */}
                              <td className="py-2 px-2 text-center text-[10px] font-black text-slate-400 border-r border-slate-100 bg-slate-50/40">
                                {idx + 1}
                              </td>

                              {/* Product Name & Variant Dropdown */}
                              <td className="py-2 px-3 border-r border-slate-100">
                                <div className="font-extrabold text-slate-900 text-[11.5px] leading-tight truncate max-w-[240px]" title={item.name}>
                                  {item.name}
                                </div>
                                
                                {/* IMEI / Serial badge for electronics */}
                                {item.has_imei && (
                                  <button
                                    type="button"
                                    onClick={() => openImeiPurchaseModal(item, idx)}
                                    className="mt-1 flex items-center gap-1 text-[9.5px] font-extrabold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md px-2 py-0.5 transition-colors cursor-pointer"
                                  >
                                    <Smartphone size={10} />
                                    <span>IMEI / Serial ({item.imeis?.length || 0} entered)</span>
                                  </button>
                                )}

                                {(() => {
                                  const parentProd = products.find(prod => prod.id === item.productId);
                                  return (
                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      {parentProd && parentProd.product_variants && parentProd.product_variants.length > 0 ? (
                                        <select
                                          value={item.variantId || "base"}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "base") {
                                              setCart(prev => prev.map((c, i) => i === idx ? {
                                                ...c,
                                                variantId: undefined,
                                                packingName: undefined,
                                                purchasePrice: parentProd.purchase_price_single || 0,
                                                salePrice: parentProd.sale_price_single || 0
                                              } : c));
                                            } else {
                                              const opt = parentProd.product_variants?.find((v: any) => v.id === val);
                                              if (opt) {
                                                setCart(prev => prev.map((c, i) => i === idx ? {
                                                  ...c,
                                                  variantId: opt.id,
                                                  packingName: opt.packing_name,
                                                  purchasePrice: opt.purchase_price || 0,
                                                  salePrice: opt.sale_price || 0
                                                } : c));
                                              }
                                            }
                                          }}
                                          className="text-[9.5px] bg-violet-50 border border-violet-200 rounded-md px-1.5 py-0.5 text-violet-900 font-extrabold focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer shadow-2xs max-w-[130px] truncate"
                                        >
                                          <option value="base">Base ({parentProd.unit || "unit"}) - Rs {parentProd.purchase_price_single}</option>
                                          {parentProd.product_variants.map((v: any) => (
                                            <option key={v.id} value={v.id}>{v.packing_name} - Rs {v.purchase_price}</option>
                                          ))}
                                        </select>
                                      ) : item.packingName ? (
                                        <span className="inline-block bg-violet-50 text-violet-800 text-[8.5px] font-extrabold px-1.5 py-0.5 rounded border border-violet-200 uppercase tracking-wide">
                                          {item.packingName}
                                        </span>
                                      ) : null}

                                      {/* Quick Edit Packing Button in Cart */}
                                      {parentProd && (
                                        <button
                                          type="button"
                                          onClick={() => openEditPackingModal(parentProd, idx)}
                                          className="text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors flex items-center gap-0.5 cursor-pointer shadow-2xs"
                                          title="Edit or Fix Packing, Pack Size & Prices for this Product"
                                        >
                                          <span>⚙️ Packing</span>
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* Batch # Input */}
                              {isPharmacyOrAgri && (
                                <td className="py-2 px-2 border-r border-slate-100">
                                  <input
                                    type="text"
                                    placeholder="Batch #"
                                    value={item.batchNumber || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, batchNumber: val } : c));
                                    }}
                                    className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-[10.5px] focus:outline-none focus:ring-2 focus:ring-violet-400/30 text-slate-800 shadow-2xs"
                                  />
                                </td>
                              )}

                              {/* Expiry Date Input */}
                              {isPharmacyOrAgri && (
                                <td className="py-2 px-2 border-r border-slate-100">
                                  <input
                                    type="date"
                                    value={item.expiryDate || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, expiryDate: val } : c));
                                    }}
                                    className="w-full h-8 px-1.5 bg-white border border-slate-200 rounded-lg font-mono text-[10px] focus:outline-none focus:ring-2 focus:ring-violet-400/30 text-slate-800 shadow-2xs"
                                  />
                                </td>
                              )}

                              {/* Quantity Controls */}
                              <td className="py-2 px-2 text-center border-r border-slate-100">
                                <div className="flex items-center justify-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      if (item.has_imei) { openImeiPurchaseModal(item, idx); return; }
                                      const newQty = Math.max(1, item.quantity - 1);
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, quantity: newQty } : c));
                                    }}
                                    className="p-1 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                                  >
                                    <Minus size={9.5} />
                                  </button>
                                  <input 
                                    id={`purchase-qty-${idx}`}
                                    type="number"
                                    value={item.quantity}
                                    readOnly={item.has_imei}
                                    onChange={(e) => {
                                      if (item.has_imei) return;
                                      const val = parseInt(e.target.value, 10);
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, quantity: isNaN(val) || val < 1 ? 1 : val } : c));
                                    }}
                                    onFocus={(e) => {
                                      if (item.has_imei) { e.target.blur(); openImeiPurchaseModal(item, idx); return; }
                                      e.target.select();
                                      setIsCartFocused(true);
                                      setSelectedCartIdx(idx);
                                    }}
                                    className="no-spin w-9 text-[11px] font-black text-center border-none focus:outline-none bg-transparent"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      if (item.has_imei) { openImeiPurchaseModal(item, idx); return; }
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, quantity: c.quantity + 1 } : c));
                                    }}
                                    className="p-1 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                                  >
                                    <Plus size={9.5} />
                                  </button>
                                </div>
                              </td>

                              {/* Bonus Qty Input */}
                              {isPharmacyOrAgri && (
                                <td className="py-2 px-2 border-r border-slate-100">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={item.bonusQty || ""}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, bonusQty: val } : c));
                                    }}
                                    className="w-full h-8 px-2 bg-purple-50/60 border border-purple-200 text-purple-900 font-bold rounded-lg text-center text-[11px] focus:outline-none focus:ring-2 focus:ring-purple-400/40 shadow-2xs"
                                  />
                                </td>
                              )}

                              {/* Trade Cost (Rs) */}
                              <td className="py-2 px-2 border-r border-slate-100">
                                <input
                                  id={`purchase-rate-${idx}`}
                                  type="number"
                                  step="any"
                                  value={item.purchasePrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setCart(prev => prev.map((c, i) => i === idx ? { ...c, purchasePrice: isNaN(val) ? 0 : Math.max(0, val) } : c));
                                  }}
                                  onFocus={(e) => {
                                    e.target.select();
                                    setIsCartFocused(true);
                                    setSelectedCartIdx(idx);
                                  }}
                                  className="no-spin w-full h-8 bg-white border-2 border-violet-200 rounded-lg px-2 text-[11.5px] font-extrabold focus:outline-none focus:border-violet-500 text-slate-900 text-right shadow-2xs"
                                  placeholder="0"
                                />
                              </td>

                              {/* Extra Disc Input + %/Rs Toggle */}
                              <td className="py-2 px-1.5 border-r border-slate-100">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={item.discount || ""}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, discount: val } : c));
                                    }}
                                    className="w-full h-8 px-1.5 bg-emerald-50/60 border border-emerald-200 text-emerald-950 font-bold rounded-lg text-right text-[11px] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 shadow-2xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = item.discountType === "percentage" ? "flat" : "percentage";
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, discountType: next } : c));
                                    }}
                                    className={`h-8 px-1.5 rounded-lg border text-[9px] font-black cursor-pointer transition-all shrink-0 ${
                                      item.discountType === "percentage"
                                        ? "bg-rose-50 border-rose-200 text-rose-700 font-bold"
                                        : "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                                    }`}
                                    title="Toggle discount between % and Flat Rs"
                                  >
                                    {item.discountType === "percentage" ? "%" : "Rs"}
                                  </button>
                                </div>
                              </td>

                              {/* Tax Input + %/Rs Toggle */}
                              <td className="py-2 px-1.5 border-r border-slate-100">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={item.taxPercent || ""}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, taxPercent: val } : c));
                                    }}
                                    className="w-full h-8 px-1.5 bg-blue-50/60 border border-blue-200 text-blue-950 font-bold rounded-lg text-center text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-400/40 shadow-2xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = item.taxType === "flat" ? "percentage" : "flat";
                                      setCart(prev => prev.map((c, i) => i === idx ? { ...c, taxType: next } : c));
                                    }}
                                    className={`h-8 px-1.5 rounded-lg border text-[9px] font-black cursor-pointer transition-all shrink-0 ${
                                      item.taxType === "flat"
                                        ? "bg-amber-50 border-amber-200 text-amber-800 font-bold"
                                        : "bg-blue-50 border-blue-200 text-blue-700 font-bold"
                                    }`}
                                    title="Toggle tax between % and Flat Rs"
                                  >
                                    {item.taxType === "flat" ? "Rs" : "%"}
                                  </button>
                                </div>
                              </td>

                              {/* Sale Retail (Rs) */}
                              <td className="py-2 px-2 border-r border-slate-100">
                                <input
                                  id={`purchase-salerate-${idx}`}
                                  type="number"
                                  step="any"
                                  value={item.salePrice || 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setCart(prev => prev.map((c, i) => i === idx ? { ...c, salePrice: isNaN(val) ? 0 : Math.max(0, val) } : c));
                                  }}
                                  onFocus={(e) => {
                                    e.target.select();
                                    setIsCartFocused(true);
                                    setSelectedCartIdx(idx);
                                  }}
                                  className="no-spin w-full h-8 bg-white border-2 border-emerald-250 rounded-lg px-2 text-[11.5px] font-extrabold focus:outline-none focus:border-emerald-500 text-slate-900 text-right shadow-2xs"
                                  placeholder="0"
                                />
                              </td>

                              {/* Eff. Cost Badge */}
                              <td className="py-2 px-2 text-right border-r border-slate-100">
                                <span className="text-[10px] font-extrabold text-slate-700 font-mono">
                                  Rs {effRate.toFixed(2)}
                                </span>
                              </td>

                              {/* Profit Margin % Editable Input */}
                              <td className="py-2 px-2 text-center border-r border-slate-100">
                                <input
                                  type="number"
                                  value={marginPct}
                                  onChange={(e) => {
                                    const newMargin = parseFloat(e.target.value) || 0;
                                    const newSalePrice = Math.round(effRate * (1 + newMargin / 100));
                                    setCart(prev => prev.map((c, i) => i === idx ? { ...c, salePrice: newSalePrice } : c));
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="w-full h-8 px-1 bg-purple-50/60 border border-purple-200 text-purple-900 font-extrabold rounded-lg text-center text-[11px] focus:outline-none focus:ring-2 focus:ring-purple-400/40 shadow-2xs"
                                />
                              </td>

                              {/* Line Subtotal */}
                              <td className="py-2 px-3 text-right font-black text-slate-900 text-[11.5px] border-r border-slate-100">
                                Rs {Math.round(totalCost).toLocaleString()}
                              </td>

                              {/* Line Subtotal */}
                              <td className="py-2 px-3 text-right font-black text-slate-900 text-[11.5px] border-r border-slate-100">
                                Rs {Math.round(totalCost).toLocaleString()}
                              </td>

                              {/* Delete Item */}
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCart(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  title="Delete Item"
                                >
                                  <Trash2 size={13} />
                                </button>
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

            {/* ── STICKY FOOTER CHECKOUT PANEL (CONTAINER-RELATIVE & RESPONSIVE) ── */}
            {cart.length > 0 && (
              <div className="sticky bottom-3 z-30 bg-white/98 backdrop-blur-md border border-slate-250 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.12)] rounded-2xl p-2.5 px-3 text-slate-800 flex flex-wrap xl:flex-nowrap gap-2 items-center justify-between transition-all mt-3 max-w-full overflow-visible">
                
                {/* Section 1: Supplier & Invoice Ref */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto min-w-[240px] max-w-full">
                  <div className="flex-1 min-w-0">
                    <SupplierSelector
                      suppliers={suppliers}
                      selectedSupplierId={selectedSupplierId}
                      onSelect={setSelectedSupplierId}
                      onAddNew={() => setIsAddSupplierOpen(true)}
                      compact={true}
                    />
                  </div>
                  <div className="w-20 shrink-0">
                    <label className="text-[8.5px] font-black text-slate-400 uppercase block mb-0.5">Inv #</label>
                    <input 
                      placeholder="Inv #" 
                      value={invoiceNumber} 
                      onChange={e => setInvoiceNumber(e.target.value)}
                      className="w-full text-xs font-semibold h-8 bg-slate-50 border border-slate-200 rounded-xl px-2 focus:outline-none focus:ring-2 focus:ring-violet-400/20" 
                    />
                  </div>
                </div>

                {/* Section 2: Summary Stats & Totals */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 border border-slate-200/80 rounded-xl px-2.5 py-1.5 shrink-0 max-w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Discount (% / Rs) */}
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[8.5px] font-black text-slate-400 uppercase block">Discount</label>
                        <button
                          type="button"
                          onClick={() => setDiscountType(prev => prev === "percentage" ? "flat" : "percentage")}
                          className={`text-[8px] font-black px-1.5 py-0.2 rounded transition-all cursor-pointer ${
                            discountType === "percentage"
                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}
                          title="Click to toggle Discount between % and Rs"
                        >
                          {discountType === "percentage" ? "%" : "Rs"}
                        </button>
                      </div>
                      <div className="relative mt-0.5">
                        <input 
                          id="purchase-discount-input"
                          type="number" 
                          placeholder="0"
                          value={discount || ""} 
                          onChange={e => setDiscount(Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          className="w-20 text-xs font-extrabold h-7 bg-white border border-slate-200 rounded-lg pl-1.5 pr-6 focus:outline-none focus:ring-1 focus:ring-violet-500" 
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 pointer-events-none">
                          {discountType === "percentage" ? "%" : "Rs"}
                        </span>
                      </div>
                    </div>

                    {/* Tax (% / Rs) */}
                    {hasTax && (
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <label className="text-[8.5px] font-black text-slate-400 uppercase block">Tax</label>
                          <button
                            type="button"
                            onClick={() => setTaxType(prev => prev === "percentage" ? "flat" : "percentage")}
                            className={`text-[8px] font-black px-1.5 py-0.2 rounded transition-all cursor-pointer ${
                              taxType === "percentage"
                                ? "bg-blue-100 text-blue-700 border border-blue-200"
                                : "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}
                            title="Click to toggle Tax between % and Rs"
                          >
                            {taxType === "percentage" ? "%" : "Rs"}
                          </button>
                        </div>
                        <div className="relative mt-0.5">
                          <input 
                            id="purchase-tax-input"
                            type="number" 
                            placeholder="0"
                            value={taxRate || ""} 
                            onChange={e => setTaxRate(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            className="w-18 text-xs font-extrabold h-7 bg-white border border-slate-200 rounded-lg pl-1.5 pr-6 focus:outline-none focus:ring-1 focus:ring-violet-500" 
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 pointer-events-none">
                            {taxType === "percentage" ? "%" : "Rs"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

                    {/* Quick Stats Pill */}
                    <div className="text-[10.5px] space-y-0.5">
                      <div className="text-slate-500">Gross: <strong className="text-slate-800 font-mono">Rs {Math.round(subtotal).toLocaleString()}</strong></div>
                      {totalBonusQty > 0 && <div className="text-purple-700 font-bold text-[9.5px]">🎁 +{totalBonusQty} Free Stock</div>}
                    </div>
                  </div>

                  {/* NET TOTAL BADGE */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-3 py-1 rounded-xl shadow-sm flex flex-col items-end">
                      <span className="text-[8px] font-black text-violet-200 uppercase tracking-wider">NET PAYABLE</span>
                      <span className="text-sm font-black font-mono leading-none">Rs {Math.round(total).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Payment Mode, Account & Submit Button */}
                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 max-w-full">
                  {/* Payment Mode Pills */}
                  <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    {(["cash", "bank", "credit"] as const).map(mode => (
                      <button 
                        key={mode} 
                        type="button" 
                        onClick={() => setPaymentMode(mode)}
                        className={`px-2 py-1 rounded-lg text-[9.5px] font-black transition-all border flex items-center gap-1 ${
                          paymentMode === mode
                            ? (mode === "cash" ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                              : mode === "bank" ? "bg-blue-500 text-white border-blue-500 shadow-xs"
                              : "bg-rose-500 text-white border-rose-500 shadow-xs")
                            : "text-slate-600 border-transparent hover:bg-slate-200/60"
                        }`}
                      >
                        {mode === "cash" ? <Banknote size={9.5} /> : mode === "bank" ? <CreditCard size={9.5} /> : <ReceiptText size={9.5} />}
                        {mode === "cash" ? "Cash" : mode === "bank" ? "Bank" : "Credit"}
                      </button>
                    ))}
                  </div>

                  {/* Account Selector (Paid from) */}
                  {(paymentMode !== "credit" || paidNow > 0) && accounts.length > 0 && (
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 h-8 shadow-2xs">
                      <span className="text-[8.5px] font-black text-slate-400 uppercase whitespace-nowrap">Account:</span>
                      <select
                        value={selectedAccountId}
                        onChange={e => setSelectedAccountId(e.target.value)}
                        className="text-[11px] font-bold bg-transparent text-slate-800 focus:outline-none cursor-pointer max-w-[130px] truncate"
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (Rs {Number(acc.current_balance).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Credit partial payment input */}
                  {paymentMode === "credit" && (
                    <input 
                      type="number" 
                      placeholder="Paid Now"
                      value={paidNow || ""} 
                      onChange={e => setPaidNow(Number(e.target.value))}
                      className="w-16 text-xs font-bold h-8 bg-rose-50 border border-rose-300 rounded-xl px-1.5 focus:outline-none text-rose-900" 
                    />
                  )}

                  {/* Primary Save Button */}
                  <button 
                    type="button"
                    onClick={handleSavePurchase} 
                    disabled={isSubmitting || !!activeClosingBook}
                    className={`h-9 px-3.5 ${
                      editingPOId 
                        ? "bg-gradient-to-r from-amber-600 to-orange-600 shadow-amber-500/20 hover:from-amber-700 hover:to-orange-700" 
                        : "bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-500/20 hover:from-violet-700 hover:to-purple-700"
                    } text-white font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed text-xs shrink-0 whitespace-nowrap`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                    ) : (
                      <Save size={13} />
                    )}
                    {isSubmitting 
                      ? (editingPOId ? "Updating Bill..." : "Saving...") 
                      : (editingPOId ? "Update Purchase Bill (F10) ✏️" : "Save Purchase (F10)")}
                  </button>
                </div>

              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab: History ── */}
        {activeTab === "history" && (
          <motion.div key="history" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.2 }}>
            <PurchaseHistory
              orders={purchaseOrders}
              suppliers={suppliers}
              loading={historyLoading}
              voidingId={voidingId}
              onView={handleViewPO}
              onVoid={handleVoidPO}
              onEdit={handleEditPO}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: Hardware Dimension / Length Calculator */}
      <AnimatePresence>
        {hardwareCalcProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setHardwareCalcProduct(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm relative z-10 border border-slate-150 font-sans"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <h3 className="text-base font-bold text-slate-800">
                  {hardwareCalcProduct.measurement_type === "dimension" ? "📐 Dimension Calculator (پیمائش)" : "📏 Length Calculator (لمبائی)"}
                </h3>
                <button onClick={() => setHardwareCalcProduct(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs font-bold text-slate-800 mb-3">{hardwareCalcProduct.name}</p>

              <div className="space-y-3">

                {hardwareCalcProduct.measurement_type === "dimension" ? (
                  <>
                    {/* LENGTH: ft + in */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">📏 Length (لمبائی)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input type="number" min={0} placeholder="0"
                            value={hardwareCalcLengthFt || ""}
                            onChange={(e) => setHardwareCalcLengthFt(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="font-mono text-slate-800 h-10 pr-10" autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-pur-len-in")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ft</span>
                        </div>
                        <div className="relative">
                          <Input id="hw-pur-len-in" type="number" min={0} max={11} placeholder="0"
                            value={hardwareCalcLengthIn || ""}
                            onChange={(e) => setHardwareCalcLengthIn(Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                            className="font-mono text-slate-800 h-10 pr-10"
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-pur-wid-ft")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">in</span>
                        </div>
                      </div>
                    </div>

                    {/* WIDTH: ft + in */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">📐 Width (چوڑائی)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input id="hw-pur-wid-ft" type="number" min={0} placeholder="0"
                            value={hardwareCalcWidthFt || ""}
                            onChange={(e) => setHardwareCalcWidthFt(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="font-mono text-slate-800 h-10 pr-10"
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-pur-wid-in")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ft</span>
                        </div>
                        <div className="relative">
                          <Input id="hw-pur-wid-in" type="number" min={0} max={11} placeholder="0"
                            value={hardwareCalcWidthIn || ""}
                            onChange={(e) => setHardwareCalcWidthIn(Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                            className="font-mono text-slate-800 h-10 pr-10"
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-pur-qty-input")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">in</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">📏 Length (لمبائی)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input type="number" min={0} placeholder="0"
                          value={hardwareCalcLengthFt || ""}
                          onChange={(e) => setHardwareCalcLengthFt(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="font-mono text-slate-800 h-10 pr-10" autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-pur-len-in")?.focus(); }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ft</span>
                      </div>
                      <div className="relative">
                        <Input id="hw-pur-len-in" type="number" min={0} max={11} placeholder="0"
                          value={hardwareCalcLengthIn || ""}
                          onChange={(e) => setHardwareCalcLengthIn(Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                          className="font-mono text-slate-800 h-10 pr-10"
                          onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-pur-qty-input")?.focus(); }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">in</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">🔢 No. of {hardwareCalcProduct.measurement_type === "dimension" ? "Sheets / Pieces" : "Pieces"} (تعداد)</label>
                  <Input id="hw-pur-qty-input" type="number" min={1}
                    value={hardwareCalcQty || ""}
                    onChange={(e) => setHardwareCalcQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="font-mono text-slate-800 h-10"
                    onKeyDown={(e) => { if (e.key === "Enter") handleConfirmHardwareCalculation(); }}
                  />
                </div>

                {/* Live Preview */}
                {(() => {
                  const lenFt = hardwareCalcLengthFt + hardwareCalcLengthIn / 12;
                  const widFt = hardwareCalcWidthFt  + hardwareCalcWidthIn  / 12;
                  const isDim = hardwareCalcProduct.measurement_type === "dimension";
                  const computed = isDim ? lenFt * widFt * hardwareCalcQty : lenFt * hardwareCalcQty;
                  const total = computed * (hardwareCalcProduct.purchase_price_single || 0);
                  return (
                    <div className="bg-gradient-to-br from-slate-50 to-violet-50 p-4 rounded-xl border border-violet-100 mt-1 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Total Area / Qty:</span>
                        <span className="font-bold text-violet-700 font-mono text-sm">{computed.toFixed(3)} sq ft</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-violet-200 pt-2 font-bold text-sm">
                        <span className="text-slate-600">Total Purchase Cost:</span>
                        <span className="font-mono text-violet-600">Rs {total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setHardwareCalcProduct(null)} 
                    className="h-10 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleConfirmHardwareCalculation} 
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold h-10 rounded-xl"
                  >
                    Add to Cart
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Select Packing / Unit Variation */}
      <AnimatePresence>
        {activeProductForVariants && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setActiveProductForVariants(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-10 border border-slate-150"
            >
              <h3 className="text-base font-bold text-slate-800 mb-1">
                {industryType === "karyana" ? "Select Unit / Variation" : "Select Packing Variation"}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                "{activeProductForVariants.name}" has multiple {industryType === "karyana" ? "units/variations" : "packings"} available.
              </p>
              
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {modalChoices.map((opt, oIdx) => {
                  const isChoiceSelected = selectedModalIndex === oIdx;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        if (opt.isBase) {
                          addToCart(activeProductForVariants);
                        } else {
                          addToCart(activeProductForVariants, opt.id, opt.name, opt.purchasePrice, opt.price);
                        }
                        setActiveProductForVariants(null);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all flex justify-between items-center border ${
                        isChoiceSelected 
                          ? "bg-violet-50 border-violet-500 ring-2 ring-violet-500/20" 
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div>
                        <p className={`font-extrabold text-xs ${isChoiceSelected ? "text-violet-900" : "text-slate-800"}`}>
                          {opt.name}
                        </p>
                        <p className="text-[10px] text-slate-450">Stock: {opt.stock} units</p>
                      </div>
                      <div className="text-right">
                        <span className={`block font-extrabold text-xs ${isChoiceSelected ? "text-violet-700" : "text-slate-900"}`}>
                          Cost: Rs {opt.purchasePrice}
                        </span>
                        <span className="block text-[9px] text-slate-400">
                          Sale: Rs {opt.price}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4 pt-2 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setActiveProductForVariants(null)} className="text-xs rounded-xl font-bold hover:bg-violet-50 hover:text-violet-750">Cancel</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AddSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        onSupplierAdded={sup => setSuppliers(prev => [...prev, sup].sort((a,b) => a.name.localeCompare(b.name)))}
      />

      <PODetailModal
        isOpen={isDetailOpen}
        po={selectedPO}
        items={selectedPOItems}
        loading={loadingDetail}
        voidingId={voidingId}
        shopName={shopName || ""}
        onClose={() => setIsDetailOpen(false)}
        onVoid={handleVoidPO}
        onEdit={handleEditPO}
        onDownloadPDF={handleDownloadPDF}
      />

      <ShortcutsHelp
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <AIInvoiceModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        products={products}
        onImport={handleAIImport}
        shopId={shopId || ""}
        industryType={industryType || undefined}
        onRefreshProducts={fetchBaseData}
      />

      {/* MODAL: Purchase IMEI Entry */}
      <AnimatePresence>
        {isImeiPurchaseModalOpen && imeiPurchaseProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-transparent"
              onClick={() => {
                setIsImeiPurchaseModalOpen(false);
                setImeiPurchaseProduct(null);
                setImeiPurchaseInputs([]);
              }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-xl relative z-10 border border-slate-150 flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Purchase IMEI / Serial Manager</h3>
                    <p className="text-[10px] text-slate-400">{imeiPurchaseProduct.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsImeiPurchaseModalOpen(false);
                    setImeiPurchaseProduct(null);
                    setImeiPurchaseInputs([]);
                  }} 
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setImeiEntryTab("bulk")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    imeiEntryTab === "bulk"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ⚡ Bulk Paste &amp; Scanner
                </button>
                <button
                  type="button"
                  onClick={() => setImeiEntryTab("rows")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    imeiEntryTab === "rows"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  📋 Row-by-Row Editor ({imeiPurchaseInputs.length})
                </button>
              </div>

              {/* Tab 1: Bulk Paste & Scanner */}
              {imeiEntryTab === "bulk" ? (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2 custom-scrollbar">
                  {/* Rapid Barcode Scanner Input */}
                  <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 space-y-1.5">
                    <label className="block text-[10px] font-black text-indigo-900 uppercase tracking-wider">
                      Continuous Barcode / QR Scanner Input
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={rapidScanInput}
                        onChange={e => setRapidScanInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleRapidScanAdd(rapidScanInput);
                          }
                        }}
                        placeholder="Scan barcode with handheld gun & press Enter..."
                        className="h-8.5 text-xs font-mono font-bold bg-white rounded-xl"
                        autoFocus
                      />
                      <Button
                        type="button"
                        onClick={() => handleRapidScanAdd(rapidScanInput)}
                        className="h-8.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shrink-0"
                      >
                        + Add Scanned
                      </Button>
                    </div>
                  </div>

                  {/* Multi-Line Bulk Paste Box */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider">
                        Or Paste Multi-line IMEIs (Supplier Sheet)
                      </label>
                      <span className="text-[10px] text-slate-400">One per line or "IMEI1, IMEI2"</span>
                    </div>
                    <textarea
                      value={imeiBulkText}
                      onChange={e => setImeiBulkText(e.target.value)}
                      placeholder={`352948091823719\n359284091823720, 359284091823721\n351029384756192`}
                      rows={5}
                      className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                    <Button
                      type="button"
                      onClick={handleParseBulkImeis}
                      variant="outline"
                      className="w-full text-xs font-bold text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 border-indigo-200 h-8.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>⚡ Parse &amp; Populate IMEIs</span>
                    </Button>
                  </div>

                  {/* Live preview badge */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">Total Valid Devices Loaded:</span>
                    <span className="text-indigo-700 font-extrabold font-mono text-sm bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {imeiPurchaseInputs.filter(i => i.imei1.trim()).length} Devices
                    </span>
                  </div>
                </div>
              ) : (
                /* Tab 2: Row by Row List */
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2 custom-scrollbar min-h-[150px]">
                  {imeiPurchaseInputs.map((input, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col gap-2 relative">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest">Device #{idx + 1}</span>
                        {imeiPurchaseInputs.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => setImeiPurchaseInputs(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-750 p-1 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">IMEI 1 *</label>
                          <Input 
                            placeholder="15-digit IMEI 1"
                            value={input.imei1}
                            onChange={(e) => setImeiPurchaseInputs(prev => prev.map((item, i) => i === idx ? { ...item, imei1: e.target.value } : item))}
                            className="h-8.5 text-xs rounded-xl font-mono border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">IMEI 2 (Optional)</label>
                          <Input 
                            placeholder="Secondary IMEI"
                            value={input.imei2 || ""}
                            onChange={(e) => setImeiPurchaseInputs(prev => prev.map((item, i) => i === idx ? { ...item, imei2: e.target.value } : item))}
                            className="h-8.5 text-xs rounded-xl font-mono border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="pt-2">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setImeiPurchaseInputs(prev => [...prev, { imei1: "", imei2: "" }])}
                      className="w-full text-xs font-bold text-indigo-650 hover:bg-indigo-50 border-indigo-200/50 rounded-xl h-8.5 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} /> + Add Another Device Row
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-4 shrink-0 border-t border-slate-100 pt-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsImeiPurchaseModalOpen(false);
                    setImeiPurchaseProduct(null);
                    setImeiPurchaseInputs([]);
                  }}
                  className="flex-1 text-slate-655 font-bold h-10 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmImeiPurchase}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-10 rounded-xl text-xs shadow-md shadow-indigo-500/10 cursor-pointer"
                >
                  Confirm ({imeiPurchaseInputs.filter(i => i.imei1.trim()).length} IMEIs)
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auto-PO Reorder Studio Modal */}
      <AutoPOGeneratorModal
        isOpen={isAutoPOOpen}
        onClose={() => setIsAutoPOOpen(false)}
        products={products}
        suppliers={suppliers}
        shopId={shopId || undefined}
        shopName={shopName || "Business Store"}
        onLoadCart={(items, supplierId) => {
          setCart(items);
          if (supplierId && supplierId !== "unassigned") {
            setSelectedSupplierId(supplierId);
          }
        }}
      />

      {/* Quick Add Product Modal from Purchase */}
      <QuickAddProductModal
        isOpen={isQuickAddProductOpen}
        onClose={() => setIsQuickAddProductOpen(false)}
        shopId={shopId || ""}
        categories={categories}
        initialName={quickAddInitialName}
        isPharmacy={industryType === "pharmacy"}
        onProductCreated={(newProd) => {
          setProducts(prev => [newProd, ...prev]);
          addToCart(
            newProd,
            undefined,
            undefined,
            undefined,
            undefined,
            (newProd as any).batchNumber,
            (newProd as any).expiryDate
          );
        }}
      />

      {/* Edit Packing & Variants Modal */}
      <EditPackingModal
        isOpen={isEditPackingModalOpen}
        onClose={() => setIsEditPackingModalOpen(false)}
        product={editingPackingProduct}
        currentCartItem={editingPackingCartIndex !== null ? cart[editingPackingCartIndex] : null}
        shopId={shopId || ""}
        onPackingUpdated={handlePackingUpdated}
      />

      {/* Held / Parked Purchases Modal */}
      <HeldPurchasesModal
        isOpen={isHeldModalOpen}
        onClose={() => setIsHeldModalOpen(false)}
        heldList={heldPurchases}
        suppliers={suppliers}
        onResume={handleResumePurchase}
        onDelete={handleDeleteHeldPurchase}
      />

      {/* Floating Held Purchases Pill for Mobile */}
      {cart.length === 0 && heldPurchases.length > 0 && (
        <div className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:right-4 z-[70] md:hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={() => setIsHeldModalOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 hover:from-amber-700 hover:to-orange-800 text-white font-black rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-between gap-3 px-4 py-3 border border-amber-400/30 cursor-pointer active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold">
                <Pause size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-black leading-tight">
                  {heldPurchases.length} Parked {heldPurchases.length === 1 ? "Purchase Order" : "Purchase Orders"}
                </p>
                <p className="text-[10px] text-amber-100 font-semibold">Tap to view & resume purchase</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 text-xs font-extrabold">
              <span>Resume</span>
              <span>→</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
