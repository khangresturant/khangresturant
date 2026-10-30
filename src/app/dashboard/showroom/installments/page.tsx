"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Search,
  PlusCircle,
  Trash2,
  Edit,
  Loader2,
  X,
  Phone,
  User,
  CheckCircle,
  Calendar,
  AlertTriangle,
  FileText,
  DollarSign,
  Clock,
  Printer,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Car,
  BadgePercent,
  Check,
  Building,
  Share2,
  Percent,
  Layers,
  MapPin,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import {
  vehicleLabel,
  type ShowroomInstallment,
  type ShowroomInstallmentSchedule,
  type ShowroomVehicle,
  type ShowroomParty,
  loadShowroomOfflineEntities,
  executeShowroomAction,
  isShowroomOffline,
} from "@/lib/showroom-ops";
import { ShowroomDeedPrintModal } from "@/components/showroom/ShowroomDeedPrintModal";
import { ShowroomReceiptModal } from "@/components/showroom/ShowroomReceiptModal";
import { ShowroomOfflineBar } from "@/components/showroom/ShowroomOfflineBar";
import {
  autoPostInstallmentAgreementJournal,
  autoPostInstallmentCollectionJournal,
} from "@/lib/showroom-accounting";

interface CashAccountItem {
  id: string;
  name: string;
  type?: string | null;
  current_balance?: number | null;
}

interface PromiseItem {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  notes: string;
}

interface CustomScheduleRow {
  id: string;
  no: number;
  title: string;
  dueDate: string;
  amount: number;
  isPromise: boolean;
  notes?: string;
}

