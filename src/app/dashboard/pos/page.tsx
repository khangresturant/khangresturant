"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, ShoppingCart, UserPlus, Trash2, Plus, Minus, 
  CreditCard, Check, X, Printer, Loader2, DollarSign, ArrowRight, ArrowLeft,
  Store, Lock, Unlock, LogOut, Calculator, AlertTriangle,
  ChevronLeft, ChevronRight, Menu, LayoutGrid, Zap, Smartphone, Camera,
  ShieldAlert, FileText, Stethoscope, Pill, BookOpen, Sparkles, Edit3, Pause
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { ReceiptTemplate, DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import { logAudit } from "@/utils/audit";
import { ProductGrid } from "./components/ProductGrid";
import { CustomerSelector } from "./components/CustomerSelector";
import { CartSidebar } from "./components/CartSidebar";
import { CheckoutModal } from "./components/CheckoutModal";
import { PosTabBar, type POSTab } from "./components/PosTabBar";
import type { TradeInItem } from "./components/TradeInModal";
import { useSerialScale } from "@/hooks/useSerialScale";
import { buildPosCheckoutPayload } from "@/lib/money/buildPosPayload";
import { isMoneyRpcEnabled, posCheckout } from "@/lib/money/rpc";
import {
  enqueueOfflinePosCheckout,
  isBrowserOffline,
  isNetworkError,
  loadCatalogSnapshot,
  saveCatalogSnapshot,
} from "@/lib/sync/offlineCheckout";
import { filterAndRankProducts, matchProductTokens } from "@/utils/productSearch";

const FertilizerPOSPage = dynamic(() => import("../fertilizer/pos/page"), {
  ssr: false,
  loading: () => <div className="p-12 text-center flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-3" /><p className="text-sm text-slate-500 font-medium">Loading Fertilizer POS Terminal...</p></div>
});

const RestaurantPOSPage = dynamic(() => import("../restaurant/pos/page"), {
  ssr: false,
  loading: () => <div className="p-12 text-center flex flex-col items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600 mb-3" /><p className="text-sm text-slate-500 font-medium">Loading Restaurant POS Terminal...</p></div>
});

const BarcodeScannerModal = dynamic(
  () => import("@/components/BarcodeScannerModal").then((m) => m.BarcodeScannerModal),
  { ssr: false }
);

const AIVoicePosController = dynamic(
  () => import("@/components/pos/AIVoicePosController").then((m) => m.AIVoicePosController),
  { ssr: false }
);

const GenericAlternateModal = dynamic(
  () => import("./components/GenericAlternateModal").then((m) => m.GenericAlternateModal),
  { ssr: false }
);

const BatchSelectorModal = dynamic(
  () => import("./components/BatchSelectorModal").then((m) => m.BatchSelectorModal),
  { ssr: false }
);

const QuickAddProductModal = dynamic(
  () => import("./components/QuickAddProductModal").then((m) => m.QuickAddProductModal),
  { ssr: false }
);

const QuickShortBookModal = dynamic(
  () => import("./components/QuickShortBookModal").then((m) => m.QuickShortBookModal),
  { ssr: false }
);

const OneTimeItemModal = dynamic(
  () => import("./components/OneTimeItemModal").then((m) => m.OneTimeItemModal),
  { ssr: false }
);

const TradeInModal = dynamic(
  () => import("./components/TradeInModal").then((m) => m.TradeInModal),
  { ssr: false }
);

const PAGE_SIZE = 20;

type DBProduct = {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  sale_price_single: number;
  purchase_price_single: number;
  current_stock: number;
  pack_size?: number | null;
  min_stock_level?: number | null;
  category_id?: string | null;
  measurement_type?: "standard" | "dimension" | "length" | null;
  has_imei?: boolean | null;
  formulation_id?: string | null;
  formulations?: any;
  warranty?: string | null;
  product_barcodes?: { barcode: string }[];
  product_variants?: {
    id: string;
    packing_name: string;
    sale_price: number;
    purchase_price: number;
    stock_quantity: number;
    is_packing?: boolean;
    pack_size?: number | null;
    product_barcodes?: { barcode: string }[];
  }[];
  translated_names?: any;
  note?: string | null;
  image_url?: string | null;
  shelf_location?: string | null;
};

type Party = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
  address?: string | null;
  type?: string | null;
  credit_limit?: number | null;
  loyalty_points?: number | null;
};

type Category = {
  id: string;
  name: string;
};

export type ProductBatch = {
  id: string;
  product_id: string;
  batch_number: string | null;
  expiry_date: string | null;
  stock_quantity: number;
  purchase_price?: number;
  sale_price?: number;
};

type CartItem = {
  productId: string;
  variantId?: string;
  name: string;
  packingName?: string;
  price: number;
  purchasePrice: number;
  quantity: number;
  stock: number;
  isAutoSubunit?: boolean;
  conversionFactor?: number;
  unitType?: "multiplier" | "divisor";
  has_imei?: boolean;
  warranty?: string;
  selectedImeis?: Array<{ id: string; imei1: string; imei2?: string | null }>;
  translated_names?: any;
  note?: string | null;
  discount?: number;
  discountType?: "percentage" | "fixed";
  syncPriceToCatalog?: boolean;
  batchNumber?: string | null;
  expiryDate?: string | null;
  batchId?: string | null;
  availableBatches?: ProductBatch[];
  shelfLocation?: string | null;
  isCustomItem?: boolean;
};

interface CartQtyInputProps {
  value: number;
  max: number;
  onChange: (val: number) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  id?: string;
  allowDecimal?: boolean;
}

