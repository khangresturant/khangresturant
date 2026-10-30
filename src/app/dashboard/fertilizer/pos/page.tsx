"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, ShoppingCart, UserPlus, Trash2, Plus, Minus, 
  Check, X, Printer, Loader2, ArrowRight, Leaf, ShieldCheck,
  Calendar, User, CheckCircle2, Info
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { ReceiptTemplate, DEFAULT_RECEIPT_SETTINGS } from "@/components/ReceiptTemplate";
import { printReceiptDirect } from "@/lib/thermalPrinter";

type Product = {
  id: string;
  name: string;
  code: string | null;
  sale_price_single: number;
  purchase_price_single: number;
  current_stock: number;
  measurement_type: string | null;
  formula?: string | null;
};

type Batch = {
  id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string | null;
  stock_quantity: number;
  purchase_price: number;
};

type Party = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
  cnic_number?: string | null;
  father_name?: string | null;
};

type SeasonalKhata = {
  id: string;
  party_id: string;
  crop_season: string;
  credit_limit: number;
  outstanding_balance: number;
  expected_harvest_payback: string | null;
  status: string;
};

type CartItem = {
  product: Product;
  quantity: number;
  price: number;
  selectedBatch: Batch | null;
};

export default function FertilizerPOSPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [seasonalKhatas, setSeasonalKhatas] = useState<SeasonalKhata[]>([]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState<Product[]>([]);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [selectedSeason, setSelectedSeason] = useState<string>("Rabi (Wheat) 2026");
  const [cropSeasons, setCropSeasons] = useState<string[]>([
    "Rabi (Wheat) 2026",
    "Kharif (Cotton) 2026",
    "Kharif (Rice) 2026",
    "Rabi (Sugarcane) 2026-27"
  ]);

  // Cart & Invoice States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [subsidyAmount, setSubsidyAmount] = useState<number>(0);
  const [subsidyVoucher, setSubsidyVoucher] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("0");
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit" | "bank">("cash");
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>("");

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


  // Modals & Extras
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [receiptSettings, setReceiptSettings] = useState<any>(DEFAULT_RECEIPT_SETTINGS);
  const [shopDetails, setShopDetails] = useState<any>({ name: shopName || "The Accounts Store" });
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);

  // New Customer Form
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
    father_name: "",
    cnic_number: "",
    address: "",
  });

  // New Seasonal Khata Form
  const [newSeasonForm, setNewSeasonForm] = useState({
    crop_season: "Rabi (Wheat) 2026",
    credit_limit: 500000,
    expected_harvest_payback: "",
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shopId) {
      loadData();
    }
  }, [shopId]);

  // Handle autocomplete filtering
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setAutocompleteResults([]);
      setIsSearchDropdownOpen(false);
      return;
    }

    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.formula && p.formula.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    setAutocompleteResults(filtered.slice(0, 8));
    setSelectedSearchIndex(0);
    setIsSearchDropdownOpen(true);
  }, [searchQuery, products]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Products
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("id, name, code, sale_price_single, purchase_price_single, current_stock, measurement_type, formula")
        .eq("shop_id", shopId)
        .order("name");
      if (prodErr) throw prodErr;
      setProducts(prodData || []);

      // 2. Fetch Batches
      const { data: batchData, error: batchErr } = await supabase
        .from("product_batches")
        .select("*")
        .eq("shop_id", shopId);
      if (batchErr) throw batchErr;
      setBatches(batchData || []);

      // 3. Fetch Farmers (parties with type = 'customer')
      const { data: partyData, error: partyErr } = await supabase
        .from("parties")
        .select("id, name, phone, current_balance, cnic_number, father_name")
        .eq("shop_id", shopId)
        .in("type", ["customer", "dual"])
        .order("name");
      if (partyErr) throw partyErr;
      setParties(partyData || []);

      // 4. Fetch Seasonal Khatas
      const { data: khataData, error: khataErr } = await supabase
        .from("seasonal_khata")
        .select("*")
        .eq("shop_id", shopId);
      if (khataErr) throw khataErr;
      setSeasonalKhatas(khataData || []);

      if (khataData) {
        const dbSeasons = Array.from(new Set(khataData.map((k: any) => String(k.crop_season)).filter(Boolean)));
        setCropSeasons(prev => {
          const combined = [...prev, ...dbSeasons];
          return Array.from(new Set(combined)) as string[];
        });
      }

      // 5. Fetch Cash Accounts
      const { data: accountsData, error: accErr } = await supabase
        .from("cash_accounts")
        .select("id, name, type, current_balance")
        .eq("shop_id", shopId)
        .or(`type.eq.cash,type.eq.bank`);
      if (accErr) throw accErr;
      setCashAccounts(accountsData || []);
      if (accountsData && accountsData.length > 0) {
        setSelectedCashAccountId(accountsData[0].id);
      }

      // 6. Fetch print_settings for customized receipts
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

      // 7. Fetch company_details for receipt contact info
      const { data: companyData, error: companyError } = await supabase
        .from("company_details")
        .select("name, address, phone, email, website")
        .eq("shop_id", shopId)
        .maybeSingle();

      if (!companyError && companyData) {
        setShopDetails(companyData);
      } else {
        setShopDetails({ name: shopName || "The Accounts Store" });
      }

    } catch (error: any) {
      toast.error("Failed to load POS data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard navigation for Search Autocomplete
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchDropdownOpen || autocompleteResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSearchIndex(prev => (prev + 1 < autocompleteResults.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSearchIndex(prev => (prev - 1 >= 0 ? prev - 1 : autocompleteResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selectedProduct = autocompleteResults[selectedSearchIndex];
      if (selectedProduct) {
        handleAddToCart(selectedProduct);
      }
    } else if (e.key === "Escape") {
      setIsSearchDropdownOpen(false);
    }
  };

  // Farmer Details
  const selectedFarmer = parties.find(p => p.id === selectedCustomerId);
  const activeSeasonalKhata = seasonalKhatas.find(
    k => k.party_id === selectedCustomerId && k.crop_season === selectedSeason
  );

  // Cart Calculations
  const grossTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const netTotal = Math.max(0, grossTotal - subsidyAmount);
  const remainingDue = Math.max(0, netTotal - Number(paidAmount));

  // Set received amount to netTotal for cash checkout
  useEffect(() => {
    if (paymentMode !== "credit") {
      setPaidAmount(netTotal.toString());
    } else {
      setPaidAmount("0");
    }
  }, [paymentMode, netTotal]);

  const handleAddToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      handleUpdateQty(product.id, existing.quantity + 1);
      setSearchQuery("");
      setIsSearchDropdownOpen(false);
      return;
    }

    const prodBatches = batches.filter(b => b.product_id === product.id);
    const availableBatch = prodBatches.find(b => b.stock_quantity > 0) || prodBatches[0] || null;

    setCart([
      ...cart,
      {
        product,
        quantity: 1,
        price: product.sale_price_single || 0,
        selectedBatch: availableBatch,
      }
    ]);
    setSearchQuery("");
    setIsSearchDropdownOpen(false);
    toast.success(`${product.name} added to cart!`);
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(item => item.product.id !== productId));
      return;
    }

    setCart(
      cart.map(item => {
        if (item.product.id === productId) {
          const maxStock = item.selectedBatch ? item.selectedBatch.stock_quantity : item.product.current_stock;
          if (qty > maxStock) {
            toast.warning(`Quantity exceeds available stock (${maxStock} bags)!`);
            return { ...item, quantity: maxStock };
          }
          return { ...item, quantity: qty };
        }
        return item;
      })
    );
  };

  // Price Edit features
  const handleUpdatePrice = (productId: string, price: number) => {
    if (price < 0) return;
    setCart(
      cart.map(item => {
        if (item.product.id === productId) {
          return { ...item, price };
        }
        return item;
      })
    );
  };

  // Total Edit features (Back calculates Qty)
  const handleUpdateTotal = (productId: string, totalVal: number) => {
    if (totalVal < 0) return;
    setCart(
      cart.map(item => {
        if (item.product.id === productId) {
          if (item.price > 0) {
            const calculatedQty = Math.round((totalVal / item.price) * 1000) / 1000;
            const maxStock = item.selectedBatch ? item.selectedBatch.stock_quantity : item.product.current_stock;
            if (calculatedQty > maxStock) {
              toast.warning(`Calculated qty (${calculatedQty}) exceeds stock (${maxStock})!`);
              return { ...item, quantity: maxStock };
            }
            return { ...item, quantity: calculatedQty };
          }
        }
        return item;
      })
    );
  };

  const handleSelectBatch = (productId: string, batchId: string) => {
    const selected = batches.find(b => b.id === batchId) || null;
    setCart(
      cart.map(item => {
        if (item.product.id === productId) {
          const maxStock = selected ? selected.stock_quantity : item.product.current_stock;
          return {
            ...item,
            selectedBatch: selected,
            quantity: Math.min(item.quantity, maxStock > 0 ? maxStock : 1)
          };
        }
        return item;
      })
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Add New Customer (Farmer)
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name) {
      toast.error("Farmer Name is required");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          shop_id: shopId,
          type: "customer",
          name: newCustomerForm.name,
          phone: newCustomerForm.phone || null,
          father_name: newCustomerForm.father_name || null,
          cnic_number: newCustomerForm.cnic_number || null,
          address: newCustomerForm.address || null,
          current_balance: 0,
        })
        .select()
        .single();

      if (error) throw error;
      setParties([data, ...parties]);
      setSelectedCustomerId(data.id);
      setIsCustomerModalOpen(false);
      toast.success("Farmer profile created successfully!");
      setNewCustomerForm({ name: "", phone: "", father_name: "", cnic_number: "", address: "" });
    } catch (err: any) {
      toast.error("Failed to create customer: " + err.message);
    }
  };

  // Create Seasonal Khata Account
  const handleCreateSeasonalKhata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomerId === "walkin") {
      toast.error("Please select a registered farmer first");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("seasonal_khata")
        .insert({
          shop_id: shopId,
          party_id: selectedCustomerId,
          crop_season: newSeasonForm.crop_season,
          credit_limit: Number(newSeasonForm.credit_limit) || 0,
          outstanding_balance: 0,
          expected_harvest_payback: newSeasonForm.expected_harvest_payback || null,
          status: "active"
        })
        .select()
        .single();

      if (error) throw error;
      setSeasonalKhatas([data, ...seasonalKhatas]);
      setIsSeasonModalOpen(false);
      toast.success(`Seasonal credit account opened for ${newSeasonForm.crop_season}!`);
    } catch (err: any) {
      toast.error("Failed to open seasonal khata: " + err.message);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }

    if (paymentMode === "credit") {
      if (selectedCustomerId === "walkin") {
        toast.error("Credit (Khata) sale requires selecting a registered farmer.");
        return;
      }
      if (!activeSeasonalKhata) {
        toast.error(`No Seasonal Khata account is open for ${selectedSeason}. Please open one first!`);
        return;
      }
      const currentOutstanding = Number(activeSeasonalKhata.outstanding_balance) || 0;
      const creditLimit = Number(activeSeasonalKhata.credit_limit) || 0;
      if (currentOutstanding + remainingDue > creditLimit) {
        const confirmOverlimit = window.confirm(
          `Outstanding limit exceeded!\nOutstanding: Rs. ${currentOutstanding}\nThis Invoice: Rs. ${remainingDue}\nLimit: Rs. ${creditLimit}\n\nDo you want to authorize this sale anyway?`
        );
        if (!confirmOverlimit) return;
      }
    }

    setIsCheckoutLoading(true);

    try {
      // 1. Create Invoice
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .insert({
          shop_id: shopId,
          party_id: selectedCustomerId === "walkin" ? null : selectedCustomerId,
          total_amount: netTotal,
          paid_amount: paymentMode === "credit" ? Number(paidAmount) || 0 : netTotal,
          discount: 0,
          tax_amount: 0,
          tax_rate: 0,
          status: paymentMode === "credit" ? (Number(paidAmount) > 0 ? "partial" : "unpaid") : "paid",
          payment_mode: paymentMode === "credit" ? "credit" : "cash",
          account_id: paymentMode === "credit" ? null : getValidAccountId(selectedCashAccountId, cashAccounts),
          subsidy_amount: subsidyAmount || 0,
          subsidy_voucher: subsidyVoucher || null,
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // 2. Create Invoice Items and Update stock
      for (const item of cart) {
        const { error: itemErr } = await supabase
          .from("invoice_items")
          .insert({
            invoice_id: invData.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.price,
            subtotal: item.price * item.quantity,
            variant_id: null,
            packing_name: null,
            batch_id: item.selectedBatch?.id || null,
            batch_number: item.selectedBatch?.batch_number || null,
          });

        if (itemErr) throw itemErr;

        if (item.selectedBatch) {
          const newBatchStock = Math.max(0, item.selectedBatch.stock_quantity - item.quantity);
          await supabase
            .from("product_batches")
            .update({ stock_quantity: newBatchStock })
            .eq("id", item.selectedBatch.id);
        }

        const newProductStock = Math.max(0, item.product.current_stock - item.quantity);
        await supabase
          .from("products")
          .update({ current_stock: newProductStock })
          .eq("id", item.product.id);
      }

      // 3. Handle Cash Ledger Entry
      if (paymentMode !== "credit" || Number(paidAmount) > 0) {
        const cashAmount = paymentMode === "credit" ? Number(paidAmount) : netTotal;
        
        // Update selected cash account balance in database
        const currentAcc = cashAccounts.find(a => a.id === selectedCashAccountId);
        if (currentAcc) {
          await supabase
            .from("cash_accounts")
            .update({ current_balance: Number(currentAcc.current_balance || 0) + cashAmount })
            .eq("id", selectedCashAccountId);
        }

        await supabase.from("account_transactions").insert({
          shop_id: shopId,
          account_id: selectedCashAccountId,
          type: "deposit",
          amount: cashAmount,
          ref_type: "invoice",
          ref_id: invData.id,
          remarks: `Fertilizer POS Sale Received - Invoice #${invData.id.slice(0, 8).toUpperCase()}`,
        });
      }

      // 4. Handle Credit Sale updates
      if (paymentMode === "credit" && remainingDue > 0 && selectedFarmer) {
        await supabase.from("credit_transactions").insert({
          shop_id: shopId,
          customer_id: selectedCustomerId,
          amount: remainingDue,
          transaction_type: "charge",
          remarks: `Seasonal Credit extended on Invoice #${invData.id.slice(0, 8).toUpperCase()} for ${selectedSeason}`,
        });

        const newPartyBalance = (selectedFarmer.current_balance || 0) + remainingDue;
        await supabase
          .from("parties")
          .update({ current_balance: newPartyBalance })
          .eq("id", selectedCustomerId);

        if (activeSeasonalKhata) {
          const newKhataBalance = (activeSeasonalKhata.outstanding_balance || 0) + remainingDue;
          await supabase
            .from("seasonal_khata")
            .update({ outstanding_balance: newKhataBalance })
            .eq("id", activeSeasonalKhata.id);
        }
      }

      toast.success("Invoice generated successfully!");
      setLastInvoice({
        invoice: invData,
        items: cart,
        farmer: selectedFarmer,
        season: selectedSeason,
        paymentMode,
        subsidyVoucher,
        subsidyAmount,
        grossTotal,
        netTotal,
        paidAmount,
        remainingDue
      });
      setShowReceipt(true);
      setCart([]);
      setSubsidyAmount(0);
      setSubsidyVoucher("");
      setPaidAmount("0");

      loadData();

    } catch (err: any) {
      toast.error("Checkout failed: " + err.message);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handlePrint = () => {
    const receiptElement = document.getElementById("fertilizer-invoice-print-container");
    if (!receiptElement || !lastInvoice) return;

    printReceiptDirect({
      receiptHtml: receiptElement.innerHTML,
      settings: receiptSettings,
      title: `Agri Invoice #${lastInvoice.invoice?.id?.slice(0, 8).toUpperCase() || "Receipt"}`,
      onSuccess: () => toast.success("Printing receipt..."),
      onError: (err) => toast.error("Printing failed: " + (err?.message || "Check printer"))
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[85vh] font-sans text-slate-800 animate-in fade-in duration-300">
      
      {/* LEFT COLUMN: Search, Farmer Selection, and Cart Table */}
      <div className="flex-1 flex flex-col justify-between bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6">
        <div>
          {/* Header & Title */}
          <div className="mb-4">
            <h1 className="text-lg font-black text-blue-900 flex items-center gap-2">
              <Leaf className="text-emerald-500 fill-emerald-100" /> Fertilizer & Seeds POS
            </h1>
            
          </div>

          {/* 1. Farmer, Season & Credit Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 mb-5 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            
            {/* Farmer Selector */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-650 tracking-wider uppercase flex items-center gap-1">
                    <User size={14} className="text-emerald-500" /> Farmer Profile
                  </label>
                  <Button 
                    onClick={() => setIsCustomerModalOpen(true)}
                    size="sm" 
                    variant="ghost" 
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-extrabold p-0 h-auto cursor-pointer"
                  >
                    <UserPlus size={13} className="mr-1" /> Add Farmer
                  </Button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setPaymentMode(e.target.value === "walkin" ? "cash" : "credit");
                  }}
                  className="w-full bg-white border border-slate-200 text-slate-850 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                >
                  <option value="walkin">Walk-in Customer (Cash Sale)</option>
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.father_name ? `s/o ${p.father_name}` : ""} ({p.phone || "No Phone"})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomerId !== "walkin" && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-650 tracking-wider uppercase flex items-center gap-1">
                      <Calendar size={14} className="text-indigo-500" /> Active Crop Season
                    </label>
                    <Button 
                      onClick={() => setIsSeasonModalOpen(true)}
                      size="sm" 
                      variant="ghost" 
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-extrabold p-0 h-auto cursor-pointer"
                    >
                      <Plus size={11} /> Open Account
                    </Button>
                  </div>
                  <select
                    value={selectedSeason}
                    onChange={(e) => {
                      if (e.target.value === "add_custom") {
                        const name = prompt("Enter Custom Crop Season Name (e.g., Rabi (Maize) 2026):");
                        if (name && name.trim()) {
                          const trimmed = name.trim();
                          setCropSeasons(prev => {
                            if (prev.includes(trimmed)) return prev;
                            return [...prev, trimmed];
                          });
                          setSelectedSeason(trimmed);
                        }
                      } else {
                        setSelectedSeason(e.target.value);
                      }
                    }}
                    className="w-full bg-white border border-slate-200 text-slate-850 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                  >
                    {cropSeasons.map(season => (
                      <option key={season} value={season}>{season}</option>
                    ))}
                    <option value="add_custom" className="text-emerald-600 font-bold">+ Add Custom Season...</option>
                  </select>
                </div>
              )}
            </div>

            {/* Credit Limit Display */}
            {selectedCustomerId !== "walkin" && (
              <div className="xl:w-[320px] bg-white border border-slate-100 p-4 rounded-2xl shadow-sm space-y-2 text-xs flex-shrink-0">
                {activeSeasonalKhata ? (
                  <>
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-500">Credit Limit:</span>
                      <span className="text-slate-850">Rs. {Number(activeSeasonalKhata.credit_limit).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-500">Outstanding Seasonal Balance:</span>
                      <span className="text-amber-600">Rs. {Number(activeSeasonalKhata.outstanding_balance).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5 font-bold text-sm">
                      <span className="text-slate-500">Available Limit:</span>
                      <span className="text-emerald-600">Rs. {(Number(activeSeasonalKhata.credit_limit) - Number(activeSeasonalKhata.outstanding_balance)).toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 py-1.5 text-center">
                    <Info size={16} />
                    <span className="font-semibold text-[11px]">No active credit account open for this season.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. AUTOCOMPLETE PRODUCT SEARCH */}
          <div className="relative mb-5">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Search Products (کھاد اور بیج تلاش کریں)</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input 
                ref={searchInputRef}
                placeholder="Type Product Name, Code, Brand, or Active Chemical Formula..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-11 h-12 bg-slate-50 border-slate-200 text-slate-900 text-sm rounded-2xl focus-visible:ring-emerald-500/20"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Floating results */}
            {isSearchDropdownOpen && autocompleteResults.length > 0 && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsSearchDropdownOpen(false)} />
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-[300px] overflow-y-auto p-2 space-y-1">
                  {autocompleteResults.map((product, pIdx) => {
                    const isHighlighted = selectedSearchIndex === pIdx;
                    const hasStock = product.current_stock > 0;
                    
                    return (
                      <div
                        key={product.id}
                        onClick={() => hasStock && handleAddToCart(product)}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all cursor-pointer border ${
                          isHighlighted 
                            ? "bg-emerald-50 border-emerald-200 text-slate-900 font-semibold" 
                            : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors border-transparent text-slate-700"
                        } ${!hasStock ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-850 truncate">{product.name}</span>
                            {product.code && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                {product.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            <span>Stock: <strong className={hasStock ? "text-slate-700" : "text-red-500"}>{product.current_stock} Bags</strong></span>
                            {product.formula && <span>Formula: <strong>{product.formula}</strong></span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-600">Rs. {product.sale_price_single.toLocaleString()}</span>
                          <span className="block text-[10px] text-slate-400 font-medium">Rate / Bag</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 3. CART TABLE */}
          <div className="overflow-x-auto border border-slate-200 rounded-3xl bg-slate-50/20 p-4 min-h-[300px]">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-400 py-20 gap-3">
                <ShoppingCart size={40} className="text-slate-200 fill-slate-100" />
                
                
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-250 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 px-3">Product details</th>
                    <th className="pb-3 px-3 w-[160px]">Batch / Expiry</th>
                    <th className="pb-3 px-3 w-[120px] text-right">Price/Bag</th>
                    <th className="pb-3 px-3 w-[130px] text-center">Qty</th>
                    <th className="pb-3 px-3 w-[130px] text-right">Total (Rs)</th>
                    <th className="pb-3 px-3 w-[50px] text-center">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => {
                    const prodBatches = batches.filter(b => b.product_id === item.product.id);
                    
                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/30 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-850">
                          <div>
                            
                            {item.product.formula && (
                              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{item.product.formula}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {prodBatches.length > 0 ? (
                            <select
                              value={item.selectedBatch?.id || ""}
                              onChange={(e) => handleSelectBatch(item.product.id, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-800 font-bold focus:outline-none"
                            >
                              {prodBatches.map(b => (
                                <option key={b.id} value={b.id}>
                                  {b.batch_number} ({b.stock_quantity} left)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[10px] text-slate-450 italic">No batches</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Input
                            type="number"
                            value={item.price || ""}
                            onChange={(e) => handleUpdatePrice(item.product.id, Number(e.target.value) || 0)}
                            className="w-[100px] ml-auto text-right font-mono font-bold h-8 bg-white border-slate-200 rounded-xl text-slate-900"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => handleUpdateQty(item.product.id, item.quantity - 1)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-650 cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <Input
                              type="number"
                              value={item.quantity || ""}
                              onChange={(e) => handleUpdateQty(item.product.id, Number(e.target.value) || 0)}
                              className="w-12 h-8 text-center font-bold font-mono bg-white border-slate-200 rounded-xl text-slate-900"
                            />
                            <button 
                              onClick={() => handleUpdateQty(item.product.id, item.quantity + 1)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-650 cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Input
                            type="number"
                            value={Math.round(item.price * item.quantity * 100) / 100}
                            onChange={(e) => handleUpdateTotal(item.product.id, Number(e.target.value) || 0)}
                            className="w-[110px] ml-auto text-right font-mono font-bold h-8 bg-white border-slate-200 rounded-xl text-slate-900"
                          />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button 
                            onClick={() => handleRemoveFromCart(item.product.id)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Audit footer */}
        <div className="mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-500" /> Government Subsidy Audit Logging compliant.</span>
          <span className="font-semibold text-slate-700">{shopName}</span>
        </div>
      </div>

      {/* RIGHT COLUMN: SETTLEMENT PANEL */}
      <div className="w-full md:w-[350px] bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <h3 className="font-extrabold text-base border-b border-slate-800 pb-2 flex items-center gap-2">
            <ShoppingCart size={18} className="text-emerald-400" /> Settle Transaction
          </h3>

          {/* Govt Subsidy Details */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">4. Govt Subsidy Voucher</label>
            <div className="space-y-2 text-slate-900">
              <Input 
                placeholder="Voucher Code" 
                value={subsidyVoucher}
                onChange={(e) => setSubsidyVoucher(e.target.value)}
                className="h-10 bg-slate-800 border-slate-750 text-white rounded-xl text-xs placeholder:text-slate-600"
              />
              <Input 
                type="number"
                placeholder="Subsidy Discount Amount" 
                value={subsidyAmount || ""}
                onChange={(e) => setSubsidyAmount(Number(e.target.value) || 0)}
                className="h-10 bg-slate-800 border-slate-750 text-white rounded-xl text-xs placeholder:text-slate-600 font-mono"
              />
            </div>
          </div>

          {/* Calculations Summary */}
          <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800/80 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Gross Sale Total:</span>
              <span className="font-semibold font-mono">Rs. {grossTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span className="font-semibold">Govt Fertilizer Subsidy:</span>
              <span className="font-mono">- Rs. {subsidyAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-700/50 pt-2 font-bold text-sm">
              <span>Net Payable:</span>
              <span className="text-emerald-400 font-mono">Rs. {netTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Settlement Mode Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">5. Settlement Mode</label>
            <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setPaymentMode("cash")}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  paymentMode === "cash" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Cash Sale
              </button>
              <button
                onClick={() => setPaymentMode("credit")}
                disabled={selectedCustomerId === "walkin"}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  paymentMode === "credit" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-200 disabled:opacity-40"
                }`}
              >
                Khata Sale
              </button>
              <button
                onClick={() => setPaymentMode("bank")}
                className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  paymentMode === "bank" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Bank
              </button>
            </div>
          </div>

          {/* settlement details input */}
          <div className="space-y-2">
            {paymentMode === "credit" ? (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px]">
                  <label className="font-bold text-slate-400 uppercase">Cash Paid (Rs)</label>
                  <span className="text-slate-450 font-bold">Udhaar: Rs. {remainingDue.toLocaleString()}</span>
                </div>
                <Input 
                  type="number"
                  placeholder="Down payment amount received" 
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="h-10 bg-slate-800 border-slate-750 text-white rounded-xl text-xs font-mono"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-slate-455 font-semibold">Deposit Account:</span>
                <select
                  value={selectedCashAccountId}
                  onChange={(e) => setSelectedCashAccountId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none mt-1"
                >
                  {cashAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <Button 
          onClick={handleCheckout}
          disabled={cart.length === 0 || isCheckoutLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-12 rounded-2xl shadow-lg mt-6 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isCheckoutLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Billing...
            </>
          ) : (
            <>
              Confirm Invoice <ArrowRight size={16} />
            </>
          )}
        </Button>
      </div>

      {/* MODALS */}
      
      {/* 1. Add Farmer Modal */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsCustomerModalOpen(false)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md relative z-10 text-slate-850 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-lg text-slate-900">Add Farmer Profile (نیا کاشتکار درج کریں)</h3>
                <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-650">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Farmer Name * (نام کاشتکار)</label>
                  <Input 
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    placeholder="Chaudhary Niaz"
                    className="bg-slate-50 border-slate-200 text-slate-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Father's Name (ولدیت)</label>
                  <Input 
                    value={newCustomerForm.father_name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, father_name: e.target.value })}
                    placeholder="Father Name"
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">CNIC Number (قومی شناختی کارڈ نمبر)</label>
                  <Input 
                    value={newCustomerForm.cnic_number}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, cnic_number: e.target.value })}
                    placeholder="35202-XXXXXXX-X"
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Phone Number (موبائل نمبر)</label>
                  <Input 
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    placeholder="0300XXXXXXX"
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Address (پتہ)</label>
                  <Input 
                    value={newCustomerForm.address}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                    placeholder="Chak No. 12/GD"
                    className="bg-slate-50 border-slate-200 text-slate-900"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setIsCustomerModalOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6">Save Profile</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Open Seasonal Khata Account Modal */}
      <AnimatePresence>
        {isSeasonModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsSeasonModalOpen(false)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md relative z-10 text-slate-850 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-lg text-slate-900">Open Crop-Season Credit (موسمی کھاتہ کھولیں)</h3>
                <button onClick={() => setIsSeasonModalOpen(false)} className="text-slate-400 hover:text-slate-655">
                  <X size={20} />
                </button>
              </div>

              {selectedCustomerId === "walkin" ? (
                <div className="py-4 text-center">
                  
                </div>
              ) : (
                <form onSubmit={handleCreateSeasonalKhata} className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl flex items-center gap-3">
                    <User className="h-5 w-5 text-emerald-600" />
                    <div>
                      
                      
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Crop / Crop Season * (فصل کا موسم)</label>
                    <select
                      value={newSeasonForm.crop_season}
                      onChange={(e) => {
                        if (e.target.value === "add_custom") {
                          const name = prompt("Enter Custom Crop Season Name (e.g., Rabi (Maize) 2026):");
                          if (name && name.trim()) {
                            const trimmed = name.trim();
                            setCropSeasons(prev => {
                              if (prev.includes(trimmed)) return prev;
                              return [...prev, trimmed];
                            });
                            setNewSeasonForm({ ...newSeasonForm, crop_season: trimmed });
                          }
                        } else {
                          setNewSeasonForm({ ...newSeasonForm, crop_season: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-850 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    >
                      {cropSeasons.map(season => (
                        <option key={season} value={season}>{season}</option>
                      ))}
                      <option value="add_custom" className="text-emerald-600 font-bold">+ Add Custom Season...</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Credit Limit * (ادھار کی حد - روپیہ)</label>
                    <Input 
                      type="number"
                      value={newSeasonForm.credit_limit}
                      onChange={(e) => setNewSeasonForm({ ...newSeasonForm, credit_limit: Number(e.target.value) || 0 })}
                      placeholder="500000"
                      className="bg-slate-50 border-slate-200 text-slate-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Expected Harvest Payback Date (فصل کٹائی پر واپسی کی متوقع تاریخ)</label>
                    <Input 
                      type="date" 
                      value={newSeasonForm.expected_harvest_payback}
                      onChange={(e) => setNewSeasonForm({ ...newSeasonForm, expected_harvest_payback: e.target.value })}
                      className="bg-slate-50 border-slate-200 text-slate-900"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsSeasonModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6">Open seasonal limit</Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Receipt / Invoice Modal */}
      <AnimatePresence>
        {showReceipt && lastInvoice && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setShowReceipt(false)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg relative z-10 text-slate-850 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b">
                <h3 className="font-extrabold text-lg text-slate-955 flex items-center gap-1.5">
                  <CheckCircle2 className="text-emerald-500" /> Invoice Settled successfully!
                </h3>
                <button onClick={() => setShowReceipt(false)} className="text-slate-400 hover:text-slate-655">
                  <X size={20} />
                </button>
              </div>

              {/* Receipt Body (Simulated Print Sheet) */}
              <div className="bg-slate-100 p-2.5 rounded-2xl border border-slate-200/50 max-h-[460px] overflow-y-auto flex items-start justify-center custom-scrollbar w-full">
                <div id="fertilizer-invoice-print-container" className="bg-white shadow-sm rounded-md">
                  <ReceiptTemplate 
                    settings={receiptSettings} 
                    invoice={lastInvoice ? {
                      id: lastInvoice.invoice.id,
                      created_at: lastInvoice.invoice.created_at,
                      customer_name: lastInvoice.farmer?.name || "Walk-in Farmer",
                      customer_father_name: lastInvoice.farmer?.father_name,
                      customer_cnic: lastInvoice.farmer?.cnic_number,
                      customer_phone: lastInvoice.farmer?.phone,
                      crop_season: lastInvoice.season,
                      payment_mode: lastInvoice.paymentMode,
                      received_amount: Number(lastInvoice.paidAmount),
                      tax_amount: 0,
                      discount: 0,
                      total_amount: lastInvoice.netTotal,
                      subsidy_amount: lastInvoice.subsidyAmount,
                      subsidy_voucher: lastInvoice.subsidyVoucher,
                      remaining_due: lastInvoice.remainingDue,
                      items: lastInvoice.items.map((item: any) => ({
                        name: item.product.name,
                        quantity: item.quantity,
                        price: item.price,
                        packingName: item.product.measurement_type,
                        code: item.product.code,
                        selectedBatch: item.selectedBatch
                      }))
                    } : null} 
                    shopDetails={shopDetails} 
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={() => setShowReceipt(false)}>Close</Button>
                <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1">
                  <Printer size={16} /> Print Invoice
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
