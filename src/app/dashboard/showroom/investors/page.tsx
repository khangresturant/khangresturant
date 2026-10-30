"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  Search,
  PlusCircle,
  TrendingUp,
  DollarSign,
  Car,
  User,
  Phone,
  CreditCard,
  Building2,
  Calendar,
  Share2,
  Printer,
  FileText,
  SlidersHorizontal,
  Tag,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  X,
  Edit,
  Trash2,
  Eye,
  RefreshCcw,
  Wallet,
  Scale,
  Sparkles,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import type {
  ShowroomInvestor,
  ShowroomInvestorTx,
  ShowroomVehicle,
  InvestorShareType,
  InvestorTxType,
} from "@/lib/showroom-ops";
import {
  formatPKR,
  vehicleLabel,
  calculateInvestorProfitShare,
  formatInvestorShareBadge,
  loadShowroomOfflineEntities,
  executeShowroomAction,
  isShowroomOffline,
} from "@/lib/showroom-ops";
import { ShowroomOfflineBar } from "@/components/showroom/ShowroomOfflineBar";

interface CashAccountItem {
  id: string;
  name: string;
  type?: string | null;
  current_balance?: number | null;
}

const emptyInvestorForm = {
  name: "",
  father_name: "",
  phone: "",
  whatsapp: "",
  cnic: "",
  city: "Lahore",
  address: "",
  default_share_type: "profit_only" as InvestorShareType,
  default_share_value: 50,
  initial_capital: 0,
  account_id: "",
  notes: "",
  status: "active" as "active" | "inactive",
};