function CartQtyInput({
  value,
  max,
  onChange,
  onFocus,
  onKeyDown,
  className,
  id,
  allowDecimal = true
}: CartQtyInputProps) {
  const [localVal, setLocalVal] = useState(value.toString());

  useEffect(() => {
    setLocalVal(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    const regex = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
    if (valStr === "" || regex.test(valStr)) {
      setLocalVal(valStr);
      const parsed = allowDecimal ? parseFloat(valStr) : parseInt(valStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        onChange(Math.min(max, parsed));
      }
    }
  };

  const handleBlur = () => {
    const parsed = allowDecimal ? parseFloat(localVal) : parseInt(localVal, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setLocalVal("1");
      onChange(1);
    } else {
      const clamped = Math.min(max, parsed);
      setLocalVal(clamped.toString());
      onChange(clamped);
    }
  };

  return (
    <input
      id={id}
      type="text"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={className}
    />
  );
}

export const isControlledDrug = (item: { name?: string | null; note?: string | null; is_controlled?: boolean | null; formulations?: any }): boolean => {
  if (item?.is_controlled) return true;
  if (item?.note?.includes("[CONTROLLED_DRUG]")) return true;
  const text = `${item?.name || ""} ${item?.note || ""} ${item?.formulations?.name || ""}`.toLowerCase();
  const controlledKeywords = [
    "xanax", "lexotanil", "rivotril", "valium", "diazepam", 
    "alprazolam", "bromazepam", "clonazepam", "lorazepam", "midazolam",
    "tramadol", "ketamine", "morphine", "epival", "tegretol", "dormicum",
    "gabapentin", "pregabalin", "lyrica", "nalbuphine", "pethidine", "phenobarbital",
    "ativan", "serax", "stilnox", "zolpidem", "restoril", "temazepam", "clobazam",
    "frisium", "librium", "chlordiazepoxide", "nitrazepam", "mogadon"
  ];
  return controlledKeywords.some(kw => text.includes(kw));
};

function POSPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParam = searchParams?.get("edit");

  const { 
    shopId, 
    userId, 
    userName, 
    shopName, 
    industryType, 
    permissions, 
    allowNegativeStock, 
    hasEmi, 
    hasTax, 
    defaultTaxRate, 
    defaultTaxType, 
    hasLoyalty, 
    hasGiftCards, 
    activeClosingBook, 
    subscriptionTier, 
    activeLanguages,
    showCostPriceOnPos,
    setShowCostPriceOnPos
  } = useShop();
  const { t, language, setLanguage } = useLanguage();
  const supabase = createClient();
  const scale = useSerialScale();

  if (industryType === "fertilizer") {
    return <FertilizerPOSPage />;
  }

  if (industryType === "restaurant") {
    return <RestaurantPOSPage />;
  }

  const [products, setProducts] = useState<DBProduct[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Quick Add Product Modal State
  const [isQuickAddProductOpen, setIsQuickAddProductOpen] = useState(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState("");

  // Quick Short Book Modal State
  const [isQuickShortBookOpen, setIsQuickShortBookOpen] = useState(false);
  const [quickShortBookInitialName, setQuickShortBookInitialName] = useState("");

  // One-Time / Arranged Item Sale Modal State
  const [isOneTimeItemModalOpen, setIsOneTimeItemModalOpen] = useState(false);

  // Register Session / Daybook states
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isCloseRegisterOpen, setIsCloseRegisterOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState<string>("");
  const [actualCashCounted, setActualCashCounted] = useState<number>(0);
  const [closingNote, setClosingNote] = useState<string>("");
  const [shiftInvoices, setShiftInvoices] = useState<any[]>([]);
  const [shiftKhataIn, setShiftKhataIn] = useState<number>(0);
  const [shiftKhataOut, setShiftKhataOut] = useState<number>(0);
  const [shiftExpenses, setShiftExpenses] = useState<number>(0);
  const [shiftPurchases, setShiftPurchases] = useState<number>(0);
  const [selectedImeisForItem, setSelectedImeisForItem] = useState<any[]>([]);
  const [loadingImeis, setLoadingImeis] = useState(false);
  const [imeiSearchQuery, setImeiSearchQuery] = useState("");
  const [isImeiSelectModalOpen, setIsImeiSelectModalOpen] = useState(false);
  const [imeiModalProduct, setImeiModalProduct] = useState<DBProduct | null>(null);
  const [availableImeis, setAvailableImeis] = useState<any[]>([]);
  const [loadingShiftStats, setLoadingShiftStats] = useState(false);
  const [isOpeningRegister, setIsOpeningRegister] = useState(false);
  const [isClosingRegister, setIsClosingRegister] = useState(false);

  // Grid navigation index
  const [selectedGridIndex, setSelectedGridIndex] = useState<number>(-1);
  const [selectedGridUnitIndex, setSelectedGridUnitIndex] = useState<number>(0);

  // Modal choice selection index
  const [selectedModalIndex, setSelectedModalIndex] = useState<number>(0);

  // Cart Focus and navigation state
  const [isCartFocused, setIsCartFocused] = useState<boolean>(false);
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState<number>(-1);

  // Checkout State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // ── Multi-Tab POS Billing States (Desktop-style multiple sale bills) ──
  const [tabs, setTabs] = useState<POSTab[]>([
    {
      id: "tab-1",
      tabNumber: 1,
      cart: [],
      selectedCustomerId: "walkin",
      discount: 0,
      discountType: "fixed",
      taxRate: 0,
      taxType: "percentage",
      paymentMode: "cash",
      remarks: "",
      receivedAmount: 0,
      selectedAccountId: "",
      tradeInItem: null,
      createdAt: Date.now(),
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const nextTabNumberRef = useRef<number>(2);
  const isSwitchingTabRef = useRef<boolean>(false);
  const isTabsHydratedRef = useRef<boolean>(false);

  const [customerCnic, setCustomerCnic] = useState("");
  const [prescriptionRef, setPrescriptionRef] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorPmdc, setDoctorPmdc] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [dosageInstructions, setDosageInstructions] = useState("");
  const [isControlledPromptOpen, setIsControlledPromptOpen] = useState(false);

  // Generic Salt & Alternate Medicine Modal State (Pharmacy Only)
  const [isAlternateModalOpen, setIsAlternateModalOpen] = useState(false);
  const [alternateTargetProduct, setAlternateTargetProduct] = useState<DBProduct | null>(null);
  const [alternateTargetCartIndex, setAlternateTargetCartIndex] = useState<number | null>(null);

  const handleOpenAlternateModal = (product: DBProduct | null, cartIndex?: number) => {
    setAlternateTargetProduct(product);
    setAlternateTargetCartIndex(typeof cartIndex === "number" ? cartIndex : null);
    setIsAlternateModalOpen(true);
  };

  const handleOpenAlternateModalForCartItem = (cartItem: CartItem, index: number) => {
    const prod = products.find(p => p.id === cartItem.productId) || ({
      id: cartItem.productId,
      name: cartItem.name,
      sale_price_single: cartItem.price,
      purchase_price_single: cartItem.purchasePrice,
      current_stock: cartItem.stock,
      shelf_location: cartItem.shelfLocation || null
    } as DBProduct);
    handleOpenAlternateModal(prod, index);
  };

  const handleReplaceCartItem = (cartIndex: number, newProduct: DBProduct) => {
    if (cartIndex >= 0 && cartIndex < cart.length) {
      const available = productBatches[newProduct.id] || [];
      const sortedBatches = [...available].sort((a, b) => {
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      });
      const defaultBatch = sortedBatches.find(b => (b.stock_quantity || 0) > 0) || sortedBatches[0];

      const oldQty = cart[cartIndex].quantity;
      const updated = [...cart];
      updated[cartIndex] = {
        productId: newProduct.id,
        name: newProduct.name,
        price: newProduct.sale_price_single,
        purchasePrice: newProduct.purchase_price_single,
        quantity: oldQty,
        stock: newProduct.current_stock,
        batchNumber: defaultBatch?.batch_number || null,
        expiryDate: defaultBatch?.expiry_date || null,
        batchId: defaultBatch?.id || null,
        shelfLocation: newProduct.shelf_location || null,
      };
      setCart(updated);
      toast.success(`Swapped to alternative: ${newProduct.name} (Rs ${newProduct.sale_price_single})`);
    }
  };

  useEffect(() => {
    if (industryType === "pharmacy") {
      setDiscountType("percentage");
    } else {
      setDiscountType("fixed");
    }
  }, [industryType]);
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);
  const [lastCatalogSync, setLastCatalogSync] = useState<string | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<any | null>(null);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [appliedGiftCardAmount, setAppliedGiftCardAmount] = useState(0);
  const [taxRate, setTaxRate] = useState<number>(0); // in percent or flat
  const [taxType, setTaxType] = useState<string>("percentage");

  // Initialize taxRate to defaultTaxRate when context loads
  useEffect(() => {
    if (defaultTaxRate !== undefined) {
      setTaxRate(defaultTaxRate);
    }
    if (defaultTaxType !== undefined) {
      setTaxType(defaultTaxType);
    }
  }, [defaultTaxRate, defaultTaxType]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "credit" | "quotation" | "emi">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remarks, setRemarks] = useState("");

  // EMI / Installment States
  const [emiInstallments, setEmiInstallments] = useState(6);
  const [emiFrequency, setEmiFrequency] = useState<"monthly" | "weekly">("monthly");
  const [emiMarkupRate, setEmiMarkupRate] = useState(0);
  const [emiFirstDueDate, setEmiFirstDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });

  // Hardware Calculator States (ft + in split inputs)
  const [hardwareCalcProduct, setHardwareCalcProduct] = useState<DBProduct | null>(null);
  const [hardwareCalcLengthFt, setHardwareCalcLengthFt] = useState<number>(0);
  const [hardwareCalcLengthIn, setHardwareCalcLengthIn] = useState<number>(0);
  const [hardwareCalcWidthFt, setHardwareCalcWidthFt] = useState<number>(0);
  const [hardwareCalcWidthIn, setHardwareCalcWidthIn] = useState<number>(0);
  const [hardwareCalcQty, setHardwareCalcQty] = useState<number>(1);
  const [hardwareCalcWastage, setHardwareCalcWastage] = useState<number>(0);

  // Pharmacy Alternative Medicine / Formulation Modal States
  const [isAltModalOpen, setIsAltModalOpen] = useState(false);
  const [selectedAltFormulation, setSelectedAltFormulation] = useState<{ id?: string; name: string } | null>(null);
  const [altSearchQuery, setAltSearchQuery] = useState("");

  // Accounts & Held Carts states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [heldCarts, setHeldCarts] = useState<any[]>([]);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);

  // Pharmacy & Retail Batch Tracking States
  const [productBatches, setProductBatches] = useState<Record<string, ProductBatch[]>>({});
  const [batchModalItemIndex, setBatchModalItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && shopId) {
      const saved = localStorage.getItem(`held_carts_${shopId}`);
      if (saved) {
        try {
          setHeldCarts(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [shopId]);

  const saveHeldCarts = (newCarts: any[]) => {
    setHeldCarts(newCarts);
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem(`held_carts_${shopId}`, JSON.stringify(newCarts));
    }
  };

  // Add Customer Modal State
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Pharmacy expiry alerts states
  const [nearExpiryAlerts, setNearExpiryAlerts] = useState<any[]>([]);
  const [showExpiryAlertsBanner, setShowExpiryAlertsBanner] = useState<boolean>(true);

  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

  // Customer search & dropdown selection state
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomerSearchIndex, setSelectedCustomerSearchIndex] = useState(0);

  // Split payment / Paid cash in credit mode state
  const [receivedAmount, setReceivedAmount] = useState<number>(0);

  // Keyboard Shortcuts modal help state
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Mobile Trade-In / Exchange States
  const [isTradeInModalOpen, setIsTradeInModalOpen] = useState(false);
  const [tradeInItem, setTradeInItem] = useState<TradeInItem | null>(null);

  // Custom price editing mode state — persisted to localStorage
  const [allowPriceEdit, setAllowPriceEdit] = useState(false);

  // Load allowPriceEdit from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && shopId) {
      const saved = localStorage.getItem(`pos_price_edit_${shopId}`);
      if (saved === "true") setAllowPriceEdit(true);
    }
  }, [shopId]);

  // ── Multi-Tab POS System (Desktop Multi-Bill Management & Zero-Loss Persistence) ──
  // 1. Hydrate saved multi-tab bills from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined" || !shopId || editParam) return;
    try {
      const savedMultiTabs = localStorage.getItem(`theaccounts_pos_multi_tabs_${shopId}`);
      if (savedMultiTabs) {
        const parsed = JSON.parse(savedMultiTabs);
        if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
          const loadedTabs: POSTab[] = parsed.tabs;
          const targetActiveId = parsed.activeTabId && loadedTabs.some(t => t.id === parsed.activeTabId)
            ? parsed.activeTabId
            : loadedTabs[0].id;

          const maxNum = loadedTabs.reduce((m, t) => Math.max(m, t.tabNumber || 1), 1);
          nextTabNumberRef.current = Math.max(maxNum + 1, parsed.nextTabNumber || 2);

          setTabs(loadedTabs);
          setActiveTabId(targetActiveId);

          const activeTab = loadedTabs.find(t => t.id === targetActiveId) || loadedTabs[0];
          isSwitchingTabRef.current = true;
          setCart(activeTab.cart || []);
          setSelectedCustomerId(activeTab.selectedCustomerId || "walkin");
          setDiscount(activeTab.discount || 0);
          setDiscountType(activeTab.discountType || (industryType === "pharmacy" ? "percentage" : "fixed"));
          if (typeof activeTab.taxRate === "number") setTaxRate(activeTab.taxRate);
          if (activeTab.taxType) setTaxType(activeTab.taxType);
          if (activeTab.paymentMode) setPaymentMode(activeTab.paymentMode as any);
          if (activeTab.remarks) setRemarks(activeTab.remarks);
          if (typeof activeTab.receivedAmount === "number") setReceivedAmount(activeTab.receivedAmount);
          if (activeTab.selectedAccountId) setSelectedAccountId(activeTab.selectedAccountId);
          if (activeTab.tradeInItem) setTradeInItem(activeTab.tradeInItem);
          setTimeout(() => { isSwitchingTabRef.current = false; }, 60);

          isTabsHydratedRef.current = true;
          return;
        }
      }

      // Backward Compatibility: Hydrate legacy single draft into Tab #1
      const legacyDraft = localStorage.getItem(`theaccounts_pos_active_draft_${shopId}`);
      if (legacyDraft) {
        const parsed = JSON.parse(legacyDraft);
        if (parsed && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
          const tab1: POSTab = {
            id: "tab-1",
            tabNumber: 1,
            cart: parsed.cart,
            selectedCustomerId: parsed.selectedCustomerId || "walkin",
            discount: parsed.discount || 0,
            discountType: parsed.discountType || (industryType === "pharmacy" ? "percentage" : "fixed"),
            taxRate: defaultTaxRate || 0,
            taxType: defaultTaxType || "percentage",
            paymentMode: parsed.paymentMode || "cash",
            remarks: parsed.remarks || "",
            receivedAmount: 0,
            selectedAccountId: "",
            tradeInItem: parsed.tradeInItem || null,
            createdAt: Date.now(),
          };
          setTabs([tab1]);
          setActiveTabId(tab1.id);
          nextTabNumberRef.current = 2;

          isSwitchingTabRef.current = true;
          setCart(tab1.cart);
          setSelectedCustomerId(tab1.selectedCustomerId);
          setDiscount(tab1.discount);
          setDiscountType(tab1.discountType);
          setPaymentMode(tab1.paymentMode as any);
          setRemarks(tab1.remarks);
          setTradeInItem(tab1.tradeInItem);
          setTimeout(() => { isSwitchingTabRef.current = false; }, 60);
        }
      }
      isTabsHydratedRef.current = true;
    } catch (e) {
      console.error("Failed to restore multi-tab POS state:", e);
      isTabsHydratedRef.current = true;
    }
  }, [shopId, editParam, defaultTaxRate, defaultTaxType, industryType]);

  // 2. Real-time Synchronization: Keep active tab & localStorage in sync
  useEffect(() => {
    if (typeof window === "undefined" || !shopId || editParam || !isTabsHydratedRef.current) return;
    if (isSwitchingTabRef.current) return;

    setTabs(prevTabs => {
      let hasChanges = false;
      const updated = prevTabs.map(tab => {
        if (tab.id === activeTabId) {
          hasChanges = true;
          return {
            ...tab,
            cart,
            selectedCustomerId,
            discount,
            discountType,
            taxRate,
            taxType,
            paymentMode,
            remarks,
            receivedAmount,
            selectedAccountId,
            tradeInItem,
          };
        }
        return tab;
      });

      if (!hasChanges) return prevTabs;

      try {
        localStorage.setItem(`theaccounts_pos_multi_tabs_${shopId}`, JSON.stringify({
          activeTabId,
          tabs: updated,
          nextTabNumber: nextTabNumberRef.current,
        }));
      } catch (e) {
        console.error("Failed to persist multi-tab POS bills:", e);
      }

      return updated;
    });
  }, [
    cart,
    selectedCustomerId,
    discount,
    discountType,
    taxRate,
    taxType,
    paymentMode,
    remarks,
    receivedAmount,
    selectedAccountId,
    tradeInItem,
    activeTabId,
    shopId,
    editParam,
  ]);

  // 3. Tab Actions: Switch, New, Close, and Post-Checkout Auto-Switch
  const handleSwitchTab = (targetTabId: string) => {
    if (targetTabId === activeTabId) return;
    const targetTab = tabs.find(t => t.id === targetTabId);
    if (!targetTab) return;

    isSwitchingTabRef.current = true;

    // Flush current active values into the exiting tab
    const updatedTabs = tabs.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          cart,
          selectedCustomerId,
          discount,
          discountType,
          taxRate,
          taxType,
          paymentMode,
          remarks,
          receivedAmount,
          selectedAccountId,
          tradeInItem,
        };
      }
      return t;
    });

    setTabs(updatedTabs);
    setActiveTabId(targetTab.id);

    // Populate active states from target tab
    setCart(targetTab.cart || []);
    setSelectedCustomerId(targetTab.selectedCustomerId || "walkin");
    setDiscount(targetTab.discount || 0);
    setDiscountType(targetTab.discountType || (industryType === "pharmacy" ? "percentage" : "fixed"));
    setTaxRate(targetTab.taxRate ?? (defaultTaxRate || 0));
    setTaxType(targetTab.taxType || (defaultTaxType || "percentage"));
    setPaymentMode((targetTab.paymentMode as any) || "cash");
    setRemarks(targetTab.remarks || "");
    setReceivedAmount(targetTab.receivedAmount || 0);
    setSelectedAccountId(targetTab.selectedAccountId || "");
    setTradeInItem(targetTab.tradeInItem || null);

    setSelectedCartItemIndex(-1);
    setIsCartFocused(false);
    setSearchQuery("");

    if (typeof window !== "undefined" && shopId) {
      try {
        localStorage.setItem(`theaccounts_pos_multi_tabs_${shopId}`, JSON.stringify({
          activeTabId: targetTab.id,
          tabs: updatedTabs,
          nextTabNumber: nextTabNumberRef.current,
        }));
      } catch (e) {
        console.error(e);
      }
    }

    setTimeout(() => {
      isSwitchingTabRef.current = false;
    }, 60);

    toast.info(`Switched to Bill #${targetTab.tabNumber}`);
  };

  const handleNewTab = () => {
    if (tabs.length >= 10) {
      toast.warning("Maximum 10 bills can be open at a time.");
      return;
    }

    isSwitchingTabRef.current = true;

    // Save current active state into existing tabs
    const updatedTabs = tabs.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          cart,
          selectedCustomerId,
          discount,
          discountType,
          taxRate,
          taxType,
          paymentMode,
          remarks,
          receivedAmount,
          selectedAccountId,
          tradeInItem,
        };
      }
      return t;
    });

    const newTabNum = nextTabNumberRef.current++;
    const newTab: POSTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tabNumber: newTabNum,
      cart: [],
      selectedCustomerId: "walkin",
      discount: 0,
      discountType: industryType === "pharmacy" ? "percentage" : "fixed",
      taxRate: defaultTaxRate || 0,
      taxType: defaultTaxType || "percentage",
      paymentMode: "cash",
      remarks: "",
      receivedAmount: 0,
      selectedAccountId: "",
      tradeInItem: null,
      createdAt: Date.now(),
    };

    const nextTabsList = [...updatedTabs, newTab];
    setTabs(nextTabsList);
    setActiveTabId(newTab.id);

    // Reset active states for new bill
    setCart([]);
    setSelectedCustomerId("walkin");
    setDiscount(0);
    setDiscountType(industryType === "pharmacy" ? "percentage" : "fixed");
    setTaxRate(defaultTaxRate || 0);
    setTaxType(defaultTaxType || "percentage");
    setPaymentMode("cash");
    setRemarks("");
    setReceivedAmount(0);
    setSelectedAccountId("");
    setTradeInItem(null);
    setSelectedCartItemIndex(-1);
    setIsCartFocused(false);
    setSearchQuery("");

    if (typeof window !== "undefined" && shopId) {
      try {
        localStorage.setItem(`theaccounts_pos_multi_tabs_${shopId}`, JSON.stringify({
          activeTabId: newTab.id,
          tabs: nextTabsList,
          nextTabNumber: nextTabNumberRef.current,
        }));
      } catch (e) {
        console.error(e);
      }
    }

    setTimeout(() => {
      isSwitchingTabRef.current = false;
      const searchInput = document.getElementById("pos-search-input");
      searchInput?.focus();
    }, 60);

    toast.success(`Opened New Bill #${newTabNum}`);
  };

  const handleCloseTab = (tabIdToClose: string) => {
    const tabToClose = tabs.find(t => t.id === tabIdToClose);
    if (!tabToClose) return;

    const itemCount = tabIdToClose === activeTabId ? cart.length : (tabToClose.cart?.length || 0);
    if (itemCount > 0) {
      const confirmed = window.confirm(
        `Bill #${tabToClose.tabNumber} has ${itemCount} item(s) in cart. Discard and close this bill?`
      );
      if (!confirmed) return;
    }

    if (tabs.length === 1) {
      // Don't close the only remaining tab, reset it to clean empty bill
      setCart([]);
      setSelectedCustomerId("walkin");
      setDiscount(0);
      setDiscountType(industryType === "pharmacy" ? "percentage" : "fixed");
      setTaxRate(defaultTaxRate || 0);
      setTaxType(defaultTaxType || "percentage");
      setPaymentMode("cash");
      setRemarks("");
      setReceivedAmount(0);
      setSelectedAccountId("");
      setTradeInItem(null);
      setTabs([{
        ...tabToClose,
        cart: [],
        selectedCustomerId: "walkin",
        discount: 0,
        remarks: "",
        receivedAmount: 0,
        tradeInItem: null,
      }]);
      toast.info(`Bill #${tabToClose.tabNumber} cleared.`);
      return;
    }

    const closeIdx = tabs.findIndex(t => t.id === tabIdToClose);
    const remainingTabs = tabs.filter(t => t.id !== tabIdToClose);

    if (tabIdToClose === activeTabId) {
      isSwitchingTabRef.current = true;
      const nextIdx = closeIdx > 0 ? closeIdx - 1 : 0;
      const nextActiveTab = remainingTabs[nextIdx];

      setTabs(remainingTabs);
      setActiveTabId(nextActiveTab.id);

      setCart(nextActiveTab.cart || []);
      setSelectedCustomerId(nextActiveTab.selectedCustomerId || "walkin");
      setDiscount(nextActiveTab.discount || 0);
      setDiscountType(nextActiveTab.discountType || (industryType === "pharmacy" ? "percentage" : "fixed"));
      setTaxRate(nextActiveTab.taxRate ?? (defaultTaxRate || 0));
      setTaxType(nextActiveTab.taxType || (defaultTaxType || "percentage"));
      setPaymentMode((nextActiveTab.paymentMode as any) || "cash");
      setRemarks(nextActiveTab.remarks || "");
      setReceivedAmount(nextActiveTab.receivedAmount || 0);
      setSelectedAccountId(nextActiveTab.selectedAccountId || "");
      setTradeInItem(nextActiveTab.tradeInItem || null);

      setSelectedCartItemIndex(-1);
      setIsCartFocused(false);
      setSearchQuery("");

      if (typeof window !== "undefined" && shopId) {
        try {
          localStorage.setItem(`theaccounts_pos_multi_tabs_${shopId}`, JSON.stringify({
            activeTabId: nextActiveTab.id,
            tabs: remainingTabs,
            nextTabNumber: nextTabNumberRef.current,
          }));
        } catch (e) {
          console.error(e);
        }
      }

      setTimeout(() => {
        isSwitchingTabRef.current = false;
      }, 60);

      toast.info(`Bill #${tabToClose.tabNumber} closed. Switched to Bill #${nextActiveTab.tabNumber}`);
    } else {
      setTabs(remainingTabs);
      if (typeof window !== "undefined" && shopId) {
        try {
          localStorage.setItem(`theaccounts_pos_multi_tabs_${shopId}`, JSON.stringify({
            activeTabId,
            tabs: remainingTabs,
            nextTabNumber: nextTabNumberRef.current,
          }));
        } catch (e) {
          console.error(e);
        }
      }
      toast.info(`Bill #${tabToClose.tabNumber} closed.`);
    }
  };

  const handleCloseActiveTabAfterCheckout = () => {
    if (tabs.length > 1) {
      const remainingTabs = tabs.filter(t => t.id !== activeTabId);
      const nextActiveTab = remainingTabs[0];

      isSwitchingTabRef.current = true;
      setTabs(remainingTabs);
      setActiveTabId(nextActiveTab.id);

      setCart(nextActiveTab.cart || []);
      setSelectedCustomerId(nextActiveTab.selectedCustomerId || "walkin");
      setDiscount(nextActiveTab.discount || 0);
      setDiscountType(nextActiveTab.discountType || (industryType === "pharmacy" ? "percentage" : "fixed"));
      setTaxRate(nextActiveTab.taxRate ?? (defaultTaxRate || 0));
      setTaxType(nextActiveTab.taxType || (defaultTaxType || "percentage"));
      setPaymentMode((nextActiveTab.paymentMode as any) || "cash");
      setRemarks(nextActiveTab.remarks || "");
      setReceivedAmount(nextActiveTab.receivedAmount || 0);
      setSelectedAccountId(nextActiveTab.selectedAccountId || "");
      setTradeInItem(nextActiveTab.tradeInItem || null);

      setSelectedCartItemIndex(-1);
      setIsCartFocused(false);
      setSearchQuery("");

      if (typeof window !== "undefined" && shopId) {
        try {
          localStorage.setItem(`theaccounts_pos_multi_tabs_${shopId}`, JSON.stringify({
            activeTabId: nextActiveTab.id,
            tabs: remainingTabs,
            nextTabNumber: nextTabNumberRef.current,
          }));
          localStorage.removeItem(`theaccounts_pos_active_draft_${shopId}`);
        } catch (e) {
          console.error(e);
        }
      }

      setTimeout(() => {
        isSwitchingTabRef.current = false;
      }, 60);

      toast.success(`Bill completed! Switched to open Bill #${nextActiveTab.tabNumber}`);
    } else {
      const freshTab: POSTab = {
        id: `tab-${Date.now()}`,
        tabNumber: 1,
        cart: [],
        selectedCustomerId: "walkin",
        discount: 0,
        discountType: industryType === "pharmacy" ? "percentage" : "fixed",
        taxRate: defaultTaxRate || 0,
        taxType: defaultTaxType || "percentage",
        paymentMode: "cash",
        remarks: "",
        receivedAmount: 0,
        selectedAccountId: "",
        tradeInItem: null,
        createdAt: Date.now(),
      };
      setTabs([freshTab]);
      setActiveTabId(freshTab.id);
      nextTabNumberRef.current = 2;

      setCart([]);
      setSelectedCustomerId("walkin");
      setDiscount(0);
      setRemarks("");
      setReceivedAmount(0);
      setTradeInItem(null);

      if (typeof window !== "undefined" && shopId) {
        try {
          localStorage.setItem(`theaccounts_pos_multi_tabs_${shopId}`, JSON.stringify({
            activeTabId: freshTab.id,
            tabs: [freshTab],
            nextTabNumber: 2,
          }));
          localStorage.removeItem(`theaccounts_pos_active_draft_${shopId}`);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // Save allowPriceEdit to localStorage whenever it changes
  const togglePriceEdit = () => {
    setAllowPriceEdit(prev => {
      const next = !prev;
      if (typeof window !== "undefined" && shopId) {
        localStorage.setItem(`pos_price_edit_${shopId}`, String(next));
      }
      return next;
    });
  };

  // Edit previous bill mode state
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState<string | null>(null);
  const [isLoadingEditInvoice, setIsLoadingEditInvoice] = useState(false);

  // Load invoice items when navigated with ?edit=INVOICE_ID
  useEffect(() => {
    if (!editParam || !shopId) return;

    let isMounted = true;
    async function loadInvoiceForEdit(invId: string) {
      setIsLoadingEditInvoice(true);
      try {
        const { data: inv, error: invErr } = await supabase
          .from("invoices")
          .select(`
            id, party_id, total_amount, 
            discount, tax_amount, paid_amount, 
            payment_mode, status, remarks, order_number,
            customer_name, customer_phone,
            invoice_items (
              id, product_id, variant_id, quantity, unit_price, 
              purchase_price, subtotal, warranty, sold_imeis,
              batch_id, batch_number, expiry_date, packing_name, custom_name,
              products ( id, name, unit, purchase_price_single, sale_price_single, current_stock, shelf_location, has_imei, translated_names ),
              product_variants ( id, packing_name, sale_price, purchase_price, stock_quantity )
            ),
            parties ( id, name, phone, current_balance )
          `)
          .eq("id", invId)
          .eq("shop_id", shopId)
          .single();

        if (invErr || !inv) {
          toast.error("Could not load invoice for editing: " + (invErr?.message || "Not found"));
          return;
        }

        if (!isMounted) return;

        setEditingInvoiceId(inv.id);
        setEditingInvoiceNumber(inv.order_number ? `#${inv.order_number}` : `#${inv.id.slice(0, 8).toUpperCase()}`);

        // Set customer
        const custId = inv.party_id;
        if (custId) {
          setSelectedCustomerId(custId);
        } else {
          setSelectedCustomerId("walkin");
        }

        // Set Cart items
        const loadedItems: CartItem[] = (inv.invoice_items || []).map((it: any) => {
          const prod = it.products;
          const variant = it.product_variants;
          const isCustom = !it.product_id;
          
          let parsedImeis: Array<{ id: string; imei1: string; imei2?: string | null }> | undefined = undefined;
          if (it.sold_imeis) {
            try {
              if (Array.isArray(it.sold_imeis)) {
                parsedImeis = it.sold_imeis;
              }
            } catch {}
          }

          return {
            productId: it.product_id || `custom-${it.id}`,
            variantId: it.variant_id || undefined,
            name: prod?.name || it.custom_name || it.packing_name || "Product Item",
            packingName: it.packing_name || variant?.packing_name || undefined,
            price: Number(it.unit_price || 0),
            purchasePrice: Number(it.purchase_price || prod?.purchase_price_single || variant?.purchase_price || 0),
            quantity: Number(it.quantity || 1),
            stock: Number(prod?.current_stock ?? 9999),
            isCustomItem: isCustom,
            discount: 0,
            discountType: "fixed",
            warranty: it.warranty || undefined,
            batchNumber: it.batch_number || null,
            expiryDate: it.expiry_date || null,
            batchId: it.batch_id || null,
            shelfLocation: prod?.shelf_location || null,
            has_imei: !!prod?.has_imei,
            selectedImeis: parsedImeis,
            translated_names: prod?.translated_names || null,
          };
        });

        setCart(loadedItems);

        // Set discount
        const disc = Number(inv.discount || 0);
        setDiscount(disc);
        setDiscountType("fixed");

        // Set payment method
        if (inv.payment_mode) {
          setPaymentMode(inv.payment_mode as any);
        } else if (inv.status === "quotation") {
          setPaymentMode("quotation");
        }

        // Set received amount
        setReceivedAmount(Number(inv.paid_amount || 0));

        if (inv.remarks) {
          setRemarks(inv.remarks);
        }

        toast.success(`Loaded invoice #${inv.id.slice(0, 8).toUpperCase()} into POS for editing! ✏️`);
      } catch (err: any) {
        console.error("Failed to load invoice for editing:", err);
        toast.error("Failed to load invoice: " + err.message);
      } finally {
        if (isMounted) setIsLoadingEditInvoice(false);
      }
    }

    loadInvoiceForEdit(editParam);

    return () => {
      isMounted = false;
    };
  }, [editParam, shopId]);

  // Layout View State: grid vs search (persisted to localStorage)
  const [layoutView, setLayoutView] = useState<"grid" | "search">("search");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedSearchProductIndex, setSelectedSearchProductIndex] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && shopId) {
      const saved = localStorage.getItem(`pos_layout_view_${shopId}`);
      if (saved === "grid" || saved === "search") {
        setLayoutView(saved);
      }
    }
  }, [shopId]);

  const toggleLayoutView = () => {
    const nextView = layoutView === "grid" ? "search" : "grid";
    setLayoutView(nextView);
    if (typeof window !== "undefined" && shopId) {
      localStorage.setItem(`pos_layout_view_${shopId}`, nextView);
    }
  };

  // Pagination state
  const [page, setPage] = useState(1);

  // Reset to page 1 when search or category changes
  useEffect(() => {
    setPage(1);
    setSelectedGridIndex(-1);
  }, [searchQuery, selectedCategoryId]);

  // Calculations
  const grossSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalItemDiscount = cart.reduce((acc, item) => {
    const discVal = item.discount || 0;
    const gross = item.price * item.quantity;
    return acc + (item.discountType === "percentage" ? (gross * discVal) / 100 : discVal);
  }, 0);
  const subtotal = Math.max(0, grossSubtotal - totalItemDiscount);
  const taxAmount = taxType === "flat" ? taxRate : (subtotal * taxRate) / 100;
  const discountRupees = discountType === "percentage" ? (subtotal * discount) / 100 : discount;
  const tradeInDeduction = tradeInItem ? tradeInItem.agreedValue : 0;
  const total = Math.max(0, subtotal + taxAmount - discountRupees - appliedGiftCardAmount - tradeInDeduction);

  // Set receivedAmount to total when payment mode is Cash or Card
  useEffect(() => {
    if (paymentMode !== "credit") {
      setReceivedAmount(total);
    } else {
      setReceivedAmount(0);
    }
  }, [paymentMode, total]);

  // Receipt Modal State
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [whatsappInputPhone, setWhatsappInputPhone] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    if (isReceiptOpen && lastInvoice) {
      const selectedCustomer = selectedCustomerId !== "walkin" ? customers.find(c => c.id === selectedCustomerId) : null;
      setWhatsappInputPhone(selectedCustomer?.phone || "");
    }
  }, [isReceiptOpen, lastInvoice, selectedCustomerId, customers]);

  // Automatically sync scale weight changes with the most recent weight-based cart item
  useEffect(() => {
    if (scale.isConnected && scale.weight > 0) {
      setCart(prevCart => {
        let targetIndex = -1;
        for (let i = prevCart.length - 1; i >= 0; i--) {
          const item = prevCart[i];
          const product = products.find(p => p.id === item.productId);
          const unit = String(product?.unit || "").toLowerCase();
          const isWeightBased = ["kg", "gram", "grams", "tola", "masha", "ratti"].includes(unit);
          if (isWeightBased) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex > -1) {
          const updated = [...prevCart];
          if (updated[targetIndex].quantity !== scale.weight) {
            updated[targetIndex].quantity = scale.weight;
            return updated;
          }
        }
        return prevCart;
      });
    }
  }, [scale.weight, scale.isConnected, products]);
  const [receiptSettings, setReceiptSettings] = useState<any>(DEFAULT_RECEIPT_SETTINGS);
  const [shopDetails, setShopDetails] = useState<any>({ name: shopName || "The Accounts Store" });

  // Select Variant Modal State (when clicking a product with variants)
  const [activeProductForVariants, setActiveProductForVariants] = useState<DBProduct | null>(null);

  // Hydrate active session from localStorage instantly on mount
  useEffect(() => {
    if (typeof window !== "undefined" && shopId && userId) {
      const cached = localStorage.getItem(`pos_active_session_${shopId}_${userId}`);
      if (cached) {
        try {
          setActiveSession(JSON.parse(cached));
        } catch (e) {
          console.error("Failed to parse cached session:", e);
        }
      }
    }
  }, [shopId, userId]);

  useEffect(() => {
    if (!shopId || !userId) return;

    fetchData();

    // Cross-tab inventory synchronization (Multi-Tab Safe Billing)
    let inventoryChannel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        inventoryChannel = new BroadcastChannel("theaccounts_inventory_channel");
        inventoryChannel.onmessage = (event) => {
          if (
            event.data &&
            event.data.shopId === shopId &&
            (event.data.type === "PURCHASE_SAVED" || event.data.type === "STOCK_UPDATED" || event.data.type === "SALE_SAVED")
          ) {
            fetchData();
          }
        };
      } catch (e) {
        console.error("BroadcastChannel init failed in POS:", e);
      }
    }

    // Real-time subscription: refresh products on stock change, sessions on status change
    const channel = supabase
      .channel(`pos-realtime-${shopId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "register_sessions", filter: `shop_id=eq.${shopId}` },
        () => { fetchData(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (inventoryChannel) {
        try {
          inventoryChannel.close();
        } catch (e) {}
      }
    };
  }, [shopId, userId]);

  // Reset grid selection index when search query or category filters change
  useEffect(() => {
    setSelectedGridIndex(-1);
  }, [searchQuery, selectedCategoryId]);

  // Reset modal selection index when modal target changes
  useEffect(() => {
    setSelectedModalIndex(0);
  }, [activeProductForVariants]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Phase 3: if offline, hydrate from IndexedDB catalog snapshot
      if (isBrowserOffline() && shopId) {
        const snap = await loadCatalogSnapshot(shopId);
        if (snap && snap.products.length > 0) {
          setProducts(snap.products as DBProduct[]);
          setCustomers(snap.parties as Party[]);
          if (snap.cashAccounts?.length) setAccounts(snap.cashAccounts as any);
          if (snap.savedAt) setLastCatalogSync(snap.savedAt);
          
          // Hydrate register session from localStorage cache offline
          if (typeof window !== "undefined" && userId) {
            const cachedSession = localStorage.getItem(`pos_active_session_${shopId}_${userId}`);
            if (cachedSession) {
              try {
                setActiveSession(JSON.parse(cachedSession));
              } catch (e) {
                setActiveSession(null);
              }
            } else {
              setActiveSession(null);
            }
          }

          toast.message("Offline catalog loaded", {
            description: snap.savedAt
              ? `Cached ${new Date(snap.savedAt).toLocaleString()}`
              : "Using last saved product list",
          });
          setLoading(false);
          return;
        }
        toast.error("Offline and no cached catalog. Connect once to download products.");
        setLoading(false);
        return;
      }

      const ninetyDaysFromNow = new Date();
      ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

      const productSelectStr = `
        id, name, code, unit, sale_price_single, purchase_price_single, current_stock, min_stock_level, category_id, measurement_type, has_imei, formulation_id, warranty, translated_names, image_url, shelf_location, formulations(name),
        product_barcodes ( barcode ),
        product_variants ( 
          id, packing_name, sale_price, purchase_price, stock_quantity, is_packing, pack_size,
          product_barcodes ( barcode )
        )
      `;
      const productSelectBase = `
        id, name, code, unit, sale_price_single, purchase_price_single, current_stock, min_stock_level, category_id, measurement_type, has_imei, warranty, translated_names, shelf_location, formulations(name),
        product_barcodes ( barcode ),
        product_variants ( 
          id, packing_name, sale_price, purchase_price, stock_quantity, is_packing, pack_size,
          product_barcodes ( barcode )
        )
      `;

      // Parallelize initial database fetches
      const [
        initialProductsRes,
        partiesRes,
        categoriesRes,
        unitsRes,
        sessionsRes,
        accountsRes,
        printRes,
        companyRes,
        expiryRes,
        productBatchesRes,
        stockBatchesRes,
        poBatchesRes
      ] = await Promise.all([
        // 1. Initial Products Batch (fast 1000 items)
        supabase
          .from("products")
          .select(productSelectStr)
          .eq("shop_id", shopId)
          .order("name", { ascending: true })
          .limit(1000),

        // 2. Customers
        supabase
          .from("parties")
          .select("id, name, phone, current_balance, address, type, credit_limit, loyalty_points")
          .eq("shop_id", shopId)
          .in("type", ["customer", "dual"])
          .order("name", { ascending: true }),

        // 3. Categories
        supabase
          .from("categories")
          .select("id, name")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),

        // 4. Units
        supabase
          .from("units")
          .select("id, name, code, parent_unit_id, conversion_factor")
          .eq("shop_id", shopId),

        // 5. Active Register Session (Shop-wide Daybook Session)
        shopId
          ? supabase
              .from("register_sessions")
              .select("*")
              .eq("shop_id", shopId)
              .eq("status", "open")
              .order("opened_at", { ascending: false })
          : Promise.resolve({ data: null, error: null }),

        // 6. Cash Accounts
        supabase
          .from("cash_accounts")
          .select("id, name, current_balance")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),

        // 7. Print Settings
        supabase
          .from("print_settings")
          .select("receipt_page_size, receipt_font, receipt_font_size, receipt_design_settings")
          .eq("shop_id", shopId)
          .maybeSingle(),

        // 8. Company Details
        supabase
          .from("company_details")
          .select("name, address, phone, email, website, default_tax_rate, default_tax_type")
          .eq("shop_id", shopId)
          .maybeSingle(),

        // 9. Near-Expiry Batches (Pharmacy / Medical / Fertilizer only)
        (industryType === "pharmacy" || industryType === "medical" || industryType === "fertilizer")
          ? supabase
              .from("product_batches")
              .select("id, batch_number, expiry_date, stock_quantity, products(name)")
              .eq("shop_id", shopId)
              .gt("stock_quantity", 0)
              .lte("expiry_date", ninetyDaysFromNow.toISOString().split("T")[0])
              .order("expiry_date", { ascending: true })
              .limit(10)
          : Promise.resolve({ data: null, error: null }),

        // 10. All Batches from product_batches (Pharmacy / Medical / Fertilizer only)
        (industryType === "pharmacy" || industryType === "medical" || industryType === "fertilizer")
          ? supabase
              .from("product_batches")
              .select("id, product_id, batch_number, expiry_date, stock_quantity, purchase_price")
              .eq("shop_id", shopId)
              .order("expiry_date", { ascending: true })
          : Promise.resolve({ data: [], error: null }),

        // 11. All Batches from stock table (Pharmacy / Medical / Fertilizer only)
        (industryType === "pharmacy" || industryType === "medical" || industryType === "fertilizer")
          ? supabase
              .from("stock")
              .select("id, product_id, batch_number, expiry_date, quantity_single, quantity_pack")
              .eq("shop_id", shopId)
              .order("expiry_date", { ascending: true })
          : Promise.resolve({ data: [], error: null }),

        // 12. All Batches from purchase_order_items (Pharmacy / Medical / Fertilizer only)
        (industryType === "pharmacy" || industryType === "medical" || industryType === "fertilizer")
          ? supabase
              .from("purchase_order_items")
              .select("id, product_id, batch_number, expiry_date, quantity, purchase_orders!inner(shop_id)")
              .eq("purchase_orders.shop_id", shopId)
              .not("batch_number", "is", null)
              .order("expiry_date", { ascending: true })
          : Promise.resolve({ data: [], error: null })
      ]);

      // --- Process Initial Products ---
      let productsData = initialProductsRes.data;
      if (initialProductsRes.error) {
        const err = initialProductsRes.error;
        if (err.message?.includes("image_url") || err.hint?.includes("image_url")) {
          const fallbackRes = await supabase
            .from("products")
            .select(productSelectBase)
            .eq("shop_id", shopId)
            .order("name", { ascending: true })
            .limit(1000);
          productsData = (fallbackRes.data || []).map((p: any) => ({ ...p, image_url: null }));
        } else {
          console.warn("Error fetching initial products batch:", err);
          productsData = [];
        }
      }

      const initialList = productsData || [];
      setProducts(initialList);

      // If catalog has >= 1000 items, fetch remaining pages in background asynchronously
      if (initialList.length >= 1000 && shopId) {
        (async () => {
          try {
            let offset = 1000;
            const limit = 1000;
            let more = true;
            while (more) {
              const nextRes = await supabase
                .from("products")
                .select(productSelectStr)
                .eq("shop_id", shopId)
                .order("name", { ascending: true })
                .range(offset, offset + limit - 1);
              
              const chunk = nextRes.data || [];
              if (chunk.length > 0) {
                setProducts(prev => {
                  const existingIds = new Set(prev.map((p: any) => p.id));
                  const newItems = chunk.filter((p: any) => !existingIds.has(p.id));
                  return [...prev, ...newItems];
                });
              }
              more = chunk.length === limit;
              offset += limit;
              if (offset > 25000) break;
            }
          } catch (bgErr) {
            console.warn("Background product sync error:", bgErr);
          }
        })();
      }

      // --- Process Customers ---
      if (partiesRes.error) throw partiesRes.error;
      setCustomers(partiesRes.data || []);

      // Phase 3: catalog snapshot for offline sell
      if (shopId && productsData) {
        const syncTime = new Date().toISOString();
        saveCatalogSnapshot({
          shopId,
          products: productsData,
          parties: partiesRes.data || [],
          cashAccounts: accountsRes.data || [],
        }).then(() => {
          setLastCatalogSync(syncTime);
        }).catch(() => {});
      }

      // --- Process Categories ---
      if (!categoriesRes.error && categoriesRes.data) {
        setCategories(categoriesRes.data);
      }

      // --- Process Units ---
      if (!unitsRes.error && unitsRes.data) {
        setAllUnits(unitsRes.data);
      }

      // --- Process Batches (FEFO & Batch Inventory) ---
      const batchMap: Record<string, ProductBatch[]> = {};

      if (productBatchesRes && !productBatchesRes.error && productBatchesRes.data) {
        productBatchesRes.data.forEach((b: any) => {
          if (!b.product_id) return;
          if (!batchMap[b.product_id]) batchMap[b.product_id] = [];
          batchMap[b.product_id].push({
            id: b.id,
            product_id: b.product_id,
            batch_number: b.batch_number || null,
            expiry_date: b.expiry_date || null,
            stock_quantity: b.stock_quantity || 0,
            sale_price: b.sale_price,
            purchase_price: b.purchase_price,
          });
        });
      }

      if (stockBatchesRes && !stockBatchesRes.error && stockBatchesRes.data) {
        stockBatchesRes.data.forEach((s: any, idx: number) => {
          if (!s.product_id) return;
          const bNum = s.batch_number?.trim() || (s.expiry_date ? `EXP-${s.expiry_date}` : `B-${idx + 1}`);
          if (!batchMap[s.product_id]) batchMap[s.product_id] = [];
          const exists = batchMap[s.product_id].some(
            (b) => b.batch_number === bNum
          );
          if (!exists) {
            batchMap[s.product_id].push({
              id: s.id,
              product_id: s.product_id,
              batch_number: bNum,
              expiry_date: s.expiry_date || null,
              stock_quantity: (s.quantity_single || 0) + (s.quantity_pack || 0),
            });
          }
        });
      }

      if (poBatchesRes && !poBatchesRes.error && poBatchesRes.data) {
        poBatchesRes.data.forEach((p: any) => {
          if (!p.product_id || !p.batch_number) return;
          const bNum = p.batch_number.trim();
          if (!batchMap[p.product_id]) batchMap[p.product_id] = [];
          const exists = batchMap[p.product_id].some(
            (b) => b.batch_number === bNum
          );
          if (!exists) {
            batchMap[p.product_id].push({
              id: p.id,
              product_id: p.product_id,
              batch_number: bNum,
              expiry_date: p.expiry_date || null,
              stock_quantity: Number(p.quantity) || 1,
            });
          }
        });
      }

      // Guarantee fallback standard batch for any pharmacy/medical/fertilizer product so it never gets blocked from POS sales
      if (industryType === "pharmacy" || industryType === "medical" || industryType === "fertilizer") {
        (productsData || []).forEach((prod: any) => {
          if (!batchMap[prod.id] || batchMap[prod.id].length === 0) {
            batchMap[prod.id] = [{
              id: `std-${prod.id}`,
              product_id: prod.id,
              batch_number: "BATCH-01",
              expiry_date: null,
              stock_quantity: Number(prod.current_stock) || 0,
              sale_price: prod.sale_price_single,
              purchase_price: prod.purchase_price_single,
            }];
          }
        });
      }

      setProductBatches(batchMap);

      // Auto re-resolve and attach FEFO batches to any existing items in cart
      setCart(prevCart => {
        if (!prevCart || prevCart.length === 0) return prevCart;
        return prevCart.map(item => {
          const batches = batchMap[item.productId] || [];
          if (batches.length > 0) {
            const sorted = [...batches].sort((a, b) => {
              if (!a.expiry_date) return 1;
              if (!b.expiry_date) return -1;
              return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
            });
            const best = sorted.find(b => (b.stock_quantity || 0) > 0) || sorted[0];
            const isFallback = !item.batchNumber || item.batchNumber === "B-01" || item.batchNumber.startsWith("B-");
            if (isFallback && best) {
              return {
                ...item,
                batchNumber: best.batch_number,
                expiryDate: best.expiry_date || null,
                batchId: best.id || null,
                availableBatches: sorted,
              };
            }
            return {
              ...item,
              availableBatches: sorted,
            };
          }
          return item;
        });
      });

      // --- Process Register Session (Shop-wide Daybook) ---
      if (shopId && !sessionsRes.error) {
        const sessionData = sessionsRes.data && sessionsRes.data.length > 0 ? sessionsRes.data[0] : null;
        if (sessionData) {
          setActiveSession(sessionData);
          if (typeof window !== "undefined") {
            localStorage.setItem(`pos_active_session_${shopId}`, JSON.stringify(sessionData));
          }
        } else {
          setActiveSession(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem(`pos_active_session_${shopId}`);
          }
          // Fetch last closed session closing balance OR cash in hand account balance
          const { data: lastSession } = await supabase
            .from("register_sessions")
            .select("closing_balance")
            .eq("shop_id", shopId)
            .eq("status", "closed")
            .order("closed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastSession && lastSession.closing_balance !== null && Number(lastSession.closing_balance) > 0) {
            setOpeningFloat(lastSession.closing_balance.toString());
          } else {
            const cashAcc = accountsRes.data?.find((a: any) => a.type === "cash" || a.name?.toLowerCase().includes("cash"));
            if (cashAcc && Number(cashAcc.current_balance) > 0) {
              setOpeningFloat(Number(cashAcc.current_balance).toString());
            } else {
              setOpeningFloat("0");
            }
          }
        }
      }

      // --- Process Cash Accounts ---
      let accountsData = accountsRes.data;
      if (!accountsRes.error) {
        if (!accountsData || accountsData.length === 0) {
          const defaultAccounts = [
            { shop_id: shopId, name: "Cash in Hand", type: "cash", current_balance: 0 }
          ];
          const { data: newAccounts } = await supabase
            .from("cash_accounts")
            .insert(defaultAccounts)
            .select("id, name, current_balance");
          
          if (newAccounts && newAccounts.length > 0) {
            accountsData = newAccounts.sort((a: any, b: any) => a.name.localeCompare(b.name));
          }
        }
        if (accountsData && accountsData.length > 0) {
          setAccounts(accountsData);
          const cashInHandAcc = accountsData.find((a: any) => a.name.toLowerCase() === "cash in hand");
          setSelectedAccountId(cashInHandAcc ? cashInHandAcc.id : accountsData[0].id);
        }
      }

      // --- Process Print Settings ---
      if (!printRes.error && printRes.data) {
        const storedCustomSettings = printRes.data.receipt_design_settings || {};
        setReceiptSettings({
          ...DEFAULT_RECEIPT_SETTINGS,
          pageSize: (printRes.data.receipt_page_size as any) || DEFAULT_RECEIPT_SETTINGS.pageSize,
          fontFamily: printRes.data.receipt_font || DEFAULT_RECEIPT_SETTINGS.fontFamily,
          fontSize: printRes.data.receipt_font_size || DEFAULT_RECEIPT_SETTINGS.fontSize,
          ...storedCustomSettings
        });
      }

      // --- Process Company Details ---
      if (!companyRes.error && companyRes.data) {
        setShopDetails(companyRes.data);
        if (!editingInvoiceId) {
          setTaxRate(Number(companyRes.data.default_tax_rate) || 0);
          setTaxType(companyRes.data.default_tax_type || "percentage");
        }
      } else {
        setShopDetails({ name: shopName || "The Accounts Store" });
      }

      // --- Process Expiry Alerts ---
      if (industryType === "pharmacy" && !expiryRes.error && expiryRes.data) {
        setNearExpiryAlerts(expiryRes.data.map((b: any) => ({
          id: b.id,
          batch_number: b.batch_number,
          expiry_date: b.expiry_date,
          stock_quantity: b.stock_quantity,
          product_name: b.products?.name || "Unknown Product"
        })));
      }

    } catch (err: any) {
      toast.error("Failed to load POS data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) {
      toast.error("Shop context missing");
      return;
    }

    // Offline guard for opening register
    if (isBrowserOffline()) {
      toast.error("Internet connection required to start a new Daybook session. Please reconnect.");
      return;
    }

    setIsOpeningRegister(true);
    try {
      const { data, error } = await supabase
        .from("register_sessions")
        .insert({
          shop_id: shopId,
          user_id: userId || null,
          opening_balance: Number(openingFloat) || 0,
          status: "open",
          session_type: "DAILY",
          opened_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data);
      if (typeof window !== "undefined") {
        localStorage.setItem(`pos_active_session_${shopId}`, JSON.stringify(data));
      }
      setOpeningFloat("");
      toast.success("Daybook opened successfully! All cashiers can now bill.");
    } catch (err: any) {
      toast.error("Failed to open Daybook: " + err.message);
    } finally {
      setIsOpeningRegister(false);
    }
  };

  const fetchShiftStats = async () => {
    if (!activeSession || !shopId) return;
    setLoadingShiftStats(true);
    try {
      const sessionStart = activeSession.opened_at;

      const [invRes, khataRes, expRes, poRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("total_amount, paid_amount, status, payment_mode, register_session_id, created_at")
          .eq("shop_id", shopId)
          .eq("is_voided", false)
          .or(`register_session_id.eq.${activeSession.id},created_at.gte.${sessionStart}`),
        supabase
          .from("credit_transactions")
          .select("amount, transaction_type, created_at")
          .eq("shop_id", shopId)
          .eq("transaction_type", "payment")
          .gte("created_at", sessionStart),
        supabase
          .from("expenses")
          .select("amount, payment_mode, register_session_id, created_at")
          .eq("shop_id", shopId)
          .or(`register_session_id.eq.${activeSession.id},created_at.gte.${sessionStart}`),
        supabase
          .from("purchase_orders")
          .select("paid_amount, payment_mode, created_at")
          .eq("shop_id", shopId)
          .neq("payment_mode", "credit")
          .gt("paid_amount", 0)
          .gte("created_at", sessionStart)
          .eq("is_voided", false)
      ]);

      if (invRes.error) throw invRes.error;
      
      const filteredInvoices = (invRes.data || []).filter(
        (inv: any) => inv.register_session_id === activeSession.id || (inv.created_at && inv.created_at >= sessionStart)
      );
      setShiftInvoices(filteredInvoices);

      // Calculate Khata Cash Wasooli (Payments received from customers)
      let kIn = 0;
      if (khataRes.data) {
        khataRes.data.forEach((tx: any) => {
          kIn += Number(tx.amount || 0);
        });
      }
      setShiftKhataIn(kIn);
      setShiftKhataOut(0);

      // Calculate Cash Expenses
      let expTotal = 0;
      if (expRes.data) {
        expRes.data.forEach((e: any) => {
          // Only count cash drawer expenses (ignore bank/card/online)
          const mode = (e.payment_mode || "cash").toLowerCase();
          if (mode === "cash" || mode === "cash_in_hand" || mode === "counter") {
            expTotal += Number(e.amount || 0);
          }
        });
      }
      setShiftExpenses(expTotal);

      // Calculate Cash Purchases
      let poTotal = 0;
      if (poRes.data) {
        poRes.data.forEach((p: any) => {
          const mode = (p.payment_mode || "cash").toLowerCase();
          if (mode === "cash" || mode === "cash_in_hand") {
            poTotal += Number(p.paid_amount || 0);
          }
        });
      }
      setShiftPurchases(poTotal);

    } catch (err: any) {
      console.error("Failed to load Daybook stats:", err);
      toast.error("Failed to load Daybook cash details: " + err.message);
    } finally {
      setLoadingShiftStats(false);
    }
  };

  const handleOpenCloseRegisterModal = () => {
    setIsCloseRegisterOpen(true);
    setClosingNote("");
    fetchShiftStats();
  };

  const handleCloseRegister = async () => {
    if (!activeSession) return;
    setIsClosingRegister(true);
    try {
      const cashSales = shiftInvoices
        .filter(inv => inv.payment_mode === "cash" || (inv.payment_mode === "credit" && Number(inv.paid_amount || 0) > 0))
        .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);

      const calculatedClosingCash = Math.max(0, 
        Number(activeSession.opening_balance) + 
        cashSales + 
        shiftKhataIn - 
        shiftExpenses - 
        shiftPurchases
      );

      const { error } = await supabase
        .from("register_sessions")
        .update({
          closing_balance: calculatedClosingCash,
          closed_at: new Date().toISOString(),
          status: "closed"
        })
        .eq("id", activeSession.id);

      if (error) throw error;
      setActiveSession(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(`pos_active_session_${shopId}`);
      }
      setIsCloseRegisterOpen(false);
      toast.success("Daybook closed successfully!");
      setCart([]);
    } catch (err: any) {
      toast.error("Failed to close Daybook: " + err.message);
    } finally {
      setIsClosingRegister(false);
    }
  };

  const loadInvoiceForEditing = async (invoiceId: string) => {
    if (permissions?.actions?.edit_bill === false) {
      toast.error("Access Denied: You do not have permission to edit bills.");
      return;
    }
    try {
      setLoading(true);
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invError) throw invError;

      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId);

      if (itemsError) throw itemsError;

      const cartItems: CartItem[] = [];
      for (const it of items) {
        const product = products.find(p => p.id === it.product_id);
        if (!product) continue;

        let purchasePrice = product.purchase_price_single || 0;
        let packingName: string | undefined = undefined;
        let stock = product.current_stock || 0;
        if (it.variant_id) {
          const variant = product.product_variants?.find(v => v.id === it.variant_id);
          if (variant) {
            packingName = variant.packing_name;
            stock = variant.stock_quantity;
            purchasePrice = variant.purchase_price || 0;
          }
        }

        const gross = Number(it.unit_price) * Number(it.quantity);
        const net = it.subtotal !== null ? Number(it.subtotal) : gross;
        const discountAmount = Math.max(0, gross - net);

        cartItems.push({
          productId: it.product_id,
          variantId: it.variant_id || undefined,
          name: product.name,
          packingName,
          price: Number(it.unit_price),
          purchasePrice: Number(purchasePrice),
          quantity: Number(it.quantity),
          stock: Number(stock),
          translated_names: product.translated_names,
          discount: discountAmount,
          discountType: "fixed",
          batchNumber: it.batch_number || null,
          expiryDate: it.expiry_date || null,
          batchId: it.batch_id || null,
          shelfLocation: it.shelf_location || product.shelf_location || null,
        });
      }

      setCart(cartItems);
      setSelectedCustomerId(invoice.party_id || "walkin");
      setDiscount(Number(invoice.discount) || 0);
      setRemarks(invoice.remarks || "");
      
      const invSubtotal = cartItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const calculatedTaxRate = invSubtotal > 0 ? (Number(invoice.tax_amount) * 100) / invSubtotal : 0;
      setTaxRate(Math.round(calculatedTaxRate * 100) / 100);

      if (invoice.status === "paid") {
        setPaymentMode("cash");
        setReceivedAmount(Number(invoice.paid_amount) || Number(invoice.total_amount));
      } else {
        setPaymentMode("credit");
        setReceivedAmount(Number(invoice.paid_amount) || 0);
      }

      setEditingInvoiceId(invoiceId);
      toast.success(`Loaded invoice #${invoiceId.slice(0, 8).toUpperCase()} for editing!`);
    } catch (err: any) {
      toast.error("Failed to load invoice: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadQuotationToCart = async (quotationId: string) => {
    try {
      setLoading(true);
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (invError) throw invError;

      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", quotationId);

      if (itemsError) throw itemsError;

      const cartItems: CartItem[] = [];
      for (const it of items) {
        const product = products.find(p => p.id === it.product_id);
        if (!product) continue;

        let purchasePrice = product.purchase_price_single || 0;
        let packingName: string | undefined = undefined;
        let stock = product.current_stock || 0;
        if (it.variant_id) {
          const variant = product.product_variants?.find(v => v.id === it.variant_id);
          if (variant) {
            packingName = variant.packing_name;
            stock = variant.stock_quantity;
            purchasePrice = variant.purchase_price || 0;
          }
        }

        const gross = Number(it.unit_price) * Number(it.quantity);
        const net = it.subtotal !== null ? Number(it.subtotal) : gross;
        const discountAmount = Math.max(0, gross - net);

        cartItems.push({
          productId: it.product_id,
          variantId: it.variant_id || undefined,
          name: product.name,
          packingName: it.packing_name || packingName,
          price: Number(it.unit_price),
          purchasePrice: Number(purchasePrice),
          quantity: Number(it.quantity),
          stock: Number(stock),
          translated_names: product.translated_names,
          discount: discountAmount,
          discountType: "fixed"
        });
      }

      setCart(cartItems);
      setSelectedCustomerId(invoice.party_id || "walkin");
      setDiscount(Number(invoice.discount) || 0);
      setRemarks(invoice.remarks || "");
      
      const invSubtotal = cartItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const calculatedTaxRate = invSubtotal > 0 ? (Number(invoice.tax_amount) * 100) / invSubtotal : 0;
      setTaxRate(Math.round(calculatedTaxRate * 100) / 100);
      setPaymentMode("cash");
      setReceivedAmount(0);

      toast.success(`Loaded quotation #${quotationId.slice(0, 8).toUpperCase()}! Ready to complete sale.`);
      
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/dashboard/pos");
      }
    } catch (err: any) {
      toast.error("Failed to load quotation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      if (editId && products.length > 0 && allUnits.length > 0 && !editingInvoiceId) {
        loadInvoiceForEditing(editId);
      }

      const quotationId = params.get("load_quotation");
      if (quotationId && products.length > 0 && allUnits.length > 0 && cart.length === 0) {
        loadQuotationToCart(quotationId);
      }
    }
  }, [products, allUnits, editingInvoiceId, cart.length]);

  // Helper: Get both manual variants and automatic unit-relation subunits for a product
  const getProductUnitOptions = (product: DBProduct) => {
    const options: { 
      id: string; 
      name: string; 
      price: number; 
      purchasePrice: number;
      stock: number; 
      isAutoSubunit: boolean; 
      conversionFactor: number; 
      type: "multiplier" | "divisor" 
    }[] = [];

    const productUnitCode = product.unit?.toLowerCase() || "";
    const baseUnit = allUnits.find(u => u.code.toLowerCase() === productUnitCode);

    if (industryType === "karyana" && baseUnit) {
      const subUnits = allUnits.filter(u => u.parent_unit_id === baseUnit.id);
      
      for (const sub of subUnits) {
        const cCode = sub.code.toLowerCase();
        const pCode = baseUnit.code.toLowerCase();
        
        // Division condition (e.g. Gram under Kilogram, or Milliliter under Liter)
        const isDivisor = 
          ((cCode === "g" || cCode.startsWith("gram")) && (pCode === "kg" || pCode.startsWith("kilo"))) ||
          ((cCode === "ml" || cCode.startsWith("milli")) && (pCode === "ltr" || pCode === "lit" || pCode.startsWith("liter")));

        const factor = Number(sub.conversion_factor) || 1;
        let price = product.sale_price_single;
        let stock = product.current_stock;
        let subPurchasePrice = product.purchase_price_single || 0;

        if (isDivisor) {
          price = product.sale_price_single / factor;
          stock = product.current_stock * factor;
          subPurchasePrice = (product.purchase_price_single || 0) / factor;
        } else {
          price = product.sale_price_single * factor;
          stock = product.current_stock / factor;
          subPurchasePrice = (product.purchase_price_single || 0) * factor;
        }

        options.push({
          id: `auto-${sub.id}`,
          name: sub.name,
          price: Math.round(price * 100) / 100, 
          purchasePrice: Math.round(subPurchasePrice * 100) / 100,
          stock: Math.floor(stock * 100) / 100,
          isAutoSubunit: true,
          conversionFactor: factor,
          type: isDivisor ? "divisor" : "multiplier"
        });
      }
    }

    if (product.product_variants && product.product_variants.length > 0) {
      for (const v of product.product_variants) {
        // Skip bogus / zero-price 1-pack carton variants that duplicate base unit
        if (v.is_packing && (v.pack_size === 1 || !v.pack_size) && (!v.sale_price || v.sale_price === 0)) {
          continue;
        }
        if (!options.some(o => o.name.toLowerCase() === v.packing_name.toLowerCase())) {
          const isPacking = !!v.is_packing;
          const factor = isPacking && v.pack_size ? v.pack_size : 1;
          const stockVal = isPacking && v.pack_size ? Math.floor(product.current_stock / v.pack_size) : v.stock_quantity;

          options.push({
            id: v.id,
            name: v.packing_name,
            price: v.sale_price,
            purchasePrice: v.purchase_price || 0,
            stock: stockVal,
            isAutoSubunit: false,
            conversionFactor: factor,
            type: "multiplier"
          });
        }
      }
    }

    // Automatic pack / box resolution for Pharmacy products with pack_size
    if (industryType === "pharmacy" && product.pack_size && Number(product.pack_size) > 1) {
      const pSize = Number(product.pack_size);
      const hasExistingPack = options.some(
        o => o.conversionFactor === pSize || 
             o.name.toLowerCase().includes("box") || 
             o.name.toLowerCase().includes("pack")
      );
      if (!hasExistingPack) {
        const packPrice = Math.round(product.sale_price_single * pSize * 100) / 100;
        const packPurchasePrice = Math.round((product.purchase_price_single || 0) * pSize * 100) / 100;
        const packStock = Math.floor((product.current_stock || 0) / pSize);
        options.push({
          id: `auto-pack-${product.id}`,
          name: `Box (${pSize} ${product.unit || "pcs"})`,
          price: packPrice,
          purchasePrice: packPurchasePrice,
          stock: packStock,
          isAutoSubunit: false,
          conversionFactor: pSize,
          type: "multiplier"
        });
      }
    }

    return options;
  };

  const filteredProducts = React.useMemo(() => {
    return filterAndRankProducts(products, searchQuery, {
      categoryId: selectedCategoryId
    });
  }, [products, searchQuery, selectedCategoryId]);

  const paginatedProducts = React.useMemo(() => {
    return filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredProducts, page]);

  // Auto-select first item when searching in Grid View
  useEffect(() => {
    if (searchQuery.trim() !== "") {
      setSelectedGridIndex(0);
      setSelectedGridUnitIndex(0);
    } else {
      setSelectedGridIndex(-1);
      setSelectedGridUnitIndex(0);
    }
  }, [searchQuery, filteredProducts.length]);

  const autocompleteResults = React.useMemo(() => {
    if (searchQuery.trim() === "") return [];
    return filteredProducts.slice(0, 10);
  }, [filteredProducts, searchQuery]);

  // Dynamic remote search fallback: if searchQuery is typed, ensure database items not in memory are retrieved
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2 || !shopId) return;

    const timer = setTimeout(async () => {
      try {
        const tokens = trimmed.split(/\s+/).filter(Boolean);
        let q = supabase
          .from("products")
          .select(`
            id, name, code, unit, sale_price_single, purchase_price_single, current_stock, min_stock_level, category_id, measurement_type, has_imei, formulation_id, warranty, translated_names, image_url, shelf_location, formulations(name),
            product_barcodes ( barcode ),
            product_variants ( 
              id, packing_name, sale_price, purchase_price, stock_quantity, is_packing, pack_size,
              product_barcodes ( barcode )
            )
          `)
          .eq("shop_id", shopId);

        if (tokens.length === 1) {
          q = q.or(`name.ilike.%${tokens[0]}%,code.ilike.%${tokens[0]}%,shelf_location.ilike.%${tokens[0]}%`);
        } else {
          for (const token of tokens) {
            q = q.or(`name.ilike.%${token}%,code.ilike.%${token}%,shelf_location.ilike.%${token}%`);
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
      } catch (e) {
        console.warn("Dynamic remote search error:", e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, shopId, supabase]);

  const handleConfirmHardwareCalculation = (wastagePercent: number = 0) => {
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
    // Apply wastage factor
    if (wastagePercent > 0) {
      totalQty = totalQty * (1 + wastagePercent / 100);
    }
    // Round to 3 decimal places to avoid float errors
    totalQty = Math.round(totalQty * 1000) / 1000;


    // Human-readable dimension string e.g. "3 ft 4 in"
    const fmtFtIn = (ft: number, inches: number) => {
      const parts: string[] = [];
      if (ft > 0) parts.push(`${ft} ft`);
      if (inches > 0) parts.push(`${inches} in`);
      return parts.length > 0 ? parts.join(' ') : '0 ft';
    };
    const descSuffix = isDimension
      ? `${fmtFtIn(hardwareCalcLengthFt, hardwareCalcLengthIn)} × ${fmtFtIn(hardwareCalcWidthFt, hardwareCalcWidthIn)} (${hardwareCalcQty} pcs)`
      : `${fmtFtIn(hardwareCalcLengthFt, hardwareCalcLengthIn)} (${hardwareCalcQty} pcs)`;

    const price = hardwareCalcProduct.sale_price_single;
    const stock = hardwareCalcProduct.current_stock;
    const purchasePrice = hardwareCalcProduct.purchase_price_single || 0;

    const existingIndex = cart.findIndex(item => 
      item.productId === hardwareCalcProduct.id && 
      item.packingName === descSuffix
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      if (allowNegativeStock || updated[existingIndex].quantity + totalQty <= stock) {
        updated[existingIndex].quantity += totalQty;
        setCart(updated);
        toast.success(`Incremented ${hardwareCalcProduct.name} - ${descSuffix}`);
      } else {
        toast.warning(`Cannot exceed available stock of ${stock}`);
      }
    } else {
      if (!allowNegativeStock && stock <= 0) {
        toast.warning(`${hardwareCalcProduct.name} is out of stock!`);
        return;
      }
      setCart([
        ...cart,
        {
          productId: hardwareCalcProduct.id,
          name: hardwareCalcProduct.name,
          packingName: descSuffix,
          price,
          purchasePrice,
          quantity: totalQty,
          stock,
          translated_names: hardwareCalcProduct.translated_names,
          note: hardwareCalcProduct.note,
          discount: 0,
          discountType: "percentage"
        }
      ]);
      toast.success(`Added ${hardwareCalcProduct.name} (${descSuffix}) to cart`);
    }

    setHardwareCalcProduct(null);
  };

  // Add Product to Cart via Card Click or Voice POS (triggers modal if options exist)
  const handleAddProductToCart = (product: DBProduct, option?: any, matchedImei?: any, customQty?: number) => {
    // Intercept for IMEI tracking
    if (product.has_imei) {
      if (matchedImei) {
        // Adding specific scanned IMEI
        const existingIndex = cart.findIndex(item => item.productId === product.id && !item.variantId);
        if (existingIndex > -1) {
          const item = cart[existingIndex];
          const imeis = item.selectedImeis || [];
          if (imeis.some((i: any) => i.id === matchedImei.id)) {
            toast.error(`IMEI ${matchedImei.imei1} is already in the cart!`);
            return;
          }
          const updated = [...cart];
          updated[existingIndex].selectedImeis = [...imeis, matchedImei];
          updated[existingIndex].quantity = (item.selectedImeis?.length || 0) + 1;
          setCart(updated);
          toast.success(`Added IMEI ${matchedImei.imei1} to ${product.name}`);
        } else {
          setCart([
            ...cart,
            {
              productId: product.id,
              name: product.name,
              price: product.sale_price_single,
              purchasePrice: product.purchase_price_single || 0,
              quantity: 1,
              stock: product.current_stock,
              warranty: product.warranty || "",
              has_imei: true,
              selectedImeis: [matchedImei],
              translated_names: product.translated_names,
              note: product.note,
              discount: 0,
              discountType: "percentage"
            }
          ]);
          toast.success(`Added ${product.name} (IMEI: ${matchedImei.imei1}) to cart`);
        }
      } else {
        // Manual click: Open IMEI selector modal
        setImeiModalProduct(product);
        setLoadingImeis(true);
        setIsImeiSelectModalOpen(true);
        
        const existingItem = cart.find(item => item.productId === product.id && !item.variantId);
        const preSelected = existingItem?.selectedImeis || [];
        setSelectedImeisForItem(preSelected);

        supabase
          .from("product_imeis")
          .select("*")
          .eq("product_id", product.id)
          .eq("status", "available")
          .then(({ data, error }: any) => {
            if (error) {
              toast.error("Failed to load available IMEIs: " + error.message);
            } else {
              const merged = [...(data || [])];
              preSelected.forEach((ps: any) => {
                if (!merged.some((m: any) => m.id === ps.id)) {
                  merged.push(ps);
                }
              });
              setAvailableImeis(merged);
            }
            setLoadingImeis(false);
          });
      }
      return;
    }

    // Intercept for Hardware Dimension/Length Calculator
    if (industryType === "hardware" && (product.measurement_type === "dimension" || product.measurement_type === "length")) {
      if (!option) {
        setHardwareCalcProduct(product);
        setHardwareCalcLengthFt(0);
        setHardwareCalcLengthIn(0);
        setHardwareCalcWidthFt(0);
        setHardwareCalcWidthIn(0);
        setHardwareCalcQty(1);
        setHardwareCalcWastage(0);
        return;
      }
    }

    const options = getProductUnitOptions(product);
    if (!option && options.length > 0) {
      setActiveProductForVariants(product);
      return;
    }

    const variantId = option?.id;
    const price = option ? option.price : product.sale_price_single;
    const stock = option ? option.stock : product.current_stock;
    const packingName = option ? option.name : undefined;
    const isAutoSubunit = option ? option.isAutoSubunit : false;
    const conversionFactor = option ? option.conversionFactor : 1;
    const unitType = option ? option.type : "multiplier";

    // FEFO (First Expired, First Out) Batch Resolution
    const available = productBatches[product.id] || [];
    const sortedBatches = [...available].sort((a, b) => {
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
    });

    const defaultBatch = sortedBatches.find(b => (b.stock_quantity || 0) > 0) || sortedBatches[0];
    const resolvedBatchNumber = defaultBatch?.batch_number || null;
    const resolvedExpiryDate = defaultBatch?.expiry_date || null;
    const resolvedBatchId = defaultBatch?.id || null;

    // Expiry check warning on adding to cart
    if (resolvedExpiryDate) {
      const exp = new Date(resolvedExpiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (exp < today) {
        toast.warning(`⚠️ Warning: Batch ${resolvedBatchNumber || "Assigned"} of ${product.name} is EXPIRED (${resolvedExpiryDate})!`);
      }
    }

    const existingIndex = cart.findIndex(item => 
      variantId 
        ? item.productId === product.id && item.variantId === variantId && item.batchNumber === resolvedBatchNumber
        : item.productId === product.id && !item.variantId && item.batchNumber === resolvedBatchNumber
    );

    const isWeightBased = ["kg", "gram", "grams", "tola", "masha", "ratti"].includes(String(product.unit || "").toLowerCase());
    const addQty = (typeof customQty === "number" && customQty > 0) ? customQty : 1;
    const initialQty = (isWeightBased && scale.isConnected && scale.weight > 0) ? scale.weight : addQty;

    if (existingIndex > -1) {
      const updated = [...cart];
      if (allowNegativeStock || updated[existingIndex].quantity < stock) {
        if (isWeightBased && scale.isConnected && scale.weight > 0) {
          updated[existingIndex].quantity = scale.weight;
          toast.success(`Updated ${product.name} weight to ${scale.weight} kg`);
        } else {
          updated[existingIndex].quantity += addQty;
          toast.success(`Incremented ${product.name} (+${addQty})`);
        }
        setCart(updated);
      } else {
        toast.warning(`Cannot exceed available stock of ${stock}`);
      }
    } else {
      if (!allowNegativeStock && stock <= 0) {
        toast.warning(`${product.name} (${packingName || product.unit || "Base"}) is out of stock!`);
        return;
      }
      setCart([
        ...cart,
        {
          productId: product.id,
          variantId,
          name: product.name,
          packingName,
          price,
          purchasePrice: option ? option.purchasePrice : (product.purchase_price_single || 0),
          quantity: initialQty,
          stock,
          isAutoSubunit,
          conversionFactor,
          unitType,
          warranty: product.warranty || "",
          translated_names: product.translated_names,
          note: product.note,
          discount: 0,
          discountType: "percentage",
          batchNumber: resolvedBatchNumber,
          expiryDate: resolvedExpiryDate,
          batchId: resolvedBatchId,
          availableBatches: sortedBatches,
          shelfLocation: product.shelf_location || null,
        }
      ]);
      toast.success(`Added ${product.name} (Qty: ${initialQty}) to cart`);
    }
    
    setActiveProductForVariants(null);
  };

  // Confirm IMEI selection from the modal and add/update cart item
  const handleConfirmImeiSelection = () => {
    if (!imeiModalProduct) return;
    if (selectedImeisForItem.length === 0) {
      toast.warning("Please select at least one IMEI.");
      return;
    }
    const existingIndex = cart.findIndex(item => item.productId === imeiModalProduct.id && !item.variantId);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].selectedImeis = selectedImeisForItem;
      updated[existingIndex].quantity = selectedImeisForItem.length;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productId: imeiModalProduct.id,
          name: imeiModalProduct.name,
          price: imeiModalProduct.sale_price_single,
          purchasePrice: imeiModalProduct.purchase_price_single || 0,
          quantity: selectedImeisForItem.length,
          stock: imeiModalProduct.current_stock,
          warranty: imeiModalProduct.warranty || "",
          has_imei: true,
          selectedImeis: selectedImeisForItem,
          translated_names: imeiModalProduct.translated_names,
          note: imeiModalProduct.note,
          discount: 0,
          discountType: "percentage",
          shelfLocation: imeiModalProduct.shelf_location || null,
        }
      ]);
    }
    toast.success(`Added ${selectedImeisForItem.length} item(s) with IMEI to cart`);
    setIsImeiSelectModalOpen(false);
    setImeiModalProduct(null);
    setImeiSearchQuery("");
    setSelectedImeisForItem([]);
  };

  // Add Product Base Unit Directly (bypassing modal for chips)
  const handleAddBaseUnitDirectly = (product: DBProduct) => {
    // Intercept for Hardware Dimension/Length Calculator
    if (industryType === "hardware" && (product.measurement_type === "dimension" || product.measurement_type === "length")) {
      setHardwareCalcProduct(product);
      setHardwareCalcLengthFt(0);
      setHardwareCalcLengthIn(0);
      setHardwareCalcWidthFt(0);
      setHardwareCalcWidthIn(0);
      setHardwareCalcQty(1);
      return;
    }

    handleAddProductToCart(product, {
      id: undefined,
      name: product.unit || "Base",
      price: product.sale_price_single,
      purchasePrice: product.purchase_price_single || 0,
      stock: product.current_stock,
      isAutoSubunit: false,
      conversionFactor: 1,
      type: "multiplier"
    });
  };

  // Global Barcode Buffer State
  const barcodeBufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);

  const handleGlobalBarcodeScan = async (scannedCode: string) => {
    try {
      // 1. Check if query matches any IMEI number (regardless of status)
      const { data: imeiMatch } = await supabase
        .from("product_imeis")
        .select("*")
        .eq("shop_id", shopId)
        .or(`imei1.eq."${scannedCode}",imei2.eq."${scannedCode}"`)
        .maybeSingle();

      if (imeiMatch) {
        if (imeiMatch.status === "sold") {
          toast.error(`⚠️ IMEI ${scannedCode} is already sold / پہلے سے فروخت شدہ ہے!`);
          return;
        }
        const parentProd = products.find(p => p.id === imeiMatch.product_id);
        if (parentProd) {
          handleAddProductToCart(parentProd, undefined, {
            id: imeiMatch.id,
            imei1: imeiMatch.imei1,
            imei2: imeiMatch.imei2
          });
          toast.success(`Scanned IMEI: ${parentProd.name}`);
          return;
        }
      }

      // 2. Normal barcode lookup
      const lowerQuery = scannedCode.toLowerCase();
      let matchedProduct: any = null;
      let matchedVariant: any = null;
      
      for (const p of products) {
        if (p.code && p.code.toLowerCase() === lowerQuery) {
          matchedProduct = p;
          break;
        }
        if (p.product_barcodes && p.product_barcodes.some((b: any) => b.barcode.toLowerCase() === lowerQuery)) {
          matchedProduct = p;
          break;
        }
        if (p.product_variants) {
          const vMatch = p.product_variants.find((v: any) => 
            v.product_barcodes && v.product_barcodes.some((b: any) => b.barcode.toLowerCase() === lowerQuery)
          );
          if (vMatch) {
            matchedProduct = p;
            matchedVariant = vMatch;
            break;
          }
        }
      }
      
      if (matchedProduct) {
        if (matchedVariant) {
          const options = getProductUnitOptions(matchedProduct);
          const opt = options.find((o: any) => o.id === matchedVariant.id) || {
            id: matchedVariant.id,
            name: matchedVariant.packing_name,
            price: matchedVariant.sale_price,
            purchasePrice: matchedVariant.purchase_price || 0,
            stock: matchedVariant.stock_quantity
          };
          handleAddProductToCart(matchedProduct, opt);
        } else {
          handleAddBaseUnitDirectly(matchedProduct);
        }
        return;
      }

      // 3. Fallback: single item grid match or top-ranked multi-token match
      if (filteredProducts.length > 0 && matchProductTokens(filteredProducts[0], scannedCode)) {
        const prod = filteredProducts[0];
        const options = getProductUnitOptions(prod);
        if (options.length > 0) {
          setActiveProductForVariants(prod);
        } else {
          handleAddBaseUnitDirectly(prod);
        }
        return;
      }

      toast.error(`Barcode/IMEI not found: ${scannedCode}`);
    } catch (err) {
      console.error("Barcode scan error:", err);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.key) return;
      const activeEl = document.activeElement;

      // Global Barcode Scanner Intercept
      const currentTime = new Date().getTime();
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (currentTime - lastKeyTimeRef.current > 50) {
          barcodeBufferRef.current = "";
        }
        barcodeBufferRef.current += e.key;
        lastKeyTimeRef.current = currentTime;
      }

      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length >= 3 && currentTime - lastKeyTimeRef.current < 50) {
          e.preventDefault();
          const scannedCode = barcodeBufferRef.current;
          barcodeBufferRef.current = "";
          
          if (activeEl?.tagName === "INPUT" && (activeEl as HTMLInputElement).value !== undefined) {
             (activeEl as HTMLInputElement).value = "";
             setSearchQuery("");
             if (activeEl.id === "pos-search-input") (activeEl as HTMLElement).blur();
          }
          
          handleGlobalBarcodeScan(scannedCode);
          return;
        }
        barcodeBufferRef.current = "";
      }

      const isEditingInputOrSelect = 
        (activeEl?.tagName === "INPUT" && activeEl.id !== "pos-search-input" && activeEl.id !== "pos-customer-search-input") || 
        activeEl?.tagName === "SELECT";

      if (isEditingInputOrSelect) {
        const isAltMultiTab = e.altKey && (
          e.key.toLowerCase() === "t" ||
          e.key.toLowerCase() === "w" ||
          (e.key >= "1" && e.key <= "9")
        );
        const allowedKeys = ["F1", "F2", "F3", "F4", "F7", "F8", "F9", "F10", "Escape"];
        if (!allowedKeys.includes(e.key) && !isAltMultiTab) {
          return;
        }
      }

      // ── Multi-Tab POS Hotkeys (Desktop-style instant bill switching) ──
      // Alt+T: New Bill Tab
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleNewTab();
        return;
      }

      // Alt+W: Close Current Bill Tab
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        handleCloseTab(activeTabId);
        return;
      }

      // Alt+1 .. Alt+9: Switch directly to Bill #1..#9
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= "1" && e.key <= "9") {
        const targetIdx = parseInt(e.key, 10) - 1;
        if (targetIdx >= 0 && targetIdx < tabs.length) {
          e.preventDefault();
          handleSwitchTab(tabs[targetIdx].id);
          return;
        }
      }

      // INTERCEPT keys if layout is search and autocomplete dropdown is open
      if (layoutView === "search" && isSearchDropdownOpen && autocompleteResults.length > 0 && activeEl?.id === "pos-search-input") {
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
            handleAddProductToCart(selectedProd);
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

      // INTERCEPT keys if Select Packing Variation modal is open
      if (activeProductForVariants) {
        const choices: any[] = [
          { id: "base", name: `Base Unit (${activeProductForVariants.unit || "unit"})`, price: activeProductForVariants.sale_price_single, stock: activeProductForVariants.current_stock, isBase: true },
          ...getProductUnitOptions(activeProductForVariants)
        ];

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedModalIndex(prev => (prev + 1 < choices.length ? prev + 1 : prev));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedModalIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const selectedChoice = choices[selectedModalIndex];
          if (selectedChoice) {
            if (selectedChoice.isBase) {
              handleAddBaseUnitDirectly(activeProductForVariants);
            } else {
              handleAddProductToCart(activeProductForVariants, selectedChoice);
            }
          }
          setActiveProductForVariants(null);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setActiveProductForVariants(null);
        }
        return; 
      }

      // INTERCEPT keys if Cart is focused (only when user is not typing in search bar or any other text input)
      const isTypingInAnyInput = activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA" || activeEl?.tagName === "SELECT";
      if (isCartFocused && !isTypingInAnyInput) {
        if (cart.length === 0) {
          setIsCartFocused(false);
          setSelectedCartItemIndex(-1);
          return;
        }

        if (e.key === "Escape" || e.key === "F3" || (e.altKey && e.key.toLowerCase() === "a")) {
          e.preventDefault();
          setIsCartFocused(false);
          setSelectedCartItemIndex(-1);
          const searchInput = document.getElementById("pos-search-input");
          searchInput?.focus();
          toast.info("Returned focus to search");
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          const qtyInput = document.getElementById(`cart-qty-input-${selectedCartItemIndex}`) as HTMLInputElement | null;
          if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
          }
          return;
        }

        if ((e.key >= "0" && e.key <= "9") || e.key === ".") {
          const qtyInput = document.getElementById(`cart-qty-input-${selectedCartItemIndex}`) as HTMLInputElement | null;
          if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
          }
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedCartItemIndex(prev => (prev + 1 < cart.length ? prev + 1 : prev));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCartItemIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          const item = cart[selectedCartItemIndex];
          updateCartQty(selectedCartItemIndex, item.quantity + 1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const item = cart[selectedCartItemIndex];
          updateCartQty(selectedCartItemIndex, item.quantity - 1);
        }
        if (e.key === "Delete") {
          e.preventDefault();
          removeFromCart(selectedCartItemIndex);
          setSelectedCartItemIndex(prev => {
            if (cart.length <= 1) {
              setIsCartFocused(false);
              return -1;
            }
            return Math.min(prev, cart.length - 2);
          });
        }
        if (e.key === " " || e.key.toLowerCase() === "u") {
          e.preventDefault();
          const item = cart[selectedCartItemIndex];
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const options = [
              { id: "base" },
              ...getProductUnitOptions(product)
            ];
            const currentIdx = options.findIndex(o => o.id === (item.variantId || "base"));
            const nextIdx = (currentIdx + 1) % options.length;
            handleCartItemUnitChange(selectedCartItemIndex, options[nextIdx].id);
          }
        }
        
        // Checkout or Toggle Pay from Cart Mode
        if (e.key === "F8") {
          e.preventDefault();
          setPaymentMode(prev => {
            if (prev === "cash") return "credit";
            if (prev === "credit") return hasEmi ? "emi" : "cash";
            if (prev === "emi") return "cash";
            return "cash";
          });
        }
        if (e.key === "F9" || e.key === "F12" || ((e.ctrlKey || e.altKey) && e.key === "Enter")) {
          e.preventDefault();
          handleCheckout();
        }
        if (e.key === "F5" || (e.altKey && e.key.toLowerCase() === "q")) {
          e.preventDefault();
          handlePrintQuotation();
        }
        return;
      }

      // NORMAL POS KEYS:
      // Focus Search Bar: F1 or Alt+S
      if (e.key === "F1" || (e.altKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        const searchInput = document.getElementById("pos-search-input");
        searchInput?.focus();
        setSelectedGridIndex(-1);
        setIsCartFocused(false);
        setSelectedCartItemIndex(-1);
      }

      // Focus Customer Search: F2 or Alt+C
      if (e.key === "F2" || (e.altKey && e.key.toLowerCase() === "c")) {
        e.preventDefault();
        const customerSearchInput = document.getElementById("pos-customer-search-input");
        customerSearchInput?.focus();
        setSelectedGridIndex(-1);
        setIsCartFocused(false);
        setSelectedCartItemIndex(-1);
      }

      // Add New Customer Modal: Alt+N
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      }

      // Focus Cart: F3 or Alt+A
      if (e.key === "F3" || (e.altKey && e.key.toLowerCase() === "a")) {
        e.preventDefault();
        if (cart.length === 0) {
          toast.warning("Cart is empty! Add products first.");
          return;
        }
        setIsCartFocused(true);
        setSelectedCartItemIndex(0);
        setSelectedGridIndex(-1);
        document.getElementById("pos-search-input")?.blur();
        toast.info("Cart focus active");
      }

      // Focus Discount field: F4 or Alt+D
      if (e.key === "F4" || (e.altKey && e.key.toLowerCase() === "d")) {
        e.preventDefault();
        const discountInput = document.getElementById("pos-discount-input");
        discountInput?.focus();
        setIsCartFocused(false);
      }

      // Print / Save Quotation: F5 or Alt+Q
      if (e.key === "F5" || (e.altKey && e.key.toLowerCase() === "q")) {
        e.preventDefault();
        handlePrintQuotation();
      }

      // Hold bill: F6
      if (e.key === "F6") {
        e.preventDefault();
        handleHoldCart();
      }

      // Focus Tax field: F7
      if (e.key === "F7") {
        e.preventDefault();
        const taxInput = document.getElementById("pos-tax-input");
        taxInput?.focus();
        setIsCartFocused(false);
      }

      // Toggle Payment Modes: F8
      if (e.key === "F8") {
        e.preventDefault();
        setPaymentMode(prev => {
          if (prev === "cash") return "credit";
          if (prev === "credit") return hasEmi ? "emi" : "cash";
          if (prev === "emi") return "cash";
          return "cash";
        });
      }

      // Process / Complete Sale Checkout: F9 or F12 or Ctrl+Enter
      if (e.key === "F9" || e.key === "F12" || ((e.ctrlKey || e.altKey) && e.key === "Enter")) {
        e.preventDefault();
        handleCheckout();
      }

      // Help Menu: F10 or Alt+K
      if (e.key === "F10" || (e.altKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setIsShortcutsHelpOpen(prev => !prev);
      }

      // Escape to close models/modals / Clear Cart
      if (e.key === "Escape") {
        e.preventDefault();
        if (searchQuery) {
          setSearchQuery("");
        } else if (cart.length > 0 && !activeProductForVariants && !isCustomerModalOpen && !isReceiptOpen && !isImeiSelectModalOpen) {
          const confirmClear = window.confirm("Are you sure you want to clear the entire cart? (کیا آپ کارٹ خالی کرنا چاہتے ہیں؟)");
          if (confirmClear) {
            setCart([]);
            setDiscount(0);
            setReceivedAmount(0);
            toast.info("Cart cleared");
          }
        }
        setActiveProductForVariants(null);
        setIsCustomerModalOpen(false);
        setIsReceiptOpen(false);
        setSelectedGridIndex(-1);
        setIsCustomerDropdownOpen(false);
        setIsShortcutsHelpOpen(false);
      }

      // Hold bill: F6
      if (e.key === "F6") {
        e.preventDefault();
        handleHoldCart();
      }

      // Resume bill: Alt+R
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setIsHeldModalOpen(true);
      }

      // Page navigation: PageUp / PageDown
      const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
      if (e.key === "PageUp") {
        e.preventDefault();
        setPage(p => Math.max(1, p - 1));
        setSelectedGridIndex(-1);
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        setPage(p => Math.min(totalPages, p + 1));
        setSelectedGridIndex(-1);
      }

      // Grid Arrow Navigation & Enter Selection
      if (paginatedProducts.length > 0) {
        const cols = window.innerWidth >= 1280 ? 4 : (window.innerWidth >= 768 ? 3 : 2);

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedGridIndex(prev => {
            if (prev === -1) return 0;
            const next = prev + cols;
            return next < paginatedProducts.length ? next : prev;
          });
          setSelectedGridUnitIndex(0);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedGridIndex(prev => {
            const next = prev - cols;
            return next >= 0 ? next : prev;
          });
          setSelectedGridUnitIndex(0);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setSelectedGridIndex(prev => (prev + 1 < paginatedProducts.length ? prev + 1 : prev));
          setSelectedGridUnitIndex(0);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setSelectedGridIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
          setSelectedGridUnitIndex(0);
        }
        // Manual Barcode / exact match auto-add
        if (e.key === "Enter" && activeEl?.id === "pos-search-input" && searchQuery.trim() !== "") {
          e.preventDefault();
          const query = searchQuery.trim();
          setSearchQuery(""); // Clear input immediately to prevent double scans
          
          handleGlobalBarcodeScan(query);
          return;
        }

        // Space key cycles product units when navigating grid
        if (e.key === " " && selectedGridIndex >= 0 && selectedGridIndex < paginatedProducts.length) {
          const activeEl = document.activeElement;
          if (activeEl?.tagName === "INPUT") {
            return; // Let space key write spaces inside input search fields
          }
          e.preventDefault();
          const product = paginatedProducts[selectedGridIndex];
          const opts = getProductUnitOptions(product);
          const totalUnits = 1 + opts.length; // 1 for base, plus sub-units
          setSelectedGridUnitIndex(prev => (prev + 1) % totalUnits);
          return;
        }

        // Enter key adds selected unit of selected product grid item
        if (e.key === "Enter" && selectedGridIndex >= 0 && selectedGridIndex < paginatedProducts.length) {
          const activeEl = document.activeElement;
          if (activeEl?.tagName === "INPUT" && activeEl.id !== "pos-search-input") {
            return;
          }
          e.preventDefault();
          const product = paginatedProducts[selectedGridIndex];
          const opts = getProductUnitOptions(product);
          if (selectedGridUnitIndex === 0) {
            handleAddBaseUnitDirectly(product);
          } else {
            const chosenOpt = opts[selectedGridUnitIndex - 1];
            if (chosenOpt) {
              handleAddProductToCart(product, chosenOpt);
            }
          }
          // Clear query to get ready for next item
          setSearchQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredProducts, paginatedProducts, page, selectedGridIndex, selectedGridUnitIndex, cart, paymentMode, discount, discountType, taxRate, selectedCustomerId, activeProductForVariants, selectedModalIndex, isCartFocused, selectedCartItemIndex, heldCarts, receivedAmount, searchQuery, products, allowNegativeStock, layoutView, isSearchDropdownOpen, selectedSearchProductIndex, autocompleteResults]);

  // Handle unit selection change inside cart dropdown
  const handleCartItemUnitChange = (index: number, value: string) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    if (!product) return;

    let price = product.sale_price_single;
    let purchasePrice = product.purchase_price_single || 0;
    let stock = product.current_stock;
    let packingName: string | undefined = undefined;
    let variantId: string | undefined = undefined;
    let isAutoSubunit = false;
    let conversionFactor = 1;
    let unitType: "multiplier" | "divisor" = "multiplier";

    if (value !== "base") {
      if (value.startsWith("auto-")) {
        const options = getProductUnitOptions(product);
        const opt = options.find(o => o.id === value);
        if (opt) {
          price = opt.price;
          purchasePrice = opt.purchasePrice;
          stock = opt.stock;
          packingName = opt.name;
          variantId = opt.id;
          isAutoSubunit = opt.isAutoSubunit;
          conversionFactor = opt.conversionFactor;
          unitType = opt.type;
        }
      } else {
        const targetVariant = product.product_variants?.find(v => v.id === value);
        if (targetVariant) {
          price = targetVariant.sale_price;
          purchasePrice = targetVariant.purchase_price || 0;
          stock = targetVariant.is_packing && targetVariant.pack_size ? Math.floor(product.current_stock / targetVariant.pack_size) : targetVariant.stock_quantity;
          packingName = targetVariant.packing_name;
          variantId = targetVariant.id;
          conversionFactor = targetVariant.pack_size || 1;
        }
      }
    }

    // Check for duplicates with same variant/base and merge
    const duplicateIndex = cart.findIndex((item, i) => 
      i !== index && 
      item.productId === product.id && 
      (variantId ? item.variantId === variantId : !item.variantId)
    );

    if (duplicateIndex > -1) {
      const updated = [...cart];
      const existingItem = updated[duplicateIndex];
      const newQty = existingItem.quantity + item.quantity;
      if (!allowNegativeStock && newQty > stock) {
        existingItem.quantity = stock;
        toast.warning(`Merged items. Quantity capped to available stock: ${stock}`);
      } else {
        existingItem.quantity = newQty;
        toast.success(`Merged units inside cart.`);
      }
      setCart(updated.filter((_, i) => i !== index));
    } else {
      const updated = [...cart];
      const cappedQty = allowNegativeStock ? item.quantity : Math.min(item.quantity, stock);
      updated[index] = {
        ...item,
        variantId,
        packingName,
        price,
        purchasePrice,
        stock,
        quantity: Math.max(1, cappedQty), 
        isAutoSubunit,
        conversionFactor,
        unitType
      };
      setCart(updated);
      toast.success(`Switched packing to ${packingName || product.unit || "Base Unit"}`);
    }
  };

  const updateCartQty = (index: number, newQty: number) => {
    if (isNaN(newQty)) return;
    if (newQty <= 0) {
      const updated = [...cart];
      if (updated[index]) {
        updated[index].quantity = industryType === "karyana" ? 0.001 : 1;
        setCart(updated);
      }
      return;
    }
    const item = cart[index];
    if (!item) return;
    if (!allowNegativeStock && item.stock > 0 && newQty > item.stock) {
      toast.warning(`Cannot exceed available stock of ${item.stock}`);
      const updated = [...cart];
      updated[index].quantity = item.stock;
      setCart(updated);
      return;
    }
    const updated = [...cart];
    updated[index].quantity = newQty;
    setCart(updated);
  };

  const updateCartItemPrice = (index: number, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) return;
    const updated = [...cart];
    if (!updated[index]) return;
    updated[index].price = newPrice;
    setCart(updated);
    // Warn if selling price drops below purchase price
    const item = updated[index];
    if (item.purchasePrice > 0 && newPrice < item.purchasePrice && newPrice > 0) {
      toast.error(
        `⚠️ Warning: Selling price Rs ${newPrice} is BELOW purchase price Rs ${item.purchasePrice} for "${item.name}"! You will be selling at a loss.`,
        { duration: 5000, id: `below-purchase-${index}` }
      );
    }
  };

  const updateCartItemDiscount = (index: number, newDiscount: number) => {
    if (isNaN(newDiscount) || newDiscount < 0) return;
    const updated = [...cart];
    if (!updated[index]) return;
    updated[index].discount = newDiscount;
    setCart(updated);
  };

  const updateCartItemDiscountType = (index: number, newType: "percentage" | "fixed") => {
    const updated = [...cart];
    if (!updated[index]) return;
    updated[index].discountType = newType;
    setCart(updated);
  };

  // Back-calculate quantity from a desired total: qty = total / price
  const updateCartItemQtyFromTotal = (index: number, newTotal: number) => {
    const item = cart[index];
    if (!item || item.price <= 0 || isNaN(newTotal) || newTotal <= 0) return;

    let calcQty = 1;
    if (item.discountType === "percentage") {
      const discPct = item.discount || 0;
      const unitEffPrice = item.price * (1 - discPct / 100);
      calcQty = unitEffPrice > 0 ? newTotal / unitEffPrice : newTotal / item.price;
    } else {
      const fixedDisc = item.discount || 0;
      calcQty = (newTotal + fixedDisc) / item.price;
    }

    if (isNaN(calcQty) || calcQty <= 0) return;

    const roundedQty = (industryType === "karyana" || industryType === "fuel")
      ? Math.max(0.001, Math.round(calcQty * 1000) / 1000)
      : Math.max(1, Math.round(calcQty));

    const updated = [...cart];
    if (updated[index]) {
      if (!allowNegativeStock && item.stock > 0 && roundedQty > item.stock) {
        updated[index].quantity = item.stock;
        toast.warning(`Quantity capped to available stock of ${item.stock}`);
      } else {
        updated[index].quantity = roundedQty;
      }
      setCart(updated);
    }
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name) {
      toast.error("Please enter a customer name.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          shop_id: shopId,
          type: "customer",
          name: newCustomer.name,
          phone: newCustomer.phone || null,
          current_balance: 0
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Customer added successfully!");
      setCustomers([...customers, data]);
      setSelectedCustomerId(data.id);
      setIsCustomerModalOpen(false);
      setNewCustomer({ name: "", phone: "" });
    } catch (err: any) {
      toast.error("Error adding customer: " + err.message);
    }
  };



  const handleHoldCart = () => {
    if (cart.length === 0) {
      toast.warning("Cart is empty! Nothing to hold.");
      return;
    }
    const tag = prompt("Enter a tag/name for this held bill (optional):") || `Bill #${new Date().toLocaleTimeString()}`;
    const newHeld = {
      id: Math.random().toString(36).substring(2, 9),
      tag,
      cart,
      selectedCustomerId,
      discount,
      taxRate,
      paymentMode,
      receivedAmount,
      created_at: new Date().toISOString()
    };
    saveHeldCarts([newHeld, ...heldCarts]);
    setCart([]);
    setDiscount(0);
    setTaxRate(defaultTaxRate || 0);
    setTaxType(defaultTaxType || "percentage");
    setPaymentMode("cash");
    setSelectedCustomerId("walkin");
    toast.success("Sale suspended & bill held! ⏸️");
  };

  const handleResumeCart = (held: any) => {
    setCart(held.cart);
    setSelectedCustomerId(held.selectedCustomerId);
    setDiscount(held.discount);
    setTaxRate(held.taxRate);
    setPaymentMode(held.paymentMode);
    setReceivedAmount(held.receivedAmount);
    saveHeldCarts(heldCarts.filter(c => c.id !== held.id));
    setIsHeldModalOpen(false);
    toast.success(`Resumed bill: ${held.tag} ⏱️`);
  };

  const handlePrintQuotation = async () => {
    if (cart.length === 0) {
      toast.warning("Cart is empty! Cannot generate quotation.");
      return;
    }
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      
      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text("HX ESTIMATE / QUOTATION", 15, 20);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("This is not a financial invoice. Prices are estimates only.", 15, 26);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Quotation Date: ${new Date().toLocaleString()}`, 130, 20);
      doc.text(`Customer: ${selectedCustomerId === "walkin" ? "Walk-in Customer" : customers.find(c => c.id === selectedCustomerId)?.name || "Customer"}`, 130, 25);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 32, 195, 32);
      
      // Table
      autoTable(doc, {
        head: [["#", "Product", "Packing/Unit", "Qty", "Sale Price", "Subtotal"]],
        body: cart.map((item, idx) => [
          idx + 1,
          item.name,
          item.packingName || "Base",
          item.quantity,
          `Rs ${Number(item.price).toLocaleString()}`,
          `Rs ${Number(item.price * item.quantity).toLocaleString()}`
        ]),
        startY: 38,
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      
      // Totals
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text(`Subtotal: Rs ${subtotal.toLocaleString()}`, 130, finalY);
      if (taxRate > 0) {
        doc.text(`Tax (${taxRate}${taxType === "flat" ? " Rs" : "%"}): Rs ${taxAmount.toLocaleString()}`, 130, finalY + 5);
      }
      if (discount > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Discount: -Rs ${discountRupees.toLocaleString()}`, 130, finalY + 10);
      }
      
      doc.setFontSize(13);
      doc.setTextColor(79, 70, 229);
      const grandTotalY = finalY + (discountRupees > 0 ? 16 : (taxRate > 0 ? 11 : 6));
      doc.text(`Estimated Total: Rs ${total.toLocaleString()}`, 130, grandTotalY);
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Powered by The Accounts POS", 15, 285);
      
      doc.save(`estimate_${Date.now()}.pdf`);
      toast.success("Quotation PDF generated and downloaded! 📄");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    }
  };

  const handleSendPOSWhatsApp = async () => {
    if (subscriptionTier === "free") {
      toast.error("مفت پلان پر واٹس ایپ الرٹس کی سہولت میسر نہیں ہے۔ براہ کرم اپنا سبسکرپشن پلان اپگریڈ کریں۔", {
        description: "WhatsApp alerts are not available on the Free Plan. Please upgrade to Starter or Premium."
      });
      return;
    }

    if (!lastInvoice) return;
    
    const phoneNum = whatsappInputPhone;
    
    if (!phoneNum) {
      toast.error("برائے مہربانی واٹس ایپ نمبر درج کریں!");
      return;
    }

    // Open blank window immediately to bypass popup blockers
    const waWindow = window.open("about:blank", "_blank");
    if (waWindow) {
      waWindow.document.write("<html><head><title>Opening WhatsApp...</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f8fafc;color:#475569;margin:0;} .spinner{border:3px solid #e2e8f0;border-top:3px solid #10b981;border-radius:50%;width:24px;height:24px;animation:spin 1s linear infinite;margin-bottom:12px;} @keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}} .container{text-align:center;}</style></head><body><div class='container'><div class='spinner' style='margin:0 auto 12px auto;'></div><div>Opening WhatsApp, please wait...</div></div></body></html>");
    }
    
    const cleanPhone = phoneNum.replace(/[^0-9]/g, "");
    let formattedPhone = cleanPhone;
    if (cleanPhone.startsWith("03")) {
      formattedPhone = "92" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("3")) {
      formattedPhone = "92" + cleanPhone;
    }

    toast.loading("بل تیار اور اپلوڈ کیا جا رہا ہے...", { id: "pos-wa-upload" });

    const businessName = shopDetails?.name || shopName || "THE ACCOUNTS";
    const businessAddress = shopDetails?.address || "";
    const businessPhone = shopDetails?.phone || "";
    const invItems: any[] = lastInvoice.items || [];
    const invId = (lastInvoice.id || "").slice(0, 8).toUpperCase();
    const invDateStr = new Date(lastInvoice.created_at || Date.now()).toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const custName = lastInvoice.customer_name || "Walk-in Customer";
    const pMode = String(lastInvoice.payment_mode || "cash").toLowerCase();
    const totalAmt = Number(lastInvoice.total_amount || 0);
    const recAmt = Number(lastInvoice.received_amount !== undefined ? lastInvoice.received_amount : lastInvoice.paid_amount || 0);
    const taxAmt = Number(lastInvoice.tax_amount || 0);
    const discAmt = Number(lastInvoice.discount || 0);
    const grossTotal = invItems.reduce((acc: number, item: any) => acc + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    const isEmi = pMode === "emi";
    const isCredit = pMode === "credit";
    const isPartial = recAmt < totalAmt && pMode !== "quotation";
    const emiList: any[] = lastInvoice.emiSchedules || [];
    const customerBalance = Number(lastInvoice.customer_balance || 0);

    let publicPdfUrl = "";
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      
      // Header: Business Branding
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text(businessName, 15, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      if (businessAddress) doc.text(businessAddress, 15, 23);
      if (businessPhone) doc.text(`Phone: ${businessPhone}`, 15, businessAddress ? 27 : 23);
      
      // Meta Info Card (Right side)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Invoice #: #${invId}`, 130, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Date: ${invDateStr}`, 130, 23);
      doc.text(`Customer: ${custName}`, 130, 27);
      if (lastInvoice.customer_phone) doc.text(`Contact: ${lastInvoice.customer_phone}`, 130, 31);
      
      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(15, 35, 195, 35);
      
      // Items Table
      const tableRows = invItems.map((item: any, idx: number) => {
        let desc = item.name || "Item";
        if (item.packingName) desc += ` (${item.packingName})`;
        if (item.sold_imeis) desc += `\nIMEIs: ${item.sold_imeis}`;
        else if (item.selectedImeis && item.selectedImeis.length > 0) {
          desc += `\nIMEIs: ` + item.selectedImeis.map((i: any) => i.imei1 + (i.imei2 ? `/${i.imei2}` : "")).join(", ");
        }
        if (item.batchNumber) desc += `\nBatch: ${item.batchNumber}${item.expiryDate ? ` | Exp: ${item.expiryDate}` : ""}`;
        if (item.warranty) desc += `\nWarranty: ${item.warranty}`;

        const itemSubtotal = item.subtotal !== undefined ? Number(item.subtotal) : Number(item.price || 0) * Number(item.quantity || 1);
        return [
          idx + 1,
          desc,
          item.packingName || "Unit",
          item.quantity,
          `Rs ${Number(item.price).toLocaleString()}`,
          `Rs ${itemSubtotal.toLocaleString()}`
        ];
      });

      autoTable(doc, {
        head: [["#", "Item Description", "Packing", "Qty", "Price", "Subtotal"]],
        body: tableRows,
        startY: 38,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: { 
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 80 },
          2: { cellWidth: 25 },
          3: { cellWidth: 15, halign: "center" },
          4: { cellWidth: 25, halign: "right" },
          5: { cellWidth: 25, halign: "right", fontStyle: "bold" } 
        },
        margin: { left: 15, right: 15 }
      });
      
      let nextY = (doc as any).lastAutoTable.finalY + 6;
      
      // Totals Box
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Gross Subtotal:`, 130, nextY);
      doc.text(`Rs ${grossTotal.toLocaleString()}`, 195, nextY, { align: "right" });
      
      if (discAmt > 0) {
        nextY += 5;
        doc.setTextColor(220, 38, 38);
        doc.text(`Discount:`, 130, nextY);
        doc.text(`-Rs ${discAmt.toLocaleString()}`, 195, nextY, { align: "right" });
      }

      if (taxAmt > 0) {
        nextY += 5;
        doc.setTextColor(71, 85, 105);
        doc.text(`Tax:`, 130, nextY);
        doc.text(`+Rs ${taxAmt.toLocaleString()}`, 195, nextY, { align: "right" });
      }

      nextY += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Net Total:`, 130, nextY);
      doc.text(`Rs ${totalAmt.toLocaleString()}`, 195, nextY, { align: "right" });

      nextY += 5;
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Payment Mode:`, 130, nextY);
      doc.text(pMode.toUpperCase(), 195, nextY, { align: "right" });

      // If Credit or Partial or EMI Breakdown
      if (isCredit || isPartial || isEmi) {
        nextY += 6;
        doc.setDrawColor(203, 213, 225);
        doc.line(130, nextY - 1, 195, nextY - 1);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(isEmi ? 79 : 180, isEmi ? 70 : 83, isEmi ? 229 : 9); // Indigo or Amber

        doc.text(isEmi ? "Down Payment:" : "Paid Now:", 130, nextY + 3);
        doc.text(`Rs ${recAmt.toLocaleString()}`, 195, nextY + 3, { align: "right" });

        const balanceDue = Math.max(0, totalAmt - recAmt);
        doc.setTextColor(220, 38, 38);
        doc.text(isEmi ? "Financed Balance:" : "Bill Udhaar Due:", 130, nextY + 7);
        doc.text(`Rs ${balanceDue.toLocaleString()}`, 195, nextY + 7, { align: "right" });

        if (customerBalance > 0) {
          doc.setTextColor(51, 65, 85);
          doc.text(`Total Khata Balance:`, 130, nextY + 11);
          doc.text(`Rs ${customerBalance.toLocaleString()}`, 195, nextY + 11, { align: "right" });
          nextY += 4;
        }
        nextY += 8;
      }

      // If EMI: Print EMI Installment Schedule Table on PDF
      if (isEmi && emiList.length > 0) {
        nextY = Math.max(nextY + 4, (doc as any).lastAutoTable.finalY + 35);
        if (nextY > 230) {
          doc.addPage();
          nextY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(79, 70, 229);
        doc.text(`Installment Schedule (${emiList.length} Installments)`, 15, nextY);

        autoTable(doc, {
          head: [["Inst #", "Due Date", "Amount (Rs)", "Status"]],
          body: emiList.map((s: any, i: number) => [
            s.installmentNum || s.installment_number || i + 1,
            new Date(s.dueDate || s.due_date).toLocaleDateString(),
            `Rs ${Number(s.amount || s.installment_amount).toLocaleString()}`,
            s.status === "paid" ? "PAID ✓" : "UNPAID"
          ]),
          startY: nextY + 2,
          theme: "grid",
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 7.5 },
          margin: { left: 15, right: 80 }
        });
      }

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Thank you for shopping with us! Online verification & cloud powered by The Accounts (theaccounts.cloud)", 15, 285);

      const blob = doc.output("blob");
      const filename = `${lastInvoice.id}_${Date.now()}.pdf`;
      const res = await fetch("/api/upload-receipt", {
        method: "POST",
        headers: {
          "x-filename": filename
        },
        body: blob
      });

      const resData = await res.json();
      if (!res.ok || resData.error) {
        throw new Error(resData.error || "Failed to upload locally");
      }

      publicPdfUrl = window.location.origin + resData.url;
      toast.success("بل پی ڈی ایف اپلوڈ ہو گئی ہے!", { id: "pos-wa-upload" });
    } catch (err: any) {
      toast.error("پی ڈی ایف اپلوڈ سکپ: " + err.message, { id: "pos-wa-upload" });
      if (waWindow && !publicPdfUrl) {
        // Continue with text link even if upload failed
      }
    }

    const digitalReceiptUrl = `${window.location.origin}/public/receipt/${lastInvoice.id}`;

    // Format rich items list for WhatsApp text
    let itemsText = "";
    invItems.forEach((item: any, i: number) => {
      const pName = item.name || "Item";
      const pPacking = item.packingName ? ` (${item.packingName})` : "";
      const pQty = item.quantity;
      const pPrice = Number(item.price).toLocaleString();
      const pSubtotal = Number(item.subtotal !== undefined ? item.subtotal : (item.price * item.quantity)).toLocaleString();
      
      let extraMeta = "";
      if (item.sold_imeis) {
        extraMeta += `\n   📱 IMEI: ${item.sold_imeis}`;
      } else if (item.selectedImeis && item.selectedImeis.length > 0) {
        extraMeta += `\n   📱 IMEI: ` + item.selectedImeis.map((x: any) => x.imei1 + (x.imei2 ? `/${x.imei2}` : "")).join(", ");
      }
      if (item.batchNumber) {
        extraMeta += `\n   🏷️ Batch: ${item.batchNumber}${item.expiryDate ? ` | Exp: ${item.expiryDate}` : ""}`;
      }

      itemsText += `${i + 1}️⃣ *${pName}${pPacking}*${extraMeta}\n   مقدار: ${pQty} x Rs ${pPrice} = *Rs ${pSubtotal}*\n`;
    });

    // Format payment mode label
    let pModeLabel = pMode.toUpperCase();
    if (pMode === "cash") pModeLabel = "💵 کیش (Cash)";
    else if (pMode === "card") pModeLabel = "💳 بینک کارڈ (Card)";
    else if (pMode === "online") pModeLabel = "📲 آن لائن ٹرانسفر (Online Transfer)";
    else if (pMode === "credit") pModeLabel = "📒 ادھار / کھاتہ (Credit Khata)";
    else if (pMode === "emi") pModeLabel = "📌 آسان اقساط (Installment Plan / EMI)";
    else if (pMode === "quotation") pModeLabel = "📄 صرف تخمینہ (Quotation / Estimate)";

    // Construct WhatsApp message
    let message = `السلام علیکم محترم *${custName}* صاحب! 🤝\n\n`;
    message += `*${businessName}* کی جانب سے آپ کی خریداری کا مکمل بل درج ذیل ہے:\n\n`;
    message += `📄 *بل نمبر:* #${invId}\n`;
    message += `📅 *تاریخ:* ${invDateStr}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛍️ *تفصیل اشیاء (Purchased Items):*\n${itemsText}`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 *بل کا خلاصہ (Bill Summary):*\n`;
    message += `• کُل بل (Subtotal): Rs ${grossTotal.toLocaleString()}\n`;
    if (discAmt > 0) message += `• رعایت (Discount): -Rs ${discAmt.toLocaleString()}\n`;
    if (taxAmt > 0) message += `• ٹیکس (Tax): +Rs ${taxAmt.toLocaleString()}\n`;
    message += `• *کُل واجب الادا رقم: Rs ${totalAmt.toLocaleString()}*\n`;
    message += `• ادائیگی کا طریقہ: *${pModeLabel}*\n`;

    // Credit / Udhaar Block
    if (isCredit || (isPartial && !isEmi)) {
      const bal = Math.max(0, totalAmt - recAmt);
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📒 *ادھار و کھاتہ تفصیل (Credit Khata):*\n`;
      message += `• نقد ادا کردہ رقم (Paid Now): *Rs ${recAmt.toLocaleString()}*\n`;
      message += `• اس بل کا بقایا ادھار (Bill Balance): *Rs ${bal.toLocaleString()}*\n`;
      if (customerBalance > 0) {
        message += `• *کُل کھاتہ بقایا (Total Outstanding Ledger): Rs ${customerBalance.toLocaleString()}*\n`;
      }
    }

    // EMI / Installments Block
    if (isEmi) {
      const bal = Math.max(0, totalAmt - recAmt);
      const totalInstCount = emiList.length || lastInvoice.emi_installments || 6;
      const freqLabel = (lastInvoice.emi_frequency || "monthly") === "weekly" ? "ہفتہ وار" : "ماہانہ";
      const singleInstAmt = emiList.length > 0 ? Number(emiList[0].amount || 0) : Math.round(bal / (totalInstCount || 1));
      const firstDue = emiList.length > 0 ? new Date(emiList[0].dueDate || emiList[0].due_date).toLocaleDateString() : lastInvoice.emi_first_due_date || "N/A";

      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `📌 *اقساط کا مکمل پلان (Installment Plan):*\n`;
      message += `• پیشگی رقم (Down Payment): *Rs ${recAmt.toLocaleString()}*\n`;
      message += `• باقی اقساط رقم (Financed Debt): *Rs ${bal.toLocaleString()}*\n`;
      message += `• کُل اقساط کی تعداد: *${totalInstCount} (${freqLabel})*\n`;
      message += `• ہر قسط کی رقم: *Rs ${singleInstAmt.toLocaleString()}*\n`;
      message += `• پہلی قسط کی تاریخ: *${firstDue}*\n\n`;

      if (emiList.length > 0) {
        message += `🗓️ *شیڈول اقساط (Installment Schedule):*\n`;
        emiList.forEach((s: any, idx: number) => {
          const dStr = new Date(s.dueDate || s.due_date).toLocaleDateString();
          const aStr = Number(s.amount || s.installment_amount).toLocaleString();
          const stStr = s.status === "paid" ? " [ادا شدہ ✓]" : "";
          message += `${idx + 1}. قسط #${s.installmentNum || idx + 1}: ${dStr} — *Rs ${aStr}*${stStr}\n`;
        });
      }
    }

    // Links Section
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📥 *مکمل ڈیجیٹل بل دیکھنے اور ڈاؤن لوڈ کرنے کے لیے لنک (Download Bill):*\n👉 ${digitalReceiptUrl}\n\n`;
    if (publicPdfUrl) {
      message += `📄 *براہِ راست PDF بل ڈاؤن لوڈ لنک:*\n👉 ${publicPdfUrl}\n\n`;
    }
    message += `خریداری کا بہت شکریہ! 🤝\n`;
    message += `منجانب: *${businessName}*\n`;
    if (businessPhone) message += `📞 رابطہ: ${businessPhone}\n`;
    if (businessAddress) message += `📍 پتہ: ${businessAddress}\n`;

    const encodedText = encodeURIComponent(message);
    const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;

    if (waWindow) {
      waWindow.location.href = waUrl;
    } else {
      window.open(waUrl, "_blank");
    }
  };

  const generateEmiSchedule = (
    totalBill: number,
    downPayment: number,
    installmentsCount: number,
    frequency: "monthly" | "weekly",
    markupPct: number,
    firstDateStr: string
  ) => {
    const principal = totalBill - downPayment;
    if (principal <= 0) return [];
    
    const markup = principal * (markupPct / 100);
    const totalDebt = principal + markup;
    const instAmount = Math.round(totalDebt / installmentsCount);
    
    const schedule = [];
    let currentDate = new Date(firstDateStr || new Date());
    
    for (let i = 0; i < installmentsCount; i++) {
      const amt = i === installmentsCount - 1 
        ? totalDebt - (instAmount * (installmentsCount - 1)) 
        : instAmount;
      
      schedule.push({
        installmentNum: i + 1,
        dueDate: currentDate.toISOString().split("T")[0],
        amount: amt
      });
      
      if (frequency === "monthly") {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }
    return schedule;
  };

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) {
      toast.error("Please enter a gift card code.");
      return;
    }
    try {
      const { data: gc, error } = await supabase
        .from("gift_cards")
        .select("*")
        .eq("code", giftCardCode.trim().toUpperCase())
        .eq("shop_id", shopId)
        .single();
      
      if (error || !gc) {
        toast.error("Invalid Gift Card Code!");
        return;
      }
      
      if (gc.expiry_date && new Date(gc.expiry_date) < new Date()) {
        toast.error("This Gift Card has expired!");
        return;
      }
      
      const currentBalance = Number(gc.balance);
      if (currentBalance <= 0) {
        toast.error("This Gift Card has zero balance!");
        return;
      }
      
      const remainingTotal = subtotal + taxAmount - discountRupees;
      if (remainingTotal <= 0) {
        toast.error("No balance left to deduct!");
        return;
      }
      
      const amountToApply = Math.min(currentBalance, remainingTotal);
      setAppliedGiftCard(gc);
      setAppliedGiftCardAmount(amountToApply);
      toast.success(`Gift Card applied successfully! Rs ${amountToApply.toLocaleString()} deducted.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Error applying gift card: " + err.message);
    }
  };

  useEffect(() => {
    if (appliedGiftCard) {
      const remainingTotal = subtotal + taxAmount - discountRupees;
      const amountToApply = Math.min(Number(appliedGiftCard.balance), Math.max(0, remainingTotal));
      if (amountToApply !== appliedGiftCardAmount) {
        setAppliedGiftCardAmount(amountToApply);
      }
    }
  }, [cart, discount, discountType, taxRate, appliedGiftCard, subtotal, taxAmount]);

  const handleCheckout = async () => {
    if (subtotal > 0 && discountRupees > 0) {
      // 1. 100% discount validation
      if (discountRupees >= subtotal) {
        toast.error("100% ڈسکاؤنٹ کی اجازت نہیں ہے!", {
          description: "100% or greater discount is not allowed."
        });
        setDiscount(0);
        return;
      }

      // 2. Profile max discount percentage validation
      const pct = discountType === "percentage" ? discount : (discount / subtotal) * 100;
      const maxPct = permissions?.max_discount_percentage ?? 100;
      if (pct > maxPct) {
        const maxAllowedDiscount = Math.floor((subtotal * maxPct) / 100);
        toast.error(`ڈسکاؤنٹ کی حد سے تجاوز! آپ زیادہ سے زیادہ ${maxPct}% ڈسکاؤنٹ (Rs ${maxAllowedDiscount}) دے سکتے ہیں۔`, {
          description: `Maximum allowed discount is ${maxPct}% for your profile.`
        });
        if (discountType === "percentage") {
          setDiscount(maxPct);
        } else {
          setDiscount(maxAllowedDiscount);
        }
        return;
      }

      // 3. Loss prevention validation (Block selling below total purchase cost)
      if (cart.length > 0) {
        const rawSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const totalPurchaseCost = cart.reduce((acc, item) => acc + item.purchasePrice * item.quantity, 0);
        const calculatedTaxAmount = taxType === "flat" ? taxRate : (rawSubtotal * taxRate) / 100;
        const effectiveTotal = Math.max(0, rawSubtotal + calculatedTaxAmount - discountRupees);
        if (totalPurchaseCost > 0 && effectiveTotal < totalPurchaseCost) {
          toast.error("خسارے (Loss) پر فروخت کرنے کی اجازت نہیں ہے!", {
            description: `Selling below total purchase cost (Rs ${totalPurchaseCost.toFixed(2)}) is blocked.`,
            id: 'below-purchase-discount'
          });
          setDiscount(0);
          return;
        }
      }
    }

    if (activeClosingBook) {
      toast.error("Cannot perform checkouts in a closed fiscal period!");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }
    if (paymentMode === "credit" && selectedCustomerId === "walkin") {
      toast.error("Cannot sell on credit (Udhaar) to a Walk-in Customer. Please select/add a customer.");
      return;
    }
    if (paymentMode === "emi" && selectedCustomerId === "walkin") {
      toast.error("Cannot sell on installments (EMI) to a Walk-in Customer. Please select/add a customer.");
      return;
    }

    // Pharmacy Controlled Substances Audit Checkpoint
    const isControlledAuditEnabled = industryType === "pharmacy" && receiptSettings?.mandatoryControlledDrugForm !== false;
    const controlledItemsInCart = isControlledAuditEnabled ? cart.filter(item => isControlledDrug(item)) : [];
    const hasControlledSubstance = controlledItemsInCart.length > 0;

    if (hasControlledSubstance && (!customerCnic.trim() || !prescriptionRef.trim() || !doctorName.trim())) {
      const currentCust = customers.find(c => c.id === selectedCustomerId);
      if (currentCust && selectedCustomerId !== "walkin") {
        if (!patientName) setPatientName(currentCust.name || "");
        if (!patientPhone && currentCust.phone) setPatientPhone(currentCust.phone);
      }
      setIsControlledPromptOpen(true);
      return;
    }

    let finalRemarks = remarks.trim();
    if (hasControlledSubstance) {
      const auditTrail = `[Controlled Rx - CNIC: ${customerCnic}, Dr: ${doctorName || "N/A"} (${doctorPmdc || "PMDC N/A"}), Ref: ${prescriptionRef}]`;
      finalRemarks = finalRemarks ? `${auditTrail} - ${finalRemarks}` : auditTrail;
    }

    // Credit limit warning and override confirmation
    if ((paymentMode === "credit" || paymentMode === "emi") && selectedCustomerId !== "walkin") {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      if (selectedCustomer && selectedCustomer.credit_limit !== null && selectedCustomer.credit_limit !== undefined) {
        const creditAmount = paymentMode === "credit" 
          ? total - receivedAmount 
          : (total - receivedAmount) + ((total - receivedAmount) * (emiMarkupRate / 100));
        const newBalance = Number(selectedCustomer.current_balance || 0) + creditAmount;
        if (newBalance > Number(selectedCustomer.credit_limit)) {
          const confirmProceed = window.confirm(`⚠️ Credit Limit Exceeded! (قرض کی حد سے تجاوز)
Customer: ${selectedCustomer.name}
Credit Limit: Rs ${Number(selectedCustomer.credit_limit).toLocaleString()}
New Estimated Balance: Rs ${newBalance.toLocaleString()}

Do you want to proceed with this sale anyway?`);
          if (!confirmProceed) {
            return;
          }
        }
      }
    }

    setIsSubmitting(true);
    try {
      const customerId = selectedCustomerId === "walkin" ? null : selectedCustomerId;
      const invoiceStatus = paymentMode === "quotation"
        ? "quotation"
        : (paymentMode === "credit" || paymentMode === "emi")
          ? (receivedAmount >= total ? "paid" : receivedAmount > 0 ? "partial" : "unpaid") 
          : "paid";

      const paidAmount =
        paymentMode === "quotation"
          ? 0
          : paymentMode === "credit" || paymentMode === "emi"
            ? receivedAmount
            : total;
      const creditAmount =
        paymentMode === "credit"
          ? total - receivedAmount
          : paymentMode === "emi"
            ? (total - receivedAmount) + ((total - receivedAmount) * (emiMarkupRate / 100))
            : 0;
      const cashAmount =
        paymentMode === "credit" || paymentMode === "emi" ? receivedAmount : total;
      const pointsEarned =
        hasLoyalty && customerId && paymentMode !== "quotation"
          ? Math.floor(total / 100)
          : 0;
      const loyaltyDelta =
        hasLoyalty && customerId && paymentMode !== "quotation"
          ? pointsEarned - redeemedPoints
          : 0;
      const emiScheduleList =
        paymentMode === "emi"
          ? generateEmiSchedule(
              total,
              receivedAmount,
              emiInstallments,
              emiFrequency,
              emiMarkupRate,
              emiFirstDueDate
            )
          : [];

      // ── Phase 2/3: atomic pos_checkout RPC + offline queue ──
      if (isMoneyRpcEnabled()) {
        const payload = buildPosCheckoutPayload({
          shopId: shopId!,
          cart,
          products,
          customerId,
          total,
          taxAmount,
          discountRupees,
          paidAmount,
          invoiceStatus,
          paymentMode,
          registerSessionId: activeSession ? activeSession.id : null,
          accountId: selectedAccountId || null,
          remarks: finalRemarks || null,
          creditAmount: Math.max(0, creditAmount),
          cashAmount: Math.max(0, cashAmount),
          giftCardId: appliedGiftCard?.id || null,
          giftCardAmount: appliedGiftCardAmount || 0,
          loyaltyDelta,
          isQuotation: paymentMode === "quotation",
          editInvoiceId: editingInvoiceId || null,
          emiSchedules: emiScheduleList.map((s: any) => ({
            dueDate: s.dueDate,
            amount: s.amount,
          })),
        });

        const finishSuccessUi = async (invoiceData: {
          id: string;
          created_at: string;
          status: string;
        }, via: string) => {
          logAudit(
            shopId!,
            userId,
            editingInvoiceId ? "INVOICE_EDITED" : "INVOICE_CREATED",
            "invoices",
            invoiceData.id,
            {
              invoice_id: invoiceData.id,
              total_amount: total,
              payment_mode: paymentMode,
              items_count: cart.length,
              customer_id: customerId || "walkin",
              is_edit: !!editingInvoiceId,
              via,
            }
          );

          const currentCustomerObj = customerId ? customers.find((c) => c.id === customerId) : null;
          setLastInvoice({
            id: invoiceData.id,
            created_at: invoiceData.created_at,
            total_amount: total,
            tax_amount: taxAmount,
            discount: discountRupees,
            payment_mode: paymentMode,
            received_amount: receivedAmount,
            status: invoiceData.status,
            customer_name: currentCustomerObj?.name || "Walk-in Customer",
            customer_phone: currentCustomerObj?.phone || "",
            customer_balance: currentCustomerObj?.current_balance !== undefined ? Number(currentCustomerObj.current_balance) + (paymentMode === "credit" ? (total - receivedAmount) : 0) : 0,
            items: [...cart],
            emi_installments: emiInstallments,
            emi_frequency: emiFrequency,
            emi_markup_rate: emiMarkupRate,
            emi_first_due_date: emiFirstDueDate,
            emiSchedules: paymentMode === "emi" ? emiScheduleList : null,
          });

          // Sync updated sale prices to product catalog for checked items
          const syncItems = cart.filter((i) => i.syncPriceToCatalog && !i.isCustomItem && !i.productId?.startsWith("custom-"));
          for (const sItem of syncItems) {
            if (!sItem.variantId) {
              await supabase.from("products").update({ sale_price_single: sItem.price }).eq("id", sItem.productId);
            } else {
              await supabase.from("product_variants").update({ sale_price: sItem.price }).eq("id", sItem.variantId);
            }
          }
          if (syncItems.length > 0) {
            toast.success(`Updated catalog sale price for ${syncItems.length} item(s)! 🚀`);
          }

          // Record Mobile Trade-In / Exchange Buyback
          if (tradeInItem) {
            try {
              const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;
              await supabase.from("used_mobile_purchases").insert({
                shop_id: shopId,
                seller_name: selectedCustomer?.name || "Customer Trade-In",
                seller_phone: tradeInItem.sellerPhone || selectedCustomer?.phone || null,
                seller_cnic: tradeInItem.sellerCnic || (selectedCustomer as any)?.cnic_number || null,
                brand_model: tradeInItem.brandModel,
                imei1: tradeInItem.imei1 || null,
                imei2: tradeInItem.imei2 || null,
                pta_status: tradeInItem.ptaStatus,
                condition: tradeInItem.condition,
                purchase_price: tradeInItem.agreedValue,
                payment_mode: "exchange",
                remarks: `Traded-in against invoice #${invoiceData.id.slice(0, 8).toUpperCase()}. ${tradeInItem.notes || ""}`,
              });
              toast.success("Traded-in phone added to Used Mobile Inventory! 📱");
            } catch (err: any) {
              console.error("Failed to record trade-in buyback:", err);
            }
            setTradeInItem(null);
          }

          setCart([]);
          setDiscount(0);
          setRedeemedPoints(0);
          setTaxRate(defaultTaxRate || 0);
          setTaxType(defaultTaxType || "percentage");
          setPaymentMode("cash");
          setCustomerCnic("");
          setPrescriptionRef("");
          setSelectedCustomerId("walkin");
          setAppliedGiftCard(null);
          setAppliedGiftCardAmount(0);
          setGiftCardCode("");
          setReceivedAmount(0);
          setRemarks("");
          setShowMobileCart(false);
          setEmiInstallments(6);
          setEmiFrequency("monthly");
          setEmiMarkupRate(0);
          const todayDateRpc = new Date();
          todayDateRpc.setMonth(todayDateRpc.getMonth() + 1);
          setEmiFirstDueDate(todayDateRpc.toISOString().split("T")[0]);
          handleCloseActiveTabAfterCheckout();
          if (typeof window !== "undefined" && shopId) {
            localStorage.removeItem(`theaccounts_pos_active_draft_${shopId}`);
            try {
              if ("BroadcastChannel" in window) {
                const bChannel = new BroadcastChannel("theaccounts_inventory_channel");
                bChannel.postMessage({ type: "SALE_SAVED", shopId, timestamp: Date.now() });
                bChannel.close();
              }
            } catch (bcErr) {
              console.warn("POS BroadcastChannel broadcast error:", bcErr);
            }
          }
          if (typeof window !== "undefined" && "BroadcastChannel" in window && shopId) {
            try {
              const bChannel = new BroadcastChannel("theaccounts_inventory_channel");
              bChannel.postMessage({ type: "SALE_SAVED", shopId, invoiceId: invoiceData.id, timestamp: Date.now() });
              bChannel.close();
            } catch (e) {}
          }
          setIsDraftRestored(false);
          setIsReceiptOpen(true);
          if (editingInvoiceId) {
            setEditingInvoiceId(null);
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", "/dashboard/pos");
            }
          }
        };

        // Phase 3: offline or edit-block offline
        if (isBrowserOffline()) {
          if (editingInvoiceId) {
            toast.error("Cannot edit invoices while offline. Reconnect and try again.");
            return;
          }
          const { invoiceId } = await enqueueOfflinePosCheckout(shopId!, payload);
          toast.success("Sale saved offline — will sync when online", {
            description: `Local bill #${invoiceId.slice(0, 8).toUpperCase()}`,
          });
          finishSuccessUi(
            {
              id: invoiceId,
              created_at: new Date().toISOString(),
              status: invoiceStatus + " (pending sync)",
            },
            "offline_queue"
          );
          return;
        }

        try {
          const result = await posCheckout(supabase, payload);
          const invoiceData = {
            id: result.invoice_id,
            created_at: result.created_at || new Date().toISOString(),
            status: result.status || invoiceStatus,
          };

          toast.success("Checkout completed successfully!");
          finishSuccessUi(invoiceData, "pos_checkout_rpc");
          fetchData();
          return;
        } catch (rpcErr: any) {
          const msg = String(rpcErr?.message || rpcErr || "");
          const missingFn =
            /function|does not exist|Could not find the function|schema cache/i.test(msg);

          // Phase 3: network failure → queue for sync
          if (!missingFn && isNetworkError(rpcErr) && !editingInvoiceId) {
            const { invoiceId } = await enqueueOfflinePosCheckout(shopId!, payload);
            toast.success("Network error — sale queued offline", {
              description: `Local bill #${invoiceId.slice(0, 8).toUpperCase()}`,
            });
            finishSuccessUi(
              {
                id: invoiceId,
                created_at: new Date().toISOString(),
                status: invoiceStatus + " (pending sync)",
              },
              "offline_queue_network_error"
            );
            return;
          }

          if (!missingFn) throw rpcErr;
          console.warn("[POS] pos_checkout RPC unavailable, using legacy path:", msg);
          toast.message("Using legacy checkout (apply Phase 2 SQL for atomic mode)");
        }
      }

      let updatedHistory: any[] = [];
      if (editingInvoiceId) {
        const { data: oldItems } = await supabase
          .from("invoice_items")
          .select("id, product_id, variant_id, quantity, unit_price, subtotal, batch_number, expiry_date")
          .eq("invoice_id", editingInvoiceId);

        // Restore IMEIs to available when editing an invoice
        if (oldItems && oldItems.length > 0) {
          const oldItemIds = oldItems.map((it: any) => it.id);
          await supabase
            .from("product_imeis")
            .update({ status: "available", sold_invoice_item_id: null })
            .in("sold_invoice_item_id", oldItemIds);
        }

        if (oldItems) {
          for (const it of oldItems) {
            // Restore batch quantity if batch_number was recorded on the old invoice item
            if (it.batch_number) {
              const { data: bRow } = await supabase
                .from("product_batches")
                .select("id, stock_quantity")
                .eq("shop_id", shopId)
                .eq("product_id", it.product_id)
                .eq("batch_number", it.batch_number)
                .maybeSingle();

              if (bRow) {
                await supabase
                  .from("product_batches")
                  .update({ stock_quantity: (bRow.stock_quantity || 0) + Number(it.quantity) })
                  .eq("id", bRow.id);
              }
            }

            if (it.variant_id) {
              const product = products.find(p => p.id === it.product_id);
              const variant = product?.product_variants?.find(v => v.id === it.variant_id);
              
              if (variant?.is_packing && variant.pack_size) {
                await supabase.rpc("decrement_product_stock", {
                  p_id: it.product_id,
                  qty: -Number(it.quantity) * variant.pack_size
                });
              } else {
                await supabase.rpc("decrement_variant_stock", {
                  v_id: it.variant_id,
                  qty: -Number(it.quantity)
                });
              }
            } else {
              await supabase.rpc("decrement_product_stock", {
                p_id: it.product_id,
                qty: -Number(it.quantity)
              });
            }
          }
        }

        const { data: oldInvoice } = await supabase
          .from("invoices")
          .select("party_id, total_amount, tax_amount, discount, status, paid_amount, edit_history")
          .eq("id", editingInvoiceId)
          .single();

        if (oldInvoice) {
          if (oldInvoice.party_id && oldInvoice.status !== "paid") {
            await supabase.rpc("increment_party_balance", {
              p_id: oldInvoice.party_id,
              amount: -Number(oldInvoice.total_amount)
            });
          }

          // Fetch product names for history entries
          const productIds = oldItems ? oldItems.map((it: any) => it.product_id) : [];
          let productsInfo: any[] = [];
          if (productIds.length > 0) {
            const { data: pInfo } = await supabase
              .from("products")
              .select("id, name")
              .in("id", productIds);
            productsInfo = pInfo || [];
          }

          const itemsWithNames = oldItems?.map((it: any) => {
            const prodName = productsInfo.find((p: any) => p.id === it.product_id)?.name || "Unknown Product";
            return {
              product_name: prodName,
              quantity: Number(it.quantity),
              unit_price: Number(it.unit_price),
              subtotal: Number(it.subtotal)
            };
          }) || [];

          const newHistoryEntry = {
            total_amount: Number(oldInvoice.total_amount),
            tax_amount: Number(oldInvoice.tax_amount || 0),
            discount: Number(oldInvoice.discount || 0),
            status: oldInvoice.status,
            paid_amount: Number(oldInvoice.paid_amount || 0),
            items: itemsWithNames,
            edited_at: new Date().toISOString(),
            edited_by: userName || "Operator"
          };

          const oldHistory = Array.isArray(oldInvoice.edit_history) ? oldInvoice.edit_history : [];
          updatedHistory = [newHistoryEntry, ...oldHistory];
        }
      }

      let invoiceData;
      if (editingInvoiceId) {
        const { data: updatedInvoice, error: updateError } = await supabase
          .from("invoices")
          .update({
            party_id: customerId,
            total_amount: total,
            tax_amount: taxAmount,
            discount: discountRupees,
            status: invoiceStatus,
            paid_amount: paymentMode === "quotation" ? 0 : (paymentMode === "credit" || paymentMode === "emi") ? receivedAmount : total,
            is_edited: true,
            edit_history: updatedHistory,
            payment_mode: paymentMode,
            register_session_id: activeSession ? activeSession.id : null,
            account_id: selectedAccountId || null,
            remarks: finalRemarks || null
          })
          .eq("id", editingInvoiceId)
          .select()
          .single();

        if (updateError) throw updateError;
        invoiceData = updatedInvoice;

        const { error: deleteItemsError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", editingInvoiceId);

        if (deleteItemsError) throw deleteItemsError;
      } else {
        const { data: insertedInvoice, error: insertError } = await supabase
          .from("invoices")
          .insert({
            shop_id: shopId,
            party_id: customerId,
            total_amount: total,
            tax_amount: taxAmount,
            discount: discountRupees,
            status: invoiceStatus,
            paid_amount: paymentMode === "quotation" ? 0 : (paymentMode === "credit" || paymentMode === "emi") ? receivedAmount : total,
            payment_mode: paymentMode,
            register_session_id: activeSession ? activeSession.id : null,
            account_id: selectedAccountId || null,
            remarks: finalRemarks || null
          })
          .select()
          .single();

        if (insertError) throw insertError;
        invoiceData = insertedInvoice;
      }

      const itemsToInsert = cart.map(item => ({
        invoice_id: invoiceData.id,
        product_id: (item.isCustomItem || item.productId.startsWith("custom-")) ? null : item.productId,
        custom_name: (item.isCustomItem || item.productId.startsWith("custom-")) ? item.name : null,
        variant_id: (item.variantId && !item.variantId.startsWith("auto-")) ? item.variantId : null,
        quantity: item.quantity,
        unit_price: item.price,
        purchase_price: item.purchasePrice || 0,
        subtotal: (() => {
          const discVal = item.discount || 0;
          const gross = item.price * item.quantity;
          return Math.max(0, item.discountType === "percentage" ? gross - (gross * discVal) / 100 : gross - discVal);
        })(),
        packing_name: item.packingName || null,
        warranty: item.warranty || null,
        batch_number: item.batchNumber || null,
        expiry_date: item.expiryDate || null,
        batch_id: item.batchId || null,
        shelf_location: item.shelfLocation || null,
        sold_imeis: item.has_imei && item.selectedImeis && item.selectedImeis.length > 0
          ? item.selectedImeis.map((i: any) => `IMEI 1: ${i.imei1}` + (i.imei2 ? `, IMEI 2: ${i.imei2}` : "")).join(" | ")
          : null,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw itemsError;

      // Deduct batch stock from product_batches for all checked-out items
      for (const item of cart) {
        if (item.batchNumber) {
          const { data: bRow } = await supabase
            .from("product_batches")
            .select("id, stock_quantity")
            .eq("shop_id", shopId)
            .eq("product_id", item.productId)
            .eq("batch_number", item.batchNumber)
            .maybeSingle();

          if (bRow) {
            const newBatchQty = Math.max(0, (bRow.stock_quantity || 0) - Number(item.quantity));
            await supabase
              .from("product_batches")
              .update({ stock_quantity: newBatchQty })
              .eq("id", bRow.id);
          }
        }
      }

      // Mark sold IMEIs as 'sold' in product_imeis table
      if (insertedItems) {
        for (let i = 0; i < cart.length; i++) {
          const cartItem = cart[i];
          const dbItem = insertedItems.find((d: any) => d.product_id === cartItem.productId && d.packing_name === (cartItem.packingName || null));
          if (cartItem.has_imei && cartItem.selectedImeis && cartItem.selectedImeis.length > 0 && dbItem) {
            const imeiIds = cartItem.selectedImeis.map((imei: any) => imei.id);
            const { error: imeiUpdateError } = await supabase
              .from("product_imeis")
              .update({
                status: "sold",
                sold_invoice_item_id: dbItem.id
              })
              .in("id", imeiIds);
            if (imeiUpdateError) throw imeiUpdateError;
          }
        }
      }

      // ── Side effects (stock, cash, gift card, loyalty, EMI) are handled ───
      // atomically inside atomic_pos_checkout v2. No client-side writes needed.


      // ── Audit Log ─────────────────────────────────────────────────────────
      logAudit(
        shopId!,
        userId,
        editingInvoiceId ? "INVOICE_EDITED" : "INVOICE_CREATED",
        "invoices",
        invoiceData.id,
        {
          invoice_id: invoiceData.id,
          total_amount: total,
          payment_mode: paymentMode,
          items_count: cart.length,
          customer_id: customerId || "walkin",
          is_edit: !!editingInvoiceId
        }
      );
      toast.success("Checkout completed successfully!");

      const currentCustomerObjNonRpc = customerId ? customers.find(c => c.id === customerId) : null;
      setLastInvoice({
        id: invoiceData.id,
        created_at: invoiceData.created_at,
        total_amount: total,
        tax_amount: taxAmount,
        discount: discountRupees,
        payment_mode: paymentMode,
        received_amount: receivedAmount,
        status: invoiceData.status,
        customer_name: currentCustomerObjNonRpc?.name || "Walk-in Customer",
        customer_phone: currentCustomerObjNonRpc?.phone || "",
        customer_balance: currentCustomerObjNonRpc?.current_balance !== undefined ? Number(currentCustomerObjNonRpc.current_balance) + (paymentMode === "credit" ? (total - receivedAmount) : 0) : 0,
        items: [...cart],
        emi_installments: emiInstallments,
        emi_frequency: emiFrequency,
        emi_markup_rate: emiMarkupRate,
        emi_first_due_date: emiFirstDueDate,
        emiSchedules: paymentMode === "emi" ? generateEmiSchedule(
          total,
          receivedAmount,
          emiInstallments,
          emiFrequency,
          emiMarkupRate,
          emiFirstDueDate
        ) : null
      });

      setCart([]);
      setDiscount(0);
      setRedeemedPoints(0);
      setTaxRate(defaultTaxRate || 0);
      setTaxType(defaultTaxType || "percentage");
      setPaymentMode("cash");
      setCustomerCnic("");
      setPrescriptionRef("");
      setSelectedCustomerId("walkin");
      setAppliedGiftCard(null);
      setAppliedGiftCardAmount(0);
      setGiftCardCode("");
      setReceivedAmount(0);
      setRemarks("");
      setShowMobileCart(false);
      setEmiInstallments(6);
      setEmiFrequency("monthly");
      setEmiMarkupRate(0);
      const todayDate = new Date();
      todayDate.setMonth(todayDate.getMonth() + 1);
      setEmiFirstDueDate(todayDate.toISOString().split("T")[0]);
      handleCloseActiveTabAfterCheckout();
      if (typeof window !== "undefined" && shopId) {
        localStorage.removeItem(`theaccounts_pos_active_draft_${shopId}`);
      }
      if (typeof window !== "undefined" && "BroadcastChannel" in window && shopId) {
        try {
          const bChannel = new BroadcastChannel("theaccounts_inventory_channel");
          bChannel.postMessage({ type: "SALE_SAVED", shopId, invoiceId: invoiceData.id, timestamp: Date.now() });
          bChannel.close();
        } catch (e) {}
      }
      setIsDraftRestored(false);
      setIsReceiptOpen(true);
      if (editingInvoiceId) {
        setEditingInvoiceId(null);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", "/dashboard/pos");
        }
      }
      fetchData(); 

    } catch (err: any) {
      toast.error("Checkout failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalChoices: any[] = activeProductForVariants ? [
    { id: "base", name: `Base Unit (${activeProductForVariants.unit || "unit"})`, price: activeProductForVariants.sale_price_single, stock: activeProductForVariants.current_stock, isBase: true },
    ...getProductUnitOptions(activeProductForVariants)
  ] : [];

  const customerChoices = [
    { id: "walkin", name: "Walk-in Customer", phone: null, current_balance: 0 },
    ...customers.filter(c => 
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearchQuery))
    )
  ];

  // Helper render function for Checkout Summary to avoid duplicate code
  const renderCheckoutSummaryContent = () => {
    const selectedCustomer = selectedCustomerId !== "walkin" ? customers.find(c => c.id === selectedCustomerId) : null;
    return (
      <>
        {activeClosingBook && (
          <div className="bg-amber-50 border border-amber-250 rounded-xl p-2.5 mb-2 text-[9.5px] text-amber-700 font-bold leading-normal">
            ⚠️ Closed Period View ({activeClosingBook.name}). Checkouts and adjustments are locked.
          </div>
        )}
                <CustomerSelector 
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          customerSearchQuery={customerSearchQuery}
          setCustomerSearchQuery={setCustomerSearchQuery}
          isCustomerDropdownOpen={isCustomerDropdownOpen}
          setIsCustomerDropdownOpen={setIsCustomerDropdownOpen}
          selectedCustomerSearchIndex={selectedCustomerSearchIndex}
          setSelectedCustomerSearchIndex={setSelectedCustomerSearchIndex}
          customerChoices={customerChoices}
          customers={customers}
          hasLoyalty={hasLoyalty}
          redeemedPoints={redeemedPoints}
          setRedeemedPoints={setRedeemedPoints}
          setDiscount={setDiscount}
          setIsCustomerModalOpen={setIsCustomerModalOpen}
          setIsCartFocused={setIsCartFocused}
          t={t}
        />

        {/* Selected Customer Details Card */}
        {selectedCustomerId !== "walkin" && selectedCustomer && (
          <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[10px] text-slate-700 relative overflow-hidden shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900">{selectedCustomer.name}</span>
              <span className={`px-2 py-0.5 rounded-full font-black text-[9px] border uppercase ${
                selectedCustomer.type === "dual" 
                  ? "bg-purple-50 text-purple-700 border-purple-100" 
                  : "bg-blue-50 text-blue-700 border-blue-100"
              }`}>
                {selectedCustomer.type === "dual" ? "Dual (Both)" : "Customer"}
              </span>
            </div>
            
            {selectedCustomer.phone && (
              <p className="flex items-center gap-1 text-slate-550 font-semibold">
                <span>📞 {selectedCustomer.phone}</span>
              </p>
            )}
            
            {selectedCustomer.address && (
              <p className="flex items-center gap-1 text-slate-550 truncate font-semibold" title={selectedCustomer.address}>
                <span>📍 {selectedCustomer.address}</span>
              </p>
            )}
            
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 mt-1">
              <span className="text-slate-400 font-bold">Khata Balance:</span>
              <span className={`font-black font-mono ${
                selectedCustomer.current_balance > 0 
                  ? "text-rose-600" 
                  : selectedCustomer.current_balance < 0 
                    ? "text-emerald-600" 
                    : "text-slate-500"
              }`}>
                {selectedCustomer.current_balance > 0 
                  ? `Rs ${selectedCustomer.current_balance.toLocaleString()} (Receivable)` 
                  : selectedCustomer.current_balance < 0 
                    ? `Rs ${Math.abs(selectedCustomer.current_balance).toLocaleString()} (Payable)` 
                    : "Rs 0 (Settled)"
                }
              </span>
            </div>

            {selectedCustomer.credit_limit !== undefined && selectedCustomer.credit_limit !== null && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                <span className="text-slate-400 font-bold">Credit Limit:</span>
                <span className="font-extrabold text-indigo-600 font-mono">
                  Rs {selectedCustomer.credit_limit.toLocaleString()}
                </span>
              </div>
            )}

            {selectedCustomer.credit_limit !== undefined && selectedCustomer.credit_limit !== null && selectedCustomer.current_balance > selectedCustomer.credit_limit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-1.5 text-[9px] text-red-600 font-extrabold flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-red-500 shrink-0" />
                <span>Credit Limit Exceeded!</span>
              </div>
            )}
          </div>
        )}

        {/* Discount & Tax */}
        <div className={`grid ${hasTax ? "grid-cols-2" : "grid-cols-1"} gap-2.5`}>
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                Discount ({discountType === "percentage" ? "%" : "Rs"}) (F4)
              </label>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("percentage");
                    setDiscount(0);
                  }}
                  className={`px-1 py-0.5 text-[8.5px] font-black rounded select-none cursor-pointer transition ${
                    discountType === "percentage"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountType("fixed");
                    setDiscount(0);
                  }}
                  className={`px-1 py-0.5 text-[8.5px] font-black rounded select-none cursor-pointer transition ${
                    discountType === "fixed"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Rs
                </button>
              </div>
            </div>
            <Input 
              id="pos-discount-input"
              type="number" 
              placeholder="0" 
              value={discount || ""} 
              onChange={(e) => {
                const newDiscount = Math.max(0, parseFloat(e.target.value) || 0);
                
                if (discountType === "percentage") {
                  if (newDiscount > 100) {
                    toast.error("100% ڈسکاؤنٹ کی اجازت نہیں ہے!");
                    setDiscount(0);
                    return;
                  }
                  const maxPct = permissions?.max_discount_percentage ?? 100;
                  if (newDiscount > maxPct) {
                    toast.error(`ڈسکاؤنٹ کی حد سے تجاوز! آپ کا پروفائل زیادہ سے زیادہ ${maxPct}% ڈسکاؤنٹ دے سکتا ہے۔`);
                    setDiscount(maxPct);
                    return;
                  }
                } else {
                  if (subtotal > 0 && newDiscount >= subtotal) {
                    toast.error("100% ڈسکاؤنٹ کی اجازت نہیں ہے!", {
                      description: "100% or greater discount is not allowed."
                    });
                    setDiscount(0);
                    return;
                  }

                  if (subtotal > 0) {
                    const pct = (newDiscount / subtotal) * 100;
                    const maxPct = permissions?.max_discount_percentage ?? 100;
                    if (pct > maxPct) {
                      const maxAllowedDiscount = Math.floor((subtotal * maxPct) / 100);
                      toast.error(`ڈسکاؤنٹ کی حد سے تجاوز! زیادہ سے زیادہ Rs ${maxAllowedDiscount} ڈسکاؤنٹ دیا جا سکتا ہے۔`);
                      setDiscount(maxAllowedDiscount);
                      return;
                    }
                  }
                }

                // Prevent selling below purchase price (Loss Prevention Check)
                const calcDiscRupees = discountType === "percentage" ? (subtotal * newDiscount) / 100 : newDiscount;
                if (calcDiscRupees > 0 && cart.length > 0) {
                  const rawSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
                  const totalPurchaseCost = cart.reduce((acc, item) => acc + item.purchasePrice * item.quantity, 0);
                  const calculatedTaxAmount = taxType === "flat" ? taxRate : (rawSubtotal * taxRate) / 100;
        const effectiveTotal = Math.max(0, rawSubtotal + calculatedTaxAmount - calcDiscRupees);
                  if (totalPurchaseCost > 0 && effectiveTotal < totalPurchaseCost) {
                    toast.error("خسارے (Loss) پر فروخت کرنے کی اجازت نہیں ہے!", {
                      description: `Selling below total purchase cost (Rs ${totalPurchaseCost.toFixed(2)}) is blocked.`,
                      id: 'below-purchase-discount'
                    });
                    setDiscount(0);
                    return;
                  }
                }

                setDiscount(newDiscount);
              }}
              className="h-8 bg-white border-slate-200 rounded-lg text-[11px]"
            />
          </div>
          {hasTax && (
            <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tax Rate (F7)</label>
              <div className="flex items-center gap-1">
                <Input 
                  id="pos-tax-input"
                  type="number" 
                  placeholder="0" 
                  value={taxRate || ""} 
                  onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="h-8 bg-white border-slate-200 rounded-lg text-[11px] w-20 text-right font-bold"
                />
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value)}
                  className="h-8 bg-white border border-slate-200 rounded-lg text-[10px] font-black px-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="percentage">%</option>
                  <option value="flat">Rs</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Remarks / Custom Note */}
        <div>
          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{t("bill_remarks")}</label>
          <Input 
            type="text" 
            placeholder="e.g. Warranty details, special requests..." 
            value={remarks} 
            onChange={(e) => setRemarks(e.target.value)}
            className="h-8 bg-white border-slate-200 rounded-lg text-[11px]"
          />
        </div>

        {/* Gift Card Redemption */}
        {hasGiftCards && (
          <div className="border-t border-slate-100 pt-2.5 space-y-1">
            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Gift Card / Coupon</label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter Gift Card Code"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                disabled={!!appliedGiftCard}
                className="h-8 bg-white border-slate-200 rounded-lg text-[11px] uppercase placeholder:normal-case"
              />
              {appliedGiftCard ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAppliedGiftCard(null);
                    setAppliedGiftCardAmount(0);
                    setGiftCardCode("");
                    toast.success("Gift Card removed!");
                  }}
                  className="h-8 px-2 bg-red-50 text-red-600 border-red-200 text-[10px] font-bold"
                >
                  Remove
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyGiftCard}
                  className="h-8 px-3 text-[10px] font-bold border-slate-200 hover:bg-slate-50"
                >
                  Apply
                </Button>
              )}
            </div>
            {appliedGiftCard && (
              <p className="text-[9px] text-emerald-600 font-bold mt-1">
                ✓ Card Applied! Rs {appliedGiftCardAmount.toLocaleString()} deducted. (Card Bal: Rs {Math.max(0, appliedGiftCard.balance - appliedGiftCardAmount).toLocaleString()})
              </p>
            )}
          </div>
        )}

        {/* Payment Mode */}
        <div>
          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Mode (F8)</label>
          <div className={`grid ${
            (industryType !== "pharmacy" && (industryType === "hardware" || industryType === "electronics" || hasEmi))
              ? "grid-cols-3" 
              : "grid-cols-2"
          } gap-2`}>
            {[
              { id: "cash", label: "💵 " + t("cash"), color: "bg-emerald-600 border-emerald-600 shadow-emerald-500/20" },
              { id: "credit", label: t("credit_udhaar_btn"), color: "bg-amber-600 border-amber-600 shadow-amber-500/20" },
              ...((industryType !== "pharmacy" && (industryType === "electronics" || hasEmi)) ? [{ id: "emi", label: t("emi_installments_btn"), color: "bg-indigo-600 border-indigo-600 shadow-indigo-500/20" }] : []),
              ...(industryType === "hardware" ? [{ id: "quotation", label: t("quotation"), color: "bg-purple-600 border-purple-600 shadow-purple-500/20" }] : [])
            ].map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setPaymentMode(mode.id as any)}
                className={`py-2 rounded-xl text-[10px] font-black tracking-wide transition-all border ${
                  paymentMode === mode.id
                    ? `${mode.color} text-white shadow-md`
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {paymentMode === "emi" && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-indigo-50/50 border border-indigo-200/60 rounded-xl p-3 space-y-3 mt-2 overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-indigo-100 pb-1.5">
                <span className="text-[9px] font-bold text-indigo-800 uppercase tracking-wide">{t("emi_settings")}</span>
                <span className="text-[9px] text-indigo-600 font-medium">{t("select_plan_label")}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[8px] font-bold text-indigo-700 uppercase tracking-widest mb-0.5">Down Payment / Advance (Rs)</label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={receivedAmount || ""}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setReceivedAmount(Math.min(total, val));
                    }}
                    className="h-7.5 bg-white border-indigo-200 focus-visible:ring-indigo-500 text-[11px] text-indigo-900 font-bold rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold text-indigo-700 uppercase tracking-widest mb-0.5">{t("total_installments")}</label>
                  <Input 
                    type="number"
                    min={1}
                    value={emiInstallments || ""}
                    onChange={(e) => setEmiInstallments(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-7.5 bg-white border-indigo-200 focus-visible:ring-indigo-500 text-[11px] text-indigo-900 font-bold rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[8px] font-bold text-indigo-700 uppercase tracking-widest mb-0.5">Markup Rate / Profit %</label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={emiMarkupRate || ""}
                    onChange={(e) => setEmiMarkupRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-7.5 bg-white border-indigo-200 focus-visible:ring-indigo-500 text-[11px] text-indigo-900 font-bold rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-bold text-indigo-700 uppercase tracking-widest mb-0.5">Payment Frequency</label>
                  <select
                    value={emiFrequency}
                    onChange={(e) => setEmiFrequency(e.target.value as any)}
                    className="w-full bg-white border border-indigo-200 h-7.5 rounded-lg px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-900"
                  >
                    <option value="monthly">📅 Monthly</option>
                    <option value="weekly">📅 Weekly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[8px] font-bold text-indigo-700 uppercase tracking-widest mb-0.5">First Payment Due Date</label>
                <Input 
                  type="date"
                  value={emiFirstDueDate}
                  onChange={(e) => setEmiFirstDueDate(e.target.value)}
                  className="h-7.5 bg-white border-indigo-200 focus-visible:ring-indigo-500 text-[10px] text-indigo-900 font-bold rounded-lg"
                />
              </div>

              {/* Dynamic plan preview summary */}
              {total > receivedAmount && (
                <div className="mt-1 border-t border-indigo-100 pt-2 space-y-1 text-[9px] text-indigo-800 font-medium">
                  <div className="flex justify-between">
                    <span>Remaining Principal:</span>
                    <span>Rs {(total - receivedAmount).toLocaleString()}</span>
                  </div>
                  {emiMarkupRate > 0 && (
                    <div className="flex justify-between text-indigo-700 font-bold">
                      <span>Markup Amount ({emiMarkupRate}%):</span>
                      <span>+Rs {Math.round((total - receivedAmount) * (emiMarkupRate / 100)).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-indigo-100 pt-1 font-bold text-indigo-950">
                    <span>Total Installment Debt:</span>
                    <span>Rs {Math.round((total - receivedAmount) * (1 + emiMarkupRate / 100)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-indigo-950 font-black text-[10px] bg-indigo-100/60 p-1.5 rounded-lg mt-1 border border-indigo-200/50">
                    <span>Per Installment Amount:</span>
                    <span>Rs {Math.round(((total - receivedAmount) * (1 + emiMarkupRate / 100)) / emiInstallments).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Dynamic Schedule Preview Details List */}
              {total > receivedAmount && (
                <div className="mt-2 bg-indigo-950 text-indigo-200 rounded-xl p-2.5 space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar font-mono text-[9px]">
                  <div className="text-[8px] uppercase tracking-wider text-indigo-400 font-bold font-sans border-b border-indigo-800 pb-1 mb-1">
                    📅 Generated Schedule Preview
                  </div>
                  {generateEmiSchedule(total, receivedAmount, emiInstallments, emiFrequency, emiMarkupRate, emiFirstDueDate).map((s) => (
                    <div key={s.installmentNum} className="flex justify-between border-b border-indigo-900/30 pb-0.5">
                      <span>Inst #{s.installmentNum}: {new Date(s.dueDate).toLocaleDateString()}</span>
                      <span className="font-bold text-white">Rs {s.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {paymentMode === "credit" && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-2.5 space-y-1.5 mt-2 overflow-hidden"
            >
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wide">{t("split_payment_udhaar")}</span>
                <span className="text-[9px] text-amber-600 font-medium">{t("remaining_balance_khata")}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[8px] font-bold text-amber-700 uppercase tracking-widest mb-0.5">Cash Paid Now (Rs)</label>
                  <Input 
                    id="pos-credit-paid-input"
                    type="number"
                    placeholder="0"
                    value={receivedAmount || ""}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setReceivedAmount(Math.min(total, val));
                    }}
                    className="h-7.5 bg-white border-amber-200 focus-visible:ring-amber-500 text-[11px] text-amber-900 font-bold rounded-lg"
                  />
                </div>
                <div className="text-right flex flex-col justify-center">
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{t("remaining_udhaar")}</span>
                  <span className="text-xs font-black text-amber-700">Rs {Math.max(0, total - receivedAmount)}</span>
                </div>
              </div>
            </motion.div>
          )}
          {(paymentMode !== "credit" || receivedAmount > 0) && accounts.length > 0 && (
            <div className="mt-2 select-none">
              <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Deposit payment to</label>
              <select 
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-700"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} (Rs {Number(acc.current_balance).toLocaleString()})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Pricing Totals */}
        <div className="border-t border-slate-200 pt-2.5 space-y-1 text-[11px]">
          {totalItemDiscount > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Gross Total:</span>
              <span className="font-semibold text-slate-700">Rs {Math.round(grossSubtotal * 100) / 100}</span>
            </div>
          )}
          {totalItemDiscount > 0 && (
            <div className="flex justify-between text-rose-600 font-bold">
              <span>Item Discounts:</span>
              <span>-Rs {Math.round(totalItemDiscount * 100) / 100}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-700">Rs {Math.round(subtotal * 100) / 100}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Tax ({taxRate}{taxType === "flat" ? " Rs" : "%"}):</span>
              <span className="font-semibold text-slate-700">Rs {Math.round(taxAmount * 100) / 100}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-red-655 font-bold">
              <span>Discount:</span>
              <span>-Rs {discount}</span>
            </div>
          )}
          {appliedGiftCardAmount > 0 && (
            <div className="flex justify-between text-emerald-655 font-bold">
              <span>Gift Card:</span>
              <span>-Rs {appliedGiftCardAmount}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-slate-900 text-xs border-t border-slate-100 pt-2">
            <span>Grand Total:</span>
            <span className="text-indigo-600 text-sm">Rs {Math.round(total * 100) / 100}</span>
          </div>

          {/* Live Bill-level Cost & Estimated Margin in Invoice Sheet mode */}
          {showCostPriceOnPos && cart.length > 0 && (() => {
            const totalCartCost = cart.reduce((sum, item) => sum + ((item.purchasePrice || 0) * item.quantity), 0);
            const netProfit = total - totalCartCost;
            const marginPercent = totalCartCost > 0 ? Math.round((netProfit / totalCartCost) * 100) : 0;
            return (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/90 rounded-xl p-2 mt-2 flex items-center justify-between text-[9.5px] font-black text-amber-950 shadow-2xs">
                <div className="flex items-center gap-1">
                  <span className="text-amber-800">💰 Cost:</span>
                  <span className="font-mono">Rs {Math.round(totalCartCost)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Profit:</span>
                  <span className={netProfit >= 0 ? "text-emerald-700 font-mono" : "text-rose-600 font-mono animate-pulse"}>
                    {netProfit >= 0 ? `+Rs ${Math.round(netProfit)}` : `-Rs ${Math.round(Math.abs(netProfit))}`}
                    <span className="text-[8px] opacity-80 font-sans ml-0.5">({marginPercent}%)</span>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Secondary Actions: Hold / Resume / Estimate */}
        <div className="grid grid-cols-3 gap-1.5 mt-2 select-none">
          <button
            type="button"
            onClick={handleHoldCart}
            disabled={cart.length === 0}
            className="py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
            title="Hold active sale (F6)"
          >
            Hold (F6)
          </button>
          <button
            type="button"
            onClick={() => setIsHeldModalOpen(true)}
            className="py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm relative"
            title="View held sales (Alt+R)"
          >
            Resume (Alt+R)
            {heldCarts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-4.5 h-4.5 text-[8px] flex items-center justify-center font-bold animate-pulse">
                {heldCarts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handlePrintQuotation}
            disabled={cart.length === 0}
            className="py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
            title="Download Quotation PDF estimate (F5)"
          >
            Quotation (F5)
          </button>
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleCheckout}
          disabled={isSubmitting || cart.length === 0 || !!activeClosingBook}
          className={`w-full font-black h-9 rounded-lg shadow-lg mt-0.5 text-[11.5px] cursor-pointer ${
            paymentMode === "quotation"
              ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/15"
              : "bg-indigo-600 hover:bg-indigo-755 text-white shadow-indigo-500/15"
          }`}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Check className="h-3.5 w-3.5 mr-1.5" />
          )}
          {paymentMode === "quotation" ? "Save Estimate / Quotation (F5 / F9)" : "Process Checkout (F9)"}
        </Button>
      </>
    );
  };

  // Helper render function for View 2 (Autocomplete Search & Spacious Cart List)
  const renderSearchModeView = () => {
    return (
      <div className="flex-1 lg:grid lg:grid-cols-12 gap-3.5 overflow-hidden p-3 min-h-0">
        {/* Left Side: Wide Panel (col-span-8) */}
        <div className={`lg:col-span-7 xl:col-span-8 flex-col bg-white border border-slate-200/80 shadow-sm rounded-2xl p-2.5 sm:p-4 overflow-hidden h-full ${showMobileCart ? "hidden lg:flex" : "flex"}`}>
          {/* Autocomplete Search input & AI Voice Controller */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-3 mb-2 sm:mb-3 shrink-0">
            {/* Action Buttons Scrollable Row */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
              <span className="hidden md:inline text-[11px] font-black text-slate-700 uppercase tracking-wider shrink-0 mr-0.5">
                Quick Search
              </span>

              {/* Quick Add Item Button */}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setQuickAddInitialName(searchQuery);
                  setIsQuickAddProductOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] sm:text-[11px] h-6.5 sm:h-7.5 rounded-lg sm:rounded-xl flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs px-2 sm:px-3"
              >
                <Plus size={12} />
                <span>Add Item</span>
              </Button>

              {/* Held Sales Button */}
              {heldCarts.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsHeldModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] sm:text-[11px] h-6.5 sm:h-7.5 rounded-lg sm:rounded-xl flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs px-2 sm:px-2.5 animate-pulse"
                  title="View and resume held sales bills (Alt+R)"
                >
                  <Pause size={11} />
                  <span>Held ({heldCarts.length})</span>
                </Button>
              )}

              {/* One-Time / Arranged Sale & Mobile Trade-In (Electronics only) */}
              {industryType === "electronics" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsOneTimeItemModalOpen(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] sm:text-[11px] h-6.5 sm:h-7.5 rounded-lg sm:rounded-xl flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs px-2 sm:px-3"
                    title="Sell market arranged stock on cash, credit, or EMI without saving product in inventory"
                  >
                    <Sparkles size={12} />
                    <span>One-Time Sale</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsTradeInModalOpen(true)}
                    className={`font-extrabold text-[10px] sm:text-[11px] h-6.5 sm:h-7.5 rounded-lg sm:rounded-xl flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs px-2 sm:px-3 ${
                      tradeInItem
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                    title="Exchange customer's old mobile phone and deduct value from total bill"
                  >
                    <Smartphone size={12} />
                    <span>{tradeInItem ? `🔄 (Rs ${tradeInItem.agreedValue.toLocaleString()})` : "🔄 Exchange"}</span>
                  </Button>
                </>
              )}

              {/* Short Book Button for Pharmacy */}
              {industryType === "pharmacy" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setQuickShortBookInitialName(searchQuery);
                    setIsQuickShortBookOpen(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] sm:text-[11px] h-6.5 sm:h-7.5 rounded-lg sm:rounded-xl flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs px-2 sm:px-3"
                >
                  <BookOpen size={12} />
                  <span>📝 Short Book</span>
                </Button>
              )}

              {industryType === "pharmacy" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenAlternateModal(null)}
                  className="bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200 font-extrabold text-[9.5px] sm:text-[10.5px] h-6.5 sm:h-7.5 rounded-lg sm:rounded-xl flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs px-2 sm:px-2.5"
                >
                  <span>💊 Alternative</span>
                </Button>
              )}
            </div>

            {/* AI Voice Controller */}
            <div className="shrink-0">
              <AIVoicePosController products={products} onAddToCart={(prod, q) => handleAddProductToCart(prod, undefined, undefined, q)} />
            </div>
          </div>

          <div className="relative mb-2 sm:mb-3.5 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
            <Input 
              id="pos-search-input"
              placeholder="Search product by name or scan barcode... (F1, Enter to select)" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchDropdownOpen(true);
                setSelectedSearchProductIndex(0);
              }}
              onFocus={() => {
                setIsCartFocused(false);
                setSelectedCartItemIndex(-1);
                setIsSearchDropdownOpen(true);
                setSelectedSearchProductIndex(0);
              }}
              className="pl-8.5 sm:pl-10 pr-14 sm:pr-16 h-8.5 sm:h-11 bg-slate-50 border-slate-200 text-slate-800 text-xs sm:text-sm rounded-xl sm:rounded-2xl focus-visible:ring-indigo-500/20"
              autoFocus
            />
            <button 
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-650 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ${searchQuery ? "right-10" : "right-3.5"}`}
              title="Scan Barcode via Camera"
            >
              <Camera size={16} />
            </button>
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

            {/* Autocomplete Floating Dropdown */}
            {isSearchDropdownOpen && searchQuery.trim() !== "" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsSearchDropdownOpen(false)} />
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-40 max-h-[340px] overflow-y-auto custom-scrollbar p-2">
                  {autocompleteResults.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-3">
                      <div className="text-xs font-black text-slate-800">
                        No products found matching &quot;{searchQuery}&quot;.
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Quickly add this product to inventory or record it in the Short Book.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchDropdownOpen(false);
                            setQuickAddInitialName(searchQuery);
                            setIsQuickAddProductOpen(true);
                          }}
                          className="h-8.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus size={14} />
                          <span>+ Add to Inventory</span>
                        </button>

                        {industryType === "electronics" && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSearchDropdownOpen(false);
                              setIsOneTimeItemModalOpen(true);
                            }}
                            className="h-8.5 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Sparkles size={14} />
                            <span>⚡ One-Time Arranged Sale</span>
                          </button>
                        )}

                        {industryType === "pharmacy" && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSearchDropdownOpen(false);
                              setQuickShortBookInitialName(searchQuery);
                              setIsQuickShortBookOpen(true);
                            }}
                            className="h-8.5 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <BookOpen size={14} />
                            <span>📝 Add to Short Book</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-2.5 py-1.5 mb-1.5 bg-slate-50 border border-slate-150 rounded-xl text-[10px] text-slate-500">
                        <span className="font-bold">Found {autocompleteResults.length} matching items</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsSearchDropdownOpen(false);
                              setQuickAddInitialName(searchQuery);
                              setIsQuickAddProductOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-2xs"
                          >
                            <Plus size={11} />
                            <span>+ Add &quot;{searchQuery.slice(0, 15)}&quot;</span>
                          </button>
                          {industryType === "pharmacy" && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsSearchDropdownOpen(false);
                                setQuickShortBookInitialName(searchQuery);
                                setIsQuickShortBookOpen(true);
                              }}
                              className="text-amber-600 hover:text-amber-800 font-bold flex items-center gap-0.5 cursor-pointer bg-white px-2 py-0.5 rounded border border-amber-100 shadow-2xs"
                            >
                              <BookOpen size={11} />
                              <span>📝 Short Book</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {autocompleteResults.map((product, pIdx) => {
                      const isHighlighted = selectedSearchProductIndex === pIdx;
                      const options = getProductUnitOptions(product);
                      return (
                        <div
                          key={`${product.id}-${pIdx}`}
                          onClick={() => {
                            handleAddProductToCart(product);
                            setSearchQuery("");
                            setIsSearchDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                            isHighlighted 
                              ? "bg-indigo-600 border-indigo-600 text-white font-black shadow-sm" 
                              : "hover:bg-slate-50 border-transparent text-slate-700"
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-black text-xs truncate flex items-center gap-1.5 ${isHighlighted ? "text-white" : "text-slate-800"}`}>
                                {product.name}
                                {language && language !== "en" && product.translated_names?.[language] && (
                                  <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded ${isHighlighted ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                                    {product.translated_names[language]}
                                  </span>
                                )}
                              </span>
                              {product.code && (
                                <span className={`text-[9px] font-mono tracking-wider px-1 rounded ${isHighlighted ? "text-white bg-indigo-700/50" : "text-slate-400 bg-slate-100"}`}>
                                  {product.code}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className={`text-[9.5px] font-bold ${isHighlighted ? "text-indigo-100" : "text-slate-400"}`}>
                                Stock: {product.current_stock} {product.unit || "unit"}
                              </span>
                              <span className={`text-[9.5px] font-black ${isHighlighted ? "text-white" : "text-indigo-700"}`}>
                                Rs {product.sale_price_single}
                              </span>
                              {showCostPriceOnPos && (
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                  isHighlighted 
                                    ? "bg-amber-400 text-slate-950 border-amber-300 shadow-xs" 
                                    : "bg-amber-50 text-amber-950 border-amber-200/90"
                                }`} title="Purchase/Cost Price and Markup">
                                  Cost: Rs {product.purchase_price_single ?? 0}
                                  {product.sale_price_single > (product.purchase_price_single ?? 0) ? (
                                    <span className={`font-black ml-1 ${isHighlighted ? "text-emerald-950" : "text-emerald-700"}`}>
                                      (+{Math.round(product.sale_price_single - (product.purchase_price_single ?? 0))})
                                    </span>
                                  ) : product.sale_price_single < (product.purchase_price_single ?? 0) ? (
                                    <span className={`font-black ml-1 ${isHighlighted ? "text-rose-950" : "text-rose-600"}`}>
                                      (-{Math.round((product.purchase_price_single ?? 0) - product.sale_price_single)})
                                    </span>
                                  ) : null}
                                </span>
                              )}
                              {product.formulations?.name && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  isHighlighted ? "bg-white/20 text-white" : "bg-violet-50 text-violet-700 border border-violet-200"
                                }`}>
                                  🧪 {product.formulations.name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Packings & Alternatives pills */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {industryType === "pharmacy" && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleOpenAlternateModal(product);
                                  setIsSearchDropdownOpen(false);
                                }}
                                className={`text-[9.5px] font-black px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                  isHighlighted 
                                    ? "bg-violet-800 border-violet-700 text-white hover:bg-white hover:text-violet-900" 
                                    : "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-600 hover:text-white shadow-2xs"
                                }`}
                                title="Find alternative medicines with same salt/formula"
                              >
                                💊 ALT
                              </button>
                            )}
                            <button
                              onClick={() => {
                                handleAddBaseUnitDirectly(product);
                                setSearchQuery("");
                                setIsSearchDropdownOpen(false);
                              }}
                              className={`text-[9.5px] font-black px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                isHighlighted 
                                  ? "bg-indigo-800 border-indigo-700 text-white hover:bg-white hover:text-black" 
                                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-900 hover:text-white"
                              }`}
                            >
                              {product.unit || "Base"}
                            </button>
                            {options.map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  handleAddProductToCart(product, opt);
                                  setSearchQuery("");
                                  setIsSearchDropdownOpen(false);
                                }}
                                className={`text-[9.5px] font-black px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                  isHighlighted
                                    ? "bg-indigo-800 border-indigo-700 text-white hover:bg-white hover:text-indigo-950"
                                    : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white"
                                }`}
                              >
                                {opt.name}
                              </button>
                            ))}
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

          {/* Cart Table List */}
          <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl bg-slate-50/20 p-2 sm:p-2.5 custom-scrollbar min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <ShoppingCart size={32} className="text-slate-200 mb-2.5" />
                <p className="text-xs font-semibold">Your checkout cart is empty.</p>
                <p className="text-[10px] text-slate-400 mt-1">Search and select items or packings to build the cart.</p>
              </div>
            ) : (
              <>
                {/* Mobile View: High-Density Cards (100% width, ZERO horizontal scroll) */}
                <div className="lg:hidden space-y-2">
                  {cart.map((item, idx) => {
                    const product = products.find((p) => p.id === item.productId);
                    const isItemHighlighted = isCartFocused && selectedCartItemIndex === idx;
                    const lineTotal = Math.round(
                      (() => {
                        const discVal = item.discount || 0;
                        const gross = item.price * item.quantity;
                        return Math.max(0, item.discountType === "percentage" ? gross - (gross * discVal) / 100 : gross - discVal);
                      })() * 100
                    ) / 100;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border transition-all bg-white shadow-xs ${
                          isItemHighlighted ? "border-indigo-500 ring-1 ring-indigo-500/20 bg-indigo-50/20" : "border-slate-200/90"
                        }`}
                      >
                        {/* Card Header: Item name, badge, and delete */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-start gap-1.5 flex-1 min-w-0">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 mt-0.5 shrink-0 select-none">
                              #{idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-slate-900 text-xs leading-tight truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {item.packingName && (
                                  <span className="text-[8.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded">
                                    {item.packingName}
                                  </span>
                                )}
                                {item.batchNumber && (
                                  <span className="text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                                    B: {item.batchNumber}
                                  </span>
                                )}
                                {item.shelfLocation && (
                                  <span className="text-[8.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded">
                                    📍 {item.shelfLocation}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => removeFromCart(idx)}
                            className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="Remove from cart"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Card Actions Row: Rate, Quantity, Discount, Total */}
                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 text-xs">
                          {/* Price */}
                          <div className="flex flex-col shrink-0">
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase">Rate</span>
                            {allowPriceEdit ? (
                              <input
                                id={`sm-rate-mob-${idx}`}
                                type="number"
                                step="any"
                                value={item.price}
                                onChange={(e) => {
                                  const parsed = parseFloat(e.target.value);
                                  updateCartItemPrice(idx, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                }}
                                className="no-spin w-16 h-6.5 bg-slate-50 border border-slate-200 rounded px-1 text-[11px] font-black text-slate-800 text-right"
                              />
                            ) : (
                              <span className="font-extrabold text-slate-800 text-[11px]">
                                Rs {item.price}
                              </span>
                            )}
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase">Qty</span>
                            <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                              <button
                                type="button"
                                onClick={() => updateCartQty(idx, Math.max(industryType === "karyana" ? 0.001 : 1, item.quantity - 1))}
                                className="h-5.5 w-5.5 flex items-center justify-center text-slate-600 hover:bg-white rounded transition-colors"
                              >
                                <Minus size={10} />
                              </button>
                              <CartQtyInput
                                id={`cart-qty-input-search-mob-${idx}`}
                                value={item.quantity}
                                max={item.stock}
                                onChange={(val) => updateCartQty(idx, val)}
                                allowDecimal={industryType === "karyana"}
                                className="text-[11px] font-black w-8 text-center border-none bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateCartQty(idx, item.quantity + 1)}
                                className="h-5.5 w-5.5 flex items-center justify-center text-slate-600 hover:bg-white rounded transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>

                          {/* Discount */}
                          {(allowPriceEdit || (item.discount && item.discount > 0)) && (
                            <div className="flex flex-col items-center shrink-0">
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase">Disc</span>
                              <div className="flex items-center gap-0.5">
                                <input
                                  type="number"
                                  step="any"
                                  value={item.discount || 0}
                                  onChange={(e) => {
                                    const parsed = parseFloat(e.target.value);
                                    updateCartItemDiscount(idx, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                  }}
                                  className="no-spin w-10 h-6 bg-slate-50 border border-slate-200 rounded px-1 text-[10px] font-bold text-slate-800 text-center"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextType = item.discountType === "percentage" ? "fixed" : "percentage";
                                    updateCartItemDiscountType(idx, nextType);
                                  }}
                                  className="h-6 px-1 rounded text-[8px] font-black bg-slate-200 text-slate-700"
                                >
                                  {item.discountType === "percentage" ? "%" : "Rs"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Total */}
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[8.5px] font-bold text-slate-400 uppercase">Total</span>
                            <span className="text-[11.5px] font-black text-indigo-600 bg-indigo-50/80 border border-indigo-100 px-1.5 py-0.5 rounded-lg">
                              Rs {lineTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Full Spreadsheet Table */}
                <div className="hidden lg:block min-w-[650px] overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                  <table className="w-full border-collapse text-left text-xs bg-white">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                        <th className="py-2.5 px-2 border border-slate-200 text-center w-[40px]">#</th>
                        <th className="py-2.5 px-3 border border-slate-200">Product Name & Variant</th>
                        {industryType === "karyana" && <th className="py-2.5 px-3 border border-slate-200 w-[140px]">Unit Type</th>}
                        <th className="py-2.5 px-3 border border-slate-200 w-[110px] text-right">Price (Rs)</th>
                        <th className="py-2.5 px-3 border border-slate-200 w-[140px] text-center">Quantity</th>
                        <th className="py-2.5 px-3 border border-slate-200 w-[125px] text-center">Discount</th>
                        <th className="py-2.5 px-3 border border-slate-200 w-[110px] text-right">Total (Rs)</th>
                        <th className="py-2.5 px-3 border border-slate-200 w-[50px] text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, idx) => {
                        const product = products.find(p => p.id === item.productId);
                        const isItemHighlighted = isCartFocused && selectedCartItemIndex === idx;
                        return (
                          <tr 
                            key={idx}
                            className={`transition-all ${
                              isItemHighlighted ? "bg-indigo-50/50" : "hover:bg-slate-50/50"
                            }`}
                          >
                            {/* Spreadsheet Row Number */}
                            <td className="py-2 px-2 border border-slate-200 text-center font-black text-slate-400 bg-slate-50/50 select-none">
                              {idx + 1}
                            </td>

                            {/* Name & Packing */}
                            <td className="py-2 px-3 border border-slate-200">
                              <div className="font-extrabold text-slate-800 text-[11px] leading-tight flex items-center flex-wrap gap-1.5">
                                {item.name}
                                {language && language !== "en" && product?.translated_names?.[language] && (
                                  <span className="text-[9.5px] text-indigo-700 font-black bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-lg">
                                    {product.translated_names[language]}
                                  </span>
                                )}
                              </div>
                              {/* Pharmacy Interactive Packing Dropdown */}
                              {industryType === "pharmacy" && product ? (
                                <div className="inline-flex items-center gap-1.5 mt-1 mr-2">
                                  <span className="text-[8px] font-black text-violet-700 uppercase tracking-wider">📦 Packing:</span>
                                  <select
                                    value={
                                      item.variantId ||
                                      (item.packingName
                                        ? getProductUnitOptions(product).find((o) => o.name === item.packingName)?.id || "base"
                                        : "base")
                                    }
                                    onChange={(e) => handleCartItemUnitChange(idx, e.target.value)}
                                    onFocus={() => {
                                      setIsCartFocused(true);
                                      setSelectedCartItemIndex(idx);
                                    }}
                                    className="text-[9.5px] font-extrabold bg-violet-50 text-violet-900 border border-violet-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer shadow-2xs h-6 hover:bg-violet-100 transition-colors"
                                    title="Change medicine packing (Loose Tablet / Leaf / Strip / Box)"
                                  >
                                    <option value="base">{product.unit || "Base Unit"} (Rs {product.sale_price_single})</option>
                                    {getProductUnitOptions(product).map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.name} (Rs {opt.price})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                item.packingName && (
                                  <span className="inline-block bg-indigo-50 text-indigo-700 text-[8px] font-extrabold px-1 py-0.5 rounded border border-indigo-100 mt-1 uppercase tracking-wide mr-1.5">
                                    Packing: {item.packingName}
                                  </span>
                                )
                              )}

                              {/* Batch Info & Switcher & Shelf */}
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {(item.batchNumber || (item.availableBatches && item.availableBatches.length > 0) || industryType === "pharmacy") && (
                                  <button
                                    type="button"
                                    onClick={() => setBatchModalItemIndex(idx)}
                                    className="inline-flex items-center gap-1 text-[8.5px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200/80 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
                                    title="Click to view all batches or switch batch (FEFO)"
                                  >
                                    <span className="font-mono">
                                      {item.batchNumber ? (
                                        <>Batch: <strong>{item.batchNumber}</strong></>
                                      ) : (
                                        <span className="text-amber-800 font-sans font-bold">Select Batch</span>
                                      )}
                                    </span>
                                    {item.expiryDate && (
                                      <span className="text-emerald-700 font-mono">
                                        · Exp: {item.expiryDate}
                                      </span>
                                    )}
                                    <span className="underline ml-0.5 text-emerald-800 font-sans font-black">
                                      Change ▾
                                    </span>
                                  </button>
                                )}
                                {item.shelfLocation && (
                                  <span className="inline-flex items-center text-[8.5px] font-bold px-1.5 py-0.5 rounded-lg border border-amber-200/80 bg-amber-50 text-amber-900">
                                    📍 Shelf: {item.shelfLocation}
                                  </span>
                                )}
                              </div>
                              {item.has_imei && item.selectedImeis && item.selectedImeis.length > 0 && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                  {item.selectedImeis.map((imei: any) => (
                                    <span key={imei.id} className="inline-block bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 font-mono tracking-tighter">
                                      {imei.imei1}{imei.imei2 ? ` / ${imei.imei2}` : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.has_imei && (!item.selectedImeis || item.selectedImeis.length === 0) && (
                                <span className="inline-block bg-amber-50 text-amber-700 text-[8px] font-bold px-1 py-0.5 rounded border border-amber-200 mt-1">
                                  ⚠ No IMEI selected
                                </span>
                              )}
                            </td>

                            {/* Unit Select */}
                            {industryType === "karyana" && (
                              <td className="py-2 px-3 border border-slate-200">
                                <select
                                  value={item.variantId || "base"}
                                  onChange={(e) => handleCartItemUnitChange(idx, e.target.value)}
                                  onFocus={() => {
                                    setIsCartFocused(true);
                                    setSelectedCartItemIndex(idx);
                                  }}
                                  className="text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold cursor-pointer w-full h-7"
                                >
                                  <option value="base">{product?.unit || "Base"} (Rs {product?.sale_price_single})</option>
                                  {product && getProductUnitOptions(product).map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name} (Rs {opt.price})</option>
                                  ))}
                                </select>
                              </td>
                            )}

                            {/* Editable Price */}
                            <td className="py-2 px-2 border border-slate-200 text-right">
                              {allowPriceEdit ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    id={`sm-rate-${idx}`}
                                    type="number"
                                    step="any"
                                    value={item.price}
                                    onChange={(e) => {
                                      const parsed = parseFloat(e.target.value);
                                      updateCartItemPrice(idx, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                    }}
                                    onFocus={(e) => { e.target.select(); setIsCartFocused(true); setSelectedCartItemIndex(idx); }}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                                        if (next < 0) document.getElementById("pos-search-input")?.focus();
                                        else if (next < cart.length) document.getElementById(`sm-rate-${next}`)?.focus();
                                      } else if (e.key === "ArrowRight") {
                                        e.preventDefault();
                                        document.getElementById(`sm-qty-${idx}`)?.focus();
                                      }
                                    }}
                                    className="no-spin w-20 h-7 bg-white border border-slate-200 rounded px-1.5 text-[11px] font-extrabold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 text-right shadow-sm"
                                    placeholder="0"
                                  />
                                </div>
                              ) : (
                                <span className="font-bold text-slate-700 block pr-1">Rs {item.price}</span>
                              )}
                              {showCostPriceOnPos && (
                                <div className="text-[8.5px] font-bold text-amber-900 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/80 mt-0.5 text-right inline-block" title="Purchase/Cost Price">
                                  <span>Cost: Rs {item.purchasePrice || 0}</span>
                                  {item.price > (item.purchasePrice || 0) ? (
                                    <span className="text-emerald-700 font-extrabold ml-1">
                                      (+{Math.round(item.price - (item.purchasePrice || 0))})
                                    </span>
                                  ) : item.price < (item.purchasePrice || 0) ? (
                                    <span className="text-rose-600 font-black ml-1 animate-pulse">
                                      (-{Math.round((item.purchasePrice || 0) - item.price)})
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </td>

                            {/* Quantity Controls */}
                            <td className="py-2 px-2 border border-slate-200 text-center">
                              {allowPriceEdit ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <input
                                    id={`sm-qty-${idx}`}
                                    type="number"
                                    step={industryType === "karyana" ? "any" : "1"}
                                    value={item.quantity}
                                    min={industryType === "karyana" ? 0.001 : 1}
                                    onChange={(e) => {
                                      const parsed = industryType === "karyana" 
                                        ? parseFloat(e.target.value) 
                                        : parseInt(e.target.value, 10);
                                      if (!isNaN(parsed) && parsed > 0) updateCartQty(idx, parsed);
                                    }}
                                    onFocus={(e) => { e.target.select(); setIsCartFocused(true); setSelectedCartItemIndex(idx); }}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                                        if (next < 0) document.getElementById("pos-search-input")?.focus();
                                        else if (next < cart.length) document.getElementById(`sm-qty-${next}`)?.focus();
                                      } else if (e.key === "ArrowLeft") {
                                        e.preventDefault();
                                        document.getElementById(`sm-rate-${idx}`)?.focus();
                                      } else if (e.key === "ArrowRight") {
                                        e.preventDefault();
                                        document.getElementById(`sm-discount-${idx}`)?.focus();
                                      }
                                    }}
                                    className="no-spin w-20 h-7 bg-white border border-slate-200 rounded px-1.5 text-[11px] font-extrabold focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-800 text-center shadow-sm"
                                  />
                                  {(() => {
                                    const pSize = product?.pack_size;
                                    if (pSize && pSize > 1) {
                                      const packs = Math.floor(item.stock / pSize);
                                      const loose = item.stock % pSize;
                                      const pLabel = item.packingName ? item.packingName.replace(/\s*\(.*\)/, "").trim() : "Box";
                                      const breakdown = packs > 0 && loose > 0 ? `${packs} ${pLabel} + ${loose}` : packs > 0 ? `${packs} ${pLabel}` : `${loose} ${product?.unit || 'pcs'}`;
                                      return (
                                        <span className="text-[8.5px] text-indigo-700 bg-indigo-50/80 border border-indigo-200/60 px-1.5 py-0.5 rounded font-extrabold ml-1.5 whitespace-nowrap" title={`Total Stock: ${item.stock} ${product?.unit || 'pcs'}`}>
                                          Stock: {item.stock} ({breakdown})
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-[8.5px] text-slate-450 font-bold ml-1.5 whitespace-nowrap">(Stock: {item.stock})</span>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                                    <button
                                      onClick={() => updateCartQty(idx, Math.max(industryType === "karyana" ? 0.001 : 1, item.quantity - 1))}
                                      className="p-1 text-slate-500 hover:bg-slate-50 rounded transition-colors"
                                    >
                                      <Minus size={10} />
                                    </button>
                                    <CartQtyInput
                                      id={`cart-qty-input-search-${idx}`}
                                      value={item.quantity}
                                      max={item.stock}
                                      onChange={(val) => updateCartQty(idx, val)}
                                      allowDecimal={industryType === "karyana"}
                                      onFocus={() => { setIsCartFocused(true); setSelectedCartItemIndex(idx); }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === "Escape") {
                                          e.preventDefault(); e.stopPropagation();
                                          e.currentTarget.blur(); setIsCartFocused(true);
                                        }
                                      }}
                                      className="text-[11px] font-extrabold w-12 text-center border-none focus:outline-none bg-transparent focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-50 rounded"
                                    />
                                    <button
                                      onClick={() => updateCartQty(idx, item.quantity + 1)}
                                      className="p-1 text-slate-500 hover:bg-slate-50 rounded transition-colors"
                                    >
                                      <Plus size={10} />
                                    </button>
                                  </div>
                                  <span className="text-[8.5px] text-slate-450 font-bold ml-1">(Stock: {item.stock})</span>
                                </div>
                              )}
                            </td>

                            {/* Discount column */}
                            <td className="py-2 px-2 border border-slate-200 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  id={`sm-discount-${idx}`}
                                  type="number"
                                  step="any"
                                  value={item.discount || 0}
                                  min={0}
                                  onChange={(e) => {
                                    const parsed = parseFloat(e.target.value);
                                    updateCartItemDiscount(idx, isNaN(parsed) ? 0 : Math.max(0, parsed));
                                  }}
                                  onFocus={(e) => { e.target.select(); setIsCartFocused(true); setSelectedCartItemIndex(idx); }}
                                  onKeyDown={(e) => {
                                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                      e.preventDefault();
                                      const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                                      if (next < 0) document.getElementById("pos-search-input")?.focus();
                                      else if (next < cart.length) document.getElementById(`sm-discount-${next}`)?.focus();
                                    } else if (e.key === "ArrowLeft") {
                                      e.preventDefault();
                                      document.getElementById(`sm-qty-${idx}`)?.focus();
                                    } else if (e.key === "ArrowRight") {
                                      e.preventDefault();
                                      document.getElementById(`sm-total-${idx}`)?.focus();
                                    }
                                  }}
                                  className="no-spin w-14 h-7 bg-white border border-slate-200 rounded px-1.5 text-[11px] font-extrabold focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-slate-800 text-center shadow-sm"
                                  placeholder="0"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextType = item.discountType === "percentage" ? "fixed" : "percentage";
                                    updateCartItemDiscountType(idx, nextType);
                                  }}
                                  className={`h-7 px-1.5 rounded border text-[9px] font-black transition-all cursor-pointer ${
                                    item.discountType === "percentage"
                                      ? "bg-rose-50 border-rose-200 text-rose-700 font-bold"
                                      : "bg-amber-50 border-amber-200 text-amber-800 font-bold"
                                  }`}
                                  title="Toggle discount percentage / flat amount"
                                >
                                  {item.discountType === "percentage" ? "%" : "Rs"}
                                </button>
                              </div>
                            </td>

                            {/* Row Total */}
                            <td className="py-2 px-2 border border-slate-200 text-right font-extrabold text-slate-900 bg-slate-50/30">
                              {allowPriceEdit ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    id={`sm-total-${idx}`}
                                    type="number"
                                    step="1"
                                    value={Math.round(
                                      (() => {
                                        const discVal = item.discount || 0;
                                        const gross = item.price * item.quantity;
                                        return Math.max(0, item.discountType === "percentage" ? gross - (gross * discVal) / 100 : gross - discVal);
                                      })()
                                    )}
                                    onChange={(e) => {
                                      const parsed = parseFloat(e.target.value);
                                      if (!isNaN(parsed) && parsed > 0) updateCartItemQtyFromTotal(idx, parsed);
                                    }}
                                    onFocus={(e) => { e.target.select(); setIsCartFocused(true); setSelectedCartItemIndex(idx); }}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                                        if (next < 0) document.getElementById("pos-search-input")?.focus();
                                        else if (next < cart.length) document.getElementById(`sm-total-${next}`)?.focus();
                                      } else if (e.key === "ArrowLeft") {
                                        e.preventDefault();
                                        document.getElementById(`sm-discount-${idx}`)?.focus();
                                      }
                                    }}
                                    className="no-spin w-20 h-7 bg-white border border-slate-200 rounded px-1.5 text-[11px] font-extrabold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-800 text-right shadow-sm"
                                    title="Edit total — quantity auto-calculated"
                                  />
                                </div>
                              ) : (
                                <span className="pr-1">Rs {Math.round(
                                  (() => {
                                    const discVal = item.discount || 0;
                                    const gross = item.price * item.quantity;
                                    return Math.max(0, item.discountType === "percentage" ? gross - (gross * discVal) / 100 : gross - discVal);
                                  })() * 100
                                ) / 100}</span>
                              )}
                            </td>

                            {/* Delete Action */}
                            <td className="py-2 px-2 border border-slate-200 text-center">
                              <button
                                onClick={() => removeFromCart(idx)}
                                className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                title="Delete Item"
                              >
                                <Trash2 size={12} />
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
          
          {/* Floating Cart Button for Mobile (Invoice Sheet / Search Mode) */}
          {!showMobileCart && cart.length > 0 && (
            <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-auto sm:right-4 z-[70] lg:hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button
                type="button"
                onClick={() => setShowMobileCart(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/25 flex items-center justify-between gap-3 px-4 py-3 border border-indigo-400/30 cursor-pointer active:scale-98 transition-transform"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold">
                    <ShoppingCart size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black leading-tight">View Cart ({cart.reduce((sum, it) => sum + it.quantity, 0)} items)</p>
                    <p className="text-[10px] text-indigo-200 font-semibold">Tap to select customer & pay</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-xl border border-white/20">
                  <span className="font-mono text-xs font-extrabold">Rs {Math.round(total).toLocaleString()}</span>
                  <span className="text-xs font-bold">→</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Checkout controls (col-span-4) */}
        <div className={`
          lg:col-span-5 xl:col-span-4 flex-col bg-white border border-slate-200/80 shadow-md rounded-2xl overflow-hidden h-full
          ${showMobileCart 
            ? "fixed inset-0 z-[150] rounded-none border-0 shadow-2xl p-0 flex pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto custom-scrollbar lg:relative lg:inset-auto lg:z-auto lg:p-0 lg:rounded-2xl lg:border lg:pb-0" 
            : "hidden lg:flex"
          }
        `}>
          {/* Header of Checkout Summary */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              {/* Back to Products on Mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileCart(false)}
                className="lg:hidden text-slate-500 hover:text-slate-700 p-1 mr-1 h-auto flex items-center gap-0.5"
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                <CreditCard size={15} />
              </div>
              <div>
                <h3 className="font-black text-slate-850 text-xs">{t("checkout_summary")}</h3>
                <p className="text-[9px] text-slate-400 font-medium">{t("customer_selection_payment")}</p>
              </div>
            </div>
            {/* Price Edit Toggle for Search Mode */}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => togglePriceEdit()}
                className={`text-[9px] font-black px-1.5 py-1 rounded-md border transition-all ${
                  allowPriceEdit
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                title="Change Selling Price Directly"
              >
                Price Edit: {allowPriceEdit ? "ON" : "OFF"}
              </button>
            )}
          </div>

          {/* Checkout Summary panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {renderCheckoutSummaryContent()}
          </div>
        </div>
      </div>
    );
  };

  if (loading && !products.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-7.5rem)] text-slate-400 bg-slate-50/20 -m-2">
        <Loader2 className="h-10 w-10 animate-spin mb-3 text-indigo-500" />
        <span className="text-xs font-semibold">Initializing POS system...</span>
      </div>
    );
  }

  if (!loading && !activeSession) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7.5rem)] bg-slate-50/20 font-sans -m-2">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-8 max-w-md w-full text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100 shadow-sm">
            <Lock size={32} />
          </div>

          <h2 className="text-xl font-black text-slate-800 mb-2">Daily Daybook is Closed</h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            To start billing, barcode scanning, and recording sales for today, open the shop's Daily Daybook. All staff members and cashiers share this session.
          </p>

          <form onSubmit={handleOpenRegister} className="space-y-4 text-left">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Starting Cash Float
                </label>
                <span className="text-[10px] text-indigo-600 font-bold">Counter Opening Cash</span>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                  Rs
                </div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-850 text-sm font-bold rounded-2xl focus-visible:ring-indigo-500/20 focus:bg-white"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isOpeningRegister}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-11 rounded-2xl shadow-lg shadow-indigo-500/15 mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isOpeningRegister ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
              Open Daybook & Start Billing
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50/20 overflow-hidden font-sans select-none">
      {/* Branded Custom POS Header */}
      <div className="h-11 sm:h-12 md:h-13 bg-zinc-950 text-white border-b border-zinc-800/80 flex items-center justify-between px-2.5 sm:px-4 shrink-0 shadow-md gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Hamburger Toggle Button (Mobile Only) */}
          <button 
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-sidebar"));
              }
            }}
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Open Sidebar"
          >
            <Menu size={17} />
          </button>
          
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="h-6 w-6 sm:h-7 sm:w-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-xs">
              <span className="text-white font-black text-[10px] sm:text-xs">HX</span>
            </div>
            <span className="font-extrabold text-[11px] sm:text-xs tracking-tight text-white/90 hidden xs:inline sm:inline">
              POS Terminal
            </span>
          </div>

          {activeSession && (
            <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 px-2 py-0.5 sm:py-1 rounded-xl text-[9px] sm:text-[10px] shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-emerald-400 font-bold uppercase tracking-wider text-[8px] bg-emerald-500/15 px-1 py-0.2 rounded">
                Active
              </span>
              <div className="hidden md:flex items-center gap-2 text-zinc-400">
                <span className="text-zinc-600 font-medium">|</span>
                <span>Opened: <strong className="text-zinc-200">{new Date(activeSession.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong></span>
                <span className="text-zinc-600 font-medium">|</span>
                <span>Float: <strong className="text-indigo-400">Rs {Number(activeSession.opening_balance).toLocaleString()}</strong></span>
                {userName && (
                  <>
                    <span className="text-zinc-600 font-medium">|</span>
                    <span className="capitalize">Cashier: <strong className="text-zinc-200">{userName}</strong></span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Weighing Scale Integration (Only for Grocery / Karyana Stores) */}
          {(industryType === "karyana" || industryType === "grocery" || industryType === "grocery_supermkt" || industryType === "supermarket") && (
            scale.isConnected ? (
              <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-xl text-[9px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">{scale.weight.toFixed(3)} kg</span>
                <button
                  type="button"
                  onClick={scale.disconnectScale}
                  className="text-[8.5px] text-zinc-400 hover:text-zinc-200 ml-1 border-l border-emerald-500/25 pl-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={scale.connectScale}
                className="hidden sm:flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2 py-0.5 rounded-xl text-[9px] text-zinc-400 font-bold transition-all cursor-pointer"
              >
                <Store size={10} /> Scale
              </button>
            )
          )}
        </div>

        {/* Catalog Sync Indicator */}
        {lastCatalogSync && (
          <div
            className="hidden xl:flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-800 px-2.5 py-0.5 rounded-xl text-[9px] text-zinc-500 select-none"
            title={`Catalog synced at ${new Date(lastCatalogSync).toLocaleString()}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500/80" />
            <span className="font-semibold text-zinc-400">Catalog:</span>
            <span>{new Date(lastCatalogSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}

        {/* Right Side Controls (Optimized, Smart, Space-Saving) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Segmented Layout Selector */}
          <div className="flex bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 h-7.5 items-center select-none">
            <button
              onClick={() => {
                setLayoutView("grid");
                if (typeof window !== "undefined" && shopId) localStorage.setItem(`pos_layout_view_${shopId}`, "grid");
              }}
              className={`px-2 sm:px-3 py-1 text-[9px] sm:text-[9.5px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                layoutView === "grid" 
                  ? "bg-indigo-600 text-white shadow-xs" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Grid View (F1)"
            >
              <LayoutGrid size={11} />
              <span className="hidden xs:inline">Grid</span>
            </button>
            <button
              onClick={() => {
                setLayoutView("search");
                if (typeof window !== "undefined" && shopId) localStorage.setItem(`pos_layout_view_${shopId}`, "search");
              }}
              className={`px-2 sm:px-3 py-1 text-[9px] sm:text-[9.5px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                layoutView === "search" 
                  ? "bg-indigo-600 text-white shadow-xs" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Search / Sheet View (F1)"
            >
              <Zap size={11} />
              <span className="hidden xs:inline">Sheet</span>
            </button>
          </div>

          {/* Price Edit Switcher */}
          <button
            type="button"
            onClick={togglePriceEdit}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-0.5 font-bold rounded-xl border transition-all text-[9px] sm:text-[9.5px] h-7.5 cursor-pointer ${
              allowPriceEdit
                ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400"
            }`}
            title="Toggle Price Editing directly in cart (Alt+P)"
          >
            <Edit3 size={11} className={allowPriceEdit ? "text-white animate-pulse" : "text-zinc-500"} />
            <span className="hidden sm:inline">Price:</span>
            <span className={`font-black ${allowPriceEdit ? "text-white" : "text-zinc-500"}`}>
              {allowPriceEdit ? "ON" : "OFF"}
            </span>
          </button>

          {/* Cost Price Switcher (Desktop/Tablet Only) */}
          <button
            type="button"
            onClick={() => setShowCostPriceOnPos?.(!showCostPriceOnPos)}
            className={`hidden md:flex items-center gap-1 px-2.5 py-0.5 font-bold rounded-xl border transition-all text-[9.5px] h-7.5 cursor-pointer ${
              showCostPriceOnPos
                ? "bg-amber-500 border-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400"
                : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400"
            }`}
            title="Toggle Purchase/Cost Price & Margins Visibility"
          >
            <span>💰 Cost:</span>
            <span className={`font-black ${showCostPriceOnPos ? "text-slate-950 font-black" : "text-zinc-500"}`}>
              {showCostPriceOnPos ? "ON" : "OFF"}
            </span>
          </button>

          {/* Mini Language Switcher (Tablet/Desktop Only) */}
          <div className="hidden lg:flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[9.5px]">
            {(activeLanguages && activeLanguages.length > 0 ? activeLanguages : ["en", "ur"]).map((lang: string) => {
              const langLabels: Record<string, string> = {
                en: "EN",
                ur: "اردو",
                hi: "हिन्दी",
                bn: "বাংলা",
                ta: "தமிழ்",
                te: "తెలుగు",
                ar: "العربية",
                fa: "فارسی",
                ps: "پښتو",
                sd: "سنڌي"
              };
              return (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang as any)}
                  className={`px-1.5 py-0.5 font-bold rounded transition-all ${
                    language === lang ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {langLabels[lang] || lang.toUpperCase()}
                </button>
              );
            })}
          </div>

          {activeSession && (
            <button
              type="button"
              onClick={handleOpenCloseRegisterModal}
              className="bg-red-600/20 border border-red-500/30 hover:bg-red-600 text-red-400 hover:text-white font-black px-2 sm:px-2.5 py-0.5 rounded-xl transition-all shadow-xs text-[9px] sm:text-[10px] flex items-center gap-1 h-7.5 shrink-0 cursor-pointer"
              title="End / Close Register Shift"
            >
              <LogOut size={11} />
              <span className="hidden sm:inline">End Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Bill Desktop POS Tab Bar */}
      <PosTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSwitchTab}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        customers={customers}
        isEditing={Boolean(editingInvoiceId)}
      />

      {/* Auto-Saved Draft Restored Banner */}
      {isDraftRestored && !editingInvoiceId && cart.length > 0 && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs font-semibold text-emerald-900 shrink-0 select-none animate-in fade-in duration-200 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-ping" />
            <span className="truncate">
              <span className="sm:hidden">🛡️ <strong>Draft Restored</strong> ({cart.length} item{cart.length > 1 ? "s" : ""})</span>
              <span className="hidden sm:inline">🛡️ <strong>Auto-Saved POS Draft Restored:</strong> Your customer sale cart ({cart.length} item{cart.length > 1 ? "s" : ""}) was recovered safely.</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDraftRestored(false)}
              className="px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold bg-white text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs cursor-pointer"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Discard recovered POS draft and start with a fresh empty cart?")) {
                  setCart([]);
                  setSelectedCustomerId("walkin");
                  setDiscount(0);
                  setRemarks("");
                  setTradeInItem(null);
                  if (typeof window !== "undefined" && shopId) {
                    localStorage.removeItem(`theaccounts_pos_active_draft_${shopId}`);
                  }
                  setIsDraftRestored(false);
                  toast.info("POS draft cart discarded.");
                }
              }}
              className="px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-lg shadow-2xs cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode Indicator Banner */}
      {editingInvoiceId && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs font-bold text-amber-900 shrink-0 select-none animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              ✏️ Edit Mode
            </span>
            <span>
              Editing Sale Invoice: <span className="font-extrabold text-amber-950 underline">{editingInvoiceNumber || editingInvoiceId}</span>
            </span>
            <span className="hidden sm:inline text-[10.5px] text-amber-800/80 font-normal">
              (Items loaded into cart. Changes will update this invoice and adjust stock & ledger automatically.)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Cancel editing this invoice and return to standard POS?")) {
                setEditingInvoiceId(null);
                setEditingInvoiceNumber(null);
                setCart([]);
                setDiscount(0);
                setPaymentMode("cash");
                setSelectedCustomerId("walkin");
                router.replace("/dashboard/pos");
              }
            }}
            className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg text-[10.5px] font-black cursor-pointer shadow-xs transition-colors flex items-center gap-1"
          >
            <X size={12} />
            <span>Cancel Edit / New Sale</span>
          </button>
        </div>
      )}

      {/* Pharmacy Alerts Banner */}
      {industryType === "pharmacy" && showExpiryAlertsBanner && (nearExpiryAlerts.length > 0 || products.some(p => Number(p.current_stock) <= (p.min_stock_level ?? 10))) && (
        <div className="mx-3 mt-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-3.5 shadow-sm text-xs text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-300 shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 flex-shrink-0 animate-pulse">
              <AlertTriangle size={16} />
            </div>
            <div>
              <p className="font-extrabold text-amber-950 flex items-center gap-1.5">
                <span>⚠️ Pharmacy Stock Alert</span>
              </p>
              <p className="text-amber-700 font-medium mt-0.5 text-[11px]">
                {nearExpiryAlerts.length > 0 && (
                  <span className="mr-2">
                    Near-Expiry: <span className="font-black text-amber-900">{nearExpiryAlerts.length} batch(es) expiring soon</span>.
                  </span>
                )}
                {products.filter(p => Number(p.current_stock) <= (p.min_stock_level ?? 10)).length > 0 && (
                  <span>
                    Low Stock: <span className="font-black text-amber-900">{products.filter(p => Number(p.current_stock) <= (p.min_stock_level ?? 10)).length} item(s) below reorder level</span>.
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategoryId("all");
                toast.info("Filter applied: Look for yellow Reorder badges on product cards!");
              }}
              className="bg-white border-amber-250 hover:bg-amber-100/50 text-amber-800 font-black h-8 text-[10px] rounded-xl"
            >
              Highlight Low Stock
            </Button>
            <button 
              onClick={() => setShowExpiryAlertsBanner(false)}
              className="p-1 hover:bg-amber-100 rounded-lg text-amber-650 hover:text-amber-800 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      {layoutView === "grid" ? (
        <div className="flex-1 lg:grid lg:grid-cols-12 gap-3.5 overflow-hidden p-3 min-h-0">
          {editingInvoiceId && (
          <div className="col-span-full bg-amber-50 border border-amber-200 rounded-2xl p-2.5 px-4 flex items-center justify-between text-xs text-amber-800 shadow-sm shrink-0 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-amber-700">⚠️ EDITING BILL:</span>
              <span>
                You are editing bill <span className="font-mono bg-amber-100/80 px-1 py-0.5 rounded font-bold">#{editingInvoiceId.slice(0, 8).toUpperCase()}</span>.
                Saving will restock old items, adjust Khata, and update the invoice.
              </span>
            </div>
            <button
              onClick={() => {
                setEditingInvoiceId(null);
                setCart([]);
                setDiscount(0);
                setTaxRate(defaultTaxRate || 0);
                setTaxType(defaultTaxType || "percentage");
                setPaymentMode("cash");
                setSelectedCustomerId("walkin");
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", "/dashboard/pos");
                }
                toast.info("Invoice edit cancelled.");
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Cancel Edit
            </button>
          </div>
        )}
          <ProductGrid 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isScannerOpen={isScannerOpen}
            setIsScannerOpen={setIsScannerOpen}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            setSelectedCategoryId={setSelectedCategoryId}
            loading={loading}
            filteredProducts={filteredProducts}
            paginatedProducts={paginatedProducts}
            page={page}
            setPage={setPage}
            PAGE_SIZE={PAGE_SIZE}
            selectedGridIndex={selectedGridIndex}
            setSelectedGridIndex={setSelectedGridIndex}
            selectedGridUnitIndex={selectedGridUnitIndex}
            handleAddProductToCart={handleAddProductToCart}
            handleAddBaseUnitDirectly={handleAddBaseUnitDirectly}
            getProductUnitOptions={getProductUnitOptions}
            language={language}
            isPharmacy={industryType === "pharmacy"}
            showCostPrice={showCostPriceOnPos}
            onToggleCostPrice={() => setShowCostPriceOnPos?.(!showCostPriceOnPos)}
            onOpenAlternateModal={handleOpenAlternateModal}
            onOpenQuickAddModal={(name) => {
              setQuickAddInitialName(name || "");
              setIsQuickAddProductOpen(true);
            }}
            onOpenQuickShortBookModal={(name) => {
              setQuickShortBookInitialName(name || "");
              setIsQuickShortBookOpen(true);
            }}
          />
          <CartSidebar 
            cart={cart}
            setCart={setCart}
            subtotal={subtotal}
            discount={discount}
            setDiscount={setDiscount}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
            taxAmount={taxAmount}
            total={total}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode as any}
            receivedAmount={receivedAmount}
            setReceivedAmount={setReceivedAmount}
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            appliedGiftCardAmount={appliedGiftCardAmount}
            giftCardInput={giftCardCode}
            setGiftCardInput={setGiftCardCode}
            isVerifyingGiftCard={false}
            handleVerifyGiftCard={handleApplyGiftCard}
            handleHoldCart={handleHoldCart}
            handlePrintQuotation={handlePrintQuotation}
            handleCheckout={handleCheckout}
            isSubmitting={isSubmitting}
            activeClosingBook={activeClosingBook}
            heldCarts={heldCarts}
            setIsHeldModalOpen={setIsHeldModalOpen}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            customers={customers}
            t={t}
            permissions={permissions}
            redeemedPoints={redeemedPoints}
            setRedeemedPoints={setRedeemedPoints}
            customerSearchQuery={customerSearchQuery}
            setCustomerSearchQuery={setCustomerSearchQuery}
            isCustomerDropdownOpen={isCustomerDropdownOpen}
            setIsCustomerDropdownOpen={setIsCustomerDropdownOpen}
            selectedCustomerSearchIndex={selectedCustomerSearchIndex}
            setSelectedCustomerSearchIndex={setSelectedCustomerSearchIndex}
            customerChoices={customerChoices}
            hasLoyalty={hasLoyalty}
            setIsCustomerModalOpen={setIsCustomerModalOpen}
            setIsCartFocused={setIsCartFocused}
            allowPriceEdit={allowPriceEdit}
            showMobileCart={showMobileCart}
            onCloseMobileCart={() => setShowMobileCart(false)}
            onOpenAlternateModal={handleOpenAlternateModalForCartItem}
            products={products}
            getProductUnitOptions={getProductUnitOptions}
            onCartItemUnitChange={handleCartItemUnitChange}
          />

      {/* Floating Cart Button for Mobile (Grid Mode) */}
      {!showMobileCart && cart.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-auto sm:right-4 z-[70] lg:hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            type="button"
            onClick={() => setShowMobileCart(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/25 flex items-center justify-between gap-3 px-4 py-3 border border-indigo-400/30 cursor-pointer active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold">
                <ShoppingCart size={16} />
              </div>
              <div className="text-left">
                <p className="text-xs font-black leading-tight">View Cart ({cart.reduce((sum, it) => sum + it.quantity, 0)} items)</p>
                <p className="text-[10px] text-indigo-200 font-semibold">Tap to select customer & pay</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/15 px-3 py-1.5 rounded-xl border border-white/20">
              <span className="font-mono text-xs font-extrabold">Rs {Math.round(total).toLocaleString()}</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </button>
        </div>
      )}

      {/* Floating Held Bills Pill for Mobile when cart is empty */}
      {!showMobileCart && cart.length === 0 && heldCarts.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-auto sm:right-4 z-[70] lg:hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                  {heldCarts.length} Held {heldCarts.length === 1 ? "Sale Bill" : "Sale Bills"}
                </p>
                <p className="text-[10px] text-amber-100 font-semibold">Tap to view & resume sale bill</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 text-xs font-extrabold">
              <span>Resume</span>
              <span>→</span>
            </div>
          </button>
        </div>
      )}

      {/* Keyboard Shortcut Cheat Sheet */}
      <div className="col-span-full bg-slate-900 text-slate-400 text-[10px] py-2 px-4 rounded-xl flex flex-wrap gap-x-4 gap-y-1 justify-center items-center mt-3 border border-slate-800 shrink-0 select-none">
        <button 
          type="button"
          onClick={() => setIsShortcutsHelpOpen(true)}
          className="font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider text-[9px] mr-1 flex items-center gap-1 transition-all focus:outline-none"
        >
          Hotkeys (F10 - View All):
        </button>
        {isCartFocused ? (
          <>
            <div><kbd className="bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold shadow-sm mr-1">F3</kbd>Exit Cart Focus</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">Arrows Up/Dn</kbd>Nav Cart Items</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">Enter / 0-9</kbd>Change Qty</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">Del/Backsp</kbd>Delete Item</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">Space / U</kbd>Cycle Unit</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F10</kbd>Show All</div>
          </>
        ) : (
          <>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F1</kbd>Search Prod</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F2</kbd>Search Cust</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F3</kbd>Focus Cart</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F8</kbd>Toggle Pay</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F9</kbd>Checkout</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F6</kbd>Hold Bill</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">Alt+R</kbd>Resume Bill</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">PgUp/PgDn</kbd>Page Nav</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">F10</kbd>Show All</div>
            <div><kbd className="bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-700 shadow-sm mr-1">ESC</kbd>Clear/Close</div>
          </>
        )}
      </div>
        </div>
      ) : (
        renderSearchModeView()
      )}

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
                  {hardwareCalcProduct.measurement_type === "dimension" ? "📐 Dimension Calculator" : "📏 Length Calculator"}
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
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">📏 Length</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={hardwareCalcLengthFt || ""}
                            onChange={(e) => setHardwareCalcLengthFt(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="font-mono text-slate-800 h-10 pr-10"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-len-in")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ft</span>
                        </div>
                        <div className="relative">
                          <Input
                            id="hw-len-in"
                            type="number"
                            min={0}
                            max={11}
                            placeholder="0"
                            value={hardwareCalcLengthIn || ""}
                            onChange={(e) => setHardwareCalcLengthIn(Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                            className="font-mono text-slate-800 h-10 pr-10"
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-wid-ft")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">in</span>
                        </div>
                      </div>
                    </div>

                    {/* WIDTH: ft + in */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">📐 Width</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input
                            id="hw-wid-ft"
                            type="number"
                            min={0}
                            placeholder="0"
                            value={hardwareCalcWidthFt || ""}
                            onChange={(e) => setHardwareCalcWidthFt(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className="font-mono text-slate-800 h-10 pr-10"
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-wid-in")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ft</span>
                        </div>
                        <div className="relative">
                          <Input
                            id="hw-wid-in"
                            type="number"
                            min={0}
                            max={11}
                            placeholder="0"
                            value={hardwareCalcWidthIn || ""}
                            onChange={(e) => setHardwareCalcWidthIn(Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                            className="font-mono text-slate-800 h-10 pr-10"
                            onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-qty-input")?.focus(); }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">in</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* LENGTH-only for running-ft products */
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">📏 Length</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={hardwareCalcLengthFt || ""}
                          onChange={(e) => setHardwareCalcLengthFt(Math.max(0, parseInt(e.target.value, 10) || 0))}
                          className="font-mono text-slate-800 h-10 pr-10"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-len-in")?.focus(); }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ft</span>
                      </div>
                      <div className="relative">
                        <Input
                          id="hw-len-in"
                          type="number"
                          min={0}
                          max={11}
                          placeholder="0"
                          value={hardwareCalcLengthIn || ""}
                          onChange={(e) => setHardwareCalcLengthIn(Math.min(11, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                          className="font-mono text-slate-800 h-10 pr-10"
                          onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("hw-qty-input")?.focus(); }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">in</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">🔢 No. of {hardwareCalcProduct.measurement_type === "dimension" ? "Sheets / Pieces" : "Pieces"}</label>
                  <Input
                    id="hw-qty-input"
                    type="number"
                    min={1}
                    value={hardwareCalcQty || ""}
                    onChange={(e) => setHardwareCalcQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="font-mono text-slate-800 h-10"
                    onKeyDown={(e) => { if (e.key === "Enter") handleConfirmHardwareCalculation(); }}
                  />
                </div>

                {/* Live Preview Box */}
                {(() => {
                  const lenFt = hardwareCalcLengthFt + hardwareCalcLengthIn / 12;
                  const widFt = hardwareCalcWidthFt  + hardwareCalcWidthIn  / 12;
                  const qty  = hardwareCalcQty;
                  const isDim = hardwareCalcProduct.measurement_type === "dimension";
                  const computed = isDim ? lenFt * widFt * qty : lenFt * qty;
                  const total = computed * hardwareCalcProduct.sale_price_single;
                  return (
                    <div className="bg-gradient-to-br from-slate-50 to-indigo-50 p-4 rounded-xl border border-indigo-100 mt-1 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Exact Area / Qty:</span>
                        <span className="font-bold text-indigo-700 font-mono text-sm">
                          {computed.toFixed(3)} sq ft
                        </span>
                      </div>
                      {hardwareCalcWastage > 0 && (
                        <div className="flex justify-between items-center text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          <span className="font-semibold">+ {hardwareCalcWastage}% Wastage:</span>
                          <span className="font-bold font-mono">{(computed * (1 + hardwareCalcWastage / 100)).toFixed(3)} sq ft</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-indigo-200 pt-2 font-bold text-sm">
                        <span className="text-slate-600">Total Price:</span>
                        <span className="font-mono text-blue-600">Rs {total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2 pt-2">
                  {/* Wastage Factor Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">⚠ Wastage Factor %</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        placeholder="0"
                        value={hardwareCalcWastage || ""}
                        onChange={(e) => setHardwareCalcWastage(Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="font-mono text-slate-800 h-9 text-xs w-24"
                      />
                      <span className="text-xs text-slate-400 font-semibold">% extra for cutting waste</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setHardwareCalcProduct(null)} 
                      className="h-10 rounded-xl text-xs"
                    >
                      Cancel
                    </Button>
                    {hardwareCalcWastage > 0 ? (
                      <Button 
                        type="button" 
                        onClick={() => { handleConfirmHardwareCalculation(hardwareCalcWastage); }} 
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 rounded-xl text-xs"
                      >
                        + {hardwareCalcWastage}% Wastage Add
                      </Button>
                    ) : (
                      <Button 
                        type="button" 
                        onClick={() => handleConfirmHardwareCalculation(0)} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 rounded-xl text-xs"
                      >
                        Add to Cart
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Select Packing Variant Backup Fallback */}
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
              <h3 className="text-base font-bold text-slate-800 mb-1">Select Packing Variation</h3>
              <p className="text-xs text-slate-400 mb-4">"{activeProductForVariants.name}" has multiple packings available.</p>
              
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {modalChoices.map((opt, oIdx) => {
                  const isChoiceSelected = selectedModalIndex === oIdx;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (opt.isBase) {
                          handleAddBaseUnitDirectly(activeProductForVariants);
                        } else {
                          handleAddProductToCart(activeProductForVariants, opt);
                        }
                        setActiveProductForVariants(null);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all flex justify-between items-center border ${
                        isChoiceSelected 
                          ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20" 
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div>
                        <p className={`font-extrabold text-xs ${isChoiceSelected ? "text-indigo-900" : "text-slate-800"}`}>
                          {opt.name}
                        </p>
                        <p className="text-[10px] text-slate-400">Stock: {opt.stock} units</p>
                      </div>
                      <span className={`font-extrabold text-xs ${isChoiceSelected ? "text-indigo-700" : "text-slate-900"}`}>
                        Rs {opt.price}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4 pt-2 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setActiveProductForVariants(null)} className="text-xs rounded-xl font-bold">Cancel</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Add New Customer */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsCustomerModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm relative z-10 border border-slate-150"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-800 text-sm">Add New Customer</h3>
                <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-455 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
                  <Input 
                    placeholder="Customer Name" 
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    className="rounded-xl h-9.5 text-xs border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number (Optional)</label>
                  <Input 
                    placeholder="Phone e.g. 03001234567" 
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    className="rounded-xl h-9.5 text-xs border-slate-200"
                  />
                </div>
                <Button onClick={handleAddCustomer} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold h-10 rounded-xl shadow-lg shadow-indigo-500/15 mt-1">
                  Save Customer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            <CheckoutModal 
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        lastInvoice={lastInvoice}
        shopDetails={shopDetails}
        receiptSettings={receiptSettings}
        language={language}
        whatsappInputPhone={whatsappInputPhone}
        setWhatsappInputPhone={setWhatsappInputPhone}
        handleSendPOSWhatsApp={handleSendPOSWhatsApp}
      />

      {/* MODAL: Keyboard Shortcuts Guide */}
      <AnimatePresence>
        {isShortcutsHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsShortcutsHelpOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg relative z-10 border border-slate-150 flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                    <ShoppingCart size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Keyboard Shortcuts Help Guide</h3>
                    <p className="text-[10px] text-slate-400">Perform billing actions entirely mouse-free</p>
                  </div>
                </div>
                <button onClick={() => setIsShortcutsHelpOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1 pb-2">
                {/* Section 0: Multi-Bill Desktop Tabs */}
                <div>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span>⚡ Multi-Bill Desktop Tabs</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                      <span className="text-slate-700 font-bold">New Sale Bill</span>
                      <kbd className="bg-white border border-indigo-200 px-2 py-0.5 rounded font-black text-indigo-700 shadow-sm text-[10px]">Alt+T</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                      <span className="text-slate-700 font-bold">Close Current Bill</span>
                      <kbd className="bg-white border border-indigo-200 px-2 py-0.5 rounded font-black text-rose-600 shadow-sm text-[10px]">Alt+W</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-xl border border-indigo-100 col-span-2">
                      <span className="text-slate-700 font-bold">Switch to Bill 1, 2, 3...</span>
                      <kbd className="bg-white border border-indigo-200 px-2 py-0.5 rounded font-black text-indigo-700 shadow-sm text-[10px]">Alt+1 ... Alt+9</kbd>
                    </div>
                  </div>
                </div>

                {/* Section 1: Global Shortcuts */}
                <div>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Global Navigation</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Search Product</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F1 / Alt+S</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Search Customer</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F2 / Alt+C</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Focus Cart Panel</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F3 / Alt+A</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Help Menu</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F10 / Alt+K</kbd>
                    </div>
                  </div>
                </div>

                {/* Section 2: Product Grid Navigation */}
                <div>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Product Grid Navigation</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Move Highlight</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Arrow Keys</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Add Selected to Cart</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Enter</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-slate-600 font-semibold">Page Navigation (20 per page)</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">PageUp / PageDown</kbd>
                    </div>
                  </div>
                </div>

                {/* Section 3: Cart Focus Mode */}
                <div>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Cart Item Operations (F3 Mode)</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Select Next/Prev Item</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Up / Down Arrow</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Cycle Packing / Unit</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Space / U</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Qty -1 / +1</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Left / Right Arrow</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Delete Cart Item</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Delete</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-slate-600 font-semibold">Focus Qty Box (Direct Edit)</span>
                      <div className="flex gap-1.5 font-sans">
                        <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Enter</kbd>
                        <span className="text-slate-400 font-semibold">or press</span>
                        <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">0-9</kbd>
                        <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">.</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Checkout Actions */}
                <div>
                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Checkout & Invoice</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Focus Discount</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F4 / Alt+D</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Save Quotation</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F5 / Alt+Q</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Hold Sale</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F6</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Focus Tax Input</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F7 / Alt+T</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Toggle Payment Mode</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F8</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Complete Checkout</span>
                      <kbd className="bg-indigo-600 border border-indigo-700 text-white px-2 py-0.5 rounded font-black shadow-sm text-[10px]">F9 / F12</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Resume Held Bills</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Alt+R</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Add New Customer</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Alt+N</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-slate-600 font-semibold">Close Modals / Clear Search / Reset Cart</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">ESC</kbd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold font-mono">Press ESC or click outside to exit</span>
                <Button onClick={() => setIsShortcutsHelpOpen(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-9 rounded-xl shadow-md cursor-pointer">
                  Got It!
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Close Daybook Session */}
      <AnimatePresence>
        {isCloseRegisterOpen && activeSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsCloseRegisterOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-10 border border-slate-150 flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Close Daily Daybook</h3>
                    <p className="text-[10px] text-slate-400">Complete day financial summary & cash verification</p>
                  </div>
                </div>
                <button onClick={() => setIsCloseRegisterOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2 custom-scrollbar">
                {loadingShiftStats ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-500" />
                    <span className="text-xs font-semibold">Calculating complete Daybook totals...</span>
                  </div>
                ) : (
                  <>
                    {/* Session details */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Daybook Opened:</span>
                        <span className="font-bold text-slate-800">{new Date(activeSession.opened_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Current User:</span>
                        <span className="font-bold text-slate-800 capitalize">{userName || "Admin"}</span>
                      </div>
                    </div>

                    {/* Complete Financial Summary */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Daybook Financial Overview</h4>
                      <div className="space-y-2">
                        {/* Opening Float */}
                        <div className="flex justify-between items-center text-xs bg-slate-50 p-3 rounded-2xl border border-slate-150">
                          <span className="text-slate-600 font-semibold">Opening Float:</span>
                          <span className="font-black text-slate-800 text-sm">Rs {Number(activeSession.opening_balance).toLocaleString()}</span>
                        </div>

                        {/* Cash Sales */}
                        {(() => {
                          const cashSales = shiftInvoices
                            .filter(inv => inv.payment_mode === "cash" || (inv.payment_mode === "credit" && Number(inv.paid_amount || 0) > 0))
                            .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
                          return (
                            <div className="flex justify-between items-center text-xs bg-emerald-50/60 p-3 rounded-2xl border border-emerald-150">
                              <span className="text-emerald-800 font-semibold">(+) Total Cash Sales:</span>
                              <span className="font-black text-emerald-700 text-sm">Rs {cashSales.toLocaleString()}</span>
                            </div>
                          );
                        })()}

                        {/* Khata Inflows */}
                        {shiftKhataIn > 0 && (
                          <div className="flex justify-between items-center text-xs bg-teal-50/60 p-3 rounded-2xl border border-teal-150">
                            <span className="text-teal-800 font-semibold">(+) Khata Received (Wasooli):</span>
                            <span className="font-black text-teal-700 text-sm">Rs {shiftKhataIn.toLocaleString()}</span>
                          </div>
                        )}

                        {/* Cash Expenses */}
                        {shiftExpenses > 0 && (
                          <div className="flex justify-between items-center text-xs bg-red-50/60 p-3 rounded-2xl border border-red-150">
                            <span className="text-red-800 font-semibold">(-) Cash Expenses:</span>
                            <span className="font-black text-red-700 text-sm">-Rs {shiftExpenses.toLocaleString()}</span>
                          </div>
                        )}

                        {/* Cash Purchases */}
                        {shiftPurchases > 0 && (
                          <div className="flex justify-between items-center text-xs bg-amber-50/60 p-3 rounded-2xl border border-amber-150">
                            <span className="text-amber-800 font-semibold">(-) Cash Purchases:</span>
                            <span className="font-black text-amber-700 text-sm">-Rs {shiftPurchases.toLocaleString()}</span>
                          </div>
                        )}

                        {/* Final Net Cash Drawer Total */}
                        {(() => {
                          const cashSales = shiftInvoices
                            .filter(inv => inv.payment_mode === "cash" || (inv.payment_mode === "credit" && Number(inv.paid_amount || 0) > 0))
                            .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
                          const expectedDrawerCash = Math.max(0, 
                            Number(activeSession.opening_balance) + 
                            cashSales + 
                            shiftKhataIn - 
                            shiftExpenses - 
                            shiftPurchases
                          );
                          return (
                            <div className="bg-gradient-to-br from-slate-900 via-zinc-900 to-indigo-950 text-white p-4 rounded-2xl shadow-lg border border-slate-800 mt-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-[10px] uppercase font-black tracking-widest text-indigo-300">Total Cash in Drawer</p>
                                  <p className="text-xl font-black text-emerald-400 mt-0.5">Rs {expectedDrawerCash.toLocaleString()}</p>
                                </div>
                                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                                  <DollarSign size={22} />
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Card Sales */}
                        {(() => {
                          const cardSales = shiftInvoices
                            .filter(inv => inv.payment_mode === "card")
                            .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
                          if (cardSales === 0) return null;
                          return (
                            <div className="flex justify-between items-center text-xs bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                              <span className="text-blue-700 font-semibold">💳 Card / Bank Sales:</span>
                              <span className="font-black text-blue-700">Rs {cardSales.toLocaleString()}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Optional Note */}
                    <div className="border-t border-slate-100 pt-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        Closing Daybook Note (Optional)
                      </label>
                      <textarea
                        placeholder="e.g. all accounts tallied, daybook closed for today"
                        value={closingNote}
                        onChange={(e) => setClosingNote(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 h-14 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-800"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100 shrink-0">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCloseRegisterOpen(false)}
                  className="flex-1 text-slate-655 font-bold h-11 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCloseRegister}
                  disabled={isClosingRegister || loadingShiftStats}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black h-11 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/20 cursor-pointer"
                >
                  {isClosingRegister ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut size={16} />
                  )}
                  Confirm & Close Daybook
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: IMEI Selection */}
      <AnimatePresence>
        {isImeiSelectModalOpen && imeiModalProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-transparent"
              onClick={() => {
                setIsImeiSelectModalOpen(false);
                setImeiModalProduct(null);
                setImeiSearchQuery("");
              }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg relative z-10 border border-slate-150 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Select Mobile IMEI</h3>
                    <p className="text-[10px] text-slate-400">{imeiModalProduct.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsImeiSelectModalOpen(false);
                    setImeiModalProduct(null);
                    setImeiSearchQuery("");
                  }} 
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-4 shrink-0">
                <Input 
                  placeholder="Search IMEI numbers..." 
                  value={imeiSearchQuery}
                  onChange={(e) => setImeiSearchQuery(e.target.value)}
                  className="rounded-xl h-9.5 text-xs border-slate-200"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2 custom-scrollbar min-h-[150px]">
                {loadingImeis ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-450">
                    <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-500" />
                    <span className="text-xs font-semibold">Loading available IMEIs...</span>
                  </div>
                ) : (
                  (() => {
                    const filtered = availableImeis.filter(imei => 
                      imei.imei1.toLowerCase().includes(imeiSearchQuery.toLowerCase()) ||
                      (imei.imei2 && imei.imei2.toLowerCase().includes(imeiSearchQuery.toLowerCase()))
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                          <p className="text-xs font-bold mb-1">No matching IMEIs found</p>
                          <p className="text-[10px]">
                            {availableImeis.length === 0 
                              ? "There are no available IMEIs for this product in inventory. Add stock using purchase or edit product info."
                              : "Try adjusting your search filter."}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 gap-2">
                        {filtered.map((imei) => {
                          const isChecked = selectedImeisForItem.some(item => item.id === imei.id);
                          return (
                            <label 
                              key={imei.id}
                              className={`flex items-center justify-between p-3 rounded-2xl border text-xs cursor-pointer transition-all duration-200 ${
                                isChecked 
                                  ? "bg-indigo-50/50 border-indigo-200 shadow-sm shadow-indigo-500/5" 
                                  : "bg-slate-50/30 border-slate-100 hover:bg-slate-50/80 hover:border-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedImeisForItem(selectedImeisForItem.filter(item => item.id !== imei.id));
                                    } else {
                                      setSelectedImeisForItem([...selectedImeisForItem, imei]);
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="font-mono">
                                  <div className="font-black text-slate-700 text-[11px]">IMEI 1: {imei.imei1}</div>
                                  {imei.imei2 && <div className="text-[10px] text-slate-550 font-semibold">IMEI 2: {imei.imei2}</div>}
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                isChecked 
                                  ? "bg-indigo-100 text-indigo-750"
                                  : "bg-emerald-100 text-emerald-755"
                              }`}>
                                {isChecked ? "Selected" : "Available"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-3 mt-3 shrink-0">
                <span className="font-bold text-slate-500">Selected: {selectedImeisForItem.length} device(s)</span>
              </div>

              <div className="flex gap-3 mt-3 shrink-0">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsImeiSelectModalOpen(false);
                    setImeiModalProduct(null);
                    setImeiSearchQuery("");
                  }}
                  className="flex-1 text-slate-655 font-bold h-10 rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmImeiSelection}
                  className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white font-extrabold h-10 rounded-xl text-xs shadow-md shadow-indigo-500/10"
                >
                  Confirm Selection
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Held Sales (Resume Bill) */}
      <AnimatePresence>
        {isHeldModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg border border-slate-200 relative shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <ShoppingCart size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Held / Suspended Sales</h3>
                    <p className="text-[10px] text-slate-400">Select a held transaction to resume checkout</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHeldModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2 custom-scrollbar min-h-[200px]">
                {heldCarts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                    <ShoppingCart className="h-10 w-10 text-slate-350 mb-2" />
                    <p className="text-xs font-bold mb-1">No held sales found</p>
                    <p className="text-[10px]">Suspended sales will appear here for you to resume later.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {heldCarts.map((held) => {
                      const totalItems = held.cart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
                      const cartTotal = held.cart.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
                      
                      return (
                        <div 
                          key={held.id} 
                          className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-slate-150 hover:bg-slate-50/80 transition-all duration-200 gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800 text-xs">{held.tag}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                                {totalItems} items
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-1">
                              Held: {new Date(held.created_at).toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                            <span className="text-xs font-black text-indigo-600 font-mono pr-1">
                              Rs {Math.round(cartTotal * 100) / 100}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm("Are you sure you want to discard this held sale?")) {
                                    saveHeldCarts(heldCarts.filter((c: any) => c.id !== held.id));
                                    toast.success("Held sale discarded.");
                                  }
                                }}
                                className="h-8.5 rounded-xl border-slate-200 text-rose-600 hover:bg-rose-50/50 hover:text-rose-700 text-[10px] font-black uppercase tracking-wider px-3"
                              >
                                <Trash2 size={11} />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleResumeCart(held)}
                                className="h-8.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider px-4 shadow-sm"
                              >
                                Resume
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100 shrink-0">
                <Button 
                  variant="outline" 
                  onClick={() => setIsHeldModalOpen(false)}
                  className="w-full text-slate-600 font-bold h-10 rounded-xl text-xs cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pharmacy Controlled Substance Audit Prompt Modal */}
      <AnimatePresence>
        {isControlledPromptOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xl border border-rose-200 relative shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-rose-100 pb-3.5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-rose-950 text-base flex items-center gap-2">
                      Controlled / Schedule G Dispensation Form
                      <span className="text-xs text-rose-700 font-bold font-nastaleeq">(شیڈول G نشہ آور ادویات کا فارم)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Legal DRAP & Drug Act requirement: Record prescription & buyer CNIC before finalizing sale.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsControlledPromptOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Detected Controlled Drugs in this Cart */}
              <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-3 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Pill size={13} className="text-rose-600" /> Detected Controlled Drugs (نشہ آور / شیڈول ادویات)
                  </span>
                  <span className="text-[10px] font-bold bg-rose-200/70 text-rose-800 px-2 py-0.5 rounded-full">
                    {cart.filter(item => isControlledDrug(item)).length} Item(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cart.filter(item => isControlledDrug(item)).map((item, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-1.5 bg-white border border-rose-300 text-rose-950 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-2xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                      {item.name}
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                        Qty: {item.quantity} {item.packingName || (item as any).unit || "Tab"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Form Body (2-columns) */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs">
                {/* 1. Doctor Information */}
                <div className="space-y-2.5 bg-slate-50/80 border border-slate-200 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs">
                    <Stethoscope size={15} className="text-indigo-600" />
                    <span>Prescribing Doctor Information (ڈاکٹر کی معلومات)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                        Doctor Name (ڈاکٹر کا نام) <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="e.g. Dr. Farooq Ahmed"
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                        className="h-9.5 rounded-xl bg-white border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                        Doctor PMDC No (پی ایم ڈی سی نمبر)
                      </label>
                      <Input
                        placeholder="e.g. PMDC-84912-P"
                        value={doctorPmdc}
                        onChange={(e) => setDoctorPmdc(e.target.value)}
                        className="h-9.5 rounded-xl bg-white border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                        Prescription Serial / Rx Ref No (نسخہ نمبر) <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="e.g. RX-2026-9812 / Jinnah Clinic"
                        value={prescriptionRef}
                        onChange={(e) => setPrescriptionRef(e.target.value)}
                        className="h-9.5 rounded-xl bg-white border-slate-200 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Patient Information */}
                <div className="space-y-2.5 bg-slate-50/80 border border-slate-200 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs">
                    <FileText size={15} className="text-blue-600" />
                    <span>Buyer / Patient Information (مریض / خریدار کی تفصیلات)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                        Patient Full Name (مریض کا نام)
                      </label>
                      <Input
                        placeholder="e.g. Muhammad Aslam"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className="h-9.5 rounded-xl bg-white border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                        Patient CNIC (شناختی کارڈ نمبر 13 ہندسے) <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        placeholder="e.g. 4210123456789"
                        value={customerCnic}
                        maxLength={13}
                        onChange={(e) => setCustomerCnic(e.target.value.replace(/\D/g, ""))}
                        className="h-9.5 rounded-xl bg-white border-slate-200 text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                        Patient Phone / Mobile (فون نمبر)
                      </label>
                      <Input
                        placeholder="e.g. 0300-1234567"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        className="h-9.5 rounded-xl bg-white border-slate-200 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                        Dosage / Directions (خوراک کی ہدایات)
                      </label>
                      <Input
                        placeholder="e.g. 1 Tab at bedtime for 10 days"
                        value={dosageInstructions}
                        onChange={(e) => setDosageInstructions(e.target.value)}
                        className="h-9.5 rounded-xl bg-white border-slate-200 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setIsControlledPromptOpen(false)}
                  className="flex-1 text-slate-600 font-bold h-11 rounded-2xl text-xs cursor-pointer"
                >
                  Cancel (کینسل)
                </Button>
                <Button
                  onClick={async () => {
                    const cleanCnic = customerCnic.replace(/\D/g, "");
                    if (cleanCnic.length !== 13) {
                      toast.error("13 ہندسوں پر مشتمل درست شناختی کارڈ (CNIC) درج کرنا لازمی ہے!", {
                        description: "Valid 13-digit Patient CNIC is mandatory for Schedule G Controlled Drugs."
                      });
                      return;
                    }
                    if (!doctorName.trim()) {
                      toast.error("ڈاکٹر کا نام درج کرنا لازمی ہے!", {
                        description: "Doctor Name is required."
                      });
                      return;
                    }
                    if (!prescriptionRef.trim()) {
                      toast.error("نسخہ نمبر (Prescription / Rx No) درج کرنا لازمی ہے!", {
                        description: "Prescription reference number is required."
                      });
                      return;
                    }

                    // Auto-record to Pharmacy Controlled Narcotics Register
                    try {
                      const controlledItems = cart.filter(item => isControlledDrug(item));
                      const logEntries = controlledItems.map(item => {
                        const batch = productBatches[item.productId]?.find(b => b.id === item.batchId) || 
                                      productBatches[item.productId]?.[0];
                        return {
                          id: `ctrl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                          shop_id: shopId,
                          prescription_date: new Date().toISOString().split("T")[0],
                          prescription_no: prescriptionRef.trim(),
                          doctor_name: doctorName.trim(),
                          doctor_pmdc: doctorPmdc.trim() || "N/A",
                          patient_name: patientName.trim() || "Walk-in Patient",
                          patient_cnic: cleanCnic,
                          patient_phone: patientPhone.trim() || undefined,
                          medicine_name: item.name,
                          batch_number: item.batchNumber || batch?.batch_number || "BATCH-REG",
                          expiry_date: item.expiryDate || batch?.expiry_date || undefined,
                          dispensed_qty: Number(item.quantity) || 1,
                          unit: item.packingName || "Tablets",
                          dosage_instruction: dosageInstructions.trim() || "As directed by physician",
                          pharmacist_name: "Counter Pharmacist",
                          notes: `POS Bill #${editingInvoiceId ? editingInvoiceId.slice(0, 8) : "SALE"}`,
                          created_at: new Date().toISOString()
                        };
                      });

                      // Save to Supabase table
                      supabase.from("pharmacy_controlled_logs").insert(logEntries).then((res: any) => {
                        if (res?.error) console.warn("Supabase controlled log insert (local cached):", res.error);
                      });

                      // Persist to localStorage cache
                      const storageKey = `pharmacy_controlled_logs_${shopId}`;
                      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
                      localStorage.setItem(storageKey, JSON.stringify([...logEntries, ...existing]));

                      toast.success("شیڈول G نشہ آور دوا کا اندراج رجسٹر میں کامیابی سے محفوظ ہو گیا!");
                    } catch (e) {
                      console.error("Controlled log error:", e);
                    }

                    setIsControlledPromptOpen(false);
                    // Trigger checkout again
                    setTimeout(() => handleCheckout(), 150);
                  }}
                  className="flex-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold h-11 rounded-2xl text-xs shadow-lg shadow-rose-600/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldAlert size={16} />
                  <span>Authorize, Log to Register & Settle Bill</span>
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pharmacy Substitute & Alternative Medicine Finder Modal */}
      <AnimatePresence>
        {isAltModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-slate-200 relative shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-2xl">
                    <span className="text-xl">🧪</span>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Pharmacy Substitute & Alternative Finder</h3>
                    <p className="text-xs text-slate-500 font-semibold">
                      {selectedAltFormulation 
                        ? `Showing substitute medicines for generic salt: "${selectedAltFormulation.name}"` 
                        : "Search by Generic Salt / Formula or Brand name"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAltModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Salt / Generic Search Input */}
              <div className="relative shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400" />
                <Input
                  placeholder="Type salt/formula or brand name (e.g. Paracetamol, Cefixime, Panadol)..."
                  value={altSearchQuery || (selectedAltFormulation ? selectedAltFormulation.name : "")}
                  onChange={(e) => {
                    setAltSearchQuery(e.target.value);
                    if (selectedAltFormulation && e.target.value.toLowerCase() !== selectedAltFormulation.name.toLowerCase()) {
                      setSelectedAltFormulation(null);
                    }
                  }}
                  className="pl-10 h-10 bg-purple-50/40 border-purple-200 text-slate-800 text-xs rounded-xl focus-visible:ring-purple-500/20 font-bold"
                  autoFocus
                />
              </div>

              {/* Alternative Products List */}
              <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {(() => {
                  const query = (altSearchQuery || (selectedAltFormulation ? selectedAltFormulation.name : "")).trim().toLowerCase();
                  const matches = products.filter(p => {
                    if (!query) return true;
                    const saltName = (p.formulations?.name || "").toLowerCase();
                    const prodName = (p.name || "").toLowerCase();
                    return saltName.includes(query) || prodName.includes(query);
                  });

                  if (matches.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 text-xs font-bold space-y-2">
                        <p className="text-2xl">🔍</p>
                        <p>No alternative medicines found for "{query}".</p>
                        <p className="text-[11px] text-slate-400 font-normal">Ensure generic salts are assigned in Product Management.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 gap-2">
                      {matches.map((prod, mIdx) => {
                        const inStock = prod.current_stock > 0;
                        return (
                          <div
                            key={`${prod.id}-${mIdx}`}
                            className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                              inStock 
                                ? "bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/20 shadow-2xs" 
                                : "bg-slate-50 border-slate-200 opacity-60"
                            }`}
                          >
                            <div className="space-y-1 min-w-0 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-slate-900 truncate">{prod.name}</span>
                                {prod.formulations?.name && (
                                  <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 shrink-0">
                                    🧪 {prod.formulations.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-semibold">
                                <span className={inStock ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                  {inStock ? `✓ In Stock: ${prod.current_stock} ${prod.unit || "unit"}` : "❌ Out of Stock"}
                                </span>
                                {prod.code && <span>Code: {prod.code}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs font-black text-slate-900 font-mono">Rs {prod.sale_price_single}</div>
                                <div className="text-[9px] text-slate-400 font-medium">Per {prod.unit || "Base"}</div>
                              </div>
                              <Button
                                size="sm"
                                disabled={!allowNegativeStock && !inStock}
                                onClick={() => {
                                  handleAddProductToCart(prod);
                                  toast.success(`Added substitute ${prod.name} to cart!`);
                                }}
                                className={`h-8 rounded-xl font-bold text-xs px-3 shadow-xs cursor-pointer ${
                                  inStock 
                                    ? "bg-purple-600 hover:bg-purple-700 text-white" 
                                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                                }`}
                              >
                                <Plus size={14} className="mr-1" /> Add
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setIsAltModalOpen(false)}
                  className="text-xs font-bold rounded-xl h-9 px-4 cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BarcodeScannerModal 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(decodedText) => {
          handleGlobalBarcodeScan(decodedText);
        }}
      />

      {/* POS Batch & Expiry Selector Modal */}
      {batchModalItemIndex !== null && cart[batchModalItemIndex] && (() => {
        const item = cart[batchModalItemIndex];
        const prod = products.find(p => p.id === item.productId);
        return (
          <BatchSelectorModal
            isOpen={true}
            onClose={() => setBatchModalItemIndex(null)}
            productName={item.name}
            productId={item.productId}
            shopId={shopId || undefined}
            packSize={prod?.pack_size}
            unit={prod?.unit}
            packingName={item.packingName}
            totalStock={prod?.current_stock}
            currentBatchNumber={item.batchNumber || null}
            currentExpiryDate={item.expiryDate || null}
            availableBatches={
              (item.availableBatches && item.availableBatches.length > 0)
                ? item.availableBatches
                : (productBatches[item.productId] || [])
            }
            onSelectBatch={(batchNumber, expiryDate, batchId) => {
              setCart(prev => {
                const updated = [...prev];
                if (updated[batchModalItemIndex]) {
                  updated[batchModalItemIndex] = {
                    ...updated[batchModalItemIndex],
                    batchNumber,
                    expiryDate,
                    batchId: batchId || null,
                  };
                }
                return updated;
              });
              toast.info(`Switched to Batch ${batchNumber || "FEFO"} (Exp: ${expiryDate || "N/A"})`);
              setBatchModalItemIndex(null);
            }}
          />
        );
      })()}

      {/* Pharmacy 1-Click Generic Salt & Alternate Medicine Modal */}
      {industryType === "pharmacy" && (
        <GenericAlternateModal
          isOpen={isAlternateModalOpen}
          onClose={() => {
            setIsAlternateModalOpen(false);
            setAlternateTargetProduct(null);
            setAlternateTargetCartIndex(null);
          }}
          selectedProduct={alternateTargetProduct}
          allProducts={products}
          productBatches={productBatches}
          targetCartIndex={alternateTargetCartIndex}
          onSelectAlternate={(prod) => {
            handleAddProductToCart(prod);
          }}
          onReplaceCartItem={(targetIdx, newProd) => {
            handleReplaceCartItem(targetIdx, newProd);
          }}
        />
      )}

      {/* Quick Add Product Modal from POS */}
      <QuickAddProductModal
        isOpen={isQuickAddProductOpen}
        onClose={() => setIsQuickAddProductOpen(false)}
        shopId={shopId || ""}
        categories={categories}
        initialName={quickAddInitialName}
        isPharmacy={industryType === "pharmacy"}
        onProductCreated={(newProd) => {
          setProducts(prev => [newProd, ...prev]);
          const effectiveBNum = (newProd as any).batchNumber || "BATCH-01";
          setProductBatches(prev => ({
            ...prev,
            [newProd.id]: [{
              id: `quick-${newProd.id}`,
              product_id: newProd.id,
              batch_number: effectiveBNum,
              expiry_date: (newProd as any).expiryDate || null,
              stock_quantity: Number(newProd.current_stock) || 0,
              sale_price: newProd.sale_price_single,
              purchase_price: newProd.purchase_price_single,
            }]
          }));
          handleAddBaseUnitDirectly(newProd);
        }}
      />

      {/* Quick Short Book Demand Recording Modal */}
      {industryType === "pharmacy" && (
        <QuickShortBookModal
          isOpen={isQuickShortBookOpen}
          onClose={() => setIsQuickShortBookOpen(false)}
          shopId={shopId || ""}
          initialMedicineName={quickShortBookInitialName}
          initialCustomerName={selectedCustomerId !== "walkin" ? customers.find(c => c.id === selectedCustomerId)?.name : ""}
          initialCustomerPhone={selectedCustomerId !== "walkin" ? customers.find(c => c.id === selectedCustomerId)?.phone || "" : ""}
        />
      )}

      {/* One-Time / Arranged Item Sale Modal */}
      <OneTimeItemModal
        isOpen={isOneTimeItemModalOpen}
        onClose={() => setIsOneTimeItemModalOpen(false)}
        initialQuery={searchQuery}
        onAddToCart={(customItem) => {
          setCart(prev => [
            ...prev,
            {
              productId: customItem.productId,
              name: customItem.name,
              price: customItem.price,
              purchasePrice: customItem.purchasePrice,
              quantity: customItem.quantity,
              stock: 9999,
              isCustomItem: true,
              warranty: customItem.warranty,
              note: customItem.note,
            }
          ]);
        }}
      />

      {/* Mobile Phone Exchange / Trade-In Modal */}
      <TradeInModal
        isOpen={isTradeInModalOpen}
        onClose={() => setIsTradeInModalOpen(false)}
        onApplyTradeIn={(item) => setTradeInItem(item)}
        currentTradeIn={tradeInItem}
        onRemoveTradeIn={() => setTradeInItem(null)}
      />
    </div>
  );
}

export default function POSPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-sm font-bold text-slate-300">Loading POS Terminal...</p>
          </div>
        </div>
      }
    >
      <POSPageContent />
    </Suspense>
  );
}

