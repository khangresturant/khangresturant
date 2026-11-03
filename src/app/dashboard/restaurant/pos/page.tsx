"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, ShoppingCart, UserPlus, Trash2, Plus, Minus, 
  Check, X, Printer, Loader2, DollarSign, ArrowRight, ArrowLeft,
  Store, Utensils, Coffee, Users, Layers, MessageSquare, ChefHat, Menu,
  ClipboardList, Receipt, Bell, Tag, RefreshCw
} from "lucide-react";
import { RestaurantDealsTab } from "@/components/restaurant/RestaurantDealsTab";
import { SettleOrderDialog, type SettleOrderData } from "@/components/restaurant/SettleOrderDialog";
import { WaiterNotificationsDialog, useWaiterNotificationCount } from "@/components/restaurant/WaiterNotificationsDialog";
import type { MenuSize } from "@/lib/restaurant-deals";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { ReceiptTemplate, DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import { printReceiptDirect } from "@/lib/thermalPrinter";
import {
  type RestaurantOrderStatus,
  RESTAURANT_ORDER_STATUS_LABELS,
  canPrintGuestBill,
  canSettleOrder,
  markBillPrinted,
  generateDailyOrderNumber,
  normalizeOrderStatus,
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
  buildCustomizedLineName,
  buildKitchenRemarks,
  resolveDefaultVariation,
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
  crust?: string;
  addOns?: CartAddOnLine[];
};

export default function RestaurantPOSPage() {
  const { shopId, userId, shopName, shopLogo, activeClosingBook, defaultTaxRate, defaultTaxType } = useShop();
  const { t, language } = useLanguage();
  const supabase = createClient();

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
  const [leftPosTab, setLeftPosTab] = useState<"menu" | "deals" | "history">("menu");
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

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const percentDiscountAmount = (cartSubtotal * discountPercent) / 100;
  const effectiveDiscount = Math.max(discount, percentDiscountAmount);
  const taxAmount = taxType === "flat" ? taxRate : (cartSubtotal * taxRate) / 100;
  const netTotal = Math.max(
    0,
    cartSubtotal + taxAmount - effectiveDiscount + deliveryFee + additionalCharges + tipAmount
  );

  const activeOrderInvoiceId =
    posMode === "dining" ? selectedTable?.active_invoice_id ?? null : takeawayInvoiceId;
  const orderFlowSettleReady =
    Boolean(activeOrderInvoiceId) && canSettleOrder(currentOrderStatus);

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

        // 2. Products (no kitchen_station_id — column may be missing until P1 SQL)
        supabase
          .from("products")
          .select("id, name, unit, sale_price_single, purchase_price_single, current_stock, category_id, is_ingredient, kitchen_station_id")
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
          .select("id, name, role")
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
          toast.message(`${queued.length} offline takeaway draft(s) ready — open cart and process when staffed`);
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
        if (productsRes.error.message.includes("is_ingredient") || productsRes.error.hint?.includes("is_ingredient")) {
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
          (p: any) => p.is_ingredient !== true && String(p.is_ingredient) !== "true"
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

      // --- Process Print Settings ---
      if (!printRes.error && printRes.data) {
        setReceiptSettings(printRes.data);
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
              product_id,
              quantity,
              unit_price,
              products ( name, purchase_price_single )
            )
          `)
          .eq("id", table.active_invoice_id)
          .single();

        if (invData) {
          const loadedCart: CartItem[] = (invData.invoice_items || []).map((it: any, index: number) => ({
            cartItemId: it.id || `${it.product_id || "item"}-${index}-${Date.now()}`,
            productId: it.product_id,
            name: it.products?.name || "Unknown Item",
            price: Number(it.unit_price),
            purchasePrice: Number(it.products?.purchase_price_single || 0),
            quantity: Number(it.quantity),
            remarks: it.remarks || ""
          }));

          setCart(loadedCart);
          setDbItems(JSON.parse(JSON.stringify(loadedCart)));
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
          remarks: ""
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
    meta?: { sizeLabel?: string; crust?: string; addOns?: CartAddOnLine[] }
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
        crust: meta?.crust,
        addOns: meta?.addOns?.length ? meta.addOns : undefined,
      }];
    });
  };

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
  }) => {
    setCart((prev) => [...prev, { ...item, cartItemId: item.cartItemId }]);
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
          ? "Tip: select a table for seating — KOT can still go to kitchen."
          : "ٹیبل منتخب کریں — KOT پھر بھی کچن میں جائے گا۔"
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
        toast.message("No rider selected", {
          description: "You can still send KOT — assign a rider before settle.",
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
        toast.success("Takeaway saved offline — will sync when online");
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
      // 1. Compute incremental KOT items
      const kotItems = cart.map(item => {
        const dbQty = dbItems.find(d => d.cartItemId === item.cartItemId)?.quantity || 0;
        const diffQty = item.quantity - dbQty;
        if (diffQty > 0) {
          return {
            product_id: item.productId,
            name: item.name,
            quantity: diffQty,
            remarks: item.remarks
          };
        }
        return null;
      }).filter(Boolean) as any[];

      if (kotItems.length === 0) {
        toast.info("No new items or quantities added since last KOT.");
        setIsSubmittingKOT(false);
        return;
      }

      let activeInvoiceId = posMode === "dining" 
        ? (selectedTable?.active_invoice_id || null) 
        : takeawayInvoiceId;

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
            waiter_id: selectedWaiterId ? selectedWaiterId : null,
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

      setCurrentOrderStatus("preparing");

      // 5. Sync all items to invoice_items
      if (activeInvoiceId) {
        // Clear previous items
        await supabase.from("invoice_items").delete().eq("invoice_id", activeInvoiceId);

        // Insert current items
        const invoiceItems = cart.map(item => ({
          invoice_id: activeInvoiceId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.price,
          subtotal: item.price * item.quantity
        }));

        await supabase.from("invoice_items").insert(invoiceItems);

        // Update invoice total
        await supabase
          .from("invoices")
          .update({
            total_amount: netTotal,
            tax_amount: taxAmount,
            discount: effectiveDiscount,
            discount_percentage: discountPercent,
            tax_rate: taxRate,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            customer_address: customerAddress || null,
            delivery_fee: posMode === "delivery" ? deliveryFee : 0,
            additional_charges: additionalCharges + tipAmount,
            special_instructions: orderSpecialInstructions || null,
          })
          .eq("id", activeInvoiceId);
      }

      // 6. Print KOT Slip
      if (printKitchenReceipt) {
        printKOTSlip(kotItems);
      }

      // 7. Sync local DBItems
      setDbItems(JSON.parse(JSON.stringify(cart)));
      toast.success(
        language === "en"
          ? `KOT sent to kitchen — open Kitchen KDS (top bar) to see tickets.`
          : "KOT کچن میں — اوپر Kitchen KDS کھولیں۔"
      );
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
        toast.success(`Item split settled — Rs ${shareTotal.toLocaleString()}`);
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

  // Kitchen Slip Printer (Iframe print method)
  const printKOTSlip = (items: any[]) => {
    let iframe = document.getElementById("restaurant-kot-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "restaurant-kot-iframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const paperWidth = receiptSettings?.pageSize === "MM58" ? "58mm" : "80mm";

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>KOT Ticket</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { margin: 0; }
            body {
              width: ${paperWidth};
              font-family: monospace;
              padding: 10px;
              font-size: 13px;
              color: black;
              background: white;
            }
          </style>
        </head>
        <body>
          <div class="text-center font-bold border-b border-dashed border-slate-400 pb-2 mb-2">
            <h2 class="text-base uppercase tracking-wider">Kitchen Order Ticket</h2>
            <p class="text-xs mt-0.5">${selectedTable?.name || "Takeaway"}</p>
            <p class="text-[10px] font-normal mt-0.5">${new Date().toLocaleString()}</p>
          </div>
          <table class="w-full text-left mb-2">
            <thead>
              <tr class="border-b border-slate-300 font-bold text-xs uppercase">
                <th class="py-1">Item</th>
                <th class="py-1 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => `
                <tr class="border-b border-slate-100 font-black">
                  <td class="py-1.5">
                    <div>${it.name}</div>
                    ${it.remarks ? `<div class="text-[10px] text-slate-600 font-normal italic">Notes: ${it.remarks}</div>` : ""}
                  </td>
                  <td class="py-1.5 text-right font-mono">${it.quantity}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="border-t border-dashed border-slate-400 pt-2 text-center text-[10px] font-bold">
            ** KOT DISPATCHED **
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  // Print Guest Bill (before settlement — no payment recorded)
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

      let iframe = document.getElementById("guest-bill-preview-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "guest-bill-preview-iframe";
        iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const paperWidth = receiptSettings?.pageSize === "MM58" ? "58mm" : "80mm";
      doc.open();
      doc.write(`
        <html><head><title>Guest Bill</title>
        <style>@page{margin:0}body{width:${paperWidth};font-family:monospace;padding:10px;font-size:12px}</style>
        </head><body>
        <div style="text-align:center;border-bottom:1px dashed #999;padding-bottom:8px;margin-bottom:8px">
          <h2 style="margin:0;font-size:14px">${shopName || "Restaurant"}</h2>
          <p style="margin:4px 0;font-size:10px">GUEST BILL (UNPAID)</p>
          <p style="margin:0;font-size:10px">${selectedTable?.name || posMode.toUpperCase()} · ${new Date().toLocaleString()}</p>
        </div>
        <table style="width:100%;border-collapse:collapse">
        ${cart.map(it => `<tr><td style="padding:3px 0">${it.quantity}x ${it.name}</td><td style="text-align:right">Rs ${(it.price * it.quantity).toLocaleString()}</td></tr>`).join("")}
        </table>
        <div style="border-top:1px dashed #999;margin-top:8px;padding-top:8px;font-weight:bold;display:flex;justify-content:space-between">
          <span>NET PAYABLE</span><span>Rs ${netTotal.toLocaleString()}</span>
        </div>
        <p style="text-align:center;font-size:9px;margin-top:12px">** NOT A TAX INVOICE — PAY AT COUNTER **</p>
        <script>window.onload=function(){window.focus();window.print()}</script>
        </body></html>
      `);
      doc.close();
      toast.success(language === "en" ? "Guest bill printed — mark paid in Order History." : "بل پرنٹ — Order History سے ادائیگی کریں۔");
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
    if (p.category_id && rawCatIds.includes(p.category_id)) return false;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategoryId === "all" || p.category_id === selectedCategoryId;
    return matchesSearch && matchesCat;
  });

  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleOrderData, setSettleOrderData] = useState<SettleOrderData | null>(null);

  const openSettleOrderModal = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty.");
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
          ? "Send KOT to kitchen first — payment comes after the guest bill is printed."
          : "پہلے KOT بھیجیں — ادائیگی بل پرنٹ کے بعد۔"
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
          : "کچن ٹکٹ نہیں — پہلے KOT بھیجیں۔"
      );
      return;
    }

    if (!canSettleOrder(currentOrderStatus)) {
      toast.error(
        language === "en"
          ? "Flow: Send KOT → kitchen → Print Bill → then Settle & Pay (stock updates on payment)."
          : "ترتیب: KOT → کچن → بل پرنٹ → پھر ادائیگی۔"
      );
      return;
    }

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
      invoice_items: cart.map((c) => ({
        product_id: c.productId,
        quantity: c.quantity,
        unit_price: c.price,
      })),
      line_items: cart.map((c) => ({
        name: c.name,
        quantity: c.quantity,
        unit_price: c.price,
      })),
      customer_name: customerName || null,
    });
    setIsSettleModalOpen(true);
  };

  const handleSettled = async () => {
    toast.success("Payment received & order settled!");
    setCart([]);
    setDbItems([]);
    setSelectedTable(null);
    setTakeawayInvoiceId(null);
    setCurrentOrderStatus(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
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

  const loadRecentOrders = async () => {
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
            products ( name )
          )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!error && data) {
        setRecentOrders(data);
      }
    } catch (e) {
      console.error("Error loading recent orders:", e);
    } finally {
      setLoadingRecentOrders(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center bg-slate-50 w-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const totalCartItemCount = cart.reduce((sum, it) => sum + it.quantity, 0);

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
                <span className="text-white font-extrabold text-[10px]">HX</span>
              </div>
              <span className="font-extrabold text-xs tracking-tight text-white/90">Restaurant POS Desk</span>
            </div>
          )}
        </div>

        {/* Right side toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {orderNumber && (
            <span className="text-[10px] font-mono font-bold bg-zinc-800 px-2 py-0.5 rounded text-amber-400">
              #{orderNumber}
            </span>
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
          <Link href="/dashboard/restaurant/active-bills">
            <Button variant="ghost" className="text-zinc-300 hover:text-white text-[11px] h-7 px-2 font-bold hover:bg-zinc-900">
              <Receipt size={12} className="mr-1" /> Bills
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
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {waiterBadgeCount}
              </span>
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
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        {selectedTable ? `Selected: ${selectedTable.name}` : "Seating Tables"}
                      </span>
                      {selectedTable && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          selectedTable.status === "available"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : selectedTable.status === "occupied"
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}>
                          {selectedTable.status}
                        </span>
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
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              isSelected ? "bg-white" : isOccupied ? "bg-rose-500" : isAvailable ? "bg-emerald-500" : "bg-amber-500"
                            }`} />
                            <span>{table.name}</span>
                            <span className={`text-[9px] font-normal ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                              ({table.capacity}p)
                            </span>
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
                          .map((it: any) => `${it.quantity}x ${it.products?.name || "Item"}`)
                          .join(", ");
                        const isPaid = ord.status === "paid" || ord.restaurant_order_status === "settled";

                        return (
                          <div
                            key={ord.id || idx}
                            className="bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-xs text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                  #{ord.order_number || ord.id.slice(0, 8).toUpperCase()}
                                </span>
                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  isPaid
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}>
                                  {ord.restaurant_order_status || ord.status}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500">
                                  {ord.service_type === "dining" ? `🍽️ Table: ${ord.restaurant_tables?.name || ord.table_id || "Dine-In"}` : ord.service_type === "delivery" ? "🛵 Delivery" : "🥡 Takeaway"}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 truncate max-w-md mt-1">
                                {itemsSummary || "No items"}
                              </p>
                              <span className="text-[9px] text-slate-400">
                                {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {ord.parties?.name || ord.customer_name || "Walk-in"}
                              </span>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                              <span className="font-black text-slate-900 text-xs font-mono">
                                Rs {Number(ord.total_amount || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : leftPosTab === "deals" ? (
                <div className="flex-1 overflow-y-auto">
                  <RestaurantDealsTab onAddDeal={addDealToCart} />
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
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                                    {catName}
                                  </span>
                                  <span className="text-[9px] font-medium text-slate-400 font-mono">
                                    Stock: {p.current_stock}
                                  </span>
                                </div>
                                <h4 className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                                  {p.name}
                                </h4>
                              </div>

                              <div className="flex justify-between items-center w-full pt-1 border-t border-slate-100">
                                <span className="text-xs font-black text-blue-700 font-mono">
                                  Rs {Number(p.sale_price_single).toLocaleString()}
                                </span>
                                <span className="bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white p-1 rounded-lg transition-colors flex items-center justify-center">
                                  <Plus size={13} />
                                </span>
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
                <span>View Cart ({totalCartItemCount})</span>
                <span className="font-mono bg-blue-700 px-2 py-0.5 rounded-full text-[10px]">Rs {cartSubtotal}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Right Sidebar Cart Panel — Fixed Height & Dedicated Scroll */}
        <div className={`w-full md:w-[410px] h-full flex flex-col bg-white border-l border-slate-200 shadow-xl overflow-hidden shrink-0 ${showMobileCart ? "flex" : "hidden md:flex"}`}>
          {/* Cart Header */}
          <div className="p-3 border-b border-slate-200 shrink-0 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileCart(false)}
                className="md:hidden text-slate-300 hover:text-white p-1 mr-1 h-auto flex items-center gap-0.5"
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                <ShoppingCart size={16} />
              </div>
              <div>
                <h3 className="font-black text-white text-xs tracking-wide">
                  {posMode === "dining" ? (selectedTable ? `Table: ${selectedTable.name}` : "Dine-In Cart") : posMode === "delivery" ? "Delivery Cart" : "Takeaway Cart"}
                </h3>
                <span className="text-[10px] text-slate-300 font-semibold">
                  {totalCartItemCount} {totalCartItemCount === 1 ? "dish" : "dishes"} selected
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Clear all items from current cart?")) {
                    setCart([]);
                    setDbItems([]);
                    setSelectedTable(null);
                    setTakeawayInvoiceId(null);
                    setCurrentOrderStatus(null);
                    setCustomerName("");
                    setCustomerPhone("");
                    setCustomerAddress("");
                  }
                }}
                className="text-rose-400 hover:text-rose-200 hover:bg-slate-800 text-[10px] font-bold p-1 h-auto cursor-pointer"
              >
                Clear Cart
              </Button>
            )}
          </div>

          {/* Compact Customer & Waiter Bar with Toggle */}
          <div className="p-2 border-b border-slate-200 shrink-0 bg-slate-50/80">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                <span className="font-bold text-slate-800 truncate">
                  👤 {customerName || (selectedCustomerId === "walkin" ? "Walk-in Guest" : customers.find(c => c.id === selectedCustomerId)?.name || "Guest")}
                </span>
                {posMode === "dining" && selectedWaiterId && (
                  <span className="text-[10px] text-slate-500 truncate">
                    · 👨‍🍳 {staff.find(s => s.id === selectedWaiterId)?.name || "Waiter"}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-0.5 shrink-0"
              >
                {showCustomerDetails ? "Hide Info ▲" : "Edit Info ▼"}
              </button>
            </div>

            {/* Expandable Inputs */}
            {showCustomerDetails && (
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Guest / Khata</span>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
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
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Waiter</span>
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
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Rider</span>
                      <select
                        value={selectedRiderId}
                        onChange={(e) => setSelectedRiderId(e.target.value)}
                        className="w-full bg-white border border-slate-200 h-7 rounded-lg px-1.5 text-[11px] focus:outline-none cursor-pointer"
                      >
                        <option value="">No Rider Assigned</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
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

          {/* Cart Item Rows — Primary Scrollable Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 bg-slate-50/40">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <ShoppingCart size={36} className="mb-2 text-slate-300 animate-bounce" />
                <p className="text-xs font-bold text-slate-700">Your cart is empty</p>
                <p className="text-[10px] mt-0.5 text-slate-400 text-center max-w-[200px]">
                  Click on any food dish or beverage on the left to add it to this order.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const dbQty = dbItems.find(d => d.cartItemId === item.cartItemId)?.quantity || 0;
                const isNew = item.quantity > dbQty;
                const itemKey = item.cartItemId || `cart-item-${item.productId || "dish"}-${idx}`;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={itemKey} 
                    className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm relative"
                  >
                    {isNew && (
                      <span className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-1 py-0.2 rounded">
                        NEW
                      </span>
                    )}

                    <div className="flex justify-between items-start gap-1 pr-7">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 font-mono mr-1">#{idx + 1}</span>
                        <span className="font-bold text-slate-900 text-xs">{item.name}</span>
                        {item.addOns && item.addOns.length > 0 && (
                          <ul className="mt-1 space-y-0.5 pl-1">
                            {item.addOns.map((a) => (
                              <li
                                key={`${item.cartItemId}-${a.name}`}
                                className="flex justify-between gap-2 text-[10px] text-emerald-800 font-semibold"
                              >
                                <span className="truncate">+ {a.name}</span>
                                <span className="shrink-0 font-mono">
                                  {a.priceAdd > 0 ? `Rs ${a.priceAdd}` : "Free"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <span className="font-black text-slate-900 text-xs font-mono shrink-0">
                        Rs {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>

                    {/* Quantity controls & Unit Price */}
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                      <span className="text-[10px] text-slate-500 font-mono font-medium">
                        Rs {item.price.toLocaleString()} each
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center border border-slate-200 bg-slate-50 rounded-lg p-0.5 shadow-inner">
                          <button
                            onClick={() => updateCartQty(item.cartItemId, item.quantity - 1)}
                            className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-700 cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-7 text-center text-xs font-black font-mono text-slate-900">{item.quantity}</span>
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

                    {/* Remarks / Chef Notes input */}
                    <div className="mt-1.5 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                      <MessageSquare size={10} className="text-slate-400 shrink-0" />
                      <input
                        placeholder="Kitchen note (crust, add-ons sync here on add)"
                        value={item.remarks}
                        onChange={(e) => updateCartRemarks(item.cartItemId, e.target.value)}
                        className="w-full bg-transparent text-[10px] font-medium placeholder-slate-400 focus:outline-none"
                      />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Pricing Summary & Checkout Action Buttons */}
          <div className="border-t border-slate-200 p-3 space-y-1.5 bg-white shrink-0 shadow-lg">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Subtotal:</span>
              <span className="font-mono">Rs {cartSubtotal.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600">
              <span className="font-medium">Discount (Rs):</span>
              <input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="0"
                className="w-16 bg-slate-50 border border-slate-200 h-6 text-right rounded px-1.5 text-xs font-bold text-slate-800 font-mono focus:outline-none"
              />
            </div>

            {posMode === "delivery" && (
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span className="font-medium">Delivery Fee:</span>
                <input
                  type="number"
                  value={deliveryFee || ""}
                  onChange={(e) => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-16 bg-slate-50 border border-slate-200 h-6 text-right rounded px-1.5 text-xs font-bold font-mono"
                />
              </div>
            )}

            <div className="flex justify-between items-center text-xs text-slate-600">
              <span className="font-medium">Tax (%):</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={taxRate || ""}
                  onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0"
                  className="w-12 bg-slate-50 border border-slate-200 h-6 text-right rounded px-1 text-xs font-bold text-slate-800 font-mono focus:outline-none"
                />
                <span className="text-[10px] font-bold text-slate-500">%</span>
              </div>
            </div>

            <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-1.5">
              <span>Net Payable:</span>
              <span className="font-mono text-blue-700 text-base">Rs {netTotal.toLocaleString()}</span>
            </div>

            {/* Action Buttons Grid */}
            <p className="text-[10px] text-slate-500 leading-snug pt-0.5">
              {language === "en"
                ? "KOT → kitchen → optional table slip → Pay = thermal payment receipt"
                : "KOT → کچن → (اختیاری سلپ) → ادائیگی = تھرمل رسید"}
              {currentOrderStatus && (
                <span className="ml-1 font-semibold text-slate-600">
                  ·{" "}
                  {RESTAURANT_ORDER_STATUS_LABELS[currentOrderStatus]?.en ||
                    currentOrderStatus}
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Button
                onClick={sendKOT}
                disabled={isSubmittingKOT || cart.length === 0 || !!activeClosingBook}
                className="bg-slate-900 hover:bg-black text-white font-bold h-10 text-xs shadow-sm flex items-center justify-center gap-1 cursor-pointer"
              >
                {isSubmittingKOT ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <ChefHat size={14} />}
                Send KOT
              </Button>
              <Button
                onClick={printGuestBill}
                disabled={
                  cart.length === 0 ||
                  !activeOrderInvoiceId ||
                  !canPrintGuestBill(currentOrderStatus) ||
                  !!activeClosingBook
                }
                variant="outline"
                className="font-bold h-10 text-xs border-slate-300 hover:bg-slate-100 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer size={14} />
                Table slip (unpaid)
              </Button>
            </div>

            {/* Payment → thermal receipt (not the unpaid slip above) */}
            <Button
              onClick={openSettleOrderModal}
              disabled={cart.length === 0 || !!activeClosingBook || !orderFlowSettleReady}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-600 text-white font-black h-11 text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-1 rounded-xl"
            >
              <DollarSign size={16} />
              {orderFlowSettleReady
                ? language === "en"
                  ? `Pay Rs ${netTotal.toLocaleString()} — thermal receipt`
                  : `ادائیگی Rs ${netTotal.toLocaleString()} — تھرمل رسید`
                : language === "en"
                  ? "Pay & thermal receipt (print table slip first)"
                  : "ادائیگی + تھرمل (پہلے ٹیبل سلپ)"}
            </Button>

            {/* Split Bill Option */}
            <div className="flex justify-center pt-0.5">
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(true)}
                disabled={cart.length === 0 || !!activeClosingBook}
                className="text-[10.5px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer flex items-center gap-1 py-0.5"
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(productSizes.length > 0
                    ? productSizes.map((s) => ({
                        name: s.size_name,
                        priceAdd: Number(s.price) - customizingProduct.sale_price_single,
                        absolutePrice: Number(s.price),
                      }))
                    : [
                        { name: "Small", priceAdd: -Math.round(customizingProduct.sale_price_single * 0.15), absolutePrice: 0 },
                        { name: "Medium", priceAdd: 0, absolutePrice: customizingProduct.sale_price_single },
                        { name: "Large", priceAdd: Math.round(customizingProduct.sale_price_single * 0.25), absolutePrice: 0 },
                        { name: "XL", priceAdd: Math.round(customizingProduct.sale_price_single * 0.5), absolutePrice: 0 },
                      ]
                  ).map((v) => (
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
                      <span className="block text-[9px] font-mono opacity-80">
                        Rs {(v.absolutePrice || customizingProduct.sale_price_single + v.priceAdd).toLocaleString()}
                      </span>
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
                        <span>{addOn.name}</span>
                        <span className="text-[10px] text-blue-600">
                          {addOn.priceAdd > 0 ? `+Rs ${addOn.priceAdd}` : "Free"}
                        </span>
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
                        <span>+ {a.name}</span>
                        <span>{a.priceAdd > 0 ? `Rs ${a.priceAdd}` : "Free"}</span>
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
                      customizingProduct.sale_price_single +
                      selectedVariation.priceAdd +
                      selectedAddOns.reduce((sum, a) => sum + a.priceAdd, 0);
                    const finalPrice = unitBase * qtyFactor;
                    const fullName = buildCustomizedLineName(
                      customizingProduct.name,
                      selectedVariation.name,
                      selectedCrust,
                      weightKg,
                      useWeight
                    );
                    const remarksStr = buildKitchenRemarks(
                      selectedCrust,
                      selectedAddOns,
                      specialInstructions
                    );

                    addCustomizedToCart(customizingProduct, fullName, finalPrice, remarksStr, {
                      sizeLabel: selectedVariation.name,
                      crust: selectedCrust,
                      addOns: [...selectedAddOns],
                    });
                    setCustomizingProduct(null);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Add to Cart • Rs {(
                    (customizingProduct.sale_price_single +
                      selectedVariation.priceAdd +
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
                Split Rs {netTotal.toLocaleString()} — equal seats or by selected cart items.
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
                        {c.name} ×{c.quantity} — Rs {(c.price * c.quantity).toLocaleString()}
                      </button>
                    );
                  })}
                </div>
                )}

                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span className="text-slate-500">
                      {splitMode === "equal" ? "Per Share Payment:" : "Selected items:"}
                    </span>
                    <span className="text-blue-700 text-sm">
                      Rs{" "}
                      {splitMode === "equal"
                        ? Math.round(netTotal / splitCount).toLocaleString()
                        : cart
                            .filter((c) => splitItemIds.includes(c.cartItemId))
                            .reduce((s, c) => s + c.price * c.quantity, 0)
                            .toLocaleString()}
                    </span>
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
        shopDetails={{
          name: companyDetails?.name || shopName || "Flame 9 Pizza House & Café",
          phone: companyDetails?.phone,
          address: companyDetails?.address,
          email: companyDetails?.email,
        }}
      />

      <WaiterNotificationsDialog
        open={waiterDialogOpen}
        onClose={() => setWaiterDialogOpen(false)}
      />
    </div>
  );
}
