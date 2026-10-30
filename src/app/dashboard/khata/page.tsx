"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, PlusCircle, ArrowDownLeft, ArrowUpRight, ArrowLeft,
  Phone, History, DollarSign, Loader2, Save, X, BookOpen, AlertCircle, RefreshCw, Edit2, Printer, Trash2,
  FileText, Sparkles, Download, ChevronDown, ChevronUp, Filter, Receipt
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyPartyPaymentRpc, isMoneyRpcEnabled } from "@/lib/money/rpc";
import { withOfflineRead, executeOrQueue, isBrowserOffline } from "@/lib/sync/offlineData";
import { loadShopSnapshot } from "@/utils/syncQueue";
import { isNetworkError } from "@/lib/sync/offlineCheckout";
import { MobileCardList, MobileDataCard } from "@/components/mobile/MobileDataCard";

type Party = {
  id: string;
  name: string;
  phone: string | null;
  type: "customer" | "supplier" | "dual";
  current_balance: number;
  opening_balance?: number | null;
  created_at: string;
  cnic_number?: string | null;
  father_name?: string | null;
  address?: string | null;
  note?: string | null;
  credit_limit?: number | null;
  is_deleted?: boolean | null;
};

const isPartyDeleted = (p: Party): boolean => {
  return Boolean(
    p.is_deleted === true ||
    p.note?.includes("[ARCHIVED]") ||
    p.note?.includes("[TRASH]") ||
    p.note?.includes("[DELETED]")
  );
};

type LedgerItem = {
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  packing_name?: string;
};

type LedgerEntry = {
  id: string;
  date: string;
  amount: number;
  type: "debit" | "credit"; // debit: increases customer balance (bill), credit: decreases customer balance (payment)
  source: "invoice" | "manual" | "system";
  remarks: string;
  runningBalance: number;
  edit_history?: any[];
  transaction_type?: string;
  items?: LedgerItem[];
  total_bill?: number;
  paid_amount?: number;
  remaining_credit?: number;
};