function formatPKR(val: number | string | null | undefined) {
  const n = Number(val) || 0;
  return "Rs " + n.toLocaleString("en-PK");
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function ShowroomInstallmentsContent() {
  const { shopId, shopName, shopPhone, shopAddress } = useShop();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const paramVehicleId = searchParams.get("vehicleId") || searchParams.get("vehicle_id");
  const [hasHandledUrlParam, setHasHandledUrlParam] = useState(false);

  const [installments, setInstallments] = useState<ShowroomInstallment[]>([]);
  const [vehicles, setVehicles] = useState<ShowroomVehicle[]>([]);
  const [parties, setParties] = useState<ShowroomParty[]>([]);
  const [accounts, setAccounts] = useState<CashAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Agreement creation / editing modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ShowroomInstallment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4>(1);

  // Detail / Collection drawer
  const [selectedPlan, setSelectedPlan] = useState<ShowroomInstallment | null>(null);
  const [schedules, setSchedules] = useState<ShowroomInstallmentSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  // Receive Payment Modal
  const [activeScheduleForPayment, setActiveScheduleForPayment] = useState<ShowroomInstallmentSchedule | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [lateFee, setLateFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [autoSpread, setAutoSpread] = useState<boolean>(true);
  const [manualReceiptNo, setManualReceiptNo] = useState("");
  const [manualBookNo, setManualBookNo] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptTargetSchedule, setReceiptTargetSchedule] = useState<ShowroomInstallmentSchedule | null>(null);
  const [receiptTargetPlan, setReceiptTargetPlan] = useState<ShowroomInstallment | null>(null);
  const [receiptTargetAccountName, setReceiptTargetAccountName] = useState<string>("Cash in Hand");
  const [receiptTargetNextSchedule, setReceiptTargetNextSchedule] = useState<ShowroomInstallmentSchedule | null>(null);

  // Print Deed Modal State
  const [isDeedModalOpen, setIsDeedModalOpen] = useState(false);
  const [deedTargetInstallment, setDeedTargetInstallment] = useState<ShowroomInstallment | null>(null);
  const [deedTargetVehicle, setDeedTargetVehicle] = useState<ShowroomVehicle | null>(null);
  const [deedTargetSchedules, setDeedTargetSchedules] = useState<ShowroomInstallmentSchedule[]>([]);

  // Agreement Form state
  const [formData, setFormData] = useState({
    vehicle_id: "",
    agreement_number: "",
    manual_book_no: "",
    manual_file_no: "",
    party_id: "",
    customer_name: "",
    customer_father_name: "",
    customer_caste: "",
    customer_cnic: "",
    customer_phone: "",
    customer_phone_2: "",
    customer_address: "",
    customer_city: "Lahore",

    guarantor_1_name: "",
    guarantor_1_father_name: "",
    guarantor_1_caste: "",
    guarantor_1_cnic: "",
    guarantor_1_phone: "",
    guarantor_1_relation: "",
    guarantor_1_address: "",

    guarantor_2_name: "",
    guarantor_2_father_name: "",
    guarantor_2_caste: "",
    guarantor_2_cnic: "",
    guarantor_2_phone: "",
    guarantor_2_relation: "",
    guarantor_2_address: "",

    cash_price: 1200000,
    markup_profit: 300000,
    total_price: 1500000,
    down_payment: 300000,
    deposit_account_id: "",
    total_installments: 12,
    frequency: "monthly" as "monthly" | "bi-monthly" | "weekly",
    start_date: new Date().toISOString().split("T")[0],
    first_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],

    witness_1_name: "",
    witness_1_cnic: "",
    witness_1_phone: "",
    witness_2_name: "",
    witness_2_cnic: "",
    witness_2_phone: "",
    notes: "",
  });

  // Promises (وعدہ ادائیگی / یکمشت رقم) Builder State
  const [promises, setPromises] = useState<PromiseItem[]>([]);

  // Custom Editable Schedule Rows State
  const [customSchedules, setCustomSchedules] = useState<CustomScheduleRow[]>([]);

  // Total Promises Amount
  const totalPromisesAmount = useMemo(() => {
    return promises.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [promises]);

  // Net Remaining after Down Payment & Promises
  const totalGrossFinanced = Number(formData.total_price) || 0;
  const downPaymentAmount = Number(formData.down_payment) || 0;
  const netRemainingAfterAdvance = Math.max(0, totalGrossFinanced - downPaymentAmount);
  const netForRegularInstallments = Math.max(0, netRemainingAfterAdvance - totalPromisesAmount);

  const calculatedMonthly = formData.total_installments > 0
    ? Math.round(netForRegularInstallments / Math.max(1, Number(formData.total_installments)))
    : 0;

  // Function to regenerate schedules from form data + promises
  const buildInitialScheduleList = () => {
    const list: CustomScheduleRow[] = [];
    const baseDate = new Date(formData.first_due_date || Date.now());
    const count = Math.max(1, Number(formData.total_installments) || 12);
    const monthlyAmt = count > 0 ? Math.floor(netForRegularInstallments / count) : 0;
    const remainder = netForRegularInstallments - (monthlyAmt * count);

    let scheduleNoCounter = 1;

    // 1. Add Regular Installments
    for (let i = 1; i <= count; i++) {
      const d = new Date(baseDate);
      if (formData.frequency === "weekly") {
        d.setDate(d.getDate() + (i - 1) * 7);
      } else if (formData.frequency === "bi-monthly") {
        d.setDate(d.getDate() + (i - 1) * 15);
      } else {
        d.setMonth(d.getMonth() + (i - 1));
      }

      const isLast = i === count;
      const amt = isLast ? monthlyAmt + remainder : monthlyAmt;

      list.push({
        id: `reg-${i}-${Date.now()}`,
        no: scheduleNoCounter++,
        title: `ماہوار قسط #${i}`,
        dueDate: d.toISOString().split("T")[0],
        amount: amt,
        isPromise: false,
      });
    }

    // 2. Add Promises (وعدہ ادائیگیاں)
    promises.forEach((p, idx) => {
      list.push({
        id: p.id || `prom-${idx}-${Date.now()}`,
        no: scheduleNoCounter++,
        title: p.title || `وعدہ ادائیگی #${idx + 1}`,
        dueDate: p.due_date || new Date().toISOString().split("T")[0],
        amount: Number(p.amount) || 0,
        isPromise: true,
        notes: p.notes,
      });
    });

    // Sort by Due Date
    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    // Re-index schedule numbers
    list.forEach((item, index) => {
      item.no = index + 1;
    });

    return list;
  };

  // Sync custom schedules when parameters change if in step 1-3 or when switching to step 4
  useEffect(() => {
    if (formStep === 4 && customSchedules.length === 0) {
      setCustomSchedules(buildInitialScheduleList());
    }
  }, [formStep]);

  // Recalculate and balance custom schedules
  const handleAutoBalanceCustomSchedules = () => {
    const regularRows = customSchedules.filter((s) => !s.isPromise);
    const promiseRows = customSchedules.filter((s) => s.isPromise);
    const currentPromiseTotal = promiseRows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const targetRegularSum = Math.max(0, netRemainingAfterAdvance - currentPromiseTotal);

    if (regularRows.length === 0) {
      toast.info("No regular installment rows found to balance.");
      return;
    }

    const perRow = Math.floor(targetRegularSum / regularRows.length);
    const rem = targetRegularSum - (perRow * regularRows.length);

    const updated = customSchedules.map((row) => {
      if (row.isPromise) return row;
      const regularIndex = regularRows.findIndex((r) => r.id === row.id);
      const isLast = regularIndex === regularRows.length - 1;
      return {
        ...row,
        amount: perRow + (isLast ? rem : 0),
      };
    });

    setCustomSchedules(updated);
    toast.success(`بقیہ ${formatPKR(targetRegularSum)} کو تمام ${regularRows.length} اقساط میں برابر تقسیم کر دیا گیا!`);
  };

  // Add / Remove Promises
  const handleAddPromise = () => {
    if (promises.length >= 4) {
      toast.error("زیادہ سے زیادہ 4 وعدہ ادائیگیاں شامل کی جا سکتی ہیں۔");
      return;
    }
    const defaultDate = new Date(Date.now() + (promises.length + 1) * 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const newP: PromiseItem = {
      id: `prom-${Date.now()}`,
      title: promises.length === 0 ? "پہلا وعدہ / یکمشت رقم" : "دوسرا وعدہ / یکمشت رقم",
      amount: 100000,
      due_date: defaultDate,
      notes: "",
    };
    const nextPromises = [...promises, newP];
    setPromises(nextPromises);
  };

  const handleRemovePromise = (index: number) => {
    const nextPromises = promises.filter((_, idx) => idx !== index);
    setPromises(nextPromises);
  };

  const handleUpdatePromise = (index: number, field: keyof PromiseItem, value: any) => {
    const nextPromises = [...promises];
    nextPromises[index] = { ...nextPromises[index], [field]: value };
    setPromises(nextPromises);
  };

  // Load installments, vehicles, parties, and cash/bank accounts
  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const [offVehicles, offInst, offParties, offAccounts] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomInstallment>("showroom_installments", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
        ]);
        setVehicles(offVehicles);
        setInstallments(offInst);
        setParties(offParties);
        setAccounts(offAccounts);
        setLoading(false);
        return;
      }

      const [vRes, iRes, pRes, aRes] = await Promise.all([
        supabase
          .from("showroom_vehicles")
          .select("*")
          .eq("shop_id", shopId)
          .order("make"),
        supabase
          .from("showroom_installments")
          .select(`
            *,
            showroom_vehicles ( id, make, model, year, plate_number, is_applied_for, color, price, chassis_number, engine_number, photos )
          `)
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
        supabase
          .from("showroom_parties")
          .select("*")
          .eq("shop_id", shopId)
          .order("name"),
        supabase
          .from("cash_accounts")
          .select("id, name, type, current_balance")
          .eq("shop_id", shopId)
          .order("name"),
      ]);

      if (vRes.data) {
        setVehicles(vRes.data as ShowroomVehicle[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_vehicles", (vRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (iRes.data) {
        setInstallments(iRes.data as ShowroomInstallment[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_installments", (iRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (pRes.data) {
        setParties(pRes.data as ShowroomParty[]);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_parties", (pRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (aRes.data) {
        setAccounts(aRes.data as CashAccountItem[]);
      }
    } catch (err: any) {
      try {
        const [offVehicles, offInst, offParties, offAccounts] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomInstallment>("showroom_installments", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
        ]);
        if (offInst.length > 0 || offVehicles.length > 0) {
          setVehicles(offVehicles);
          setInstallments(offInst);
          setParties(offParties);
          setAccounts(offAccounts);
        } else {
          toast.error(err.message || "Failed to load installment agreements");
        }
      } catch {
        toast.error(err.message || "Failed to load installment agreements");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [shopId]);

  // Handle URL query parameter ?vehicleId=... or ?vehicle_id=...
  useEffect(() => {
    if (paramVehicleId && vehicles.length > 0 && !hasHandledUrlParam) {
      const selected = vehicles.find((v) => v.id === paramVehicleId);
      if (selected) {
        const cPrice = Number(selected.cash_price || selected.price) || 0;
        const instPrice = Number(selected.installment_price) || Math.round(cPrice * 1.25);
        const profit = Math.max(0, instPrice - cPrice);
        const defaultDown = Math.round(instPrice * 0.2);

        setFormData((prev) => ({
          ...prev,
          vehicle_id: paramVehicleId,
          agreement_number: prev.agreement_number || generateAgreementNumber(),
          cash_price: cPrice,
          markup_profit: profit,
          total_price: instPrice || cPrice,
          down_payment: defaultDown,
        }));
        setPromises([]);
        setCustomSchedules([]);
        setIsNewModalOpen(true);
        setFormStep(1);
        setHasHandledUrlParam(true);
      }
    }
  }, [paramVehicleId, vehicles, hasHandledUrlParam]);

  // Load schedules when an installment plan is selected
  const loadPlanSchedules = async (planId: string) => {
    setSchedulesLoading(true);
    try {
      if (isShowroomOffline()) {
        const offSchedules = await loadShowroomOfflineEntities<ShowroomInstallmentSchedule>(
          "showroom_installment_schedules",
          shopId!
        );
        const matched = offSchedules
          .filter((s) => s.installment_id === planId)
          .sort((a, b) => Number(a.installment_no) - Number(b.installment_no));
        setSchedules(matched);
        setSchedulesLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("showroom_installment_schedules")
        .select("*")
        .eq("installment_id", planId)
        .order("installment_no", { ascending: true });

      if (error) throw error;
      const loaded = (data as ShowroomInstallmentSchedule[]) || [];
      setSchedules(loaded);

      import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
        putManyOfflineData(
          "showroom_installment_schedules",
          loaded.map((r) => ({ ...r, shopId, _shop_id: shopId }))
        ).catch(() => {});
      });
    } catch (err: any) {
      try {
        const offSchedules = await loadShowroomOfflineEntities<ShowroomInstallmentSchedule>(
          "showroom_installment_schedules",
          shopId!
        );
        const matched = offSchedules
          .filter((s) => s.installment_id === planId)
          .sort((a, b) => Number(a.installment_no) - Number(b.installment_no));
        setSchedules(matched);
      } catch {
        toast.error("Failed to load installment schedule");
      }
    } finally {
      setSchedulesLoading(false);
    }
  };

  const openPlanDetails = (plan: ShowroomInstallment) => {
    setSelectedPlan(plan);
    loadPlanSchedules(plan.id);
  };

  const handleOpenReceipt = (sched: ShowroomInstallmentSchedule, plan: ShowroomInstallment) => {
    setReceiptTargetSchedule(sched);
    setReceiptTargetPlan(plan);
    const chosenAcc = accounts.find((a) => a.id === selectedAccountId)?.name || "Cash / Counter";
    setReceiptTargetAccountName(chosenAcc);
    const next = schedules.find((s) => s.installment_no === sched.installment_no + 1) || null;
    setReceiptTargetNextSchedule(next);
    setIsReceiptModalOpen(true);
  };

  const handleAutoRebalanceAllSchedules = async (plan: ShowroomInstallment) => {
    if (!plan || !shopId) return;
    try {
      let allSchedules: ShowroomInstallmentSchedule[] = [];
      if (isShowroomOffline()) {
        const off = await loadShowroomOfflineEntities<ShowroomInstallmentSchedule>("showroom_installment_schedules", shopId);
        allSchedules = off.filter((s) => s.installment_id === plan.id).sort((a, b) => Number(a.installment_no) - Number(b.installment_no));
      } else {
        const { data: currentSchedules, error } = await supabase
          .from("showroom_installment_schedules")
          .select("*")
          .eq("installment_id", plan.id)
          .order("installment_no", { ascending: true });

        if (error) throw error;
        allSchedules = (currentSchedules as ShowroomInstallmentSchedule[]) || [];
      }

      // 2. Compute total paid on schedules + advance
      const totalPaidSchedules = allSchedules.reduce((sum, s) => sum + (Number(s.paid_amount) || 0), 0);
      const totalFinanced = Number(plan.total_price) || 0;
      const downPayment = Number(plan.down_payment) || 0;
      const totalCollected = downPayment + totalPaidSchedules;
      const netRemaining = Math.max(0, totalFinanced - totalCollected);

      // 3. Find unpaid / future schedules
      const unpaidList = allSchedules.filter((s) => s.status !== "paid" || Number(s.paid_amount) === 0);

      if (unpaidList.length === 0) {
        toast.info("All installments for this plan are already completed!");
        return;
      }

      const perMonth = Math.floor(netRemaining / unpaidList.length);
      const remainder = netRemaining - (perMonth * unpaidList.length);

      for (let i = 0; i < unpaidList.length; i++) {
        const s = unpaidList[i];
        const isLast = i === unpaidList.length - 1;
        const newDue = perMonth + (isLast ? remainder : 0);

        await executeShowroomAction({
          table: "showroom_installment_schedules",
          action: "update",
          payload: {
            id: s.id,
            due_amount: newDue,
            status: Number(s.paid_amount) >= newDue && newDue > 0 ? "paid" : "unpaid",
          },
          shopId,
        });
      }

      // Mark any previously paid schedules as 'paid'
      for (const s of allSchedules) {
        if (s.status === "partial" && Number(s.paid_amount) > 0 && !unpaidList.some((u) => u.id === s.id)) {
          await executeShowroomAction({
            table: "showroom_installment_schedules",
            action: "update",
            payload: {
              id: s.id,
              due_amount: Number(s.paid_amount),
              status: "paid",
            },
            shopId,
          });
        }
      }

      // 4. Update parent agreement record
      await executeShowroomAction({
        table: "showroom_installments",
        action: "update",
        payload: {
          id: plan.id,
          total_paid: totalCollected,
          remaining_balance: netRemaining,
          status: netRemaining <= 0 ? "completed" : "active",
        },
        shopId,
      });

      toast.success(`Successfully divided ${formatPKR(netRemaining)} across remaining ${unpaidList.length} installments!`);
      if (selectedPlan && selectedPlan.id === plan.id) {
        setSelectedPlan((prev) => (prev ? {
          ...prev,
          total_paid: totalCollected,
          remaining_balance: netRemaining,
          status: netRemaining <= 0 ? "completed" : "active",
        } : null));
      }
      await loadPlanSchedules(plan.id);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to rebalance schedules: " + err.message);
    }
  };

  const handleOpenDeedModal = async (plan: ShowroomInstallment) => {
    setDeedTargetInstallment(plan);
    const v = plan.showroom_vehicles || vehicles.find((x) => x.id === plan.vehicle_id) || null;
    setDeedTargetVehicle(v as ShowroomVehicle);

    // Fetch schedules if not loaded
    if (isShowroomOffline()) {
      const offSchedules = await loadShowroomOfflineEntities<ShowroomInstallmentSchedule>(
        "showroom_installment_schedules",
        shopId!
      );
      const matched = offSchedules
        .filter((s) => s.installment_id === plan.id)
        .sort((a, b) => Number(a.installment_no) - Number(b.installment_no));
      setDeedTargetSchedules(matched);
    } else {
      const { data } = await supabase
        .from("showroom_installment_schedules")
        .select("*")
        .eq("installment_id", plan.id)
        .order("installment_no", { ascending: true });

      setDeedTargetSchedules((data as ShowroomInstallmentSchedule[]) || []);
    }
    setIsDeedModalOpen(true);
  };

  // Generate agreement number helper
  const generateAgreementNumber = () => {
    const prefix = "AGR-SHW";
    const rnd = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(2, 7).replace("-", "");
    return `${prefix}-${dateStr}-${rnd}`;
  };

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      vehicle_id: "",
      agreement_number: generateAgreementNumber(),
      manual_book_no: "",
      manual_file_no: "",
      party_id: "",
      customer_name: "",
      customer_father_name: "",
      customer_caste: "",
      customer_cnic: "",
      customer_phone: "",
      customer_phone_2: "",
      customer_address: "",
      customer_city: "Lahore",

      guarantor_1_name: "",
      guarantor_1_father_name: "",
      guarantor_1_caste: "",
      guarantor_1_cnic: "",
      guarantor_1_phone: "",
      guarantor_1_relation: "",
      guarantor_1_address: "",

      guarantor_2_name: "",
      guarantor_2_father_name: "",
      guarantor_2_caste: "",
      guarantor_2_cnic: "",
      guarantor_2_phone: "",
      guarantor_2_relation: "",
      guarantor_2_address: "",

      cash_price: 1200000,
      markup_profit: 300000,
      total_price: 1500000,
      down_payment: 300000,
      deposit_account_id: accounts.length > 0 ? accounts[0].id : "",
      total_installments: 12,
      frequency: "monthly",
      start_date: new Date().toISOString().split("T")[0],
      first_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],

      witness_1_name: "",
      witness_1_cnic: "",
      witness_1_phone: "",
      witness_2_name: "",
      witness_2_cnic: "",
      witness_2_phone: "",
      notes: "",
    });
    setPromises([]);
    setCustomSchedules([]);
    setFormStep(1);
    setIsNewModalOpen(true);
  };

  const handleOpenEditModal = async (plan: ShowroomInstallment) => {
    setEditingPlan(plan);
    setFormData({
      vehicle_id: plan.vehicle_id || "",
      agreement_number: plan.agreement_number || "",
      manual_book_no: plan.manual_book_no || "",
      manual_file_no: plan.manual_file_no || "",
      party_id: plan.party_id || "",
      customer_name: plan.customer_name || "",
      customer_father_name: plan.customer_father_name || "",
      customer_caste: plan.customer_caste || "",
      customer_cnic: plan.customer_cnic || "",
      customer_phone: plan.customer_phone || "",
      customer_phone_2: plan.customer_phone_2 || "",
      customer_address: plan.customer_address || "",
      customer_city: plan.customer_city || "Lahore",

      guarantor_1_name: plan.guarantor_1_name || "",
      guarantor_1_father_name: plan.guarantor_1_father_name || "",
      guarantor_1_caste: plan.guarantor_1_caste || "",
      guarantor_1_cnic: plan.guarantor_1_cnic || "",
      guarantor_1_phone: plan.guarantor_1_phone || "",
      guarantor_1_relation: plan.guarantor_1_relation || "",
      guarantor_1_address: plan.guarantor_1_address || "",

      guarantor_2_name: plan.guarantor_2_name || "",
      guarantor_2_father_name: plan.guarantor_2_father_name || "",
      guarantor_2_caste: plan.guarantor_2_caste || "",
      guarantor_2_cnic: plan.guarantor_2_cnic || "",
      guarantor_2_phone: plan.guarantor_2_phone || "",
      guarantor_2_relation: plan.guarantor_2_relation || "",
      guarantor_2_address: plan.guarantor_2_address || "",

      cash_price: Number(plan.cash_price) || 0,
      markup_profit: Number(plan.markup_profit) || 0,
      total_price: Number(plan.total_price) || 0,
      down_payment: Number(plan.down_payment) || 0,
      deposit_account_id: "",
      total_installments: Number(plan.total_installments) || 12,
      frequency: (plan.frequency as any) || "monthly",
      start_date: plan.start_date || new Date().toISOString().split("T")[0],
      first_due_date: plan.first_due_date || new Date().toISOString().split("T")[0],

      witness_1_name: plan.witness_1_name || "",
      witness_1_cnic: plan.witness_1_cnic || "",
      witness_1_phone: plan.witness_1_phone || "",
      witness_2_name: plan.witness_2_name || "",
      witness_2_cnic: plan.witness_2_cnic || "",
      witness_2_phone: plan.witness_2_phone || "",
      notes: plan.notes || "",
    });

    const rawPromises = plan.promises && Array.isArray(plan.promises) ? (plan.promises as PromiseItem[]) : [];
    setPromises(rawPromises);

    try {
      let currentSchedules: ShowroomInstallmentSchedule[] = [];
      if (isShowroomOffline()) {
        const offSchedules = await loadShowroomOfflineEntities<ShowroomInstallmentSchedule>(
          "showroom_installment_schedules",
          shopId!
        );
        currentSchedules = offSchedules
          .filter((s) => s.installment_id === plan.id)
          .sort((a, b) => Number(a.installment_no) - Number(b.installment_no));
      } else {
        const { data } = await supabase
          .from("showroom_installment_schedules")
          .select("*")
          .eq("installment_id", plan.id)
          .order("installment_no", { ascending: true });
        currentSchedules = (data as ShowroomInstallmentSchedule[]) || [];
      }

      const mappedRows: CustomScheduleRow[] = currentSchedules.map((s, idx) => ({
        id: s.id,
        no: s.installment_no || idx + 1,
        title: s.is_promise ? (s.promise_title || `وعدہ ادائیگی #${idx + 1}`) : `ماہوار قسط #${s.installment_no}`,
        dueDate: s.due_date ? s.due_date.split("T")[0] : new Date().toISOString().split("T")[0],
        amount: Number(s.due_amount) || 0,
        isPromise: !!s.is_promise,
        notes: s.notes || undefined,
      }));
      setCustomSchedules(mappedRows);
    } catch (e) {
      console.error("Error loading schedules for edit:", e);
    }

    setFormStep(1);
    setIsNewModalOpen(true);
  };

  // Vehicle change handler
  const handleVehicleSelect = (vId: string) => {
    const selected = vehicles.find((v) => v.id === vId);
    if (selected) {
      const cPrice = Number(selected.cash_price || selected.price) || 0;
      const instPrice = Number(selected.installment_price) || Math.round(cPrice * 1.25);
      const profit = Math.max(0, instPrice - cPrice);
      const defaultDown = Math.round(instPrice * 0.2);

      setFormData((prev) => ({
        ...prev,
        vehicle_id: vId,
        cash_price: cPrice,
        markup_profit: profit,
        total_price: instPrice || cPrice,
        down_payment: defaultDown,
      }));
    } else {
      setFormData((prev) => ({ ...prev, vehicle_id: vId }));
    }
  };

  // Party autofill handler
  const handlePartySelect = (pId: string) => {
    const p = parties.find((x) => x.id === pId);
    if (p) {
      setFormData((prev) => ({
        ...prev,
        party_id: pId,
        customer_name: p.name,
        customer_father_name: p.father_name || prev.customer_father_name,
        customer_caste: p.caste || prev.customer_caste,
        customer_cnic: p.cnic || prev.customer_cnic,
        customer_phone: p.phone || prev.customer_phone,
        customer_address: p.address || prev.customer_address,
        customer_city: p.city || prev.customer_city,
      }));
    }
  };

  // Step Navigation Validation
  const handleContinueStep = () => {
    if (formStep === 1) {
      if (!formData.vehicle_id) {
        toast.error("برائے مہربانی پہلے گاڑی کا انتخاب کریں (Please select a vehicle)");
        return;
      }
      if (Number(formData.total_price) <= 0) {
        toast.error("کل اقساط قیمت درج کریں (Total price is required)");
        return;
      }
      setFormStep(2);
    } else if (formStep === 2) {
      if (!formData.customer_name.trim()) {
        toast.error("گاہک کا نام درج کرنا لازمی ہے (Customer name is required)");
        return;
      }
      if (!formData.customer_phone.trim()) {
        toast.error("گاہک کا موبائل نمبر درج کرنا لازمی ہے (Customer phone is required)");
        return;
      }
      setFormStep(3);
    } else if (formStep === 3) {
      setFormStep(4);
    }
  };

  // Submit and Create Agreement
  const handleSaveAgreement = async () => {
    if (!shopId) return;

    if (!formData.vehicle_id) {
      toast.error("Please select a vehicle (Step 1)");
      setFormStep(1);
      return;
    }
    if (!formData.customer_name.trim()) {
      toast.error("Customer name is required (Step 2)");
      setFormStep(2);
      return;
    }
    if (!formData.customer_phone.trim()) {
      toast.error("Customer phone number is required (Step 2)");
      setFormStep(2);
      return;
    }

    setIsSaving(true);
    try {
      if (editingPlan) {
        // Mode: UPDATE EXISTING AGREEMENT
        const totalGross = Number(formData.total_price) || 0;
        const totalPaidCurrent = Number(editingPlan.total_paid) || Number(formData.down_payment) || 0;
        const remainingBal = Math.max(0, totalGross - totalPaidCurrent);
        const monthly = formData.total_installments > 0
          ? Math.round(remainingBal / Math.max(1, Number(formData.total_installments)))
          : Number(editingPlan.monthly_installment) || 0;

        const updatePayload = {
          id: editingPlan.id,
          manual_book_no: formData.manual_book_no.trim() || null,
          manual_file_no: formData.manual_file_no.trim() || null,
          party_id: formData.party_id || null,
          customer_name: formData.customer_name.trim(),
          customer_father_name: formData.customer_father_name.trim() || null,
          customer_caste: formData.customer_caste.trim() || null,
          customer_cnic: formData.customer_cnic.trim() || null,
          customer_phone: formData.customer_phone.trim(),
          customer_phone_2: formData.customer_phone_2.trim() || null,
          customer_address: formData.customer_address.trim() || null,
          customer_city: formData.customer_city.trim() || null,

          guarantor_1_name: formData.guarantor_1_name.trim() || null,
          guarantor_1_father_name: formData.guarantor_1_father_name.trim() || null,
          guarantor_1_caste: formData.guarantor_1_caste.trim() || null,
          guarantor_1_cnic: formData.guarantor_1_cnic.trim() || null,
          guarantor_1_phone: formData.guarantor_1_phone.trim() || null,
          guarantor_1_relation: formData.guarantor_1_relation.trim() || null,
          guarantor_1_address: formData.guarantor_1_address.trim() || null,

          guarantor_2_name: formData.guarantor_2_name.trim() || null,
          guarantor_2_father_name: formData.guarantor_2_father_name.trim() || null,
          guarantor_2_caste: formData.guarantor_2_caste.trim() || null,
          guarantor_2_cnic: formData.guarantor_2_cnic.trim() || null,
          guarantor_2_phone: formData.guarantor_2_phone.trim() || null,
          guarantor_2_relation: formData.guarantor_2_relation.trim() || null,
          guarantor_2_address: formData.guarantor_2_address.trim() || null,

          cash_price: Number(formData.cash_price) || 0,
          markup_profit: Number(formData.markup_profit) || 0,
          total_price: totalGross,
          down_payment: Number(formData.down_payment) || 0,
          remaining_balance: remainingBal,
          total_installments: Number(formData.total_installments) || editingPlan.total_installments,
          monthly_installment: monthly,
          frequency: formData.frequency,
          start_date: formData.start_date,
          first_due_date: formData.first_due_date,
          promises: promises,
          witness_1_name: formData.witness_1_name.trim() || null,
          witness_1_cnic: formData.witness_1_cnic.trim() || null,
          witness_1_phone: formData.witness_1_phone.trim() || null,
          witness_2_name: formData.witness_2_name.trim() || null,
          witness_2_cnic: formData.witness_2_cnic.trim() || null,
          witness_2_phone: formData.witness_2_phone.trim() || null,
          notes: formData.notes.trim() || null,
        };

        await executeShowroomAction({
          table: "showroom_installments",
          action: "update",
          payload: updatePayload,
          shopId,
        });

        // Update schedule rows if customSchedules were changed
        for (let idx = 0; idx < customSchedules.length; idx++) {
          const s = customSchedules[idx];
          if (s.id && !s.id.startsWith("reg-") && !s.id.startsWith("prom-")) {
            await executeShowroomAction({
              table: "showroom_installment_schedules",
              action: "update",
              payload: {
                id: s.id,
                installment_no: idx + 1,
                due_date: s.dueDate,
                due_amount: Number(s.amount) || 0,
                is_promise: !!s.isPromise,
                promise_title: s.isPromise ? s.title : null,
                notes: s.notes || null,
              },
              shopId,
            });
          }
        }

        // Also update vehicle buyer name & phone if associated
        if (formData.vehicle_id) {
          await executeShowroomAction({
            table: "showroom_vehicles",
            action: "update",
            payload: {
              id: formData.vehicle_id,
              buyer_name: formData.customer_name.trim(),
              buyer_phone: formData.customer_phone.trim(),
            },
            shopId,
          });
        }

        toast.success("Installment agreement updated successfully! (معاہدہ میں ترمیم محفوظ ہو گئی)");
        setIsNewModalOpen(false);
        setEditingPlan(null);
        if (selectedPlan && selectedPlan.id === editingPlan.id) {
          setSelectedPlan((prev) => (prev ? { ...prev, ...updatePayload } : null));
          await loadPlanSchedules(editingPlan.id);
        }
        await loadData();
        return;
      }

      const remaining = netRemainingAfterAdvance;
      const monthly = calculatedMonthly;

      // Make sure we have schedule rows
      let finalSchedules = customSchedules.length > 0 ? customSchedules : buildInitialScheduleList();
      const totalScheduled = finalSchedules.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const diff = remaining - totalScheduled;

      // If difference exists, rebalance
      if (Math.abs(diff) > 5) {
        const regularRows = finalSchedules.filter((s) => !s.isPromise);
        const promiseRows = finalSchedules.filter((s) => s.isPromise);
        const currentPromiseTotal = promiseRows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const targetRegularSum = Math.max(0, remaining - currentPromiseTotal);

        if (regularRows.length > 0) {
          const perRow = Math.floor(targetRegularSum / regularRows.length);
          const rem = targetRegularSum - perRow * regularRows.length;
          finalSchedules = finalSchedules.map((row) => {
            if (row.isPromise) return row;
            const regularIndex = regularRows.findIndex((r) => r.id === row.id);
            const isLast = regularIndex === regularRows.length - 1;
            return {
              ...row,
              amount: perRow + (isLast ? rem : 0),
            };
          });
          setCustomSchedules(finalSchedules);
        }
      }

      // 1. Insert installment record
      const instId = crypto.randomUUID();
      const agreementNumber = formData.agreement_number.trim() || generateAgreementNumber();
      const instPayload = {
        id: instId,
        shop_id: shopId,
        vehicle_id: formData.vehicle_id || null,
        party_id: formData.party_id || null,
        agreement_number: agreementNumber,
        manual_book_no: formData.manual_book_no.trim() || null,
        manual_file_no: formData.manual_file_no.trim() || null,
        customer_name: formData.customer_name.trim(),
        customer_father_name: formData.customer_father_name.trim() || null,
        customer_caste: formData.customer_caste.trim() || null,
        customer_cnic: formData.customer_cnic.trim() || null,
        customer_phone: formData.customer_phone.trim(),
        customer_phone_2: formData.customer_phone_2.trim() || null,
        customer_address: formData.customer_address.trim() || null,
        customer_city: formData.customer_city.trim() || null,

        guarantor_1_name: formData.guarantor_1_name.trim() || null,
        guarantor_1_father_name: formData.guarantor_1_father_name.trim() || null,
        guarantor_1_caste: formData.guarantor_1_caste.trim() || null,
        guarantor_1_cnic: formData.guarantor_1_cnic.trim() || null,
        guarantor_1_phone: formData.guarantor_1_phone.trim() || null,
        guarantor_1_relation: formData.guarantor_1_relation.trim() || null,
        guarantor_1_address: formData.guarantor_1_address.trim() || null,

        guarantor_2_name: formData.guarantor_2_name.trim() || null,
        guarantor_2_father_name: formData.guarantor_2_father_name.trim() || null,
        guarantor_2_caste: formData.guarantor_2_caste.trim() || null,
        guarantor_2_cnic: formData.guarantor_2_cnic.trim() || null,
        guarantor_2_phone: formData.guarantor_2_phone.trim() || null,
        guarantor_2_relation: formData.guarantor_2_relation.trim() || null,
        guarantor_2_address: formData.guarantor_2_address.trim() || null,

        cash_price: Number(formData.cash_price) || 0,
        markup_profit: Number(formData.markup_profit) || 0,
        total_price: Number(formData.total_price) || 0,
        down_payment: Number(formData.down_payment) || 0,
        remaining_balance: remaining,
        total_installments: Number(formData.total_installments) || finalSchedules.length,
        monthly_installment: monthly,
        frequency: formData.frequency,
        start_date: formData.start_date,
        first_due_date: formData.first_due_date,
        total_paid: Number(formData.down_payment) || 0,
        promises: promises,
        status: "active",
        witness_1_name: formData.witness_1_name.trim() || null,
        witness_1_cnic: formData.witness_1_cnic.trim() || null,
        witness_1_phone: formData.witness_1_phone.trim() || null,
        witness_2_name: formData.witness_2_name.trim() || null,
        witness_2_cnic: formData.witness_2_cnic.trim() || null,
        witness_2_phone: formData.witness_2_phone.trim() || null,
        notes: formData.notes.trim() || null,
      };

      await executeShowroomAction({
        table: "showroom_installments",
        action: "insert",
        payload: instPayload,
        shopId,
      });

      // 2. Insert custom installment schedules
      for (let idx = 0; idx < finalSchedules.length; idx++) {
        const item = finalSchedules[idx];
        const scheduleRow = {
          id: crypto.randomUUID(),
          shop_id: shopId,
          installment_id: instId,
          installment_no: idx + 1,
          due_date: item.dueDate,
          due_amount: Number(item.amount) || 0,
          paid_amount: 0,
          status: "unpaid",
          is_promise: !!item.isPromise,
          promise_title: item.isPromise ? item.title : null,
          notes: item.notes || null,
        };

        await executeShowroomAction({
          table: "showroom_installment_schedules",
          action: "insert",
          payload: scheduleRow,
          shopId,
        });
      }

      // 3. Deposit advance down payment into selected cash/bank account if provided
      const downVal = Number(formData.down_payment) || 0;
      if (downVal > 0 && formData.deposit_account_id) {
        const chosenAcc = accounts.find((a) => a.id === formData.deposit_account_id);
        if (chosenAcc) {
          await executeShowroomAction({
            table: "account_transactions",
            action: "insert",
            payload: {
              id: crypto.randomUUID(),
              shop_id: shopId,
              account_id: formData.deposit_account_id,
              type: "deposit",
              amount: downVal,
              ref_type: "showroom_installment_advance",
              ref_id: instId,
              remarks: `Showroom Advance Down Payment - Agr #${agreementNumber}${formData.manual_book_no ? ` (Khata #${formData.manual_book_no})` : ""}${formData.manual_file_no ? ` (Receipt #${formData.manual_file_no})` : ""} - ${formData.customer_name}`,
            },
            shopId,
          });

          const newBal = (Number(chosenAcc.current_balance) || 0) + downVal;
          await executeShowroomAction({
            table: "cash_accounts",
            action: "update",
            payload: { id: formData.deposit_account_id, current_balance: newBal },
            shopId,
          });
        }
      }

      // 4. Mark vehicle as sold on installment
      await executeShowroomAction({
        table: "showroom_vehicles",
        action: "update",
        payload: {
          id: formData.vehicle_id,
          status: "installment_active",
          buyer_party_id: formData.party_id || null,
          buyer_name: formData.customer_name.trim(),
          buyer_phone: formData.customer_phone.trim(),
          sold_at: formData.start_date || new Date().toISOString(),
          sold_price: Number(formData.total_price) || 0,
          notes: `Sold on Installment Agreement ${agreementNumber} to ${formData.customer_name}`,
        },
        shopId,
      });

      // Auto-post balanced double-entry general journal voucher (Debit 1001 Cash Down Payment & 1002 AR Installments, Credit 4001 Revenue; Debit 5001 COGS, Credit 1003 Inventory)
      try {
        const matchedVehicle = vehicles.find((v) => v.id === formData.vehicle_id);
        await autoPostInstallmentAgreementJournal(
          supabase,
          shopId,
          instPayload,
          matchedVehicle || {}
        );
      } catch (jeErr) {
        console.warn("Auto-posting installment agreement journal warning:", jeErr);
      }

      toast.success("Installment agreement & customized schedules created successfully!");
      setIsNewModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create agreement");
    } finally {
      setIsSaving(false);
    }
  };

  // Open Receive Payment Modal
  const handleOpenReceivePayment = (schedule: ShowroomInstallmentSchedule) => {
    setActiveScheduleForPayment(schedule);
    const balanceDue = (Number(schedule.due_amount) || 0) - (Number(schedule.paid_amount) || 0);
    setPaymentAmount(Math.max(0, balanceDue));
    setLateFee(Number(schedule.late_fee) || 0);
    setDiscount(Number(schedule.discount) || 0);
    setPaymentMethod("cash");
    setSelectedAccountId(accounts.length > 0 ? accounts[0].id : "");
    setAutoSpread(true);
    setManualReceiptNo("");
    setManualBookNo(selectedPlan?.manual_book_no || "");
    setReceivedBy("");
    setReceiptNotes("");
  };

  // Submit Payment for Schedule
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScheduleForPayment || !selectedPlan || !shopId) return;

    if (paymentAmount <= 0) {
      toast.error("Payment amount must be greater than 0");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const previouslyPaid = Number(activeScheduleForPayment.paid_amount) || 0;
      const newTotalPaidForThisSchedule = previouslyPaid + Number(paymentAmount);
      const dueAmount = Number(activeScheduleForPayment.due_amount) || 0;
      const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
      const shortfallOrSurplus = dueAmount - (newTotalPaidForThisSchedule - Number(lateFee) + Number(discount));

      // Find future unpaid schedules (excluding this one)
      const futureUnpaidSchedules = schedules.filter(
        (s) => s.installment_no > activeScheduleForPayment.installment_no && s.status !== "paid"
      );

      const shouldAutoSpread = autoSpread && shortfallOrSurplus !== 0 && futureUnpaidSchedules.length > 0;
      const isFull = newTotalPaidForThisSchedule >= dueAmount - Number(discount) + Number(lateFee);

      if (shouldAutoSpread) {
        // 1. Mark current schedule as settled/paid with adjusted due_amount matching paid amount
        await executeShowroomAction({
          table: "showroom_installment_schedules",
          action: "update",
          payload: {
            id: activeScheduleForPayment.id,
            due_amount: newTotalPaidForThisSchedule,
            paid_amount: newTotalPaidForThisSchedule,
            paid_date: new Date().toISOString(),
            late_fee: Number(lateFee) || 0,
            discount: Number(discount) || 0,
            payment_method: paymentMethod,
            manual_receipt_no: manualReceiptNo.trim() || null,
            manual_book_no: manualBookNo.trim() || null,
            received_by: receivedBy.trim() || null,
            receipt_no: receiptNo,
            status: "paid",
            notes: (receiptNotes.trim() ? receiptNotes.trim() + " • " : "") + 
              (shortfallOrSurplus > 0 
                ? `Shortfall of ${formatPKR(shortfallOrSurplus)} divided across next ${futureUnpaidSchedules.length} installments`
                : `Surplus of ${formatPKR(Math.abs(shortfallOrSurplus))} deducted from next ${futureUnpaidSchedules.length} installments`),
          },
          shopId,
        });

        // 2. Distribute shortfall/surplus across remaining future unpaid schedules
        const futureCount = futureUnpaidSchedules.length;
        const perScheduleDelta = Math.floor(shortfallOrSurplus / futureCount);
        const remainder = shortfallOrSurplus - (perScheduleDelta * futureCount);

        for (let i = 0; i < futureCount; i++) {
          const fs = futureUnpaidSchedules[i];
          const isLast = i === futureCount - 1;
          const thisDelta = perScheduleDelta + (isLast ? remainder : 0);
          const newDue = Math.max(0, (Number(fs.due_amount) || 0) + thisDelta);

          await executeShowroomAction({
            table: "showroom_installment_schedules",
            action: "update",
            payload: {
              id: fs.id,
              due_amount: newDue,
            },
            shopId,
          });
        }
      } else {
        // Standard partial or full payment update
        await executeShowroomAction({
          table: "showroom_installment_schedules",
          action: "update",
          payload: {
            id: activeScheduleForPayment.id,
            paid_amount: newTotalPaidForThisSchedule,
            paid_date: new Date().toISOString(),
            late_fee: Number(lateFee) || 0,
            discount: Number(discount) || 0,
            payment_method: paymentMethod,
            manual_receipt_no: manualReceiptNo.trim() || null,
            manual_book_no: manualBookNo.trim() || null,
            received_by: receivedBy.trim() || null,
            receipt_no: receiptNo,
            status: isFull ? "paid" : "partial",
            notes: receiptNotes.trim() || null,
          },
          shopId,
        });
      }

      // 3. Deposit money into selected Cash / Bank Account & write account_transactions
      if (selectedAccountId) {
        const chosenAcc = accounts.find((a) => a.id === selectedAccountId);
        if (chosenAcc) {
          await executeShowroomAction({
            table: "account_transactions",
            action: "insert",
            payload: {
              id: crypto.randomUUID(),
              shop_id: shopId,
              account_id: selectedAccountId,
              type: "deposit",
              amount: Number(paymentAmount),
              ref_type: "showroom_installment_qist",
              ref_id: activeScheduleForPayment.id,
              remarks: `Showroom Qist #${activeScheduleForPayment.installment_no}${manualReceiptNo ? ` (Manual Slip #${manualReceiptNo})` : ""} - Agr #${selectedPlan.agreement_number} - ${selectedPlan.customer_name}`,
            },
            shopId,
          });

          const updatedBal = (Number(chosenAcc.current_balance) || 0) + Number(paymentAmount);
          await executeShowroomAction({
            table: "cash_accounts",
            action: "update",
            payload: { id: selectedAccountId, current_balance: updatedBal },
            shopId,
          });
        }
      }

      // 4. Re-calculate overall installment progress
      const newAgreementTotalPaid = (Number(selectedPlan.total_paid) || 0) + Number(paymentAmount);
      const newAgreementRemaining = Math.max(0, (Number(selectedPlan.total_price) || 0) - newAgreementTotalPaid);
      const isAllCompleted = newAgreementRemaining <= 0;

      await executeShowroomAction({
        table: "showroom_installments",
        action: "update",
        payload: {
          id: selectedPlan.id,
          total_paid: newAgreementTotalPaid,
          remaining_balance: newAgreementRemaining,
          status: isAllCompleted ? "completed" : selectedPlan.status,
        },
        shopId,
      });

      // Auto-post balanced double-entry general journal voucher (Debit 1001 Cash, Credit 1002 AR Installments)
      try {
        await autoPostInstallmentCollectionJournal(
          supabase,
          shopId,
          activeScheduleForPayment,
          selectedPlan,
          Number(paymentAmount),
          { accountId: selectedAccountId, receiptNo }
        );
      } catch (jeErr) {
        console.warn("Auto-posting installment collection journal warning:", jeErr);
      }

      toast.success(`Payment of ${formatPKR(paymentAmount)} recorded successfully!`);

      // Prepare data & launch Receipt Modal immediately
      const updatedScheduleRecord: ShowroomInstallmentSchedule = {
        ...activeScheduleForPayment,
        paid_amount: newTotalPaidForThisSchedule,
        due_amount: shouldAutoSpread ? newTotalPaidForThisSchedule : activeScheduleForPayment.due_amount,
        receipt_no: receiptNo,
        manual_receipt_no: manualReceiptNo.trim() || null,
        manual_book_no: manualBookNo.trim() || null,
        paid_date: new Date().toISOString(),
        status: isFull || shouldAutoSpread ? "paid" : "partial",
        notes: receiptNotes,
      };
      const chosenAccName = accounts.find((a) => a.id === selectedAccountId)?.name || "Cash / Counter";
      const nextSched = schedules.find((s) => s.installment_no === activeScheduleForPayment.installment_no + 1) || null;

      setReceiptTargetSchedule(updatedScheduleRecord);
      setReceiptTargetPlan({
        ...selectedPlan,
        total_paid: newAgreementTotalPaid,
        remaining_balance: newAgreementRemaining,
      });
      setReceiptTargetAccountName(chosenAccName);
      setReceiptTargetNextSchedule(nextSched);
      setActiveScheduleForPayment(null);
      setIsReceiptModalOpen(true);

      // Refresh data
      await loadPlanSchedules(selectedPlan.id);
      await loadData();
    } catch (err: any) {
      toast.error("Failed to save payment: " + err.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Delete agreement
  const handleDeleteAgreement = async (id: string, vehicleId?: string | null) => {
    if (!confirm("Are you sure you want to delete this installment agreement? This will remove all payment schedules.")) return;
    try {
      await executeShowroomAction({
        table: "showroom_installments",
        action: "delete",
        payload: { id },
        shopId,
      });

      if (vehicleId) {
        await executeShowroomAction({
          table: "showroom_vehicles",
          action: "update",
          payload: {
            id: vehicleId,
            status: "available",
            buyer_party_id: null,
            buyer_name: null,
            buyer_phone: null,
            sold_at: null,
            sold_price: null,
          },
          shopId,
        });
      }

      toast.success("Installment agreement deleted");
      if (selectedPlan?.id === id) setSelectedPlan(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // WhatsApp reminder
  const handleSendWhatsApp = (plan: ShowroomInstallment) => {
    const veh = plan.showroom_vehicles;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const agreementLink = `${origin}/dashboard/showroom/installments/agreement/${plan.id}`;

    const text =
      `*${shopName || "Showroom"} — Installment Status Reminder*\n` +
      `--------------------------------\n` +
      `*Agreement No:* ${plan.agreement_number}\n` +
      `*Customer:* ${plan.customer_name}\n` +
      `*Vehicle:* ${veh ? `${veh.make} ${veh.model}` : "—"}\n` +
      `*Total Financed:* ${formatPKR(plan.total_price)}\n` +
      `*Total Paid:* ${formatPKR(plan.total_paid)}\n` +
      `*Remaining Balance:* ${formatPKR(plan.remaining_balance)}\n` +
      `*Monthly Installment:* ${formatPKR(plan.monthly_installment)}\n` +
      `--------------------------------\n` +
      `📥 *معاہدہ و قسط پلان ڈاؤن لوڈ کریں (View / Download):*\n👉 ${agreementLink}\n\n` +
      `For any query, feel free to contact ${shopName || "our Showroom"}. Thank you!`;

    const phoneNum = (plan.customer_phone || "").replace(/[^0-9]/g, "");
    const cleanPhone = phoneNum.startsWith("0") ? "92" + phoneNum.slice(1) : phoneNum;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Filtered list
  const filteredInstallments = useMemo(() => {
    return installments.filter((item) => {
      const matchesSearch =
        item.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.agreement_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.customer_phone && item.customer_phone.includes(searchQuery)) ||
        (item.customer_cnic && item.customer_cnic.includes(searchQuery)) ||
        (item.showroom_vehicles?.make && item.showroom_vehicles.make.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.showroom_vehicles?.model && item.showroom_vehicles.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.showroom_vehicles?.plate_number && item.showroom_vehicles.plate_number.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [installments, searchQuery, statusFilter]);

  // Overall Financial Metrics
  const metrics = useMemo(() => {
    const totalPlans = installments.length;
    const activePlans = installments.filter((i) => i.status === "active").length;
    const totalFinanced = installments.reduce((acc, i) => acc + (Number(i.total_price) || 0), 0);
    const totalCollected = installments.reduce((acc, i) => acc + (Number(i.total_paid) || 0), 0);
    const totalRemaining = installments.reduce((acc, i) => acc + (Number(i.remaining_balance) || 0), 0);
    return { totalPlans, activePlans, totalFinanced, totalCollected, totalRemaining };
  }, [installments]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans animate-in fade-in duration-500">
      <ShowroomOfflineBar onSyncSuccess={loadData} />

      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-violet-300 font-bold text-xs uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Showroom Financing & EMI Desk</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            Vehicle Installment Plans
            <span className="text-xs font-bold px-2.5 py-0.5 bg-violet-500/20 text-violet-200 border border-violet-400/30 rounded-full">
              اقساط کا نظام
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Create legal financing agreements, track monthly installments, print bilingual stamp deeds, and collect dues.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <Button
            onClick={handleOpenCreateModal}
            className="bg-white hover:bg-slate-100 text-violet-950 font-black text-xs sm:text-sm px-5 py-2.5 rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-violet-700" />
            <span>New Installment Plan</span>
          </Button>
        </div>
      </div>

      {/* ── 4 Crisp Modern KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Financed Portfolio</span>
            <div className="p-2 rounded-xl bg-violet-50 text-violet-700">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{formatPKR(metrics.totalFinanced)}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">{metrics.totalPlans} Total Agreements</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Total Recovered</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-emerald-700">{formatPKR(metrics.totalCollected)}</div>
            <div className="text-xs text-emerald-600 font-bold mt-0.5">
              {metrics.totalFinanced > 0
                ? `${Math.round((metrics.totalCollected / metrics.totalFinanced) * 100)}% portfolio recovered`
                : "0% recovered"}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Outstanding Balance</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-amber-600">{formatPKR(metrics.totalRemaining)}</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">{metrics.activePlans} Active Plans Pending</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>Active Agreements</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-indigo-900">{metrics.activePlans} Plans</div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Under monthly installments</div>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search & Filter Tabs ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search customer, phone, CNIC, agreement #, vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-50 border-slate-200 rounded-2xl text-xs sm:text-sm h-10 w-full"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200 shrink-0">
          {[
            { id: "all", label: `All (${installments.length})` },
            { id: "active", label: `Active (${installments.filter((x) => x.status === "active").length})` },
            { id: "completed", label: `Completed (${installments.filter((x) => x.status === "completed").length})` },
            { id: "overdue", label: `Overdue (${installments.filter((x) => x.status === "overdue").length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                statusFilter === tab.id
                  ? "bg-white text-violet-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Agreements Grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          <p className="text-xs font-semibold">Loading vehicle installment agreements...</p>
        </div>
      ) : filteredInstallments.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Installment Agreements Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            {searchQuery
              ? "No records matched your search query. Try searching with different terms."
              : "You have not registered any installment plans yet. Click below to create your first vehicle installment agreement."}
          </p>
          {!searchQuery && (
            <Button
              onClick={handleOpenCreateModal}
              className="mt-4 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl cursor-pointer shadow-md"
            >
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Create First Agreement
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredInstallments.map((plan) => {
            const pctPaid =
              plan.total_price > 0
                ? Math.min(100, Math.round((plan.total_paid / plan.total_price) * 100))
                : 0;
            const veh = plan.showroom_vehicles;
            const hasPromises = plan.promises && Array.isArray(plan.promises) && plan.promises.length > 0;

            return (
              <motion.div
                key={plan.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white hover:border-violet-300 border border-slate-200/80 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Agreement # & Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-xl border border-violet-100">
                          {plan.agreement_number}
                        </span>
                        {plan.manual_book_no && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            کھاتہ #{plan.manual_book_no}
                          </span>
                        )}
                        {plan.manual_file_no && (
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                            رسید #{plan.manual_file_no}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Started: {formatDate(plan.start_date)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          plan.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : plan.status === "overdue"
                            ? "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                            : "bg-violet-50 text-violet-700 border border-violet-200"
                        }`}
                      >
                        {plan.status}
                      </span>
                      {hasPromises && (
                        <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
                          ⭐ وعدہ ادائیگی شامل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer & Vehicle Info */}
                  <div className="mt-3.5 space-y-2.5">
                    <div>
                      <h4 className="text-base font-black text-slate-900 group-hover:text-violet-700 transition-colors flex items-center gap-1.5">
                        <User className="w-4 h-4 text-violet-600" />
                        {plan.customer_name}
                      </h4>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                        {plan.customer_phone && (
                          <span className="font-mono text-slate-600 font-semibold">{plan.customer_phone}</span>
                        )}
                        {plan.customer_cnic && (
                          <span className="font-mono text-slate-400">| {plan.customer_cnic}</span>
                        )}
                      </div>
                    </div>

                    {veh && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white text-violet-600 border border-slate-200 shadow-2xs">
                          <Car className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {veh.make} {veh.model} {veh.year ? `(${veh.year})` : ""}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate font-mono">
                            {veh.is_applied_for ? "Applied For" : (veh.plate_number || "Unregistered")}
                            {veh.color ? ` • ${veh.color}` : ""}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pricing Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Total Financed:</span>
                      <span className="font-black text-slate-900">{formatPKR(plan.total_price)}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Paid: <strong className="text-emerald-700">{formatPKR(plan.total_paid)}</strong>
                      </span>
                      <span className="text-slate-500">
                        Balance: <strong className="text-amber-700">{formatPKR(plan.remaining_balance)}</strong>
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-violet-600 to-emerald-500 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${pctPaid}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono font-medium">
                      <span>{pctPaid}% Paid</span>
                      <span>{plan.total_installments} Mo @ {formatPKR(plan.monthly_installment)}/mo</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <Button
                    onClick={() => openPlanDetails(plan)}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-2 h-auto rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Manage & Pay</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    onClick={() => handleOpenEditModal(plan)}
                    variant="outline"
                    className="p-2 h-auto rounded-xl border-slate-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300"
                    title="Edit Agreement / معاہدہ میں ترمیم کریں"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  <Button
                    onClick={() => handleOpenDeedModal(plan)}
                    variant="outline"
                    className="p-2 h-auto rounded-xl border-slate-200 text-slate-700 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
                    title="Print Deed / Agreement"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>

                  <Button
                    onClick={() => handleSendWhatsApp(plan)}
                    variant="outline"
                    className="p-2 h-auto rounded-xl border-slate-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
                    title="Send WhatsApp Reminder"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>

                  <button
                    onClick={() => handleDeleteAgreement(plan.id, plan.vehicle_id)}
                    className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-colors"
                    title="Delete Agreement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: Create / Edit Installment Agreement (Multi-Step Form) ──────── */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-violet-600" />
                    {editingPlan
                      ? "Edit Installment Agreement (اقساط معاہدہ میں ترمیم کریں)"
                      : "New Vehicle Installment Agreement (نیا اقساط معاہدہ)"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Step {formStep} of 4 • Agr #{formData.agreement_number}
                    {editingPlan && " (Editing Existing Plan)"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsNewModalOpen(false);
                    setEditingPlan(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step Navigation Tabs */}
              <div className="grid grid-cols-4 border-b border-slate-200 text-xs font-bold text-center bg-slate-100">
                {[
                  { step: 1, label: "1. Vehicle & Pricing" },
                  { step: 2, label: "2. Customer (Buyer)" },
                  { step: 3, label: "3. Guarantors (Zamin)" },
                  { step: 4, label: "4. Promises & Schedules" },
                ].map((tab) => (
                  <button
                    key={tab.step}
                    type="button"
                    onClick={() => setFormStep(tab.step as any)}
                    className={`py-3 transition-colors cursor-pointer border-b-2 ${
                      formStep === tab.step
                        ? "border-violet-600 text-violet-700 bg-white shadow-2xs font-black"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Step Modal Body (Pure Container to prevent unwanted auto-submit / form submission) */}
              <div
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
                    e.preventDefault();
                  }
                }}
                className="p-6 overflow-y-auto flex-1 space-y-4"
              >
                {/* STEP 1: VEHICLE & PRICING */}
                {formStep === 1 && (
                  <div className="space-y-4 animate-in fade-in">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Select Vehicle from Inventory *
                      </label>
                      <select
                        value={formData.vehicle_id}
                        onChange={(e) => handleVehicleSelect(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-violet-500 shadow-2xs"
                        required
                      >
                        <option value="">-- Choose Car / Motorcycle --</option>
                        {vehicles
                          .filter((v) => v.status === "available" || v.id === formData.vehicle_id)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.make} {v.model} ({v.year || "—"}) • {v.is_applied_for ? "Applied For" : (v.plate_number || "No Plate")} • Cash: {formatPKR(v.cash_price || v.price)}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Manual Book/Khata No & Manual File/Receipt No */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
                      <div>
                        <label className="text-xs font-bold text-amber-900 block mb-1">
                          Khata Number (کھاتہ نمبر)
                        </label>
                        <Input
                          placeholder="مثلاً: کھاتہ # 05 / Khata # 05"
                          value={formData.manual_book_no}
                          onChange={(e) => setFormData({ ...formData, manual_book_no: e.target.value })}
                          className="rounded-xl border-amber-200 bg-white font-semibold text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-amber-900 block mb-1">
                          Receipt Number (رسید نمبر)
                        </label>
                        <Input
                          placeholder="مثلاً: رسید # 142 / Receipt # 142"
                          value={formData.manual_file_no}
                          onChange={(e) => setFormData({ ...formData, manual_file_no: e.target.value })}
                          className="rounded-xl border-amber-200 bg-white font-semibold text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Cash Price (نقد قیمت)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formData.cash_price || ""}
                          onChange={(e) => {
                            const cp = Number(e.target.value.replace(/\D/g, "")) || 0;
                            setFormData((prev) => ({
                              ...prev,
                              cash_price: cp,
                              total_price: cp + prev.markup_profit,
                            }));
                          }}
                          className="rounded-xl border-slate-200 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Markup / Profit (منافع)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formData.markup_profit || ""}
                          onChange={(e) => {
                            const mp = Number(e.target.value.replace(/\D/g, "")) || 0;
                            setFormData((prev) => ({
                              ...prev,
                              markup_profit: mp,
                              total_price: prev.cash_price + mp,
                            }));
                          }}
                          className="rounded-xl border-slate-200 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Total Financed Price</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formData.total_price || ""}
                          onChange={(e) => setFormData({ ...formData, total_price: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                          className="rounded-xl border-slate-200 font-bold text-violet-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Advance / Down Payment (پیشگی رقم)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={formData.down_payment || ""}
                          onChange={(e) => setFormData({ ...formData, down_payment: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                          className="rounded-xl border-slate-200 font-bold text-emerald-700"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          Deposit Account (ایڈوانس وصولی کھاتہ)
                        </label>
                        <select
                          value={formData.deposit_account_id}
                          onChange={(e) => setFormData({ ...formData, deposit_account_id: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-violet-500 h-10"
                        >
                          <option value="">-- Select Cash/Bank Account --</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.type || "Cash/Bank"}) — {formatPKR(acc.current_balance)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Remaining Balance (بقیہ رقم)</label>
                        <div className="h-10 bg-slate-100 rounded-xl px-3 flex items-center font-black text-amber-700 text-sm border border-slate-200">
                          {formatPKR(netRemainingAfterAdvance)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: CUSTOMER / BUYER */}
                {formStep === 2 && (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Quick Party Autofill */}
                    {parties.length > 0 && (
                      <div className="bg-violet-50 p-3.5 rounded-2xl border border-violet-100 flex items-center justify-between gap-3">
                        <div className="text-xs text-violet-900 font-semibold">
                          Autofill from registered Parties:
                        </div>
                        <select
                          value={formData.party_id}
                          onChange={(e) => handlePartySelect(e.target.value)}
                          className="bg-white border border-violet-200 rounded-xl px-3 py-1.5 text-xs text-slate-800"
                        >
                          <option value="">-- Select Existing Party --</option>
                          {parties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.phone})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Customer Name *</label>
                        <Input
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                          placeholder="Full Name"
                          className="rounded-xl border-slate-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Father's Name (والد کا نام)</label>
                        <Input
                          value={formData.customer_father_name}
                          onChange={(e) => setFormData({ ...formData, customer_father_name: e.target.value })}
                          placeholder="Father Name"
                          className="rounded-xl border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Caste / Quom (قوم / برادری)</label>
                        <Input
                          value={formData.customer_caste}
                          onChange={(e) => setFormData({ ...formData, customer_caste: e.target.value })}
                          placeholder="e.g. Arain, Jatt, Rajput"
                          className="rounded-xl border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">CNIC (شناختی کارڈ)</label>
                        <Input
                          value={formData.customer_cnic}
                          onChange={(e) => setFormData({ ...formData, customer_cnic: e.target.value })}
                          placeholder="35202-0000000-0"
                          className="rounded-xl border-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Phone *</label>
                        <Input
                          value={formData.customer_phone}
                          onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                          placeholder="0300-1234567"
                          className="rounded-xl border-slate-200 font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Secondary Phone</label>
                        <Input
                          value={formData.customer_phone_2}
                          onChange={(e) => setFormData({ ...formData, customer_phone_2: e.target.value })}
                          placeholder="Optional"
                          className="rounded-xl border-slate-200 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Full Address (مکمل رہائشی پتہ)</label>
                        <Input
                          value={formData.customer_address}
                          onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                          placeholder="House, Street, Area"
                          className="rounded-xl border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">City (شہر)</label>
                        <Input
                          value={formData.customer_city}
                          onChange={(e) => setFormData({ ...formData, customer_city: e.target.value })}
                          placeholder="Lahore"
                          className="rounded-xl border-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: GUARANTORS */}
                {formStep === 3 && (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Guarantor 1 */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Guarantor 1 (ضامن اول / گواہ)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input
                          placeholder="Name (نام)"
                          value={formData.guarantor_1_name}
                          onChange={(e) => setFormData({ ...formData, guarantor_1_name: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white"
                        />
                        <Input
                          placeholder="Father Name (ولدیت)"
                          value={formData.guarantor_1_father_name}
                          onChange={(e) => setFormData({ ...formData, guarantor_1_father_name: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white"
                        />
                        <Input
                          placeholder="Caste (قوم)"
                          value={formData.guarantor_1_caste}
                          onChange={(e) => setFormData({ ...formData, guarantor_1_caste: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input
                          placeholder="CNIC (شناختی کارڈ)"
                          value={formData.guarantor_1_cnic}
                          onChange={(e) => setFormData({ ...formData, guarantor_1_cnic: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white font-mono"
                        />
                        <Input
                          placeholder="Phone (موبائل نمبر)"
                          value={formData.guarantor_1_phone}
                          onChange={(e) => setFormData({ ...formData, guarantor_1_phone: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white font-mono"
                        />
                        <Input
                          placeholder="Relation (رشتہ داری)"
                          value={formData.guarantor_1_relation}
                          onChange={(e) => setFormData({ ...formData, guarantor_1_relation: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    {/* Guarantor 2 */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Guarantor 2 (ضامن دوم - اختیاری)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Input
                          placeholder="Name (نام)"
                          value={formData.guarantor_2_name}
                          onChange={(e) => setFormData({ ...formData, guarantor_2_name: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white"
                        />
                        <Input
                          placeholder="CNIC (شناختی کارڈ)"
                          value={formData.guarantor_2_cnic}
                          onChange={(e) => setFormData({ ...formData, guarantor_2_cnic: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white font-mono"
                        />
                        <Input
                          placeholder="Phone (موبائل نمبر)"
                          value={formData.guarantor_2_phone}
                          onChange={(e) => setFormData({ ...formData, guarantor_2_phone: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: PROMISES & SCHEDULES BUILDER */}
                {formStep === 4 && (
                  <div className="space-y-5 animate-in fade-in">
                    {/* Section 1: Promises / Balloon Payments Builder */}
                    <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase tracking-wide">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            <span>Promise / Balloon Payments (وعدہ ادائیگیاں / یکمشت رقم)</span>
                          </h4>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            اگر گاہک درمیان میں کوئی بڑی یکمشت رقم (جیسے فصل، عید یا کمیٹی کی رقم) دینے کا وعدہ کرے تو یہاں شامل کریں۔
                          </p>
                        </div>

                        <Button
                          type="button"
                          onClick={handleAddPromise}
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl h-8 px-3 flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>+ وعدہ رقم شامل کریں</span>
                        </Button>
                      </div>

                      {promises.length === 0 ? (
                        <div className="p-3 bg-white/70 rounded-xl border border-dashed border-amber-300 text-center text-xs text-amber-800 font-medium">
                          فی الوقت کوئی وعدہ ادائیگی شامل نہیں کی گئی۔ تمام رقم ماہوار اقساط میں برابر تقسیم ہوگی۔
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {promises.map((p, idx) => (
                            <div
                              key={p.id}
                              className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                            >
                              <div className="sm:col-span-4">
                                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                  عنوان / نام وعدہ #{idx + 1}
                                </label>
                                <Input
                                  value={p.title}
                                  onChange={(e) => handleUpdatePromise(idx, "title", e.target.value)}
                                  placeholder="مثلاً پہلا وعدہ / فصل رقم"
                                  className="h-8 text-xs font-semibold rounded-lg"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                  وعدہ رقم (PKR)
                                </label>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={p.amount || ""}
                                  onChange={(e) =>
                                    handleUpdatePromise(
                                      idx,
                                      "amount",
                                      Number(e.target.value.replace(/\D/g, "")) || 0
                                    )
                                  }
                                  placeholder="100,000"
                                  className="h-8 text-xs font-black text-amber-700 rounded-lg"
                                />
                              </div>

                              <div className="sm:col-span-4">
                                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                  تاریخ ادائیگی (Due Date)
                                </label>
                                <Input
                                  type="date"
                                  value={p.due_date}
                                  onChange={(e) => handleUpdatePromise(idx, "due_date", e.target.value)}
                                  className="h-8 text-xs rounded-lg"
                                />
                              </div>

                              <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePromise(idx)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                  title="Delete Promise"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Live Breakdown Summary Banner */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
                        <div className="p-2 bg-white rounded-xl border border-amber-200">
                          <span className="text-[10px] text-slate-500 block">کل رقم (Total)</span>
                          <span className="font-bold text-slate-900">{formatPKR(totalGrossFinanced)}</span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-amber-200">
                          <span className="text-[10px] text-slate-500 block">پیشگی ایڈوانس</span>
                          <span className="font-bold text-emerald-700">-{formatPKR(downPaymentAmount)}</span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-amber-200">
                          <span className="text-[10px] text-slate-500 block">وعدہ رقوم (Promises)</span>
                          <span className="font-bold text-amber-800">-{formatPKR(totalPromisesAmount)}</span>
                        </div>
                        <div className="p-2 bg-violet-100/70 rounded-xl border border-violet-200">
                          <span className="text-[10px] text-violet-800 font-bold block">ماہوار اقساط کیلئے بقیہ</span>
                          <span className="font-black text-violet-950">{formatPKR(netForRegularInstallments)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Installment Count & Schedule Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          ماہوار اقساط کی تعداد (Tenure)
                        </label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="12"
                          value={formData.total_installments || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value.replace(/\D/g, "")) || 0;
                            setFormData((prev) => ({ ...prev, total_installments: val }));
                          }}
                          className="rounded-xl border-slate-200 font-bold text-slate-900 h-9"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          پہلی قسط کی تاریخ
                        </label>
                        <Input
                          type="date"
                          value={formData.first_due_date}
                          onChange={(e) => setFormData({ ...formData, first_due_date: e.target.value })}
                          className="rounded-xl border-slate-200 h-9 text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          ادائیگی وقفہ (Frequency)
                        </label>
                        <select
                          value={formData.frequency}
                          onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-800 h-9"
                        >
                          <option value="monthly">Monthly (ماہوار)</option>
                          <option value="bi-monthly">Every 15 Days (پندرہ روزہ)</option>
                          <option value="weekly">Weekly (ہفتہ وار)</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-end">
                        <Button
                          type="button"
                          onClick={() => setCustomSchedules(buildInitialScheduleList())}
                          variant="outline"
                          className="border-violet-300 text-violet-700 hover:bg-violet-50 text-xs font-bold rounded-xl h-9 flex items-center justify-center gap-1 cursor-pointer"
                          title="Generate fresh schedules according to inputs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>شیڈول ری سیٹ کریں</span>
                        </Button>
                      </div>
                    </div>

                    {/* Section 3: Custom Editable Schedules Table */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-violet-600" />
                            <span>اقساط شیڈول میں مرضی کی ترمیم (Custom Editable Schedule)</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            آپ کسی بھی قسط کی تاریخ یا رقم اپنی مرضی سے بدل سکتے ہیں۔
                          </p>
                        </div>

                        <Button
                          type="button"
                          onClick={handleAutoBalanceCustomSchedules}
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl h-8 px-3 flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>بقیہ رقم خودکار برابر تقسیم کریں</span>
                        </Button>
                      </div>

                      {/* Schedules Table */}
                      <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                              <th className="p-2.5">#</th>
                              <th className="p-2.5">نوعیت (Type)</th>
                              <th className="p-2.5">تاریخ ادائیگی (Due Date)</th>
                              <th className="p-2.5 text-right">قسط رقم (PKR)</th>
                              <th className="p-2.5 text-center">حذف</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customSchedules.map((row, idx) => (
                              <tr
                                key={row.id}
                                className={row.isPromise ? "bg-amber-50/40" : "hover:bg-slate-50"}
                              >
                                <td className="p-2.5 font-mono font-bold text-slate-700">#{idx + 1}</td>
                                <td className="p-2.5">
                                  {row.isPromise ? (
                                    <span className="text-[10px] font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                                      ⭐ {row.title}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-violet-800 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-100">
                                      {row.title}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5">
                                  <Input
                                    type="date"
                                    value={row.dueDate}
                                    onChange={(e) => {
                                      const next = [...customSchedules];
                                      next[idx] = { ...next[idx], dueDate: e.target.value };
                                      setCustomSchedules(next);
                                    }}
                                    className="h-7 text-xs rounded-lg border-slate-200 max-w-[140px]"
                                  />
                                </td>
                                <td className="p-2.5 text-right">
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={row.amount || ""}
                                    onChange={(e) => {
                                      const val = Number(e.target.value.replace(/\D/g, "")) || 0;
                                      const next = [...customSchedules];
                                      next[idx] = { ...next[idx], amount: val };
                                      setCustomSchedules(next);
                                    }}
                                    className="h-7 text-xs font-black text-right rounded-lg border-slate-200 max-w-[130px] ml-auto"
                                  />
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = customSchedules.filter((_, i) => i !== idx);
                                      setCustomSchedules(next);
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Total Calculation Validation Check */}
                      {(() => {
                        const totalScheduled = customSchedules.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
                        const diff = netRemainingAfterAdvance - totalScheduled;
                        return (
                          <div
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                              diff === 0
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-amber-50 text-amber-900 border-amber-300"
                            }`}
                          >
                            <span>
                              شیڈول کا کل مجموعہ: <strong>{formatPKR(totalScheduled)}</strong> (مطلوبہ بقیہ رقم: {formatPKR(netRemainingAfterAdvance)})
                            </span>
                            {diff !== 0 && (
                              <span className="text-[11px] text-amber-700">
                                {diff > 0 ? `${formatPKR(diff)} کم ہے` : `${formatPKR(Math.abs(diff))} زائد ہے`} — اوپر 'خودکار تقسیم' دبائیں
                              </span>
                            )}
                            {diff === 0 && (
                              <span className="text-emerald-700 flex items-center gap-1 text-[11px]">
                                <CheckCircle className="w-3.5 h-3.5" /> بالکل درست بیلنس
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                  {formStep > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormStep((prev) => (prev - 1) as any)}
                      className="border-slate-200 text-slate-700 text-xs rounded-xl"
                    >
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  {formStep < 4 ? (
                    <Button
                      type="button"
                      onClick={handleContinueStep}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-5 rounded-xl cursor-pointer"
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSaveAgreement}
                      disabled={isSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 rounded-xl cursor-pointer shadow-md"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          {editingPlan ? "Updating Agreement..." : "Saving Agreement..."}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1.5" />
                          {editingPlan ? "Update Agreement (ترمیم محفوظ کریں)" : "Confirm & Create Agreement"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DRAWER / MODAL: Installment Details & Schedule Collection Desk ──── */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Top Banner */}
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full">
                      {selectedPlan.agreement_number}
                    </span>
                    {selectedPlan.manual_book_no && (
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                        کھاتہ #{selectedPlan.manual_book_no}
                      </span>
                    )}
                    {selectedPlan.manual_file_no && (
                      <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-300">
                        رسید #{selectedPlan.manual_file_no}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                        selectedPlan.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-indigo-100 text-indigo-800"
                      }`}
                    >
                      {selectedPlan.status}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                    {selectedPlan.customer_name}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleOpenEditModal(selectedPlan)}
                    variant="outline"
                    className="border-violet-200 text-violet-700 hover:bg-violet-50 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit (ترمیم)</span>
                  </Button>

                  <Button
                    onClick={() => handleOpenDeedModal(selectedPlan)}
                    variant="outline"
                    className="border-violet-200 text-violet-700 hover:bg-violet-50 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Agreement</span>
                  </Button>

                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-5 overflow-y-auto space-y-5">
                {/* 3 Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase">Total Financed:</div>
                    <div className="text-lg font-black text-slate-900">{formatPKR(selectedPlan.total_price)}</div>
                    <div className="text-xs text-emerald-700 font-bold">Advance: {formatPKR(selectedPlan.down_payment)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase">Total Collected:</div>
                    <div className="text-lg font-black text-emerald-700">{formatPKR(selectedPlan.total_paid)}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {Math.round((selectedPlan.total_paid / selectedPlan.total_price) * 100)}% Paid
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase">Remaining Dues:</div>
                    <div className="text-lg font-black text-amber-700">{formatPKR(selectedPlan.remaining_balance)}</div>
                    <div className="text-xs text-slate-500 font-mono">{formatPKR(selectedPlan.monthly_installment)} / month</div>
                  </div>
                </div>

                {/* Schedules Table */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      Payment Schedules & Due Installments (ماہوار اقساط شیڈول)
                    </h4>
                    <Button
                      onClick={() => handleAutoRebalanceAllSchedules(selectedPlan)}
                      variant="outline"
                      size="sm"
                      className="text-[11px] font-bold border-violet-200 text-violet-700 hover:bg-violet-50 rounded-xl h-7 px-2.5 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Automatically recalculate and divide remaining dues across all future unpaid installments"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Rebalance All Remaining (بقیہ اقساط درست / تقسیم کریں)</span>
                    </Button>
                  </div>

                  {schedulesLoading ? (
                    <div className="py-10 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-600 mb-2" />
                      <p className="text-xs font-semibold">Loading schedule rows...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">Due Date</th>
                            <th className="p-3 text-right">Due Amount</th>
                            <th className="p-3 text-right">Paid Amount</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {schedules.map((s) => {
                            const isPaid = s.status === "paid";
                            const hasPaidSome = Number(s.paid_amount) > 0;
                            return (
                              <tr key={s.id} className={isPaid ? "bg-emerald-50/30" : s.is_promise ? "bg-amber-50/40" : "hover:bg-slate-50"}>
                                <td className="p-3 font-mono font-bold text-violet-700">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span>#{s.installment_no}</span>
                                    {s.is_promise ? (
                                      <span className="text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded">
                                        ⭐ {s.promise_title || "وعدہ ادائیگی"}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-600 font-semibold">
                                        قسط
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-medium text-slate-800">
                                  <div>{formatDate(s.due_date)}</div>
                                  {s.manual_receipt_no && (
                                    <div className="text-[10px] text-emerald-700 font-bold">
                                      دستی پرچی: #{s.manual_receipt_no}
                                      {s.manual_book_no ? ` (کھاتہ #${s.manual_book_no})` : ""}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-right font-black text-slate-900">{formatPKR(s.due_amount)}</td>
                                <td className="p-3 text-right font-black text-emerald-700">{formatPKR(s.paid_amount)}</td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                      isPaid
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-200 text-slate-700"
                                    }`}
                                  >
                                    {s.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {(isPaid || hasPaidSome) && (
                                      <Button
                                        onClick={() => handleOpenReceipt(s, selectedPlan)}
                                        size="sm"
                                        variant="outline"
                                        className="border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-bold rounded-xl h-7 px-2.5 flex items-center gap-1 cursor-pointer"
                                        title="Print / WhatsApp Receipt"
                                      >
                                        <Receipt className="w-3 h-3 text-violet-600" />
                                        <span>Receipt</span>
                                      </Button>
                                    )}

                                    {!isPaid && (
                                      <Button
                                        onClick={() => handleOpenReceivePayment(s)}
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-7 px-3 cursor-pointer"
                                      >
                                        Receive Pay
                                      </Button>
                                    )}
                                  </div>
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Receive Payment for a Schedule ──────────────────────────── */}
      <AnimatePresence>
        {activeScheduleForPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                    <span>
                      Receive Qist #{activeScheduleForPayment.installment_no}
                      {activeScheduleForPayment.is_promise ? ` (${activeScheduleForPayment.promise_title || "وعدہ ادائیگی"})` : ""}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Due Amount: <strong className="text-slate-800 font-mono">{formatPKR(activeScheduleForPayment.due_amount)}</strong> • Due Date: {formatDate(activeScheduleForPayment.due_date)}
                  </p>
                </div>
                <button
                  onClick={() => setActiveScheduleForPayment(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePayment} className="mt-4 space-y-3.5">
                {/* Manual Slip No & Book No Inputs */}
                <div className="grid grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/90">
                  <div>
                    <label className="text-xs font-bold text-amber-950 block mb-1">
                      Receipt / Slip # (رسید / پرچی نمبر)
                    </label>
                    <Input
                      placeholder="مثلاً: 542"
                      value={manualReceiptNo}
                      onChange={(e) => setManualReceiptNo(e.target.value)}
                      className="rounded-xl border-amber-200 bg-white text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-amber-950 block mb-1">
                      Khata # (کھاتہ نمبر)
                    </label>
                    <Input
                      placeholder="مثلاً: 03"
                      value={manualBookNo}
                      onChange={(e) => setManualBookNo(e.target.value)}
                      className="rounded-xl border-amber-200 bg-white text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Account Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Deposit Account (وصولی کھاتہ / کیش یا بینک) *
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-violet-500 shadow-2xs"
                    required
                  >
                    <option value="">-- Select Cash or Bank Account --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type || "Cash/Bank"}) — Balance: {formatPKR(acc.current_balance)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Receiving Amount */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Receiving Amount (رقم وصولی) *</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
                    className="font-black text-emerald-700 text-lg rounded-xl border-slate-200 h-11"
                    required
                  />
                </div>

                {/* Live Shortfall / Surplus Auto-Spread Preview Box */}
                {(() => {
                  const due = Number(activeScheduleForPayment.due_amount) || 0;
                  const paidSoFar = Number(activeScheduleForPayment.paid_amount) || 0;
                  const netDue = due - paidSoFar;
                  const diff = netDue - paymentAmount;
                  const futureCount = schedules.filter(
                    (s) => s.installment_no > activeScheduleForPayment.installment_no && s.status !== "paid"
                  ).length;

                  if (diff !== 0 && futureCount > 0) {
                    const perMonth = Math.round(Math.abs(diff) / futureCount);
                    return (
                      <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5 animate-in fade-in">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={autoSpread}
                            onChange={(e) => setAutoSpread(e.target.checked)}
                            className="w-4 h-4 mt-0.5 text-violet-600 rounded border-amber-300 focus:ring-violet-500 cursor-pointer"
                          />
                          <div className="text-xs">
                            <div className="font-black text-amber-900">
                              {diff > 0
                                ? "بقیہ کم رقم اگلی اقساط میں خودکار تقسیم کریں"
                                : "اضافی رقم اگلی اقساط سے خودکار منہا کریں"}
                            </div>
                            <div className="text-amber-700 text-[11px] mt-0.5">
                              {diff > 0
                                ? `قسط میں ${formatPKR(diff)} کی کمی ہے۔ اسے اگلی ${futureCount} اقساط میں برابر تقسیم کر دیا جائے گا۔`
                                : `قسط میں ${formatPKR(Math.abs(diff))} زائد ادا ہوا ہے۔ اگلی ${futureCount} اقساط کا بوجھ کم ہو جائے گا۔`}
                            </div>
                          </div>
                        </label>

                        {autoSpread && (
                          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60 text-[11px] font-semibold text-amber-950 flex items-center justify-between">
                            <span>{diff > 0 ? "ہر ماہوار قسط میں اضافہ:" : "ہر ماہوار قسط میں کمی:"}</span>
                            <span className="font-black text-amber-900">
                              {diff > 0 ? `+${formatPKR(perMonth)}` : `-${formatPKR(perMonth)}`} / ماہوار
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Late Fee (جرمانہ)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={lateFee || ""}
                      onChange={(e) => setLateFee(Number(e.target.value.replace(/\D/g, "")) || 0)}
                      className="rounded-xl border-slate-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Discount (رعایت)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={discount || ""}
                      onChange={(e) => setDiscount(Number(e.target.value.replace(/\D/g, "")) || 0)}
                      className="rounded-xl border-slate-200 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="cash">Cash (نقد)</option>
                      <option value="bank">Bank Transfer / Online</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Received By</label>
                    <Input
                      value={receivedBy}
                      onChange={(e) => setReceivedBy(e.target.value)}
                      placeholder="Cashier / Operator name"
                      className="rounded-xl border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Remarks / Note</label>
                  <Input
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    placeholder="Optional notes..."
                    className="rounded-xl border-slate-200 text-xs"
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveScheduleForPayment(null)}
                    className="flex-1 rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl cursor-pointer"
                  >
                    {isSubmittingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        Saving...
                      </>
                    ) : (
                      "Confirm & Save Receipt"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Deed Print Modal (A4, A5, 80mm & WhatsApp) ──────────────────────── */}
      {deedTargetVehicle && deedTargetInstallment && (
        <ShowroomDeedPrintModal
          isOpen={isDeedModalOpen}
          onClose={() => setIsDeedModalOpen(false)}
          shopName={shopName || "Automotive Showroom"}
          shopPhone={shopPhone || undefined}
          shopAddress={shopAddress || undefined}
          vehicle={deedTargetVehicle}
          installment={deedTargetInstallment}
          schedules={deedTargetSchedules}
          saleType="installment"
          salePrice={Number(deedTargetInstallment.total_price) || 0}
          downPayment={Number(deedTargetInstallment.down_payment) || 0}
          saleDate={deedTargetInstallment.start_date || new Date().toISOString().split("T")[0]}
        />
      )}

      {/* ── Qist Payment Receipt Modal (Print, PDF & WhatsApp) ────────────────── */}
      {receiptTargetPlan && receiptTargetSchedule && (
        <ShowroomReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          shopName={shopName || "Automotive Showroom"}
          shopPhone={shopPhone || undefined}
          shopAddress={shopAddress || undefined}
          vehicle={receiptTargetPlan.showroom_vehicles || vehicles.find((v) => v.id === receiptTargetPlan.vehicle_id)}
          installment={receiptTargetPlan}
          schedule={receiptTargetSchedule}
          accountName={receiptTargetAccountName}
          nextSchedule={receiptTargetNextSchedule}
        />
      )}
    </div>
  );
}

export default function ShowroomInstallmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
          <p className="text-xs font-semibold">Loading installments dashboard...</p>
        </div>
      }
    >
      <ShowroomInstallmentsContent />
    </Suspense>
  );
}
