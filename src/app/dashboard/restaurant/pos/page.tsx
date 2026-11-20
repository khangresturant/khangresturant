"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, ShoppingCart, UserPlus, Trash2, Plus, Minus, 
  Check, X, Printer, Loader2, DollarSign, ArrowRight, ArrowLeft,
  Store, Utensils, Coffee, Users, Layers, MessageSquare, ChefHat, Menu,
  ClipboardList, Receipt, Bell, Tag, RefreshCw
} from "lucide-react";
import { RestaurantDealsTab } from "@/components/restaurant/RestaurantDealsTab";
import { DealConfigureModal } from "@/components/restaurant/DealConfigureModal";
import type { RestaurantDeal } from "@/lib/restaurant-deals";
import { SettleOrderDialog, type SettleOrderData } from "@/components/restaurant/SettleOrderDialog";
import { RestaurantPosPrinterStrip } from "@/components/restaurant/RestaurantPosPrinterStrip";
import { WaiterNotificationsDialog, useWaiterNotificationCount } from "@/components/restaurant/WaiterNotificationsDialog";
import type { MenuSize } from "@/lib/restaurant-deals";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { ReceiptTemplate, DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import {
  companyRowToShopDetails,
  mergeRestaurantPrintProfile,
} from "@/lib/restaurant-print-profile";
import { filterRiderStaff, riderLabel, staffPhone } from "@/lib/restaurant-riders";
import {
  printRestaurantGuestBill,
  printRestaurantKOTDispatch,
  mapDbInvoiceItemsToReceiptLines,
  type RestaurantReceiptLine,
} from "@/lib/restaurant-receipt-print";
import { printReceiptDirect } from "@/lib/thermalPrinter";
import {
  type RestaurantOrderStatus,
  RESTAURANT_ORDER_STATUS_LABELS,
  canPrintGuestBill,
  canSettleOrder,
  requiresBillingDeskForItemEdits,
  markBillPrinted,
  generateDailyOrderNumber,
  normalizeOrderStatus,
  applyRestaurantOrderCostAndStock,
  invoiceLinesForCost,
} from "@/lib/restaurant-orders";
import { fetchRestaurantModifiers } from "@/lib/restaurant-modifiers";
import {
  CRUST_OPTIONS,
  fetchStations,
  parseCrustOptions,
  saveOfflineTakeawayDraft,
  loadOfflineTakeawayQueue,
  clearOfflineTakeawayDraft,
  type RestaurantStation,
} from "@/lib/restaurant-ops";
import { dispatchKitchenTicket } from "@/lib/restaurant-kitchen";
import {
  shouldAutoAppendBillVersion,
  persistRestaurantDraftBillEdit,
  type RestaurantBillEditPersistLine,
} from "@/lib/restaurant-bill-edit";
import {
  computeCartIngredientCost,
  computeInvoiceIngredientCost,
  restoreStockForInvoiceLines,
  roundMoney,
  type RestaurantCartCostLine,
} from "@/lib/restaurant-recipe-cost";
import { dealCostLinesFromInvoiceMeta } from "@/lib/restaurant-deal-invoice-lines";
import {
  buildDealReceiptIncludes,
  invoiceItemDisplayName,
  parseDealStockMeta,
  restaurantReceiptItemLabels,
} from "@/lib/restaurant-deal-slots";
import {
  cartDiscountableSubtotal,
  computeRestaurantOrderDiscount,
} from "@/lib/restaurant-discount";
import {
  buildCustomizedLineName,
  buildKitchenRemarks,
  resolveDefaultVariation,
  variationOptionsForPos,
  unitSalePriceForVariation,
  type CartAddOnLine,
} from "@/lib/restaurant-pos-customize";
import { Flame9PosHeaderBrand } from "@/components/branding/Flame9PosHeaderBrand";
import { isFlame9Brand } from "@/lib/deployment/flame9-brand";
import { parseScaleBarcode } from "@/lib/pos/scaleBarcodeParser";

type RestTable = {
  id: string;
  name: string;
  capacity: number;
  status: "available" | "occupied" | "cleaning";
  floor_name?: string | null;
  section_name?: string | null;
  active_invoice_id?: string | null;
};

type DBProduct = {
  id: string;
  name: string;
  unit: string | null;
  sale_price_single: number;
  purchase_price_single: number;
  current_stock: number;
  category_id?: string | null;
  kitchen_station_id?: string | null;
  sell_by_weight?: boolean;
  is_ingredient?: boolean;
  not_discounted?: boolean;
  show_in_restaurant_pos?: boolean;
};

type Party = {
  id: string;
  name: string;
  phone: string | null;
  current_balance?: number;
};

type Category = {
  id: string;
  name: string;
};

type CartItem = {
  cartItemId: string; // Unique cart item identifier
  productId: string;
  name: string;
  price: number;
  purchasePrice: number;
  quantity: number;
  remarks: string; // Waiter's chef remarks
  sizeLabel?: string;
  menuSizeId?: string | null;
  crust?: string;
  addOns?: CartAddOnLine[];
  notDiscounted?: boolean;
  isDeal?: boolean;
  dealId?: string;
  /** Persisted on invoice_items.packing_name for settle stock expansion. */
  dealMeta?: string;
  /** Per-slot COGS for combo deals (recipe + size). */
  dealCostLines?: import("@/lib/restaurant-recipe-cost").RestaurantCartCostLine[];
};

export default function RestaurantPOSPage() {
  const { shopId, userId, userName, shopName, shopLogo, activeClosingBook, defaultTaxRate, defaultTaxType } =
    useShop();
  const { t, language } = useLanguage();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const reservationDeepLinkRef = useRef(false);
  const resumeDeepLinkRef = useRef<string | null>(null);
  const [resumeInvoiceId, setResumeInvoiceId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [tables, setTables] = useState<RestTable[]>([]);
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<any>(DEFAULT_RECEIPT_SETTINGS);
  const [companyDetails, setCompanyDetails] = useState<any>(null);

  // Active View States
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedTable, setSelectedTable] = useState<RestTable | null>(null);
  const [posMode, setPosMode] = useState<"dining" | "takeaway" | "delivery">("dining");
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>("");
  const [selectedRiderId, setSelectedRiderId] = useState<string>("");

  // Customization popup states
  const [customizingProduct, setCustomizingProduct] = useState<DBProduct | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<{ name: string; priceAdd: number }>({ name: "Medium", priceAdd: 0 });
  const [selectedAddOns, setSelectedAddOns] = useState<{ name: string; priceAdd: number }[]>([]);
  const [selectedCrust, setSelectedCrust] = useState<string>("Regular");
  const [weightKg, setWeightKg] = useState<number>(1);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [tipAmount, setTipAmount] = useState(0);
  const [floorFilter, setFloorFilter] = useState("all");
  const [stations, setStations] = useState<RestaurantStation[]>([]);
  const [kdsStationPref, setKdsStationPref] = useState<string>("");
  const [splitMode, setSplitMode] = useState<"equal" | "items">("equal");
  const [splitItemIds, setSplitItemIds] = useState<string[]>([]);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Cart & Ordering States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [dbItems, setDbItems] = useState<CartItem[]>([]); // Copy of items stored in active draft invoice
  const [dealTitleById, setDealTitleById] = useState<Record<string, string>>({});
  const [cartEpoch, setCartEpoch] = useState(0);
  const CART_PANEL_MIN_W = 300;
  const CART_PANEL_MAX_W = 580;
  const CART_PANEL_DEFAULT_W = 380;
  const [cartPanelWidth, setCartPanelWidth] = useState(CART_PANEL_DEFAULT_W);
  const [cartPanelResizing, setCartPanelResizing] = useState(false);
  const cartPanelWidthRef = useRef(CART_PANEL_DEFAULT_W);
  const [cartPanelDesktop, setCartPanelDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setCartPanelDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("restaurant_pos_cart_panel_width");
    if (saved) {
      const w = parseInt(saved, 10);
      if (!Number.isNaN(w) && w >= CART_PANEL_MIN_W && w <= CART_PANEL_MAX_W) {
        setCartPanelWidth(w);
        cartPanelWidthRef.current = w;
      }
    }
  }, []);

  useEffect(() => {
    if (!cartPanelResizing) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.min(
        CART_PANEL_MAX_W,
        Math.max(CART_PANEL_MIN_W, window.innerWidth - e.clientX)
      );
      cartPanelWidthRef.current = w;
      setCartPanelWidth(w);
    };
    const onUp = () => {
      setCartPanelResizing(false);
      localStorage.setItem(
        "restaurant_pos_cart_panel_width",
        String(cartPanelWidthRef.current)
      );
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [cartPanelResizing]);

  const startCartPanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCartPanelResizing(true);
  };

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
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
  const [isSubmittingKOT, setIsSubmittingKOT] = useState(false);
  const [takeawayInvoiceId, setTakeawayInvoiceId] = useState<string | null>(null);
  const [currentOrderStatus, setCurrentOrderStatus] = useState<RestaurantOrderStatus | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [orderSpecialInstructions, setOrderSpecialInstructions] = useState("");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [printKitchenReceipt, setPrintKitchenReceipt] = useState(true);

  const productCategoryById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.id && p.category_id) map.set(p.id, p.category_id);
    }
    return map;
  }, [products]);

  const simpleKotCategoryLabels = useMemo(() => {
    const ids = receiptSettings?.restaurantSimpleKotCategoryIds || [];
    if (!ids.length) return [];
    return ids
      .map((id: string) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean) as string[];
  }, [receiptSettings?.restaurantSimpleKotCategoryIds, categories]);

  useEffect(() => {
    if (receiptSettings.restaurantPrintKitchenOnKot === false) {
      setPrintKitchenReceipt(false);
    }
  }, [receiptSettings.restaurantPrintKitchenOnKot]);
  const [leftPosTab, setLeftPosTab] = useState<"menu" | "deals" | "history">("menu");
  const [dealToConfigure, setDealToConfigure] = useState<RestaurantDeal | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loadingRecentOrders, setLoadingRecentOrders] = useState(false);
  const [productSizes, setProductSizes] = useState<MenuSize[]>([]);
  const [menuModifiers, setMenuModifiers] = useState<{ name: string; priceAdd: number }[]>([]);
  const [waiterDialogOpen, setWaiterDialogOpen] = useState(false);
  const waiterBadgeCount = useWaiterNotificationCount();

  // Cash Accounts and Split Bill states
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Helper to validate and sanitize cash_accounts ID to prevent invoices_account_id_fkey constraint violations
  const getValidAccountId = (id: string | null | undefined, accList: any[]) => {
    if (!id || typeof id !== "string") return null;
    const exists = accList.some((a: any) => a.id === id);
    if (exists) return id;
    const cashAcc = accList.find((a: any) => a.name?.toLowerCase() === "cash in hand");
    if (cashAcc) return cashAcc.id;
    if (accList.length > 0) return accList[0].id;
    return null;
  };

  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [isProcessingSplit, setIsProcessingSplit] = useState(false);

  // Settlement on POS only after KOT + Print Bill (see openSettleOrderModal)

  // Print Receipt State
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isPrintingKOT, setIsPrintingKOT] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const lineGroupKey = (item: CartItem) =>
    `${item.productId}:${item.price}:${item.menuSizeId || ""}:${item.sizeLabel || ""}`;

  const mergeCartWithBaseline = (baseline: CartItem[], staging: CartItem[]): CartItem[] => {
    if (!staging.length) return baseline;
    if (!baseline.length) return staging;
    const map = new Map<string, CartItem>();
    for (const b of baseline) {
      map.set(lineGroupKey(b), JSON.parse(JSON.stringify(b)) as CartItem);
    }
    for (const c of staging) {
      const k = lineGroupKey(c);
      const ex = map.get(k);
      if (ex) {
        map.set(k, { ...ex, quantity: ex.quantity + c.quantity, cartItemId: c.cartItemId });
      } else {
        map.set(k, { ...c });
      }
    }
    return [...map.values()];
  };

  /** Orders / resumeInvoice edit: cart holds the full bill; dbItems is KOT baseline only (do not sum both). */
  const openBillCartEdit = Boolean(resumeInvoiceId) && cart.length > 0;

  const billingCart = React.useMemo(
    () => (openBillCartEdit ? cart : mergeCartWithBaseline(dbItems, cart)),
    [openBillCartEdit, dbItems, cart]
  );

  // Calculations - bill = already on KOT (baseline) + new cart lines (do not merge qty for display)
  const baselineSubtotal = dbItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const stagingSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartSubtotal = roundMoney(
    openBillCartEdit ? stagingSubtotal : baselineSubtotal + stagingSubtotal
  );
  const baselineDishCount = dbItems.reduce((s, i) => s + i.quantity, 0);
  const stagingDishCount = cart.reduce((s, i) => s + i.quantity, 0);
  const discountableSubtotal = cartDiscountableSubtotal(
    billingCart.map((item) => ({
      unitPrice: item.price,
      quantity: item.quantity,
      notDiscounted: item.notDiscounted,
    }))
  );
  const effectiveDiscount = computeRestaurantOrderDiscount(
    discountableSubtotal,
    discount,
    discountPercent
  );
  const taxAmount = taxType === "flat" ? taxRate : (cartSubtotal * taxRate) / 100;
  const netTotal = Math.max(
    0,
    cartSubtotal + taxAmount - effectiveDiscount + deliveryFee + additionalCharges + tipAmount
  );

  /** Staging cart empty but items already on KOT - footer shows Rs 0 until next add. */
  const awaitingNextKot = cart.length === 0 && dbItems.length > 0;
  const displayCartSubtotal = awaitingNextKot ? stagingSubtotal : cartSubtotal;
  const displayTaxAmount = awaitingNextKot
    ? taxType === "flat"
      ? 0
      : (stagingSubtotal * taxRate) / 100
    : taxAmount;
  const displayEffectiveDiscount = awaitingNextKot
    ? 0
    : effectiveDiscount;
  const displayNetTotal = awaitingNextKot
    ? Math.max(
        0,
        stagingSubtotal +
          displayTaxAmount -
          displayEffectiveDiscount +
          (posMode === "delivery" ? deliveryFee : 0) +
          additionalCharges +
          tipAmount
      )
    : netTotal;

  const cartItemsToCostLines = (items: CartItem[]): RestaurantCartCostLine[] => {
    const lines: RestaurantCartCostLine[] = [];
    for (const c of items) {
      if (c.isDeal && c.dealCostLines?.length) {
        lines.push(...c.dealCostLines);
      } else {
        lines.push({
          productId: c.productId,
          quantity: c.quantity,
          menuSizeId: c.menuSizeId,
          menuSizeName: c.sizeLabel,
        });
      }
    }
    return lines;
  };

  const stagingCostLines = React.useMemo(() => cartItemsToCostLines(cart), [cart]);
  const baselineCostLines = React.useMemo(() => cartItemsToCostLines(dbItems), [dbItems]);
  const showSplitCogs = !openBillCartEdit && cart.length > 0 && dbItems.length > 0;

  const [stagingCogs, setStagingCogs] = useState(0);
  const [baselineCogs, setBaselineCogs] = useState(0);

  useEffect(() => {
    if (!shopId || stagingCostLines.length === 0) {
      setStagingCogs(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const cost = await computeCartIngredientCost(supabase, stagingCostLines);
      if (!cancelled) setStagingCogs(roundMoney(cost));
    })();
    return () => {
      cancelled = true;
    };
  }, [stagingCostLines, shopId, supabase]);

  useEffect(() => {
    if (!shopId || baselineCostLines.length === 0) {
      setBaselineCogs(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const cost = await computeCartIngredientCost(supabase, baselineCostLines);
      if (!cancelled) setBaselineCogs(roundMoney(cost));
    })();
    return () => {
      cancelled = true;
    };
  }, [baselineCostLines, shopId, supabase]);

  useEffect(() => {
    if (!shopId) return;
    const needsHydrate = dbItems.some(
      (it) => Boolean(it.dealMeta) && !(it.dealCostLines?.length)
    );
    if (!needsHydrate) return;
    let cancelled = false;
    (async () => {
      const updated = await Promise.all(
        dbItems.map(async (it) => {
          if (!it.dealMeta || it.dealCostLines?.length) return it;
          const dealCostLines = await dealCostLinesFromInvoiceMeta(supabase, it.dealMeta);
          if (!dealCostLines.length) return it;
          return { ...it, isDeal: true, dealCostLines };
        })
      );
      if (cancelled) return;
      const changed = updated.some((row, i) => row !== dbItems[i]);
      if (changed) setDbItems(updated);
    })();
    return () => {
      cancelled = true;
    };
  }, [dbItems, shopId, supabase]);

  useEffect(() => {
    if (!shopId) return;
    const ids = new Set<string>();
    [...dbItems, ...cart].forEach((it) => {
      if (!it.dealMeta) return;
      const meta = parseDealStockMeta(it.dealMeta);
      if (meta?.dealId && !meta.dealName) ids.add(meta.dealId);
    });
    if (!ids.size) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("restaurant_deals")
        .select("id, name")
        .eq("shop_id", shopId)
        .in("id", [...ids]);
      if (cancelled || !data?.length) return;
      const map: Record<string, string> = {};
      data.forEach((d: any) => {
        map[d.id] = String(d.name || "").trim();
      });
      setDealTitleById((prev) => ({ ...prev, ...map }));
      const refresh = (items: CartItem[]) =>
        items.map((it) => {
          if (!it.dealMeta || !it.isDeal) return it;
          const labels = restaurantReceiptItemLabels(
            "",
            it.dealMeta,
            it.name.replace(/^\s*🎯\s*/, ""),
            map
          );
          const next = `🎯 ${labels.title}`;
          return it.name === next ? it : { ...it, name: next };
        });
      setDbItems((prev) => refresh(prev));
      setCart((prev) => refresh(prev));
    })();
    return () => {
      cancelled = true;
    };
  }, [dbItems, cart, shopId, supabase]);

  const estimatedIngredientCost = openBillCartEdit
    ? stagingCogs
    : showSplitCogs
      ? roundMoney(stagingCogs + baselineCogs)
      : awaitingNextKot
        ? 0
        : cart.length > 0
          ? stagingCogs
          : baselineCogs;

  const displayEstimatedProfit = roundMoney(
    Math.max(0, (awaitingNextKot ? displayNetTotal : netTotal) - estimatedIngredientCost)
  );

  const activeOrderInvoiceId =
    resumeInvoiceId ??
    (posMode === "dining" ? selectedTable?.active_invoice_id ?? null : takeawayInvoiceId);
  const orderFlowSettleReady =
    Boolean(activeOrderInvoiceId) && canSettleOrder(currentOrderStatus);

  const cartToEditLines = (items: CartItem[]): RestaurantBillEditPersistLine[] =>
    items.map((c) => {
      const baseName = c.name.includes(" (") ? c.name.split(" (")[0]! : c.name;
      return {
        product_id: c.productId,
        quantity: c.quantity,
        unit_price: c.price,
        subtotal: c.price * c.quantity,
        packing_name: c.dealMeta || c.sizeLabel || null,
        menu_size_id: c.menuSizeId || null,
        products: { name: baseName, purchase_price_single: c.purchasePrice },
      };
    });

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      // Parallelize all 8 database fetches for Restaurant POS
      const [
        tablesRes,
        productsRes,
        categoriesRes,
        customersRes,
        accountsRes,
        printRes,
        companyRes,
        staffRes
      ] = await Promise.all([
        // 1. Tables
        supabase
          .from("restaurant_tables")
          .select("id, name, capacity, status, active_invoice_id, floor_name, section_name")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),

        // 2. Products (no kitchen_station_id - column may be missing until P1 SQL)
        supabase
          .from("products")
          .select("id, name, unit, sale_price_single, purchase_price_single, current_stock, category_id, is_ingredient, kitchen_station_id, not_discounted, show_in_restaurant_pos")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),

        // 3. Categories
        supabase
          .from("categories")
          .select("id, name")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),

        // 4. Customers
        supabase
          .from("parties")
          .select("id, name, phone, current_balance")
          .eq("shop_id", shopId)
          .eq("type", "customer")
          .order("name", { ascending: true }),

        // 5. Cash Accounts
        supabase
          .from("cash_accounts")
          .select("id, name, current_balance")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),

        // 6. Print Settings
        supabase
          .from("print_settings")
          .select("*")
          .eq("shop_id", shopId)
          .maybeSingle(),

        // 7. Company Details
        supabase
          .from("company_details")
          .select("*")
          .eq("shop_id", shopId)
          .maybeSingle(),

        // 8. Staff Profiles
        supabase
          .from("user_profiles")
          .select("id, name, role, phone, permissions")
          .eq("shop_id", shopId)
          .order("name", { ascending: true })
      ]);

      const modifiers = await fetchRestaurantModifiers(supabase, shopId || "");
      setMenuModifiers(modifiers);
      const st = await fetchStations(supabase, shopId || "");
      setStations(st);
      if (shopId) setOfflineQueueCount(loadOfflineTakeawayQueue(shopId).length);

      // Flush offline takeaway drafts when back online
      if (typeof navigator !== "undefined" && navigator.onLine && shopId) {
        const queued = loadOfflineTakeawayQueue(shopId);
        if (queued.length > 0) {
          toast.message(`${queued.length} offline takeaway draft(s) ready - open cart and process when staffed`);
        }
      }

      // --- Process Tables ---
      if (tablesRes.error) {
        // floor columns may be missing pre-migration
        if (tablesRes.error.message?.includes("floor_name")) {
          const fallback = await supabase
            .from("restaurant_tables")
            .select("id, name, capacity, status, active_invoice_id")
            .eq("shop_id", shopId)
            .order("name", { ascending: true });
          if (fallback.error) throw fallback.error;
          setTables(fallback.data || []);
        } else {
          throw tablesRes.error;
        }
      } else {
        setTables(tablesRes.data || []);
      }

      // --- Process Products with fallback ---
      let productsData = productsRes.data;
      if (productsRes.error) {
        const msg = productsRes.error.message || "";
        if (msg.includes("not_discounted") || msg.includes("show_in_restaurant")) {
          const fallback = await supabase
            .from("products")
            .select("id, name, unit, sale_price_single, purchase_price_single, current_stock, category_id, is_ingredient, kitchen_station_id")
            .eq("shop_id", shopId)
            .order("name", { ascending: true });
          if (fallback.error) throw fallback.error;
          productsData = (fallback.data || []).map((p: any) => ({
            ...p,
            not_discounted: false,
            show_in_restaurant_pos: true,
          }));
        } else if (msg.includes("is_ingredient") || productsRes.error.hint?.includes("is_ingredient")) {
          const fallback = await supabase
            .from("products")
            .select("id, name, unit, sale_price_single, purchase_price_single, current_stock, category_id")
            .eq("shop_id", shopId)
            .order("name", { ascending: true });
          if (fallback.error) throw fallback.error;
          productsData = (fallback.data || []).map((p: any) => ({ ...p, is_ingredient: false }));
        } else {
          throw productsRes.error;
        }
      }
      setProducts(
        (productsData || []).filter(
          (p: any) =>
            p.is_ingredient !== true &&
            String(p.is_ingredient) !== "true" &&
            p.show_in_restaurant_pos !== false
        )
      );

      // --- Process Categories ---
      if (categoriesRes.error) throw categoriesRes.error;
      setCategories(categoriesRes.data || []);

      // --- Process Customers ---
      if (customersRes.error) throw customersRes.error;
      setCustomers(customersRes.data || []);

      // --- Process Cash Accounts ---
      if (accountsRes.error) throw accountsRes.error;
      const accData = accountsRes.data || [];
      setCashAccounts(accData);
      if (accData.length > 0) {
        const cashInHand = accData.find((a: any) => a.name.toLowerCase() === "cash in hand");
        setSelectedAccountId(cashInHand ? cashInHand.id : accData[0].id);
      }

      // --- Process Print Settings + company printers (POSRESTURANT: KOT vs customer) ---
      if (!printRes.error && printRes.data) {
        setReceiptSettings(
          mergeRestaurantPrintProfile(
            companyRes.data as Record<string, unknown> | null,
            printRes.data as Record<string, unknown>
          )
        );
      } else if (!companyRes.error && companyRes.data) {
        setReceiptSettings(
          mergeRestaurantPrintProfile(companyRes.data as Record<string, unknown>, null)
        );
      }

      // --- Process Company Details ---
      if (!companyRes.error && companyRes.data) {
        setCompanyDetails(companyRes.data);
      }

      // --- Process Staff Profiles ---
      if (staffRes.error) throw staffRes.error;
      setStaff(staffRes.data || []);

    } catch (err: any) {
      console.error("POS loadData:", err);
      toast.error("Failed to load POS details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!shopId) return;
    loadData();
    const tablesChannel = supabase
      .channel("pos_restaurant_tables_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_tables", filter: `shop_id=eq.${shopId}` },
        () => {
          // Re-fetch tables list in background
          supabase
            .from("restaurant_tables")
            .select("id, name, capacity, status, active_invoice_id")
            .eq("shop_id", shopId)
            .order("name", { ascending: true })
            .then(({ data }: any) => {
              if (data) setTables(data);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
    };
  }, [shopId]);

  const mapInvoiceItemsToCart = React.useCallback(
    (
      invoiceItems: any[] | null | undefined,
      dealNames: Record<string, string> = dealTitleById
    ): CartItem[] =>
      (invoiceItems || []).map((it: any, index: number) => {
        const prodMatch = it.product_id ? products.find((p) => p.id === it.product_id) : undefined;
        const baseName =
          (it.products?.name && it.products.name !== "Item"
            ? it.products.name
            : prodMatch?.name) ||
          it.products?.name ||
          "Unknown Item";
        const purchasePrice = Number(
          it.products?.purchase_price_single ?? prodMatch?.purchase_price_single ?? 0
        );
        const notDiscounted = Boolean(prodMatch?.not_discounted);
        const dealMeta =
          typeof it.packing_name === "string" && it.packing_name.includes("DEAL_ID:")
            ? it.packing_name
            : undefined;
        if (dealMeta) {
          const labels = restaurantReceiptItemLabels(
            baseName,
            dealMeta,
            it.custom_name,
            dealNames
          );
          const includes = buildDealReceiptIncludes(dealMeta);
          return {
            cartItemId: it.id || `${it.product_id || "item"}-${index}`,
            productId: it.product_id,
            name: `🎯 ${labels.title}`,
            price: Number(it.unit_price),
            purchasePrice,
            quantity: Number(it.quantity),
            remarks: includes || "",
            sizeLabel: undefined,
            menuSizeId: it.menu_size_id || undefined,
            isDeal: true,
            dealMeta,
            notDiscounted,
          };
        }
        const displayName = it.packing_name
          ? `${baseName} (${it.packing_name})`
          : baseName;
        return {
          cartItemId: it.id || `${it.product_id || "item"}-${index}`,
          productId: it.product_id,
          name: displayName,
          price: Number(it.unit_price),
          purchasePrice,
          quantity: Number(it.quantity),
          remarks: "",
          sizeLabel: it.packing_name || undefined,
          menuSizeId: it.menu_size_id || undefined,
          isDeal: false,
          dealMeta: undefined,
          notDiscounted,
        };
      }),
    [dealTitleById, products]
  );

  const cartDiffersFromBaseline = (live: CartItem[], baseline: CartItem[]) => {
    if (live.length !== baseline.length) return true;
    const keys = new Set([...live, ...baseline].map(lineGroupKey));
    for (const key of keys) {
      const qty = (rows: CartItem[]) =>
        rows.filter((i) => lineGroupKey(i) === key).reduce((s, i) => s + i.quantity, 0);
      if (qty(live) !== qty(baseline)) return true;
    }
    return false;
  };

  const commitCartBaseline = (source?: CartItem[]) => {
    const snapSource = source ?? cart;
    const snapshot = JSON.parse(JSON.stringify(snapSource)) as CartItem[];
    setDbItems(snapshot);
    setCartEpoch((n) => n + 1);
  };

  /** Full bill in staging cart (e.g. resume edit) — never duplicate into dbItems. */
  const applyCartFromInvoiceRows = (
    invoiceItems: any[] | null | undefined,
    meta?: { restaurant_order_status?: string | null; order_number?: string | null }
  ) => {
    const loadedCart = mapInvoiceItemsToCart(invoiceItems);
    setCart(loadedCart);
    setDbItems([]);
    if (meta?.restaurant_order_status) {
      setCurrentOrderStatus(normalizeOrderStatus(meta.restaurant_order_status) || "pending");
    }
    if (meta?.order_number) setOrderNumber(meta.order_number);
    setCartEpoch((n) => n + 1);
  };

  /** KOT baseline only (invoice already sent) - keeps cart empty, avoids duplicate KOT qty. */
  const applyBaselineFromInvoiceRows = (
    invoiceItems: any[] | null | undefined,
    meta?: { restaurant_order_status?: string | null; order_number?: string | null }
  ) => {
    const loadedCart = mapInvoiceItemsToCart(invoiceItems);
    const snapshot = JSON.parse(JSON.stringify(loadedCart)) as CartItem[];
    setCart([]);
    setDbItems(snapshot);
    if (meta?.restaurant_order_status) {
      setCurrentOrderStatus(normalizeOrderStatus(meta.restaurant_order_status) || "pending");
    }
    if (meta?.order_number) setOrderNumber(meta.order_number);
    setCartEpoch((n) => n + 1);
  };

  const fetchInvoiceCartSnapshot = async (
    invoiceId: string
  ): Promise<{
    items: any[] | null;
    meta?: { restaurant_order_status?: string | null; order_number?: string | null };
  } | null> => {
    try {
      const { data: invData, error } = await supabase
        .from("invoices")
        .select(
          `
          restaurant_order_status,
          order_number,
          invoice_items (
            id,
            product_id,
            quantity,
            unit_price,
            packing_name,
            menu_size_id,
            products ( name, purchase_price_single )
          )
        `
        )
        .eq("id", invoiceId)
        .maybeSingle();

      if (!error && invData && Array.isArray(invData.invoice_items)) {
        return {
          items: invData.invoice_items,
          meta: invData,
        };
      }
    } catch (err: unknown) {
      console.warn("fetchInvoiceCartSnapshot nested:", err);
    }

    try {
      const [{ data: items, error: itemsErr }, { data: invMeta }] = await Promise.all([
        supabase
          .from("invoice_items")
          .select(
            "id, product_id, quantity, unit_price, packing_name, custom_name, menu_size_id, products ( name, purchase_price_single )"
          )
          .eq("invoice_id", invoiceId),
        supabase
          .from("invoices")
          .select("restaurant_order_status, order_number")
          .eq("id", invoiceId)
          .maybeSingle(),
      ]);
      if (!itemsErr && items) {
        return { items, meta: invMeta || undefined };
      }
    } catch (err: unknown) {
      console.warn("fetchInvoiceCartSnapshot fallback:", err);
    }
    return null;
  };

  /** Reload visible cart + baseline (resume bill / table load). */
  const refreshCartFromInvoice = async (invoiceId: string) => {
    const snap = await fetchInvoiceCartSnapshot(invoiceId);
    if (snap?.items) {
      applyBaselineFromInvoiceRows(snap.items, snap.meta);
      return;
    }
    commitCartBaseline();
  };

  /** After KOT print: clear staging cart; bill stays on table / billing desk. */
  const clearCartAfterKot = async (activeInvoiceId: string, localBaseline?: CartItem[]) => {
    const immediate: CartItem[] =
      localBaseline && localBaseline.length > 0
        ? (JSON.parse(JSON.stringify(localBaseline)) as CartItem[])
        : mergeCartWithBaseline(dbItems, cart);

    setCart([]);
    setDiscount(0);
    setDiscountPercent(0);
    setTaxRate(0);
    setTipAmount(0);
    setAdditionalCharges(0);
    if (posMode !== "delivery") setDeliveryFee(0);
    setStagingCogs(0);
    setBaselineCogs(0);
    setCartEpoch((n) => n + 1);

    if (immediate.length > 0) {
      setDbItems(JSON.parse(JSON.stringify(immediate)) as CartItem[]);
      setCartEpoch((n) => n + 1);
    }

    const snap = await fetchInvoiceCartSnapshot(activeInvoiceId);
    if (snap?.items?.length) {
      applyBaselineFromInvoiceRows(snap.items, snap.meta);
    } else if (immediate.length > 0) {
      setCart([]);
      setDbItems(JSON.parse(JSON.stringify(immediate)) as CartItem[]);
      setCartEpoch((n) => n + 1);
    } else {
      setDbItems([]);
      setCartEpoch((n) => n + 1);
    }

    try {
      const { data: invRow } = await supabase
        .from("invoices")
        .select(
          "total_amount, discount, discount_percentage, tax_rate, restaurant_order_status, order_number"
        )
        .eq("id", activeInvoiceId)
        .maybeSingle();
      if (invRow) {
        setCurrentOrderStatus(
          normalizeOrderStatus(invRow.restaurant_order_status) || "pending"
        );
        if (invRow.order_number) setOrderNumber(invRow.order_number);
      }
    } catch {
      /* non-fatal */
    }

    if (posMode !== "dining" && activeInvoiceId) {
      setTakeawayInvoiceId(activeInvoiceId);
    }
    if (posMode === "dining" && selectedTable && activeInvoiceId) {
      setSelectedTable({ ...selectedTable, active_invoice_id: activeInvoiceId });
    }
    setCartEpoch((n) => n + 1);
  };

  const syncDraftInvoiceFromCart = async (
    activeInvoiceId: string
  ): Promise<{ versionSaved: boolean; revisionCount?: number }> => {
    const { data: prevInv } = await supabase
      .from("invoices")
      .select("stock_deducted, restaurant_order_status, bill_printed_at, edit_history, is_edited")
      .eq("id", activeInvoiceId)
      .maybeSingle();
    const { data: prevItems } = await supabase
      .from("invoice_items")
      .select(
        "product_id, quantity, unit_price, packing_name, custom_name, menu_size_id, products ( name, purchase_price_single )"
      )
      .eq("invoice_id", activeInvoiceId);

    const previousLines: RestaurantBillEditPersistLine[] = (prevItems || []).map((it: any) => ({
      product_id: it.product_id,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      subtotal: Number(it.unit_price) * Number(it.quantity),
      packing_name: it.packing_name,
      menu_size_id: it.menu_size_id,
      products: it.products,
    }));
    const nextLines = cartToEditLines(billingCart);
    const recordVersion = shouldAutoAppendBillVersion(previousLines, nextLines);

    const prevStatus = normalizeOrderStatus(prevInv?.restaurant_order_status);
    const wasPostPrint =
      requiresBillingDeskForItemEdits(prevStatus) || Boolean(prevInv?.bill_printed_at);
    const nextStatus = wasPostPrint
      ? "pending"
      : prevStatus && prevStatus !== "pending" && prevStatus !== "cancelled"
        ? prevStatus
        : "pending";

    const metaPatch = {
      discount_percentage: discountPercent,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_address: customerAddress || null,
      delivery_fee: posMode === "delivery" ? deliveryFee : 0,
      additional_charges: additionalCharges + tipAmount,
      special_instructions: orderSpecialInstructions || null,
      waiter_id: posMode === "dining" ? selectedWaiterId || null : null,
      rider_id: posMode === "delivery" ? selectedRiderId || null : null,
    };

    if (recordVersion) {
      const result = await persistRestaurantDraftBillEdit(supabase, {
        invoiceId: activeInvoiceId,
        previousItemRows: previousLines,
        nextItemRows: nextLines,
        discount: effectiveDiscount,
        taxRate: taxRate,
        editedBy: userName ?? undefined,
        nextOrderStatus: nextStatus ?? undefined,
        clearBillPrintedAt: wasPostPrint,
      });
      await supabase.from("invoices").update(metaPatch).eq("id", activeInvoiceId);
      setCurrentOrderStatus(nextStatus);
      return {
        versionSaved: true,
        revisionCount: result.updatedHistory.length,
      };
    }

    if (prevInv?.stock_deducted && previousLines.length) {
      await restoreStockForInvoiceLines(
        supabase,
        invoiceLinesForCost(
          previousLines.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
            packing_name: it.packing_name,
            menu_size_id: it.menu_size_id,
          }))
        )
      );
    }

    await supabase.from("invoice_items").delete().eq("invoice_id", activeInvoiceId);
    const invoiceItems = mapCartToInvoiceRows(activeInvoiceId, billingCart);
    if (invoiceItems.length) {
      await supabase.from("invoice_items").insert(invoiceItems);
    }

    await supabase
      .from("invoices")
      .update({
        total_amount: netTotal,
        tax_amount: taxAmount,
        discount: effectiveDiscount,
        tax_rate: taxRate,
        restaurant_order_status: nextStatus,
        ...(wasPostPrint ? { bill_printed_at: null } : {}),
        ...metaPatch,
      })
      .eq("id", activeInvoiceId);

    await applyRestaurantOrderCostAndStock(
      supabase,
      activeInvoiceId,
      invoiceLinesForCost(
        invoiceItems.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          packing_name: it.packing_name,
          menu_size_id: it.menu_size_id,
        }))
      ),
      netTotal
    );
    setCurrentOrderStatus(nextStatus);
    return { versionSaved: false };
  };

  useEffect(() => {
    if (!activeOrderInvoiceId || !shopId) return;
    const invoiceId = activeOrderInvoiceId;
    const timer = setInterval(() => {
      if (isSubmittingKOT) return;
      if (cart.length === 0) return;
      if (cartDiffersFromBaseline(cart, dbItems)) return;
      void refreshCartFromInvoice(invoiceId);
    }, 10000);
    return () => clearInterval(timer);
  }, [activeOrderInvoiceId, shopId, isSubmittingKOT, cart, dbItems]);

  // Load Active Table Order when table is selected
  const handleSelectTable = async (table: RestTable) => {
    setSelectedTable(table);
    setCart([]);
    setDbItems([]);
    setShowMobileCart(false);
    setSelectedCustomerId("walkin");
    setDiscount(0);
    setTaxRate(0);
    setSelectedWaiterId("");
    setSelectedRiderId("");
    setCurrentOrderStatus(null);

    if (table.status === "occupied" && table.active_invoice_id) {
      try {
        const { data: invData } = await supabase
          .from("invoices")
          .select(`
            party_id,
            discount,
            tax_rate,
            restaurant_order_status,
            order_number,
            customer_name,
            customer_phone,
            customer_address,
            delivery_fee,
            additional_charges,
            special_instructions,
            discount_percentage,
            waiter_id,
            invoice_items (
              id,
              product_id,
              quantity,
              unit_price,
              packing_name,
              menu_size_id,
              products ( name, purchase_price_single )
            )
          `)
          .eq("id", table.active_invoice_id)
          .single();

        if (invData) {
          applyBaselineFromInvoiceRows(invData.invoice_items, {
            restaurant_order_status: invData.restaurant_order_status,
            order_number: invData.order_number,
          });
          setSelectedCustomerId(invData.party_id || "walkin");
          setDiscount(Number(invData.discount || 0));
          setTaxRate(Number(invData.tax_rate || 0));
          setSelectedWaiterId(invData.waiter_id || "");
          setCurrentOrderStatus(normalizeOrderStatus(invData.restaurant_order_status) || "pending");
          setOrderNumber(invData.order_number || null);
          setCustomerName(invData.customer_name || "");
          setCustomerPhone(invData.customer_phone || "");
          setCustomerAddress(invData.customer_address || "");
          setDeliveryFee(Number(invData.delivery_fee || 0));
          setAdditionalCharges(Number(invData.additional_charges || 0));
          setDiscountPercent(Number(invData.discount_percentage || 0));
          setOrderSpecialInstructions(invData.special_instructions || "");
        }
      } catch (err: any) {
        toast.error("Failed to load table bill details: " + err.message);
      }
    }
  };

  // Reservations → Seat & POS deep link (?table=&guest=&phone=)
  useEffect(() => {
    if (!shopId || loading || reservationDeepLinkRef.current) return;
    const tableId = searchParams.get("table");
    if (!tableId || tables.length === 0) return;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    reservationDeepLinkRef.current = true;
    setPosMode("dining");
    const guest = searchParams.get("guest");
    const phone = searchParams.get("phone");

    void (async () => {
      await handleSelectTable(table);
      if (guest) setCustomerName(guest);
      if (phone) setCustomerPhone(phone);
    })();
  }, [shopId, loading, tables, searchParams]);

  const loadInvoiceIntoPosForEdit = async (invoiceId: string) => {
    if (!shopId) return;
    try {
      const { data: inv, error } = await supabase
        .from("invoices")
        .select(
          `
          id, status, service_type, table_id, party_id, discount, tax_rate,
          restaurant_order_status, order_number, customer_name, customer_phone, customer_address,
          delivery_fee, additional_charges, special_instructions, discount_percentage, waiter_id, rider_id,
          invoice_items (
            id, product_id, quantity, unit_price, packing_name, custom_name, menu_size_id,
            products ( name, purchase_price_single )
          )
        `
        )
        .eq("id", invoiceId)
        .eq("shop_id", shopId)
        .maybeSingle();

      if (error) throw error;
      if (!inv || inv.status !== "draft") {
        toast.error(language === "en" ? "Open draft bill not found." : "ڈرافٹ بل نہیں ملا۔");
        return;
      }

      let invoiceItems = inv.invoice_items;
      if (!invoiceItems || !Array.isArray(invoiceItems) || invoiceItems.length === 0) {
        const { data: directItems } = await supabase
          .from("invoice_items")
          .select(
            "id, product_id, quantity, unit_price, packing_name, custom_name, menu_size_id, products ( name, purchase_price_single )"
          )
          .eq("invoice_id", invoiceId);
        if (directItems && directItems.length > 0) {
          invoiceItems = directItems;
        }
      }

      const service = (inv.service_type || "takeaway") as "dining" | "takeaway" | "delivery";
      setPosMode(service);
      setResumeInvoiceId(invoiceId);

      const loadedCart = mapInvoiceItemsToCart(invoiceItems);
      const baseline = JSON.parse(JSON.stringify(loadedCart)) as CartItem[];

      if (service === "dining") {
        const table =
          tables.find((t) => t.active_invoice_id === invoiceId) ||
          (inv.table_id ? tables.find((t) => t.id === inv.table_id) : undefined);
        if (table) setSelectedTable(table);
      } else {
        setTakeawayInvoiceId(invoiceId);
      }

      setCart(loadedCart);
      setDbItems(baseline);
      setCartEpoch((n) => n + 1);

      setSelectedCustomerId(inv.party_id || "walkin");
      setDiscount(Number(inv.discount || 0));
      setTaxRate(Number(inv.tax_rate || 0));
      setDiscountPercent(Number(inv.discount_percentage || 0));
      setSelectedWaiterId(inv.waiter_id || "");
      setSelectedRiderId(inv.rider_id || "");
      setCurrentOrderStatus(normalizeOrderStatus(inv.restaurant_order_status) || "pending");
      setOrderNumber(inv.order_number || null);
      setCustomerName(inv.customer_name || "");
      setCustomerPhone(inv.customer_phone || "");
      setCustomerAddress(inv.customer_address || "");
      setDeliveryFee(Number(inv.delivery_fee || 0));
      setAdditionalCharges(Number(inv.additional_charges || 0));
      setOrderSpecialInstructions(inv.special_instructions || "");
      setShowMobileCart(true);

      toast.success(
        language === "en"
          ? "Bill loaded for editing - adjust items/quantities, then Save Bill or Send KOT."
          : "بل ایڈٹ کے لیے لوڈ ہو گیا - آئٹمز تبدیل کر کے Save Bill یا Send KOT دبائیں۔"
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || "Failed to load bill");
    }
  };

  const handleDirectSaveBillEdit = async () => {
    if (!resumeInvoiceId || !shopId) return;
    setIsSubmittingKOT(true);
    try {
      const syncMeta = await syncDraftInvoiceFromCart(resumeInvoiceId);
      toast.success(
        syncMeta.versionSaved
          ? language === "en"
            ? `Bill updated · revision v${syncMeta.revisionCount ?? 1} saved.`
            : `بل اپڈیٹ ہو گیا · ورژن v${syncMeta.revisionCount ?? 1} محفوظ۔`
          : language === "en"
            ? "Bill updated successfully."
            : "بل کامیابی سے اپڈیٹ ہو گیا۔"
      );
      const snap = await fetchInvoiceCartSnapshot(resumeInvoiceId);
      if (snap?.items?.length) {
        const freshCart = mapInvoiceItemsToCart(snap.items);
        setCart(freshCart);
        setDbItems(JSON.parse(JSON.stringify(freshCart)));
      }
      setCartEpoch((n) => n + 1);
      void loadRecentOrders();
    } catch (err: any) {
      toast.error("Failed to save bill edit: " + (err.message || String(err)));
    } finally {
      setIsSubmittingKOT(false);
    }
  };

  const handleCancelBillEdit = () => {
    setResumeInvoiceId(null);
    setCart([]);
    setDbItems([]);
    setSelectedTable(null);
    setTakeawayInvoiceId(null);
    setCurrentOrderStatus(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNumber(null);
    toast.info(language === "en" ? "Bill edit cancelled." : "بل ایڈٹ منسوخ کر دیا گیا۔");
  };

  useEffect(() => {
    if (!shopId || loading) return;
    const invId = searchParams.get("resumeInvoice");
    if (!invId) return;
    if (resumeDeepLinkRef.current === invId) return;
    resumeDeepLinkRef.current = invId;
    void loadInvoiceIntoPosForEdit(invId);
  }, [shopId, loading, tables, searchParams]);

  // Add Product to Cart (Default / Retail)
  const addToCart = (product: DBProduct) => {
    setCart(prev => {
      const exists = prev.find(it => it.productId === product.id && it.remarks === "");
      if (exists) {
        return prev.map(it => (it.productId === product.id && it.remarks === "")
          ? { ...it, quantity: it.quantity + 1 } 
          : it
        );
      } else {
        return [...prev, {
          cartItemId: product.id,
          productId: product.id,
          name: product.name,
          price: product.sale_price_single,
          purchasePrice: product.purchase_price_single,
          quantity: 1,
          remarks: "",
          notDiscounted: !!product.not_discounted,
        }];
      }
    });
  };

  // Add Customized Item to Cart
  const addCustomizedToCart = (
    product: DBProduct,
    displayName: string,
    customPrice: number,
    remarks: string,
    meta?: { sizeLabel?: string; menuSizeId?: string | null; crust?: string; addOns?: CartAddOnLine[] }
  ) => {
    setCart(prev => {
      const uniqueId = `${product.id}-${Date.now()}`;
      return [...prev, {
        cartItemId: uniqueId,
        productId: product.id,
        name: displayName,
        price: customPrice,
        purchasePrice: product.purchase_price_single,
        quantity: 1,
        remarks: remarks,
        sizeLabel: meta?.sizeLabel,
        menuSizeId: meta?.menuSizeId,
        crust: meta?.crust,
        addOns: meta?.addOns?.length ? meta.addOns : undefined,
        notDiscounted: !!product.not_discounted,
      }];
    });
  };

  const mapCartToInvoiceRows = (invoiceId: string, items: CartItem[] = cart) =>
    items.map((item) => ({
      invoice_id: invoiceId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      packing_name: item.dealMeta || item.sizeLabel || null,
      menu_size_id: item.menuSizeId || null,
      custom_name: item.isDeal
        ? item.name.replace(/^\s*🎯\s*/, "").trim() || null
        : null,
    }));

  const handleProductClick = async (product: DBProduct) => {
    const isBeverageOrDessert = categories.find(c => c.id === product.category_id)?.name.toLowerCase().includes("bever") ||
                               categories.find(c => c.id === product.category_id)?.name.toLowerCase().includes("dess");
    if (isBeverageOrDessert) {
      addToCart(product);
      return;
    }
    setCustomizingProduct(product);
    setSpecialInstructions("");
    setSelectedAddOns([]);
    setSelectedCrust("Regular");
    setWeightKg(1);
    const { data: sizes } = await supabase
      .from("restaurant_menu_sizes")
      .select("id, product_id, size_name, price, is_available, crust_options, variant_label, sort_order")
      .eq("shop_id", shopId!)
      .eq("product_id", product.id)
      .eq("is_available", true)
      .order("sort_order", { ascending: true });
    const sizeList = (sizes || []) as MenuSize[];
    if (sizeList.length > 0) {
      setProductSizes(sizeList);
      const def = resolveDefaultVariation(product, sizeList);
      setSelectedVariation(def);
      const matchedSize =
        sizeList.find((s) => s.size_name === def.name) || sizeList[0];
      const crusts = parseCrustOptions((matchedSize as any).crust_options);
      setSelectedCrust(crusts[0] || "Regular");
    } else {
      setProductSizes([]);
      setSelectedVariation(resolveDefaultVariation(product, null));
    }
  };

  const callWaiterForTable = async (table: RestTable) => {
    try {
      await supabase.from("restaurant_waiter_calls").insert({
        shop_id: shopId,
        table_id: table.id,
        invoice_id: table.active_invoice_id,
        message: `Waiter requested at ${table.name}`,
        call_type: "help",
        status: "pending",
      });
      toast.success(`Waiter called for ${table.name}`);
    } catch (e: any) {
      toast.error(e.message || "Run restaurant_extended_schema.sql migration");
    }
  };

  const addDealToCart = (item: {
    cartItemId: string; productId: string; name: string; price: number;
    purchasePrice: number; quantity: number; remarks: string;
    isDeal?: boolean;
    dealId?: string;
    dealMeta?: string;
    dealCostLines?: import("@/lib/restaurant-recipe-cost").RestaurantCartCostLine[];
  }) => {
    setCart((prev) => [
      ...prev,
      {
        ...item,
        cartItemId: item.cartItemId,
        notDiscounted: false,
        isDeal: true,
        dealId: item.dealId,
        dealMeta: item.dealMeta,
        dealCostLines: item.dealCostLines,
      },
    ]);
    toast.success("Deal added to order");
  };

  // Update Cart Qty
  const updateCartQty = (cartItemId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(it => it.cartItemId !== cartItemId));
    } else {
      setCart(prev => prev.map(it => it.cartItemId === cartItemId ? { ...it, quantity: qty } : it));
    }
  };

  // Update Cart Remarks
  const updateCartRemarks = (cartItemId: string, remarks: string) => {
    setCart(prev => prev.map(it => it.cartItemId === cartItemId ? { ...it, remarks } : it));
  };

  // Send KOT to Kitchen
  const sendKOT = async () => {
    if (activeClosingBook) {
      toast.error("Cannot process restaurant orders in a closed fiscal period!");
      return;
    }

    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }

    if (posMode === "dining" && !selectedTable) {
      toast.message(
        language === "en"
          ? "Tip: select a table for seating - KOT can still go to kitchen."
          : "ٹیبل منتخب کریں - KOT پھر بھی کچن میں جائے گا۔"
      );
    }

    if (posMode === "delivery") {
      if (!customerPhone.trim()) {
        toast.error("Delivery requires a customer phone number.");
        return;
      }
      if (!customerAddress.trim()) {
        toast.error("Delivery requires an address.");
        return;
      }
      if (!selectedRiderId) {
        toast.message("No rider assigned yet", {
          description: "KOT can go to kitchen - assign a rider before taking payment.",
        });
      }
    }

    if (posMode === "takeaway" && !customerName.trim() && !customerPhone.trim()) {
      toast.message("Tip: add name or phone for takeaway pickup calls.");
    }

    // Phase 3 (RST-05): restaurant KOT is online-only for dining/delivery; takeaway can queue offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (posMode === "takeaway" && shopId) {
        saveOfflineTakeawayDraft({
          id: crypto.randomUUID(),
          shopId,
          createdAt: new Date().toISOString(),
          customerName,
          customerPhone,
          cart: cart.map((c) => ({
            productId: c.productId,
            name: c.name,
            price: c.price,
            quantity: c.quantity,
            remarks: c.remarks,
          })),
          notes: orderSpecialInstructions,
        });
        setOfflineQueueCount(loadOfflineTakeawayQueue(shopId).length);
        toast.success("Takeaway saved offline - will sync when online");
        setCart([]);
        return;
      }
      toast.error("Kitchen orders require internet.", {
        description: "Offline restaurant POS is blocked so KOT/stock stay accurate.",
      });
      return;
    }

    setIsSubmittingKOT(true);
    try {
      let activeInvoiceId =
        resumeInvoiceId ??
        (posMode === "dining" ? selectedTable?.active_invoice_id || null : takeawayInvoiceId);

      // 1. Compute incremental KOT items
      const kotItems = cart.map((item) => {
        const dbQty =
          dbItems.find((d) => d.cartItemId === item.cartItemId)?.quantity ??
          dbItems
            .filter(
              (d) =>
                d.productId === item.productId &&
                d.price === item.price &&
                (d.menuSizeId || null) === (item.menuSizeId || null)
            )
            .reduce((sum, d) => sum + d.quantity, 0);
        const diffQty = item.quantity - dbQty;
        if (diffQty > 0) {
          const labels = restaurantReceiptItemLabels(
            item.name,
            item.dealMeta || item.sizeLabel || null,
            null,
            dealTitleById
          );
          const kitchenNote = item.isDeal
            ? item.remarks?.trim() || labels.detail || ""
            : item.remarks;
          return {
            product_id: item.productId,
            category_id:
              products.find((p) => p.id === item.productId)?.category_id ?? null,
            name: item.isDeal ? labels.title : item.name,
            quantity: diffQty,
            remarks: kitchenNote,
            sizeLabel: item.isDeal ? null : item.sizeLabel || null,
          };
        }
        return null;
      }).filter(Boolean) as any[];

      const cartDirty = cartDiffersFromBaseline(cart, dbItems);

      if (kotItems.length === 0 && !cartDirty) {
        toast.info("No new items or quantities added since last KOT.");
        setIsSubmittingKOT(false);
        return;
      }

      const baselineForKot = JSON.parse(JSON.stringify(billingCart)) as CartItem[];

      if (kotItems.length === 0 && cartDirty && activeInvoiceId) {
        const syncMeta = await syncDraftInvoiceFromCart(activeInvoiceId);
        await clearCartAfterKot(activeInvoiceId, baselineForKot);
        toast.success(
          syncMeta.versionSaved
            ? language === "en"
              ? `Bill reprocessed - edit version v${syncMeta.revisionCount ?? 1} saved automatically.`
              : `بل دوبارہ پروسیس - ورژن v${syncMeta.revisionCount ?? 1} خود محفوظ۔`
            : language === "en"
              ? "Cart synced with bill."
              : "کارٹ بل کے ساتھ اپڈیٹ ہو گیا۔"
        );
        setIsSubmittingKOT(false);
        return;
      }

      // 2. Create Draft Invoice if Dining/Takeaway and not already created
      if (!activeInvoiceId) {
        const dailyNum = await generateDailyOrderNumber(supabase, shopId!);
        const { data: newInv, error: invErr } = await supabase
          .from("invoices")
          .insert({
            shop_id: shopId,
            party_id: selectedCustomerId === "walkin" ? null : selectedCustomerId,
            total_amount: netTotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            discount: effectiveDiscount,
            discount_percentage: discountPercent,
            status: "draft",
            paid_amount: 0,
            payment_mode: "cash",
            waiter_id: posMode === "dining" ? selectedWaiterId || null : null,
            rider_id: posMode === "delivery" ? selectedRiderId || null : null,
            service_type: posMode,
            table_id: posMode === "dining" && selectedTable ? selectedTable.id : null,
            restaurant_order_status: "pending",
            order_number: dailyNum,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            customer_address: customerAddress || null,
            delivery_fee: posMode === "delivery" ? deliveryFee : 0,
            additional_charges: additionalCharges + tipAmount,
            special_instructions: orderSpecialInstructions || null,
          })
          .select()
          .single();

        if (invErr) throw invErr;
        activeInvoiceId = newInv.id;
        setOrderNumber(dailyNum);

        if (posMode === "dining" && selectedTable) {
          // Associate table
          const { error: tabErr } = await supabase
            .from("restaurant_tables")
            .update({
              active_invoice_id: activeInvoiceId,
              status: "occupied"
            })
            .eq("id", selectedTable.id);

          if (tabErr) throw tabErr;
          selectedTable.active_invoice_id = activeInvoiceId;
        } else if (posMode === "takeaway" || posMode === "delivery") {
          setTakeawayInvoiceId(activeInvoiceId);
        }
      }

      const firstProduct = products.find((p) => p.id === kotItems[0]?.product_id);
      const stationId = firstProduct?.kitchen_station_id || kdsStationPref || null;
      const hub = stations.find((s) => s.id === stationId)?.kitchen_hub || null;

      await dispatchKitchenTicket(supabase, {
        shopId: shopId!,
        invoiceId: activeInvoiceId!,
        tableId: selectedTable?.id || null,
        waiterId: selectedWaiterId ? selectedWaiterId : null,
        lines: kotItems.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          remarks: it.remarks,
        })),
        stationId,
        kitchenHub: hub,
      });

      setCurrentOrderStatus("pending");

      let syncMeta: { versionSaved: boolean; revisionCount?: number } = { versionSaved: false };
      if (activeInvoiceId) {
        syncMeta = await syncDraftInvoiceFromCart(activeInvoiceId);
      }

      // 6. Print KOT Slip
      if (printKitchenReceipt) {
        printRestaurantKOTDispatch(
          {
            orderNumber: orderNumber || undefined,
            tableName: selectedTable?.name || null,
            serviceType: posMode,
            ...posGuestDetails(),
            items: kotItems.map((it: any) => ({
              name: it.name,
              quantity: it.quantity,
              sizeLabel: it.sizeLabel,
              remarks: it.remarks,
            })),
            settings: receiptSettings,
            shopDetails: companyRowToShopDetails(companyDetails, shopName),
            companyRow: companyDetails,
          },
          {
            productIdToCategoryId: productCategoryById,
            lineMeta: kotItems,
          },
          {
            onError: (msg) =>
              toast.error(
                language === "en"
                  ? msg
                  : `${msg} - Windows میں تھرمل پرنٹر ڈیفالٹ بنائیں`
              ),
          }
        );
      }

      if (activeInvoiceId) {
        await clearCartAfterKot(activeInvoiceId, baselineForKot);
      } else {
        commitCartBaseline(baselineForKot);
        setCart([]);
        setCartEpoch((n) => n + 1);
      }

      toast.success(
        syncMeta.versionSaved
          ? language === "en"
            ? `KOT sent - edit version v${syncMeta.revisionCount ?? 1} saved (reprocess).`
            : `KOT بھیجا - ورژن v${syncMeta.revisionCount ?? 1} خود محفوظ۔`
          : language === "en"
            ? "KOT sent to kitchen - cart updated."
            : "KOT کچن میں - کارٹ اپڈیٹ۔"
      );
      void loadRecentOrders();
    } catch (err: any) {
      toast.error("Failed to send KOT: " + err.message);
    } finally {
      setIsSubmittingKOT(false);
    }
  };

  const handleConfirmSplit = async () => {
    if (activeClosingBook) {
      toast.error("Cannot split bills in a closed fiscal period!");
      return;
    }
    if (cart.length === 0) return;

    if (splitMode === "items") {
      if (splitItemIds.length === 0) {
        toast.error("Select at least one cart item for this share");
        return;
      }
      setIsProcessingSplit(true);
      try {
        const selected = cart.filter((c) => splitItemIds.includes(c.cartItemId));
        const shareTotal = selected.reduce((s, c) => s + c.price * c.quantity, 0);
        const { data: invData, error: invErr } = await supabase
          .from("invoices")
          .insert({
            shop_id: shopId,
            party_id: selectedCustomerId === "walkin" ? null : selectedCustomerId,
            total_amount: shareTotal,
            discount: 0,
            tax_rate: taxRate,
            tax_amount: 0,
            status: "paid",
            paid_amount: shareTotal,
            payment_mode: "cash",
            remarks: `Item split for ${posMode === "dining" ? `Table ${selectedTable?.name}` : "Takeaway"}`,
            account_id: getValidAccountId(selectedAccountId, cashAccounts),
            service_type: posMode,
          })
          .select()
          .single();
        if (invErr) throw invErr;
        await supabase.from("invoice_items").insert(
          selected.map((c) => ({
            invoice_id: invData.id,
            product_id: c.productId,
            quantity: c.quantity,
            unit_price: c.price,
            subtotal: c.price * c.quantity,
            packing_name: "Item split share",
          }))
        );
        setCart((prev) => prev.filter((c) => !splitItemIds.includes(c.cartItemId)));
        setSplitItemIds([]);
        setIsSplitModalOpen(false);
        toast.success(`Item split settled - Rs ${shareTotal.toLocaleString()}`);
      } catch (e: any) {
        toast.error(e.message || "Split failed");
      } finally {
        setIsProcessingSplit(false);
      }
      return;
    }

    setIsProcessingSplit(true);
    try {
      const activeInvoiceId = posMode === "dining" 
        ? (selectedTable?.active_invoice_id || null) 
        : takeawayInvoiceId;

      // Calculate shares
      const perShareTotal = Math.round(netTotal / splitCount);

      // Create N split invoices in DB
      for (let s = 1; s <= splitCount; s++) {
        // Direct checkout for each split portion
        const { data: invData, error: invErr } = await supabase
          .from("invoices")
          .insert({
            shop_id: shopId,
            party_id: selectedCustomerId === "walkin" ? null : selectedCustomerId,
            total_amount: perShareTotal,
            discount: Math.round(discount / splitCount),
            tax_rate: taxRate,
            tax_amount: Math.round(taxAmount / splitCount),
            status: "paid",
            paid_amount: perShareTotal,
            payment_mode: "cash",
            remarks: `Split Bill Share ${s} of ${splitCount} for ${posMode === "dining" ? `Table ${selectedTable?.name}` : "Takeaway"}`,
            register_session_id: null,
            account_id: getValidAccountId(selectedAccountId, cashAccounts),
            waiter_id: selectedRiderId ? null : (selectedWaiterId ? selectedWaiterId : null)
          })
          .select()
          .single();

        if (invErr) throw invErr;

        // Insert items for this portion
        await supabase.from("invoice_items").insert({
          invoice_id: invData.id,
          product_id: cart[0].productId,
          quantity: 1,
          unit_price: perShareTotal,
          subtotal: perShareTotal,
          packing_name: `Split Share ${s}/${splitCount}`
        });

        // Update Cash balance
        const currentAcc = cashAccounts.find(a => a.id === selectedAccountId);
        if (currentAcc) {
          await supabase
            .from("cash_accounts")
            .update({ current_balance: Number(currentAcc.current_balance || 0) + perShareTotal })
            .eq("id", selectedAccountId);
        }

        // Ledger entry
        await supabase.from("account_transactions").insert({
          shop_id: shopId,
          account_id: selectedAccountId,
          type: "deposit",
          amount: perShareTotal,
          ref_type: "invoice",
          ref_id: invData.id,
          remarks: `Split Receipt ${s}/${splitCount} - Invoice #${invData.id.slice(0, 8).toUpperCase()}`,
        });
      }

      // Clean table invoice if dining
      if (posMode === "dining" && selectedTable) {
        if (activeInvoiceId) {
          await supabase.from("invoice_items").delete().eq("invoice_id", activeInvoiceId);
          await supabase.from("invoices").delete().eq("id", activeInvoiceId);
        }
        await supabase
          .from("restaurant_tables")
          .update({ status: "available", active_invoice_id: null })
          .eq("id", selectedTable.id);
      }

      toast.success(`Successfully split table bill into ${splitCount} separate invoices!`);
      setCart([]);
      setSelectedTable(null);
      setIsSplitModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error("Split checkout failed: " + err.message);
    } finally {
      setIsProcessingSplit(false);
    }
  };

  const posGuestDetails = () => {
    const party = customers.find((c) => c.id === selectedCustomerId);
    return {
      customerName: customerName.trim() || party?.name || null,
      customerPhone: customerPhone.trim() || party?.phone || null,
      customerAddress: customerAddress.trim() || null,
      waiterName: staff.find((s) => s.id === selectedWaiterId)?.name || null,
      riderName: staff.find((s) => s.id === selectedRiderId)?.name || null,
      riderPhone: staffPhone(staff.find((s) => s.id === selectedRiderId)),
      specialInstructions: orderSpecialInstructions.trim() || null,
      deliveryFee: posMode === "delivery" ? deliveryFee : 0,
      additionalCharges: additionalCharges + tipAmount,
    };
  };

  const resolveActiveBillLines = async (invoiceId: string): Promise<RestaurantReceiptLine[]> => {
    if (billingCart.length > 0) {
      return billingCart.map((c) => {
        const packing = c.dealMeta || c.sizeLabel || null;
        const labels = restaurantReceiptItemLabels(c.name, packing);
        return {
          name: labels.title,
          detail: labels.detail,
          quantity: c.quantity,
          unit_price: c.price,
        };
      });
    }
    const { data } = await supabase
      .from("invoice_items")
      .select("quantity, unit_price, packing_name, custom_name, products(name)")
      .eq("invoice_id", invoiceId);
    return mapDbInvoiceItemsToReceiptLines(data || []);
  };

  // Print Guest Bill (before settlement - no payment recorded)
  const printGuestBill = async () => {
    const activeInvoiceId = posMode === "dining"
      ? (selectedTable?.active_invoice_id || null)
      : takeawayInvoiceId;

    if (!activeInvoiceId) {
      toast.error(language === "en" ? "Send KOT first to open an order." : "پہلے KOT بھیجیں۔");
      return;
    }
    if (!canPrintGuestBill(currentOrderStatus)) {
      toast.info(language === "en" ? "Guest bill already printed." : "بل پہلے ہی پرنٹ ہو چکا۔");
      return;
    }

    try {
      await markBillPrinted(supabase, activeInvoiceId);
      setCurrentOrderStatus("bill_printed");

      const items = await resolveActiveBillLines(activeInvoiceId);
      const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

      printRestaurantGuestBill(
        {
          invoiceId: activeInvoiceId,
          orderNumber: orderNumber,
          tableName:
            selectedTable?.name ||
            (posMode === "dining" ? "Dine-In" : posMode === "delivery" ? "Delivery" : "Takeaway"),
          serviceType: posMode,
          ...posGuestDetails(),
          items,
          subtotal,
          discount: effectiveDiscount,
          taxRate: taxRate,
          taxAmount: taxAmount,
          netTotal,
          settings: receiptSettings,
          shopDetails: companyRowToShopDetails(companyDetails, shopName),
          companyRow: companyDetails,
        },
        {
          onError: (msg) =>
            toast.error(
              language === "en"
                ? msg
                : `${msg} - Windows میں تھرمل پرنٹر ڈیفالٹ بنائیں`
            ),
        }
      );

      toast.success(
        language === "en"
          ? "Guest bill sent to printer - settle payment when ready."
          : "بل پرنٹ - ادائیگی کے لیے Settle کریں۔"
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePrintGuestReceipt = () => {
    const receiptElement = document.getElementById("guest-invoice-print-container");
    if (!receiptElement || !lastInvoice) return;

    printReceiptDirect({
      receiptHtml: receiptElement.innerHTML,
      settings: receiptSettings,
      title: `Guest Receipt #${lastInvoice.invoice?.id?.slice(0, 8).toUpperCase() || "Receipt"}`,
      onSuccess: () => toast.success("Printing guest receipt..."),
      onError: (err) => toast.error("Printing failed: " + (err?.message || "Check printer"))
    });
  };

  const rawCatIds = categories
    .filter(c => c.name.toLowerCase().includes("ingredient") || c.name.toLowerCase().includes("meat") || c.name.toLowerCase().includes("raw"))
    .map(c => c.id);

  const filteredProducts = products.filter(p => {
    if (p.is_ingredient) return false;
    if (p.show_in_restaurant_pos === false) return false;
    if (p.category_id && rawCatIds.includes(p.category_id)) return false;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategoryId === "all" || p.category_id === selectedCategoryId;
    return matchesSearch && matchesCat;
  });

  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleOrderData, setSettleOrderData] = useState<SettleOrderData | null>(null);

  const openSettleOrderModal = async () => {
    if (billingCart.length === 0) {
      toast.error(
        language === "en" ? "No items on this bill yet." : "بل میں کوئی آئٹم نہیں۔"
      );
      return;
    }
    if (!shopId) return;

    const activeInvoiceId =
      posMode === "dining"
        ? selectedTable?.active_invoice_id || null
        : takeawayInvoiceId;

    if (!activeInvoiceId) {
      toast.error(
        language === "en"
          ? "Send KOT to kitchen first - payment comes after the guest bill is printed."
          : "پہلے KOT بھیجیں - ادائیگی بل پرنٹ کے بعد۔"
      );
      return;
    }

    const { data: kots } = await supabase
      .from("kitchen_orders")
      .select("id")
      .eq("invoice_id", activeInvoiceId)
      .not("status", "eq", "voided");

    if (!kots?.length) {
      toast.error(
        language === "en"
          ? "This order has no kitchen ticket yet. Send KOT before taking payment."
          : "کچن ٹکٹ نہیں - پہلے KOT بھیجیں۔"
      );
      return;
    }

    if (!canSettleOrder(currentOrderStatus)) {
      toast.error(
        language === "en"
          ? "Flow: Send KOT → kitchen Start/Ready → Settle when ready (stock deducted when KOT is sent)."
          : "ترتیب: KOT → کچن → بل پرنٹ → پھر ادائیگی۔"
      );
      return;
    }

    if (posMode === "delivery" && !selectedRiderId) {
      toast.error(
        language === "en"
          ? "Assign a rider before taking payment on a delivery order."
          : "ڈیلیوری ادائیگی سے پہلے رائیڈر منتخب کریں۔"
      );
      setShowCustomerDetails(true);
      return;
    }

    const receiptLines = await resolveActiveBillLines(activeInvoiceId);
    if (!receiptLines.length) {
      toast.error(language === "en" ? "No items on this bill." : "بل میں آئٹمز نہیں۔");
      return;
    }

    let invoiceItemsForSettle: SettleOrderData["invoice_items"];
    if (billingCart.length > 0) {
      invoiceItemsForSettle = billingCart.map((c) => ({
        product_id: c.productId,
        quantity: c.quantity,
        unit_price: c.price,
        menu_size_id: c.menuSizeId || null,
        menu_size_name: c.isDeal ? null : c.sizeLabel || null,
        packing_name: c.dealMeta || c.sizeLabel || null,
      }));
    } else {
      const { data: invItems } = await supabase
        .from("invoice_items")
        .select("product_id, quantity, unit_price, packing_name, menu_size_id")
        .eq("invoice_id", activeInvoiceId);
      invoiceItemsForSettle = (invItems || []).map((i: any) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        menu_size_id: i.menu_size_id,
        packing_name: i.packing_name,
      }));
    }

    const guest = posGuestDetails();
    setSettleOrderData({
      id: activeInvoiceId,
      order_number: orderNumber || null,
      total_amount: netTotal,
      discount: effectiveDiscount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      party_id: selectedCustomerId === "walkin" ? null : selectedCustomerId,
      table_id: selectedTable?.id || null,
      tableName:
        selectedTable?.name ||
        (posMode === "dining" ? "Dine-In" : posMode === "delivery" ? "Delivery" : "Takeaway"),
      waiter_id: selectedWaiterId || null,
      rider_id: selectedRiderId || null,
      service_type: posMode,
      invoice_items: invoiceItemsForSettle,
      line_items: receiptLines,
      customer_name: guest.customerName,
      customer_phone: guest.customerPhone,
      customer_address: guest.customerAddress,
      waiterName: guest.waiterName,
      riderName: guest.riderName,
      riderPhone: guest.riderPhone,
      special_instructions: guest.specialInstructions,
      delivery_fee: guest.deliveryFee,
      additional_charges: guest.additionalCharges,
    });
    setIsSettleModalOpen(true);
  };

  const handleSettled = async () => {
    toast.success("Payment received & order settled!");
    setResumeInvoiceId(null);
    setCart([]);
    setDbItems([]);
    setSelectedTable(null);
    setTakeawayInvoiceId(null);
    setCurrentOrderStatus(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNumber(null);
    await loadData();
  };

  const handleManualFreeTable = async () => {
    if (!selectedTable || !shopId) return;
    if (!confirm(`Are you sure you want to mark "${selectedTable.name}" as Available? This will clear the table.`)) return;

    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ status: "available", active_invoice_id: null })
        .eq("id", selectedTable.id);

      if (error) throw error;
      toast.success(`${selectedTable.name} is now Available!`);
      setSelectedTable(null);
      setCart([]);
      setDbItems([]);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to free table: " + err.message);
    }
  };

  const loadRecentOrders = React.useCallback(async () => {
    if (!shopId) return;
    setLoadingRecentOrders(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          order_number,
          created_at,
          total_amount,
          cost_amount,
          profit_amount,
          status,
          restaurant_order_status,
          service_type,
          customer_name,
          party_id,
          table_id,
          parties ( name ),
          restaurant_tables ( name ),
          invoice_items (
            product_id,
            quantity,
            unit_price,
            packing_name,
            menu_size_id,
            products ( name )
          )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!error && data) {
        const liveInvoiceId =
          activeOrderInvoiceId ??
          (posMode === "dining" ? selectedTable?.active_invoice_id ?? null : takeawayInvoiceId);

        const enriched = await Promise.all(
          data.map(async (ord: any) => {
            const isLive = Boolean(liveInvoiceId && ord.id === liveInvoiceId);
            let items = ord.invoice_items || [];
            let displayTotal = Number(ord.total_amount || 0);

            if (isLive && billingCart.length > 0) {
              items = billingCart.map((c) => ({
                product_id: c.productId,
                quantity: c.quantity,
                unit_price: c.price,
                packing_name: c.dealMeta || c.sizeLabel || null,
                menu_size_id: c.menuSizeId || null,
                products: { name: c.name.replace(/^\s*🎯\s*/, "") },
              }));
              displayTotal = netTotal;
            }

            let cost = Number(ord.cost_amount);
            let profit = Number(ord.profit_amount);
            const shouldEstimateCost =
              isLive || ord.status === "draft" && (!Number.isFinite(cost) || cost <= 0);

            if (shouldEstimateCost) {
              if (isLive && billingCart.length > 0) {
                const cartCostLines = cartItemsToCostLines(billingCart);
                if (cartCostLines.length) {
                  cost = roundMoney(await computeCartIngredientCost(supabase, cartCostLines));
                }
              } else {
                const costLines = invoiceLinesForCost(
                  items.map((it: any) => ({
                    product_id: it.product_id,
                    quantity: Number(it.quantity),
                    packing_name: it.packing_name,
                    menu_size_id: it.menu_size_id,
                  }))
                );
                if (costLines.length) {
                  cost = roundMoney(await computeInvoiceIngredientCost(supabase, costLines));
                }
              }
              profit = roundMoney(Math.max(0, displayTotal - cost));
            }

            return {
              ...ord,
              total_amount: displayTotal,
              invoice_items: items,
              cost_amount: cost,
              profit_amount: profit,
              _liveDraft: isLive && billingCart.length > 0,
            };
          })
        );

        setRecentOrders(enriched);
      }
    } catch (e) {
      console.error("Error loading recent orders:", e);
    } finally {
      setLoadingRecentOrders(false);
    }
  }, [
    shopId,
    supabase,
    activeOrderInvoiceId,
    posMode,
    selectedTable?.active_invoice_id,
    takeawayInvoiceId,
    billingCart,
    netTotal,
  ]);

  React.useEffect(() => {
    if (leftPosTab !== "history") return;
    const timer = setTimeout(() => {
      void loadRecentOrders();
    }, 350);
    return () => clearTimeout(timer);
  }, [leftPosTab, billingCart, loadRecentOrders]);

  if (!mounted) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center bg-slate-50 w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const totalCartItemCount = cart.reduce((sum, it) => sum + it.quantity, 0);
  const onBillItemCount = dbItems.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100 font-sans select-none">
      {/* Branded Custom Restaurant POS Header */}
      <div
        className={`h-12 text-white border-b flex items-center justify-between px-3 md:px-4 shrink-0 shadow-md ${
          isFlame9Brand() ? "bg-[#14110F] border-[#FF4D00]/25" : "bg-zinc-950 border-zinc-800/80"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Hamburger Toggle Button (Mobile Only) */}
          <button 
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("open-sidebar"));
              }
            }}
            className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
            aria-label="Open Sidebar"
          >
            <Menu size={18} />
          </button>
          
          {isFlame9Brand() ? (
            <Flame9PosHeaderBrand shopLogo={shopLogo} shopName={shopName} />
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <div className="text-white font-extrabold text-[10px]">HX</div>
              </div>
              <div className="font-extrabold text-xs tracking-tight text-white/90">Restaurant POS Desk</div>
            </div>
          )}
        </div>

        {/* Right side toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {orderNumber && (
            <div className="text-[10px] font-mono font-bold bg-zinc-800 px-2 py-0.5 rounded text-amber-400">
              #{orderNumber}
            </div>
          )}
          <Link href="/dashboard/restaurant/orders">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <ClipboardList size={12} className="mr-1" /> History
            </Button>
          </Link>
          <Link href="/dashboard/restaurant/kot">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <ChefHat size={12} className="mr-1" /> KOT Queue
            </Button>
          </Link>
          <Link href="/dashboard/restaurant/kds">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <ChefHat size={12} className="mr-1" /> Kitchen KDS
            </Button>
          </Link>
          <Link href="/dashboard/restaurant/tables">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <Coffee size={12} className="mr-1" /> Tables
            </Button>
          </Link>
          <Link href="/dashboard/restaurant/billing-desk">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <Receipt size={12} className="mr-1" /> Billing Desk
            </Button>
          </Link>
          <Link href="/dashboard/settings">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <Printer size={12} className="mr-1" /> Receipt
            </Button>
          </Link>
          <Link href="/dashboard/restaurant/deals">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <Tag size={12} className="mr-1" /> Deals
            </Button>
          </Link>
          <button onClick={() => setWaiterDialogOpen(true)} className="relative text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900 rounded-lg flex items-center cursor-pointer">
            <Bell size={12} className="mr-1" /> Calls
            {waiterBadgeCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {waiterBadgeCount}
              </div>
            )}
          </button>
          <Link href="/dashboard">
            <Button variant="ghost" className="text-zinc-400 hover:text-white text-xs h-7 px-2 font-bold hover:bg-zinc-900 rounded-lg">
              Exit
            </Button>
          </Link>
        </div>
      </div>

      {/* POS Sub-content area containing Left Menu and Right Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
        {/* Left Menu & Table Grid Area */}
        <div className={`flex-1 flex-col min-w-0 p-3 md:p-4 overflow-y-auto ${showMobileCart ? "hidden md:flex" : "flex"}`}>
          {/* Navigation & Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 text-white p-1.5 rounded-xl shadow-sm">
                <Utensils size={16} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-800 tracking-tight leading-tight">
                  {posMode === "dining" ? "Dine-In Billing" : posMode === "takeaway" ? "Takeaway Counter" : "Home Delivery Dispatch"}
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {posMode === "dining" ? (selectedTable ? `Active: ${selectedTable.name} (${selectedTable.capacity} guests)` : "Select a table or click dishes to order") : "Fast counter checkout"}
                </p>
              </div>
            </div>

            {/* View Mode Selectors */}
            <div className="bg-slate-200/80 p-0.5 rounded-xl flex shadow-inner shrink-0">
              <button
                onClick={() => {
                  setPosMode("dining");
                  setTakeawayInvoiceId(null);
                  setSelectedRiderId("");
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  posMode === "dining"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🍽️ Dine-In
              </button>
              <button
                onClick={() => {
                  setPosMode("takeaway");
                  setSelectedTable(null);
                  setSelectedRiderId("");
                  setSelectedWaiterId("");
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  posMode === "takeaway"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🥡 Takeaway
              </button>
              <button
                onClick={() => {
                  setPosMode("delivery");
                  setSelectedTable(null);
                  setSelectedWaiterId("");
                  setShowCustomerDetails(true);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  posMode === "delivery"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🛵 Delivery
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          ) : (
            /* Unified Seating & Menu Area */
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-3 md:p-4">
              {/* Dining Mode Seating Strip */}
              {posMode === "dining" && (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3 shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Coffee size={14} className="text-blue-600" />
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        {selectedTable ? `Selected: ${selectedTable.name}` : "Seating Tables"}
                      </div>
                      {selectedTable && (
                        <div className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          selectedTable.status === "available"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : selectedTable.status === "occupied"
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}>
                          {selectedTable.status}
                        </div>
                      )}
                    </div>

                    {/* Floor Filters */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={floorFilter}
                        onChange={(e) => setFloorFilter(e.target.value)}
                        className="text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-0.5 font-semibold text-slate-700 focus:outline-none cursor-pointer h-7"
                      >
                        <option value="all">All Floors</option>
                        {Array.from(new Set(tables.map((t) => t.floor_name || "Ground"))).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>

                      {selectedTable && (
                        <div className="flex items-center gap-1">
                          {selectedTable.status === "cleaning" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleManualFreeTable}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 h-7 px-2.5 cursor-pointer shadow-sm"
                              title="Mark Table as Cleaned & Ready"
                            >
                              ✨ Mark Clean & Ready
                            </Button>
                          )}
                          {selectedTable.status === "occupied" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleManualFreeTable}
                              className="text-[10px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50 h-7 px-2 cursor-pointer"
                              title="Clear and free this table"
                            >
                              🧹 Free Table
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTable(null)}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 h-7 px-2 cursor-pointer"
                          >
                            Deselect
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Table Horizontal Buttons Strip */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {tables
                      .filter((t) => floorFilter === "all" || (t.floor_name || "Ground") === floorFilter)
                      .map((table, tIdx) => {
                        const isSelected = selectedTable?.id === table.id;
                        const isOccupied = table.status === "occupied";
                        const isAvailable = table.status === "available";

                        return (
                          <button
                            key={table.id || `table-${tIdx}`}
                            onClick={() => handleSelectTable(table)}
                            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300"
                                : isOccupied
                                  ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                  : isAvailable
                                    ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                    : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              isSelected ? "bg-white" : isOccupied ? "bg-rose-500" : isAvailable ? "bg-emerald-500" : "bg-amber-500"
                            }`} />
                            <div>{table.name}</div>
                            <div className={`text-[9px] font-normal ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                              ({table.capacity}p)
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Menu / Deals Tabs & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 mb-3 shrink-0">
                <div className="flex gap-1 shrink-0 bg-slate-100 p-0.5 rounded-xl w-fit">
                  <button onClick={() => setLeftPosTab("menu")} className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${leftPosTab === "menu" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
                    🍔 Menu
                  </button>
                  <button onClick={() => setLeftPosTab("deals")} className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${leftPosTab === "deals" ? "bg-orange-500 text-white shadow" : "text-slate-500 hover:text-slate-800"}`}>
                    🎯 Deals
                  </button>
                  <button onClick={() => { setLeftPosTab("history"); loadRecentOrders(); }} className={`px-3.5 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition ${leftPosTab === "history" ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-800"}`}>
                    📋 Order History
                  </button>
                </div>

                {leftPosTab !== "history" && (
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search dishes by name or code..."
                      value={searchQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchQuery(v);
                        const parsed = parseScaleBarcode(v.trim());
                        if (parsed.isScaleBarcode && products.length) {
                          const match = products.find(
                            (p) =>
                              p.id.replace(/-/g, "").endsWith(parsed.productCode) ||
                              p.name.toLowerCase().includes(parsed.productCode)
                          );
                          if (match) {
                            setCustomizingProduct(match);
                            setWeightKg(parsed.weightKg || 0.5);
                            setSearchQuery("");
                            toast.message(`Scale: ${parsed.weightKg} kg`);
                          }
                        }
                      }}
                      className="pl-8 bg-slate-50 border-slate-200 h-9 text-xs font-medium rounded-xl"
                    />
                  </div>
                )}
              </div>

              {leftPosTab === "history" ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-150 shrink-0">
                    <div className="flex items-center gap-2">
                      <ClipboardList size={16} className="text-blue-600" />
                      <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Recent Orders History</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadRecentOrders}
                        className="text-[11px] font-bold text-slate-600 h-7 px-2 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={12} className={loadingRecentOrders ? "animate-spin" : ""} /> Refresh
                      </Button>
                      <Link href="/dashboard/restaurant/orders">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50 h-7 px-2.5 flex items-center gap-1 cursor-pointer"
                        >
                          Full History Page ↗
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {loadingRecentOrders ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : recentOrders.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <ClipboardList className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                      <p className="font-bold text-slate-600 text-xs">No recent orders found.</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Orders processed on the POS will show up here.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {recentOrders.map((ord, idx) => {
                        const itemsSummary = (ord.invoice_items || [])
                          .map((it: any) => {
                            const label = invoiceItemDisplayName(
                              it.products?.name || "Item",
                              it.packing_name
                            );
                            return `${it.quantity}x ${label}`;
                          })
                          .join(", ");
                        const isPaid = ord.status === "paid" || ord.restaurant_order_status === "settled";
                        const costAmt = Number(ord.cost_amount);
                        const profitAmt = Number(ord.profit_amount);
                        const hasCost =
                          ord.cost_amount != null && ord.cost_amount !== "" && Number.isFinite(costAmt);

                        return (
                          <div
                            key={ord.id || idx}
                            className="bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-mono font-bold text-xs text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                  #{ord.order_number || ord.id.slice(0, 8).toUpperCase()}
                                </div>
                                <div className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  isPaid
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}>
                                  {ord.restaurant_order_status || ord.status}
                                </div>
                                {ord._liveDraft && (
                                  <div className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                    {language === "en" ? "Live cart" : "لائیو"}
                                  </div>
                                )}
                                <div className="text-[10px] font-medium text-slate-500">
                                  {ord.service_type === "dining" ? `🍽️ Table: ${ord.restaurant_tables?.name || ord.table_id || "Dine-In"}` : ord.service_type === "delivery" ? "🛵 Delivery" : "🥡 Takeaway"}
                                </div>
                              </div>
                              <p className="text-[11px] text-slate-600 truncate max-w-md mt-1">
                                {itemsSummary || "No items"}
                              </p>
                              <div className="text-[9px] text-slate-400">
                                {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ord.parties?.name || ord.customer_name || "Walk-in"}
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-end justify-between w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200 gap-0.5">
                              <div className="font-black text-slate-900 text-xs font-mono">
                                Rs {Number(ord.total_amount || 0).toLocaleString()}
                              </div>
                              {hasCost || (ord._liveDraft && Number.isFinite(costAmt)) ? (
                                <div className="text-[9px] font-mono text-slate-600">
                                  {language === "en" ? "COGS (est.)" : "لاگت"} Rs {costAmt.toFixed(0)}
                                  {" · "}
                                  <div className="text-emerald-700">
                                    {language === "en" ? "Profit" : "منافع"} Rs{" "}
                                    {(Number.isFinite(profitAmt)
                                      ? profitAmt
                                      : Number(ord.total_amount || 0) - costAmt
                                    ).toFixed(0)}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[9px] text-slate-400">
                                  {language === "en"
                                    ? "COGS - add items or send KOT"
                                    : "آئٹم یا KOT"}
                                </div>
                              )}
                              {!isPaid && ord.id && (
                                <button
                                  type="button"
                                  onClick={() => void loadInvoiceIntoPosForEdit(ord.id)}
                                  className="mt-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                                >
                                  <Edit size={10} />
                                  {resumeInvoiceId === ord.id
                                    ? language === "en"
                                      ? "Editing Now"
                                      : "ایڈٹ جاری"
                                    : language === "en"
                                      ? "Edit Bill"
                                      : "بل ایڈٹ"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : leftPosTab === "deals" ? (
                <div className="flex-1 overflow-y-auto">
                  <RestaurantDealsTab onConfigureDeal={setDealToConfigure} />
                </div>
              ) : (
                <>
                  {/* Category Filter Horizontal List */}
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-2 mb-2 custom-scrollbar shrink-0">
                    <button
                      onClick={() => setSelectedCategoryId("all")}
                      className={`px-3 py-1 text-xs font-bold rounded-xl shrink-0 transition-colors cursor-pointer shadow-sm ${
                        selectedCategoryId === "all"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All Dishes ({filteredProducts.length})
                    </button>
                    {categories
                      .filter(c => !rawCatIds.includes(c.id))
                      .map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-xl shrink-0 transition-colors cursor-pointer shadow-sm ${
                            selectedCategoryId === cat.id
                              ? "bg-blue-600 text-white shadow-md"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                  </div>

                  {/* Food Dishes Grid */}
                  <div className="flex-1 overflow-y-auto pr-1">
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <Utensils className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700 text-sm">No dishes match your search.</p>
                        <p className="text-xs text-slate-400 mt-1">Try another category or clear search filter.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredProducts.map((p, pIdx) => {
                          const catName = categories.find(c => c.id === p.category_id)?.name || "Dish";

                          return (
                            <motion.div
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              key={p.id || `dish-${pIdx}`}
                              onClick={() => handleProductClick(p)}
                              className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between h-28 relative cursor-pointer group shadow-sm"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                                    {catName}
                                  </div>
                                  <div className="text-[9px] font-medium text-slate-400 font-mono">
                                    Stock: {p.current_stock}
                                  </div>
                                </div>
                                <h4 className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                                  {p.name}
                                </h4>
                              </div>

                              <div className="flex justify-between items-center w-full pt-1 border-t border-slate-100">
                                <div className="text-xs font-black text-blue-700 font-mono">
                                  Rs {Number(p.sale_price_single).toLocaleString()}
                                </div>
                                <div className="bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white p-1 rounded-lg transition-colors flex items-center justify-center">
                                  <Plus size={13} />
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Floating Cart Button for Mobile */}
          {!showMobileCart && cart.length > 0 && (
            <div className="fixed bottom-4 right-4 z-40 md:hidden">
              <Button
                onClick={() => setShowMobileCart(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg flex items-center gap-2 px-5 py-3 h-12 border border-blue-500/20"
              >
                <ShoppingCart size={18} />
                <div>View Cart ({totalCartItemCount})</div>
                <div className="font-mono bg-blue-700 px-2 py-0.5 rounded-full text-[10px]">
                  Rs {roundMoney(displayCartSubtotal).toLocaleString()}
                </div>
              </Button>
            </div>
          )}
        </div>

        {/* Right cart panel - width draggable on desktop (left edge) */}
        <div
          className={`w-full h-full flex flex-col bg-white border-l border-slate-200 overflow-hidden shrink-0 min-h-0 relative ${
            showMobileCart ? "flex" : "hidden md:flex"
          }`}
          style={
            cartPanelDesktop
              ? {
                  width: `${cartPanelWidth}px`,
                  minWidth: CART_PANEL_MIN_W,
                  maxWidth: CART_PANEL_MAX_W,
                  transition: cartPanelResizing ? "none" : "width 0.15s ease-out",
                }
              : undefined
          }
        >
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startCartPanelResize}
            className={`absolute left-0 top-0 bottom-0 w-2 z-20 cursor-col-resize hidden md:flex items-center justify-center group ${
              cartPanelResizing ? "bg-sky-500/15" : "hover:bg-slate-100/80"
            }`}
            title={language === "en" ? "Drag to resize cart panel" : "کارٹ پینل چوڑائی"}
          >
            <div
              className={`w-0.5 h-10 rounded-full ${cartPanelResizing ? "bg-sky-600" : "bg-transparent group-hover:bg-slate-400"}`}
            />
          </div>
          {/* Top bar: table + guest + clear (cart title header hidden) */}
          <div className="px-2 py-1 border-b border-slate-200 shrink-0 bg-white">
            <div className="flex items-center justify-between gap-2 text-xs min-h-7">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileCart(false)}
                  className="md:hidden text-slate-600 hover:text-slate-900 p-0.5 h-auto shrink-0"
                >
                  <ArrowLeft size={18} />
                </Button>
                <div className="min-w-0 truncate text-[11px] leading-tight">
                  {posMode === "dining" && selectedTable && (
                    <div className="font-black text-slate-900">{selectedTable.name}</div>
                  )}
                  {posMode === "dining" && selectedTable && (
                    <div className="text-slate-400 mx-1">·</div>
                  )}
                  {posMode === "delivery" && (
                    <div className="font-black text-slate-900">
                      {language === "en" ? "Delivery" : "ڈیلیوری"}
                      <div className="text-slate-400 mx-1">·</div>
                    </div>
                  )}
                  {posMode === "takeaway" && (
                    <div className="font-black text-slate-900">
                      {language === "en" ? "Takeaway" : "پیک"}
                      <div className="text-slate-400 mx-1">·</div>
                    </div>
                  )}
                  <div className="font-semibold text-slate-600">
                    {totalCartItemCount > 0
                      ? `${totalCartItemCount} ${language === "en" ? "in cart" : "کارٹ"}`
                      : language === "en"
                        ? "New order - add items"
                        : "نیا آرڈر"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Clear items in this cart (not the kitchen bill)?")) {
                        setCart([]);
                        if (!activeOrderInvoiceId && !onBillItemCount) {
                          setDbItems([]);
                          setSelectedTable(null);
                          setTakeawayInvoiceId(null);
                          setCurrentOrderStatus(null);
                          setCustomerName("");
                          setCustomerPhone("");
                          setCustomerAddress("");
                        }
                        setCartEpoch((n) => n + 1);
                      }
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer whitespace-nowrap"
                  >
                    Clear cart
                  </button>
                )}
                <button
                  onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap"
                >
                  {showCustomerDetails ? "Hide" : "Edit"}
                </button>
              </div>
            </div>
            {activeOrderInvoiceId && onBillItemCount > 0 && (
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px]">
                <div className="min-w-0 truncate text-slate-700">
                  <div className="font-bold text-slate-800">
                    {language === "en" ? "Open kitchen bill" : "کھلا بل"}
                  </div>
                  {orderNumber ? (
                    <div className="font-mono font-bold text-blue-800 ml-1">#{orderNumber}</div>
                  ) : null}
                  <div className="font-mono font-black text-slate-900 ml-1">
                    Rs {roundMoney(baselineSubtotal).toLocaleString()}
                  </div>
                  <div className="text-slate-500 ml-1">
                    · {onBillItemCount} {language === "en" ? "sent to kitchen" : "کچن"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {resumeInvoiceId !== activeOrderInvoiceId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeOrderInvoiceId) {
                          void loadInvoiceIntoPosForEdit(activeOrderInvoiceId);
                        }
                      }}
                      className="shrink-0 font-bold text-amber-700 hover:text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] cursor-pointer"
                    >
                      {language === "en" ? "Edit bill" : "بل ایڈٹ"}
                    </button>
                  )}
                  <Link
                    href="/dashboard/restaurant/active-bills"
                    className="shrink-0 font-bold text-blue-700 hover:text-blue-900 whitespace-nowrap text-[10px]"
                  >
                    {language === "en" ? "View bill" : "دیکھیں"}
                  </Link>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5">
              <div className="flex items-center gap-1.5 truncate min-w-0">
                <div className="font-bold text-slate-800 truncate">
                  👤 {customerName || (selectedCustomerId === "walkin" ? "Walk-in Guest" : customers.find(c => c.id === selectedCustomerId)?.name || "Guest")}
                </div>
                {posMode === "dining" && selectedWaiterId && (
                  <div className="text-[10px] text-slate-500 truncate">
                    · 👨‍🍳 {staff.find(s => s.id === selectedWaiterId)?.name || "Waiter"}
                  </div>
                )}
                {posMode === "delivery" && (
                  <div className={`text-[10px] truncate ${selectedRiderId ? "text-emerald-700" : "text-amber-700 font-bold"}`}>
                    · 🛵 {selectedRiderId
                      ? riderLabel(staff.find((s) => s.id === selectedRiderId))
                      : "No rider"}
                  </div>
                )}
              </div>
            </div>

            {/* Expandable Inputs */}
            {showCustomerDetails && (
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <div className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Guest / Khata</div>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedCustomerId(id);
                        if (id === "walkin") return;
                        const party = customers.find((c) => c.id === id);
                        if (party?.name && !customerName.trim()) setCustomerName(party.name);
                        if (party?.phone && !customerPhone.trim()) setCustomerPhone(party.phone);
                      }}
                      className="w-full bg-white border border-slate-200 h-7 rounded-lg px-1.5 text-[11px] focus:outline-none cursor-pointer"
                    >
                      <option value="walkin">Walk-in Guest</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {posMode === "dining" && (
                    <div>
                      <div className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Waiter</div>
                      <select
                        value={selectedWaiterId}
                        onChange={(e) => setSelectedWaiterId(e.target.value)}
                        className="w-full bg-white border border-slate-200 h-7 rounded-lg px-1.5 text-[11px] focus:outline-none cursor-pointer"
                      >
                        <option value="">No Waiter Assigned</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {posMode === "delivery" && (
                    <div>
                      <div className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                        Rider (required before pay)
                      </div>
                      <select
                        value={selectedRiderId}
                        onChange={(e) => setSelectedRiderId(e.target.value)}
                        className="w-full bg-white border border-slate-200 h-7 rounded-lg px-1.5 text-[11px] focus:outline-none cursor-pointer"
                      >
                        <option value="">Select delivery rider…</option>
                        {filterRiderStaff(staff).map((s) => (
                          <option key={s.id} value={s.id}>
                            {riderLabel(s) || s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <Input placeholder="Guest Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-7 text-[11px]" />
                  <Input placeholder="Phone Number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="h-7 text-[11px]" />
                </div>
                {posMode === "delivery" && (
                  <Input placeholder="Delivery Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="h-7 text-[11px]" />
                )}
                <textarea
                  placeholder="Special instructions for kitchen..."
                  value={orderSpecialInstructions}
                  onChange={(e) => setOrderSpecialInstructions(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[10px] min-h-[32px] resize-none"
                />
              </div>
            )}
          </div>

          {/* Cart Item Rows - Primary Scrollable Area */}
          <div
            key={`restaurant-cart-${cartEpoch}`}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 py-1 space-y-1 bg-white"
          >
            {resumeInvoiceId && (
              <div className="mb-2 p-2 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2 shadow-xs shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                    <Edit size={13} className="text-amber-700 shrink-0" />
                    <span className="truncate">
                      {language === "en" ? "Editing Bill" : "ایڈٹ بل"} #{orderNumber || resumeInvoiceId.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-800 mt-0.5 truncate">
                    {language === "en" ? "Change dishes & save or send KOT" : "تبدیلی کریں اور محفوظ یا KOT کریں"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDirectSaveBillEdit}
                    disabled={isSubmittingKOT}
                    className="h-7 px-2.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-none cursor-pointer"
                  >
                    {isSubmittingKOT ? <Loader2 className="animate-spin h-3 w-3" /> : (language === "en" ? "Save Bill" : "محفوظ")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelBillEdit}
                    className="h-7 px-2 text-[11px] font-semibold bg-white border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    {language === "en" ? "Cancel" : "منسوخ"}
                  </Button>
                </div>
              </div>
            )}
            {cart.length === 0 && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                  <ShoppingCart size={20} strokeWidth={2.25} />
                </div>
                <p className="text-[12px] font-bold text-slate-800">
                  {language === "en" ? "Billing ready for new items" : "بلنگ تیار"}
                </p>
                <p className="mt-1 text-[10px] text-slate-500 leading-snug px-2">
                  {language === "en"
                    ? "Pick dishes from the menu - they show here. Send KOT when this cart is ready."
                    : "مینو سے آئٹم - یہاں نظر آئیں گی۔ پھر KOT بھیجیں۔"}
                </p>
              </div>
            )}
            {cart.length > 0 &&
              cart.map((item, idx) => {
                const dbQty =
                  dbItems.find((d) => d.cartItemId === item.cartItemId)?.quantity ??
                  dbItems
                    .filter(
                      (d) =>
                        d.productId === item.productId &&
                        d.price === item.price &&
                        (d.menuSizeId || null) === (item.menuSizeId || null)
                    )
                    .reduce((sum, d) => sum + d.quantity, 0);
                const isNew = item.quantity > dbQty;
                const itemKey = item.cartItemId || `cart-item-${item.productId || "dish"}-${idx}`;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={itemKey} 
                    className="py-1.5 px-1 border-b border-slate-100 relative"
                  >
                    {isNew && (
                      <div className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded">
                        NEW
                      </div>
                    )}

                    <div className="flex justify-between items-start gap-1 pr-7">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 font-mono mr-1">#{idx + 1}</div>
                        <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                        {item.addOns && item.addOns.length > 0 && (
                          <ul className="mt-1 space-y-0.5 pl-1">
                            {item.addOns.map((a) => (
                              <li
                                key={`${item.cartItemId}-${a.name}`}
                                className="flex justify-between gap-2 text-[10px] text-emerald-800 font-semibold"
                              >
                                <div className="truncate">+ {a.name}</div>
                                <div className="shrink-0 font-mono">
                                  {a.priceAdd > 0 ? `Rs ${a.priceAdd}` : "Free"}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="font-black text-slate-900 text-xs font-mono shrink-0">
                        Rs {(item.price * item.quantity).toLocaleString()}
                      </div>
                    </div>

                    {/* Quantity controls & Unit Price */}
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                      <div className="text-[10px] text-slate-500 font-mono font-medium">
                        Rs {item.price.toLocaleString()} each
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center border border-slate-200 bg-slate-50 rounded-lg p-0.5 shadow-inner">
                          <button
                            onClick={() => updateCartQty(item.cartItemId, item.quantity - 1)}
                            className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-700 cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <div className="w-7 text-center text-xs font-black font-mono text-slate-900">{item.quantity}</div>
                          <button
                            onClick={() => updateCartQty(item.cartItemId, item.quantity + 1)}
                            className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-700 cursor-pointer"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <button
                          onClick={() => updateCartQty(item.cartItemId, 0)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-1 flex items-center gap-1 bg-slate-50 border border-slate-100 rounded px-1.5 h-6">
                      <MessageSquare size={9} className="text-slate-400 shrink-0" />
                      <input
                        placeholder="Kitchen note"
                        value={item.remarks}
                        onChange={(e) => updateCartRemarks(item.cartItemId, e.target.value)}
                        className="w-full bg-transparent text-[10px] placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  </motion.div>
                );
              })}
          </div>

          {/* Pricing Summary & Checkout Action Buttons */}
          <div className="border-t border-slate-200 px-1.5 py-1.5 bg-white shrink-0">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(6.25rem,1fr))] gap-x-2 gap-y-1.5 w-full">
              {awaitingNextKot ? (
                <div className="col-span-full min-w-0">
                  <div className="text-[10px] font-semibold text-slate-500">
                    {language === "en" ? `This cart · ${stagingDishCount} dishes` : `کارٹ · ${stagingDishCount}`}
                  </div>
                  <div className="font-mono font-black text-slate-900 text-sm">Rs 0</div>
                </div>
              ) : onBillItemCount > 0 && stagingDishCount > 0 ? (
                <>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 truncate leading-tight">
                      {language === "en"
                        ? `Kitchen (sent) · ${baselineDishCount}`
                        : `کچن · ${baselineDishCount}`}
                    </div>
                    <div className="font-mono font-black text-slate-500 text-sm leading-tight">
                      Rs {roundMoney(baselineSubtotal).toLocaleString()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-blue-700 truncate leading-tight">
                      {language === "en"
                        ? `This cart · ${stagingDishCount}`
                        : `کارٹ · ${stagingDishCount}`}
                    </div>
                    <div className="font-mono font-black text-blue-800 text-sm leading-tight">
                      Rs {roundMoney(stagingSubtotal).toLocaleString()}
                    </div>
                  </div>
                </>
              ) : stagingDishCount > 0 ? (
                <div className="col-span-full min-w-0">
                  <div className="text-[10px] font-semibold text-slate-500">
                    {language === "en" ? `Subtotal · ${stagingDishCount} dishes` : `سب ٹوٹل · ${stagingDishCount}`}
                  </div>
                  <div className="font-mono font-black text-slate-900 text-sm">
                    Rs {roundMoney(stagingSubtotal).toLocaleString()}
                  </div>
                </div>
              ) : null}

              {(stagingCostLines.length > 0 ||
                baselineCostLines.length > 0 ||
                (!awaitingNextKot && cartSubtotal > 0)) && (
                <>
                  {showSplitCogs ? (
                    <>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-slate-500">
                          {language === "en" ? "On bill COGS" : "بل لاگت"}
                        </div>
                        <div className="font-mono font-bold text-slate-800 text-sm">Rs {baselineCogs.toFixed(0)}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold text-blue-700">
                          {language === "en" ? "New lines COGS" : "نئی لاگت"}
                        </div>
                        <div className="font-mono font-bold text-blue-800 text-sm">Rs {stagingCogs.toFixed(0)}</div>
                      </div>
                    </>
                  ) : (
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-slate-500">
                        {language === "en" ? "COGS (est.)" : "لاگت"}
                      </div>
                      <div className="font-mono font-bold text-slate-800 text-sm">
                        Rs {estimatedIngredientCost.toFixed(0)}
                      </div>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-emerald-700">
                      {language === "en" ? "Profit (est.)" : "منافع"}
                    </div>
                    <div className="font-mono font-bold text-emerald-800 text-sm">
                      Rs {displayEstimatedProfit.toFixed(0)}
                    </div>
                  </div>
                </>
              )}

              <div className="min-w-0 flex flex-col gap-1 justify-center">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 block">{language === "en" ? "Discount" : "رعایت"}</div>
                  <input
                    type="number"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full border border-slate-200 h-7 text-right rounded px-1.5 text-sm font-bold font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 block">{language === "en" ? "Tax %" : "ٹیکس"}</div>
                  <input
                    type="number"
                    value={taxRate || ""}
                    onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full border border-slate-200 h-7 text-right rounded px-1.5 text-sm font-bold font-mono focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {posMode === "delivery" && (
                <div className="col-span-full flex items-center justify-between gap-2 min-w-0">
                  <div className="text-[10px] font-semibold text-slate-500 shrink-0">{language === "en" ? "Delivery" : "ڈیلیوری"}</div>
                  <input
                    type="number"
                    value={deliveryFee || ""}
                    onChange={(e) => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0"
                    className="w-full max-w-[8rem] border border-slate-200 h-8 text-right rounded px-1.5 text-sm font-mono"
                  />
                </div>
              )}

              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-slate-600">
                  {awaitingNextKot
                    ? language === "en"
                      ? "Next KOT total"
                      : "اگلا KOT"
                    : language === "en"
                      ? "Bill total"
                      : "کل بل"}
                </div>
                <div className="font-mono font-black text-slate-900 text-base leading-tight">
                  Rs {roundMoney(displayCartSubtotal).toLocaleString()}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold text-blue-800">
                  {awaitingNextKot
                    ? language === "en"
                      ? "New lines payable"
                      : "نئی لائنیں"
                    : language === "en"
                      ? "Net payable"
                      : "ادائیگی"}
                </div>
                <div className="font-mono font-black text-blue-700 text-base leading-tight">
                  Rs {roundMoney(displayNetTotal).toLocaleString()}
                </div>
              </div>

              {currentOrderStatus && (
                <p className="col-span-full text-[10px] text-slate-500 text-center py-0.5">
                  {language === "en" ? "Status:" : "اسٹیٹس:"}{" "}
                  {RESTAURANT_ORDER_STATUS_LABELS[currentOrderStatus]?.[language === "en" ? "en" : "ur"] ||
                    currentOrderStatus}
                </p>
              )}
              {resumeInvoiceId && (
                <p className="col-span-full text-[10px] text-violet-700 text-center">
                  {language === "en" ? "Bill edit - KOT saves version." : "بل ایڈٹ - KOT ورژن۔"}
                </p>
              )}

              <RestaurantPosPrinterStrip
                receiptSettings={receiptSettings}
                companyRow={companyDetails}
                language={language}
                categoryLabels={simpleKotCategoryLabels}
              />
              <label className="col-span-full flex items-center justify-between gap-2 cursor-pointer text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={printKitchenReceipt}
                    onChange={(e) => setPrintKitchenReceipt(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Print KOT
                </div>
                <Link href="/dashboard/settings" className="text-blue-600 hover:underline truncate">
                  {language === "en" ? "Printers" : "پرنٹر"}
                </Link>
              </label>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-1 pt-1">
              <Button
                onClick={sendKOT}
                disabled={isSubmittingKOT || cart.length === 0 || !!activeClosingBook}
                className="bg-slate-900 hover:bg-black text-white font-bold h-9 text-xs flex items-center justify-center gap-1 cursor-pointer shadow-none"
              >
                {isSubmittingKOT ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <ChefHat size={14} />}
                Send KOT
              </Button>
              <Button
                onClick={printGuestBill}
                disabled={
                  billingCart.length === 0 ||
                  !activeOrderInvoiceId ||
                  !canPrintGuestBill(currentOrderStatus) ||
                  !!activeClosingBook
                }
                variant="outline"
                className="font-bold h-9 text-xs border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1 cursor-pointer shadow-none"
              >
                <Printer size={14} />
                Table slip
              </Button>
            </div>

            {/* Payment → thermal receipt (not the unpaid slip above) */}
            <Button
              onClick={openSettleOrderModal}
              disabled={billingCart.length === 0 || !!activeClosingBook || !orderFlowSettleReady}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-600 text-white font-black h-9 text-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1 rounded-lg shadow-none"
            >
              <DollarSign size={16} />
              {orderFlowSettleReady
                ? language === "en"
                  ? `Pay Rs ${netTotal.toLocaleString()} - thermal receipt`
                  : `ادائیگی Rs ${netTotal.toLocaleString()} - تھرمل رسید`
                : language === "en"
                  ? "Pay & thermal receipt (print table slip first)"
                  : "ادائیگی + تھرمل (پہلے ٹیبل سلپ)"}
            </Button>

            {/* Split Bill Option */}
            <div className="flex justify-center pt-0.5">
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(true)}
                disabled={billingCart.length === 0 || !!activeClosingBook}
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer flex items-center gap-1 py-0.5"
              >
                <Users size={11} /> Split Bill Between Seats / Items
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customization Modal */}
      <AnimatePresence>
        {customizingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setCustomizingProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10 font-sans"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{customizingProduct.name}</h3>
                  <p className="text-[10px] text-slate-400">Base Price: Rs {customizingProduct.sale_price_single}</p>
                </div>
                <button onClick={() => setCustomizingProduct(null)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full">
                  <X size={18} />
                </button>
              </div>

              {/* Variations */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Size / Variation (سائز)</label>
                {productSizes.length > 0 && (
                  <p className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 mb-2">
                    {language === "en"
                      ? "This dish has sizes - base / Standard price is hidden. Pick a size (recipe & stock follow that size)."
                      : "سائز موجود - بیس قیمت نہیں۔ سائز چنیں، اسٹاک اُسی ریسپی سے۔"}
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {variationOptionsForPos(customizingProduct, productSizes).map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => {
                        setSelectedVariation({ name: v.name, priceAdd: v.priceAdd });
                        const row = productSizes.find((s) => s.size_name === v.name);
                        if (row) {
                          const crusts = parseCrustOptions((row as any).crust_options);
                          setSelectedCrust(crusts[0] || "Regular");
                        }
                      }}
                      className={`py-2 px-3 text-xs font-bold border rounded-xl capitalize transition-all ${
                        selectedVariation.name === v.name
                          ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      }`}
                    >
                      {v.name}
                      <div className="block text-[9px] font-mono opacity-80">
                        Rs {v.absolutePrice.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Crust / pizza variant */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Crust / Variant</label>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const row =
                      productSizes.find((s) => s.size_name === selectedVariation.name) ||
                      productSizes[0];
                    const parsed = row
                      ? parseCrustOptions((row as MenuSize & { crust_options?: string }).crust_options)
                      : [];
                    const choices = parsed.length ? parsed : [...CRUST_OPTIONS];
                    return choices.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCrust(c)}
                        className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border ${
                          selectedCrust === c
                            ? "bg-orange-50 border-orange-400 text-orange-800"
                            : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        {c}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* Bakery weight */}
              {(customizingProduct.unit?.toLowerCase().includes("kg") ||
                customizingProduct.name.toLowerCase().includes("cake") ||
                customizingProduct.name.toLowerCase().includes("sweet")) && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Weight (kg)</label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Math.max(0.05, parseFloat(e.target.value) || 0.05))}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Scale barcode supported on search (EAN-13 20…). Line total × weight.
                  </p>
                </div>
              )}

              {/* Add-ons / Toppings */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Extra Add-ons (ٹاپنگ)</label>
                <div className="grid grid-cols-2 gap-2">
                  {menuModifiers.map(addOn => {
                    const isSelected = selectedAddOns.some(a => a.name === addOn.name);
                    return (
                      <button
                        key={addOn.name}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAddOns(prev => prev.filter(a => a.name !== addOn.name));
                          } else {
                            setSelectedAddOns(prev => [...prev, addOn]);
                          }
                        }}
                        className={`py-2 px-3 text-left text-xs font-bold border rounded-xl capitalize transition-all flex justify-between items-center ${
                          isSelected
                            ? "bg-blue-50 text-blue-800 border-blue-400 shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        }`}
                      >
                        <div>{addOn.name}</div>
                        <div className="text-[10px] text-blue-600">
                          {addOn.priceAdd > 0 ? `+Rs ${addOn.priceAdd}` : "Free"}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Manage list in Menu → Add-ons / Modifiers
                </p>
                {selectedAddOns.length > 0 && (
                  <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/80 p-2 space-y-1">
                    <p className="text-[10px] font-bold text-blue-900 uppercase">Selected add-ons</p>
                    {selectedAddOns.map((a) => (
                      <div key={a.name} className="flex justify-between text-[11px] text-blue-800 font-semibold">
                        <div>+ {a.name}</div>
                        <div>{a.priceAdd > 0 ? `Rs ${a.priceAdd}` : "Free"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Special Instructions */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Special Instructions (ہدایات)</label>
                <input
                  type="text"
                  placeholder="e.g. less spicy, no onions, extra mayo"
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 h-9 rounded-xl px-3 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                {/* Fast tags */}
                <div className="flex flex-wrap gap-1.5">
                  {["Less Spicy", "Extra Spicy", "No Onion", "Well Cooked"].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSpecialInstructions(prev => {
                          const trim = prev.trim();
                          if (trim.toLowerCase().includes(tag.toLowerCase())) return prev;
                          return trim ? `${trim}, ${tag}` : tag;
                        });
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-600 rounded-lg font-bold transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add to Cart Actions */}
              <div className="flex gap-2 border-t border-slate-100 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCustomizingProduct(null)}
                  className="flex-1 border-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!customizingProduct) return;
                    const useWeight =
                      customizingProduct.unit?.toLowerCase().includes("kg") ||
                      customizingProduct.name.toLowerCase().includes("cake") ||
                      customizingProduct.name.toLowerCase().includes("sweet");
                    const qtyFactor = useWeight ? weightKg : 1;
                    const unitBase =
                      unitSalePriceForVariation(customizingProduct, productSizes, selectedVariation.name) +
                      selectedAddOns.reduce((sum, a) => sum + a.priceAdd, 0);
                    const finalPrice = unitBase * qtyFactor;
                    const fullName =
                      productSizes.length > 0
                        ? buildCustomizedLineName(
                            customizingProduct.name,
                            selectedVariation.name,
                            selectedCrust,
                            weightKg,
                            useWeight
                          )
                        : customizingProduct.name;
                    const remarksStr = buildKitchenRemarks(
                      selectedCrust,
                      selectedAddOns,
                      specialInstructions
                    );

                    const varOpt =
                      variationOptionsForPos(customizingProduct, productSizes).find(
                        (o) => o.name === selectedVariation.name
                      ) || variationOptionsForPos(customizingProduct, productSizes)[0];
                    const matchedSize =
                      productSizes.find((s) => s.size_name === selectedVariation.name) ||
                      productSizes[0];

                    addCustomizedToCart(customizingProduct, fullName, finalPrice, remarksStr, {
                      sizeLabel: productSizes.length > 0 ? selectedVariation.name : undefined,
                      menuSizeId:
                        productSizes.length > 0
                          ? varOpt?.menuSizeId ?? matchedSize?.id ?? null
                          : null,
                      crust: selectedCrust,
                      addOns: [...selectedAddOns],
                    });
                    setCustomizingProduct(null);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Add to Cart • Rs {(
                    (unitSalePriceForVariation(customizingProduct, productSizes, selectedVariation.name) +
                      selectedAddOns.reduce((sum, a) => sum + a.priceAdd, 0)) *
                    (customizingProduct.unit?.toLowerCase().includes("kg") ||
                    customizingProduct.name.toLowerCase().includes("cake") ||
                    customizingProduct.name.toLowerCase().includes("sweet")
                      ? weightKg
                      : 1)
                  ).toLocaleString()}
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Guest Receipt Modal */}
      <AnimatePresence>
        {showReceiptModal && lastInvoice && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowReceiptModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md relative z-10 font-sans"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-slate-800 text-base">Guest Invoice Receipt</h3>
                <button onClick={() => setShowReceiptModal(false)} className="text-slate-400 hover:text-slate-655">
                  <X size={18} />
                </button>
              </div>

              {/* Receipt Body (Simulated Print Sheet) */}
              <div className="bg-slate-100 p-2 rounded-2xl border border-slate-200/50 max-h-[460px] overflow-y-auto flex items-start justify-center custom-scrollbar w-full mb-4">
                <div id="guest-invoice-print-container" className="bg-white shadow-sm rounded-md">
                  <ReceiptTemplate 
                    settings={receiptSettings} 
                    invoice={{
                      id: lastInvoice.invoice.id,
                      created_at: lastInvoice.invoice.created_at,
                      customer_name: lastInvoice.customer_name,
                      payment_mode: lastInvoice.paymentMode,
                      received_amount: Number(lastInvoice.paidAmount),
                      tax_amount: 0,
                      discount: 0,
                      total_amount: lastInvoice.netTotal,
                      remaining_due: lastInvoice.remainingDue,
                      items: lastInvoice.items.map((item: any) => ({
                        name: item.product.name,
                        quantity: item.quantity,
                        price: item.price,
                        packingName: item.product.measurement_type,
                        subtotal: item.subtotal
                      }))
                    }}
                    shopDetails={{
                      name: companyDetails?.name || shopName || "Restaurant",
                      phone: companyDetails?.phone || undefined,
                      address: companyDetails?.address || undefined,
                      email: companyDetails?.email || undefined,
                      website: companyDetails?.website || undefined
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handlePrintGuestReceipt}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1"
                >
                  <Printer size={15} /> Print Slip
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReceiptModal(false)}
                  className="text-slate-700 font-bold border-slate-200"
                >
                  Close Desk
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Split Bill Modal */}
      <AnimatePresence>
        {isSplitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-200 relative shadow-2xl"
            >
              <button 
                onClick={() => setIsSplitModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-655"
              >
                <X size={18} />
              </button>

              <h3 className="font-black text-slate-800 text-sm mb-3">Restaurant Table Bill Splitting</h3>
              <p className="text-[10.5px] text-slate-450 font-semibold mb-4 leading-normal">
                Split Rs {netTotal.toLocaleString()} - equal seats or by selected cart items.
              </p>

              <div className="space-y-4 text-xs font-bold text-slate-655">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitMode("equal")}
                    className={`flex-1 h-9 rounded-xl border text-[11px] font-bold ${
                      splitMode === "equal" ? "bg-slate-900 text-white" : "bg-white"
                    }`}
                  >
                    Equal seats
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("items")}
                    className={`flex-1 h-9 rounded-xl border text-[11px] font-bold ${
                      splitMode === "items" ? "bg-slate-900 text-white" : "bg-white"
                    }`}
                  >
                    By items
                  </button>
                </div>

                {splitMode === "equal" ? (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Number of Shares (seats)</label>
                  <select
                    value={splitCount}
                    onChange={e => setSplitCount(parseInt(e.target.value, 10))}
                    className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-xs focus:outline-none cursor-pointer"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} Persons (Rs {Math.round(netTotal / n).toLocaleString()} each)</option>
                    ))}
                  </select>
                </div>
                ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-xl p-2">
                  {cart.map((c) => {
                    const on = splitItemIds.includes(c.cartItemId);
                    return (
                      <button
                        key={c.cartItemId}
                        type="button"
                        onClick={() =>
                          setSplitItemIds((prev) =>
                            on ? prev.filter((id) => id !== c.cartItemId) : [...prev, c.cartItemId]
                          )
                        }
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] border ${
                          on ? "bg-violet-50 border-violet-300" : "bg-white"
                        }`}
                      >
                        {c.name} ×{c.quantity} - Rs {(c.price * c.quantity).toLocaleString()}
                      </button>
                    );
                  })}
                </div>
                )}

                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                  <div className="flex justify-between items-center text-xs font-black">
                    <div className="text-slate-500">
                      {splitMode === "equal" ? "Per Share Payment:" : "Selected items:"}
                    </div>
                    <div className="text-blue-700 text-sm">
                      Rs{" "}
                      {splitMode === "equal"
                        ? Math.round(netTotal / splitCount).toLocaleString()
                        : cart
                            .filter((c) => splitItemIds.includes(c.cartItemId))
                            .reduce((s, c) => s + c.price * c.quantity, 0)
                            .toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <Button
                    onClick={handleConfirmSplit}
                    disabled={isProcessingSplit}
                    className="flex-1 bg-purple-650 hover:bg-purple-700 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
                  >
                    {isProcessingSplit ? <Loader2 className="animate-spin h-4 w-4" /> : "Confirm Split & Cash"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SettleOrderDialog
        open={isSettleModalOpen}
        order={settleOrderData}
        onClose={() => setIsSettleModalOpen(false)}
        onSettled={handleSettled}
        receiptSettings={receiptSettings}
        shopDetails={companyRowToShopDetails(companyDetails, shopName)}
      />

      <WaiterNotificationsDialog
        open={waiterDialogOpen}
        onClose={() => setWaiterDialogOpen(false)}
      />

      {dealToConfigure && (
        <DealConfigureModal
          deal={dealToConfigure}
          onClose={() => setDealToConfigure(null)}
          onConfirm={(payload) => {
            addDealToCart(payload);
            setDealToConfigure(null);
          }}
        />
      )}
    </div>
  );
}
