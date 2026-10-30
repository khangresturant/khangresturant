"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, ShoppingCart, UserPlus, Trash2, Plus, Minus, 
  CreditCard, Check, X, Printer, Loader2, DollarSign, ArrowRight,
  Store, Lock, Unlock, LogOut, Calculator, AlertTriangle,
  ChevronLeft, ChevronRight, Menu, LayoutGrid, Zap
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { ReceiptTemplate, DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";

const PAGE_SIZE = 20;

type DBProduct = {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  sale_price_single: number;
  purchase_price_single: number;
  current_stock: number;
  category_id?: string | null;
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
};

type Party = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
};

type Category = {
  id: string;
  name: string;
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

export default function POSPage() {
  const { shopId, userId, userName, shopName, industryType, permissions, allowNegativeStock } = useShop();
  const { language, setLanguage } = useLanguage();
  const supabase = createClient();

  const [products, setProducts] = useState<DBProduct[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Register Session states
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isCloseRegisterOpen, setIsCloseRegisterOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState<string>("");
  const [actualCashCounted, setActualCashCounted] = useState<number>(0);
  const [closingNote, setClosingNote] = useState<string>("");
  const [shiftInvoices, setShiftInvoices] = useState<any[]>([]);
  const [loadingShiftStats, setLoadingShiftStats] = useState(false);
  const [isOpeningRegister, setIsOpeningRegister] = useState(false);
  const [isClosingRegister, setIsClosingRegister] = useState(false);

  // Grid navigation index
  const [selectedGridIndex, setSelectedGridIndex] = useState<number>(-1);

  // Modal choice selection index
  const [selectedModalIndex, setSelectedModalIndex] = useState<number>(0);

  // Cart Focus and navigation state
  const [isCartFocused, setIsCartFocused] = useState<boolean>(false);
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState<number>(-1);

  // Checkout State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0); // in percent
  const [paymentMode, setPaymentMode] = useState<"cash" | "card" | "credit">("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Accounts & Held Carts states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [heldCarts, setHeldCarts] = useState<any[]>([]);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);

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
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });

  // Customer search & dropdown selection state
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomerSearchIndex, setSelectedCustomerSearchIndex] = useState(0);

  // Split payment / Paid cash in credit mode state
  const [receivedAmount, setReceivedAmount] = useState<number>(0);

  // Keyboard Shortcuts modal help state
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Custom price editing mode state — persisted to localStorage
  const [allowPriceEdit, setAllowPriceEdit] = useState(false);

  // Load allowPriceEdit from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && shopId) {
      const saved = localStorage.getItem(`pos_price_edit_${shopId}`);
      if (saved === "true") setAllowPriceEdit(true);
    }
  }, [shopId]);

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

  // Layout View State: grid vs search (persisted to localStorage)
  const [layoutView, setLayoutView] = useState<"grid" | "search">("grid");
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
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = Math.max(0, subtotal + taxAmount - discount);

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
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptSettings, setReceiptSettings] = useState<any>(DEFAULT_RECEIPT_SETTINGS);
  const [shopDetails, setShopDetails] = useState<any>({ name: shopName || "Hisab X Store" });

  // Select Variant Modal State (when clicking a product with variants)
  const [activeProductForVariants, setActiveProductForVariants] = useState<DBProduct | null>(null);

  useEffect(() => {
    if (!shopId || !userId) return;

    fetchData();

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
      // 1. Fetch Products with Variants and Barcodes
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          id, name, code, unit, sale_price_single, purchase_price_single, current_stock, category_id,
          product_barcodes ( barcode ),
          product_variants ( 
            id, packing_name, sale_price, purchase_price, stock_quantity, is_packing, pack_size,
            product_barcodes ( barcode )
          )
        `)
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // 2. Fetch Customer Parties
      const { data: partiesData, error: partiesError } = await supabase
        .from("parties")
        .select("id, name, phone, current_balance")
        .eq("shop_id", shopId)
        .eq("type", "customer")
        .order("name", { ascending: true });

      if (partiesError) throw partiesError;
      setCustomers(partiesData || []);

      // 3. Fetch Categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (!categoriesError) {
        setCategories(categoriesData || []);
      }

      // 4. Fetch Units
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, name, code, parent_unit_id, conversion_factor")
        .eq("shop_id", shopId);

      if (!unitsError) {
        setAllUnits(unitsData || []);
      }

      // 5. Fetch Active Register Session
      if (userId && shopId) {
        const { data: sessionData, error: sessionError } = await supabase
          .from("register_sessions")
          .select("*")
          .eq("shop_id", shopId)
          .eq("user_id", userId)
          .eq("status", "open")
          .maybeSingle();

        if (!sessionError && sessionData) {
          setActiveSession(sessionData);
        } else {
          setActiveSession(null);
          // Pre-populate opening float with the last closed session's closing balance
          const { data: lastSession } = await supabase
            .from("register_sessions")
            .select("closing_balance")
            .eq("shop_id", shopId)
            .eq("user_id", userId)
            .eq("status", "closed")
            .order("closed_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastSession && lastSession.closing_balance !== null) {
            setOpeningFloat(lastSession.closing_balance.toString());
          } else {
            setOpeningFloat("0");
          }
        }
      }

      // 6. Fetch Cash Accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("cash_accounts")
        .select("id, name, current_balance")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (!accountsError && accountsData) {
        setAccounts(accountsData);
        if (accountsData.length > 0) {
          const cashInHandAcc = accountsData.find((a: any) => a.name.toLowerCase() === "cash in hand");
          setSelectedAccountId(cashInHandAcc ? cashInHandAcc.id : accountsData[0].id);
        }
      }

      // 7. Fetch print_settings for customized receipts
      const { data: printData, error: printError } = await supabase
        .from("print_settings")
        .select("receipt_page_size, receipt_font, receipt_font_size, receipt_design_settings")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (!printError && printData) {
        const storedCustomSettings = printData.receipt_design_settings || {};
        setReceiptSettings({
          ...DEFAULT_RECEIPT_SETTINGS,
          pageSize: (printData.receipt_page_size as any) || DEFAULT_RECEIPT_SETTINGS.pageSize,
          fontFamily: printData.receipt_font || DEFAULT_RECEIPT_SETTINGS.fontFamily,
          fontSize: printData.receipt_font_size || DEFAULT_RECEIPT_SETTINGS.fontSize,
          ...storedCustomSettings
        });
      }

      // 8. Fetch company_details for receipt contact info
      const { data: companyData, error: companyError } = await supabase
        .from("company_details")
        .select("name, address, phone, email, website")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (!companyError && companyData) {
        setShopDetails(companyData);
      } else {
        setShopDetails({ name: shopName || "Hisab X Store" });
      }

    } catch (err: any) {
      toast.error("Failed to load POS data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || !userId) {
      toast.error("Shop ID or User ID not found.");
      return;
    }
    setIsOpeningRegister(true);
    try {
      const { data, error } = await supabase
        .from("register_sessions")
        .insert({
          shop_id: shopId,
          user_id: userId,
          opening_balance: Number(openingFloat) || 0,
          status: "open",
          opened_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data);
      setOpeningFloat("");
      toast.success("Register session opened successfully!");
    } catch (err: any) {
      toast.error("Failed to open register: " + err.message);
    } finally {
      setIsOpeningRegister(false);
    }
  };

  const fetchShiftStats = async () => {
    if (!activeSession) return;
    setLoadingShiftStats(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("total_amount, paid_amount, status, payment_mode")
        .eq("register_session_id", activeSession.id)
        .eq("is_voided", false);

      if (error) throw error;
      setShiftInvoices(data || []);
    } catch (err: any) {
      toast.error("Failed to load shift sales: " + err.message);
    } finally {
      setLoadingShiftStats(false);
    }
  };

  const handleOpenCloseRegisterModal = () => {
    setIsCloseRegisterOpen(true);
    setActualCashCounted(0);
    setClosingNote("");
    fetchShiftStats();
  };

  const handleCloseRegister = async () => {
    if (!activeSession) return;
    setIsClosingRegister(true);
    try {
      const { error } = await supabase
        .from("register_sessions")
        .update({
          closing_balance: Number(actualCashCounted),
          closed_at: new Date().toISOString(),
          status: "closed"
        })
        .eq("id", activeSession.id);

      if (error) throw error;
      setActiveSession(null);
      setIsCloseRegisterOpen(false);
      toast.success("Register session closed and shift ended successfully!");
      setCart([]);
    } catch (err: any) {
      toast.error("Failed to close register: " + err.message);
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

        cartItems.push({
          productId: it.product_id,
          variantId: it.variant_id || undefined,
          name: product.name,
          packingName,
          price: Number(it.unit_price),
          purchasePrice: Number(purchasePrice),
          quantity: Number(it.quantity),
          stock: Number(stock)
        });
      }

      setCart(cartItems);
      setSelectedCustomerId(invoice.party_id || "walkin");
      setDiscount(Number(invoice.discount) || 0);
      
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      if (editId && products.length > 0 && allUnits.length > 0 && !editingInvoiceId) {
        loadInvoiceForEditing(editId);
      }
    }
  }, [products, allUnits, editingInvoiceId]);

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

    return options;
  };

  const filteredProducts = products.filter(p => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = p.name.toLowerCase().includes(query) || 
      (p.code && p.code.toLowerCase().includes(query)) ||
      (p.product_barcodes && p.product_barcodes.some((b: any) => b.barcode.toLowerCase().includes(query))) ||
      (p.product_variants && p.product_variants.some((v: any) => 
        v.product_barcodes && v.product_barcodes.some((b: any) => b.barcode.toLowerCase().includes(query))
      ));
    const matchesCategory = selectedCategoryId === "all" || p.category_id === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  const paginatedProducts = React.useMemo(() => {
    return filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredProducts, page]);

  const autocompleteResults = React.useMemo(() => {
    if (searchQuery.trim() === "") return [];
    return filteredProducts.slice(0, 10);
  }, [filteredProducts, searchQuery]);

  // Add Product to Cart via Card Click (triggers modal if options exist)
  const handleAddProductToCart = (product: DBProduct, option?: any) => {
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

    const existingIndex = cart.findIndex(item => 
      variantId 
        ? item.productId === product.id && item.variantId === variantId 
        : item.productId === product.id && !item.variantId
    );

    if (existingIndex > -1) {
      const updated = [...cart];
      if (allowNegativeStock || updated[existingIndex].quantity < stock) {
        updated[existingIndex].quantity += 1;
        setCart(updated);
        toast.success(`Incremented ${product.name} (${packingName || product.unit || "Base"})`);
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
          quantity: 1,
          stock,
          isAutoSubunit,
          conversionFactor,
          unitType
        }
      ]);
      toast.success(`Added ${product.name} (${packingName || product.unit || "Base"}) to cart`);
    }
    
    setActiveProductForVariants(null);
  };

  // Add Product Base Unit Directly (bypassing modal for chips)
  const handleAddBaseUnitDirectly = (product: DBProduct) => {
    const price = product.sale_price_single;
    const stock = product.current_stock;

    const existingIndex = cart.findIndex(item => item.productId === product.id && !item.variantId);

    if (existingIndex > -1) {
      const updated = [...cart];
      if (allowNegativeStock || updated[existingIndex].quantity < stock) {
        updated[existingIndex].quantity += 1;
        setCart(updated);
        toast.success(`Incremented ${product.name} (${product.unit || "Base"})`);
      } else {
        toast.warning(`Cannot exceed available stock of ${stock}`);
      }
    } else {
      if (!allowNegativeStock && stock <= 0) {
        toast.warning(`${product.name} (${product.unit || "Base"}) is out of stock!`);
        return;
      }
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          price,
          purchasePrice: product.purchase_price_single || 0,
          quantity: 1,
          stock
        }
      ]);
      toast.success(`Added ${product.name} (${product.unit || "Base"}) to cart`);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditingInputOrSelect = 
        (activeEl?.tagName === "INPUT" && activeEl.id !== "pos-search-input" && activeEl.id !== "pos-customer-search-input") || 
        activeEl?.tagName === "SELECT";

      if (isEditingInputOrSelect) {
        const allowedKeys = ["F1", "F2", "F3", "F4", "F7", "F8", "F9", "F10", "Escape"];
        if (!allowedKeys.includes(e.key)) {
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

      // INTERCEPT keys if Cart is focused
      if (isCartFocused) {
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
        if (e.key === "Delete" || e.key === "Backspace") {
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
          setPaymentMode(prev => prev === "cash" ? "credit" : "cash");
        }
        if (e.key === "F9") {
          e.preventDefault();
          handleCheckout();
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

      // Focus Tax field: F7 or Alt+T
      if (e.key === "F7" || (e.altKey && e.key.toLowerCase() === "t")) {
        e.preventDefault();
        const taxInput = document.getElementById("pos-tax-input");
        taxInput?.focus();
        setIsCartFocused(false);
      }

      // Toggle Payment Modes: F8
      if (e.key === "F8") {
        e.preventDefault();
        setPaymentMode(prev => prev === "cash" ? "credit" : "cash");
      }

      // Checkout: F9 or Alt+Enter
      if (e.key === "F9" || (e.altKey && e.key === "Enter")) {
        e.preventDefault();
        handleCheckout();
      }

      // Help Menu: F10 or Alt+K
      if (e.key === "F10" || (e.altKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setIsShortcutsHelpOpen(prev => !prev);
      }

      // Escape to close models/modals
      if (e.key === "Escape") {
        e.preventDefault();
        setSearchQuery("");
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
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedGridIndex(prev => {
            const next = prev - cols;
            return next >= 0 ? next : prev;
          });
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setSelectedGridIndex(prev => (prev + 1 < paginatedProducts.length ? prev + 1 : prev));
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setSelectedGridIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
        }
        // Barcode scanning / exact match auto-add
        if (e.key === "Enter" && activeEl?.id === "pos-search-input" && searchQuery.trim() !== "") {
          e.preventDefault();
          const query = searchQuery.trim().toLowerCase();
          
          let matchedProduct: any = null;
          let matchedVariant: any = null;
          
          for (const p of products) {
            if (p.code && p.code.toLowerCase() === query) {
              matchedProduct = p;
              break;
            }
            if (p.product_barcodes && p.product_barcodes.some((b: any) => b.barcode.toLowerCase() === query)) {
              matchedProduct = p;
              break;
            }
            if (p.product_variants) {
              const vMatch = p.product_variants.find((v: any) => 
                v.product_barcodes && v.product_barcodes.some((b: any) => b.barcode.toLowerCase() === query)
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
              const opt = options.find(o => o.id === matchedVariant.id) || {
                id: matchedVariant.id,
                name: matchedVariant.packing_name,
                price: matchedVariant.sale_price,
                stock: matchedVariant.stock_quantity
              };
              handleAddProductToCart(matchedProduct, opt);
            } else {
              handleAddBaseUnitDirectly(matchedProduct);
            }
            setSearchQuery("");
            return;
          } else {
            // Check if there is only 1 filtered product in grid and add it
            if (filteredProducts.length === 1) {
              const prod = filteredProducts[0];
              const options = getProductUnitOptions(prod);
              if (options.length > 0) {
                setActiveProductForVariants(prod);
              } else {
                handleAddBaseUnitDirectly(prod);
              }
              setSearchQuery("");
              return;
            }
          }
        }

        if (e.key === "Enter" && selectedGridIndex >= 0 && selectedGridIndex < paginatedProducts.length) {
          const activeEl = document.activeElement;
          if (activeEl?.tagName === "INPUT" && activeEl.id !== "pos-search-input") {
            return;
          }
          e.preventDefault();
          handleAddProductToCart(paginatedProducts[selectedGridIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredProducts, paginatedProducts, page, selectedGridIndex, cart, paymentMode, discount, taxRate, selectedCustomerId, activeProductForVariants, selectedModalIndex, isCartFocused, selectedCartItemIndex, heldCarts, receivedAmount, searchQuery, products, allowNegativeStock, layoutView, isSearchDropdownOpen, selectedSearchProductIndex, autocompleteResults]);

  // Handle unit selection change inside cart dropdown
  const handleCartItemUnitChange = (index: number, value: string) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    if (!product) return;

    let price = product.sale_price_single;
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
          stock = opt.stock;
          packingName = opt.name;
          variantId = opt.id;
          isAutoSubunit = true;
          conversionFactor = opt.conversionFactor;
          unitType = opt.type;
        }
      } else {
        const targetVariant = product.product_variants?.find(v => v.id === value);
        if (targetVariant) {
          price = targetVariant.sale_price;
          stock = targetVariant.stock_quantity;
          packingName = targetVariant.packing_name;
          variantId = targetVariant.id;
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
        stock,
        quantity: cappedQty, 
        isAutoSubunit,
        conversionFactor,
        unitType
      };
      setCart(updated);
      toast.success(`Switched to ${packingName || product.unit || "Base"}`);
    }
  };

  const updateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
      return;
    }
    const item = cart[index];
    if (!allowNegativeStock && newQty > item.stock) {
      toast.warning(`Cannot exceed available stock of ${item.stock}`);
      return;
    }
    const updated = [...cart];
    updated[index].quantity = newQty;
    setCart(updated);
  };

  const updateCartItemPrice = (index: number, newPrice: number) => {
    const updated = [...cart];
    updated[index].price = newPrice;
    setCart(updated);
    // Warn if selling price drops below purchase price
    const item = updated[index];
    if (item.purchasePrice > 0 && newPrice < item.purchasePrice) {
      toast.error(
        `⚠️ Warning: Selling price Rs ${newPrice} is BELOW purchase price Rs ${item.purchasePrice} for "${item.name}"! You will be selling at a loss.`,
        { duration: 5000, id: `below-purchase-${index}` }
      );
    }
  };

  // Back-calculate quantity from a desired total: qty = total / price
  const updateCartItemQtyFromTotal = (index: number, newTotal: number) => {
    const item = cart[index];
    if (!item || item.price <= 0) return;
    const newQty = newTotal / item.price;
    if (newQty <= 0) return;
    updateCartQty(index, industryType === "karyana" ? Math.round(newQty * 1000) / 1000 : Math.round(newQty));
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
    setTaxRate(0);
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
        doc.text(`Tax (${taxRate}%): Rs ${taxAmount.toLocaleString()}`, 130, finalY + 5);
      }
      if (discount > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Discount: -Rs ${discount.toLocaleString()}`, 130, finalY + 10);
      }
      
      doc.setFontSize(13);
      doc.setTextColor(79, 70, 229);
      const grandTotalY = finalY + (discount > 0 ? 16 : (taxRate > 0 ? 11 : 6));
      doc.text(`Estimated Total: Rs ${total.toLocaleString()}`, 130, grandTotalY);
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Powered by Hisab X POS", 15, 285);
      
      doc.save(`estimate_${Date.now()}.pdf`);
      toast.success("Quotation PDF generated and downloaded! 📄");
    } catch (err: any) {
      toast.error("Failed to generate PDF: " + err.message);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }
    if (paymentMode === "credit" && selectedCustomerId === "walkin") {
      toast.error("Cannot sell on credit (Udhaar) to a Walk-in Customer. Please select/add a customer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const customerId = selectedCustomerId === "walkin" ? null : selectedCustomerId;
      const invoiceStatus = paymentMode === "credit" 
        ? (receivedAmount === 0 ? "unpaid" : (receivedAmount >= total ? "paid" : "partial")) 
        : "paid";

      let updatedHistory: any[] = [];
      if (editingInvoiceId) {
        const { data: oldItems } = await supabase
          .from("invoice_items")
          .select("product_id, variant_id, quantity, unit_price, subtotal")
          .eq("invoice_id", editingInvoiceId);

        if (oldItems) {
          for (const it of oldItems) {
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
            edited_at: new Date().toISOString()
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
            discount: discount,
            status: invoiceStatus,
            paid_amount: paymentMode === "credit" ? receivedAmount : total,
            is_edited: true,
            edit_history: updatedHistory,
            payment_mode: paymentMode,
            register_session_id: activeSession ? activeSession.id : null,
            account_id: selectedAccountId || null
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
            discount: discount,
            status: invoiceStatus,
            paid_amount: paymentMode === "credit" ? receivedAmount : total,
            payment_mode: paymentMode,
            register_session_id: activeSession ? activeSession.id : null,
            account_id: selectedAccountId || null
          })
          .select()
          .single();

        if (insertError) throw insertError;
        invoiceData = insertedInvoice;
      }

      const itemsToInsert = cart.map(item => ({
        invoice_id: invoiceData.id,
        product_id: item.productId,
        variant_id: (item.variantId && !item.variantId.startsWith("auto-")) ? item.variantId : null,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      for (const item of cart) {
        if (item.variantId && !item.variantId.startsWith("auto-")) {
          const product = products.find(p => p.id === item.productId);
          const variant = product?.product_variants?.find(v => v.id === item.variantId);
          
          if (variant?.is_packing && variant.pack_size) {
            await supabase.rpc("decrement_product_stock", {
              p_id: item.productId,
              qty: item.quantity * variant.pack_size
            });
          } else {
            await supabase.rpc("decrement_variant_stock", {
              v_id: item.variantId,
              qty: item.quantity
            });
          }
        } else {
          let qtyToDecrement = item.quantity;
          if (item.variantId?.startsWith("auto-") && item.conversionFactor) {
            if (item.unitType === "divisor") {
              qtyToDecrement = item.quantity / item.conversionFactor;
            } else {
              qtyToDecrement = item.quantity * item.conversionFactor;
            }
          }

          await supabase.rpc("decrement_product_stock", {
            p_id: item.productId,
            qty: qtyToDecrement
          });
        }
      }

      const creditAmount = paymentMode === "credit" ? total - receivedAmount : 0;
      if (creditAmount > 0 && customerId) {
        const { error: balanceError } = await supabase
          .rpc("increment_party_balance", {
            p_id: customerId,
            amount: creditAmount
          });

        if (balanceError) throw balanceError;
      }

      // ── Update selected cash account balance & log transaction ────────────
      if (selectedAccountId) {
        const cashAmt = paymentMode !== "credit" ? total : receivedAmount;
        if (cashAmt > 0) {
          const currentAcc = accounts.find(a => a.id === selectedAccountId);
          if (currentAcc) {
            await supabase
              .from("cash_accounts")
              .update({ current_balance: Number(currentAcc.current_balance) + cashAmt })
              .eq("id", selectedAccountId);
          }
          await supabase.from("account_transactions").insert({
            shop_id: shopId,
            account_id: selectedAccountId,
            type: "deposit",
            amount: cashAmt,
            ref_type: "invoice",
            ref_id: invoiceData.id,
            remarks: `POS Sale #${invoiceData.id.slice(0, 8).toUpperCase()}`
          });
        }
      }

      toast.success("Checkout completed successfully!");

      setLastInvoice({
        id: invoiceData.id,
        created_at: invoiceData.created_at,
        total_amount: total,
        tax_amount: taxAmount,
        discount: discount,
        payment_mode: paymentMode,
        received_amount: receivedAmount,
        customer_name: customerId ? customers.find(c => c.id === customerId)?.name : "Walk-in Customer",
        items: cart
      });

      setCart([]);
      setDiscount(0);
      setTaxRate(0);
      setPaymentMode("cash");
      setSelectedCustomerId("walkin");
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
    return (
      <>
        {/* Customer Selection */}
        <div className="relative">
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Select Customer (F2)</label>
            <button 
              onClick={() => setIsCustomerModalOpen(true)}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1"
            >
              <UserPlus size={11} /> Add New
            </button>
          </div>
          
          <div className="relative">
            <Input 
              id="pos-customer-search-input"
              placeholder={
                selectedCustomerId === "walkin" 
                  ? "Walk-in Customer" 
                  : (customers.find(c => c.id === selectedCustomerId)?.name || "Walk-in Customer")
              }
              value={customerSearchQuery}
              onChange={(e) => {
                setCustomerSearchQuery(e.target.value);
                setIsCustomerDropdownOpen(true);
                setSelectedCustomerSearchIndex(0);
              }}
              onFocus={() => {
                setIsCustomerDropdownOpen(true);
                setCustomerSearchQuery("");
                setSelectedCustomerSearchIndex(0);
                setIsCartFocused(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedCustomerSearchIndex(prev => (prev + 1 < customerChoices.length ? prev + 1 : prev));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedCustomerSearchIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const choice = customerChoices[selectedCustomerSearchIndex];
                  if (choice) {
                    setSelectedCustomerId(choice.id);
                    setCustomerSearchQuery("");
                    setIsCustomerDropdownOpen(false);
                    e.currentTarget.blur();
                  }
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setIsCustomerDropdownOpen(false);
                  e.currentTarget.blur();
                }
              }}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 h-8.5 text-[11px] focus-visible:ring-indigo-500/20 font-bold text-slate-800"
            />
            {selectedCustomerId !== "walkin" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomerId("walkin");
                  setCustomerSearchQuery("");
                  setIsCustomerDropdownOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Floating Dropdown Results */}
          <AnimatePresence>
            {isCustomerDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsCustomerDropdownOpen(false)} 
                />
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-[180px] overflow-y-auto custom-scrollbar p-1"
                >
                  {customerChoices.length === 0 ? (
                    <div className="py-2.5 text-center text-[11px] text-slate-400 font-medium">
                      No customers found.
                    </div>
                  ) : (
                    customerChoices.map((c, cIdx) => {
                      const isChosen = selectedCustomerId === c.id;
                      const isKeyboardSelected = selectedCustomerSearchIndex === cIdx;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerSearchQuery("");
                            setIsCustomerDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex flex-col transition-all ${
                            isKeyboardSelected
                              ? "bg-indigo-50 text-indigo-900 font-bold"
                              : isChosen
                                ? "bg-slate-50 text-slate-900 font-bold"
                                : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="flex justify-between w-full items-center">
                            <span>{c.name}</span>
                            {c.id !== "walkin" && c.current_balance !== undefined && (
                              <span className={`text-[9.5px] font-bold ${Number(c.current_balance) > 0 ? "text-amber-600" : "text-slate-400"}`}>
                                Bal: Rs {c.current_balance}
                              </span>
                            )}
                          </span>
                          {c.phone && (
                            <span className="text-[9.5px] text-slate-400 font-mono mt-0.5">{c.phone}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Discount & Tax */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Discount (Rs)</label>
            <Input 
              id="pos-discount-input"
              type="number" 
              placeholder="0" 
              value={discount || ""} 
              onChange={(e) => {
                const newDiscount = Math.max(0, parseFloat(e.target.value) || 0);
                setDiscount(newDiscount);
                // Warn if discount makes effective price below purchase price for any item
                if (newDiscount > 0 && cart.length > 0) {
                  const rawSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
                  const totalPurchaseCost = cart.reduce((acc, item) => acc + item.purchasePrice * item.quantity, 0);
                  const effectiveTotal = Math.max(0, rawSubtotal + (rawSubtotal * taxRate) / 100 - newDiscount);
                  if (totalPurchaseCost > 0 && effectiveTotal < totalPurchaseCost) {
                    toast.error(
                      `⚠️ Warning: Discount of Rs ${newDiscount} brings the total (Rs ${effectiveTotal.toFixed(2)}) BELOW total purchase cost (Rs ${totalPurchaseCost.toFixed(2)})! You will be selling at a loss.`,
                      { duration: 6000, id: 'below-purchase-discount' }
                    );
                  }
                }
              }}
              className="h-8 bg-white border-slate-200 rounded-lg text-[11px]"
            />
          </div>
          <div>
            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tax Rate (%)</label>
            <Input 
              id="pos-tax-input"
              type="number" 
              placeholder="0" 
              value={taxRate || ""} 
              onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-8 bg-white border-slate-200 rounded-lg text-[11px]"
            />
          </div>
        </div>

        {/* Payment Mode */}
        <div>
          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Mode (F8)</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "cash", label: "💵 Cash", color: "bg-emerald-600 border-emerald-600 shadow-emerald-500/20" },
              { id: "credit", label: "📒 Credit (Udhaar)", color: "bg-amber-600 border-amber-600 shadow-amber-500/20" }
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

          {paymentMode === "credit" && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-2.5 space-y-1.5 mt-2 overflow-hidden"
            >
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wide">Split Payment (Udhaar + Cash)</span>
                <span className="text-[9px] text-amber-600 font-medium">Remaining balance added to Khata</span>
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
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Remaining Udhaar</span>
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
          <div className="flex justify-between text-slate-500">
            <span>Subtotal:</span>
            <span className="font-semibold text-slate-700">Rs {Math.round(subtotal * 100) / 100}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Tax ({taxRate}%):</span>
              <span className="font-semibold text-slate-700">Rs {Math.round(taxAmount * 100) / 100}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-red-655 font-bold">
              <span>Discount:</span>
              <span>-Rs {discount}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-slate-900 text-xs border-t border-slate-100 pt-2">
            <span>Grand Total:</span>
            <span className="text-indigo-600 text-sm">Rs {Math.round(total * 100) / 100}</span>
          </div>
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
            className="py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
            title="Download Quotation PDF estimate"
          >
            Quotation
          </button>
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleCheckout}
          disabled={isSubmitting || cart.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-755 text-white font-black h-9 rounded-lg shadow-lg shadow-indigo-500/15 mt-0.5 text-[11.5px]"
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Check className="h-3.5 w-3.5 mr-1.5" />
          )}
          Process Checkout (F9)
        </Button>
      </>
    );
  };

  // Helper render function for View 2 (Autocomplete Search & Spacious Cart List)
  const renderSearchModeView = () => {
    return (
      <div className="flex-1 lg:grid lg:grid-cols-12 gap-3.5 overflow-hidden p-3 min-h-0">
        {/* Left Side: Wide Panel (col-span-8) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 overflow-hidden h-full">
          {/* Autocomplete Search input */}
          <div className="relative mb-4 flex-shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              id="pos-search-input"
              placeholder="Search product by name or scan barcode... (F1, Arrows to nav, Enter to select)" 
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
              className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-800 text-sm rounded-2xl focus-visible:ring-indigo-500/20"
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchDropdownOpen(false);
                }} 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}

            {/* Autocomplete Floating Dropdown */}
            {isSearchDropdownOpen && searchQuery.trim() !== "" && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsSearchDropdownOpen(false)} />
                <div className="absolute left-0 right-0 mt-1.5 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-40 max-h-[320px] overflow-y-auto custom-scrollbar p-2">
                  {autocompleteResults.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-550 font-bold">
                      No products found.
                    </div>
                  ) : (
                    autocompleteResults.map((product, pIdx) => {
                      const isHighlighted = selectedSearchProductIndex === pIdx;
                      const options = getProductUnitOptions(product);
                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            handleAddProductToCart(product);
                            setSearchQuery("");
                            setIsSearchDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                            isHighlighted 
                              ? "bg-indigo-600/90 border-indigo-500/30 text-white" 
                              : "hover:bg-zinc-900 border-transparent text-zinc-300"
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs truncate text-white">
                                {product.name}
                              </span>
                              {product.code && (
                                <span className={`text-[9px] font-mono tracking-wider ${isHighlighted ? "text-indigo-200" : "text-zinc-550"}`}>
                                  {product.code}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className={`text-[9.5px] font-bold ${isHighlighted ? "text-indigo-200" : "text-zinc-400"}`}>
                                Stock: {product.current_stock} {product.unit || "unit"}
                              </span>
                              <span className={`text-[9.5px] font-bold ${isHighlighted ? "text-indigo-200" : "text-indigo-400"}`}>
                                Rs {product.sale_price_single}
                              </span>
                            </div>
                          </div>

                          {/* Quick Packings pills */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                handleAddBaseUnitDirectly(product);
                                setSearchQuery("");
                                setIsSearchDropdownOpen(false);
                              }}
                              className={`text-[9px] font-black px-2 py-1 rounded border transition-all ${
                                isHighlighted 
                                  ? "bg-zinc-900 border-zinc-800 text-white hover:bg-white hover:text-black" 
                                  : "bg-zinc-900 border-zinc-850 text-zinc-300 hover:bg-indigo-650 hover:text-white"
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
                                className={`text-[9px] font-black px-2 py-1 rounded border transition-all ${
                                  isHighlighted
                                    ? "bg-indigo-750 border-indigo-600 text-white hover:bg-white hover:text-black"
                                    : "bg-indigo-950/40 border-indigo-900/30 text-indigo-450 hover:bg-indigo-650 hover:text-white"
                                }`}
                              >
                                {opt.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Cart Table List */}
          <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl bg-slate-50/20 p-2.5 custom-scrollbar min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <ShoppingCart size={32} className="text-slate-200 mb-2.5" />
                <p className="text-xs font-semibold">Your checkout cart is empty.</p>
                <p className="text-[10px] text-slate-400 mt-1">Search and select items or packings to build the cart.</p>
              </div>
            ) : (
              <div className="min-w-[650px] overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-wider pb-2">
                      <th className="py-2.5 px-3">Product Name & Variant</th>
                      {industryType === "karyana" && <th className="py-2.5 px-3 w-[140px]">Unit Type</th>}
                      <th className="py-2.5 px-3 w-[110px] text-right">Price (Rs)</th>
                      <th className="py-2.5 px-3 w-[140px] text-center">Quantity</th>
                      <th className="py-2.5 px-3 w-[110px] text-right">Total (Rs)</th>
                      <th className="py-2.5 px-3 w-[50px] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => {
                      const product = products.find(p => p.id === item.productId);
                      const isItemHighlighted = isCartFocused && selectedCartItemIndex === idx;
                      return (
                        <tr 
                          key={idx}
                          className={`border-b border-slate-100 transition-all ${
                            isItemHighlighted ? "bg-indigo-50/30" : "hover:bg-slate-50/50"
                          }`}
                        >
                          {/* Name & Packing */}
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-slate-800 text-[11px] leading-tight">
                              {item.name}
                            </div>
                            {item.packingName && (
                              <span className="inline-block bg-indigo-50 text-indigo-700 text-[8px] font-extrabold px-1 py-0.5 rounded border border-indigo-100 mt-1 uppercase tracking-wide">
                                Packing: {item.packingName}
                              </span>
                            )}
                          </td>

                          {/* Unit Select */}
                          {industryType === "karyana" && (
                            <td className="py-3 px-3">
                              <select
                                value={item.variantId || "base"}
                                onChange={(e) => handleCartItemUnitChange(idx, e.target.value)}
                                onFocus={() => {
                                  setIsCartFocused(true);
                                  setSelectedCartItemIndex(idx);
                                }}
                                className="text-[11px] bg-white border border-slate-250 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold cursor-pointer"
                              >
                                <option value="base">{product?.unit || "Base"} (Rs {product?.sale_price_single})</option>
                                {product && getProductUnitOptions(product).map(opt => (
                                  <option key={opt.id} value={opt.id}>{opt.name} (Rs {opt.price})</option>
                                ))}
                              </select>
                            </td>
                          )}

                          {/* Editable Price — simple text input */}
                          <td className="py-2 px-2">
                            {allowPriceEdit ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-wide">Rate</span>
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
                                  className="no-spin w-20 h-7 bg-white border-2 border-indigo-300 rounded-lg px-2 text-[11px] font-extrabold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-slate-800 text-right shadow-sm"
                                  placeholder="0"
                                />
                              </div>
                            ) : (
                              <span className="font-bold text-slate-700 block">Rs {item.price}</span>
                            )}
                          </td>

                          {/* Quantity Controls */}
                          <td className="py-2 px-2 text-center">
                            {allowPriceEdit ? (
                              <div className="flex flex-col gap-0.5 items-center">
                                <span className="text-[8px] font-black text-purple-500 uppercase tracking-wide">Qty</span>
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
                                      document.getElementById(`sm-total-${idx}`)?.focus();
                                    }
                                  }}
                                  className="no-spin w-20 h-7 bg-white border-2 border-purple-300 rounded-lg px-2 text-[11px] font-extrabold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-slate-800 text-center shadow-sm"
                                />
                                <span className="text-[8px] text-slate-400 font-semibold">Max: {item.stock}</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                                <button
                                  onClick={() => updateCartQty(idx, Math.max(industryType === "karyana" ? 0.001 : 1, item.quantity - 1))}
                                  className="p-1 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                  <Minus size={11} />
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
                                  className="p-1 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            )}
                            {!allowPriceEdit && <span className="block text-[8px] text-slate-400 mt-1 font-semibold">Stock: {item.stock}</span>}
                          </td>

                          {/* Row Total — editable when allowPriceEdit, back-calcs qty */}
                          <td className="py-2 px-2 text-right font-extrabold text-slate-900">
                            {allowPriceEdit ? (
                              <div className="flex flex-col gap-0.5 items-end">
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wide">Total</span>
                                <input
                                  id={`sm-total-${idx}`}
                                  type="number"
                                  step="any"
                                  value={Math.round(item.price * item.quantity * 100) / 100}
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
                                      document.getElementById(`sm-qty-${idx}`)?.focus();
                                    }
                                  }}
                                  className="no-spin w-20 h-7 bg-white border-2 border-emerald-300 rounded-lg px-2 text-[11px] font-extrabold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 text-slate-800 text-right shadow-sm"
                                  title="Edit total — quantity auto-calculated"
                                />
                              </div>
                            ) : (
                              <span>Rs {Math.round(item.price * item.quantity * 100) / 100}</span>
                            )}
                          </td>

                          {/* Delete Action */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => removeFromCart(idx)}
                              className="p-1.5 text-slate-450 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
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
            )}
          </div>
        </div>

        {/* Right Side: Checkout controls (col-span-4) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-white border border-slate-200/80 shadow-md rounded-2xl overflow-hidden h-full">
          {/* Header of Checkout Summary */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                <CreditCard size={15} />
              </div>
              <div>
                <h3 className="font-black text-slate-850 text-xs">Checkout Summary</h3>
                <p className="text-[9px] text-slate-400 font-medium">Customer selection and payment</p>
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

          <h2 className="text-xl font-black text-slate-800 mb-2">Register is Closed</h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            To start selling products, scanning barcodes, and generating invoices, you must open a new cash register shift session.
          </p>

          <form onSubmit={handleOpenRegister} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Starting Cash Float (Rs)
              </label>
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-11 rounded-2xl shadow-lg shadow-indigo-500/15 mt-2 flex items-center justify-center gap-2"
            >
              {isOpeningRegister ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
              Open Register & Start Shift
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50/20 overflow-hidden font-sans select-none">
      {/* Branded Custom POS Header */}
      <div className="h-14 bg-zinc-950 text-white border-b border-zinc-800/80 flex items-center justify-between px-4 shrink-0 shadow-md">
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
          
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-xs">HX</span>
            </div>
            <span className="font-extrabold text-xs tracking-tight text-white/90">POS Terminal</span>
          </div>

          {activeSession && (
            <div className="hidden md:flex items-center gap-2.5 ml-4 bg-zinc-900/60 border border-zinc-800 px-3 py-1 rounded-xl text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-zinc-400 font-bold uppercase tracking-wider text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded">Shift Active</span>
              <span className="text-zinc-500 font-medium">|</span>
              <span className="text-zinc-400">Opened: <span className="font-bold text-zinc-200">{new Date(activeSession.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></span>
              <span className="text-zinc-500 font-medium">|</span>
              <span className="text-zinc-450">Float: <span className="font-bold text-indigo-400">Rs {Number(activeSession.opening_balance).toLocaleString()}</span></span>
              {userName && (
                <>
                  <span className="text-zinc-500 font-medium">|</span>
                  <span className="text-zinc-450 capitalize">Cashier: <span className="font-bold text-zinc-200">{userName}</span></span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-3">
          {/* Layout Switcher (Grid vs Fast Search) */}
          <button
            onClick={toggleLayoutView}
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-extrabold rounded-xl transition-all shadow-sm text-[10px] h-8 cursor-pointer"
            title="Toggle POS Layout View"
          >
            {layoutView === "grid" ? (
              <>
                <Zap size={12} className="text-amber-500" />
                <span>Search Mode</span>
              </>
            ) : (
              <>
                <LayoutGrid size={12} className="text-indigo-400" />
                <span>Grid Mode</span>
              </>
            )}
          </button>

          {/* Mini Language Switcher */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[10px]">
            <button
              onClick={() => setLanguage("en")}
              className={`px-2 py-0.5 font-bold rounded transition-all duration-200 ${
                language === "en" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("ur")}
              className={`px-2 py-0.5 font-bold rounded transition-all duration-200 font-sans ${
                language === "ur" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              اردو
            </button>
          </div>

          {activeSession && (
            <button
              type="button"
              onClick={handleOpenCloseRegisterModal}
              className="bg-red-600/20 border border-red-500/30 hover:bg-red-600 text-red-400 hover:text-white font-extrabold px-3 py-1 rounded-xl transition-all shadow-sm text-[10px] flex items-center gap-1.5 h-8 shrink-0 cursor-pointer"
            >
              <LogOut size={12} />
              <span>End Shift</span>
            </button>
          )}
        </div>
      </div>

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
                setTaxRate(0);
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
      {/* Left Panel: Products Grid & Filter */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 overflow-hidden h-full">
        {/* Search Bar & Reset */}
        <div className="relative mb-4 flex-shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            id="pos-search-input"
            placeholder="Search product by name or barcode scan... (F1)" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-slate-50 border-slate-200 text-slate-800 text-sm rounded-2xl focus-visible:ring-indigo-500/20"
            autoFocus
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Categories Horizontal Scroll */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar shrink-0">
            <button
              onClick={() => setSelectedCategoryId("all")}
              className={`px-4.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                selectedCategoryId === "all"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Products
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  selectedCategoryId === cat.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products Grid Container */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-2 custom-scrollbar">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mb-2 text-indigo-500" />
              <span className="text-xs font-medium">Loading products catalog...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400 text-xs font-medium">
              No products found matching the criteria.
            </div>
          ) : (
            paginatedProducts.map((product, idx) => {
              const options = getProductUnitOptions(product);
              const totalStock = product.current_stock;
              const isSelected = selectedGridIndex === idx;

              return (
                <motion.div
                  whileHover={{ y: -2 }}
                  key={product.id}
                  onClick={() => handleAddProductToCart(product)}
                  className={`group bg-slate-50/50 hover:bg-white p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between min-h-[145px] relative overflow-hidden ${
                    isSelected 
                      ? 'ring-2 ring-indigo-600 bg-white border-indigo-300 shadow-md' 
                      : 'border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-200'
                  } ${totalStock <= 0 && options.length === 0 ? 'opacity-60' : ''}`}
                >
                  <div className="flex flex-col">
                    <h3 className="font-bold text-slate-800 line-clamp-2 text-xs leading-snug tracking-tight mb-1 group-hover:text-indigo-950 transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {product.code && (
                        <span className="text-[9px] text-slate-400 font-mono tracking-tighter">{product.code}</span>
                      )}
                      {product.unit && (
                        <span className="bg-slate-100 text-slate-500 text-[8px] font-extrabold px-1 rounded border border-slate-200">
                          {product.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1 border-b border-dashed border-slate-200 pb-1">
                      <span>Stock: {totalStock} {product.unit || "unit"}</span>
                      <span className="font-bold text-slate-850">Rs {product.sale_price_single}</span>
                    </div>

                    {/* Quick Add Buttons (Pills) */}
                    <div className="mt-1.5">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Quick Add Packing</p>
                      <div className="flex flex-wrap gap-1 max-h-[56px] overflow-y-auto custom-scrollbar">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddBaseUnitDirectly(product);
                          }}
                          className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-white hover:bg-slate-900 hover:text-white text-slate-700 transition-colors border border-slate-200"
                        >
                          {product.unit || "Base"}
                        </button>
                        {options.map(opt => (
                          <button
                            key={opt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddProductToCart(product, opt);
                            }}
                            className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 transition-colors border border-indigo-100"
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && filteredProducts.length > 0 && (
          <div className="flex items-center justify-between shrink-0 px-0.5 mt-3 select-none">
            <span className="text-[10px] text-slate-400 font-semibold">
              Showing {Math.min(filteredProducts.length, (page - 1) * PAGE_SIZE + 1)}-{Math.min(filteredProducts.length, page * PAGE_SIZE)} of {filteredProducts.length} products · Page {page} of {Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedGridIndex(-1); }}
                disabled={page === 1}
                className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-all"
                title="Previous Page (PageUp)"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)) }, (_, i) => i + 1)
                .filter(p => p === 1 || p === Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)) || Math.abs(p - page) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`dot-${i}`} className="text-[10px] text-slate-350 px-0.5">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setPage(p as number); setSelectedGridIndex(-1); }}
                      className={`w-6 h-6 text-[10px] font-black rounded-lg transition-all ${page === p ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"}`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                type="button"
                onClick={() => { setPage(p => Math.min(Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)), p + 1)); setSelectedGridIndex(-1); }}
                disabled={page === Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))}
                className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-all"
                title="Next Page (PageDown)"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Keyboard Shortcut Cheat Sheet */}
        <div className="bg-slate-900 text-slate-400 text-[10px] py-2 px-4 rounded-xl flex flex-wrap gap-x-4 gap-y-1 justify-center items-center mt-3 border border-slate-800 shrink-0 select-none">
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

      {/* Right Panel: Checkout Cart */}
      <div className={`lg:col-span-5 xl:col-span-4 flex flex-col bg-white border shadow-md rounded-2xl overflow-hidden shrink-0 h-full transition-all duration-200 ${
        isCartFocused ? "ring-2 ring-indigo-600 border-indigo-300 shadow-lg shadow-indigo-100/50" : "border-slate-200/80"
      }`}>
        {/* Cart Header */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <ShoppingCart size={15} />
            </div>
            <div>
              <h3 className="font-black text-slate-850 text-xs">Checkout Cart</h3>
              <p className="text-[9px] text-slate-400 font-medium">Qty/price edit & shortcuts enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
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
            {cart.length > 0 && (
              <button 
                onClick={() => {
                  if (confirm("Are you sure you want to empty the cart?")) {
                    setCart([]);
                  }
                }}
                className="p-1 text-slate-450 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                title="Clear Cart"
              >
                <Trash2 size={13} />
              </button>
            )}
            <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-1 rounded-md shadow-sm shadow-indigo-500/10">
              {cart.length} Items
            </span>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-6">
              <ShoppingCart size={24} className="text-slate-200 mb-1.5" />
              <p className="text-[11px] font-semibold">Your checkout cart is empty.</p>
              <p className="text-[9.5px] text-slate-400 mt-0.5">Select items or subunits on the left to sell.</p>
            </div>
          ) : (
            cart.map((item, idx) => {
              const product = products.find(p => p.id === item.productId);
              const isItemHighlighted = isCartFocused && selectedCartItemIndex === idx;

              return (
                <div 
                  key={idx} 
                  className={`flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all duration-300 relative group ${
                    isItemHighlighted 
                      ? "bg-indigo-50/50 border-indigo-300 shadow-sm ring-1 ring-indigo-500/10" 
                      : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 hover:border-indigo-100/80"
                  }`}
                >
                  <button 
                    onClick={() => removeFromCart(idx)} 
                    className="absolute top-2.5 right-2.5 bg-red-50 text-red-550 hover:bg-red-500 hover:text-white p-0.5 rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200"
                  >
                    <X size={10} />
                  </button>

                  <div className="flex justify-between items-start pr-5">
                    <div>
                      <h4 className="font-bold text-slate-850 text-[11px] tracking-tight leading-snug">{item.name}</h4>
                      {item.packingName && (
                        <p className="text-[8.5px] text-indigo-600 font-extrabold uppercase tracking-wider mt-0.5">
                          Packing: {item.packingName}
                        </p>
                      )}
                    </div>
                    <span className="font-extrabold text-slate-900 text-[11.5px]">Rs {Math.round(item.price * item.quantity * 100) / 100}</span>
                  </div>

                  {/* Dropdown Selector for Unit and Quantity Controls */}
                  <div className="flex items-center justify-between gap-1.5 mt-0.5">
                    {/* Unit Select Dropdown */}
                    {((industryType === "karyana") || (product && getProductUnitOptions(product).length > 0)) && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Unit:</span>
                        <select
                          value={item.variantId || "base"}
                          onChange={(e) => handleCartItemUnitChange(idx, e.target.value)}
                          onFocus={() => {
                            setIsCartFocused(true);
                            setSelectedCartItemIndex(idx);
                          }}
                          className="text-[11px] bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
                        >
                          <option value="base">{product?.unit || "Base"} (Rs {product?.sale_price_single})</option>
                          {product && getProductUnitOptions(product).map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name} (Rs {opt.price})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Decimal-Enabled Quantity controls */}
                    <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm shrink-0">
                      <button 
                        onClick={() => updateCartQty(idx, Math.max(industryType === "karyana" ? 0.001 : 1, item.quantity - 1))}
                        className="p-0.5 text-slate-500 hover:bg-slate-50 rounded-md transition-colors"
                      >
                        <Minus size={9.5} />
                      </button>
                      <CartQtyInput 
                        id={`cart-qty-input-${idx}`}
                        value={item.quantity}
                        max={item.stock}
                        onChange={(val) => updateCartQty(idx, val)}
                        allowDecimal={industryType === "karyana"}
                        onFocus={() => {
                          setIsCartFocused(true);
                          setSelectedCartItemIndex(idx);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            e.currentTarget.blur();
                            setIsCartFocused(true);
                          }
                        }}
                        className="text-[11px] font-extrabold w-9 text-center border-none focus:outline-none bg-transparent focus:ring-1 focus:ring-indigo-500/20 focus:bg-slate-50 rounded"
                      />
                      <button 
                        onClick={() => updateCartQty(idx, item.quantity + 1)}
                        className="p-0.5 text-slate-500 hover:bg-slate-50 rounded-md transition-colors"
                      >
                        <Plus size={9.5} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-start text-[8.5px] text-slate-400 font-medium">
                    {allowPriceEdit ? (
                      <div className="flex flex-col gap-1.5 flex-1 mr-1">
                        {/* Rate input */}
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-black text-indigo-500 uppercase w-7 shrink-0">Rate</span>
                          <input
                            id={`gm-rate-${idx}`}
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
                                else if (next < cart.length) document.getElementById(`gm-rate-${next}`)?.focus();
                              } else if (e.key === "ArrowRight") {
                                e.preventDefault();
                                document.getElementById(`gm-qty-${idx}`)?.focus();
                              }
                            }}
                            className="no-spin flex-1 h-6 bg-white border-2 border-indigo-300 rounded-lg px-1.5 text-[9.5px] font-extrabold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 text-slate-800 shadow-sm"
                            placeholder="Rs"
                          />
                        </div>
                        {/* Qty input */}
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-black text-purple-500 uppercase w-7 shrink-0">Qty</span>
                          <input
                            id={`gm-qty-${idx}`}
                            type="number"
                            step="any"
                            value={item.quantity}
                            min={0.001}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (!isNaN(parsed) && parsed > 0) updateCartQty(idx, parsed);
                            }}
                            onFocus={(e) => { e.target.select(); setIsCartFocused(true); setSelectedCartItemIndex(idx); }}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                e.preventDefault();
                                const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                                if (next < 0) document.getElementById("pos-search-input")?.focus();
                                else if (next < cart.length) document.getElementById(`gm-qty-${next}`)?.focus();
                              } else if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document.getElementById(`gm-rate-${idx}`)?.focus();
                              } else if (e.key === "ArrowRight") {
                                e.preventDefault();
                                document.getElementById(`gm-total-${idx}`)?.focus();
                              }
                            }}
                            className="no-spin flex-1 h-6 bg-white border-2 border-purple-300 rounded-lg px-1.5 text-[9.5px] font-extrabold focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-200 text-slate-800 shadow-sm"
                          />
                        </div>
                        {/* Total input — back-calcs qty */}
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] font-black text-emerald-600 uppercase w-7 shrink-0">Total</span>
                          <input
                            id={`gm-total-${idx}`}
                            type="number"
                            step="any"
                            value={Math.round(item.price * item.quantity * 100) / 100}
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
                                else if (next < cart.length) document.getElementById(`gm-total-${next}`)?.focus();
                              } else if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                document.getElementById(`gm-qty-${idx}`)?.focus();
                              }
                            }}
                            className="no-spin flex-1 h-6 bg-white border-2 border-emerald-300 rounded-lg px-1.5 text-[9.5px] font-extrabold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 text-slate-800 shadow-sm"
                            title="Edit total — qty auto-calculated"
                          />
                        </div>
                      </div>
                    ) : (
                      <span>Rs {item.price} each</span>
                    )}
                    <span className="ml-1 shrink-0">Max: {item.stock}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary & Settings */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 space-y-3 shrink-0 overflow-y-auto max-h-[48%] custom-scrollbar">
          {renderCheckoutSummaryContent()}
        </div>
      </div>
    </div>
    ) : (
      renderSearchModeView()
    )}

      {/* MODAL: Held Carts / Resume Sale */}
      <AnimatePresence>
        {isHeldModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsHeldModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-10 border border-slate-150 flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Held Sales & Bills</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Resume or discard suspended checkouts</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsHeldModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 font-black text-xs"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                {heldCarts.length === 0 ? (
                  <p className="text-center py-12 text-slate-400 text-xs font-semibold">No held bills found.</p>
                ) : (
                  heldCarts.map(held => (
                    <div 
                      key={held.id} 
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <h4 className="font-extrabold text-slate-800 text-xs truncate">{held.tag}</h4>
                        <p className="text-[9px] text-slate-450 font-mono mt-0.5">{new Date(held.created_at).toLocaleString()}</p>
                        <p className="text-[10px] text-slate-600 font-semibold mt-1.5">
                          {held.cart.length} items • Rs {held.cart.reduce((s: number, i: any) => s + (i.price * i.quantity), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResumeCart(held)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black transition-all shadow-sm"
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Discard this held bill?")) {
                              saveHeldCarts(heldCarts.filter(c => c.id !== held.id));
                            }
                          }}
                          className="p-1.5 text-slate-450 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
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

      {/* MODAL: Simulated Receipt Preview */}
      <AnimatePresence>
        {isReceiptOpen && lastInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 relative my-8"
            >
              <button 
                onClick={() => setIsReceiptOpen(false)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>

              <h3 className="font-black text-slate-800 text-sm mb-3">POS Checkout Invoice</h3>

              {/* Receipt Body (Simulated Print Sheet) */}
              <div className="bg-slate-100 p-2.5 rounded-2xl border border-slate-200/50 max-h-[460px] overflow-y-auto flex items-start justify-center custom-scrollbar">
                <div id="pos-invoice-print-container" className="bg-white shadow-sm rounded-md">
                  <ReceiptTemplate 
                    settings={receiptSettings} 
                    invoice={lastInvoice} 
                    shopDetails={shopDetails} 
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-5">
                <Button 
                  onClick={() => {
                    const receiptElement = document.getElementById("pos-invoice-print-container");
                    if (!receiptElement) return;

                    let iframe = document.getElementById("pos-print-iframe") as HTMLIFrameElement;
                    if (!iframe) {
                      iframe = document.createElement("iframe");
                      iframe.id = "pos-print-iframe";
                      iframe.style.position = "fixed";
                      iframe.style.right = "0";
                      iframe.style.bottom = "0";
                      iframe.style.width = "0";
                      iframe.style.height = "0";
                      iframe.style.border = "0";
                      document.body.appendChild(iframe);
                    }

                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!iframeDoc) {
                      toast.error("Printing failed: Could not access printer frame.");
                      return;
                    }

                    let fontFaceStyle = "";
                    if (receiptSettings?.fontFamily === "urdu") {
                      fontFaceStyle = `
                        @font-face {
                          font-family: 'Nastaliq';
                          src: url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
                        }
                      `;
                    }

                    let paperStyle = "@page { margin: 0; }";
                    if (receiptSettings?.pageSize === "MM80") {
                      paperStyle += " body { width: 80mm; }";
                    } else if (receiptSettings?.pageSize === "MM58") {
                      paperStyle += " body { width: 58mm; }";
                    } else if (receiptSettings?.pageSize === "A5") {
                      paperStyle += " body { width: 148mm; }";
                    }

                    iframeDoc.open();
                    iframeDoc.write(`
                      <html>
                        <head>
                          <title>POS Invoice #${lastInvoice?.id?.slice(0, 8).toUpperCase()}</title>
                          <script src="https://cdn.tailwindcss.com"></script>
                          <style>
                            \${fontFaceStyle}
                            \${paperStyle}
                            body {
                              margin: 0;
                              padding: 0;
                              background: white;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="flex justify-center items-start w-full">
                            \${receiptElement.innerHTML}
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
                  }} 
                  className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-bold h-10 rounded-xl text-xs"
                >
                  <Printer size={14} className="mr-2" /> Print Receipt
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsReceiptOpen(false)}
                  className="flex-1 text-slate-600 hover:bg-slate-50 font-bold h-10 rounded-xl text-xs"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Delete / Backspace</kbd>
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
                      <span className="text-slate-600 font-semibold">Focus Discount Input</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F4 / Alt+D</kbd>
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
                      <span className="text-slate-600 font-semibold">Process Checkout</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F9 / Alt+Enter</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Hold / Suspend Bill</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">F6</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-600 font-semibold">Resume Suspended Bill</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">Alt+R</kbd>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100 col-span-2">
                      <span className="text-slate-600 font-semibold">Close Modals / Exit Fields / Clear Search</span>
                      <kbd className="bg-white border border-slate-200 px-2 py-0.5 rounded font-black text-slate-800 shadow-sm text-[10px]">ESC</kbd>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold font-mono">Press ESC or click outside to exit</span>
                <Button onClick={() => setIsShortcutsHelpOpen(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs h-9 rounded-xl shadow-md">
                  Got It!
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Close Register / End Shift */}
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
                  <div className="p-2 bg-red-50 text-red-650 rounded-xl">
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm">Close Cash Register</h3>
                    <p className="text-[10px] text-slate-400">Shift summary and cash verification</p>
                  </div>
                </div>
                <button onClick={() => setIsCloseRegisterOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2 custom-scrollbar">
                {loadingShiftStats ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mb-2 text-indigo-500" />
                    <span className="text-xs font-semibold">Calculating shift totals...</span>
                  </div>
                ) : (
                  <>
                    {/* Shift details */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Opened At:</span>
                        <span className="font-bold text-slate-800">{new Date(activeSession.opened_at).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Cashier:</span>
                        <span className="font-bold text-slate-800 capitalize">{userName || "Staff"}</span>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Shift Financial Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                          <span className="text-slate-500 font-medium">Opening Float (Starting Cash):</span>
                          <span className="font-bold text-slate-850">Rs {Number(activeSession.opening_balance).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs bg-emerald-50/30 p-2.5 rounded-xl border border-emerald-100/30">
                          <span className="text-emerald-700 font-medium">Cash Sales (incl. Credit Collections):</span>
                          <span className="font-bold text-emerald-650">Rs {
                            shiftInvoices
                              .filter(inv => inv.payment_mode === "cash" || inv.payment_mode === "credit")
                              .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0)
                              .toLocaleString()
                          }</span>
                        </div>
                        <div className="flex justify-between text-xs bg-blue-50/30 p-2.5 rounded-xl border border-blue-100/30">
                          <span className="text-blue-700 font-medium">Card Sales (Received via Bank/POS):</span>
                          <span className="font-bold text-blue-650">Rs {
                            shiftInvoices
                              .filter(inv => inv.payment_mode === "card")
                              .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0)
                              .toLocaleString()
                          }</span>
                        </div>
                        <div className="flex justify-between text-xs bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800 font-bold">
                          <span>Expected Drawer Cash:</span>
                          <span className="text-indigo-400 text-sm">Rs {
                            (Number(activeSession.opening_balance) + 
                             shiftInvoices
                              .filter(inv => inv.payment_mode === "cash" || inv.payment_mode === "credit")
                              .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0)
                            ).toLocaleString()
                          }</span>
                        </div>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3.5 border-t border-slate-100 pt-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          Actual Cash Counted (Rs)
                        </label>
                        <Input
                          type="number"
                          placeholder="Enter exact cash in drawer"
                          value={actualCashCounted || ""}
                          onChange={(e) => setActualCashCounted(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="h-10 text-xs rounded-xl font-bold"
                        />
                      </div>

                      {/* Difference */}
                      <div className="flex justify-between items-center p-3 rounded-xl border border-dashed text-xs font-bold bg-slate-50/30">
                        <span className="text-slate-500">Difference (Shortage / Overage):</span>
                        {(() => {
                          const expected = Number(activeSession.opening_balance) + 
                            shiftInvoices
                              .filter(inv => inv.payment_mode === "cash" || inv.payment_mode === "credit")
                              .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
                          const diff = actualCashCounted - expected;
                          
                          if (diff > 0) {
                            return <span className="text-emerald-650 font-black">+Rs {diff.toLocaleString()} (Overage)</span>;
                          } else if (diff < 0) {
                            return <span className="text-red-650 font-black">-Rs {Math.abs(diff).toLocaleString()} (Shortage)</span>;
                          } else {
                            return <span className="text-slate-550">Rs 0 (Balanced)</span>;
                          }
                        })()}
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                          Closing Session Note (Optional)
                        </label>
                        <textarea
                          placeholder="e.g. cash balanced, minor shortage due to change, shift handed over to Ali"
                          value={closingNote}
                          onChange={(e) => setClosingNote(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-xl p-2.5 h-16 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-800"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-4 pt-3 border-t border-slate-100 shrink-0">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCloseRegisterOpen(false)}
                  className="flex-1 text-slate-655 font-bold h-10 rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCloseRegister}
                  disabled={isClosingRegister || loadingShiftStats}
                  className="flex-1 bg-red-650 hover:bg-red-700 text-white font-extrabold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-500/10"
                >
                  {isClosingRegister ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut size={14} />
                  )}
                  Confirm & Close Shift
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
