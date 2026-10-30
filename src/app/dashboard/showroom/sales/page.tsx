"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  Search,
  Banknote,
  CreditCard,
  Printer,
  Share2,
  FileText,
  Filter,
  SlidersHorizontal,
  PlusCircle,
  Tag,
  CheckCircle2,
  Sparkles,
  Calendar,
  Phone,
  User,
  ShieldCheck,
  Building,
  DollarSign,
  Layers,
  LayoutGrid,
  List,
  Eye,
  Loader2,
  X,
  ExternalLink,
  ArrowRight,
  Info,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import {
  vehicleLabel,
  formatPKR,
  type ShowroomVehicle,
  type ShowroomParty,
  type VehicleStatus,
  loadShowroomOfflineEntities,
  executeShowroomAction,
  isShowroomOffline,
} from "@/lib/showroom-ops";
import { ShowroomDeedPrintModal } from "@/components/showroom/ShowroomDeedPrintModal";
import { ShowroomOfflineBar } from "@/components/showroom/ShowroomOfflineBar";
import { autoPostVehicleSaleJournal } from "@/lib/showroom-accounting";

interface CashAccountItem {
  id: string;
  name: string;
  type?: string | null;
  current_balance?: number | null;
}

export default function ShowroomSalesPage() {
  const { shopId, shopName, shopPhone, shopAddress } = useShop();
  const supabase = createClient();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<ShowroomVehicle[]>([]);
  const [parties, setParties] = useState<ShowroomParty[]>([]);
  const [accounts, setAccounts] = useState<CashAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"available" | "all" | "sold" | "booked">("available");
  const [typeFilter, setTypeFilter] = useState<"all" | "car" | "bike" | "commercial">("all");
  const [makeFilter, setMakeFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>("all");

  // Cash Sale Modal State
  const [isCashSaleOpen, setIsCashSaleOpen] = useState(false);
  const [selectedVehicleForSale, setSelectedVehicleForSale] = useState<ShowroomVehicle | null>(null);
  const [cashSaleForm, setCashSaleForm] = useState({
    buyer_party_id: "",
    buyer_name: "",
    buyer_father_name: "",
    buyer_caste: "",
    buyer_phone: "",
    buyer_cnic: "",
    buyer_address: "",
    sold_price: 0,
    paid_amount: 0,
    remaining_amount: 0,
    payment_mode: "cash" as "cash" | "bank" | "credit" | "partial",
    account_id: "",
    sold_date: new Date().toISOString().split("T")[0],
    remarks: "",
    bill_no: "",
    manual_book_no: "",
    manual_receipt_no: "",
    witness_name: "",
    witness_phone: "",
    witness_cnic: "",
  });
  const [isSelling, setIsSelling] = useState(false);

  // Vehicle Details Modal State
  const [detailsVehicle, setDetailsVehicle] = useState<ShowroomVehicle | null>(null);

  // Deed Print Modal State
  const [selectedDeedTarget, setSelectedDeedTarget] = useState<{
    vehicle: ShowroomVehicle;
    buyer: Partial<ShowroomParty>;
    saleType: "cash" | "installment";
    salePrice: number;
    downPayment?: number;
    saleDate?: string;
    billNo?: string;
    manualBookNo?: string;
    manualReceiptNo?: string;
    witnessName?: string;
    witnessPhone?: string;
    witnessCnic?: string;
  } | null>(null);
  const [isDeedOpen, setIsDeedOpen] = useState(false);

  // Fetch Vehicles, Parties & Cash Accounts
  const fetchAllData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const [offVehicles, offParties, offAccounts] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
        ]);
        setVehicles(offVehicles);
        setParties(offParties);
        setAccounts(offAccounts);
        setLoading(false);
        return;
      }

      const [vRes, pRes, aRes] = await Promise.all([
        supabase
          .from("showroom_vehicles")
          .select("*, purchase_party:showroom_parties!purchase_party_id(*), buyer_party:showroom_parties!buyer_party_id(*)")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
        supabase
          .from("showroom_parties")
          .select("*")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("cash_accounts")
          .select("id, name, type, current_balance")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
      ]);

      if (vRes.error) throw vRes.error;
      const loadedVehicles = (vRes.data as ShowroomVehicle[]) || [];
      const loadedParties = (pRes.data as ShowroomParty[]) || [];
      setVehicles(loadedVehicles);
      setParties(loadedParties);

      import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
        putManyOfflineData("showroom_vehicles", loadedVehicles.map((r) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        putManyOfflineData("showroom_parties", loadedParties.map((r) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
      });

      if (aRes.data) {
        setAccounts(aRes.data as CashAccountItem[]);
      }
    } catch (err: any) {
      try {
        const [offVehicles, offParties, offAccounts] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
        ]);
        if (offVehicles.length > 0 || offParties.length > 0) {
          setVehicles(offVehicles);
          setParties(offParties);
          setAccounts(offAccounts);
        } else {
          toast.error("Failed to load showroom inventory: " + err.message);
        }
      } catch {
        toast.error("Failed to load showroom inventory: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [shopId]);

  // Unique Makes & Years for filters
  const uniqueMakes = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.make) set.add(v.make.trim());
    });
    return Array.from(set).sort();
  }, [vehicles]);

  const uniqueYears = useMemo(() => {
    const set = new Set<number>();
    vehicles.forEach((v) => {
      if (v.year) set.add(Number(v.year));
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [vehicles]);

  // Filtered vehicles list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // Status Tab filter
      if (statusTab === "available") {
        if (v.status !== "available") return false;
      } else if (statusTab === "sold") {
        if (v.status !== "sold" && v.status !== "installment_active") return false;
      } else if (statusTab === "booked") {
        if (v.status !== "reserved") return false;
      }

      // Vehicle Type filter
      if (typeFilter !== "all" && v.vehicle_type !== typeFilter) return false;

      // Make filter
      if (makeFilter !== "all" && v.make.toLowerCase() !== makeFilter.toLowerCase()) return false;

      // Year filter
      if (yearFilter !== "all" && String(v.year) !== yearFilter) return false;

      // Price Range filter
      const price = Number(v.cash_price || v.price || 0);
      if (priceRangeFilter === "under_200k" && price >= 200000) return false;
      if (priceRangeFilter === "200k_500k" && (price < 200000 || price > 500000)) return false;
      if (priceRangeFilter === "500k_1m" && (price < 500000 || price > 1000000)) return false;
      if (priceRangeFilter === "1m_3m" && (price < 1000000 || price > 3000000)) return false;
      if (priceRangeFilter === "above_3m" && price < 3000000) return false;

      // Search Query filter
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const title = vehicleLabel(v).toLowerCase();
      const plate = (v.plate_number || "").toLowerCase();
      const chassis = (v.chassis_number || "").toLowerCase();
      const engine = (v.engine_number || "").toLowerCase();
      const color = (v.color || "").toLowerCase();
      const buyer = (v.buyer_name || "").toLowerCase();

      return (
        title.includes(q) ||
        plate.includes(q) ||
        chassis.includes(q) ||
        engine.includes(q) ||
        color.includes(q) ||
        buyer.includes(q)
      );
    });
  }, [vehicles, statusTab, typeFilter, makeFilter, yearFilter, priceRangeFilter, searchQuery]);

  // Metrics
  const availableCount = vehicles.filter((v) => v.status === "available").length;
  const soldCount = vehicles.filter((v) => v.status === "sold" || v.status === "installment_active").length;
  const totalStockValue = vehicles
    .filter((v) => v.status === "available")
    .reduce((s, v) => s + Number(v.cash_price || v.price || 0), 0);

  // Open Cash Sale Modal
  const handleOpenCashSale = (v: ShowroomVehicle) => {
    setSelectedVehicleForSale(v);
    const saleVal = Number(v.cash_price || v.price || 0);
    const genBillNo = `CS-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
    setCashSaleForm({
      buyer_party_id: "",
      buyer_name: "",
      buyer_father_name: "",
      buyer_caste: "",
      buyer_phone: "",
      buyer_cnic: "",
      buyer_address: "",
      sold_price: saleVal,
      paid_amount: saleVal,
      remaining_amount: 0,
      payment_mode: "cash",
      account_id: accounts[0]?.id || "",
      sold_date: new Date().toISOString().split("T")[0],
      remarks: "",
      bill_no: genBillNo,
      manual_book_no: "",
      manual_receipt_no: "",
      witness_name: "",
      witness_phone: "",
      witness_cnic: "",
    });
    setIsCashSaleOpen(true);
  };

  // Select existing customer party
  const handleSelectBuyerParty = (partyId: string) => {
    const party = parties.find((p) => p.id === partyId);
    if (party) {
      setCashSaleForm((prev) => ({
        ...prev,
        buyer_party_id: party.id,
        buyer_name: party.name,
        buyer_father_name: party.father_name || "",
        buyer_caste: party.caste || "",
        buyer_phone: party.phone || "",
        buyer_cnic: party.cnic || "",
        buyer_address: party.address || "",
      }));
    } else {
      setCashSaleForm((prev) => ({
        ...prev,
        buyer_party_id: "",
      }));
    }
  };

  // Execute Cash Sale
  const handleExecuteCashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForSale || !shopId) return;

    const bName = cashSaleForm.buyer_name.trim();
    if (!bName) {
      toast.error("Buyer name is required (خریدار کا نام ضروری ہے)");
      return;
    }

    const sPrice = Number(cashSaleForm.sold_price) || 0;
    let receivedAmt = sPrice;
    let remainingUdhar = 0;
    if (cashSaleForm.payment_mode === "credit") {
      receivedAmt = 0;
      remainingUdhar = sPrice;
    } else if (cashSaleForm.payment_mode === "partial") {
      receivedAmt = Math.min(sPrice, Math.max(0, Number(cashSaleForm.paid_amount) || 0));
      remainingUdhar = Math.max(0, sPrice - receivedAmt);
    }

    setIsSelling(true);
    try {
      let finalBuyerPartyId = cashSaleForm.buyer_party_id || null;

      // Auto-create party if not existing and name provided
      if (!finalBuyerPartyId && bName) {
        try {
          const newPartyId = crypto.randomUUID();
          await executeShowroomAction({
            table: "showroom_parties",
            action: "insert",
            payload: {
              id: newPartyId,
              shop_id: shopId,
              party_type: "buyer",
              is_dealer_showroom: false,
              name: bName,
              father_name: cashSaleForm.buyer_father_name.trim() || null,
              caste: cashSaleForm.buyer_caste.trim() || null,
              phone: cashSaleForm.buyer_phone.trim() || "0300-0000000",
              cnic: cashSaleForm.buyer_cnic.trim() || null,
              address: cashSaleForm.buyer_address.trim() || null,
            },
            shopId,
          });
          finalBuyerPartyId = newPartyId;
        } catch (partyErr) {
          console.warn("Party creation fallback:", partyErr);
        }
      }

      // Update vehicle status & references
      await executeShowroomAction({
        table: "showroom_vehicles",
        action: "update",
        payload: {
          id: selectedVehicleForSale.id,
          status: "sold",
          buyer_party_id: finalBuyerPartyId,
          buyer_name: bName,
          buyer_phone: cashSaleForm.buyer_phone.trim() || null,
          sold_at: new Date(cashSaleForm.sold_date).toISOString(),
          sold_price: sPrice,
          sale_paid_amount: receivedAmt,
          sale_remaining_amount: remainingUdhar,
          bill_no: cashSaleForm.bill_no.trim() || null,
          manual_book_no: cashSaleForm.manual_book_no.trim() || null,
          manual_receipt_no: cashSaleForm.manual_receipt_no.trim() || null,
          witness_name: cashSaleForm.witness_name.trim() || null,
          witness_phone: cashSaleForm.witness_phone.trim() || null,
          witness_cnic: cashSaleForm.witness_cnic.trim() || null,
        },
        shopId,
      });

      // Insert into showroom_sales
      try {
        const saleRecordPayload = {
          id: crypto.randomUUID(),
          shop_id: shopId,
          vehicle_id: selectedVehicleForSale.id,
          buyer_party_id: finalBuyerPartyId,
          buyer_name: bName,
          buyer_father_name: cashSaleForm.buyer_father_name.trim() || null,
          buyer_caste: cashSaleForm.buyer_caste.trim() || null,
          buyer_phone: cashSaleForm.buyer_phone.trim() || null,
          buyer_cnic: cashSaleForm.buyer_cnic.trim() || null,
          buyer_address: cashSaleForm.buyer_address.trim() || null,
          sale_type: "cash" as const,
          sale_price: sPrice,
          paid_amount: receivedAmt,
          remaining_amount: remainingUdhar,
          payment_mode: cashSaleForm.payment_mode,
          account_id: cashSaleForm.account_id || null,
          sale_date: cashSaleForm.sold_date || new Date().toISOString().split("T")[0],
          bill_no: cashSaleForm.bill_no.trim() || null,
          manual_book_no: cashSaleForm.manual_book_no.trim() || null,
          manual_receipt_no: cashSaleForm.manual_receipt_no.trim() || null,
          witness_name: cashSaleForm.witness_name.trim() || null,
          witness_phone: cashSaleForm.witness_phone.trim() || null,
          witness_cnic: cashSaleForm.witness_cnic.trim() || null,
          created_at: new Date().toISOString(),
        };
        await executeShowroomAction({
          table: "showroom_sales",
          action: "insert",
          payload: saleRecordPayload,
          shopId,
        });

        // Auto-post balanced double-entry general journal voucher (Debit 1001 Cash & 1002 AR, Credit 4001 Revenue; Debit 5001 COGS, Credit 1003 Inventory)
        try {
          await autoPostVehicleSaleJournal(
            supabase,
            shopId,
            saleRecordPayload,
            selectedVehicleForSale,
            { buyerName: bName }
          );
        } catch (jeErr) {
          console.warn("Auto-posting vehicle sale journal warning:", jeErr);
        }
      } catch (saleRecErr) {
        console.warn("showroom_sales insert warning:", saleRecErr);
      }

      // If financial account selected & received amount > 0, record account cash inflow & update balance
      if (cashSaleForm.account_id && receivedAmt > 0 && cashSaleForm.payment_mode !== "credit") {
        try {
          const vTitle = vehicleLabel(selectedVehicleForSale);
          const modeLabel = cashSaleForm.payment_mode === "partial" ? "Partial Advance" : "Full Payment";
          await executeShowroomAction({
            table: "account_transactions",
            action: "insert",
            payload: {
              id: crypto.randomUUID(),
              shop_id: shopId,
              account_id: cashSaleForm.account_id,
              type: "income",
              amount: receivedAmt,
              description: `🚗 Vehicle Sale Inflow (${modeLabel}): ${vTitle} — Buyer: ${bName} (Total: Rs ${sPrice.toLocaleString()})${remainingUdhar > 0 ? ` [Remaining Udhar: Rs ${remainingUdhar.toLocaleString()}]` : ""}${cashSaleForm.bill_no ? ` (Bill #${cashSaleForm.bill_no})` : ""}${cashSaleForm.manual_receipt_no ? ` (Slip #${cashSaleForm.manual_receipt_no})` : ""}`,
              date: cashSaleForm.sold_date,
            },
            shopId,
          });

          const chosenAcc = accounts.find((a) => a.id === cashSaleForm.account_id);
          if (chosenAcc) {
            const updatedBal = (Number(chosenAcc.current_balance) || 0) + receivedAmt;
            await executeShowroomAction({
              table: "cash_accounts",
              action: "update",
              payload: { id: cashSaleForm.account_id, current_balance: updatedBal },
              shopId,
            });
          }
        } catch (txErr) {
          console.warn("Transaction logging:", txErr);
        }
      }

      // Update buyer party balance if remaining udhar exists
      if (finalBuyerPartyId && remainingUdhar > 0) {
        const buyerParty = parties.find((p) => p.id === finalBuyerPartyId);
        if (buyerParty) {
          const updatedPartyBal = (Number(buyerParty.current_balance) || 0) + remainingUdhar;
          try {
            await executeShowroomAction({
              table: "showroom_parties",
              action: "update",
              payload: { id: finalBuyerPartyId, current_balance: updatedPartyBal },
              shopId,
            });
          } catch (pBalErr) {
            console.warn("Buyer balance update warning:", pBalErr);
          }
        }
      }

      toast.success(
        remainingUdhar > 0
          ? `Vehicle sold! Rs ${receivedAmt.toLocaleString()} received, Rs ${remainingUdhar.toLocaleString()} recorded as Udhar.`
          : "Vehicle sold on cash successfully! (گاڑی کی فروخت مکمل ہو گئی)"
      );

      const updatedVehicle: ShowroomVehicle = {
        ...selectedVehicleForSale,
        status: "sold",
        buyer_name: bName,
        buyer_phone: cashSaleForm.buyer_phone,
        sold_price: sPrice,
        sold_at: cashSaleForm.sold_date,
        bill_no: cashSaleForm.bill_no || undefined,
        manual_book_no: cashSaleForm.manual_book_no || undefined,
        manual_receipt_no: cashSaleForm.manual_receipt_no || undefined,
        witness_name: cashSaleForm.witness_name || undefined,
        witness_phone: cashSaleForm.witness_phone || undefined,
        witness_cnic: cashSaleForm.witness_cnic || undefined,
      };

      setIsCashSaleOpen(false);

      // Open Deed print modal
      setSelectedDeedTarget({
        vehicle: updatedVehicle,
        buyer: {
          name: bName,
          father_name: cashSaleForm.buyer_father_name,
          caste: cashSaleForm.buyer_caste,
          cnic: cashSaleForm.buyer_cnic,
          phone: cashSaleForm.buyer_phone,
          address: cashSaleForm.buyer_address,
        },
        saleType: "cash",
        salePrice: sPrice,
        downPayment: receivedAmt,
        saleDate: cashSaleForm.sold_date,
        billNo: cashSaleForm.bill_no,
        manualBookNo: cashSaleForm.manual_book_no,
        manualReceiptNo: cashSaleForm.manual_receipt_no,
        witnessName: cashSaleForm.witness_name,
        witnessPhone: cashSaleForm.witness_phone,
        witnessCnic: cashSaleForm.witness_cnic,
      });
      setIsDeedOpen(true);

      fetchAllData();
    } catch (err: any) {
      toast.error("Sale error: " + err.message);
    } finally {
      setIsSelling(false);
    }
  };

  // Open Deed Modal for existing vehicle
  const handleOpenDeed = (v: ShowroomVehicle) => {
    setSelectedDeedTarget({
      vehicle: v,
      buyer: {
        name: v.buyer_name || "Cash Buyer",
        phone: v.buyer_phone || "",
      },
      saleType: "cash",
      salePrice: Number(v.sold_price || v.cash_price || v.price || 0),
      downPayment: Number(v.sold_price || v.cash_price || v.price || 0),
      saleDate: v.sold_at || new Date().toISOString().split("T")[0],
      billNo: v.bill_no || undefined,
      manualBookNo: v.manual_book_no || undefined,
      manualReceiptNo: v.manual_receipt_no || undefined,
      witnessName: v.witness_name || undefined,
      witnessPhone: v.witness_phone || undefined,
      witnessCnic: v.witness_cnic || undefined,
    });
    setIsDeedOpen(true);
  };

  return (
    <div className="space-y-6 font-sans animate-in fade-in duration-500 pb-12">
      <ShowroomOfflineBar onSyncSuccess={fetchAllData} />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-violet-600 text-white rounded-2xl shadow-sm">
              <Car size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>Vehicle Sales Desk</span>
                <span className="font-urdu text-base text-violet-800 font-bold">(گاڑیوں کی سیل و پوائنٹ آف سیل)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Search available vehicles in stock, sell instantly on cash, or create legal installment agreements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/dashboard/showroom/vehicles">
            <Button variant="outline" className="font-bold text-xs border-slate-200 h-9 rounded-xl">
              <PlusCircle size={14} className="mr-1.5" /> + Add New Vehicle
            </Button>
          </Link>
          <Link href="/dashboard/showroom/installments">
            <Button className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-9 rounded-xl shadow-sm">
              <CreditCard size={14} className="mr-1.5" /> Installments (اقساط)
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4.5 flex items-center gap-3.5 shadow-xs">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[10.5px] uppercase font-bold text-slate-400">Available For Sale (دستیاب اسٹاک)</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600">{availableCount} Vehicles</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4.5 flex items-center gap-3.5 shadow-xs">
          <div className="p-3 rounded-2xl bg-violet-50 text-violet-700">
            <Banknote size={24} />
          </div>
          <div>
            <p className="text-[10.5px] uppercase font-bold text-slate-400">Available Stock Worth (کل مالیت)</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">{formatPKR(totalStockValue)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4.5 flex items-center gap-3.5 shadow-xs">
          <div className="p-3 rounded-2xl bg-sky-50 text-sky-700">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-[10.5px] uppercase font-bold text-slate-400">Total Sold Vehicles (کل فروخت)</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">{soldCount} Vehicles</p>
          </div>
        </div>
      </div>

      {/* Main Search & Filters Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-4">
        {/* Top Search Bar & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Make, Model, Plate #, Chassis No, Engine No, Color, Buyer... (تلاش کریں)"
              className="pl-10 h-10.5 text-xs bg-slate-50 border-slate-200 rounded-2xl focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "grid"
                    ? "bg-white text-violet-700 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid size={15} />
                <span className="hidden md:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "table"
                    ? "bg-white text-violet-700 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Table List View"
              >
                <List size={15} />
                <span className="hidden md:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Tabs & Dimension Filters */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
            <button
              onClick={() => setStatusTab("available")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                statusTab === "available"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🟢 Available for Sale</span>
              <span className="text-[10px] bg-white/25 text-white px-1.5 py-0.2 rounded-full font-mono">
                {availableCount}
              </span>
            </button>
            <button
              onClick={() => setStatusTab("sold")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                statusTab === "sold"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Sold / Installments</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                {soldCount}
              </span>
            </button>
            <button
              onClick={() => setStatusTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                statusTab === "all"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Stock ({vehicles.length})
            </button>
          </div>

          {/* Dimension Selects */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Vehicle Type */}
            <select
              value={typeFilter}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
            >
              <option value="all">🚗 All Types</option>
              <option value="car">Cars (کاریں)</option>
              <option value="bike">Bikes (موٹر سائیکل)</option>
              <option value="commercial">Commercial (کمرشل)</option>
            </select>

            {/* Make / Brand */}
            {uniqueMakes.length > 0 && (
              <select
                value={makeFilter}
                onChange={(e) => setMakeFilter(e.target.value)}
                className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
              >
                <option value="all">🏷️ All Brands</option>
                {uniqueMakes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}

            {/* Year */}
            {uniqueYears.length > 0 && (
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
              >
                <option value="all">📅 All Years</option>
                {uniqueYears.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                ))}
              </select>
            )}

            {/* Price Range */}
            <select
              value={priceRangeFilter}
              onChange={(e) => setPriceRangeFilter(e.target.value)}
              className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
            >
              <option value="all">💰 All Price Ranges</option>
              <option value="under_200k">Under Rs 2 Lakh</option>
              <option value="200k_500k">Rs 2 - 5 Lakh</option>
              <option value="500k_1m">Rs 5 - 10 Lakh</option>
              <option value="1m_3m">Rs 10 - 30 Lakh</option>
              <option value="above_3m">Above Rs 30 Lakh</option>
            </select>

            {(searchQuery || typeFilter !== "all" || makeFilter !== "all" || yearFilter !== "all" || priceRangeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setMakeFilter("all");
                  setYearFilter("all");
                  setPriceRangeFilter("all");
                }}
                className="h-9 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold px-2.5"
              >
                <X size={13} className="mr-1" /> Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Results Listing */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-violet-600" />
          <span className="text-xs font-semibold">Loading showroom vehicles stock...</span>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
          <Car size={40} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">No Vehicles Found Matching Filters</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or filter selections, or register new vehicles in inventory.
          </p>
          <Button
            onClick={() => {
              setSearchQuery("");
              setStatusTab("available");
              setTypeFilter("all");
              setMakeFilter("all");
              setYearFilter("all");
              setPriceRangeFilter("all");
            }}
            variant="outline"
            className="text-xs rounded-xl"
          >
            Clear All Filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW OF VEHICLES */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((v) => {
            const isAvailable = v.status === "available";
            const isSold = v.status === "sold" || v.status === "installment_active";
            const cashPrice = Number(v.cash_price || v.price || 0);
            const instPrice = Number(v.installment_price || 0);
            const photo = v.photos && v.photos.length > 0 ? v.photos[0] : null;

            return (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white rounded-3xl border transition-all hover:shadow-md overflow-hidden flex flex-col justify-between relative ${
                  isAvailable ? "border-slate-200/90" : "border-slate-200/60 opacity-90"
                }`}
              >
                {/* Top Media / Thumbnail & Badges */}
                <div className="relative h-44 bg-slate-900 overflow-hidden flex items-center justify-center">
                  {photo ? (
                    <img
                      src={photo}
                      alt={vehicleLabel(v)}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5">
                      <Car size={44} className="text-slate-600" />
                      <span className="text-[11px] font-mono tracking-wider font-semibold text-slate-400">
                        {v.make} {v.model}
                      </span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 ${
                        isAvailable
                          ? "bg-emerald-500 text-white"
                          : v.status === "installment_active"
                          ? "bg-purple-600 text-white"
                          : isSold
                          ? "bg-rose-500 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {isAvailable
                        ? "🟢 For Sale (دستیاب)"
                        : v.status === "installment_active"
                        ? "🟣 Sold on Installments (اقساط پر فروخت)"
                        : isSold
                        ? "🔴 Cash Sold (نقد فروخت)"
                        : "🟡 Booked"}
                    </span>
                  </div>

                  {/* Vehicle Type & Color */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {v.color && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-700/50">
                        {v.color}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white uppercase">
                      {v.vehicle_type || "Car"}
                    </span>
                  </div>

                  {/* Bottom Title on Image */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                    <div>
                      <h3 className="text-base font-black tracking-tight leading-tight">
                        {v.make} {v.model} {v.year ? `(${v.year})` : ""}
                      </h3>
                      <p className="text-[11px] text-slate-300 font-mono font-semibold">
                        {v.is_applied_for ? "Applied For (رجسٹریشن اپلائیڈ)" : v.plate_number || "No Plate"}
                      </p>
                    </div>
                    {v.engine_cc && (
                      <span className="text-[10.5px] font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-lg">
                        {v.engine_cc} CC
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content & Specs */}
                <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                  {/* Technical Identifiers */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-2xl border border-slate-150/70 font-mono">
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-400 block font-sans">Chassis No</span>
                      <span className="text-slate-800 font-bold truncate block">{v.chassis_number || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-slate-400 block font-sans">Engine No</span>
                      <span className="text-slate-800 font-bold truncate block">{v.engine_number || "—"}</span>
                    </div>
                  </div>

                  {/* Prices Display */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Cash Price (نقد قیمت)</span>
                      <span className="text-base font-black text-emerald-600">{formatPKR(cashPrice)}</span>
                    </div>
                    {instPrice > 0 && (
                      <div className="text-right">
                        <span className="text-[9px] uppercase font-bold text-violet-400 block">
                          Installment (اقساط)
                        </span>
                        <span className="text-sm font-bold text-violet-700">{formatPKR(instPrice)}</span>
                      </div>
                    )}
                  </div>

                  {/* Buyer info if already sold */}
                  {isSold && (
                    <div className={`p-2.5 rounded-xl text-xs border ${
                      v.status === "installment_active" 
                        ? "bg-purple-50/80 border-purple-200 text-purple-950"
                        : "bg-rose-50/70 border-rose-100 text-rose-900"
                    }`}>
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          {v.status === "installment_active" ? "📋 اقساط خریدار:" : "🤝 نقد خریدار:"} {v.buyer_name || "Buyer"}
                        </span>
                        <span>{formatPKR(v.sold_price || cashPrice)}</span>
                      </div>
                      {v.buyer_phone && <p className="text-[10px] opacity-80 font-mono mt-0.5">{v.buyer_phone}</p>}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {isAvailable ? (
                      <div className="grid grid-cols-2 gap-2">
                        {/* Sell on Cash */}
                        <Button
                          onClick={() => handleOpenCashSale(v)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-9.5 shadow-xs cursor-pointer gap-1"
                        >
                          <Banknote size={14} />
                          <span>نقد فروخت (Cash)</span>
                        </Button>

                        {/* Sell on Installments */}
                        <Link href={`/dashboard/showroom/installments?vehicle_id=${v.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200 font-bold text-xs rounded-xl h-9.5 cursor-pointer gap-1"
                          >
                            <CreditCard size={14} />
                            <span>اقساط پر دیں</span>
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleOpenDeed(v)}
                          size="sm"
                          className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl h-9 cursor-pointer gap-1.5"
                        >
                          <FileText size={13} />
                          <span>بیع نامہ (Print Deed)</span>
                        </Button>

                        {v.status === "installment_active" && (
                          <Link href="/dashboard/showroom/installments" className="flex-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 font-bold text-xs rounded-xl h-9 cursor-pointer gap-1.5"
                            >
                              <CreditCard size={13} />
                              <span>اقساط کھاتہ</span>
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Secondary Quick Actions */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        onClick={() => handleOpenDeed(v)}
                        className="text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Printer size={12} />
                        <span>Blank Deed (خالی بیع نامہ)</span>
                      </button>

                      <button
                        onClick={() => setDetailsVehicle(v)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>تفصیلات (Specs)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* TABLE / LIST VIEW OF VEHICLES */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] text-slate-700 font-extrabold uppercase tracking-wider bg-slate-100 select-none">
                  <th className="py-3 px-4">Vehicle Details</th>
                  <th className="py-3 px-3">Type & Color</th>
                  <th className="py-3 px-3">Chassis / Engine</th>
                  <th className="py-3 px-3 text-right">Cash Price</th>
                  <th className="py-3 px-3 text-right">Installment Price</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVehicles.map((v) => {
                  const isAvailable = v.status === "available";
                  const isSold = v.status === "sold" || v.status === "installment_active";
                  const cashPrice = Number(v.cash_price || v.price || 0);
                  const instPrice = Number(v.installment_price || 0);

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-all font-medium text-slate-700">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 font-bold text-xs">
                            {v.photos && v.photos.length > 0 ? (
                              <img src={v.photos[0]} alt="" className="h-full w-full object-cover rounded-xl" />
                            ) : (
                              <Car size={18} />
                            )}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block text-xs">
                              {v.make} {v.model} {v.year ? `(${v.year})` : ""}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono font-semibold">
                              {v.is_applied_for ? "Applied For" : v.plate_number || "—"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100 uppercase">
                          {v.vehicle_type || "Car"}
                        </span>
                        {v.color && <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{v.color}</p>}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <p className="text-slate-800 font-semibold">{v.chassis_number || "—"}</p>
                        <p className="text-[10px] text-slate-400">{v.engine_number || "—"}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-600 text-xs">
                        {formatPKR(cashPrice)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-violet-700 text-xs">
                        {instPrice > 0 ? formatPKR(instPrice) : "—"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[9.5px] font-extrabold border ${
                            isAvailable
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : v.status === "installment_active"
                              ? "bg-purple-50 text-purple-700 border-purple-300 font-black"
                              : isSold
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {isAvailable ? "🟢 Available" : v.status === "installment_active" ? "🟣 Installments (اقساط)" : isSold ? "🔴 Cash Sold" : "🟡 Booked"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isAvailable ? (
                            <>
                              <Button
                                onClick={() => handleOpenCashSale(v)}
                                size="sm"
                                className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer gap-1"
                              >
                                <Banknote size={13} />
                                <span>نقد فروخت</span>
                              </Button>
                              <Link href={`/dashboard/showroom/installments?vehicle_id=${v.id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200 font-bold text-xs rounded-xl cursor-pointer gap-1"
                                >
                                  <CreditCard size={13} />
                                  <span>اقساط</span>
                                </Button>
                              </Link>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleOpenDeed(v)}
                                size="sm"
                                className="h-8 px-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl cursor-pointer gap-1"
                              >
                                <FileText size={13} />
                                <span>بیع نامہ</span>
                              </Button>
                              {v.status === "installment_active" && (
                                <Link href="/dashboard/showroom/installments">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 font-bold text-xs rounded-xl cursor-pointer"
                                  >
                                    اقساط
                                  </Button>
                                </Link>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => setDetailsVehicle(v)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
                            title="View Vehicle Details"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Cash Sale Execution */}
      <AnimatePresence>
        {isCashSaleOpen && selectedVehicleForSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Execute Vehicle Cash Sale (نقد گاڑی فروخت)</h3>
                    <p className="text-xs text-slate-400">
                      {vehicleLabel(selectedVehicleForSale)} •{" "}
                      {selectedVehicleForSale.is_applied_for
                        ? "Applied For"
                        : selectedVehicleForSale.plate_number || "No Plate"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCashSaleOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleExecuteCashSale} className="p-6 space-y-4 overflow-y-auto">
                {/* Vehicle Specs Summary Strip */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-700">Selling Vehicle</p>
                    <p className="font-extrabold text-slate-900">{vehicleLabel(selectedVehicleForSale)}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Chassis: {selectedVehicleForSale.chassis_number || "—"} | Engine:{" "}
                      {selectedVehicleForSale.engine_number || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-emerald-700">Cost Price</p>
                    <p className="font-bold text-slate-700">{formatPKR(selectedVehicleForSale.purchase_cost)}</p>
                  </div>
                </div>

                {/* Existing Customer Select */}
                {parties.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Select Existing Customer / Party (اختیاری: پہلے سے موجود گاہک)
                    </label>
                    <select
                      value={cashSaleForm.buyer_party_id}
                      onChange={(e) => handleSelectBuyerParty(e.target.value)}
                      className="w-full h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-semibold text-slate-800 focus:bg-white cursor-pointer"
                    >
                      <option value="">+ New Walk-in Buyer (نیا خریدار درج کریں)</option>
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.phone ? `(${p.phone})` : ""} {p.cnic ? `— CNIC: ${p.cnic}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Buyer Personal Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Buyer Full Name (خریدار کا نام) *
                    </label>
                    <Input
                      required
                      value={cashSaleForm.buyer_name}
                      onChange={(e) => setCashSaleForm((p) => ({ ...p, buyer_name: e.target.value }))}
                      placeholder="e.g. Muhammad Ali"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Father's Name (ولدیت)
                    </label>
                    <Input
                      value={cashSaleForm.buyer_father_name}
                      onChange={(e) => setCashSaleForm((p) => ({ ...p, buyer_father_name: e.target.value }))}
                      placeholder="e.g. Tariq Mehmood"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CNIC No (شناختی کارڈ نمبر)
                    </label>
                    <Input
                      value={cashSaleForm.buyer_cnic}
                      onChange={(e) => setCashSaleForm((p) => ({ ...p, buyer_cnic: e.target.value }))}
                      placeholder="35201-XXXXXXX-X"
                      className="h-10 text-xs font-mono rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone Number (موبائل نمبر)
                    </label>
                    <Input
                      value={cashSaleForm.buyer_phone}
                      onChange={(e) => setCashSaleForm((p) => ({ ...p, buyer_phone: e.target.value }))}
                      placeholder="0300-1234567"
                      className="h-10 text-xs font-mono rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Buyer Complete Address (خریدار کا مکمل پتہ)
                  </label>
                  <Input
                    value={cashSaleForm.buyer_address}
                    onChange={(e) => setCashSaleForm((p) => ({ ...p, buyer_address: e.target.value }))}
                    placeholder="House / Street / City address"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                {/* Financial Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Final Sale Price (کل طے شدہ قیمت) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs</span>
                      <Input
                        type="number"
                        required
                        min="0"
                        value={cashSaleForm.sold_price || ""}
                        onChange={(e) => {
                          const sVal = Number(e.target.value);
                          setCashSaleForm((p) => ({
                            ...p,
                            sold_price: sVal,
                            paid_amount: p.payment_mode === "cash" || p.payment_mode === "bank" ? sVal : p.paid_amount,
                          }));
                        }}
                        className="pl-9 h-10 text-sm font-black text-slate-900 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Payment Mode (طریقہ ادائیگی)
                    </label>
                    <select
                      value={cashSaleForm.payment_mode}
                      onChange={(e) => {
                        const m = e.target.value as "cash" | "bank" | "credit" | "partial";
                        setCashSaleForm((p) => ({
                          ...p,
                          payment_mode: m,
                          paid_amount: m === "cash" || m === "bank" ? p.sold_price : m === "credit" ? 0 : p.paid_amount,
                        }));
                      }}
                      className="w-full h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-semibold text-slate-800 focus:bg-white cursor-pointer"
                    >
                      <option value="cash">Spot Cash (مکمل نقد وصولی)</option>
                      <option value="bank">Bank Transfer / Cheque</option>
                      <option value="partial">Partial Payment (کچھ نقد ایڈوانس + باقی ادھار)</option>
                      <option value="credit">Full Udhar / Credit (مکمل ادھار پر)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Receiving Account (رقم وصولی کا کھاتہ)
                    </label>
                    <select
                      value={cashSaleForm.account_id}
                      onChange={(e) => setCashSaleForm((p) => ({ ...p, account_id: e.target.value }))}
                      className="w-full h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-semibold text-slate-800 focus:bg-white cursor-pointer"
                    >
                      <option value="">Cash in Hand (درست کیش کاؤنٹر)</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type || "Cash"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Partial Payment Breakdown for Sale */}
                {cashSaleForm.payment_mode === "partial" && (
                  <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50/70 rounded-2xl border border-emerald-200/80 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                      <span className="flex items-center gap-1.5">
                        <DollarSign size={14} className="text-emerald-700" />
                        نقد وصولی و باقایا ادھار (Received Advance & Remaining Udhar)
                      </span>
                      <span className="text-[11px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full font-extrabold">
                        Advance + Udhar
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Received Advance Amount (وصول شدہ نقد رقم / ایڈوانس) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rs</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={cashSaleForm.paid_amount || ""}
                            onChange={(e) =>
                              setCashSaleForm((p) => ({
                                ...p,
                                paid_amount: Number(e.target.value),
                                remaining_amount: Math.max(0, Number(p.sold_price || 0) - Number(e.target.value)),
                              }))
                            }
                            className="pl-9 h-10 text-sm font-black text-emerald-700 bg-white rounded-xl"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Remaining Receivable Udhar (گاہک کے کھاتے میں باقایا ادھار)
                        </label>
                        <div className="h-10 px-3.5 rounded-xl bg-white border border-rose-200 flex items-center justify-between font-mono font-black text-rose-700">
                          <span>
                            Rs {Math.max(0, Number(cashSaleForm.sold_price || 0) - Number(cashSaleForm.paid_amount || 0)).toLocaleString()}
                          </span>
                          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-sans">
                            گاہک کا کھاتہ
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-emerald-900 font-medium">
                      💡 وصول شدہ رقم <span className="font-bold">Rs {Number(cashSaleForm.paid_amount || 0).toLocaleString()}</span> منتخب کیش اکاؤنٹ میں جمع ہوگی اور باقایا <span className="font-bold text-rose-700">Rs {Math.max(0, Number(cashSaleForm.sold_price || 0) - Number(cashSaleForm.paid_amount || 0)).toLocaleString()}</span> خریدار کے کھاتے میں ادھار درج ہوگا۔
                    </p>
                  </div>
                )}

                {/* Bill / Book / Receipt References */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <FileText size={14} className="text-emerald-600" />
                    <span>Bill, Khata & Receipt Details (بل، کھاتہ و رسید نمبر)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Bill / Invoice # (بل نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.bill_no}
                        onChange={(e) => setCashSaleForm((p) => ({ ...p, bill_no: e.target.value }))}
                        placeholder="CS-2609-001"
                        className="h-9 text-xs font-mono font-bold text-slate-800 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Khata / Book # (کھاتہ نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.manual_book_no}
                        onChange={(e) => setCashSaleForm((p) => ({ ...p, manual_book_no: e.target.value }))}
                        placeholder="Khata # / کھاتہ نمبر"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Receipt / Slip # (رسید / پرچی نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.manual_receipt_no}
                        onChange={(e) => setCashSaleForm((p) => ({ ...p, manual_receipt_no: e.target.value }))}
                        placeholder="Receipt # / پرچی"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Witness Details (گواہ) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <ShieldCheck size={14} className="text-violet-600" />
                    <span>Witness / Guarantor (گواہ کی تفصیلات)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Witness Name (گواہ کا نام)
                      </label>
                      <Input
                        value={cashSaleForm.witness_name}
                        onChange={(e) => setCashSaleForm((p) => ({ ...p, witness_name: e.target.value }))}
                        placeholder="e.g. Aslam Khan"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Witness Phone (فون نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.witness_phone}
                        onChange={(e) => setCashSaleForm((p) => ({ ...p, witness_phone: e.target.value }))}
                        placeholder="0300-1234567"
                        className="h-9 text-xs font-mono rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Witness CNIC (شناختی کارڈ)
                      </label>
                      <Input
                        value={cashSaleForm.witness_cnic}
                        onChange={(e) => setCashSaleForm((p) => ({ ...p, witness_cnic: e.target.value }))}
                        placeholder="35201-XXXXXXX-X"
                        className="h-9 text-xs font-mono rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sale Date (تاریخ فروخت)</label>
                  <Input
                    type="date"
                    value={cashSaleForm.sold_date}
                    onChange={(e) => setCashSaleForm((p) => ({ ...p, sold_date: e.target.value }))}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCashSaleOpen(false)}
                    className="flex-1 h-11 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSelling}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-xs rounded-xl shadow-md gap-1.5 cursor-pointer"
                  >
                    {isSelling ? <Loader2 className="animate-spin h-4 w-4" /> : <BadgeCheck size={16} />}
                    <span>Confirm Sale & Print Deed (فروخت مکمل کریں)</span>
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Vehicle Specs & Details */}
      <AnimatePresence>
        {detailsVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <Car size={20} className="text-violet-400" />
                  <h3 className="text-base font-bold">
                    {vehicleLabel(detailsVehicle)} {detailsVehicle.year ? `(${detailsVehicle.year})` : ""}
                  </h3>
                </div>
                <button
                  onClick={() => setDetailsVehicle(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto text-xs">
                {/* Photo Carousel or Grid */}
                {detailsVehicle.photos && detailsVehicle.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {detailsVehicle.photos.map((pUrl, idx) => (
                      <a key={idx} href={pUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={pUrl}
                          alt="Vehicle"
                          className="h-28 w-full object-cover rounded-2xl border border-slate-200 hover:opacity-90 transition"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {/* Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Registration</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      {detailsVehicle.is_applied_for ? "Applied For" : detailsVehicle.plate_number || "—"}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Chassis Number</span>
                    <span className="text-sm font-bold text-slate-900 font-mono truncate block">
                      {detailsVehicle.chassis_number || "—"}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Engine Number</span>
                    <span className="text-sm font-bold text-slate-900 font-mono truncate block">
                      {detailsVehicle.engine_number || "—"}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Color & CC</span>
                    <span className="text-sm font-bold text-slate-900">
                      {detailsVehicle.color || "—"} {detailsVehicle.engine_cc ? `• ${detailsVehicle.engine_cc}cc` : ""}
                    </span>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Cash Price</span>
                    <span className="text-sm font-black text-emerald-600">
                      {formatPKR(detailsVehicle.cash_price || detailsVehicle.price)}
                    </span>
                  </div>

                  <div className="bg-violet-50 p-3 rounded-2xl border border-violet-100">
                    <span className="text-[10px] uppercase font-bold text-violet-700 block">Installment Price</span>
                    <span className="text-sm font-black text-violet-700">
                      {formatPKR(detailsVehicle.installment_price)}
                    </span>
                  </div>
                </div>

                {detailsVehicle.notes && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Notes / Description</span>
                    <p className="text-slate-700 whitespace-pre-wrap">{detailsVehicle.notes}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <Button onClick={() => setDetailsVehicle(null)} className="rounded-xl text-xs">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Legal Sale Deed Print */}
      {selectedDeedTarget && (
        <ShowroomDeedPrintModal
          isOpen={isDeedOpen}
          onClose={() => {
            setIsDeedOpen(false);
            setSelectedDeedTarget(null);
          }}
          shopName={shopName || "Showroom"}
          shopPhone={shopPhone || undefined}
          shopAddress={shopAddress || undefined}
          vehicle={selectedDeedTarget.vehicle}
          buyer={selectedDeedTarget.buyer}
          saleType={selectedDeedTarget.saleType}
          salePrice={selectedDeedTarget.salePrice}
          downPayment={selectedDeedTarget.downPayment || 0}
          saleDate={selectedDeedTarget.saleDate || new Date().toISOString().split("T")[0]}
          billNo={selectedDeedTarget.billNo}
          manualBookNo={selectedDeedTarget.manualBookNo}
          manualReceiptNo={selectedDeedTarget.manualReceiptNo}
          witnessName={selectedDeedTarget.witnessName}
          witnessPhone={selectedDeedTarget.witnessPhone}
          witnessCnic={selectedDeedTarget.witnessCnic}
        />
      )}
    </div>
  );
}