export default function KhataPage() {
  const { shopId, shopName, activeClosingBook, subscriptionTier, userRole } = useShop();
  const isAdmin = userRole === "admin" || userRole === "superadmin" || userRole === "owner" || !userRole;
  const { t } = useLanguage();
  const supabase = createClient();

  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "customer" | "supplier" | "trash">("all");
  const [showLedgerDetails, setShowLedgerDetails] = useState(false);
  const [isTrashActionLoading, setIsTrashActionLoading] = useState(false);

  // Ledger Filters & Pagination State
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<"all" | "debit" | "credit">("all");
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobilePdfMenu, setShowMobilePdfMenu] = useState(false);
  const itemsPerPage = 10;

  // Reset pagination when party or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedParty, ledgerSearch, ledgerTypeFilter, ledgerStartDate, ledgerEndDate]);
  // Modals State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<any | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSentList, setBulkSentList] = useState<string[]>([]);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<"receive" | "pay">("receive"); // receive = customer pays us (reduces their balance), pay = we pay supplier (reduces our debt) or we refund
  
  // Forms State
  const [isSubmittingParty, setIsSubmittingParty] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  
  const [newParty, setNewParty] = useState({
    name: "",
    phone: "",
    type: "customer" as "customer" | "supplier" | "dual",
    opening_balance: 0,
    address: "",
    cnic_number: "",
    father_name: "",
    note: "",
    credit_limit: "" as string | number
  });

  const [cashAccounts, setCashAccounts] = useState<{ id: string; name: string; current_balance: number }[]>([]);
  const [selectedTxAccountId, setSelectedTxAccountId] = useState("");

  const [newTx, setNewTx] = useState({
    amount: 0,
    remarks: ""
  });

  // Bill Receipt View Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  const [selectedBillItems, setSelectedBillItems] = useState<any[]>([]);
  const [selectedBillLoading, setSelectedBillLoading] = useState(false);
  const [selectedBillType, setSelectedBillType] = useState<"sales" | "purchase">("sales");

  // Edit Manual Transaction state
  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState(false);
  const [txToEdit, setTxToEdit] = useState<LedgerEntry | null>(null);
  const [editTxAmount, setEditTxAmount] = useState(0);
  const [editTxRemarks, setEditTxRemarks] = useState("");
  const [isSubmittingEditTx, setIsSubmittingEditTx] = useState(false);
  const [isDeletingTxId, setIsDeletingTxId] = useState<string | null>(null);

  // Contra Settlement states
  const [isContraOpen, setIsContraOpen] = useState(false);
  const [contraCustomer, setContraCustomer] = useState("");
  const [contraSupplier, setContraSupplier] = useState("");
  const [contraAmount, setContraAmount] = useState(0);
  const [contraRemarks, setContraRemarks] = useState("");
  const [submittingContra, setSubmittingContra] = useState(false);

  // Edit History Viewer Modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyTitle, setHistoryTitle] = useState("");

  // Detailed Itemized PDF states
  const [isGeneratingDetailedPDF, setIsGeneratingDetailedPDF] = useState(false);

  useEffect(() => {
    if (shopId) {
      fetchParties();
      fetchCashAccounts();
    }
  }, [shopId]);

  useEffect(() => {
    if (selectedParty) {
      fetchLedger(selectedParty);
    }
  }, [selectedParty]);

  const fetchParties = async () => {
    setLoading(true);
    try {
      const partiesList = await withOfflineRead({
        shopId: shopId!,
        online: async () => {
          // 1. Fetch Primary Parties
          const { data: rawParties, error: partiesErr } = await supabase
            .from("parties")
            .select("id, name, phone, type, current_balance, created_at, cnic_number, father_name, address, note, is_deleted")
            .eq("shop_id", shopId)
            .eq("is_deleted", false)
            .order("name", { ascending: true });

          if (partiesErr) {
            console.error("Error fetching parties from Supabase:", partiesErr);
            throw partiesErr;
          }

          let list: Party[] = (rawParties || []).map((p: any) => ({
            ...p,
            current_balance: Number(p.current_balance || 0),
            opening_balance: 0,
            credit_limit: null,
            is_deleted: false,
          }));

          // 2. Safely merge optional Showroom Parties, Installments, Vehicles if they exist
          try {
            const shwPartiesRes = await supabase
              .from("showroom_parties")
              .select("id, name, phone, party_type, is_dealer_showroom, current_balance, created_at, cnic, father_name, address, notes")
              .eq("shop_id", shopId)
              .order("name", { ascending: true });

            if (shwPartiesRes.data) {
              shwPartiesRes.data.forEach((sp: any) => {
                const exists = list.some(
                  (p: any) =>
                    p.id === sp.id ||
                    (p.name.trim().toLowerCase() === (sp.name || "").trim().toLowerCase() && p.phone === sp.phone)
                );
                if (!exists && sp.name) {
                  list.push({
                    id: sp.id,
                    name: sp.name.trim(),
                    phone: sp.phone || null,
                    type: sp.party_type === "seller" ? "supplier" : "customer",
                    current_balance: Number(sp.current_balance || 0),
                    opening_balance: 0,
                    created_at: sp.created_at,
                    cnic_number: sp.cnic || null,
                    father_name: sp.father_name || null,
                    address: sp.address || null,
                    note: sp.notes || (sp.is_dealer_showroom ? "Showroom Dealer / Partner" : "Showroom Party"),
                    credit_limit: null,
                    is_deleted: false,
                  });
                }
              });
            }
          } catch (e) {
            // Non-showroom shop, ignore gracefully
          }

          try {
            const shwInstsRes = await supabase
              .from("showroom_installments")
              .select("id, customer_name, customer_phone, customer_cnic, customer_father_name, customer_address, total_price, total_paid, remaining_balance, created_at, party_id")
              .eq("shop_id", shopId);

            if (shwInstsRes.data) {
              shwInstsRes.data.forEach((inst: any) => {
                if (!inst.customer_name) return;
                const exists = list.find(
                  (p: any) =>
                    (inst.party_id && p.id === inst.party_id) ||
                    p.name.trim().toLowerCase() === inst.customer_name.trim().toLowerCase()
                );
                if (!exists) {
                  list.push({
                    id: inst.party_id || `shw-inst-${inst.id}`,
                    name: inst.customer_name.trim(),
                    phone: inst.customer_phone || null,
                    type: "customer",
                    current_balance: Number(inst.remaining_balance || 0),
                    opening_balance: 0,
                    created_at: inst.created_at,
                    cnic_number: inst.customer_cnic || null,
                    father_name: inst.customer_father_name || null,
                    address: inst.customer_address || null,
                    note: "Showroom Installment Customer (اقساط گاہک)",
                    credit_limit: null,
                  });
                } else if (Number(inst.remaining_balance) > 0 && exists.current_balance === 0) {
                  exists.current_balance = Number(inst.remaining_balance);
                }
              });
            }
          } catch (e) {
            // Non-showroom shop, ignore gracefully
          }

          try {
            const shwVehsRes = await supabase
              .from("showroom_vehicles")
              .select("id, seller_name, seller_phone, seller_cnic, buyer_name, buyer_phone, buyer_cnic, purchase_price, sold_price, price, created_at")
              .eq("shop_id", shopId);

            if (shwVehsRes.data) {
              shwVehsRes.data.forEach((v: any) => {
                if (v.seller_name && v.seller_name.trim()) {
                  const exists = list.some((p: any) => p.name.trim().toLowerCase() === v.seller_name.trim().toLowerCase());
                  if (!exists) {
                    list.push({
                      id: `shw-seller-${v.id}`,
                      name: v.seller_name.trim(),
                      phone: v.seller_phone || null,
                      type: "supplier",
                      current_balance: 0,
                      opening_balance: 0,
                      created_at: v.created_at,
                      cnic_number: v.seller_cnic || null,
                      father_name: null,
                      address: null,
                      note: "Showroom Vehicle Seller / Dealer",
                      credit_limit: null,
                    });
                  }
                }
                if (v.buyer_name && v.buyer_name.trim()) {
                  const exists = list.some((p: any) => p.name.trim().toLowerCase() === v.buyer_name.trim().toLowerCase());
                  if (!exists) {
                    list.push({
                      id: `shw-buyer-${v.id}`,
                      name: v.buyer_name.trim(),
                      phone: v.buyer_phone || null,
                      type: "customer",
                      current_balance: 0,
                      opening_balance: 0,
                      created_at: v.created_at,
                      cnic_number: v.buyer_cnic || null,
                      father_name: null,
                      address: null,
                      note: "Showroom Vehicle Buyer",
                      credit_limit: null,
                    });
                  }
                }
              });
            }
          } catch (e) {
            // Non-showroom shop, ignore gracefully
          }

          if (activeClosingBook) {
            const { data: snaps, error: snapsErr } = await supabase
              .from("closing_balances")
              .select("party_id, balance")
              .eq("closing_book_id", activeClosingBook.id);
            if (!snapsErr && snaps) {
              list = list.map((p: any) => {
                const snap = snaps.find((s: any) => s.party_id === p.id);
                return { ...p, current_balance: snap ? Number(snap.balance) : p.current_balance };
              });
            }
          }
          return list;
        },
        offline: (snap) => (snap.parties || []).filter((p: any) => !p.is_deleted),
        onOfflineUsed: (savedAt) => {
          toast.message("Offline mode — showing cached khata", {
            description: savedAt ? `Last synced ${new Date(savedAt).toLocaleString()}` : undefined,
          });
        },
      });

      setParties(partiesList);
      if (partiesList.length > 0 && !selectedParty) {
        const firstActive = partiesList.find((p: any) => !isPartyDeleted(p)) || partiesList[0];
        setSelectedParty(firstActive);
      }
    } catch (err: any) {
      toast.error("Failed to load Khata Parties: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCashAccounts = async () => {
    if (!shopId) return;
    try {
      const data = await withOfflineRead({
        shopId,
        online: async () => {
          const { data, error } = await supabase
            .from("cash_accounts")
            .select("id,name,current_balance")
            .eq("shop_id", shopId)
            .order("name", { ascending: true });
          if (error) throw error;
          return data || [];
        },
        offline: (snap) => snap.cashAccounts,
      });
      setCashAccounts(data);
      if (data.length > 0 && !selectedTxAccountId) {
        const cashInHandAcc = data.find((acc: any) => acc.name.toLowerCase() === "cash in hand");
        setSelectedTxAccountId(cashInHandAcc ? cashInHandAcc.id : data[0].id);
      }
    } catch (err: any) {
      toast.error("Failed to load cash accounts: " + err.message);
    }
  };
  const handleOpenBill = async (entry: LedgerEntry) => {
    if (entry.source !== "invoice") return;
    
    const isPurchase = entry.remarks.toLowerCase().includes("purchase");
    const billType = isPurchase ? "purchase" : "sales";
    
    setSelectedBillType(billType);
    setSelectedBillLoading(true);
    setIsReceiptModalOpen(true);
    
    try {
      if (billType === "sales") {
        // Fetch sales invoice
        const { data: inv, error: invErr } = await supabase
          .from("invoices")
          .select(`
            *,
            parties ( name, phone )
          `)
          .eq("id", entry.id)
          .single();
          
        if (invErr) throw invErr;
        setSelectedBill(inv);
        
        // Fetch invoice items
        const { data: items, error: itemsErr } = await supabase
          .from("invoice_items")
          .select(`
            *,
            products ( name, unit )
          `)
          .eq("invoice_id", entry.id);
          
        if (itemsErr) throw itemsErr;
        setSelectedBillItems(items || []);
      } else {
        // Fetch purchase order
        const { data: po, error: poErr } = await supabase
          .from("purchase_orders")
          .select(`
            *,
            parties ( name, phone )
          `)
          .eq("id", entry.id)
          .single();
          
        if (poErr) throw poErr;
        setSelectedBill(po);
        
        // Fetch purchase order items
        const { data: poItems, error: poItemsErr } = await supabase
          .from("purchase_order_items")
          .select(`
            *,
            products ( name, unit )
          `)
          .eq("purchase_order_id", entry.id);
          
        if (poItemsErr) throw poItemsErr;
        
        // Map purchase items format to resemble invoice items for rendering consistency
        const mappedItems = (poItems || []).map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price ?? item.purchase_price ?? 0,
          subtotal: item.subtotal,
          products: item.products,
          packing_name: item.products?.unit || ""
        }));
        setSelectedBillItems(mappedItems);
      }
    } catch (e: any) {
      console.error("Error loading bill details:", e);
      toast.error(e.message || "Failed to load bill details");
      setIsReceiptModalOpen(false);
    } finally {
      setSelectedBillLoading(false);
    }
  };

  const isUuid = (str?: string | null) =>
    Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

  const fetchLedger = async (party: Party) => {
    setLedgerLoading(true);
    try {
      let invoices: any[] = [];
      let purchaseOrders: any[] = [];
      let txs: any[] = [];

      const offlineSnap = (isBrowserOffline() && shopId) ? await loadShopSnapshot(shopId) : null;

      if (offlineSnap) {
        invoices = (offlineSnap.invoices || []).filter((inv: any) => inv.party_id === party.id);
        purchaseOrders = (offlineSnap.purchaseOrders || []).filter((po: any) => po.supplier_id === party.id);
        txs = (offlineSnap.creditTransactions || []).filter((t: any) => t.customer_id === party.id || t.party_id === party.id);
      } else {
        try {
          // 1. Fetch Invoices for this party (Sales) - only if valid UUID
          if (isUuid(party.id)) {
            let invQuery = supabase
              .from("invoices")
              .select(`
                id, created_at, total_amount, paid_amount, status, is_voided, edit_history,
                invoice_items (
                  id, product_id, quantity, unit_price, subtotal, packing_name,
                  products ( name, unit )
                )
              `)
              .eq("party_id", party.id)
              .neq("status", "draft")
              .neq("status", "quotation");

            if (activeClosingBook) {
              invQuery = invQuery.eq("closing_book_id", activeClosingBook.id);
            } else {
              invQuery = invQuery.is("closing_book_id", null);
            }
            const { data: invData, error: invoicesError } = await invQuery;
            if (invoicesError) throw invoicesError;
            invoices = invData || [];
          }

          // 1.5. Fetch Purchase Orders (Purchases) if supplier or dual-role - only if valid UUID
          if (isUuid(party.id) && (party.type === "supplier" || party.type === "dual")) {
            let poQuery = supabase
              .from("purchase_orders")
              .select(`
                id, created_at, total_amount, paid_amount, status, is_voided,
                purchase_order_items (
                  id, quantity, unit_price, purchase_price, subtotal,
                  products ( name, unit )
                )
              `)
              .eq("supplier_id", party.id);

            if (activeClosingBook) {
              poQuery = poQuery.eq("closing_book_id", activeClosingBook.id);
            } else {
              poQuery = poQuery.is("closing_book_id", null);
            }
            const { data: poData, error: poError } = await poQuery;
            if (poError) {
              console.error("Error fetching purchase orders in khata:", poError);
            }
            if (!poError && poData) {
              purchaseOrders = poData;
            }
          }

          // 2. Fetch manual credit_transactions - only if valid UUID
          if (isUuid(party.id)) {
            let txQuery = supabase
              .from("credit_transactions")
              .select("id, created_at, amount, transaction_type, remarks, edit_history")
              .eq("customer_id", party.id);

            if (activeClosingBook) {
              txQuery = txQuery.eq("closing_book_id", activeClosingBook.id);
            } else {
              txQuery = txQuery.is("closing_book_id", null);
            }
            const { data: txData, error: txsError } = await txQuery;
            if (txsError) throw txsError;
            txs = txData || [];
          }
        } catch (fetchErr: any) {
          if (isNetworkError(fetchErr) && shopId) {
            const snap = await loadShopSnapshot(shopId);
            if (snap) {
              invoices = (snap.invoices || []).filter((inv: any) => inv.party_id === party.id);
              purchaseOrders = (snap.purchaseOrders || []).filter((po: any) => po.supplier_id === party.id);
              txs = (snap.creditTransactions || []).filter((t: any) => t.customer_id === party.id || t.party_id === party.id);
            } else {
              throw fetchErr;
            }
          } else {
            throw fetchErr;
          }
        }
      }

      // 2.5. Fetch Showroom Installments for this party / customer
      let formattedShowroomInsts: Omit<LedgerEntry, "runningBalance">[] = [];
      let formattedShowroomQists: Omit<LedgerEntry, "runningBalance">[] = [];

      try {
        let instList: any[] = [];
        if (party.id.startsWith("shw-inst-")) {
          const rawInstId = party.id.replace("shw-inst-", "");
          if (isUuid(rawInstId)) {
            const { data } = await supabase
              .from("showroom_installments")
              .select(`*, showroom_vehicles ( make, model, plate_number, is_applied_for )`)
              .eq("id", rawInstId);
            instList = data || [];
          }
        } else if (isUuid(party.id)) {
          const orFilters = [`party_id.eq.${party.id}`];
          if (party.phone && party.phone.trim()) orFilters.push(`customer_phone.eq.${party.phone.trim()}`);
          if (party.name && party.name.trim()) orFilters.push(`customer_name.ilike.${party.name.trim()}`);
          
          const { data } = await supabase
            .from("showroom_installments")
            .select(`*, showroom_vehicles ( make, model, plate_number, is_applied_for )`)
            .eq("shop_id", shopId)
            .or(orFilters.join(","));
          instList = data || [];
        } else {
          const orFilters: string[] = [];
          if (party.phone && party.phone.trim()) orFilters.push(`customer_phone.eq.${party.phone.trim()}`);
          if (party.name && party.name.trim()) orFilters.push(`customer_name.ilike.${party.name.trim()}`);
          if (orFilters.length > 0) {
            const { data } = await supabase
              .from("showroom_installments")
              .select(`*, showroom_vehicles ( make, model, plate_number, is_applied_for )`)
              .eq("shop_id", shopId)
              .or(orFilters.join(","));
            instList = data || [];
          }
        }

        if (instList && instList.length > 0) {
          const instIds = instList.map((i: any) => i.id).filter(isUuid);
          let schedList: any[] = [];
          if (instIds.length > 0) {
            const { data: sData } = await supabase
              .from("showroom_installment_schedules")
              .select("*")
              .in("installment_id", instIds)
              .gt("paid_amount", 0);
            schedList = sData || [];
          }

          instList.forEach((inst: any) => {
            const v = inst.showroom_vehicles;
            const vName = v
              ? `${v.make} ${v.model} (${v.is_applied_for ? "Applied For" : v.plate_number || ""})`
              : "Vehicle";

            // Financed Price -> Debit
            formattedShowroomInsts.push({
              id: `inst-plan-${inst.id}`,
              date: inst.start_date || inst.created_at,
              amount: Number(inst.total_price) || 0,
              type: "debit",
              source: "invoice",
              remarks: `Vehicle Installment Agreement #${inst.agreement_number} - ${vName}`,
            });

            // Advance Down Payment -> Credit
            if (Number(inst.down_payment) > 0) {
              formattedShowroomInsts.push({
                id: `inst-down-${inst.id}`,
                date: inst.start_date || inst.created_at,
                amount: Number(inst.down_payment),
                type: "credit",
                source: "manual",
                remarks: `Advance / Down Payment (پیشگی رقم) - Agr #${inst.agreement_number}`,
              });
            }
          });

          (schedList || []).forEach((sched: any) => {
            const relatedInst = instList.find((i: any) => i.id === sched.installment_id);
            const agrNo = relatedInst?.agreement_number || "";
            formattedShowroomQists.push({
              id: `inst-qist-${sched.id}`,
              date: sched.paid_date || sched.due_date || new Date().toISOString(),
              amount: Number(sched.paid_amount),
              type: "credit",
              source: "manual",
              remarks: `Qist #${sched.installment_no} Paid (قسط وصولی) - Agr #${agrNo} ${
                sched.receipt_no ? `[${sched.receipt_no}]` : ""
              }`,
            });
          });
        }
      } catch (e) {
        console.warn("Could not fetch showroom installments for khata:", e);
      }

      // 2.6. Fetch Showroom Vehicles for Seller purchases or Buyer cash sales
      let formattedShowroomVehicles: Omit<LedgerEntry, "runningBalance">[] = [];
      try {
        let vehList: any[] = [];
        if (party.id.startsWith("shw-seller-") || party.id.startsWith("shw-buyer-")) {
          const rawVehId = party.id.replace("shw-seller-", "").replace("shw-buyer-", "");
          if (isUuid(rawVehId)) {
            const { data } = await supabase
              .from("showroom_vehicles")
              .select("*")
              .eq("id", rawVehId);
            vehList = data || [];
          }
        } else if (isUuid(party.id)) {
          const orFilters = [`purchase_party_id.eq.${party.id}`];
          if (party.name && party.name.trim()) {
            orFilters.push(`seller_name.ilike.${party.name.trim()}`);
            orFilters.push(`buyer_name.ilike.${party.name.trim()}`);
          }
          const { data } = await supabase
            .from("showroom_vehicles")
            .select("*")
            .eq("shop_id", shopId)
            .or(orFilters.join(","));
          vehList = data || [];
        } else {
          const orFilters: string[] = [];
          if (party.name && party.name.trim()) {
            orFilters.push(`seller_name.ilike.${party.name.trim()}`);
            orFilters.push(`buyer_name.ilike.${party.name.trim()}`);
          }
          if (orFilters.length > 0) {
            const { data } = await supabase
              .from("showroom_vehicles")
              .select("*")
              .eq("shop_id", shopId)
              .or(orFilters.join(","));
            vehList = data || [];
          }
        }

        (vehList || []).forEach((v: any) => {
          const vName = `${v.make} ${v.model} (${v.year || ""}) - ${v.is_applied_for ? "Applied For" : v.plate_number || ""}`;

          const isSeller =
            (party.name && v.seller_name && v.seller_name.toLowerCase() === party.name.toLowerCase()) ||
            party.type === "supplier";

          if (isSeller && Number(v.purchase_price || v.purchase_cost || v.price) > 0) {
            formattedShowroomVehicles.push({
              id: `veh-pur-${v.id}`,
              date: v.purchase_date || v.created_at,
              amount: Number(v.purchase_price || v.purchase_cost || v.price),
              type: "credit",
              source: "invoice",
              remarks: `Vehicle Purchased from Seller: ${vName}`,
            });
          }

          const isBuyer = party.name && v.buyer_name && v.buyer_name.toLowerCase() === party.name.toLowerCase();
          if (isBuyer && Number(v.sold_price || v.price) > 0 && v.sale_type === "cash") {
            formattedShowroomVehicles.push({
              id: `veh-sale-${v.id}`,
              date: v.sold_date || v.created_at,
              amount: Number(v.sold_price || v.price),
              type: "debit",
              source: "invoice",
              remarks: `Vehicle Cash Sale: ${vName}`,
            });
          }
        });
      } catch (e) {
        console.warn("Could not fetch showroom vehicles for khata:", e);
      }

      // 3. Union and map all datasets to a unified format
      const isCustomer = party.type === "customer" || party.type === "dual";
      const isSupplier = party.type === "supplier";

      const formattedInvoices: Omit<LedgerEntry, "runningBalance">[] = [];
      (invoices || [])
        .filter((inv: any) => !inv.is_voided && inv.status !== "quotation")
        .forEach((inv: any) => {
          const total = Number(inv.total_amount || 0);
          const paid = Number(inv.paid_amount || 0);
          const remaining = Math.max(0, total - paid);

          const mappedItems: LedgerItem[] = (inv.invoice_items || []).map((it: any) => ({
            name: it.products?.name || "Product Item",
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
            subtotal: Number(it.subtotal || (Number(it.quantity || 1) * Number(it.unit_price || 0))),
            packing_name: it.packing_name || (it.products?.unit || "")
          }));

          const displayInvId = isUuid(inv.id) ? inv.id.slice(0, 8).toUpperCase() : String(inv.id).toUpperCase();

          let invRemark = `Invoice Bill #${displayInvId}`;
          if (paid > 0 && remaining > 0) {
            invRemark += ` (کُل بل: Rs ${Math.round(total).toLocaleString()} | نقد وصولی: Rs ${Math.round(paid).toLocaleString()} | بقیہ ادھار: Rs ${Math.round(remaining).toLocaleString()})`;
          } else if (paid >= total) {
            invRemark += ` (کُل بل: Rs ${Math.round(total).toLocaleString()} - نقد ادا شدہ ✓)`;
          } else {
            invRemark += ` (کُل ادھار: Rs ${Math.round(total).toLocaleString()})`;
          }

          formattedInvoices.push({
            id: inv.id,
            date: inv.created_at,
            amount: total,
            type: isCustomer ? "debit" : "credit",
            source: "invoice",
            remarks: invRemark,
            edit_history: inv.edit_history,
            items: mappedItems,
            total_bill: total,
            paid_amount: paid,
            remaining_credit: remaining
          });

          if (paid > 0) {
            formattedInvoices.push({
              id: `inv-paid-${inv.id}`,
              date: new Date(new Date(inv.created_at).getTime() + 100).toISOString(),
              amount: paid,
              type: isCustomer ? "credit" : "debit",
              source: "manual",
              remarks: `Payment at Checkout (بل نقد وصولی) - Bill #${displayInvId} (نقد وصولی: Rs ${Math.round(paid).toLocaleString()})`,
              edit_history: []
            });
          }
        });

      const formattedPurchaseOrders: Omit<LedgerEntry, "runningBalance">[] = [];
      (purchaseOrders || [])
        .filter((po: any) => !po.is_voided)
        .forEach((po: any) => {
          const total = Number(po.total_amount || 0);
          const paid = Number(po.paid_amount || 0);
          const remaining = Math.max(0, total - paid);

          const mappedItems: LedgerItem[] = (po.purchase_order_items || []).map((it: any) => ({
            name: it.products?.name || "Product Item",
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || it.purchase_price || 0),
            subtotal: Number(it.subtotal || (Number(it.quantity || 1) * Number(it.unit_price || it.purchase_price || 0))),
            packing_name: it.products?.unit || ""
          }));

          const displayPoId = isUuid(po.id) ? po.id.slice(0, 8).toUpperCase() : String(po.id).toUpperCase();

          let poRemark = `Purchase Bill #${displayPoId}`;
          if (paid > 0 && remaining > 0) {
            poRemark += ` (کُل بل: Rs ${Math.round(total).toLocaleString()} | نقد ادائیگی: Rs ${Math.round(paid).toLocaleString()} | بقیہ: Rs ${Math.round(remaining).toLocaleString()})`;
          } else if (paid >= total) {
            poRemark += ` (کُل بل: Rs ${Math.round(total).toLocaleString()} - نقد ادا شدہ ✓)`;
          }

          formattedPurchaseOrders.push({
            id: po.id,
            date: po.created_at,
            amount: total,
            type: isSupplier ? "credit" : "debit",
            source: "invoice",
            remarks: poRemark,
            edit_history: [],
            items: mappedItems,
            total_bill: total,
            paid_amount: paid,
            remaining_credit: remaining
          });

          if (paid > 0) {
            formattedPurchaseOrders.push({
              id: `po-paid-${po.id}`,
              date: new Date(new Date(po.created_at).getTime() + 100).toISOString(),
              amount: paid,
              type: isSupplier ? "debit" : "credit",
              source: "manual",
              remarks: `Payment at Purchase (بل نقد ادائیگی) - PO #${displayPoId} (نقد ادائیگی: Rs ${Math.round(paid).toLocaleString()})`,
              edit_history: []
            });
          }
        });

      const formattedTxs: Omit<LedgerEntry, "runningBalance">[] = (txs || [])
        .filter((tx: any) => {
          const rem = (tx.remarks || "").trim();
          // Filter out duplicate automatic invoice/purchase billing and void reversals that are already accounted for
          if (/^(Purchase Order Billing|Purchase Bill|Invoice Billing|Invoice Bill|Sale Bill|Purchase Void Reversal|Voided Invoice|Void POS Sale|Edit Reversal POS Sale)\s*#/i.test(rem)) {
            return false;
          }
          return true;
        })
        .map((tx: any) => {
          const isPayment = tx.transaction_type === "payment" || tx.transaction_type === "receive";
          return {
            id: tx.id,
            date: tx.created_at,
            amount: Number(tx.amount),
            type: isPayment 
              ? (isCustomer ? "credit" : "debit")
              : (isCustomer ? "debit" : "credit"),
            source: "manual",
            remarks: (tx.remarks ? tx.remarks.replace(/\s*\/\s*شروع کا بیلنس.*$/i, "").replace(/\s*\(سابقہ بقایا\)/i, "").trim() : "") || (isPayment ? "Cash Payment Received" : "Manual Adjustment"),
            edit_history: tx.edit_history,
            transaction_type: tx.transaction_type
          };
        });

      // Combine all transaction sources and sort chronologically (oldest first)
      const sortedAsc = [
        ...formattedInvoices,
        ...formattedPurchaseOrders,
        ...formattedTxs,
        ...formattedShowroomInsts,
        ...formattedShowroomQists,
        ...formattedShowroomVehicles,
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Only include a genuine opening balance entry if:
      // 1) Party has an explicit non-zero opening_balance, AND
      // 2) It is not already logged in credit_transactions as an opening balance entry
      const hasExistingOpeningTx = formattedTxs.some(t => /opening\s*account\s*balance/i.test(t.remarks));
      const explicitOpeningBal = Number(party.opening_balance || 0);

      const allEntriesWithOpening: Omit<LedgerEntry, "runningBalance">[] = [...sortedAsc];
      if (explicitOpeningBal !== 0 && !hasExistingOpeningTx) {
        allEntriesWithOpening.unshift({
          id: `opening-bal-${party.id}`,
          date: party.created_at || new Date().toISOString(),
          amount: Math.abs(explicitOpeningBal),
          type: explicitOpeningBal > 0
            ? (isCustomer ? "debit" : "credit")
            : (isCustomer ? "credit" : "debit"),
          source: "system",
          remarks: "Opening Account Balance (سابقہ ابتدائی بقایا)",
        });
      }

      // Accumulate chronological running balances
      let currentBal = 0;
      const ledgerWithBalances = allEntriesWithOpening.map(entry => {
        if (isCustomer) {
          currentBal += entry.type === "debit" ? entry.amount : -entry.amount;
        } else {
          currentBal += entry.type === "credit" ? entry.amount : -entry.amount;
        }
        return {
          ...entry,
          runningBalance: currentBal
        } as LedgerEntry;
      });

      // If party has NO transactions at all in database but has an active current_balance > 0
      if (ledgerWithBalances.length === 0 && Number(party.current_balance || 0) !== 0) {
        const bal = Number(party.current_balance || 0);
        ledgerWithBalances.push({
          id: `initial-bal-${party.id}`,
          date: party.created_at || new Date().toISOString(),
          amount: Math.abs(bal),
          type: bal > 0 ? (isCustomer ? "debit" : "credit") : (isCustomer ? "credit" : "debit"),
          source: "system",
          remarks: "Initial Account Balance Forward",
          runningBalance: bal
        });
      }

      // Sort back to descending (newest first)
      const combined = [...ledgerWithBalances].reverse();

      setLedger(combined);

      // Auto-reconcile and sync party balance with the true computed ledger running balance
      const computedFinalBalance = combined.length > 0 
        ? combined[0].runningBalance 
        : Number(party.current_balance || 0);

      if (Math.abs(computedFinalBalance - Number(party.current_balance || 0)) > 0.001) {
        setSelectedParty(prev => prev && prev.id === party.id ? { ...prev, current_balance: computedFinalBalance } : prev);
        setParties(prev => prev.map(p => p.id === party.id ? { ...p, current_balance: computedFinalBalance } : p));
        if (isUuid(party.id)) {
          supabase
            .from("parties")
            .update({ current_balance: computedFinalBalance })
            .eq("id", party.id)
            .then(() => {});
        }
      }
    } catch (err: any) {
      toast.error("Failed to load Ledger logs: " + err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleOpenEditPartyModal = () => {
    if (!selectedParty) return;
    setEditingParty(selectedParty);
    setNewParty({
      name: selectedParty.name,
      phone: selectedParty.phone || "",
      type: selectedParty.type as any,
      opening_balance: 0, // Opening balance is not editable
      address: selectedParty.address || "",
      cnic_number: selectedParty.cnic_number || "",
      father_name: selectedParty.father_name || "",
      note: selectedParty.note || "",
      credit_limit: selectedParty.credit_limit !== null && selectedParty.credit_limit !== undefined ? selectedParty.credit_limit.toString() : ""
    });
    setIsPartyModalOpen(true);
  };

  const handleCreateParty = async () => {
    if (!newParty.name) {
      toast.error("Party Name is required.");
      return;
    }

    setIsSubmittingParty(true);
    try {
      if (editingParty) {
        // Update existing party
        const limitVal = (newParty.type === "customer" || newParty.type === "dual") ? (parseFloat(newParty.credit_limit as string) || null) : null;
        let updatedPartyData: any = {
          ...editingParty,
          name: newParty.name,
          phone: newParty.phone || null,
          type: newParty.type,
          address: newParty.address || null,
          cnic_number: newParty.cnic_number || null,
          father_name: newParty.father_name || null,
          note: newParty.note || null,
          credit_limit: limitVal,
        };

        if (editingParty.id.startsWith("shw-inst-")) {
          const rawInstId = editingParty.id.replace("shw-inst-", "");
          if (isUuid(rawInstId)) {
            await supabase
              .from("showroom_installments")
              .update({
                customer_name: newParty.name,
                customer_phone: newParty.phone || null,
                customer_cnic: newParty.cnic_number || null,
                customer_father_name: newParty.father_name || null,
                customer_address: newParty.address || null,
                notes: newParty.note || null,
              })
              .eq("id", rawInstId);
          }
        } else if (editingParty.id.startsWith("shw-seller-")) {
          const rawSellerId = editingParty.id.replace("shw-seller-", "");
          if (isUuid(rawSellerId)) {
            await supabase
              .from("showroom_vehicles")
              .update({
                seller_name: newParty.name,
                seller_phone: newParty.phone || null,
                seller_cnic: newParty.cnic_number || null,
              })
              .eq("id", rawSellerId);
          }
        } else if (editingParty.id.startsWith("shw-buyer-")) {
          const rawBuyerId = editingParty.id.replace("shw-buyer-", "");
          if (isUuid(rawBuyerId)) {
            await supabase
              .from("showroom_vehicles")
              .update({
                buyer_name: newParty.name,
                buyer_phone: newParty.phone || null,
              })
              .eq("id", rawBuyerId);
          }
        } else if (isUuid(editingParty.id)) {
          const { data } = await supabase
            .from("parties")
            .update({
              name: newParty.name,
              phone: newParty.phone || null,
              type: newParty.type,
              address: newParty.address || null,
              cnic_number: newParty.cnic_number || null,
              father_name: newParty.father_name || null,
              note: newParty.note || null,
              credit_limit: limitVal
            })
            .eq("id", editingParty.id)
            .select()
            .maybeSingle();

          if (data) {
            updatedPartyData = data;
          }

          // Also try updating showroom_parties
          try {
            await supabase
              .from("showroom_parties")
              .update({
                name: newParty.name,
                phone: newParty.phone || "",
                address: newParty.address || null,
                cnic: newParty.cnic_number || null,
                father_name: newParty.father_name || null,
                notes: newParty.note || null,
              })
              .eq("id", editingParty.id);
          } catch {}
        }

        toast.success("Party updated successfully!");
        setIsPartyModalOpen(false);
        setEditingParty(null);
        setNewParty({ name: "", phone: "", type: "customer", opening_balance: 0, address: "", cnic_number: "", father_name: "", note: "", credit_limit: "" });
        
        // Update selectedParty view details in state
        setSelectedParty(updatedPartyData);
        fetchParties();
      } else {
        // Create new party
        const { data, error } = await supabase
          .from("parties")
          .insert({
            shop_id: shopId,
            name: newParty.name,
            phone: newParty.phone || null,
            type: newParty.type,
            current_balance: newParty.opening_balance,
            address: newParty.address || null,
            cnic_number: newParty.cnic_number || null,
            father_name: newParty.father_name || null,
            note: newParty.note || null,
            credit_limit: (newParty.type === "customer" || newParty.type === "dual") ? (parseFloat(newParty.credit_limit as string) || null) : null
          })
          .select()
          .single();

        if (error) throw error;

        // If opening balance > 0, log an opening balance transaction
        if (newParty.opening_balance !== 0) {
          await supabase
            .from("credit_transactions")
            .insert({
              shop_id: shopId,
              customer_id: data.id,
              amount: Math.abs(newParty.opening_balance),
              transaction_type: newParty.opening_balance > 0 ? "charge" : "payment",
              remarks: "Opening Account Balance Entry"
            });
        }

        toast.success(`${newParty.type === 'customer' ? 'Customer' : newParty.type === 'supplier' ? 'Supplier' : 'Dual-Role Partner'} added to Khata!`);
        setIsPartyModalOpen(false);
        setNewParty({ name: "", phone: "", type: "customer", opening_balance: 0, address: "", cnic_number: "", father_name: "", note: "", credit_limit: "" });
        
        // Reload parties list and set active
        fetchParties();
      }
    } catch (err: any) {
      toast.error("Error saving party: " + err.message);
    } finally {
      setIsSubmittingParty(false);
    }
  };

  const handleMovePartyToTrash = async (partyToTrash?: Party) => {
    const target = partyToTrash || selectedParty;
    if (!target) return;

    const confirmMsg = `کیا آپ واقعی کھاتہ "${target.name}" کو کوڑے دان / ٹریش میں منتقل کرنا چاہتے ہیں؟\n\nAre you sure you want to move "${target.name}" to Trash?\n\n• کھاتہ فعال لسٹ سے ہٹ کر کوڑے دان (Trash) میں چلا جائے گا۔\n• تمام رسیدیں اور سابقہ ریکارڈ محفوظ رہیں گے۔\n• آپ جب چاہیں اسے دوبارہ بحال (Restore) کر سکتے ہیں۔`;
    if (!window.confirm(confirmMsg)) return;

    setIsTrashActionLoading(true);
    try {
      const currentNote = target.note || "";
      const updatedNote = currentNote.includes("[ARCHIVED]") ? currentNote : `[ARCHIVED] ${currentNote}`.trim();

      if (isUuid(target.id)) {
        const { error: pErr } = await supabase
          .from("parties")
          .update({
            is_deleted: true,
            note: updatedNote
          })
          .eq("id", target.id);

        if (pErr) {
          await supabase
            .from("parties")
            .update({ note: updatedNote })
            .eq("id", target.id);
        }

        try {
          await supabase
            .from("showroom_parties")
            .update({
              is_deleted: true,
              notes: updatedNote
            })
            .eq("id", target.id);
        } catch {}
      } else if (target.id.startsWith("shw-inst-")) {
        const rawInstId = target.id.replace("shw-inst-", "");
        if (isUuid(rawInstId)) {
          await supabase
            .from("showroom_installments")
            .update({ notes: updatedNote })
            .eq("id", rawInstId);
        }
      }

      toast.success(`"${target.name}" کوڑے دان (Trash) میں منتقل ہو گیا!`);
      
      const updatedPartyObj: Party = {
        ...target,
        is_deleted: true,
        note: updatedNote
      };

      if (selectedParty?.id === target.id) {
        setSelectedParty(updatedPartyObj);
      }

      if (isPartyModalOpen) {
        setIsPartyModalOpen(false);
        setEditingParty(null);
      }

      await fetchParties();
    } catch (err: any) {
      console.error("Error moving party to trash:", err);
      toast.error("Failed to move party to trash: " + err.message);
    } finally {
      setIsTrashActionLoading(false);
    }
  };

  const handleRestoreParty = async (partyToRestore?: Party) => {
    const target = partyToRestore || selectedParty;
    if (!target) return;

    setIsTrashActionLoading(true);
    try {
      const currentNote = target.note || "";
      const cleanedNote = currentNote
        .replace(/\[ARCHIVED\]/gi, "")
        .replace(/\[TRASH\]/gi, "")
        .replace(/\[DELETED\]/gi, "")
        .trim();

      if (isUuid(target.id)) {
        const { error: pErr } = await supabase
          .from("parties")
          .update({
            is_deleted: false,
            note: cleanedNote || null
          })
          .eq("id", target.id);

        if (pErr) {
          await supabase
            .from("parties")
            .update({ note: cleanedNote || null })
            .eq("id", target.id);
        }

        try {
          await supabase
            .from("showroom_parties")
            .update({
              is_deleted: false,
              notes: cleanedNote || null
            })
            .eq("id", target.id);
        } catch {}
      } else if (target.id.startsWith("shw-inst-")) {
        const rawInstId = target.id.replace("shw-inst-", "");
        if (isUuid(rawInstId)) {
          await supabase
            .from("showroom_installments")
            .update({ notes: cleanedNote || null })
            .eq("id", rawInstId);
        }
      }

      toast.success(`"${target.name}" کھاتہ کامیابی سے بحال (Restored) ہو گیا!`);
      
      const updatedPartyObj: Party = {
        ...target,
        is_deleted: false,
        note: cleanedNote || null
      };

      if (selectedParty?.id === target.id) {
        setSelectedParty(updatedPartyObj);
      }

      await fetchParties();
    } catch (err: any) {
      console.error("Error restoring party:", err);
      toast.error("Failed to restore party: " + err.message);
    } finally {
      setIsTrashActionLoading(false);
    }
  };

  const handlePermanentDeleteParty = async (partyToDelete?: Party) => {
    const target = partyToDelete || selectedParty;
    if (!target) return;

    if (!isAdmin) {
      toast.error("Only Administrators and Owners can permanently delete party accounts.");
      return;
    }

    const confirmMsg = `⚠️ انتہائی اہم وارننگ (Permanent Deletion)!\n\nکیا آپ واقعی "${target.name}" کا کھاتہ ہمیشہ کیلئے مکمل ڈیلیٹ کرنا چاہتے ہیں؟\n\nاگر یہ نام غلطی سے دو بار بن گیا تھا تو یہ سسٹم سے مکمل ختم ہو جائے گا۔\n(نوٹ: اگر اس کھاتے پر سیل بلز موجود ہیں تو ڈیٹا پروٹیکشن کی وجہ سے یہ مکمل ڈیلیٹ نہیں ہوگا بلکہ ٹریش میں رہے گا)۔`;
    if (!window.confirm(confirmMsg)) return;

    setIsTrashActionLoading(true);
    try {
      if (!isUuid(target.id)) {
        toast.error("Showroom virtual entries cannot be deleted from here. Please manage from Showroom module.");
        return;
      }

      // Check if invoices exist for this party
      const { count: invCount } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("party_id", target.id);

      const { count: poCount } = await supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", target.id);

      if ((invCount && invCount > 0) || (poCount && poCount > 0)) {
        toast.error(`اس پارٹی کے ${(invCount || 0) + (poCount || 0)} بلز موجود ہیں۔ حسابات کی درستی کیلئے یہ مکمل ختم نہیں ہو سکتی، اسے ٹریش (Trash) میں رہنے دیں۔`);
        return;
      }

      // Delete credit_transactions (e.g. opening balance transaction)
      await supabase
        .from("credit_transactions")
        .delete()
        .eq("customer_id", target.id);

      // Delete party row
      const { error: delErr } = await supabase
        .from("parties")
        .delete()
        .eq("id", target.id);

      if (delErr) throw delErr;

      try {
        await supabase
          .from("showroom_parties")
          .delete()
          .eq("id", target.id);
      } catch {}

      toast.success(`"${target.name}" کھاتہ ہمیشہ کیلئے ختم کر دیا گیا!`);
      setSelectedParty(null);
      await fetchParties();
    } catch (err: any) {
      console.error("Error permanently deleting party:", err);
      toast.error("Failed to permanently delete party: " + err.message);
    } finally {
      setIsTrashActionLoading(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!selectedParty || newTx.amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsSubmittingTx(true);
    try {
      const isCustomer = selectedParty.type === "customer";
      
      let balanceDiff = 0;
      let txType: "payment" | "charge" = "payment";
      let accType: "deposit" | "withdrawal" = "deposit";
      let defaultRemarks = "";

      if (isCustomer) {
        if (txModalType === "receive") {
          // Customer pays us cash -> customer owes less (receivable reduced)
          balanceDiff = -newTx.amount;
          txType = "payment";
          accType = "deposit";
          defaultRemarks = "Cash Received from Customer";
        } else {
          // We refund / give cash to customer -> customer owes more (receivable increased)
          balanceDiff = newTx.amount;
          txType = "charge";
          accType = "withdrawal";
          defaultRemarks = "Cash Disbursed / Refund to Customer";
        }
      } else {
        // Supplier (or Dual in supplier context)
        if (txModalType === "pay") {
          // WE PAY CASH TO SUPPLIER -> we owe less to supplier (payable reduced!)
          balanceDiff = -newTx.amount;
          txType = "payment";
          accType = "withdrawal";
          defaultRemarks = "Cash Paid to Supplier";
        } else {
          // Supplier refunds/credits cash to us -> we owe more to supplier (payable increased)
          balanceDiff = newTx.amount;
          txType = "charge";
          accType = "deposit";
          defaultRemarks = "Supplier Refund / Credit Received";
        }
      }

      const remarks = newTx.remarks.trim() || defaultRemarks;

      let resolvedPartyId = selectedParty.id;
      if (!isUuid(resolvedPartyId)) {
        const { data: existingP } = await supabase
          .from("parties")
          .select("id")
          .eq("shop_id", shopId)
          .eq("name", selectedParty.name)
          .maybeSingle();

        if (existingP?.id) {
          resolvedPartyId = existingP.id;
        } else {
          const { data: createdP, error: crErr } = await supabase
            .from("parties")
            .insert({
              shop_id: shopId,
              name: selectedParty.name,
              phone: selectedParty.phone || null,
              type: selectedParty.type || "customer",
              current_balance: Number(selectedParty.current_balance) || 0,
              opening_balance: 0,
            })
            .select()
            .single();
          if (!crErr && createdP) {
            resolvedPartyId = createdP.id;
          }
        }
      }

      const paymentPayload = {
        shop_id: shopId!,
        party_id: resolvedPartyId,
        amount: newTx.amount,
        balance_diff: balanceDiff,
        transaction_type: txType,
        account_id: selectedTxAccountId || null,
        account_tx_type: accType,
        remarks: `Khata: ${selectedParty.name} - ${remarks}`,
      };

      const applyOptimisticTx = (offlineMsg = false) => {
        toast.success(
          offlineMsg
            ? "Payment saved offline — will sync when online"
            : "Transaction recorded successfully!"
        );
        setIsTxModalOpen(false);
        setNewTx({ amount: 0, remarks: "" });
        const updatedParty = {
          ...selectedParty,
          id: resolvedPartyId,
          current_balance: selectedParty.current_balance + balanceDiff,
        };
        setSelectedParty(updatedParty);
        if (selectedTxAccountId) {
          setCashAccounts((prev) =>
            prev.map((acc) =>
              acc.id === selectedTxAccountId
                ? {
                    ...acc,
                    current_balance:
                      accType === "deposit"
                        ? Number(acc.current_balance) + newTx.amount
                        : Number(acc.current_balance) - newTx.amount,
                  }
                : acc
            )
          );
        }
        fetchParties();
      };

      if (isBrowserOffline()) {
        await executeOrQueue({
          shopId: shopId!,
          action: "PARTY_PAYMENT",
          tableName: "parties",
          payload: paymentPayload,
          label: `Khata ${txModalType} — ${selectedParty.name}`,
          online: async () => undefined,
        });
        applyOptimisticTx(true);
        return;
      }

      // Phase 2 atomic party payment
      if (isMoneyRpcEnabled()) {
        try {
          await applyPartyPaymentRpc(supabase, paymentPayload);
          applyOptimisticTx(false);
          return;
        } catch (rpcErr: any) {
          const msg = String(rpcErr?.message || "");
          if (!/function|does not exist|Could not find|schema cache/i.test(msg)) throw rpcErr;
          console.warn("[Khata] apply_party_payment RPC unavailable, legacy path:", msg);
        }
      }

      // 1. Insert manual transaction log (legacy)
      const { data: txData, error: txError } = await supabase
        .from("credit_transactions")
        .insert({
          shop_id: shopId,
          customer_id: resolvedPartyId,
          amount: newTx.amount,
          transaction_type: txType,
          remarks
        })
        .select()
        .single();

      if (txError) throw txError;

      // 1.5. Update Cash Account if selected
      if (selectedTxAccountId) {
        const acc = cashAccounts.find(a => a.id === selectedTxAccountId);
        if (acc) {
          const newBalance = accType === "deposit" 
            ? Number(acc.current_balance) + newTx.amount 
            : Number(acc.current_balance) - newTx.amount;

          const { error: accErr } = await supabase
            .from("cash_accounts")
            .update({ current_balance: newBalance })
            .eq("id", selectedTxAccountId);

          if (accErr) throw accErr;

          const { error: accTxErr } = await supabase
            .from("account_transactions")
            .insert({
              shop_id: shopId,
              account_id: selectedTxAccountId,
              type: accType,
              amount: newTx.amount,
              ref_type: "party_tx",
              ref_id: txData?.id || selectedParty.id,
              remarks: `Khata: ${selectedParty.name} - ${remarks}`
            });

          if (accTxErr) throw accTxErr;
        }
      }

      // 2. Update Party balance
      if (isUuid(resolvedPartyId)) {
        const { error: balanceError } = await supabase
          .rpc("increment_party_balance", {
            p_id: resolvedPartyId,
            amount: balanceDiff
          });

        if (balanceError) throw balanceError;
      }

      // 2.1 Sync Showroom Installment record if this party is an installment customer
      if (selectedParty.id.startsWith("shw-inst-")) {
        const rawInstId = selectedParty.id.replace("shw-inst-", "");
        if (isUuid(rawInstId)) {
          try {
            const { data: curInst } = await supabase
              .from("showroom_installments")
              .select("total_paid, remaining_balance, total_price")
              .eq("id", rawInstId)
              .maybeSingle();
            if (curInst) {
              const newTotalPaid = (Number(curInst.total_paid) || 0) + (txType === "payment" ? newTx.amount : -newTx.amount);
              const newRem = Math.max(0, (Number(curInst.total_price) || 0) - newTotalPaid);
              await supabase
                .from("showroom_installments")
                .update({
                  total_paid: newTotalPaid,
                  remaining_balance: newRem,
                  status: newRem <= 0 ? "completed" : "active"
                })
                .eq("id", rawInstId);
            }
          } catch {}
        }
      }

      toast.success("Transaction recorded successfully!");
      setIsTxModalOpen(false);
      setNewTx({ amount: 0, remarks: "" });

      // Refresh data
      const updatedParty = { 
        ...selectedParty, 
        current_balance: selectedParty.current_balance + balanceDiff 
      };
      setSelectedParty(updatedParty);

      if (selectedTxAccountId) {
        setCashAccounts(prev => prev.map(acc => 
          acc.id === selectedTxAccountId 
            ? { ...acc, current_balance: txModalType === "receive" 
                ? Number(acc.current_balance) + newTx.amount 
                : Number(acc.current_balance) - newTx.amount } 
            : acc
        ));
      }
      
      // Refresh list
      fetchParties();
    } catch (err: any) {
      toast.error("Failed to post transaction: " + err.message);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const sanitizeRemarksForPDF = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/کُل بل/g, "Total Bill")
      .replace(/نقد وصولی/g, "Cash Received")
      .replace(/نقد ادائیگی/g, "Cash Paid")
      .replace(/بقیہ ادھار/g, "Balance Due")
      .replace(/بقیہ/g, "Balance")
      .replace(/نقد ادا شدہ/g, "Cash Settled")
      .replace(/بل نقد وصولی/g, "Cash Received")
      .replace(/بل نقد ادائیگی/g, "Cash Paid")
      .replace(/پیشگی رقم/g, "Advance Payment")
      .replace(/قسط وصولی/g, "Installment Received")
      .replace(/سابقہ بقایا/g, "Previous Balance")
      .replace(/شروع کا بیلنس/g, "Opening Balance")
      .replace(/✓/g, "OK")
      .replace(/[^\x20-\x7E\n]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const handleDownloadPDF = async (downloadAll: boolean, returnBlobOnly: boolean = false): Promise<Blob | null | undefined> => {
    if (!selectedParty) return;

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Prepare data
      let exportData = downloadAll ? [...ledger] : [...filteredLedger];
      
      // Calculate opening balance for PDF
      if (!downloadAll && filteredLedger.length > 0 && filteredLedger.length < ledger.length) {
        const oldestVisibleEntry = filteredLedger[filteredLedger.length - 1];
        const oldestVisibleTime = new Date(oldestVisibleEntry.date).getTime();
        const olderEntries = ledger.filter(e => new Date(e.date).getTime() < oldestVisibleTime);

        if (olderEntries.length > 0) {
          const openingBalanceVal = olderEntries[0].runningBalance;
          const openingRow: LedgerEntry = {
            id: "opening-bal-forward-pdf",
            date: new Date(oldestVisibleTime - 1000).toISOString(), // 1 second older
            remarks: "Opening Balance (Balance Forward)",
            source: "system" as any,
            amount: 0,
            type: "debit",
            runningBalance: openingBalanceVal,
            edit_history: []
          };
          exportData.push(openingRow);
        }
      }

      // Sort chronologically (oldest first) so running balance flows correctly
      exportData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // --- Premium VIP PDF Layout ---
      // Top Accent Bar
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 220, 10, "F");

      doc.setFillColor(37, 99, 235); // blue-600
      doc.rect(0, 10, 220, 2, "F");

      // Business Info Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(shopName || "THE ACCOUNTS", 15, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("Premium ERP Financial Ledger System", 15, 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235); // Blue 600
      doc.text("ACCOUNT STATEMENT", 130, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const todayStr = new Date().toLocaleString();
      doc.text(`Generated: ${todayStr}`, 130, 30);
      
      const rangeText = (ledgerStartDate || ledgerEndDate)
        ? `Period: ${ledgerStartDate || "Start"} to ${ledgerEndDate || "End"}`
        : "Period: Complete History";
      doc.text(rangeText, 130, 35);

      // Metadata box grids
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, 42, 85, 22, "FD"); // Party details
      doc.rect(110, 42, 85, 22, "FD"); // Statement summary

      // Draw inside Party box
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("PARTY DETAILS", 18, 47);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Name: ${selectedParty.name}`, 18, 52);
      doc.text(`Phone: ${selectedParty.phone || "N/A"}`, 18, 57);
      doc.text(`Type: ${selectedParty.type.toUpperCase()}`, 18, 61);

      // Financial Summary Block calculations
      const exportDebits = exportData.filter(e => e.type === "debit").reduce((sum, e) => sum + e.amount, 0);
      const exportCredits = exportData.filter(e => e.type === "credit").reduce((sum, e) => sum + e.amount, 0);
      const closingBal = exportData.length > 0 ? exportData[exportData.length - 1].runningBalance : 0;

      // Draw inside Summary box
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text("STATEMENT SUMMARY", 113, 47);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total Debits (+): Rs ${exportDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 113, 52);
      doc.text(`Total Credits (-): Rs ${exportCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 113, 57);
      
      // Closing balance styling
      const isRed = (selectedParty.type === "customer" && closingBal < 0) || (selectedParty.type === "supplier" && closingBal > 0);
      doc.setFont("helvetica", "bold");
      if (isRed) {
        doc.setTextColor(220, 38, 38); // Red 600
      } else if (closingBal !== 0) {
        doc.setTextColor(5, 150, 105); // Emerald 600
      } else {
        doc.setTextColor(71, 85, 105); // Slate 600
      }
      doc.text(`Closing Balance: Rs ${Math.abs(closingBal).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${
        closingBal > 0 
          ? (selectedParty.type === "customer" ? "(Receivable)" : "(Payable)")
          : closingBal < 0
            ? (selectedParty.type === "customer" ? "(Payable)" : "(Receivable)")
            : "(Balanced)"
      }`, 113, 61);

      // Generate AutoTable
      const headers = [["Date", "Details / Remarks", "Source", "Debit (+)", "Credit (-)", "Balance"]];
      const tableRows = exportData.map(entry => [
        new Date(entry.date).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        sanitizeRemarksForPDF(entry.remarks),
        entry.source.toUpperCase(),
        entry.type === "debit" && entry.amount > 0 ? `+Rs ${entry.amount.toFixed(2)}` : "",
        entry.type === "credit" && entry.amount > 0 ? `-Rs ${entry.amount.toFixed(2)}` : "",
        `Rs ${entry.runningBalance.toFixed(2)}`
      ]);

      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: 68,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Slate 800
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold",
          halign: "left"
        },
        columnStyles: {
          0: { cellWidth: 35 }, // Date
          1: { cellWidth: 55 }, // Details
          2: { cellWidth: 20 }, // Source
          3: { cellWidth: 25, halign: "right" }, // Debit
          4: { cellWidth: 25, halign: "right" }, // Credit
          5: { cellWidth: 30, halign: "right" }  // Balance
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate 50
        },
        didParseCell: (data) => {
          // Right align headers for columns 3, 4, 5
          if (data.column.index >= 3 && data.cell.section === "head") {
            data.cell.styles.halign = "right";
          }
          // Highlight Debit and Credit cell text colors
          if (data.cell.section === "body") {
            if (data.column.index === 3 && data.cell.text[0]) {
              data.cell.styles.textColor = [220, 38, 38]; // Red 600
              data.cell.styles.fontStyle = "bold";
            }
            if (data.column.index === 4 && data.cell.text[0]) {
              data.cell.styles.textColor = [5, 150, 105]; // Emerald 600
              data.cell.styles.fontStyle = "bold";
            }
            if (data.column.index === 5) {
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      });

      // Add page numbers and Authorized signature bar in footer
       const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          `Generated by The Accounts ERP • Page ${i} of ${totalPages}`,
          14,
          287
        );
        doc.text("Authorized Signature: _______________________", 130, 287);
      }

      // Save PDF
      const cleanName = selectedParty.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const scopeLabel = downloadAll ? "full" : "filtered";
      if (returnBlobOnly) {
        return doc.output("blob");
      }
      doc.save(`ledger_${cleanName}_${scopeLabel}.pdf`);
      toast.success(`Ledger statement downloaded!`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF: " + err.message);
    }
  };

  const handleDownloadDetailedPDF = async (downloadAll: boolean, returnBlobOnly: boolean = false): Promise<Blob | null | undefined> => {
    if (!selectedParty) return;

    setIsGeneratingDetailedPDF(true);
    toast.loading("Generating detailed ledger statement...", { id: "detailed-pdf" });

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      // Fetch shop details for header if available
      let shopAddressLine = "";
      try {
        if (shopId) {
          const { data: sData } = await supabase
            .from("shops")
            .select("name, address, phone, contact_number")
            .eq("id", shopId)
            .maybeSingle();
          if (sData) {
            const addr = sData.address ? sData.address : "";
            const ph = sData.phone || sData.contact_number ? `Phone : Cell : ${sData.phone || sData.contact_number}` : "";
            shopAddressLine = [addr, ph].filter(Boolean).join(" ");
          }
        }
      } catch (e) {
        console.log("Could not load shop info", e);
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      // 1. Prepare data
      let exportData = downloadAll ? [...ledger] : [...filteredLedger];

      // Calculate opening balance for PDF
      if (!downloadAll && filteredLedger.length > 0 && filteredLedger.length < ledger.length) {
        const oldestVisibleEntry = filteredLedger[filteredLedger.length - 1];
        const oldestVisibleTime = new Date(oldestVisibleEntry.date).getTime();
        const olderEntries = ledger.filter(e => new Date(e.date).getTime() < oldestVisibleTime);

        if (olderEntries.length > 0) {
          const openingBalanceVal = olderEntries[0].runningBalance;
          const openingRow: LedgerEntry = {
            id: "opening-bal-forward-pdf",
            date: new Date(oldestVisibleTime - 1000).toISOString(),
            remarks: "Opening Balance (Balance Forward)",
            source: "system" as any,
            amount: 0,
            type: "debit",
            runningBalance: openingBalanceVal,
            edit_history: []
          };
          exportData.push(openingRow);
        }
      }

      // Sort chronologically (oldest first)
      exportData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // 2. Identify sales invoice IDs vs purchase order IDs
      const saleInvoiceIds: string[] = [];
      const purchaseOrderIds: string[] = [];

      exportData.forEach(entry => {
        if (entry.source === "invoice" && entry.id && entry.id !== "opening-balance-virtual" && entry.id !== "opening-bal-forward-pdf") {
          const rem = (entry.remarks || "").toLowerCase();
          if (rem.includes("purchase")) {
            purchaseOrderIds.push(entry.id);
          } else {
            saleInvoiceIds.push(entry.id);
          }
        }
      });

      // 3. Batch fetch items for all bills in this statement
      const itemsByTxId: Record<string, any[]> = {};

      if (saleInvoiceIds.length > 0) {
        const { data: sItems } = await supabase
          .from("invoice_items")
          .select(`
            id,
            invoice_id,
            product_id,
            variant_id,
            quantity,
            unit_price,
            subtotal,
            packing_name,
            batch_number,
            products ( name, unit )
          `)
          .in("invoice_id", saleInvoiceIds);

        if (sItems && sItems.length > 0) {
          sItems.forEach((it: any) => {
            if (!itemsByTxId[it.invoice_id]) itemsByTxId[it.invoice_id] = [];
            itemsByTxId[it.invoice_id].push({
              name: it.products?.name || "Product Item",
              unit: it.products?.unit || "",
              packing_name: it.packing_name || "",
              quantity: Number(it.quantity || 1),
              unit_price: Number(it.unit_price || 0),
              subtotal: Number(it.subtotal || 0),
              batch_number: it.batch_number
            });
          });
        }
      }

      if (purchaseOrderIds.length > 0) {
        const { data: pItems } = await supabase
          .from("purchase_order_items")
          .select(`
            id,
            purchase_order_id,
            product_id,
            variant_id,
            quantity,
            unit_price,
            subtotal,
            batch_number,
            expiry_date,
            products ( name, unit )
          `)
          .in("purchase_order_id", purchaseOrderIds);

        if (pItems && pItems.length > 0) {
          pItems.forEach((it: any) => {
            if (!itemsByTxId[it.purchase_order_id]) itemsByTxId[it.purchase_order_id] = [];
            itemsByTxId[it.purchase_order_id].push({
              name: it.products?.name || "Product Item",
              unit: it.products?.unit || "",
              packing_name: "",
              quantity: Number(it.quantity || 1),
              unit_price: Number(it.unit_price || 0),
              subtotal: Number(it.subtotal || 0),
              batch_number: it.batch_number,
              expiry_date: it.expiry_date
            });
          });
        }
      }

      // Date Formatters
      const formatTableDate = (d: string | Date) => {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return "";
        const day = String(dt.getDate()).padStart(2, "0");
        const month = String(dt.getMonth() + 1).padStart(2, "0");
        const year = dt.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const formatHeaderDate = (d: string | Date) => {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return "";
        const day = String(dt.getDate()).padStart(2, "0");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[dt.getMonth()];
        const year = String(dt.getFullYear()).slice(-2);
        return `${day}-${month}-${year}`;
      };

      // Header Date Range
      let fromDateLabel = "01-Jan-26";
      let toDateLabel = formatHeaderDate(new Date());
      if (ledgerStartDate) {
        fromDateLabel = formatHeaderDate(ledgerStartDate);
      } else if (exportData.length > 0) {
        fromDateLabel = formatHeaderDate(exportData[0].date);
      }
      if (ledgerEndDate) {
        toDateLabel = formatHeaderDate(ledgerEndDate);
      } else if (exportData.length > 0) {
        toDateLabel = formatHeaderDate(exportData[exportData.length - 1].date);
      }

      // Render Header
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(shopName || "Faizan Mobile Parts", 148.5, 10, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      if (shopAddressLine) {
        doc.text(shopAddressLine, 148.5, 15, { align: "center" });
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const titleText = `Ledger Detail (From: ${fromDateLabel} To: ${toDateLabel})`;
      doc.text(titleText, 148.5, 20, { align: "center" });

      // Party Name Box
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.rect(5, 24, 115, 6.5);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("Party Name :", 7, 28.5);
      doc.text(selectedParty.name, 28, 28.5);

      // Build Table Data
      const headers = [[
        "Invoice#",
        "Invoice\nDate",
        "Type",
        "Payment\nMode",
        "Receipt#",
        "Item Name",
        "Store",
        "Quantity",
        "Rate",
        "Item\nDiscount",
        "Percentage\nAmount",
        "Sub Total",
        "Debit",
        "Credit",
        "Balance"
      ]];

      const tableRows: any[] = [];

      exportData.forEach((entry) => {
        const isOpening = entry.id.startsWith("opening-") || entry.remarks.toLowerCase().includes("opening balance");
        const isInvoice = entry.source === "invoice" && !isOpening;
        const items = entry.items || itemsByTxId[entry.id] || [];

        if (isOpening) {
          const bal = entry.runningBalance;
          tableRows.push([
            "0",
            formatTableDate(entry.date),
            "0-Opening",
            "",
            "0",
            "Opening Balance Forward",
            "",
            ".00",
            "0.00",
            "0.00",
            "0.00",
            "0.00",
            bal > 0 ? bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00",
            bal < 0 ? Math.abs(bal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00",
            bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          ]);
        } else if (isInvoice && items.length > 0) {
          const billMatch = (entry.remarks || "").match(/(?:Bill|PO|Invoice|Agreement|Agr)\s*#\s*([A-Za-z0-9_-]+)/i);
          let invNum = billMatch ? billMatch[1] : "";
          if (!invNum && entry.id) {
            const cleanId = entry.id.replace(/^(inv-paid-|po-paid-|opening-bal-)/, "");
            invNum = isUuid(cleanId) ? cleanId.slice(0, 8).toUpperCase() : cleanId;
          }
          if (!invNum) invNum = "1";

          const isPurchase = (entry.remarks || "").toLowerCase().includes("purchase");
          const invType = isPurchase ? "1-Purchase" : "2-Sale";

          let paymentMode = "Credit";
          if (entry.paid_amount && entry.paid_amount > 0 && entry.remaining_credit && entry.remaining_credit > 0) {
            paymentMode = `Partial (Cash Rs ${Math.round(entry.paid_amount).toLocaleString()})`;
          } else if (entry.paid_amount && entry.paid_amount > 0 && (!entry.remaining_credit || entry.remaining_credit <= 0)) {
            paymentMode = "Cash (Paid in Full)";
          } else if ((entry.remarks || "").toLowerCase().includes("cash")) {
            paymentMode = "Cash";
          }

          items.forEach((it: any, itemIdx: number) => {
            const itQty = Number(it.quantity || 1);
            const itRate = Number(it.unit_price || 0);
            const itSubtotal = Number(it.subtotal || (itQty * itRate));
            const debitVal = !isPurchase ? itSubtotal : 0;
            const creditVal = isPurchase ? itSubtotal : 0;

            let itemNameDisplay = it.name + (it.packing_name ? ` [${it.packing_name}]` : "");

            // If partial cash payment, clearly state on the last item row of this bill
            if (entry.paid_amount && entry.paid_amount > 0 && entry.remaining_credit && entry.remaining_credit > 0 && itemIdx === items.length - 1) {
              itemNameDisplay += ` - [Cash Received: Rs ${Math.round(entry.paid_amount).toLocaleString()} | Credit Due: Rs ${Math.round(entry.remaining_credit).toLocaleString()}]`;
            }

            tableRows.push([
              invNum,
              formatTableDate(entry.date),
              invType,
              paymentMode,
              "0",
              itemNameDisplay,
              "Main Store",
              itQty.toFixed(2),
              itRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              "0.00",
              "0.00",
              itSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              debitVal > 0 ? debitVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00",
              creditVal > 0 ? creditVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00",
              itemIdx === items.length - 1
                ? entry.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : ""
            ]);
          });
        } else {
          // Cash Received, Cash Paid, or Manual Entry
          let txType = "3-Cash Received";
          let pMode = "Cash";
          let invNum = "0";
          let receiptNum = "0";
          let description = sanitizeRemarksForPDF(entry.remarks || "");

          if (entry.id.startsWith("inv-paid-")) {
            txType = "3-Cash Received";
            pMode = "Cash";
            const rawId = entry.id.replace("inv-paid-", "");
            invNum = isUuid(rawId) ? rawId.slice(0, 8).toUpperCase() : rawId;
            receiptNum = invNum;
            description = `Cash Received at Checkout - Bill #${invNum} (Cash: Rs ${Math.round(entry.amount).toLocaleString()})`;
          } else if (entry.id.startsWith("po-paid-")) {
            txType = "4-Cash Paid";
            pMode = "Cash";
            const rawId = entry.id.replace("po-paid-", "");
            invNum = isUuid(rawId) ? rawId.slice(0, 8).toUpperCase() : rawId;
            receiptNum = invNum;
            description = `Cash Paid at Purchase - PO #${invNum} (Cash: Rs ${Math.round(entry.amount).toLocaleString()})`;
          } else if (entry.type === "credit") {
            txType = selectedParty.type === "customer" ? "3-Cash Received" : "1-Purchase Bill";
            pMode = selectedParty.type === "customer" ? "Cash" : "Credit";
            if (!description) description = selectedParty.type === "customer" ? "Cash Received from Customer" : "Purchase Bill / Credit Adjustment";
          } else if (entry.type === "debit") {
            txType = selectedParty.type === "customer" ? "2-Sale" : "4-Cash Paid";
            pMode = selectedParty.type === "customer" ? "Credit" : "Cash";
            if (!description) description = selectedParty.type === "customer" ? "Sale on Credit" : "Cash Paid to Supplier";
          }

          const debitAmt = entry.type === "debit" ? entry.amount : 0;
          const creditAmt = entry.type === "credit" ? entry.amount : 0;

          tableRows.push([
            invNum,
            formatTableDate(entry.date),
            txType,
            pMode,
            receiptNum,
            description,
            "",
            ".00",
            "0.00",
            "0.00",
            "0.00",
            "0.00",
            debitAmt > 0 ? debitAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00",
            creditAmt > 0 ? creditAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00",
            entry.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          ]);
        }
      });

      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: 32,
        margin: { left: 5, right: 5, top: 32, bottom: 10 },
        theme: "grid",
        styles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          fontSize: 6.2,
          cellPadding: 1,
          textColor: [0, 0, 0],
          font: "helvetica",
          valign: "middle"
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 6.2,
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
          halign: "center",
          valign: "middle"
        },
        columnStyles: {
          0: { cellWidth: 13, halign: "center" }, // Invoice#
          1: { cellWidth: 16, halign: "center" }, // Invoice Date
          2: { cellWidth: 19, halign: "left" },   // Type
          3: { cellWidth: 15, halign: "left" },   // Payment Mode
          4: { cellWidth: 12, halign: "center" }, // Receipt#
          5: { cellWidth: 63, halign: "left" },   // Item Name
          6: { cellWidth: 15, halign: "left" },   // Store
          7: { cellWidth: 13, halign: "right" },  // Quantity
          8: { cellWidth: 15, halign: "right" },  // Rate
          9: { cellWidth: 14, halign: "right" },  // Item Discount
          10: { cellWidth: 15, halign: "right" }, // Percentage Amount
          11: { cellWidth: 17, halign: "right" }, // Sub Total
          12: { cellWidth: 18, halign: "right" }, // Debit
          13: { cellWidth: 18, halign: "right" }, // Credit
          14: { cellWidth: 18, halign: "right" }  // Balance
        }
      });

      // Add page numbers and footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        const printDateStr = `Print Date:   ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-")}`;
        doc.text(printDateStr, 5, 203);
        doc.text(`Page ${i} of ${totalPages}`, 292, 203, { align: "right" });
      }

      // Save PDF
      const cleanName = selectedParty.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const scopeLabel = downloadAll ? "full_detailed" : "filtered_detailed";
      if (returnBlobOnly) {
        return doc.output("blob");
      }
      doc.save(`ledger_detail_${cleanName}_${scopeLabel}.pdf`);
      toast.success("Detailed Ledger PDF downloaded successfully!", { id: "detailed-pdf" });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate detailed PDF: " + err.message, { id: "detailed-pdf" });
    } finally {
      setIsGeneratingDetailedPDF(false);
    }
  };

  const handleSendWhatsAppReminder = async () => {
    if (subscriptionTier === "free") {
      toast.error("مفت پلان پر واٹس ایپ الرٹس کی سہولت میسر نہیں ہے۔ براہ کرم اپنا سبسکرپشن پلان اپگریڈ کریں۔", {
        description: "WhatsApp alerts are not available on the Free Plan. Please upgrade to Starter or Premium."
      });
      return;
    }

    if (!selectedParty || !selectedParty.phone) {
      toast.error("Phone number not available for this party.");
      return;
    }

    const sendPDF = window.confirm("کیا آپ کسٹمر کو لیجر پی ڈی ایف (PDF Statement) بھیجنا چاہتے ہیں؟\n\nہاں (OK) کرنے کی صورت میں پی ڈی ایف خود بخود لنک کی شکل میں میسج میں شامل ہو جائے گی۔");

    // Open blank window immediately to bypass popup blockers
    const waWindow = window.open("about:blank", "_blank");
    if (waWindow) {
      waWindow.document.write("<html><head><title>Opening WhatsApp...</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f8fafc;color:#475569;margin:0;} .spinner{border:3px solid #e2e8f0;border-top:3px solid #10b981;border-radius:50%;width:24px;height:24px;animation:spin 1s linear infinite;margin-bottom:12px;} @keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}} .container{text-align:center;}</style></head><body><div class='container'><div class='spinner' style='margin:0 auto 12px auto;'></div><div>Opening WhatsApp, please wait...</div></div></body></html>");
    }

    let statementUrl = "";
    if (sendPDF) {
      toast.loading("پی ڈی ایف تیار اور اپلوڈ کی جا رہی ہے...", { id: "upload-status" });
      try {
        const blob = await handleDownloadPDF(true, true);
        if (blob) {
          const filename = `${selectedParty.id}_${Date.now()}.pdf`;
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

          statementUrl = window.location.origin + resData.url;
          toast.success("پی ڈی ایف اپلوڈ ہو گئی ہے!", { id: "upload-status" });
        }
      } catch (err: any) {
        toast.error("اپلوڈ فیل ہو گیا: " + err.message, { id: "upload-status" });
        if (waWindow) waWindow.close();
      }
    }

    const phone = selectedParty.phone.replace(/[^0-9]/g, ""); // Keep only digits
    let formattedPhone = phone;
    if (phone.startsWith("03")) {
      formattedPhone = "92" + phone.slice(1);
    } else if (phone.startsWith("3")) {
      formattedPhone = "92" + phone;
    }

    // ── Build Detailed Ledger Summary for WhatsApp Message ──
    const recentInvoice = ledger.find(e => e.source === "invoice" && e.type === (selectedParty.type === "customer" ? "debit" : "credit"));
    let recentBillSection = "";
    if (recentInvoice) {
      const invTotal = recentInvoice.total_bill ?? recentInvoice.amount;
      const invPaid = recentInvoice.paid_amount ?? (ledger.find(e => e.id === `inv-paid-${recentInvoice.id}`)?.amount || 0);
      const invRemaining = Math.max(0, invTotal - invPaid);
      const itemsList = recentInvoice.items && recentInvoice.items.length > 0
        ? recentInvoice.items.map(it => `• ${it.name}${it.packing_name ? ` [${it.packing_name}]` : ""}: ${it.quantity} × Rs ${Math.round(it.unit_price).toLocaleString()} = Rs ${Math.round(it.subtotal).toLocaleString()}`).join("\n")
        : "";

      recentBillSection = `━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *آخری بل کی تفصیل (Recent Bill Breakdown):*\n` +
        `📄 *بل نمبر:* #${recentInvoice.id.slice(0, 8).toUpperCase()}\n` +
        `📅 *بل کی تاریخ:* ${new Date(recentInvoice.date).toLocaleDateString("en-PK")}\n` +
        (itemsList ? `🛍️ *اشیاء:*\n${itemsList}\n` : "") +
        `💰 *کُل بل (Bill Total):* Rs ${Math.round(invTotal).toLocaleString()}\n` +
        `💵 *نقد وصولی (Cash Received):* Rs ${Math.round(invPaid).toLocaleString()}\n` +
        (invRemaining > 0 
          ? `⚠️ *اس بل کا بقایا ادھار (Bill Balance):* Rs ${Math.round(invRemaining).toLocaleString()}\n`
          : `✅ *اس بل کی ادائیگی:* مکمل ادا شدہ (Fully Settled)\n`);
    }

    const message = `السلام علیکم محترم *${selectedParty.name}* صاحب!\n\n` +
      `*${shopName || "ہمارا کاروبار"}* کی جانب سے آپ کے کھاتہ کی تفصیل درج ذیل ہے:\n` +
      recentBillSection +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *کُل کھاتہ بقایا (Total Ledger Balance):*\n` +
      `کُل واجب الادا رقم: *Rs ${Math.abs(selectedParty.current_balance).toLocaleString()}* (${selectedParty.current_balance > 0 ? (selectedParty.type === "customer" ? "قابلِ وصول - Receivable" : "قابلِ ادائیگی - Payable") : "برابر"})\n\n` +
      `${statementUrl ? `📥 *مکمل لیجر پی ڈی ایف دیکھنے / ڈاؤن لوڈ کرنے کے لیے لنک:*\n👉 ${statementUrl}\n\n` : ""}` +
      `براہ کرم حساب چیک فرما کر بقایا رقم کی جلد ادائیگی فرمائیں۔ شکریہ! 🤝\n` +
      `منجانب: *${shopName || "ہمارا کاروبار"}*`;
    const encodedText = encodeURIComponent(message);
    const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;

    if (waWindow) {
      waWindow.location.href = waUrl;
    } else {
      window.open(waUrl, "_blank");
    }
  };

  const handleSendBulkPartyReminder = async (party: Party) => {
    if (subscriptionTier === "free") {
      toast.error("مفت پلان پر واٹس ایپ الرٹس کی سہولت میسر نہیں ہے۔ براہ کرم اپنا سبسکرپشن پلان اپگریڈ کریں۔", {
        description: "WhatsApp alerts are not available on the Free Plan. Please upgrade to Starter or Premium."
      });
      return;
    }

    if (!party.phone) {
      toast.error("Phone number not available.");
      return;
    }

    // Open target window immediately to bypass pop-up blockers
    const waWindow = window.open("about:blank", "_blank");
    if (waWindow) {
      waWindow.document.write("<html><head><title>Opening WhatsApp...</title><style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f8fafc;color:#475569;margin:0;} .spinner{border:3px solid #e2e8f0;border-top:3px solid #10b981;border-radius:50%;width:24px;height:24px;animation:spin 1s linear infinite;margin-bottom:12px;} @keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}} .container{text-align:center;}</style></head><body><div class='container'><div class='spinner' style='margin:0 auto 12px auto;'></div><div>Opening WhatsApp, please wait...</div></div></body></html>");
    }

    const phone = party.phone.replace(/[^0-9]/g, ""); // Keep only digits
    let formattedPhone = phone;
    if (phone.startsWith("03")) {
      formattedPhone = "92" + phone.slice(1);
    } else if (phone.startsWith("3")) {
      formattedPhone = "92" + phone;
    }

    const message = `السلام علیکم محترم *${party.name}* صاحب!\n\n` +
      `*${shopName || "ہمارا کاروبار"}* کی جانب سے آپ کے کھاتہ کی تفصیل:\n` +
      `📊 *کُل کھاتہ کا واجب الادا بقایا:* *Rs ${Math.abs(party.current_balance).toLocaleString()}* (${party.current_balance > 0 ? "قابلِ وصول - Receivable" : "قابلِ ادائیگی - Payable"})\n\n` +
      `براہ کرم حساب چیک فرما کر بقایا رقم کی جلد ادائیگی فرمائیں۔ شکریہ! 🤝\n` +
      `منجانب: *${shopName || "ہمارا کاروبار"}*`;
    const encodedText = encodeURIComponent(message);
    const waUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;

    if (waWindow) {
      waWindow.location.href = waUrl;
    } else {
      window.open(waUrl, "_blank");
    }

    // Mark as sent
    setBulkSentList(prev => [...prev, party.id]);
  };

  const handleEditTransaction = async () => {
    if (!selectedParty || !txToEdit || editTxAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsSubmittingEditTx(true);
    try {
      const oldAmount = txToEdit.amount;
      const newAmount = editTxAmount;
      const newRemarks = editTxRemarks;
      const txId = txToEdit.id;

      // 1. Fetch old transaction details for edit history
      const { data: oldTx, error: fetchTxErr } = await supabase
        .from("credit_transactions")
        .select("amount, remarks, transaction_type, edit_history")
        .eq("id", txId)
        .single();

      if (fetchTxErr) throw fetchTxErr;

      const isPayment = oldTx.transaction_type === "payment" || oldTx.transaction_type === "receive";

      // Calculate net balance change:
      // payment/receive -> reduces outstanding balance. So increase in payment decreases customer balance. balanceDiff = oldAmount - newAmount
      // charge -> increases outstanding balance. So increase in charge increases customer balance. balanceDiff = newAmount - oldAmount
      let balanceDiff = 0;
      if (isPayment) {
        balanceDiff = oldAmount - newAmount;
      } else {
        balanceDiff = newAmount - oldAmount;
      }

      // 2. Append to edit history
      const newHistoryEntry = {
        amount: Number(oldTx.amount),
        remarks: oldTx.remarks || "",
        transaction_type: oldTx.transaction_type,
        edited_at: new Date().toISOString()
      };

      const oldHistory = Array.isArray(oldTx.edit_history) ? oldTx.edit_history : [];
      const updatedHistory = [newHistoryEntry, ...oldHistory];

      // 3. Update transaction record
      const { error: updateTxErr } = await supabase
        .from("credit_transactions")
        .update({
          amount: newAmount,
          remarks: newRemarks,
          edit_history: updatedHistory
        })
        .eq("id", txId);

      if (updateTxErr) throw updateTxErr;

      // 4. Update Party current balance
      const { error: balanceError } = await supabase
        .rpc("increment_party_balance", {
          p_id: selectedParty.id,
          amount: balanceDiff
        });

      if (balanceError) throw balanceError;

      toast.success("Transaction updated successfully!");
      setIsEditTxModalOpen(false);
      setTxToEdit(null);

      // Refresh party balance in state
      const updatedParty = {
        ...selectedParty,
        current_balance: selectedParty.current_balance + balanceDiff
      };
      setSelectedParty(updatedParty);

      // Refresh lists
      fetchParties();
      fetchLedger(updatedParty);
    } catch (err: any) {
      toast.error("Failed to edit transaction: " + err.message);
    } finally {
      setIsSubmittingEditTx(false);
    }
  };

  const handleShowEditHistory = (entry: LedgerEntry) => {
    const history = entry.edit_history || [];
    setHistoryItems(history);
    
    if (entry.source === "invoice") {
      setHistoryTitle(`Bill Edit History: #${entry.id.slice(0, 8).toUpperCase()}`);
    } else {
      setHistoryTitle(`Transaction Edit History`);
    }
    
    setIsHistoryModalOpen(true);
  };

  const handleOpenEditTxModal = (entry: LedgerEntry) => {
    setTxToEdit(entry);
    setEditTxAmount(entry.amount);
    setEditTxRemarks(entry.remarks);
    setIsEditTxModalOpen(true);
  };

  const handleDeleteTransaction = async (entry: LedgerEntry) => {
    if (!selectedParty) return;

    if (!isAdmin) {
      toast.error("Only Administrators and Owners have permission to delete Khata transactions.");
      return;
    }

    const confirmMsg = `Are you sure you want to DELETE this entry?\n\n"${entry.remarks}" - Rs ${Math.round(entry.amount).toLocaleString()}\n\nThis will permanently remove this transaction and automatically reverse ${selectedParty.name}'s balance.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeletingTxId(entry.id);
    try {
      // 1. Fetch transaction details from DB
      const { data: tx, error: fetchErr } = await supabase
        .from("credit_transactions")
        .select("id, amount, transaction_type")
        .eq("id", entry.id)
        .single();

      if (fetchErr || !tx) {
        throw new Error(fetchErr?.message || "Transaction not found");
      }

      const isPayment = tx.transaction_type === "payment" || tx.transaction_type === "receive";
      
      // Calculate balance delta to reverse:
      // If payment: was reducing balance, so deleting it increases balance (+amount).
      // If charge: was increasing balance, so deleting it decreases balance (-amount).
      const balanceDiff = isPayment ? Number(tx.amount) : -Number(tx.amount);

      // 1.5. Reverse and delete linked cash account transaction if exists
      const { data: linkedAccTx } = await supabase
        .from("account_transactions")
        .select("id, account_id, type, amount")
        .eq("ref_type", "party_tx")
        .eq("ref_id", entry.id)
        .maybeSingle();

      if (linkedAccTx) {
        const { data: acc } = await supabase
          .from("cash_accounts")
          .select("id, current_balance")
          .eq("id", linkedAccTx.account_id)
          .single();

        if (acc) {
          const reversedBalance = linkedAccTx.type === "deposit"
            ? Number(acc.current_balance) - Number(linkedAccTx.amount)
            : Number(acc.current_balance) + Number(linkedAccTx.amount);

          await supabase
            .from("cash_accounts")
            .update({ current_balance: reversedBalance })
            .eq("id", linkedAccTx.account_id);

          setCashAccounts(prev => prev.map(a => 
            a.id === linkedAccTx.account_id 
              ? { ...a, current_balance: reversedBalance }
              : a
          ));
        }

        await supabase
          .from("account_transactions")
          .delete()
          .eq("id", linkedAccTx.id);
      }

      // 2. Delete the credit transaction row
      const { error: deleteErr } = await supabase
        .from("credit_transactions")
        .delete()
        .eq("id", entry.id);

      if (deleteErr) throw deleteErr;

      // 3. Update Party current balance
      const { error: balanceError } = await supabase
        .rpc("increment_party_balance", {
          p_id: selectedParty.id,
          amount: balanceDiff
        });

      if (balanceError) throw balanceError;

      toast.success("Transaction deleted and party balance updated!");

      const updatedParty = {
        ...selectedParty,
        current_balance: Number(selectedParty.current_balance || 0) + balanceDiff
      };
      setSelectedParty(updatedParty);

      fetchParties();
      fetchLedger(updatedParty);
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      toast.error("Failed to delete transaction: " + err.message);
    } finally {
      setIsDeletingTxId(null);
    }
  };

  const handleContraOffset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contraCustomer || !contraSupplier || contraAmount <= 0) {
      toast.error("Please select both customer & supplier and enter a valid offset amount.");
      return;
    }

    setSubmittingContra(true);
    try {
      // 1. Create a manual Journal Entry for the offset
      const { data: header, error: headerErr } = await supabase
        .from("journal_entries")
        .insert({
          shop_id: shopId,
          entry_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0],
          ref_type: "manual",
          narration: `Contra Offset: ${contraRemarks.trim() || "Mutual offset reconciliation"}`
        })
        .select()
        .single();

      if (headerErr) throw headerErr;

      // 2. Insert lines to journal_lines:
      // Debit: 2001 Accounts Payable (Supplier) -> Reduces payable balance
      // Credit: 1002 Accounts Receivable (Customer) -> Reduces receivable balance
      const lines = [
        {
          entry_id: header.id,
          account_code: "2001",
          account_name: "Accounts Payable (Suppliers)",
          debit: contraAmount,
          credit: 0
        },
        {
          entry_id: header.id,
          account_code: "1002",
          account_name: "Accounts Receivable (Customers)",
          debit: 0,
          credit: contraAmount
        }
      ];

      const { error: linesErr } = await supabase
        .from("journal_lines")
        .insert(lines);

      if (linesErr) throw linesErr;

      // 3. Post to credit_transactions for the Customer
      const { error: custErr } = await supabase
        .from("credit_transactions")
        .insert({
          shop_id: shopId,
          customer_id: contraCustomer,
          amount: contraAmount,
          transaction_type: "payment", // credit payment decreases receivable
          remarks: `Contra Offset: Offset with Supplier (${parties.find(p => p.id === contraSupplier)?.name || "Partner"})`
        });

      if (custErr) throw custErr;

      // 4. Post to credit_transactions for the Supplier
      const { error: suppErr } = await supabase
        .from("credit_transactions")
        .insert({
          shop_id: shopId,
          customer_id: contraSupplier,
          amount: contraAmount,
          transaction_type: "payment", // debit payment decreases payable
          remarks: `Contra Offset: Offset with Customer (${parties.find(p => p.id === contraCustomer)?.name || "Partner"})`
        });

      if (suppErr) throw suppErr;

      // 5. Update party balances in database
      await supabase.rpc("increment_party_balance", { p_id: contraCustomer, amount: -contraAmount });
      await supabase.rpc("increment_party_balance", { p_id: contraSupplier, amount: -contraAmount });

      toast.success("Contra offset completed and posted successfully! 🤝");
      setIsContraOpen(false);
      setContraAmount(0);
      setContraRemarks("");
      setContraCustomer("");
      setContraSupplier("");

      // Update selected party balance if it was involved
      if (selectedParty) {
        if (selectedParty.id === contraCustomer || selectedParty.id === contraSupplier) {
          const updatedParty = {
            ...selectedParty,
            current_balance: selectedParty.current_balance - contraAmount
          };
          setSelectedParty(updatedParty);
          fetchLedger(updatedParty);
        }
      }

      fetchParties();
    } catch (err: any) {
      toast.error("Contra reconciliation failed: " + err.message);
    } finally {
      setSubmittingContra(false);
    }
  };
  const trashedCount = useMemo(() => {
    return parties.filter(p => isPartyDeleted(p)).length;
  }, [parties]);

  const filteredParties = parties.filter(p => {
    const isDeleted = isPartyDeleted(p);
    if (filterType === "trash") {
      if (!isDeleted) return false;
    } else {
      if (isDeleted) return false;
      const matchesType = filterType === "all" || p.type === filterType || (p.type === "dual" && (filterType === "customer" || filterType === "supplier"));
      if (!matchesType) return false;
    }

    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.phone && p.phone.includes(searchQuery));
    return matchesSearch;
  });

  // Calculate totals (exclude trashed parties)
  const totalReceivable = parties
    .filter(p => !isPartyDeleted(p) && p.type === "customer" && p.current_balance > 0)
    .reduce((acc, p) => acc + p.current_balance, 0);

  const totalPayable = parties
    .filter(p => !isPartyDeleted(p) && p.type === "supplier" && p.current_balance > 0)
    .reduce((acc, p) => acc + p.current_balance, 0);

  // Memoized Filtered Ledger History
  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => {
      // 1. Search Query
      const matchesSearch = 
        entry.remarks.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        entry.source.toLowerCase().includes(ledgerSearch.toLowerCase());

      // 2. Type Filter
      const matchesType = ledgerTypeFilter === "all" || entry.type === ledgerTypeFilter;

      // 3. Date Filter
      let matchesDate = true;
      if (ledgerStartDate || ledgerEndDate) {
        const entryDate = new Date(entry.date);
        if (ledgerStartDate) {
          const start = new Date(ledgerStartDate);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && entryDate >= start;
        }
        if (ledgerEndDate) {
          const end = new Date(ledgerEndDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && entryDate <= end;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [ledger, ledgerSearch, ledgerTypeFilter, ledgerStartDate, ledgerEndDate]);

  // Memoized visible ledger entries, including prepended opening balance / balance forward if filtered
  const visibleLedgerList = useMemo(() => {
    if (filteredLedger.length === 0) return [];
    if (filteredLedger.length === ledger.length) return filteredLedger; // No filters active or all entries match

    // Find the oldest visible entry in filteredLedger
    // Since filteredLedger is sorted descending (newest first), the last entry is the oldest visible.
    const oldestVisibleEntry = filteredLedger[filteredLedger.length - 1];
    
    // Find all entries in ledger that are chronologically older than oldestVisibleEntry
    const oldestVisibleTime = new Date(oldestVisibleEntry.date).getTime();
    const olderEntries = ledger.filter(e => new Date(e.date).getTime() < oldestVisibleTime);

    if (olderEntries.length > 0) {
      // The newest of these older entries represents the running balance right before the filtered period
      // Since ledger is sorted descending, the olderEntries will also be sorted descending.
      // So olderEntries[0] is the newest of the older entries.
      const openingBalanceVal = olderEntries[0].runningBalance;

      // Construct opening balance row
      const openingRow: LedgerEntry = {
        id: "opening-bal-forward",
        date: oldestVisibleEntry.date, // Use same date
        remarks: "Opening Balance (Balance Forward)",
        source: "system" as any, 
        amount: 0,
        type: "debit",
        runningBalance: openingBalanceVal,
        edit_history: []
      };

      // Append opening balance row to the end of descending filteredLedger list
      // (so it renders at the bottom of the table, as the oldest entry!)
      return [...filteredLedger, openingRow];
    }

    return filteredLedger;
  }, [ledger, filteredLedger]);

  // Paginated Ledger History
  const totalPages = Math.ceil(visibleLedgerList.length / itemsPerPage);
  const paginatedLedger = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return visibleLedgerList.slice(startIdx, startIdx + itemsPerPage);
  }, [visibleLedgerList, currentPage]);

  const hasActiveFilters = Boolean(ledgerSearch || ledgerTypeFilter !== "all" || ledgerStartDate || ledgerEndDate);

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-2.5 lg:gap-3 h-[calc(100dvh-5.25rem)] lg:h-[calc(100vh-6.5rem)] overflow-hidden print:hidden font-sans min-h-0">
      
      {/* Left List Pane: Parties */}
      <div className={`w-full lg:w-80 flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs p-2.5 sm:p-3 overflow-hidden shrink-0 min-h-0 h-full ${showLedgerDetails ? "hidden lg:flex" : "flex"}`}>
        
        {/* Ledger Summary Card */}
        <div className="grid grid-cols-2 gap-2 mb-2 shrink-0">
          <div className="bg-emerald-50 border border-emerald-150 p-2 rounded-xl">
            <span className="text-[9.5px] font-bold text-emerald-700 uppercase block truncate">{t("receivable_miliga")}</span>
            <span className="text-xs sm:text-sm font-black text-emerald-800">Rs {totalReceivable.toLocaleString()}</span>
          </div>
          <div className="bg-rose-50 border border-rose-150 p-2 rounded-xl">
            <span className="text-[9.5px] font-bold text-rose-700 uppercase block truncate">{t("payable_dena_ha")}</span>
            <span className="text-xs sm:text-sm font-black text-rose-800">Rs {totalPayable.toLocaleString()}</span>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg text-xs mb-2 shadow-2xs shrink-0">
          {(["all", "customer", "supplier", "trash"] as const).map(tab => {
            const isTrash = tab === "trash";
            return (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`flex-1 py-1 px-1 text-[10.5px] rounded-md font-bold capitalize transition-colors flex items-center justify-center gap-0.5 ${
                  filterType === tab 
                    ? (isTrash ? "bg-red-600 text-white shadow-2xs" : "bg-white text-slate-800 shadow-2xs")
                    : (isTrash ? "text-red-500 hover:text-red-700 hover:bg-red-50" : "text-slate-500 hover:text-slate-800")
                }`}
              >
                {isTrash && <Trash2 size={10} className={filterType === tab ? "text-white" : "text-red-500"} />}
                <span>
                  {tab === "all" ? t("all_khata") : tab === "customer" ? t("customers") : tab === "supplier" ? t("suppliers") : "Trash"}
                </span>
                {isTrash && trashedCount > 0 && (
                  <span className={`text-[8.5px] px-1 py-0.2 rounded-full font-black ${filterType === tab ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}>
                    {trashedCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-2 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input 
            placeholder={t("search_party_by_name")} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 bg-slate-50 border-slate-200 text-xs rounded-lg shadow-2xs"
          />
        </div>

        {/* Add Party & Contra Settlement Buttons */}
        {!activeClosingBook && (
          <div className="flex flex-col gap-1.5 mb-2 shrink-0">
            <div className="flex gap-1.5">
              <Button onClick={() => setIsPartyModalOpen(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs rounded-lg shadow-2xs">
                <PlusCircle className="mr-1 h-3.5 w-3.5" /> {t("add_party")}
              </Button>
              <Button 
                onClick={() => setIsContraOpen(true)} 
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold h-8 text-xs rounded-lg shadow-2xs"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> {t("contra_offset")}
              </Button>
            </div>
            <Button 
              onClick={() => setIsBulkModalOpen(true)} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-7.5 shadow-2xs flex items-center justify-center gap-1.5 text-xs rounded-lg"
            >
              💬 {t("send_bulk_reminders")}
            </Button>
          </div>
        )}

        {/* Parties List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar min-h-0 pb-28 lg:pb-2">
          {loading ? (
            <div className="flex justify-center items-center py-8 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-600" />
              <span className="text-xs">Loading ledger...</span>
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-medium">
              {filterType === "trash" ? "No trashed parties found" : "No Khata entries found"}
            </div>
          ) : (
            filteredParties.map(party => {
              const inTrash = isPartyDeleted(party);
              return (
                <div
                  key={party.id}
                  onClick={() => {
                    setSelectedParty(party);
                    setShowLedgerDetails(true);
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    selectedParty?.id === party.id
                      ? inTrash 
                        ? "bg-red-50/80 border-red-300 shadow-2xs"
                        : "bg-blue-50/80 border-blue-300 shadow-2xs"
                      : inTrash
                        ? "bg-red-50/30 hover:bg-red-50/60 border-red-200/60 opacity-80"
                        : "bg-slate-50/50 hover:bg-slate-100 border-slate-200/80"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1">
                        <h4 className="font-bold text-slate-800 text-xs leading-snug truncate">{party.name}</h4>
                        {inTrash && (
                          <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1 py-0.2 rounded shrink-0">
                            Trash
                          </span>
                        )}
                      </div>
                      <span className={`inline-block text-[8.5px] font-bold px-1.5 py-0.5 rounded mt-0.5 uppercase ${
                        party.type === "customer" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {party.type}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-black ${
                        party.current_balance > 0 
                          ? (party.type === "customer" ? "text-emerald-600" : "text-rose-600")
                          : "text-slate-400"
                      }`}>
                        Rs {Math.abs(party.current_balance).toLocaleString()}
                      </p>
                      <p className="text-[8.5px] text-slate-400">
                        {party.current_balance > 0 
                          ? (party.type === "customer" ? "Receivable" : "Payable")
                          : "Balanced"
                      }
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* Right Pane: Ledger History & Account Statements */}
      <div className={`flex-1 flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden min-h-0 h-full ${showLedgerDetails ? "flex" : "hidden lg:flex"}`}>
        {selectedParty ? (
          <>
            {/* Header info */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex flex-col gap-2 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLedgerDetails(false)}
                    className="lg:hidden text-slate-600 hover:text-slate-800 p-1.5 h-8 shrink-0 border border-slate-200 bg-white shadow-2xs rounded-lg flex items-center gap-1 text-xs font-bold"
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-1.5 truncate">
                        <BookOpen className="text-blue-600 shrink-0" size={16} /> 
                        <span className="truncate">{selectedParty.name}</span>
                      </h3>
                      <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded ${
                        selectedParty.type === "customer" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {selectedParty.type}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-slate-500 text-[10.5px] mt-0.5 font-medium">
                      {selectedParty.phone && (
                        <a 
                          href={`tel:${selectedParty.phone}`} 
                          className="flex items-center gap-1 text-blue-600 hover:underline font-bold"
                        >
                          <Phone size={10} /> {selectedParty.phone}
                        </a>
                      )}
                      {selectedParty.father_name && (
                        <span>Father: <strong className="text-slate-700 font-bold">{selectedParty.father_name}</strong></span>
                      )}
                      {selectedParty.cnic_number && (
                        <span>CNIC: <strong className="text-slate-700 font-bold">{selectedParty.cnic_number}</strong></span>
                      )}
                      {(selectedParty.type === "customer" || selectedParty.type === "dual") && (
                        <span>Limit: <strong className="text-indigo-600 font-bold">{selectedParty.credit_limit ? `Rs ${selectedParty.credit_limit.toLocaleString()}` : "Unlimited"}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {!activeClosingBook && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPartyDeleted(selectedParty) ? (
                      <>
                        <Button 
                          onClick={() => handleRestoreParty(selectedParty)}
                          disabled={isTrashActionLoading}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-7.5 px-2.5 rounded-lg shadow-2xs shrink-0 flex items-center gap-1"
                        >
                          {isTrashActionLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          <span>بحال کریں (Restore)</span>
                        </Button>
                        {isAdmin && (
                          <Button 
                            onClick={() => handlePermanentDeleteParty(selectedParty)}
                            disabled={isTrashActionLoading}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 font-bold text-xs h-7.5 px-2 rounded-lg shadow-2xs shrink-0 flex items-center gap-1"
                            title="Permanently Delete Party"
                          >
                            <Trash2 size={12} />
                            <span>مکمل ختم</span>
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button 
                          onClick={handleOpenEditPartyModal}
                          variant="outline"
                          size="sm"
                          className="text-slate-600 border-slate-300 font-bold text-xs h-7.5 px-2 hover:bg-slate-50 rounded-lg shadow-2xs shrink-0"
                        >
                          <Edit2 className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <Button 
                          onClick={() => handleMovePartyToTrash(selectedParty)}
                          disabled={isTrashActionLoading}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold text-xs h-7.5 px-2 rounded-lg shrink-0 flex items-center gap-1"
                          title="Move party to Trash / Archive"
                        >
                          <Trash2 size={12} />
                          <span className="hidden sm:inline">Trash</span>
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Trash Notice Banner */}
              {isPartyDeleted(selectedParty) && (
                <div className="bg-red-50 border-t border-b border-red-200/80 px-3 py-2 flex items-center justify-between gap-2 text-red-900 text-xs shrink-0">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                    <span className="font-semibold text-[11px]">
                      <strong>یہ کھاتہ کوڑے دان (Trash) میں ہے۔</strong> یہ فعال فہرست اور مجموعی بقایا جات میں شامل نہیں ہے۔
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRestoreParty(selectedParty)}
                    disabled={isTrashActionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] h-6 px-2 rounded-md shrink-0"
                  >
                    Restore
                  </Button>
                </div>
              )}

              {/* Transactions action buttons */}
              {!activeClosingBook && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                  {selectedParty.type === "supplier" ? (
                    <>
                      <Button 
                        onClick={() => { setTxModalType("pay"); setIsTxModalOpen(true); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8.5 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <ArrowUpRight className="h-4 w-4 shrink-0" /> 
                        <span className="truncate">{t("we_pay_supplier")} (-)</span>
                      </Button>
                      <Button 
                        onClick={() => { setTxModalType("receive"); setIsTxModalOpen(true); }}
                        className="bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs h-8.5 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <ArrowDownLeft className="h-4 w-4 shrink-0" /> 
                        <span className="truncate">{t("refund_receipt")} (+)</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        onClick={() => { setTxModalType("receive"); setIsTxModalOpen(true); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8.5 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <ArrowDownLeft className="h-4 w-4 shrink-0" /> 
                        <span className="truncate">{t("cash_receive")} (-)</span>
                      </Button>
                      <Button 
                        onClick={() => { setTxModalType("pay"); setIsTxModalOpen(true); }}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-8.5 rounded-xl shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <ArrowUpRight className="h-4 w-4 shrink-0" /> 
                        <span className="truncate">{t("cash_give")} (+)</span>
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Current Balance Tracker */}
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-white shrink-0">
              <div className="flex flex-col">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">{t("current_account_balance")}</span>
                {(selectedParty.type === "customer" || selectedParty.type === "dual") && selectedParty.credit_limit !== undefined && selectedParty.credit_limit !== null && selectedParty.current_balance > selectedParty.credit_limit && (
                  <span className="text-[9px] text-red-500 font-extrabold">⚠️ Limit Exceeded by Rs {(selectedParty.current_balance - selectedParty.credit_limit).toLocaleString()}!</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {selectedParty.phone && (
                  <Button 
                    onClick={handleSendWhatsAppReminder}
                    size="sm"
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] h-6.5 px-2 rounded-lg border border-emerald-200 shrink-0 shadow-2xs"
                  >
                    💬 {t("send_whatsapp_reminder")}
                  </Button>
                )}
                <span className={`text-xs sm:text-sm font-black px-2.5 py-0.5 rounded-full ${
                  selectedParty.current_balance > 0 
                    ? (selectedParty.type === "customer" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")
                    : "bg-slate-100 text-slate-700"
                }`}>
                  Rs {Math.abs(selectedParty.current_balance).toLocaleString()} {
                    selectedParty.current_balance > 0 
                      ? (selectedParty.type === "customer" ? `(${t("receivable")})` : `(${t("payable")})`)
                      : `(${t("settled")})`
                  }
                </span>
              </div>
            </div>

            {/* Ledger Filters & Download Bar */}
            <div className="px-3 sm:px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2 text-xs shrink-0 select-none">
              <div className="flex items-center gap-1.5">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search logs by remark/source..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="pl-8 h-8 text-[11px] bg-white border-slate-200 rounded-lg shadow-2xs w-full"
                  />
                </div>

                {/* Mobile Filter Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobileFilters(prev => !prev)}
                  className={`h-8 px-2.5 text-xs font-bold rounded-lg shrink-0 flex md:hidden items-center gap-1 ${
                    hasActiveFilters ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "text-slate-600 border-slate-200"
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  <span>Filters</span>
                  {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                </Button>

                {/* Mobile PDF Toggle */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobilePdfMenu(prev => !prev)}
                  className="h-8 px-2.5 text-xs font-bold rounded-lg shrink-0 flex md:hidden items-center gap-1 text-slate-600 border-slate-200 bg-white"
                >
                  <FileText className="w-3 h-3 text-indigo-600" />
                  <span>PDF</span>
                </Button>

                {/* Desktop Inline Filters */}
                <div className="hidden md:flex items-center gap-2">
                  <select
                    value={ledgerTypeFilter}
                    onChange={(e: any) => setLedgerTypeFilter(e.target.value)}
                    className="bg-white border border-slate-200 h-8 rounded-lg px-2 text-[11px] text-slate-650 font-semibold cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="debit">Debits (+)</option>
                    <option value="credit">Credits (-)</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={ledgerStartDate}
                      onChange={(e) => setLedgerStartDate(e.target.value)}
                      className="h-8 text-[11px] border-slate-200 w-28 bg-white"
                    />
                    <span className="text-slate-400">to</span>
                    <Input
                      type="date"
                      value={ledgerEndDate}
                      onChange={(e) => setLedgerEndDate(e.target.value)}
                      className="h-8 text-[11px] border-slate-200 w-28 bg-white"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        setLedgerSearch("");
                        setLedgerTypeFilter("all");
                        setLedgerStartDate("");
                        setLedgerEndDate("");
                      }}
                      className="text-[10px] text-red-500 hover:text-red-750 font-bold px-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Desktop PDF Download Options */}
                <div className="hidden md:flex items-center gap-1.5 ml-auto">
                  <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg">
                    <Button
                      onClick={() => handleDownloadPDF(false)}
                      variant="ghost"
                      className="text-slate-700 hover:text-slate-900 hover:bg-white font-bold text-[10.5px] h-7 px-2 rounded-md transition-all cursor-pointer"
                      title="Download basic summary of filtered transactions"
                    >
                      Summary (Filtered)
                    </Button>
                    <Button
                      onClick={() => handleDownloadPDF(true)}
                      variant="ghost"
                      className="text-slate-700 hover:text-slate-900 hover:bg-white font-bold text-[10.5px] h-7 px-2 rounded-md transition-all cursor-pointer"
                      title="Download basic summary of all transactions"
                    >
                      Summary (All)
                    </Button>
                  </div>

                  <div className="flex items-center gap-1 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/80 p-0.5 rounded-lg shadow-2xs">
                    <Button
                      disabled={isGeneratingDetailedPDF}
                      onClick={() => handleDownloadDetailedPDF(false)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10.5px] h-7 px-2.5 rounded-md shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                      title="Download detailed statement with full bill products, quantities & rates for filtered dates"
                    >
                      {isGeneratingDetailedPDF ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3 text-indigo-200" />
                      )}
                      <span>Detailed (Filtered)</span>
                    </Button>
                    <Button
                      disabled={isGeneratingDetailedPDF}
                      onClick={() => handleDownloadDetailedPDF(true)}
                      className="bg-violet-700 hover:bg-violet-800 text-white font-black text-[10.5px] h-7 px-2.5 rounded-md shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                      title="Download full lifetime itemized statement with all product breakdowns"
                    >
                      {isGeneratingDetailedPDF ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 text-amber-300" />
                      )}
                      <span>Detailed (All)</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mobile Expanded Filters */}
              {showMobileFilters && (
                <div className="flex md:hidden flex-col gap-2 p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Filter Ledger</span>
                    {hasActiveFilters && (
                      <button
                        onClick={() => {
                          setLedgerSearch("");
                          setLedgerTypeFilter("all");
                          setLedgerStartDate("");
                          setLedgerEndDate("");
                        }}
                        className="text-[10.5px] text-red-500 font-bold hover:underline"
                      >
                        Reset All
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={ledgerTypeFilter}
                      onChange={(e: any) => setLedgerTypeFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 h-8 rounded-lg px-2 text-xs text-slate-700 font-semibold"
                    >
                      <option value="all">All Types (Debit & Credit)</option>
                      <option value="debit">Debits (+) Only</option>
                      <option value="credit">Credits (-) Only</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={ledgerStartDate}
                        onChange={(e) => setLedgerStartDate(e.target.value)}
                        className="h-8 text-xs border-slate-200 bg-slate-50 flex-1"
                      />
                      <span className="text-slate-400 text-xs">to</span>
                      <Input
                        type="date"
                        value={ledgerEndDate}
                        onChange={(e) => setLedgerEndDate(e.target.value)}
                        className="h-8 text-xs border-slate-200 bg-slate-50 flex-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Expanded PDF Menu */}
              {showMobilePdfMenu && (
                <div className="flex md:hidden flex-col gap-2 p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Download Statements</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      onClick={() => handleDownloadPDF(false)}
                      variant="outline"
                      className="text-slate-700 text-[11px] h-8 font-bold justify-start"
                    >
                      <Download className="w-3 h-3 mr-1 text-slate-500" />
                      Summary (Filtered)
                    </Button>
                    <Button
                      onClick={() => handleDownloadPDF(true)}
                      variant="outline"
                      className="text-slate-700 text-[11px] h-8 font-bold justify-start"
                    >
                      <Download className="w-3 h-3 mr-1 text-slate-500" />
                      Summary (All)
                    </Button>
                    <Button
                      disabled={isGeneratingDetailedPDF}
                      onClick={() => handleDownloadDetailedPDF(false)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] h-8 font-bold justify-start"
                    >
                      <FileText className="w-3 h-3 mr-1 text-indigo-200" />
                      Detailed (Filtered)
                    </Button>
                    <Button
                      disabled={isGeneratingDetailedPDF}
                      onClick={() => handleDownloadDetailedPDF(true)}
                      className="bg-violet-700 hover:bg-violet-800 text-white text-[11px] h-8 font-bold justify-start"
                    >
                      <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
                      Detailed (All)
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Ledger logs */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 custom-scrollbar min-h-0 pb-32 md:pb-6">
              {ledgerLoading ? (
                <div className="h-full flex flex-col justify-center items-center py-16 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2 text-blue-600" />
                  <p className="text-xs font-semibold">Loading ledger transactions...</p>
                </div>
              ) : visibleLedgerList.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-slate-400 py-12">
                  <History size={40} className="text-slate-200 mb-2" />
                  <p className="text-sm font-bold text-slate-600">No ledger entries match current filters.</p>
                  <p className="text-xs text-slate-400 mt-1">Adjust search queries or date ranges above.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Mobile Card List View */}
                  <div className="md:hidden flex flex-col gap-2.5">
                    {paginatedLedger.map((entry) => {
                      const isInvoice = entry.source === "invoice";
                      const isManual = entry.source === "manual" && entry.id !== "opening-bal-forward" && !activeClosingBook;
                      const isDebit = entry.type === "debit" && entry.amount > 0;
                      const isCredit = entry.type === "credit" && entry.amount > 0;

                      return (
                        <div 
                          key={entry.id}
                          className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-col gap-2 transition-shadow"
                        >
                          {/* Top: Date & Source Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-bold text-slate-500">
                              {new Date(entry.date).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                isInvoice
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : entry.source === "system"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}>
                                {entry.source}
                              </span>
                              {entry.edit_history && entry.edit_history.length > 0 && (
                                <button
                                  onClick={() => handleShowEditHistory(entry)}
                                  className="bg-amber-50 border border-amber-200 text-amber-700 text-[8.5px] font-black px-1.5 py-0.5 rounded-md shadow-2xs"
                                >
                                  Edited
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Remarks / Details */}
                          <div className="text-xs font-bold text-slate-800 leading-snug">
                            {entry.remarks || "Ledger transaction"}
                          </div>

                          {/* Advance Itemized Preview */}
                          {entry.items && entry.items.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-1.5">
                              {entry.items.map((it, idx) => (
                                <span key={idx} className="inline-flex items-center text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 font-sans shadow-2xs">
                                  <span className="font-semibold text-slate-900">{it.name}</span>
                                  {it.packing_name && <span className="text-slate-400 text-[9px] mx-0.5">[{it.packing_name}]</span>}
                                  <span className="ml-1 font-mono text-indigo-700 font-bold">({it.quantity} × Rs {Math.round(it.unit_price).toLocaleString()})</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Cash Received & Credit breakdown badge for invoices */}
                          {entry.paid_amount !== undefined && entry.paid_amount > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap my-1">
                              <span className="text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                                💵 نقد وصولی (Cash Paid): Rs {Math.round(entry.paid_amount).toLocaleString()}
                              </span>
                              {entry.remaining_credit !== undefined && entry.remaining_credit > 0 && (
                                <span className="text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md">
                                  ⚠️ بقایا ادھار (Credit): Rs {Math.round(entry.remaining_credit).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Financial Row */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                            {isDebit && (
                              <div className={`border rounded-xl p-2 ${
                                selectedParty?.type === "supplier"
                                  ? "bg-emerald-50/70 border-emerald-100/80"
                                  : "bg-rose-50/70 border-rose-100/80"
                              }`}>
                                <span className={`text-[8.5px] font-black uppercase block ${
                                  selectedParty?.type === "supplier" ? "text-emerald-600" : "text-rose-600"
                                }`}>
                                  {selectedParty?.type === "supplier" ? "Debit (-) / ادا شدہ" : "Debit (+)"}
                                </span>
                                <span className={`text-xs font-black ${
                                  selectedParty?.type === "supplier" ? "text-emerald-700" : "text-rose-700"
                                }`}>
                                  {selectedParty?.type === "supplier" ? "-Rs " : "+Rs "}
                                  {Math.round(entry.amount).toLocaleString()}
                                </span>
                              </div>
                            )}
                            {isCredit && (
                              <div className={`border rounded-xl p-2 ${
                                selectedParty?.type === "supplier"
                                  ? "bg-rose-50/70 border-rose-100/80"
                                  : "bg-emerald-50/70 border-emerald-100/80"
                              }`}>
                                <span className={`text-[8.5px] font-black uppercase block ${
                                  selectedParty?.type === "supplier" ? "text-rose-600" : "text-emerald-600"
                                }`}>
                                  {selectedParty?.type === "supplier" ? "Credit (+) / واجب الادا بل" : "Credit (-)"}
                                </span>
                                <span className={`text-xs font-black ${
                                  selectedParty?.type === "supplier" ? "text-rose-700" : "text-emerald-700"
                                }`}>
                                  {selectedParty?.type === "supplier" ? "+Rs " : "-Rs "}
                                  {Math.round(entry.amount).toLocaleString()}
                                </span>
                              </div>
                            )}
                            <div className={`bg-slate-50 border border-slate-150 rounded-xl p-2 ${isDebit || isCredit ? "" : "col-span-2"}`}>
                              <span className="text-[8.5px] font-black uppercase text-slate-500 block">Running Balance</span>
                              <span className="text-xs font-black text-slate-900">Rs {Math.round(entry.runningBalance).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          {(isInvoice || isManual) && (
                            <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-dashed border-slate-150">
                              {isInvoice && (
                                <Button
                                  onClick={() => handleOpenBill(entry)}
                                  size="sm"
                                  className="h-7 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-lg shadow-2xs w-full justify-center"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  View Bill Receipt
                                </Button>
                              )}
                              {isManual && (
                                <div className="flex items-center gap-1.5 w-full justify-end">
                                  <Button
                                    onClick={() => handleOpenEditTxModal(entry)}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 font-bold rounded-lg flex-1"
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    Edit
                                  </Button>
                                  {isAdmin && (
                                    <Button
                                      onClick={() => handleDeleteTransaction(entry)}
                                      disabled={isDeletingTxId === entry.id}
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 font-bold rounded-lg flex-1"
                                    >
                                      {isDeletingTxId === entry.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : (
                                        <Trash2 className="w-3 h-3 mr-1" />
                                      )}
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-xs text-left min-w-[700px]">
                      <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[10px] select-none">
                        <tr>
                          <th className="px-3.5 py-2.5">Date</th>
                          <th className="px-3.5 py-2.5">Details / Remarks</th>
                          <th className="px-3.5 py-2.5">Source</th>
                          <th className="px-3.5 py-2.5 text-right">
                            {selectedParty?.type === "supplier" ? "Debit (-) / ادا شدہ (Paid)" : "Debit (+) / ادھار مال (Dr)"}
                          </th>
                          <th className="px-3.5 py-2.5 text-right">
                            {selectedParty?.type === "supplier" ? "Credit (+) / واجب الادا (Bill)" : "Credit (-) / وصولی (Cr)"}
                          </th>
                          <th className="px-3.5 py-2.5 text-right">Balance</th>
                          <th className="px-3.5 py-2.5 text-center print:hidden">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {paginatedLedger.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-1.5 text-slate-500 text-[11px]">
                              {new Date(entry.date).toLocaleString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="px-3 py-1.5 font-sans font-medium text-slate-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {entry.source === "invoice" ? (
                                  <button
                                    onClick={() => handleOpenBill(entry)}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline text-left cursor-pointer flex items-center gap-1 transition-all"
                                    title="Click to view detailed bill receipt"
                                  >
                                    <span>{entry.remarks}</span>
                                    <span className="text-[8px] font-sans font-black uppercase px-1 py-0.2 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 shrink-0">View Bill</span>
                                  </button>
                                ) : (
                                  <span>{entry.remarks}</span>
                                )}
                                {entry.edit_history && entry.edit_history.length > 0 && (
                                  <button
                                    onClick={() => handleShowEditHistory(entry)}
                                    className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[8.5px] font-bold px-1 py-0.2 rounded cursor-pointer transition-colors shadow-2xs"
                                  >
                                    Edited
                                  </button>
                                )}
                              </div>

                              {/* Advance Itemized Products Chip List */}
                              {entry.items && entry.items.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {entry.items.map((it, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center text-[10px] bg-indigo-50/70 border border-indigo-100 text-slate-800 rounded px-1.5 py-0.5 font-sans shadow-2xs"
                                      title={`Subtotal: Rs ${Math.round(it.subtotal || (it.quantity * it.unit_price)).toLocaleString()}`}
                                    >
                                      <span className="font-semibold text-slate-900">{it.name}</span>
                                      {it.packing_name && <span className="text-slate-500 text-[9px] mx-0.5">[{it.packing_name}]</span>}
                                      <span className="ml-1 font-mono text-indigo-700 font-bold">
                                        ({it.quantity} × Rs {Math.round(it.unit_price).toLocaleString()})
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Cash Received and Credit breakdown badges */}
                              {entry.paid_amount !== undefined && entry.paid_amount > 0 && (
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                                    {selectedParty?.type === "supplier"
                                      ? `💵 نقد ادائیگی (Cash Paid): Rs ${Math.round(entry.paid_amount).toLocaleString()}`
                                      : `💵 نقد وصولی (Cash Received): Rs ${Math.round(entry.paid_amount).toLocaleString()}`}
                                  </span>
                                  {entry.remaining_credit !== undefined && entry.remaining_credit > 0 && (
                                    <span className="text-[9px] font-bold bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded">
                                      {selectedParty?.type === "supplier"
                                        ? `⚠️ واجب الادا بل بقایا (Payable): Rs ${Math.round(entry.remaining_credit).toLocaleString()}`
                                        : `⚠️ بقایا ادھار (Credit Due): Rs ${Math.round(entry.remaining_credit).toLocaleString()}`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-1.5 font-sans">
                              {entry.source === "invoice" ? (
                                <button
                                  onClick={() => handleOpenBill(entry)}
                                  className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-sans font-bold capitalize bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors"
                                  title="Click to view detailed bill receipt"
                                >
                                  {entry.source}
                                </button>
                              ) : (
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[9.5px] font-sans font-bold capitalize ${
                                  entry.source === "system"
                                    ? "bg-purple-50 text-purple-700 border border-purple-100"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}>
                                  {entry.source}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold">
                              {entry.type === "debit" && entry.amount > 0 ? (
                                <span className={selectedParty?.type === "supplier" ? "text-emerald-600" : "text-rose-600"}>
                                  {selectedParty?.type === "supplier" ? "-Rs " : "+Rs "}
                                  {Math.round(entry.amount).toLocaleString()}
                                </span>
                              ) : ""}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold">
                              {entry.type === "credit" && entry.amount > 0 ? (
                                <span className={selectedParty?.type === "supplier" ? "text-rose-600" : "text-emerald-600"}>
                                  {selectedParty?.type === "supplier" ? "+Rs " : "-Rs "}
                                  {Math.round(entry.amount).toLocaleString()}
                                </span>
                              ) : ""}
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-slate-800">
                              Rs {Math.round(entry.runningBalance).toLocaleString()}
                            </td>
                            <td className="px-3 py-1.5 text-center print:hidden font-sans">
                              {entry.source === "manual" && entry.id !== "opening-bal-forward" && !activeClosingBook && (
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleOpenEditTxModal(entry)}
                                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline text-[10.5px] cursor-pointer inline-flex items-center gap-0.5"
                                    title="Edit Remarks / Amount"
                                  >
                                    <Edit2 size={11} />
                                    Edit
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDeleteTransaction(entry)}
                                      disabled={isDeletingTxId === entry.id}
                                      className="text-rose-600 hover:text-rose-800 font-bold hover:underline text-[10.5px] cursor-pointer inline-flex items-center gap-0.5"
                                      title="Delete entry & reverse balance (Admin only)"
                                    >
                                      {isDeletingTxId === entry.id ? (
                                        <Loader2 size={11} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={11} />
                                      )}
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-slate-500 py-2 gap-2 bg-transparent">
                      <span>Showing {paginatedLedger.length} of {visibleLedgerList.length} entries</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-650 hover:bg-slate-50/70 transition-colors disabled:opacity-50 disabled:hover:bg-white"
                        >
                          Previous
                        </button>
                        <span className="text-slate-700 font-bold">Page {currentPage} of {totalPages}</span>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-650 hover:bg-slate-50/70 transition-colors disabled:opacity-50 disabled:hover:bg-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400 py-10">
            <Users size={60} className="text-slate-200 mb-2" />
            <p className="text-base font-bold text-slate-600">No Account Selected</p>
            <p className="text-xs text-slate-400 mt-1">Please select a party from the sidebar to view ledger history.</p>
          </div>
        )}
      </div>

      {/* Modal: Create Party */}
      <AnimatePresence>
        {isPartyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsPartyModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl relative z-10"
            >
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="font-bold text-slate-800 text-lg">{editingParty ? "Edit Party" : "Add Khata Party"}</h3>
                <button onClick={() => { setIsPartyModalOpen(false); setEditingParty(null); }} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div className="md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Party Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["customer", "supplier", "dual"] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewParty({...newParty, type})}
                        className={`py-2 rounded-lg text-[10px] font-bold capitalize transition-all border ${
                          newParty.type === type
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        }`}
                      >
                        {type === "dual" ? "Dual (Both)" : type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                  <Input 
                    placeholder="Party Name" 
                    value={newParty.name}
                    onChange={(e) => setNewParty({...newParty, name: e.target.value})}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number (Optional)</label>
                  <Input 
                    placeholder="e.g. 03001234567" 
                    value={newParty.phone}
                    onChange={(e) => setNewParty({...newParty, phone: e.target.value})}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CNIC Number (Optional)</label>
                  <Input 
                    placeholder="e.g. 35201-1234567-1" 
                    value={newParty.cnic_number || ""}
                    onChange={(e) => setNewParty({...newParty, cnic_number: e.target.value})}
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Father's Name (Optional)</label>
                  <Input 
                    placeholder="Father's Name" 
                    value={newParty.father_name || ""}
                    onChange={(e) => setNewParty({...newParty, father_name: e.target.value})}
                    className="h-9 text-xs"
                  />
                </div>

                {!editingParty && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Opening Balance (Rs)</label>
                    <Input 
                      type="number"
                      placeholder="0" 
                      value={newParty.opening_balance || ""}
                      onChange={(e) => setNewParty({...newParty, opening_balance: parseFloat(e.target.value) || 0})}
                      className="h-9 text-xs"
                    />
                    <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Positive means receivable, negative payable.</span>
                  </div>
                )}

                {(newParty.type === "customer" || newParty.type === "dual") ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Credit Limit (Optional, Rs)</label>
                    <Input 
                      type="number"
                      placeholder="e.g. 10000 (Empty = Unlimited)" 
                      value={newParty.credit_limit || ""}
                      onChange={(e) => setNewParty({...newParty, credit_limit: e.target.value})}
                      className="h-9 text-xs"
                    />
                    <span className="text-[9px] text-slate-400 mt-1 block leading-tight">Leave blank for no credit limit.</span>
                  </div>
                ) : (
                  <div className="hidden md:block" /> // Spacer block to align fields
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Address (Optional)</label>
                  <Input 
                    placeholder="Physical address" 
                    value={newParty.address}
                    onChange={(e) => setNewParty({...newParty, address: e.target.value})}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Remarks / Note (Optional)</label>
                  <Input 
                    placeholder="Special comments or remarks" 
                    value={newParty.note}
                    onChange={(e) => setNewParty({...newParty, note: e.target.value})}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="md:col-span-2 pt-2 flex items-center gap-2">
                  {editingParty && !isPartyDeleted(editingParty) && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => handleMovePartyToTrash(editingParty)}
                      className="text-red-600 hover:bg-red-50 text-xs font-bold h-11 px-3 flex items-center gap-1"
                    >
                      <Trash2 size={14} /> کوڑے دان میں ڈالیں (Trash)
                    </Button>
                  )}
                  <Button onClick={handleCreateParty} disabled={isSubmittingParty} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-md shadow-blue-200">
                    {isSubmittingParty ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingParty ? "Save Changes" : "Create Account"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add Manual Transaction */}
      <AnimatePresence>
        {isTxModalOpen && selectedParty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsTxModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    {txModalType === "receive" 
                      ? (selectedParty.type === "customer" ? "Receive Cash Payment" : "Supplier Refund Received")
                      : (selectedParty.type === "customer" ? "Refund Cash / Disburse" : "Pay Cash to Supplier")
                    }
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Account: {selectedParty.name}</p>
                </div>
                <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Amount (Rs)</label>
                  <Input 
                    type="number"
                    placeholder="Enter amount..." 
                    value={newTx.amount || ""}
                    onChange={(e) => setNewTx({...newTx, amount: Math.max(0, parseFloat(e.target.value) || 0)})}
                    className="text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Payment Account</label>
                  <select
                    value={selectedTxAccountId}
                    onChange={(e) => setSelectedTxAccountId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {cashAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.current_balance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Remarks / Note</label>
                  <Input 
                    placeholder="e.g. Cash received in drawer, Bank transfer reference" 
                    value={newTx.remarks}
                    onChange={(e) => setNewTx({...newTx, remarks: e.target.value})}
                  />
                </div>

                {txModalType === "receive" ? (
                  <Button onClick={handleCreateTransaction} disabled={isSubmittingTx} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11">
                    {isSubmittingTx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownLeft size={16} className="mr-2" />}
                    {selectedParty.type === "customer" ? "Confirm Cash Receipt" : "Confirm Supplier Refund"}
                  </Button>
                ) : (
                  <Button onClick={handleCreateTransaction} disabled={isSubmittingTx} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-11">
                    {isSubmittingTx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight size={16} className="mr-2" />}
                    {selectedParty.type === "customer" ? "Confirm Cash Disbursal / Refund" : "Confirm Payment to Supplier"}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit Manual Transaction */}
      <AnimatePresence>
        {isEditTxModalOpen && txToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsEditTxModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 font-sans"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Edit Transaction</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Account: {selectedParty?.name}</p>
                </div>
                <button onClick={() => setIsEditTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Amount (Rs)</label>
                  <Input 
                    type="number"
                    placeholder="Enter amount..." 
                    value={editTxAmount || ""}
                    onChange={(e) => setEditTxAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Remarks / Note</label>
                  <Input 
                    placeholder="Remarks" 
                    value={editTxRemarks}
                    onChange={(e) => setEditTxRemarks(e.target.value)}
                  />
                </div>

                <Button onClick={handleEditTransaction} disabled={isSubmittingEditTx} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmittingEditTx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit History Viewer */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsHistoryModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg relative z-10 font-sans max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4 border-b pb-3 shrink-0">
                <h3 className="font-bold text-slate-800 text-lg">{historyTitle}</h3>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar py-2 text-slate-650">
                {historyItems.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-xs">No edit history found.</p>
                ) : (
                  historyItems.map((hist, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Version #{historyItems.length - idx}</span>
                        <span>{new Date(hist.edited_at).toLocaleString()}</span>
                      </div>

                      {/* Manual Entry History */}
                      {hist.amount !== undefined ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount</span>
                            <span className="text-sm font-bold text-slate-800">Rs {hist.amount.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Remarks</span>
                            <span className="text-sm text-slate-800">{hist.remarks || "No remarks"}</span>
                          </div>
                        </div>
                      ) : (
                        /* Invoice/Bill History */
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total</span>
                              <span className="font-bold text-slate-800">Rs {hist.total_amount.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Paid Now</span>
                              <span className="font-bold text-emerald-600">Rs {(hist.paid_amount || 0).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Discount</span>
                              <span className="font-bold text-rose-600">Rs {(hist.discount || 0).toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Bill Items</span>
                            <table className="w-full text-left text-[11px] font-mono">
                              <thead>
                                <tr className="text-slate-400 border-b">
                                  <th className="py-1">Item Name</th>
                                  <th className="py-1 text-center">Qty</th>
                                  <th className="py-1 text-right">Price</th>
                                  <th className="py-1 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hist.items?.map((item: any, i: number) => (
                                  <tr key={i} className="text-slate-650 border-b border-slate-100 last:border-b-0">
                                    <td className="py-1 font-sans">{item.product_name}</td>
                                    <td className="py-1 text-center">{item.quantity}</td>
                                    <td className="py-1 text-right font-bold">Rs {item.unit_price.toFixed(2)}</td>
                                    <td className="py-1 text-right font-bold">Rs {item.subtotal.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal: Contra Offset Adjustment */}
      <AnimatePresence>
        {isContraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsContraOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative z-10 font-sans border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <RefreshCw size={15} className="text-slate-800 animate-spin-hover" /> Mutual Contra Settlement
                </h3>
                <button onClick={() => setIsContraOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
              </div>

              <form onSubmit={handleContraOffset} className="space-y-4">
                <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl text-[10px] text-slate-500 font-semibold leading-normal">
                  💡 <strong>Contra Settlement</strong> allows you to reconcile mutual balances when an entity acts as both a customer (who owes you) and a supplier (whom you owe). Reconciling will reduce both balances simultaneously.
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">1. Select Customer (Receivable)</label>
                  <select
                    value={contraCustomer}
                    onChange={(e) => setContraCustomer(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-bold text-slate-700 cursor-pointer"
                    required
                  >
                    <option value="">-- Choose Customer --</option>
                    {parties.filter(p => p.type === "customer" && p.current_balance !== 0).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Receivable: Rs {p.current_balance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">2. Select Supplier (Payable)</label>
                  <select
                    value={contraSupplier}
                    onChange={(e) => setContraSupplier(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 font-bold text-slate-700 cursor-pointer"
                    required
                  >
                    <option value="">-- Choose Supplier --</option>
                    {parties.filter(p => p.type === "supplier" && p.current_balance !== 0).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Payable: Rs {p.current_balance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">3. Settlement Offset Amount (Rs)</label>
                  <Input 
                    type="number"
                    placeholder="0"
                    value={contraAmount || ""}
                    onChange={(e) => setContraAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-10 text-sm font-black"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">4. Reconciliation Note / Remarks</label>
                  <Input 
                    placeholder="e.g. Mutual ledger offset reconciliation" 
                    value={contraRemarks}
                    onChange={(e) => setContraRemarks(e.target.value)}
                    className="h-10 text-xs font-semibold"
                  />
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsContraOpen(false)}
                    className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submittingContra}
                    className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {submittingContra && <Loader2 size={13} className="animate-spin" />} Confirm Reconcile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Bulk Reminders */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsBulkModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl relative z-10 font-sans border border-slate-100 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    💬 WhatsApp Bulk Reminders
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Send pending payment reminders to multiple customers quickly</p>
                </div>
                <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">×</button>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-[10px] text-emerald-700 font-semibold leading-relaxed mb-4 shrink-0">
                💡 <strong>Bulk Reminder Guide:</strong> Click &quot;Send&quot; individually for each customer below to open their direct WhatsApp chat.
              </div>

              {/* List Container */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {parties.filter(p => (p.type === "customer" || p.type === "dual") && p.current_balance > 0).length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-bold">
                    No customers with outstanding receivable balance.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider">
                        <th className="py-2 pl-3">Customer Name</th>
                        <th className="py-2">Phone Number</th>
                        <th className="py-2 text-right">Outstanding Bal</th>
                        <th className="py-2 text-center w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parties
                        .filter(p => (p.type === "customer" || p.type === "dual") && p.current_balance > 0)
                        .map(p => {
                          const isSent = bulkSentList.includes(p.id);
                          return (
                            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/60 transition-colors">
                              <td className="py-3 pl-3 font-bold text-slate-800">{p.name}</td>
                              <td className="py-3 text-slate-500 font-mono">{p.phone || "No Phone"}</td>
                              <td className="py-3 text-right font-black text-rose-600">Rs {p.current_balance.toLocaleString()}</td>
                              <td className="py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleSendBulkPartyReminder(p)}
                                  disabled={!p.phone}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                    isSent 
                                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-default" 
                                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
                                  }`}
                                >
                                  {isSent ? "✓ Sent" : "💬 Send"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 mt-4 flex justify-end shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-5 h-9 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-black transition-all"
                >
                  Close Panel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: View Bill Details (Receipt) */}
      <AnimatePresence>
        {isReceiptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => {
                setIsReceiptModalOpen(false);
                setSelectedBill(null);
                setSelectedBillItems([]);
              }}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 relative my-8 z-10"
            >
              <button 
                onClick={() => {
                  setIsReceiptModalOpen(false);
                  setSelectedBill(null);
                  setSelectedBillItems([]);
                }} 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 print:hidden cursor-pointer"
              >
                <X size={18} />
              </button>

              {selectedBillLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Loader2 className="animate-spin h-8 w-8 text-[#1e3a5f] mb-3" />
                  
                </div>
              ) : selectedBill ? (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="text-center space-y-1 mb-4 border-b border-dashed border-slate-200 pb-3">
                    <div className="inline-flex items-center justify-center p-2 bg-indigo-50 text-indigo-600 rounded-full mb-1">
                      <BookOpen size={20} />
                    </div>
                    <h2 className="text-sm font-black uppercase tracking-tight text-slate-800">{shopName || "The Accounts Store"}</h2>
                    <p className="text-[9px] text-slate-500 font-semibold">
                      {selectedBillType === "sales" ? "Sales Invoice Bill" : "Purchase Vendor Bill"}
                    </p>
                    <p className="text-[9px] text-slate-400 font-mono">Date: {new Date(selectedBill.created_at).toLocaleString()}</p>
                    <p className="text-[9px] text-slate-500 font-mono font-bold">
                      Bill #: {selectedBill.id.slice(0, 8).toUpperCase()}
                    </p>
                    {selectedBill.is_voided && (
                      <p className="bg-red-100 text-red-800 font-extrabold text-[8px] inline-block px-1.5 py-0.5 rounded tracking-wide mt-1 uppercase font-sans">
                        * Voided Bill *
                      </p>
                    )}
                    {selectedBill.is_edited && !selectedBill.is_voided && (
                      <p className="bg-amber-100 text-amber-800 font-extrabold text-[8px] inline-block px-1.5 py-0.5 rounded tracking-wide mt-1 uppercase font-sans">
                        * Edited Bill *
                      </p>
                    )}
                  </div>

                  {/* Customer / Party details */}
                  <div className="text-[10px] text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 font-sans">
                    <p className="font-bold text-slate-800">
                      {selectedBillType === "sales" ? "Bill To:" : "Supplier / Vendor:"} <span className="font-semibold text-[#1e3a5f]">{selectedBill.parties?.name || selectedBill.customer_name || "Walk-in Party"}</span>
                    </p>
                    {(selectedBill.parties?.phone || selectedBill.customer_phone) && (
                      <p className="font-semibold text-slate-500">Phone: {selectedBill.parties?.phone || selectedBill.customer_phone}</p>
                    )}
                    <p className="font-semibold text-slate-500">
                      Payment Mode: <span className="capitalize text-slate-700 font-bold">{selectedBill.payment_mode || "Cash"}</span>
                    </p>
                    <p className="font-semibold text-slate-500">
                      Status: <span className={`capitalize font-black ${selectedBill.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{selectedBill.status}</span>
                    </p>
                  </div>

                  {/* Items List */}
                  <div className="border-t border-b border-dashed border-slate-200 py-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 font-sans">Items Detail</p>
                    <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                      {selectedBillItems.map((item, idx) => (
                        <div key={item.id || idx} className="text-[10px] flex justify-between items-start leading-tight">
                          <div className="space-y-0.5 max-w-[70%]">
                            <p className="font-bold text-slate-800">{item.products?.name || item.productName || "Product Item"}</p>
                            <p className="text-slate-450 font-mono text-[9px]">
                              {Number(item.quantity)} {item.products?.unit || item.unit || "pcs"} &times; Rs {Number(item.unit_price).toFixed(2)}
                              {item.packing_name && <span className="ml-1 text-[8px] bg-slate-100 px-1 rounded text-slate-500 font-sans">{item.packing_name}</span>}
                              {item.variantName && <span className="ml-1 text-[8px] bg-slate-100 px-1 rounded text-slate-500 font-sans">{item.variantName}</span>}
                            </p>
                            {item.sold_imeis && (
                              <p className="text-[8px] text-violet-600 font-mono">IMEI: {item.sold_imeis}</p>
                            )}
                            {item.warranty && (
                              <p className="text-[8px] text-emerald-600 font-mono">Warranty: {item.warranty}</p>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-700">Rs {Number(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="space-y-1.5 font-mono text-[10px] text-slate-700 pt-1.5">
                    {Number(selectedBill.discount) > 0 && (
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span className="text-emerald-600">-Rs {Number(selectedBill.discount).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(selectedBill.tax_amount) > 0 && (
                      <div className="flex justify-between">
                        <span>Tax / GST:</span>
                        <span>+Rs {Number(selectedBill.tax_amount).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(selectedBill.additional_charges) > 0 && (
                      <div className="flex justify-between">
                        <span>Extra Charges:</span>
                        <span>+Rs {Number(selectedBill.additional_charges).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(selectedBill.delivery_fee) > 0 && (
                      <div className="flex justify-between">
                        <span>Delivery Fee:</span>
                        <span>+Rs {Number(selectedBill.delivery_fee).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-100 pt-1.5">
                      <span>Total Amount:</span>
                      <span>Rs {Number(selectedBill.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-600 border-t border-dotted border-slate-100 pt-1">
                      <span>Cash Paid:</span>
                      <span>Rs {Number(selectedBill.paid_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-red-655 border-t border-dotted border-slate-150 pt-1">
                      <span>Balance Due:</span>
                      <span>Rs {Math.max(0, Number(selectedBill.total_amount) - Number(selectedBill.paid_amount || 0)).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-100 print:hidden flex gap-2">
                    <Button
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.print();
                        }
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={14} /> Print Bill
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <p className="text-xs font-semibold">Bill details could not be found.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