export default function ShowroomInvestorsPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [investors, setInvestors] = useState<ShowroomInvestor[]>([]);
  const [transactions, setTransactions] = useState<ShowroomInvestorTx[]>([]);
  const [vehicles, setVehicles] = useState<ShowroomVehicle[]>([]);
  const [accounts, setAccounts] = useState<CashAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"investors" | "vehicles" | "profit_sharing" | "ledger">("investors");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Investor Modal
  const [isInvestorModalOpen, setIsInvestorModalOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<ShowroomInvestor | null>(null);
  const [investorFormData, setInvestorFormData] = useState(emptyInvestorForm);
  const [isSavingInvestor, setIsSavingInvestor] = useState(false);

  // Capital Deposit Modal
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositForm, setDepositForm] = useState({
    investor_id: "",
    vehicle_id: "",
    amount: 0,
    account_id: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [isDepositing, setIsDepositing] = useState(false);

  // Payout / Withdrawal Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    investor_id: "",
    tx_type: "profit_payout" as "profit_payout" | "capital_withdrawal",
    amount: 0,
    account_id: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [isPaying, setIsPaying] = useState(false);

  // Profit Distribution Calculator Modal
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [distributeForm, setDistributeForm] = useState({
    vehicle_id: "",
    investor_id: "",
    purchase_cost: 0,
    sold_price: 0,
    share_type: "profit_only" as InvestorShareType,
    share_value: 50,
    payout_mode: "credit_khata" as "credit_khata" | "instant_cash",
    account_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [isDistributing, setIsDistributing] = useState(false);

  // Detailed Ledger / Statement Modal
  const [selectedInvestorForLedger, setSelectedInvestorForLedger] = useState<ShowroomInvestor | null>(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const printStatementRef = useRef<HTMLDivElement>(null);

  // Fetch all investor data
  const fetchData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const [offInv, offTx, offVeh, offAcc] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomInvestor>("showroom_investors", shopId),
          loadShowroomOfflineEntities<ShowroomInvestorTx>("showroom_investor_transactions", shopId),
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
        ]);
        setInvestors(offInv);
        setTransactions(offTx);
        setVehicles(offVeh);
        setAccounts(offAcc);
        setLoading(false);
        return;
      }

      // 1. Fetch Investors
      const { data: invData, error: invErr } = await supabase
        .from("showroom_investors")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (invErr) {
        console.warn("showroom_investors table might not exist yet:", invErr.message);
      }

      // 2. Fetch Transactions
      const { data: txData } = await supabase
        .from("showroom_investor_transactions")
        .select("*, investor:showroom_investors(*), vehicle:showroom_vehicles(*)")
        .eq("shop_id", shopId)
        .order("date", { ascending: false });

      // 3. Fetch Showroom Vehicles
      const { data: vehData } = await supabase
        .from("showroom_vehicles")
        .select("*, purchase_party:showroom_parties!purchase_party_id(*), buyer_party:showroom_parties!buyer_party_id(*)")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      // 4. Fetch Accounts
      const { data: accData } = await supabase
        .from("cash_accounts")
        .select("id, name, type, current_balance")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      const loadedInv = (invData as ShowroomInvestor[]) || [];
      const loadedTx = (txData as ShowroomInvestorTx[]) || [];
      const loadedVeh = (vehData as ShowroomVehicle[]) || [];
      setInvestors(loadedInv);
      setTransactions(loadedTx);
      setVehicles(loadedVeh);
      setAccounts((accData as CashAccountItem[]) || []);

      import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
        putManyOfflineData("showroom_investors", loadedInv.map((r) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        putManyOfflineData("showroom_investor_transactions", loadedTx.map((r) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
      });
    } catch (err: any) {
      try {
        const [offInv, offTx, offVeh, offAcc] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomInvestor>("showroom_investors", shopId),
          loadShowroomOfflineEntities<ShowroomInvestorTx>("showroom_investor_transactions", shopId),
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
        ]);
        if (offInv.length > 0 || offVeh.length > 0) {
          setInvestors(offInv);
          setTransactions(offTx);
          setVehicles(offVeh);
          setAccounts(offAcc);
        } else {
          toast.error("انویسٹرز کا ڈیٹا لوڈ کرنے میں مسئلہ پیش آیا");
        }
      } catch {
        toast.error("انویسٹرز کا ڈیٹا لوڈ کرنے میں مسئلہ پیش آیا");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shopId]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalInvestors = investors.length;
    let totalInvested = 0;
    let totalProfitDistributed = 0;
    let totalWithdrawn = 0;
    let netPayableBalance = 0;

    investors.forEach((inv) => {
      totalInvested += Number(inv.total_invested || 0);
      totalProfitDistributed += Number(inv.total_profit_earned || 0);
      totalWithdrawn += Number(inv.total_withdrawn || 0);
      netPayableBalance += Number(inv.current_balance || 0);
    });

    const activeFundedVehicles = vehicles.filter((v) => v.investor_id && v.status !== "sold").length;
    const soldFundedVehicles = vehicles.filter((v) => v.investor_id && v.status === "sold").length;

    return {
      totalInvestors,
      totalInvested,
      totalProfitDistributed,
      totalWithdrawn,
      netPayableBalance,
      activeFundedVehicles,
      soldFundedVehicles,
    };
  }, [investors, vehicles]);

  // Filtered Investors
  const filteredInvestors = useMemo(() => {
    return investors.filter((inv) => {
      const matchSearch =
        inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.phone && inv.phone.includes(searchQuery)) ||
        (inv.cnic && inv.cnic.includes(searchQuery)) ||
        (inv.city && inv.city.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [investors, searchQuery, statusFilter]);

  // Filtered Vehicles co-financed
  const investorVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const hasInvestor = Boolean(v.investor_id || (v as any).is_investor_funded);
      if (!hasInvestor) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        (v.plate_number && v.plate_number.toLowerCase().includes(q)) ||
        (v.chassis_number && v.chassis_number.toLowerCase().includes(q))
      );
    });
  }, [vehicles, searchQuery]);

  // Handle Save Investor
  const handleSaveInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    if (!investorFormData.name.trim()) {
      toast.error("براہ کرم انویسٹر کا نام درج کریں");
      return;
    }
    if (!investorFormData.phone.trim()) {
      toast.error("براہ کرم فون نمبر درج کریں");
      return;
    }

    setIsSavingInvestor(true);
    try {
      const initialCap = Number(investorFormData.initial_capital || 0);
      const payload: Partial<ShowroomInvestor> = {
        shop_id: shopId,
        name: investorFormData.name.trim(),
        father_name: investorFormData.father_name.trim() || null,
        phone: investorFormData.phone.trim(),
        whatsapp: investorFormData.whatsapp?.trim() || null,
        cnic: investorFormData.cnic?.trim() || null,
        city: investorFormData.city?.trim() || "Lahore",
        address: investorFormData.address?.trim() || null,
        default_share_type: investorFormData.default_share_type,
        default_share_value: Number(investorFormData.default_share_value || 50),
        notes: investorFormData.notes?.trim() || null,
        status: investorFormData.status,
      };

      if (editingInvestor) {
        await executeShowroomAction({
          table: "showroom_investors",
          action: "update",
          payload: { ...payload, id: editingInvestor.id },
          shopId,
        });

        toast.success("انویسٹر کی تفصیلات کامیابی سے تبدیل ہو گئیں");
      } else {
        const newInvId = crypto.randomUUID();
        payload.id = newInvId;
        payload.total_invested = initialCap;
        payload.current_balance = initialCap;
        payload.total_profit_earned = 0;
        payload.total_withdrawn = 0;

        await executeShowroomAction({
          table: "showroom_investors",
          action: "insert",
          payload,
          shopId,
        });

        // If initial capital provided and account selected, record transaction
        if (initialCap > 0) {
          await executeShowroomAction({
            table: "showroom_investor_transactions",
            action: "insert",
            payload: {
              id: crypto.randomUUID(),
              shop_id: shopId,
              investor_id: newInvId,
              tx_type: "capital_inflow",
              amount: initialCap,
              account_id: investorFormData.account_id || null,
              date: new Date().toISOString().split("T")[0],
              description: `ابتدائی سرمایہ ڈپازٹ (Initial Capital Injected by ${payload.name})`,
            },
            shopId,
          });

          if (investorFormData.account_id) {
            await executeShowroomAction({
              table: "account_transactions",
              action: "insert",
              payload: {
                id: crypto.randomUUID(),
                shop_id: shopId,
                account_id: investorFormData.account_id,
                type: "income",
                amount: initialCap,
                description: `Showroom Capital Inflow - Investor: ${payload.name}`,
              },
              shopId,
            });

            const chosenAcc = accounts.find((a) => a.id === investorFormData.account_id);
            if (chosenAcc) {
              const updatedBal = (Number(chosenAcc.current_balance) || 0) + initialCap;
              await executeShowroomAction({
                table: "cash_accounts",
                action: "update",
                payload: { id: investorFormData.account_id, current_balance: updatedBal },
                shopId,
              });
            }
          }
        }

        toast.success("نیا انویسٹر کامیابی سے شامل ہو گیا");
      }

      setIsInvestorModalOpen(false);
      setEditingInvestor(null);
      setInvestorFormData(emptyInvestorForm);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("محفوظ کرنے میں خرابی: " + err.message);
    } finally {
      setIsSavingInvestor(false);
    }
  };

  // Handle Deposit Capital
  const handleDepositCapital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    const amount = Number(depositForm.amount || 0);
    if (!depositForm.investor_id) {
      toast.error("براہ کرم انویسٹر منتخب کریں");
      return;
    }
    if (amount <= 0) {
      toast.error("براہ کرم درست رقم درج کریں");
      return;
    }

    setIsDepositing(true);
    try {
      const inv = investors.find((i) => i.id === depositForm.investor_id);
      const vehicle = vehicles.find((v) => v.id === depositForm.vehicle_id);

      // 1. Insert Investor Transaction
      await executeShowroomAction({
        table: "showroom_investor_transactions",
        action: "insert",
        payload: {
          id: crypto.randomUUID(),
          shop_id: shopId,
          investor_id: depositForm.investor_id,
          vehicle_id: depositForm.vehicle_id || null,
          tx_type: depositForm.vehicle_id ? "vehicle_investment" : "capital_inflow",
          amount: amount,
          account_id: depositForm.account_id || null,
          date: depositForm.date,
          description:
            depositForm.description ||
            (vehicle
              ? `سرمایہ برائے گاڑی: ${vehicle.make} ${vehicle.model} (${vehicle.plate_number || vehicle.chassis_number || ""})`
              : `جنرل شوروم فنڈ انویسٹمنٹ`),
        },
        shopId,
      });

      // 2. Update Investor Totals
      if (inv) {
        const newTotalInvested = Number(inv.total_invested || 0) + amount;
        const newCurrentBalance = Number(inv.current_balance || 0) + amount;
        await executeShowroomAction({
          table: "showroom_investors",
          action: "update",
          payload: {
            id: inv.id,
            total_invested: newTotalInvested,
            current_balance: newCurrentBalance,
          },
          shopId,
        });
      }

      // 3. Update Cash/Bank Account Transaction & Balance
      if (depositForm.account_id) {
        await executeShowroomAction({
          table: "account_transactions",
          action: "insert",
          payload: {
            id: crypto.randomUUID(),
            shop_id: shopId,
            account_id: depositForm.account_id,
            type: "income",
            amount: amount,
            description: `Showroom Capital Inflow - Investor: ${inv?.name || "Partner"}`,
          },
          shopId,
        });

        const chosenAcc = accounts.find((a) => a.id === depositForm.account_id);
        if (chosenAcc) {
          const updatedBal = (Number(chosenAcc.current_balance) || 0) + amount;
          await executeShowroomAction({
            table: "cash_accounts",
            action: "update",
            payload: { id: depositForm.account_id, current_balance: updatedBal },
            shopId,
          });
        }
      }

      toast.success(`${formatPKR(amount)} کا سرمایہ کامیابی سے درج کر لیا گیا`);
      setIsDepositModalOpen(false);
      setDepositForm({
        investor_id: "",
        vehicle_id: "",
        amount: 0,
        account_id: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("سرمایہ جمع کرنے میں خرابی: " + err.message);
    } finally {
      setIsDepositing(false);
    }
  };

  // Handle Payout / Withdrawal
  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    const amount = Number(payoutForm.amount || 0);
    if (!payoutForm.investor_id) {
      toast.error("براہ کرم انویسٹر منتخب کریں");
      return;
    }
    if (amount <= 0) {
      toast.error("براہ کرم درست رقم درج کریں");
      return;
    }

    setIsPaying(true);
    try {
      const inv = investors.find((i) => i.id === payoutForm.investor_id);
      const isProfitPayout = payoutForm.tx_type === "profit_payout";

      // 1. Insert Investor Transaction
      await executeShowroomAction({
        table: "showroom_investor_transactions",
        action: "insert",
        payload: {
          id: crypto.randomUUID(),
          shop_id: shopId,
          investor_id: payoutForm.investor_id,
          tx_type: payoutForm.tx_type,
          amount: amount,
          account_id: payoutForm.account_id || null,
          date: payoutForm.date,
          description:
            payoutForm.description ||
            (isProfitPayout ? `منافع کی ادائیگی (Profit Payout)` : `سرمایہ واپسی (Capital Withdrawal / Return)`),
        },
        shopId,
      });

      // 2. Update Investor Balance
      if (inv) {
        const newTotalWithdrawn = Number(inv.total_withdrawn || 0) + amount;
        const newCurrentBalance = Number(inv.current_balance || 0) - amount;
        await executeShowroomAction({
          table: "showroom_investors",
          action: "update",
          payload: {
            id: inv.id,
            total_withdrawn: newTotalWithdrawn,
            current_balance: newCurrentBalance,
          },
          shopId,
        });
      }

      // 3. Log Outflow in accounts & update balance
      if (payoutForm.account_id) {
        await executeShowroomAction({
          table: "account_transactions",
          action: "insert",
          payload: {
            id: crypto.randomUUID(),
            shop_id: shopId,
            account_id: payoutForm.account_id,
            type: "expense",
            amount: amount,
            description: `Showroom Investor Payout (${isProfitPayout ? "Profit" : "Capital Return"}) - ${inv?.name || ""}`,
          },
          shopId,
        });

        const chosenAcc = accounts.find((a) => a.id === payoutForm.account_id);
        if (chosenAcc) {
          const updatedBal = (Number(chosenAcc.current_balance) || 0) - amount;
          await executeShowroomAction({
            table: "cash_accounts",
            action: "update",
            payload: { id: payoutForm.account_id, current_balance: updatedBal },
            shopId,
          });
        }
      }

      toast.success(
        `${formatPKR(amount)} کی ادائیگی (${isProfitPayout ? "منافع" : "سرمایہ واپسی"}) کامیابی سے درج ہو گئی`
      );
      setIsPayoutModalOpen(false);
      setPayoutForm({
        investor_id: "",
        tx_type: "profit_payout",
        amount: 0,
        account_id: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("ادائیگی کرنے میں خرابی: " + err.message);
    } finally {
      setIsPaying(false);
    }
  };

  // Open Distribute Profit for a specific vehicle
  const openDistributeForVehicle = (veh: ShowroomVehicle) => {
    const invId = veh.investor_id || (investors[0]?.id ?? "");
    const inv = investors.find((i) => i.id === invId);
    const pCost = Number(veh.purchase_cost || 0);
    const sPrice = Number(veh.sold_price || veh.cash_price || veh.price || 0);

    setDistributeForm({
      vehicle_id: veh.id,
      investor_id: invId,
      purchase_cost: pCost,
      sold_price: sPrice,
      share_type: veh.investor_share_type || inv?.default_share_type || "profit_only",
      share_value: veh.investor_share_value || inv?.default_share_value || 50,
      payout_mode: "credit_khata",
      account_id: "",
      date: new Date().toISOString().split("T")[0],
      notes: `گاڑی ${veh.make} ${veh.model} فروخت پر منافع کی شراکت`,
    });
    setIsDistributeModalOpen(true);
  };

  // Distribute Profit Calculation
  const profitShareCalc = useMemo(() => {
    return calculateInvestorProfitShare(
      distributeForm.purchase_cost,
      distributeForm.sold_price,
      distributeForm.share_type,
      distributeForm.share_value
    );
  }, [
    distributeForm.purchase_cost,
    distributeForm.sold_price,
    distributeForm.share_type,
    distributeForm.share_value,
  ]);

  // Handle Distribute Submit
  const handleDistributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    if (!distributeForm.investor_id) {
      toast.error("براہ کرم انویسٹر منتخب کریں");
      return;
    }

    setIsDistributing(true);
    try {
      const inv = investors.find((i) => i.id === distributeForm.investor_id);
      const veh = vehicles.find((v) => v.id === distributeForm.vehicle_id);
      const { investorProfit, isLoss } = profitShareCalc;

      const txType: InvestorTxType = isLoss ? "loss_share" : "profit_share";
      const desc =
        distributeForm.notes ||
        `گاڑی ${veh ? `${veh.make} ${veh.model}` : "گاڑی"} فروخت پر ${isLoss ? "نقصان میں شراکت" : "منافع میں شراکت"}`;

      // 1. Insert Investor Transaction for Profit Crediting
      await executeShowroomAction({
        table: "showroom_investor_transactions",
        action: "insert",
        payload: {
          id: crypto.randomUUID(),
          shop_id: shopId,
          investor_id: distributeForm.investor_id,
          vehicle_id: distributeForm.vehicle_id || null,
          tx_type: txType,
          share_type: distributeForm.share_type,
          share_percentage: distributeForm.share_value,
          amount: Math.abs(investorProfit),
          account_id: distributeForm.payout_mode === "instant_cash" ? distributeForm.account_id || null : null,
          date: distributeForm.date,
          description: desc,
        },
        shopId,
      });

      // 2. If instant cash payout chosen, also log a profit_payout transaction
      if (distributeForm.payout_mode === "instant_cash" && investorProfit > 0) {
        await executeShowroomAction({
          table: "showroom_investor_transactions",
          action: "insert",
          payload: {
            id: crypto.randomUUID(),
            shop_id: shopId,
            investor_id: distributeForm.investor_id,
            vehicle_id: distributeForm.vehicle_id || null,
            tx_type: "profit_payout",
            amount: investorProfit,
            account_id: distributeForm.account_id || null,
            date: distributeForm.date,
            description: `فوری کیش منافع ادا کر دیا گیا: ${desc}`,
          },
          shopId,
        });

        if (distributeForm.account_id) {
          await executeShowroomAction({
            table: "account_transactions",
            action: "insert",
            payload: {
              id: crypto.randomUUID(),
              shop_id: shopId,
              account_id: distributeForm.account_id,
              type: "expense",
              amount: investorProfit,
              description: `Showroom Investor Profit Payout - ${inv?.name || ""} (${veh?.make} ${veh?.model})`,
            },
            shopId,
          });

          const chosenAcc = accounts.find((a) => a.id === distributeForm.account_id);
          if (chosenAcc) {
            const updatedBal = (Number(chosenAcc.current_balance) || 0) - investorProfit;
            await executeShowroomAction({
              table: "cash_accounts",
              action: "update",
              payload: { id: distributeForm.account_id, current_balance: updatedBal },
              shopId,
            });
          }
        }
      }

      // 3. Update Investor Profile Totals
      if (inv) {
        const newProfitEarned = Number(inv.total_profit_earned || 0) + (isLoss ? -Math.abs(investorProfit) : investorProfit);
        const newWithdrawn =
          distributeForm.payout_mode === "instant_cash"
            ? Number(inv.total_withdrawn || 0) + investorProfit
            : Number(inv.total_withdrawn || 0);

        const newBalance =
          distributeForm.payout_mode === "instant_cash"
            ? Number(inv.current_balance || 0)
            : Number(inv.current_balance || 0) + (isLoss ? -Math.abs(investorProfit) : investorProfit);

        await executeShowroomAction({
          table: "showroom_investors",
          action: "update",
          payload: {
            id: inv.id,
            total_profit_earned: newProfitEarned,
            total_withdrawn: newWithdrawn,
            current_balance: newBalance,
          },
          shopId,
        });
      }

      // 4. Mark vehicle as investor profit settled
      if (distributeForm.vehicle_id) {
        await executeShowroomAction({
          table: "showroom_vehicles",
          action: "update",
          payload: {
            id: distributeForm.vehicle_id,
            investor_profit_settled: true,
            investor_profit_amount: investorProfit,
          },
          shopId,
        });
      }

      toast.success(
        `انویسٹر کا منافع (${formatPKR(investorProfit)}) کامیابی سے ${
          distributeForm.payout_mode === "instant_cash" ? "کیش ادا کر دیا گیا" : "کھاتہ میں منتقل ہو گیا"
        }`
      );
      setIsDistributeModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("منافع تقسیم کرنے میں خرابی: " + err.message);
    } finally {
      setIsDistributing(false);
    }
  };

  // Open Detailed Ledger for an Investor
  const openInvestorLedger = (inv: ShowroomInvestor) => {
    setSelectedInvestorForLedger(inv);
    setIsLedgerModalOpen(true);
  };

  // Get transactions for selected investor
  const selectedInvestorTransactions = useMemo(() => {
    if (!selectedInvestorForLedger) return [];
    return transactions.filter((t) => t.investor_id === selectedInvestorForLedger.id);
  }, [selectedInvestorForLedger, transactions]);

  // Handle Delete Investor
  const handleDeleteInvestor = async (id: string, name: string) => {
    if (!confirm(`کیا آپ واقعی انویسٹر "${name}" کو ڈیلیٹ کرنا چاہتے ہیں؟`)) return;
    try {
      await executeShowroomAction({
        table: "showroom_investors",
        action: "delete",
        payload: { id },
        shopId,
      });
      toast.success("انویسٹر کامیابی سے ڈیلیٹ ہو گیا");
      fetchData();
    } catch (err: any) {
      toast.error("ڈیلیٹ کرنے میں خرابی: " + err.message);
    }
  };

  return (
    <div className="space-y-6 font-sans animate-in fade-in duration-500 pb-16">
      <ShowroomOfflineBar onSyncSuccess={fetchData} />
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-sm">
              <Landmark size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>Showroom Investors & Capital Partners</span>
                <span className="font-urdu text-base text-amber-700 font-bold">(انویسٹرز و شراکت دار)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-urdu">
                انویسٹرز و کاروباری شراکت دار، نفع و نقصان میں شراکت، سرمایہ انویسٹمنٹ اور کھاتہ لیجر
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="font-bold text-xs border-slate-200 h-9 rounded-xl gap-1.5"
          >
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            <span>ریفریش</span>
          </Button>

          <Button
            onClick={() => {
              setDepositForm({
                investor_id: investors[0]?.id || "",
                vehicle_id: "",
                amount: 0,
                account_id: accounts[0]?.id || "",
                date: new Date().toISOString().split("T")[0],
                description: "",
              });
              setIsDepositModalOpen(true);
            }}
            variant="outline"
            size="sm"
            className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs h-9 rounded-xl flex items-center gap-1.5"
          >
            <ArrowDownLeft size={15} />
            <span>سرمایہ ڈپازٹ</span>
          </Button>

          <Button
            onClick={() => {
              setPayoutForm({
                investor_id: investors[0]?.id || "",
                tx_type: "profit_payout",
                amount: 0,
                account_id: accounts[0]?.id || "",
                date: new Date().toISOString().split("T")[0],
                description: "",
              });
              setIsPayoutModalOpen(true);
            }}
            variant="outline"
            size="sm"
            className="border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 font-bold text-xs h-9 rounded-xl flex items-center gap-1.5"
          >
            <ArrowUpRight size={15} />
            <span>منافع / سرمایہ ادائیگی</span>
          </Button>

          <Button
            onClick={() => {
              setEditingInvestor(null);
              setInvestorFormData(emptyInvestorForm);
              setIsInvestorModalOpen(true);
            }}
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-9 rounded-xl shadow-sm flex items-center gap-1.5"
          >
            <PlusCircle size={15} />
            <span>نیا انویسٹر شامل کریں</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards (Matching Light Theme) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-500">Total Investors</span>
            <User size={16} className="text-amber-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-slate-900">{stats.totalInvestors}</p>
          <p className="text-[10.5px] text-amber-700 font-bold font-urdu mt-0.5">کل رجسٹرڈ سرمایہ کار</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-500">Injected Capital</span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-600">{formatPKR(stats.totalInvested)}</p>
          <p className="text-[10.5px] text-emerald-700 font-bold font-urdu mt-0.5">کل جمع شدہ سرمایہ</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-500">Profit Earned</span>
            <Sparkles size={16} className="text-yellow-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-yellow-600">{formatPKR(stats.totalProfitDistributed)}</p>
          <p className="text-[10.5px] text-yellow-700 font-bold font-urdu mt-0.5">حاصل شدہ منافع</p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10.5px] uppercase font-bold text-slate-500">Net Khata Balance</span>
            <Wallet size={16} className="text-blue-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-blue-600">{formatPKR(stats.netPayableBalance)}</p>
          <p className="text-[10.5px] text-blue-700 font-bold font-urdu mt-0.5">موجودہ واجب الادا کھاتہ</p>
        </div>
      </div>

      {/* Filter & Navigation Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/70">
            <button
              onClick={() => setActiveTab("investors")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "investors"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User size={14} />
              <span>انویسٹرز لسٹ ({investors.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("vehicles")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "vehicles"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Car size={14} />
              <span>شراکت دار گاڑیاں ({investorVehicles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("profit_sharing")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "profit_sharing"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Scale size={14} />
              <span>منافع کی تقسیم و کیلکولیٹر</span>
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "ledger"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText size={14} />
              <span>ٹرانزیکشن لاگ ({transactions.length})</span>
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="نام، فون، شناختی کارڈ یا گاڑی سرچ کریں..."
              className="pl-9 bg-slate-50 border-slate-200 rounded-xl text-xs h-9 focus-visible:ring-amber-500 text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Main Content View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 size={32} className="animate-spin text-amber-500" />
          <span className="text-sm font-semibold text-slate-600">انویسٹرز کا ریکارڈ لوڈ ہو رہا ہے...</span>
        </div>
      ) : activeTab === "investors" ? (
        /* TAB 1: INVESTORS LIST */
        <div>
          {filteredInvestors.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center shadow-xs">
              <Landmark size={44} className="mx-auto text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-slate-800">کوئی انویسٹر موجود نہیں ہے</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-urdu">
                نیا انویسٹر شامل کرنے کے لیے اوپر موجود "نیا انویسٹر شامل کریں" کے بٹن پر کلک کریں۔
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInvestors.map((inv) => (
                <motion.div
                  key={inv.id}
                  whileHover={{ y: -2 }}
                  className="bg-white border border-slate-200/90 hover:border-amber-400/80 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                          <span>{inv.name}</span>
                          {inv.status === "inactive" && (
                            <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                              غیر فعال
                            </span>
                          )}
                        </h3>
                        {inv.father_name && (
                          <p className="text-xs text-slate-500 font-urdu">ولد: {inv.father_name}</p>
                        )}
                      </div>

                      <span className="text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-xl">
                        {formatInvestorShareBadge(inv.default_share_type, inv.default_share_value)}
                      </span>
                    </div>

                    {/* Contact & CNIC */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate font-mono">{inv.phone}</span>
                      </div>
                      {inv.cnic && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate font-mono">{inv.cnic}</span>
                        </div>
                      )}
                      {inv.city && (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Building2 size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{inv.city} {inv.address ? `• ${inv.address}` : ""}</span>
                        </div>
                      )}
                    </div>

                    {/* Financial Figures */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-urdu">کل سرمایہ (Invested)</span>
                        <span className="text-xs font-black text-emerald-700">{formatPKR(inv.total_invested || 0)}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-urdu">کل منافع (Profit)</span>
                        <span className="text-xs font-black text-yellow-700">{formatPKR(inv.total_profit_earned || 0)}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-urdu">کل واپسی (Withdrawn)</span>
                        <span className="text-xs font-black text-rose-700">{formatPKR(inv.total_withdrawn || 0)}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block font-urdu">موجودہ بیلنس (Balance)</span>
                        <span className="text-xs font-black text-blue-700">{formatPKR(inv.current_balance || 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
                    <Button
                      onClick={() => openInvestorLedger(inv)}
                      size="sm"
                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 flex-1 h-8"
                    >
                      <FileText size={14} />
                      <span>کھاتہ لیجر</span>
                    </Button>

                    <button
                      onClick={() => {
                        setEditingInvestor(inv);
                        setInvestorFormData({
                          name: inv.name,
                          father_name: inv.father_name || "",
                          phone: inv.phone,
                          whatsapp: inv.whatsapp || "",
                          cnic: inv.cnic || "",
                          city: inv.city || "Lahore",
                          address: inv.address || "",
                          default_share_type: inv.default_share_type || "profit_only",
                          default_share_value: inv.default_share_value || 50,
                          initial_capital: 0,
                          account_id: "",
                          notes: inv.notes || "",
                          status: inv.status || "active",
                        });
                        setIsInvestorModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg transition"
                      title="Edit Investor"
                    >
                      <Edit size={16} />
                    </button>

                    <button
                      onClick={() => handleDeleteInvestor(inv.id, inv.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Delete Investor"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === "vehicles" ? (
        /* TAB 2: JOINT VEHICLE INVESTMENTS */
        <div className="space-y-4">
          {investorVehicles.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-12 text-center shadow-xs">
              <Car size={44} className="mx-auto text-slate-400 mb-3" />
              <h3 className="text-base font-bold text-slate-800">کوئی مشترکہ سرمایہ کاری والی گاڑی نہیں ملی</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-urdu">
                گاڑی خریدتے وقت انویسٹر شراکت داری منتخب کرنے سے وہ اس فہرست میں ظاہر ہو جائے گی۔
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {investorVehicles.map((v) => {
                const inv = investors.find((i) => i.id === v.investor_id);
                const isSold = v.status === "sold";

                return (
                  <div
                    key={v.id}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-slate-900">
                            {v.make} {v.model} ({v.year || "N/A"})
                          </h4>
                          <p className="text-xs text-slate-500 font-mono">
                            پلیٹ: {v.is_applied_for ? "Applied For" : v.plate_number || "N/A"}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                            isSold ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isSold ? "فروخت شدہ (Sold)" : "اسٹاک میں موجود"}
                        </span>
                      </div>

                      {/* Investor Partner Details */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-urdu">شراکت دار (Investor):</span>
                          <span className="font-bold text-amber-900">{inv?.name || "نامعلوم انویسٹر"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-urdu">شراکت کی قسم:</span>
                          <span className="font-semibold text-slate-800">
                            {formatInvestorShareBadge(v.investor_share_type, v.investor_share_value)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-urdu">انویسٹر کا لگایا گیا سرمایہ:</span>
                          <span className="font-bold text-emerald-700">
                            {formatPKR(v.investor_investment_amount || v.purchase_cost || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Pricing Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-urdu block">خریدی لاگت (Cost)</span>
                          <span className="font-bold text-slate-900">{formatPKR(v.purchase_cost || 0)}</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-500 font-urdu block">
                            {isSold ? "فروخت قیمت" : "کیش ریٹیل قیمت"}
                          </span>
                          <span className="font-bold text-amber-800">
                            {formatPKR(v.sold_price || v.cash_price || v.price || 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      {isSold ? (
                        v.investor_profit_settled ? (
                          <div className="text-xs text-emerald-700 font-semibold flex items-center justify-between">
                            <span>منافع سیٹل ہو چکا ہے ✓</span>
                            <span className="font-bold">{formatPKR(v.investor_profit_amount || 0)}</span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => openDistributeForVehicle(v)}
                            size="sm"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 h-8"
                          >
                            <Scale size={14} />
                            <span>منافع کا حساب و تقسیم کریں</span>
                          </Button>
                        )
                      ) : (
                        <div className="text-[11px] text-slate-500 text-center py-1 font-urdu">
                          گاڑی بکنے کے بعد منافع کا آٹو حساب دستیاب ہوگا
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "profit_sharing" ? (
        /* TAB 3: LIVE PROFIT SHARING & CALCULATOR */
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale className="text-amber-600" size={20} />
                <span>Showroom Vehicle Profit Sharing Calculator</span>
              </h3>
              <p className="text-xs text-slate-500 font-urdu mt-0.5">
                فروخت شدہ گاڑی کا منافع یا نقصان انویسٹر اور شوروم کے درمیان فی الفور تقسیم کریں
              </p>
            </div>

            <Button
              onClick={() => {
                setDistributeForm({
                  vehicle_id: vehicles[0]?.id || "",
                  investor_id: investors[0]?.id || "",
                  purchase_cost: vehicles[0]?.purchase_cost || 0,
                  sold_price: vehicles[0]?.sold_price || vehicles[0]?.cash_price || 0,
                  share_type: "profit_only",
                  share_value: 50,
                  payout_mode: "credit_khata",
                  account_id: accounts[0]?.id || "",
                  date: new Date().toISOString().split("T")[0],
                  notes: "",
                });
                setIsDistributeModalOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2"
            >
              <PlusCircle size={15} />
              <span>نئی تقسیم ریکارڈ کریں</span>
            </Button>
          </div>

          {/* Settle-ready sold vehicles */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Recent Sold Vehicles Ready for Settlement (فروخت شدہ گاڑیاں)
            </h4>

            {vehicles.filter((v) => v.status === "sold").length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                ابھی تک کوئی گاڑی فروخت نہیں ہوئی ہے
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                {vehicles
                  .filter((v) => v.status === "sold")
                  .map((veh) => {
                    const inv = investors.find((i) => i.id === veh.investor_id);
                    const netP = Number(veh.sold_price || 0) - Number(veh.purchase_cost || 0);

                    return (
                      <div
                        key={veh.id}
                        className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-white transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {veh.make} {veh.model} ({veh.year || "N/A"})
                            </span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                              {veh.is_applied_for ? "Applied For" : veh.plate_number || "No Plate"}
                            </span>
                            {inv && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-bold">
                                Partner: {inv.name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                            <span>خریدی لاگت: {formatPKR(veh.purchase_cost || 0)}</span>
                            <span>فروخت قیمت: {formatPKR(veh.sold_price || 0)}</span>
                            <span className={netP >= 0 ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                              خالص منافع/نقصان: {formatPKR(netP)}
                            </span>
                          </div>
                        </div>

                        <div>
                          {veh.investor_profit_settled ? (
                            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl inline-block">
                              سیٹل ہو چکا ہے ({formatPKR(veh.investor_profit_amount || 0)}) ✓
                            </span>
                          ) : (
                            <Button
                              onClick={() => openDistributeForVehicle(veh)}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
                            >
                              منافع تقسیم کریں
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 4: TRANSACTIONS / LEDGER */
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">تمام انویسٹمنٹ ٹرانزیکشنز و کھاتہ لاگ</h3>
            <span className="text-xs text-slate-500 font-bold">{transactions.length} ٹرانزیکشنز</span>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">ابھی تک کوئی ٹرانزیکشن موجود نہیں ہے</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">تاریخ</th>
                    <th className="p-3">انویسٹر</th>
                    <th className="p-3">نوعیت (Type)</th>
                    <th className="p-3">گاڑی / تفصیل</th>
                    <th className="p-3 text-right">رقم (Amount)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {transactions.map((tx) => {
                    const isCredit =
                      tx.tx_type === "capital_inflow" ||
                      tx.tx_type === "profit_share" ||
                      tx.tx_type === "vehicle_investment";

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 font-medium">
                        <td className="p-3 whitespace-nowrap text-slate-500 font-mono">{tx.date}</td>
                        <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                          {tx.investor?.name || "Investor"}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              tx.tx_type === "capital_inflow"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : tx.tx_type === "profit_share"
                                ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                                : tx.tx_type === "profit_payout"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : tx.tx_type === "capital_withdrawal"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {tx.tx_type === "capital_inflow"
                              ? "سرمایہ ڈپازٹ"
                              : tx.tx_type === "profit_share"
                              ? "منافع کریڈٹ"
                              : tx.tx_type === "profit_payout"
                              ? "منافع ادائیگی"
                              : tx.tx_type === "capital_withdrawal"
                              ? "سرمایہ واپسی"
                              : "گاڑی انویسٹمنٹ"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 max-w-md truncate">{tx.description || "-"}</td>
                        <td
                          className={`p-3 text-right font-black whitespace-nowrap ${
                            isCredit ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {isCredit ? "+" : "-"} {formatPKR(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* -------------------- LIGHT THEME MODALS -------------------- */}

      {/* 1. ADD / EDIT INVESTOR MODAL */}
      <AnimatePresence>
        {isInvestorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <User className="text-amber-400" size={18} />
                  <span>{editingInvestor ? "انویسٹر تبدیل کریں" : "نیا انویسٹر شامل کریں (Add Investor)"}</span>
                </h3>
                <button
                  onClick={() => setIsInvestorModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveInvestor} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      انویسٹر کا پورا نام *
                    </label>
                    <Input
                      value={investorFormData.name}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, name: e.target.value })}
                      placeholder="e.g. ملک ساجد محمود"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">ولدیت (Father Name)</label>
                    <Input
                      value={investorFormData.father_name}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, father_name: e.target.value })}
                      placeholder="e.g. حاجی محمد اشرف"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">فون نمبر *</label>
                    <Input
                      value={investorFormData.phone}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, phone: e.target.value })}
                      placeholder="0300-1234567"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">قومی شناختی کارڈ (CNIC)</label>
                    <Input
                      value={investorFormData.cnic}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, cnic: e.target.value })}
                      placeholder="35201-XXXXXXX-X"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">شہر (City)</label>
                    <Input
                      value={investorFormData.city}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, city: e.target.value })}
                      placeholder="e.g. Lahore"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">واٹس ایپ نمبر</label>
                    <Input
                      value={investorFormData.whatsapp}
                      onChange={(e) => setInvestorFormData({ ...investorFormData, whatsapp: e.target.value })}
                      placeholder="0300-1234567"
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* Profit Sharing Mode Configuration */}
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3">
                  <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase">
                    <Percent size={14} className="text-amber-600" />
                    <span>منافع اور شراکت داری کا فارمولا (Profit Sharing Model)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">شراکت داری کا اصول</label>
                      <select
                        value={investorFormData.default_share_type}
                        onChange={(e) =>
                          setInvestorFormData({
                            ...investorFormData,
                            default_share_type: e.target.value as InvestorShareType,
                          })
                        }
                        className="w-full bg-white border border-amber-300 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                      >
                        <option value="profit_only">صرف منافع میں شراکت (%) - Profit Only</option>
                        <option value="profit_and_loss">نفع اور نقصان دونوں میں شراکت (%) - P&L</option>
                        <option value="fixed_amount">مقررہ منافع فی گاڑی (Fixed Amount Rs)</option>
                        <option value="monthly_roi">ماہانہ فکس فیصد منافع (%) - Monthly ROI</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        {investorFormData.default_share_type === "fixed_amount"
                          ? "مقررہ رقم فی گاڑی (PKR)"
                          : "انویسٹر کا حصہ فیصد (%)"}
                      </label>
                      <Input
                        type="number"
                        value={investorFormData.default_share_value || ""}
                        onChange={(e) =>
                          setInvestorFormData({
                            ...investorFormData,
                            default_share_value: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="50"
                        className="bg-white border-amber-300 text-xs rounded-xl font-bold"
                      />
                    </div>
                  </div>
                </div>

                {!editingInvestor && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 uppercase">ابتدائی سرمایہ ڈپازٹ (اگر ابھی جمع کرایا ہو)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">ابتدائی رقم (PKR)</label>
                        <Input
                          type="number"
                          value={investorFormData.initial_capital || ""}
                          onChange={(e) =>
                            setInvestorFormData({
                              ...investorFormData,
                              initial_capital: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="bg-white border-slate-200 text-xs rounded-xl font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">رقم کس اکاؤنٹ میں وصول ہوئی؟</label>
                        <select
                          value={investorFormData.account_id}
                          onChange={(e) => setInvestorFormData({ ...investorFormData, account_id: e.target.value })}
                          className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                        >
                          <option value="">اکاؤنٹ منتخب نہ کریں (صرف کھاتہ)</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (بیلنس: {formatPKR(acc.current_balance || 0)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">پتہ و ریمارکس</label>
                  <textarea
                    value={investorFormData.address}
                    onChange={(e) => setInvestorFormData({ ...investorFormData, address: e.target.value })}
                    rows={2}
                    placeholder="انویسٹر کا پتہ یا اضافی شرائط..."
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-xl p-2.5"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsInvestorModalOpen(false)}
                    className="text-slate-500 text-xs"
                  >
                    منسوخ کریں
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSavingInvestor}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 rounded-xl shadow-sm"
                  >
                    {isSavingInvestor ? <Loader2 size={16} className="animate-spin" /> : "محفوظ کریں"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. CAPITAL DEPOSIT MODAL */}
      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ArrowDownLeft className="text-emerald-400" size={18} />
                  <span>انویسٹمنٹ و سرمایہ ڈپازٹ (Deposit Capital)</span>
                </h3>
                <button onClick={() => setIsDepositModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleDepositCapital} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">انویسٹر منتخب کریں *</label>
                  <select
                    value={depositForm.investor_id}
                    onChange={(e) => setDepositForm({ ...depositForm, investor_id: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                    required
                  >
                    <option value="">-- انویسٹر سلیکٹ کریں --</option>
                    {investors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.phone}) - بیلنس: {formatPKR(i.current_balance || 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">ڈپازٹ رقم (PKR) *</label>
                    <Input
                      type="number"
                      value={depositForm.amount || ""}
                      onChange={(e) => setDepositForm({ ...depositForm, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="bg-white border-slate-200 text-xs rounded-xl font-bold text-emerald-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">تاریخ</label>
                    <Input
                      type="date"
                      value={depositForm.date}
                      onChange={(e) => setDepositForm({ ...depositForm, date: e.target.value })}
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    گاڑی سے لنک کریں (اگر کسی مخصوص گاڑی کے لیے فنڈ ہے)
                  </label>
                  <select
                    value={depositForm.vehicle_id}
                    onChange={(e) => setDepositForm({ ...depositForm, vehicle_id: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                  >
                    <option value="">جنرل شوروم فنڈ (کسی گاڑی سے منسلک نہیں)</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model} ({v.plate_number || v.chassis_number || "No Plate"}) - لاگت:{" "}
                        {formatPKR(v.purchase_cost || 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    رقم وصولی اکاؤنٹ (Cash / Bank Account)
                  </label>
                  <select
                    value={depositForm.account_id}
                    onChange={(e) => setDepositForm({ ...depositForm, account_id: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                  >
                    <option value="">اکاؤنٹ منتخب نہ کریں (صرف کھاتہ کریڈٹ)</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (بیلنس: {formatPKR(acc.current_balance || 0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">تفصیل / ریمارکس</label>
                  <Input
                    value={depositForm.description}
                    onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
                    placeholder="مثلاً: کیش ڈپازٹ برائے گاڑی فنڈنگ..."
                    className="bg-white border-slate-200 text-xs rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDepositModalOpen(false)}
                    className="text-slate-500 text-xs"
                  >
                    منسوخ کریں
                  </Button>

                  <Button
                    type="submit"
                    disabled={isDepositing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 rounded-xl shadow-sm"
                  >
                    {isDepositing ? <Loader2 size={16} className="animate-spin" /> : "ڈپازٹ ریکارڈ کریں"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. PAYOUT / WITHDRAWAL MODAL */}
      <AnimatePresence>
        {isPayoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ArrowUpRight className="text-rose-400" size={18} />
                  <span>منافع یا سرمایہ کی واپسی و ادائیگی</span>
                </h3>
                <button onClick={() => setIsPayoutModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handlePayout} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">انویسٹر منتخب کریں *</label>
                  <select
                    value={payoutForm.investor_id}
                    onChange={(e) => setPayoutForm({ ...payoutForm, investor_id: e.target.value })}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                    required
                  >
                    <option value="">-- انویسٹر سلیکٹ کریں --</option>
                    {investors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.phone}) - بیلنس: {formatPKR(i.current_balance || 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">ادائیگی کی قسم</label>
                    <select
                      value={payoutForm.tx_type}
                      onChange={(e) =>
                        setPayoutForm({
                          ...payoutForm,
                          tx_type: e.target.value as "profit_payout" | "capital_withdrawal",
                        })
                      }
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                    >
                      <option value="profit_payout">منافع کی ادائیگی (Profit Payout)</option>
                      <option value="capital_withdrawal">سرمایہ واپسی (Capital Return)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">رقم (PKR) *</label>
                    <Input
                      type="number"
                      value={payoutForm.amount || ""}
                      onChange={(e) => setPayoutForm({ ...payoutForm, amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="bg-white border-slate-200 text-xs rounded-xl font-bold text-rose-700"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">کس اکاؤنٹ سے ادا ہوئی؟</label>
                    <select
                      value={payoutForm.account_id}
                      onChange={(e) => setPayoutForm({ ...payoutForm, account_id: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                    >
                      <option value="">اکاؤنٹ منتخب نہ کریں (صرف کھاتہ ڈیبٹ)</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} (بیلنس: {formatPKR(acc.current_balance || 0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">تاریخ</label>
                    <Input
                      type="date"
                      value={payoutForm.date}
                      onChange={(e) => setPayoutForm({ ...payoutForm, date: e.target.value })}
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">تفصیل / چیک نمبر</label>
                  <Input
                    value={payoutForm.description}
                    onChange={(e) => setPayoutForm({ ...payoutForm, description: e.target.value })}
                    placeholder="مثلاً: کیش ادائیگی بذریعہ چیک یا آن لائن..."
                    className="bg-white border-slate-200 text-xs rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="text-slate-500 text-xs"
                  >
                    منسوخ کریں
                  </Button>

                  <Button
                    type="submit"
                    disabled={isPaying}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 rounded-xl shadow-sm"
                  >
                    {isPaying ? <Loader2 size={16} className="animate-spin" /> : "ادائیگی ریکارڈ کریں"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. PROFIT DISTRIBUTION CALCULATOR MODAL */}
      <AnimatePresence>
        {isDistributeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Scale className="text-amber-400" size={18} />
                  <span>گاڑی کے منافع کی تقسیم (Vehicle Profit Sharing)</span>
                </h3>
                <button onClick={() => setIsDistributeModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleDistributeSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">گاڑی منتخب کریں</label>
                    <select
                      value={distributeForm.vehicle_id}
                      onChange={(e) => {
                        const v = vehicles.find((item) => item.id === e.target.value);
                        setDistributeForm({
                          ...distributeForm,
                          vehicle_id: e.target.value,
                          purchase_cost: v?.purchase_cost || distributeForm.purchase_cost,
                          sold_price: v?.sold_price || v?.cash_price || distributeForm.sold_price,
                          investor_id: v?.investor_id || distributeForm.investor_id,
                        });
                      }}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                    >
                      <option value="">-- گاڑی منتخب کریں --</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.make} {v.model} ({v.plate_number || v.chassis_number || "No Plate"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">انویسٹر منتخب کریں *</label>
                    <select
                      value={distributeForm.investor_id}
                      onChange={(e) => {
                        const inv = investors.find((item) => item.id === e.target.value);
                        setDistributeForm({
                          ...distributeForm,
                          investor_id: e.target.value,
                          share_type: inv?.default_share_type || distributeForm.share_type,
                          share_value: inv?.default_share_value ?? distributeForm.share_value,
                        });
                      }}
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                      required
                    >
                      <option value="">-- انویسٹر سلیکٹ کریں --</option>
                      {investors.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">خریدی لاگت (Purchase Cost)</label>
                    <Input
                      type="number"
                      value={distributeForm.purchase_cost || ""}
                      onChange={(e) =>
                        setDistributeForm({
                          ...distributeForm,
                          purchase_cost: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">فروخت قیمت (Sold Price)</label>
                    <Input
                      type="number"
                      value={distributeForm.sold_price || ""}
                      onChange={(e) =>
                        setDistributeForm({
                          ...distributeForm,
                          sold_price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-white border-slate-200 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">شراکت داری فارمولا</label>
                    <select
                      value={distributeForm.share_type}
                      onChange={(e) =>
                        setDistributeForm({
                          ...distributeForm,
                          share_type: e.target.value as InvestorShareType,
                        })
                      }
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                    >
                      <option value="profit_only">صرف منافع میں شراکت (%)</option>
                      <option value="profit_and_loss">نفع اور نقصان دونوں میں (%)</option>
                      <option value="fixed_amount">مقررہ رقم فی گاڑی (PKR)</option>
                      <option value="monthly_roi">ماہانہ فکس فیصد (%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {distributeForm.share_type === "fixed_amount" ? "رقم (PKR)" : "انویسٹر کا حصہ (%)"}
                    </label>
                    <Input
                      type="number"
                      value={distributeForm.share_value || ""}
                      onChange={(e) =>
                        setDistributeForm({
                          ...distributeForm,
                          share_value: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="bg-white border-slate-200 text-xs rounded-xl font-bold"
                    />
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-urdu">مجموعی خالص منافع / نقصان:</span>
                    <span
                      className={`font-black ${
                        profitShareCalc.isLoss ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {formatPKR(profitShareCalc.netProfit)}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs border-t border-amber-200/70 pt-2">
                    <span className="text-amber-950 font-urdu font-bold">انویسٹر کا حصہ (Investor Share):</span>
                    <span className="font-black text-amber-900">{formatPKR(profitShareCalc.investorProfit)}</span>
                  </div>

                  <div className="flex justify-between text-xs border-t border-amber-200/70 pt-2">
                    <span className="text-slate-600 font-urdu">شوروم کا خالص حصہ (Showroom Net):</span>
                    <span className="font-black text-slate-900">{formatPKR(profitShareCalc.showroomProfit)}</span>
                  </div>
                </div>

                {/* Payout Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">ادائیگی کا طریقہ</label>
                    <select
                      value={distributeForm.payout_mode}
                      onChange={(e) =>
                        setDistributeForm({
                          ...distributeForm,
                          payout_mode: e.target.value as "credit_khata" | "instant_cash",
                        })
                      }
                      className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                    >
                      <option value="credit_khata">انویسٹر کے کھاتے میں منتقل کریں (Credit to Khata)</option>
                      <option value="instant_cash">فوری نقد / آن لائن ادا کریں (Instant Payout)</option>
                    </select>
                  </div>

                  {distributeForm.payout_mode === "instant_cash" && (
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">کس اکاؤنٹ سے رقم ادا کی گئی؟</label>
                      <select
                        value={distributeForm.account_id}
                        onChange={(e) => setDistributeForm({ ...distributeForm, account_id: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl p-2.5"
                      >
                        <option value="">سلیکٹ کریں...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (بیلنس: {formatPKR(acc.current_balance || 0)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDistributeModalOpen(false)}
                    className="text-slate-500 text-xs"
                  >
                    منسوخ کریں
                  </Button>

                  <Button
                    type="submit"
                    disabled={isDistributing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 rounded-xl shadow-sm"
                  >
                    {isDistributing ? <Loader2 size={16} className="animate-spin" /> : "منافع تقسیم کریں"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. DETAILED INVESTOR STATEMENT & PRINT MODAL */}
      <AnimatePresence>
        {isLedgerModalOpen && selectedInvestorForLedger && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-700 rounded-xl">
                    <Landmark size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      انویسٹر کھاتہ و تفصیلی اسٹیٹمنٹ - {selectedInvestorForLedger.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      فون: {selectedInvestorForLedger.phone} | شناختی کارڈ: {selectedInvestorForLedger.cnic || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => window.print()}
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 h-8.5"
                  >
                    <Printer size={14} />
                    <span>پرنٹ اسٹیٹمنٹ</span>
                  </Button>
                  <button onClick={() => setIsLedgerModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="p-6 overflow-y-auto space-y-6" ref={printStatementRef}>
                {/* Print Layout Header */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{shopName || "Showroom"}</h2>
                    <p className="text-slate-500 font-urdu font-bold">انویسٹر اکاؤنٹ لیجر و منافع رپورٹ</p>
                  </div>
                  <div className="text-right space-y-1">
                    <div>
                      <span className="text-slate-500">تاریخ پرنٹ: </span>
                      <span className="font-semibold text-slate-800">{new Date().toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">شراکت داری کا اصول: </span>
                      <span className="text-amber-800 font-bold">
                        {formatInvestorShareBadge(
                          selectedInvestorForLedger.default_share_type,
                          selectedInvestorForLedger.default_share_value
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary Row */}
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-urdu block">کل جمع شدہ سرمایہ</span>
                    <span className="text-sm font-black text-emerald-700">
                      {formatPKR(selectedInvestorForLedger.total_invested || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-urdu block">کل حاصل شدہ منافع</span>
                    <span className="text-sm font-black text-yellow-700">
                      {formatPKR(selectedInvestorForLedger.total_profit_earned || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-urdu block">کل ادا شدہ رقم</span>
                    <span className="text-sm font-black text-rose-700">
                      {formatPKR(selectedInvestorForLedger.total_withdrawn || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-urdu block">موجودہ واجب الادا رقم</span>
                    <span className="text-sm font-black text-blue-700">
                      {formatPKR(selectedInvestorForLedger.current_balance || 0)}
                    </span>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Chronological Ledger Statement (تفصیلی ٹرانزیکشن کھاتہ)
                  </h4>

                  {selectedInvestorTransactions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">کوئی ٹرانزیکشن موجود نہیں ہے</div>
                  ) : (
                    <table className="w-full text-xs text-left border border-slate-200 rounded-2xl overflow-hidden">
                      <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">تاریخ</th>
                          <th className="p-3">نوعیت</th>
                          <th className="p-3">تفصیل / گاڑی</th>
                          <th className="p-3 text-right">جمع (+ Credit)</th>
                          <th className="p-3 text-right">بنام (- Debit)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-slate-700 font-medium">
                        {selectedInvestorTransactions.map((tx) => {
                          const isCredit =
                            tx.tx_type === "capital_inflow" ||
                            tx.tx_type === "profit_share" ||
                            tx.tx_type === "vehicle_investment";

                          return (
                            <tr key={tx.id} className="hover:bg-slate-50">
                              <td className="p-3 text-slate-500 font-mono whitespace-nowrap">{tx.date}</td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="text-[10px] font-bold">
                                  {tx.tx_type === "capital_inflow"
                                    ? "سرمایہ ڈپازٹ"
                                    : tx.tx_type === "profit_share"
                                    ? "منافع کریڈٹ"
                                    : tx.tx_type === "profit_payout"
                                    ? "منافع ادائیگی"
                                    : tx.tx_type === "capital_withdrawal"
                                    ? "سرمایہ واپسی"
                                    : "گاڑی فنڈ"}
                                </span>
                              </td>
                              <td className="p-3 text-slate-800">{tx.description || "-"}</td>
                              <td className="p-3 text-right font-black text-emerald-700 whitespace-nowrap">
                                {isCredit ? formatPKR(tx.amount) : "-"}
                              </td>
                              <td className="p-3 text-right font-black text-rose-700 whitespace-nowrap">
                                {!isCredit ? formatPKR(tx.amount) : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-10 border-t border-slate-200 text-xs text-slate-600 text-center font-bold">
                  <div>
                    <div className="border-t border-dashed border-slate-400 w-48 mx-auto pt-2">
                      دستخط شوروم منیجر / اکاؤنٹنٹ
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-dashed border-slate-400 w-48 mx-auto pt-2">
                      دستخط انویسٹر / شراکت دار
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
