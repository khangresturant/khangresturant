"use client";

import React, { useState, useEffect } from "react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Plus, Edit2, Trash2, Key, ShieldAlert, Loader2, 
  X, CheckSquare, Square, ShieldCheck, Mail, User, Shield, FileText, Landmark, DollarSign, Printer, Phone
} from "lucide-react";
import { toast } from "sonner";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";
import { logAudit } from "@/utils/audit";
import { jsPDF } from "jspdf";

interface StaffProfile {
  id: string;
  name: string;
  email: string;
  role: string; // 'salesman' | 'manager' | 'superadmin' | 'rider'
  phone?: string | null;
  created_at: string;
  permissions: {
    panels: Record<string, boolean>;
    actions: Record<string, boolean>;
    max_discount_percentage?: number;
    attendance?: any;
    leaves?: any;
    loans?: any;
    base_salary?: number;
    wage_type?: "monthly" | "daily" | "hourly" | "weekly";
    is_offline?: boolean;
  } | null;
}

const PANELS = [
  { key: "dashboard", label: "Overview Dashboard" },
  { key: "pos", label: "POS / Cashier" },
  { key: "sales", label: "Sales & Ledger" },
  { key: "products", label: "Products & Stock" },
  { key: "categories", label: "Categories" },
  { key: "brands", label: "Brands" },
  { key: "units", label: "Units & Packings" },
  { key: "purchase", label: "Purchase / Stock-In" },
  { key: "returns", label: "Returns / Adjustments" },
  { key: "expenses", label: "Expenses" },
  { key: "khata", label: "Khata (Ledger)" },
  { key: "registers", label: "Register Ledger" },
  { key: "accounts", label: "Accounts Ledger" },
  { key: "staff", label: "Staff Management" },
  { key: "backup", label: "Database Backups" }
];

const ACTIONS = [
  { key: "edit_bill", label: "Edit Bills" },
  { key: "delete_bill", label: "Delete / Void Bills" },
  { key: "edit_account", label: "Edit Accounts" },
  { key: "delete_account", label: "Delete Accounts" }
];

const DEFAULT_PERMISSIONS = {
  panels: {
    dashboard: true,
    pos: true,
    sales: true,
    registers: true,
    purchase: true,
    products: true,
    categories: true,
    brands: true,
    units: true,
    khata: true,
    returns: true,
    expenses: true,
    accounts: true,
    staff: false,
    backup: false
  },
  actions: {
    edit_bill: false,
    delete_bill: false,
    edit_account: false,
    delete_account: false
  }
};

export default function StaffPage() {
  const { shopId, userId, userRole, hasPayroll, subscriptionTier, shopName } = useShop();
  const { t } = useLanguage();
  const supabase = createClient();

  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("salesman");
  const [phone, setPhone] = useState("");
  const [panelsPerms, setPanelsPerms] = useState<Record<string, boolean>>({});
  const [actionsPerms, setActionsPerms] = useState<Record<string, boolean>>({});
  const [modalTab, setModalTab] = useState<"profile" | "permissions">("profile");
  const [maxDiscountPercentage, setMaxDiscountPercentage] = useState<number>(100);
  const [baseSalary, setBaseSalary] = useState<number>(0);
  const [staffWageType, setStaffWageType] = useState<"monthly" | "daily" | "hourly" | "weekly">("monthly");
  const [isOfflineEmployee, setIsOfflineEmployee] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Payroll State
  const [activeTab, setActiveTab] = useState<"staff" | "payroll" | "attendance" | "loans" | "leaves">("staff");
  const [payrollSubTab, setPayrollSubTab] = useState<"process" | "history">("process");
  const [payrollSlips, setPayrollSlips] = useState<any[]>([]);
  const [payrollCycle, setPayrollCycle] = useState<"monthly" | "weekly" | "daily" | "custom">("monthly");
  
  // Dynamic Cycle Dates
  const [slipDate, setSlipDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [slipWeekStart, setSlipWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sun, 1 is Mon
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split("T")[0];
  });
  const [slipWeekEnd, setSlipWeekEnd] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 6;
    const sunday = new Date(d.setDate(diff));
    return sunday.toISOString().split("T")[0];
  });
  const [slipCustomStart, setSlipCustomStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [slipCustomEnd, setSlipCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [cashAccounts, setCashAccounts] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, {
    baseSalary: number;
    presentDays: number;
    allowances: number;
    deductions: number;
    wageType?: string;
  }>>({});
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Attendance state
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split("T")[0];
  });
  const [attendanceTemp, setAttendanceTemp] = useState<Record<string, string>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceSubTab, setAttendanceSubTab] = useState<"logs" | "leaves" | "loans">("logs");

  // Biometric Simulator states
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [selectedBioStaffId, setSelectedBioStaffId] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);

  // Leave Form states
  const [leaveStaffId, setLeaveStaffId] = useState("");
  const [leaveType, setLeaveType] = useState<"annual" | "sick" | "casual" | "unpaid">("annual");
  const [leaveDate, setLeaveDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveReason, setLeaveReason] = useState("");
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // Loan Form states
  const [loanStaffId, setLoanStaffId] = useState("");
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [loanInstallments, setLoanInstallments] = useState<number>(1);
  const [loanReason, setLoanReason] = useState("");
  const [loanAccountId, setLoanAccountId] = useState("");
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  useEffect(() => {
    const initialTemp: Record<string, string> = {};
    staffList.forEach(staff => {
      const records = staff.permissions?.attendance || {};
      initialTemp[staff.id] = records[attendanceDate] || "present";
    });
    setAttendanceTemp(initialTemp);
  }, [attendanceDate, staffList]);

  const calculatePresentDays = (staff: any, monthStr: string) => {
    const attendance = staff.permissions?.attendance || {};
    const daysInMonth = getDaysInMonth(monthStr);
    let presentCount = 0;
    const [year, month] = monthStr.split("-").map(Number);
    let hasLogs = false;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (attendance[dateStr]) {
        hasLogs = true;
        const status = attendance[dateStr];
        if (status === "present" || status === "late") {
          presentCount += 1;
        } else if (status === "halfday") {
          presentCount += 0.5;
        }
      }
    }
    return hasLogs ? presentCount : daysInMonth;
  };

  const handleSaveAttendance = async () => {
    setSavingAttendance(true);
    const toastId = toast.loading("Saving attendance records...");
    try {
      const nonAdmins = staffList;
      for (const staff of nonAdmins) {
        const status = attendanceTemp[staff.id] || "present";
        const currentPerms = (staff.permissions || {}) as any;
        const currentAttendance = currentPerms.attendance || {};

        const updatedAttendance = {
          ...currentAttendance,
          [attendanceDate]: status
        };

        const updatedPerms = {
          ...currentPerms,
          attendance: updatedAttendance
        };

        const { error } = await supabase
          .from("user_profiles")
          .update({
            permissions: updatedPerms
          })
          .eq("id", staff.id);

        if (error) throw error;

        logAudit(
          shopId!,
          userId,
          "STAFF_ATTENDANCE_SAVED",
          "user_profiles",
          staff.id,
          {
            staff_id: staff.id,
            staff_name: staff.name,
            date: attendanceDate,
            status: status
          }
        );
      }
      toast.success("Attendance saved successfully!", { id: toastId });
      fetchStaff();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to save attendance: " + e.message, { id: toastId });
    } finally {
      setSavingAttendance(false);
    }
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.warn("Audio context failed: ", e);
    }
  };

  const handleSimulateScan = () => {
    if (!selectedBioStaffId) {
      toast.error("Please select an employee first!");
      return;
    }
    setIsScanning(true);
    setScanCompleted(false);

    setTimeout(() => {
      setIsScanning(false);
      setScanCompleted(true);
      playBeep();

      const employee = staffList.find(s => s.id === selectedBioStaffId);
      if (employee) {
        setAttendanceTemp(prev => ({
          ...prev,
          [selectedBioStaffId]: "present"
        }));
        toast.success(`Biometric Match: ${employee.name} marked Present! 🔒`);
      }

      setTimeout(() => {
        setIsBiometricModalOpen(false);
        setScanCompleted(false);
      }, 1000);
    }, 1800);
  };

  const calculateLoansDeduction = (staff: any) => {
    const loans = staff.permissions?.loans || [];
    let totalDeduction = 0;
    loans.forEach((loan: any) => {
      if (loan.remainingAmount > 0) {
        totalDeduction += Math.min(loan.remainingAmount, loan.installmentAmount);
      }
    });
    return totalDeduction;
  };

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStaffId) return toast.error("Please select an employee");

    setSubmitting(true);
    const toastId = toast.loading("Recording leave request...");
    try {
      const staff = staffList.find(s => s.id === leaveStaffId);
      if (!staff) throw new Error("Staff not found");

      const currentPerms = (staff.permissions || {}) as any;
      const currentLeaves = currentPerms.leaves || [];
      
      const newLeave = {
        id: Math.random().toString(36).substring(2),
        date: leaveDate,
        type: leaveType,
        reason: leaveReason
      };

      const updatedPerms = {
        ...currentPerms,
        leaves: [...currentLeaves, newLeave]
      };

      const { error } = await supabase
        .from("user_profiles")
        .update({
          permissions: updatedPerms
        })
        .eq("id", leaveStaffId);

      if (error) throw error;
      logAudit(
        shopId!,
        userId,
        "STAFF_LEAVE_RECORDED",
        "user_profiles",
        leaveStaffId,
        {
          staff_id: leaveStaffId,
          staff_name: staff.name,
          leave_id: newLeave.id,
          date: leaveDate,
          type: leaveType,
          reason: leaveReason
        }
      );
      toast.success("Leave recorded successfully!", { id: toastId });
      setIsLeaveModalOpen(false);
      setLeaveReason("");
      fetchStaff();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to record leave: " + e.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanStaffId) return toast.error("Please select an employee");
    if (loanAmount <= 0) return toast.error("Please enter a valid loan amount");
    if (!loanAccountId) return toast.error("Please select a payout account");

    setSubmitting(true);
    const toastId = toast.loading("Processing loan disbursement...");
    try {
      const staff = staffList.find(s => s.id === loanStaffId);
      if (!staff) throw new Error("Staff not found");

      const currentPerms = (staff.permissions || {}) as any;
      const currentLoans = currentPerms.loans || [];

      const installmentAmount = Math.round(loanAmount / loanInstallments);
      const newLoan = {
        id: Math.random().toString(36).substring(2),
        date: new Date().toISOString().split("T")[0],
        amount: loanAmount,
        totalInstallments: loanInstallments,
        remainingAmount: loanAmount,
        installmentAmount: installmentAmount,
        reason: loanReason,
        paidInstallments: 0
      };

      const { error: txError } = await supabase.from("account_transactions").insert({
        shop_id: shopId,
        account_id: loanAccountId,
        type: "withdrawal",
        amount: loanAmount,
        remarks: `Salary Advance/Loan to ${staff.name} (${loanInstallments} installments of Rs ${installmentAmount})`
      });
      if (txError) throw txError;

      const updatedPerms = {
        ...currentPerms,
        loans: [...currentLoans, newLoan]
      };

      const { error } = await supabase
        .from("user_profiles")
        .update({
          permissions: updatedPerms
        })
        .eq("id", loanStaffId);

      if (error) throw error;

      logAudit(
        shopId!,
        userId,
        "STAFF_LOAN_DISBURSED",
        "user_profiles",
        loanStaffId,
        {
          staff_id: loanStaffId,
          staff_name: staff.name,
          loan_id: newLoan.id,
          amount: loanAmount,
          installments: loanInstallments,
          reason: loanReason,
          account_id: loanAccountId
        }
      );

      toast.success("Loan disbursed successfully!", { id: toastId });
      setIsLoanModalOpen(false);
      setLoanAmount(0);
      setLoanReason("");
      fetchStaff();
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to disburse loan: " + e.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "payroll") {
        setActiveTab("payroll");
      }
    }
  }, []);
  
  // Payslip Form
  const [isAddPayslipOpen, setIsAddPayslipOpen] = useState(false);
  const [slipStaffId, setSlipStaffId] = useState("");
  const [slipMonth, setSlipMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  });
  const [slipBaseSalary, setSlipBaseSalary] = useState<number>(0);
  const [slipAllowances, setSlipAllowances] = useState<number>(0);
  const [slipDeductions, setSlipDeductions] = useState<number>(0);
  const [slipAccountId, setSlipAccountId] = useState("");

  const getPeriodKey = () => {
    if (payrollCycle === "daily") {
      return `DAILY:${slipDate}`;
    } else if (payrollCycle === "weekly") {
      return `WEEK:${slipWeekStart}_to_${slipWeekEnd}`;
    } else if (payrollCycle === "custom") {
      return `CUSTOM:${slipCustomStart}_to_${slipCustomEnd}`;
    }
    return slipMonth; // e.g. 2026-08
  };

  const getPeriodLabel = () => {
    if (payrollCycle === "daily") {
      return `Daily (${slipDate})`;
    } else if (payrollCycle === "weekly") {
      return `Week (${slipWeekStart} to ${slipWeekEnd})`;
    } else if (payrollCycle === "custom") {
      return `Period (${slipCustomStart} to ${slipCustomEnd})`;
    }
    return `Month ${slipMonth}`;
  };

  const getCycleTotalDays = () => {
    if (payrollCycle === "daily") return 1;
    if (payrollCycle === "weekly") return 7;
    if (payrollCycle === "custom") {
      const s = new Date(slipCustomStart).getTime();
      const e = new Date(slipCustomEnd).getTime();
      const diff = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
      return isNaN(diff) ? 30 : diff;
    }
    return getDaysInMonth(slipMonth);
  };

  const calculateRangePresentDays = (staff: any, startDateStr: string, endDateStr: string) => {
    const attendance = staff.permissions?.attendance || {};
    let presentCount = 0;
    let hasLogs = false;
    
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = curr.toISOString().split("T")[0];
      if (attendance[dateStr]) {
        hasLogs = true;
        const status = attendance[dateStr];
        if (status === "present" || status === "late") {
          presentCount += 1;
        } else if (status === "halfday") {
          presentCount += 0.5;
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (hasLogs) return presentCount;
    return totalDays;
  };

  const getDaysInMonth = (monthStr: string) => {
    if (!monthStr) return 30;
    const [year, month] = monthStr.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

  useEffect(() => {
    if (staffList.length > 0) {
      const days = getDaysInMonth(slipMonth);
      const initialData: typeof attendanceData = {};
      const activeIds: string[] = [];
      
      staffList.forEach(staff => {
        initialData[staff.id] = {
          baseSalary: staff.permissions?.base_salary ?? 0,
          presentDays: calculatePresentDays(staff, slipMonth),
          allowances: 0,
          deductions: calculateLoansDeduction(staff),
          wageType: staff.permissions?.wage_type || "monthly"
        };
        activeIds.push(staff.id);
      });
      setAttendanceData(initialData);
      setSelectedEmployeeIds(activeIds);
    }
  }, [staffList, slipMonth]);

  const allStaffIds = staffList.map(s => s.id);
  const isAllSelected = allStaffIds.length > 0 && selectedEmployeeIds.length === allStaffIds.length;
  
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(allStaffIds);
    }
  };

  const handleAttendanceChange = (staffId: string, field: "baseSalary" | "presentDays" | "allowances" | "deductions" | "wageType", value: any) => {
    setAttendanceData(prev => {
      const updated = prev[staffId] ? { ...prev[staffId] } : { baseSalary: 0, presentDays: 30, allowances: 0, deductions: 0, wageType: "monthly" };
      (updated as any)[field] = value;
      return {
        ...prev,
        [staffId]: updated
      };
    });
  };

  const toggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (cashAccounts.length > 0 && !slipAccountId) {
      setSlipAccountId(cashAccounts[0].id);
    }
  }, [cashAccounts, slipAccountId]);

  useEffect(() => {
    if (shopId && userRole === "superadmin") {
      fetchStaff();
    }
  }, [shopId, userRole]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("shop_id", shopId)
        .order("name");

      if (error) throw error;
      setStaffList(data || []);

      if (hasPayroll) {
        // Fetch Payroll Slips
        const { data: slips, error: slipsErr } = await supabase
          .from("payroll_slips")
          .select("*, user_profiles!inner(name, email, role)")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false });
        if (slipsErr) throw slipsErr;
        setPayrollSlips(slips || []);

        // Fetch Accounts for payment
        const { data: accs, error: accsErr } = await supabase
          .from("cash_accounts")
          .select("id, name, current_balance")
          .eq("shop_id", shopId);
        if (accsErr) throw accsErr;
        setCashAccounts(accs || []);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (userRole !== "superadmin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-lg mx-auto mt-12">
        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 animate-bounce">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-lg font-black text-zinc-900 mb-2">Access Denied</h1>
        <p className="text-zinc-600 mb-6">
          Only the Superadmin role has permission to access Staff Management and modify access controls.
        </p>
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

  const openAddModal = () => {
    setSelectedStaff(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("salesman");
    setPhone("");
    setModalTab("profile");
    setMaxDiscountPercentage(100);
    setBaseSalary(0);
    setStaffWageType("monthly");
    setIsOfflineEmployee(false);
    
    // Initialize permissions with defaults
    const initialPanels: Record<string, boolean> = {};
    const initialActions: Record<string, boolean> = {};
    PANELS.forEach(p => initialPanels[p.key] = DEFAULT_PERMISSIONS.panels[p.key as keyof typeof DEFAULT_PERMISSIONS.panels] ?? false);
    ACTIONS.forEach(a => initialActions[a.key] = DEFAULT_PERMISSIONS.actions[a.key as keyof typeof DEFAULT_PERMISSIONS.actions] ?? false);
    
    setPanelsPerms(initialPanels);
    setActionsPerms(initialActions);
    setModalOpen(true);
  };

  const openEditModal = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setName(staff.name);
    setEmail(staff.email || "");
    setPassword("");
    setRole(staff.role);
    setPhone(staff.phone || "");
    setModalTab("profile");
    setMaxDiscountPercentage(staff.permissions?.max_discount_percentage ?? 100);
    setBaseSalary(staff.permissions?.base_salary ?? 0);
    setStaffWageType(staff.permissions?.wage_type || "monthly");
    setIsOfflineEmployee(staff.permissions?.is_offline ?? false);

    // Load existing permissions or defaults
    const staffPanels = staff.permissions?.panels || {};
    const staffActions = staff.permissions?.actions || {};
    
    const initialPanels: Record<string, boolean> = {};
    const initialActions: Record<string, boolean> = {};
    
    PANELS.forEach(p => {
      initialPanels[p.key] = staffPanels[p.key] ?? false;
    });
    
    ACTIONS.forEach(a => {
      initialActions[a.key] = staffActions[a.key] ?? false;
    });

    setPanelsPerms(initialPanels);
    setActionsPerms(initialActions);
    setModalOpen(true);
  };

  const togglePanelPerm = (key: string) => {
    setPanelsPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleActionPerm = (key: string) => {
    setActionsPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    // Auto-adjust permissions based on role
    if (newRole === "superadmin") {
      const allTruePanels: Record<string, boolean> = {};
      const allTrueActions: Record<string, boolean> = {};
      PANELS.forEach(p => allTruePanels[p.key] = true);
      ACTIONS.forEach(a => allTrueActions[a.key] = true);
      setPanelsPerms(allTruePanels);
      setActionsPerms(allTrueActions);
    } else if (newRole === "salesman" || newRole === "rider") {
      const salePanels: Record<string, boolean> = {};
      PANELS.forEach(p => salePanels[p.key] = p.key !== "staff" && p.key !== "backup" && p.key !== "accounts");
      setPanelsPerms(salePanels);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");

    setSubmitting(true);
    const toastId = toast.loading(selectedStaff ? "Updating staff..." : "Registering new staff...");

    try {
      const formattedPermissions = {
        panels: panelsPerms,
        actions: actionsPerms,
        max_discount_percentage: maxDiscountPercentage,
        base_salary: baseSalary,
        wage_type: staffWageType,
        is_offline: isOfflineEmployee,
        phone: phone.trim() || null,
      };

      if (selectedStaff) {
        if (selectedStaff.permissions?.is_offline) {
          // Update offline employee directly
          const { error } = await supabase
            .from("user_profiles")
            .update({
              name: name.trim(),
              role,
              phone: phone.trim() || null,
              permissions: formattedPermissions
            })
            .eq("id", selectedStaff.id);
          if (error) throw error;
        } else {
          // Edit system staff user via RPC
          const { error } = await supabase.rpc("update_staff_user", {
            staff_id: selectedStaff.id,
            staff_name: name,
            staff_role: role,
            staff_permissions: formattedPermissions,
            staff_password: password || null
          });
          if (error) throw error;
          await supabase
            .from("user_profiles")
            .update({ phone: phone.trim() || null })
            .eq("id", selectedStaff.id);
        }

        // Sync party name
        if (name.trim() !== selectedStaff.name) {
          await supabase
            .from("parties")
            .update({ name: `${name.trim()} (Staff)` })
            .eq("shop_id", shopId)
            .eq("name", `${selectedStaff.name} (Staff)`);
        }

        logAudit(
          shopId!,
          userId,
          "STAFF_UPDATED",
          "user_profiles",
          selectedStaff.id,
          {
            staff_id: selectedStaff.id,
            name: name.trim(),
            role
          }
        );
        toast.success("Staff profile updated successfully", { id: toastId });
      } else {
        let createdUserId = "new";
        if (isOfflineEmployee) {
          // Create offline-only employee directly into user_profiles (no Auth)
          const newOfflineUserId = crypto.randomUUID();
          const { data: profileData, error: profileErr } = await supabase
            .from("user_profiles")
            .insert({
              id: newOfflineUserId,
              shop_id: shopId,
              name: name.trim(),
              email: email.trim() || `staff_${Date.now()}@shop.local`,
              role,
              phone: phone.trim() || null,
              permissions: formattedPermissions
            })
            .select("id")
            .single();
          if (profileErr) throw profileErr;
          if (profileData) createdUserId = profileData.id;
        } else {
          // Create new system staff user with Auth account
          if (!email.trim()) throw new Error("Email is required");
          if (!password.trim()) throw new Error("Password is required");

          const { data: newUserId, error } = await supabase.rpc("create_staff_user", {
            staff_email: email,
            staff_password: password,
            staff_name: name,
            staff_shop_id: shopId,
            staff_role: role,
            staff_permissions: formattedPermissions
          });
          if (error) throw error;
          if (newUserId) createdUserId = newUserId as string;
          if (createdUserId && createdUserId !== "new") {
            await supabase
              .from("user_profiles")
              .update({ phone: phone.trim() || null })
              .eq("id", createdUserId);
          }
        }

        // Create party record for any employee type
        await supabase.from("parties").insert({
          shop_id: shopId,
          name: `${name.trim()} (Staff)`,
          phone: null,
          type: "customer",
          opening_balance: 0
        });

        logAudit(
          shopId!,
          userId,
          "STAFF_REGISTERED",
          "user_profiles",
          createdUserId,
          {
            name: name.trim(),
            email: isOfflineEmployee ? null : email.trim(),
            role,
            is_offline: isOfflineEmployee
          }
        );
        toast.success(isOfflineEmployee ? "Offline employee added successfully ✅" : "Staff registered successfully", { id: toastId });
      }

      setModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;
    setSubmitting(true);
    const toastId = toast.loading("Deleting staff user...");

    try {
      if (selectedStaff.permissions?.is_offline) {
        // Delete offline employee directly from user_profiles
        const { error } = await supabase
          .from("user_profiles")
          .delete()
          .eq("id", selectedStaff.id);
        if (error) throw error;
      } else {
        // Delete system user via RPC
        const { error } = await supabase.rpc("delete_staff_user", {
          staff_id: selectedStaff.id
        });
        if (error) throw error;
      }

      // Delete corresponding party record
      await supabase
        .from("parties")
        .delete()
        .eq("shop_id", shopId)
        .eq("name", `${selectedStaff.name} (Staff)`);

      logAudit(
        shopId!,
        userId,
        "STAFF_DELETED",
        "user_profiles",
        selectedStaff.id,
        {
          staff_id: selectedStaff.id,
          name: selectedStaff.name,
          role: selectedStaff.role
        }
      );
      toast.success("Staff member deleted successfully", { id: toastId });
      setDeleteConfirmOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete: " + err.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const calculateEarnedSalary = (
    baseRate: number,
    presentDays: number,
    totalCycleDays: number,
    wageType: string = "monthly",
    cycleType: string = "monthly",
    allowances: number = 0,
    deductions: number = 0
  ) => {
    let earnedSalary = 0;
    if (wageType === "daily") {
      earnedSalary = Math.round(baseRate * presentDays);
    } else if (wageType === "hourly") {
      earnedSalary = Math.round(baseRate * (presentDays * 8));
    } else if (wageType === "weekly") {
      if (cycleType === "weekly") {
        earnedSalary = Math.round(baseRate * (presentDays / 6));
      } else {
        earnedSalary = Math.round((baseRate / 6) * presentDays);
      }
    } else {
      // Monthly base salary worker
      if (cycleType === "daily" || cycleType === "weekly") {
        earnedSalary = Math.round((baseRate / 30) * presentDays);
      } else {
        const safeDays = totalCycleDays > 0 ? totalCycleDays : 30;
        earnedSalary = Math.round((baseRate / safeDays) * presentDays);
      }
    }
    const netPayable = Math.max(0, earnedSalary + (allowances || 0) - (deductions || 0));
    return { earnedSalary, netPayable };
  };

  const processSalaryPayment = async (
    staffId: string,
    empBaseSalary: number,
    empPresentDays: number,
    empAllowances: number,
    empDeductions: number,
    wageType: string = "monthly"
  ) => {
    if (!staffId || !slipAccountId || !slipMonth || empBaseSalary <= 0) {
      throw new Error("Invalid parameters or zero salary.");
    }

    const totalDays = getCycleTotalDays();
    const periodKey = getPeriodKey();
    const periodLabel = getPeriodLabel();
    const { earnedSalary, netPayable } = calculateEarnedSalary(
      empBaseSalary,
      empPresentDays,
      totalDays,
      wageType,
      payrollCycle,
      empAllowances,
      empDeductions
    );
    
    // 1. Insert Payroll Slip
    const { data: slipData, error: slipError } = await supabase.from("payroll_slips").insert({
      shop_id: shopId,
      staff_id: staffId,
      month_year: periodKey,
      base_salary: empBaseSalary,
      allowances: empAllowances,
      deductions: empDeductions,
      net_payable: netPayable,
      status: "paid"
    }).select("id").single();

    if (slipError) throw slipError;

    // 2. Automatically deduct from Cash Account
    const selectedStaff = staffList.find(s => s.id === staffId);
    const staffName = selectedStaff ? selectedStaff.name : "Staff";
    
    const { error: txError } = await supabase.from("account_transactions").insert({
      shop_id: shopId,
      account_id: slipAccountId,
      type: "withdrawal",
      amount: netPayable,
      remarks: `Salary Payment [${periodLabel}] - ${staffName} (${wageType.toUpperCase()}: ${empPresentDays} presents/units, Base: Rs ${empBaseSalary})`
    });

    if (txError) throw txError;

    // 3. Sync with Employee Ledger/Khata
    const { data: partyData } = await supabase
      .from("parties")
      .select("id")
      .eq("shop_id", shopId)
      .eq("name", `${staffName} (Staff)`)
      .eq("type", "customer")
      .maybeSingle();

    if (partyData) {
      const grossSalary = earnedSalary + empAllowances;

      // Log Salary Earned (Charge)
      const { error: earnError } = await supabase
        .from("credit_transactions")
        .insert({
          shop_id: shopId,
          customer_id: partyData.id,
          amount: grossSalary,
          transaction_type: "charge",
          remarks: `Salary Earned [${periodLabel}] (${wageType.toUpperCase()}: ${empPresentDays} presents/units)`
        });
      if (!earnError) {
        await supabase.rpc("increment_party_balance", {
          p_id: partyData.id,
          amount: grossSalary
        });
      }

      // Log Salary Paid (Payment)
      const { error: payError } = await supabase
        .from("credit_transactions")
        .insert({
          shop_id: shopId,
          customer_id: partyData.id,
          amount: netPayable,
          transaction_type: "payment",
          remarks: `Salary Disbursed [${periodLabel}]`
        });
      if (!payError) {
        await supabase.rpc("increment_party_balance", {
          p_id: partyData.id,
          amount: -netPayable
        });
      }
    }

    // 4. Deduct outstanding loan balances from employee profile permissions
    if (selectedStaff) {
      const loans = selectedStaff.permissions?.loans || [];
      let loansUpdated = false;
      const updatedLoans = loans.map((loan: any) => {
        if (loan.remainingAmount > 0) {
          const deduct = Math.min(loan.remainingAmount, loan.installmentAmount);
          loansUpdated = true;
          return {
            ...loan,
            remainingAmount: loan.remainingAmount - deduct,
            paidInstallments: (loan.paidInstallments || 0) + 1
          };
        }
        return loan;
      });

      if (loansUpdated) {
        const updatedPerms = {
          ...selectedStaff.permissions,
          loans: updatedLoans
        };
        await supabase
          .from("user_profiles")
          .update({
            permissions: updatedPerms
          })
          .eq("id", staffId);
      }
    }

    logAudit(
      shopId!,
      userId,
      "PAYSLIP_GENERATED",
      "payroll_slips",
      slipData.id,
      {
        staff_id: staffId,
        staff_name: staffName,
        payroll_slip_id: slipData.id,
        month_year: periodKey,
        base_salary: empBaseSalary,
        allowances: empAllowances,
        deductions: empDeductions,
        net_payable: netPayable,
        wage_type: wageType,
        account_id: slipAccountId
      }
    );

    return true;
  };

  const handleIssueSingle = async (staffId: string) => {
    const data = attendanceData[staffId];
    if (!data) return;

    if (data.baseSalary <= 0) {
      toast.error("Please enter a valid base salary greater than 0 first.");
      return;
    }

    if (!slipAccountId) {
      toast.error("Please select a bank/cash account first.");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Processing salary...");

    try {
      const staff = staffList.find(s => s.id === staffId);
      const wageType = data.wageType || staff?.permissions?.wage_type || "monthly";
      await processSalaryPayment(
        staffId,
        data.baseSalary,
        data.presentDays,
        data.allowances,
        data.deductions,
        wageType
      );
      toast.success("Payslip generated successfully! 💸", { id: toastId });
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to process salary.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueBulk = async () => {
    if (selectedEmployeeIds.length === 0) {
      toast.error("Please select at least one employee to issue salary.");
      return;
    }
    if (!slipAccountId) {
      toast.error("Please select a bank/cash account first.");
      return;
    }

    const eligibleIds = selectedEmployeeIds.filter(id => {
      const alreadyPaid = payrollSlips.some(
        s => s.staff_id === id && s.month_year === getPeriodKey()
      );
      const data = attendanceData[id];
      return !alreadyPaid && data && data.baseSalary > 0;
    });

    if (eligibleIds.length === 0) {
      toast.error("No eligible employees with valid base salaries selected (or all already paid for this month).");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(`Processing salaries for ${eligibleIds.length} employee(s)...`);

    let successCount = 0;
    let failCount = 0;

    for (const staffId of eligibleIds) {
      const data = attendanceData[staffId];
      if (!data) continue;
      try {
        const staff = staffList.find(s => s.id === staffId);
        const wageType = data.wageType || staff?.permissions?.wage_type || "monthly";
        await processSalaryPayment(
          staffId,
          data.baseSalary,
          data.presentDays,
          data.allowances,
          data.deductions,
          wageType
        );
        successCount++;
      } catch (e) {
        console.error(`Failed to disburse salary for staff ${staffId}:`, e);
        failCount++;
      }
    }

    setSubmitting(false);
    if (successCount > 0) {
      toast.success(`Successfully disbursed salaries for ${successCount} staff member(s)! 💸`, { id: toastId });
      fetchStaff();
    } else {
      toast.error("Failed to disburse any salaries.", { id: toastId });
    }
  };

  const generatePayslipPDF = (slip: any) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a5"
      });

      // Outer border
      doc.setDrawColor(200, 200, 200);
      doc.rect(5, 5, 138, 200);

      // Shop Name Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(shopName || "THE ACCOUNTS ERP", 74, 18, { align: "center" });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 110, 120);
      doc.text("SALARY PAYSLIP", 74, 24, { align: "center" });

      // Main line
      doc.setLineWidth(0.5);
      doc.line(10, 28, 138, 28);

      // Metadata layout
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Employee Details", 12, 36);
      doc.setFont("helvetica", "normal");
      doc.text(`Name: ${slip.user_profiles?.name || "N/A"}`, 12, 42);
      doc.text(`Role: ${slip.user_profiles?.role || "Staff"}`, 12, 47);
      doc.text(`Email: ${slip.user_profiles?.email || "N/A"}`, 12, 52);

      doc.setFont("helvetica", "bold");
      doc.text("Payslip Details", 80, 36);
      doc.setFont("helvetica", "normal");
      doc.text(`Month/Year: ${slip.month_year}`, 80, 42);
      doc.text(`Disbursed On: ${new Date(slip.created_at).toLocaleDateString()}`, 80, 47);
      doc.text(`Status: ${slip.status || "Paid"}`, 80, 52);

      // Separation line
      doc.line(10, 58, 138, 58);

      // Earnings Table Headers
      doc.setFont("helvetica", "bold");
      doc.text("Description", 12, 66);
      doc.text("Amount (Rs)", 126, 66, { align: "right" });

      doc.setLineWidth(0.2);
      doc.line(10, 70, 138, 70);

      // Salary details
      doc.setFont("helvetica", "normal");
      doc.text("Base Salary", 12, 78);
      doc.text(`Rs ${Number(slip.base_salary || 0).toLocaleString()}`, 126, 78, { align: "right" });

      let currentY = 84;
      const allowances = Number(slip.allowances || 0);
      const deductions = Number(slip.deductions || 0);

      if (allowances > 0) {
        doc.text("Allowances", 12, currentY);
        doc.setTextColor(16, 185, 129);
        doc.text(`+ Rs ${allowances.toLocaleString()}`, 126, currentY, { align: "right" });
        doc.setTextColor(30, 41, 59);
        currentY += 6;
      }

      if (deductions > 0) {
        doc.text("Deductions", 12, currentY);
        doc.setTextColor(239, 68, 68);
        doc.text(`- Rs ${deductions.toLocaleString()}`, 126, currentY, { align: "right" });
        doc.setTextColor(30, 41, 59);
        currentY += 6;
      }

      // Net Pay section
      doc.setLineWidth(0.5);
      doc.line(10, 130, 138, 130);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Net Paid Amount:", 12, 138);
      doc.text(`Rs ${Number(slip.net_payable || 0).toLocaleString()}`, 126, 138, { align: "right" });

      // Signatures
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 130, 140);

      doc.line(15, 175, 55, 175);
      doc.text("Employer Signature", 35, 180, { align: "center" });

      doc.line(93, 175, 133, 175);
      doc.text("Employee Signature", 113, 180, { align: "center" });

      // Footer
      doc.setFontSize(7);
      doc.text("Generated automatically via The Accounts ERP cloud platform.", 74, 192, { align: "center" });

      doc.save(`Payslip_${slip.user_profiles?.name || "Staff"}_${slip.month_year}.pdf`);
      toast.success("Payslip PDF downloaded successfully!");
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to generate PDF: " + e.message);
    }
  };

  if (subscriptionTier === "free") {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-black text-zinc-900 flex items-center gap-2">
            <Users className="text-blue-600" />
            HR & Staff Management
          </h1>
        </div>
        <SubscriptionBlocker featureName="Staff Management Roles & Control" requiredPlan="Starter" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-4">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {hasPayroll && (
            <div className="bg-slate-100 p-1 rounded-xl inline-flex text-xs font-semibold shrink-0">
              <button
                onClick={() => setActiveTab("staff")} className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === "staff" ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500"}`}>👥 Staff Directory</button><button onClick={() => setActiveTab("payroll")} className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === "payroll" ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500"}`}>💳 Payroll Slips</button><button onClick={() => setActiveTab("attendance")} className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === "attendance" ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500"}`}>📅 Attendance Log</button><button onClick={() => { setActiveTab("loans"); setAttendanceSubTab("loans"); }} className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === "loans" ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500"}`}>💰 Advance Loans (Udhaar)</button><button onClick={() => { setActiveTab("leaves"); setAttendanceSubTab("leaves"); }} className={`px-3.5 py-1.5 rounded-xl transition-all ${activeTab === "leaves" ? "bg-white text-blue-600 shadow-sm font-black" : "text-slate-500"}`}>🚪 Leave Manager</button></div>
          )}
          {activeTab === "staff" && (
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm shrink-0"
            >
              <Plus size={18} />
              Add Staff User
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-zinc-400 mb-3" size={32} />
          <div className="text-zinc-500 text-sm">Loading data...</div>
        </div>
      ) : activeTab === "staff" ? (
        staffList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white border border-zinc-200 border-dashed rounded-xl text-center">
            <Users className="text-zinc-300 mb-3" size={48} />
            <h3 className="font-semibold text-zinc-800 text-base">No Staff Found</h3>
            
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
            >
              Add First Staff
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffList.map((staff) => (
            <motion.div
              layout
              key={staff.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition duration-200 ${
                staff.permissions?.is_offline
                  ? "border-amber-200 hover:border-amber-300"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-base shadow-inner ${
                      staff.permissions?.is_offline
                        ? "bg-amber-50 text-amber-600"
                        : "bg-blue-50 text-blue-600"
                    }`}>
                      {staff.permissions?.is_offline ? "👤" : (staff.name?.charAt(0).toUpperCase() || "S")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-950 leading-tight">{staff.name}</h3>
                        {staff.permissions?.is_offline && (
                          <div className="inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            Offline
                          </div>
                        )}
                      </div>
                      <div className={`inline-block text-[10px] font-black uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full ${
                        staff.role === "superadmin" 
                          ? "bg-purple-100 text-purple-700" 
                          : staff.role === "manager" 
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-zinc-100 text-zinc-700"
                      }`}>
                        {staff.role}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-zinc-600 border-t border-zinc-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-zinc-400" />
                    <div className="truncate">{staff.permissions?.is_offline ? "No Login Account" : (staff.email || "No Email")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-zinc-400" />
                    <div>
                      {staff.permissions?.is_offline
                        ? "Payroll / Attendance only"
                        : staff.role === "superadmin"
                          ? "Full Administrative Access"
                          : `${Object.values(staff.permissions?.panels || {}).filter(Boolean).length} / ${PANELS.length} Panels enabled`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4 mt-5">
                <button
                  onClick={() => openEditModal(staff)}
                  className="p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Edit2 size={14} />
                  Permissions
                </button>
                {staff.role !== "superadmin" && (
                  <button
                    onClick={() => {
                      setSelectedStaff(staff);
                      setDeleteConfirmOpen(true);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        )
      ) : null}

      {/* Add / Edit Staff Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-zinc-200"
            >
              <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between z-10 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-650 rounded-xl">
                    <Shield size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 leading-tight">
                      {selectedStaff ? "Modify Staff Permissions" : "Register New Staff Member"}
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">Configure access roles and panel restrictions</p>
                  </div>
                </div>
                <button 
                  onClick={() => setModalOpen(false)} 
                  className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Tabs */}
              {role !== "superadmin" && (
                <div className="flex gap-2 px-6 pt-4 border-b border-slate-50">
                  <button
                    type="button"
                    onClick={() => setModalTab("profile")}
                    className={`pb-3 px-1 text-xs font-bold transition-all relative ${
                      modalTab === "profile" 
                        ? "text-blue-600 border-b-2 border-blue-600" 
                        : "text-slate-450 hover:text-slate-700"
                    }`}
                  >
                    📁 Profile & Role
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("permissions")}
                    className={`pb-3 px-1 text-xs font-bold transition-all relative ${
                      modalTab === "permissions" 
                        ? "text-blue-600 border-b-2 border-blue-600" 
                        : "text-slate-455 hover:text-slate-700"
                    }`}
                  >
                    🛡️ Accessible Modules ({Object.values(panelsPerms).filter(Boolean).length})
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 md:p-5 space-y-4 max-w-[1600px] mx-auto">
                {role === "superadmin" || modalTab === "profile" ? (
                  // PROFILE & ROLE VIEW
                  <div className="space-y-6 animate-fadeIn">

                    {/* Offline Employee Toggle - only when adding new (not editing system user) */}
                    {(!selectedStaff || selectedStaff.permissions?.is_offline) && (
                      <button
                        type="button"
                        onClick={() => setIsOfflineEmployee(prev => !prev)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                          isOfflineEmployee
                            ? "bg-amber-50 border-amber-300 ring-2 ring-amber-300/20"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg ${isOfflineEmployee ? "bg-amber-100" : "bg-slate-100"}`}>
                            {isOfflineEmployee ? "👤" : "🖥️"}
                          </div>
                          <div className="text-left">
                            <p className={`text-xs font-black ${isOfflineEmployee ? "text-amber-800" : "text-slate-700"}`}>
                              {isOfflineEmployee ? "Offline Employee (No Login)" : "System Account Employee"}
                            </p>
                            <p className={`text-[10px] font-medium mt-0.5 ${isOfflineEmployee ? "text-amber-600" : "text-slate-400"}`}>
                              {isOfflineEmployee
                                ? "No email or password needed. Payroll-only record."
                                : "Has a login account to access the system."}
                            </p>
                          </div>
                        </div>
                        <div className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${isOfflineEmployee ? "bg-amber-400" : "bg-slate-300"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${isOfflineEmployee ? "left-5" : "left-0.5"}`} />
                        </div>
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                        <div className="relative">
                          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Ali Ahmed"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition font-semibold text-slate-700"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone (slips / riders)</label>
                        <div className="relative">
                          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="e.g. 0300-1112233"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition font-semibold text-slate-700"
                          />
                        </div>
                      </div>

                      {!isOfflineEmployee && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                          <div className="relative">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="email"
                              required
                              disabled={!!selectedStaff}
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="email@example.com"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:opacity-60 font-semibold text-slate-700"
                            />
                          </div>
                        </div>
                      )}

                      {!isOfflineEmployee && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            {selectedStaff ? "New Password (Leave blank to keep)" : "Password"}
                          </label>
                          <div className="relative">
                            <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="password"
                              required={!selectedStaff && !isOfflineEmployee}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition font-semibold text-slate-700"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Base Monthly Salary (Rs)</label>
                        <div className="relative">
                          <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="number"
                            min="0"
                            value={baseSalary || ""}
                            onChange={(e) => setBaseSalary(Math.max(0, parseFloat(e.target.value) || 0))}
                            placeholder="e.g. 25000"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition font-semibold text-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Premium Security Role Cards */}
                    <div className="border-t border-slate-100 pt-5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Security Access Role</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          {
                            key: "salesman",
                            title: "Salesman / Billing",
                            desc: "Limited to POS checkout counter, basic sales & customer ledger entries.",
                            badge: "Standard"
                          },
                          {
                            key: "rider",
                            title: "Delivery Rider",
                            desc: "Shows on delivery orders with name + phone. Not used for dine-in or takeaway.",
                            badge: "Fleet"
                          },
                          {
                            key: "manager",
                            title: "Store Manager",
                            desc: "Manage stock, entries, expenses, view reports, but cannot access backup settings.",
                            badge: "Operations"
                          },
                          {
                            key: "superadmin",
                            title: "Super Admin",
                            desc: "Full database permissions, payroll issuer, modify credentials & cash registers.",
                            badge: "Owner Root"
                          }
                        ].map((r) => (
                          <button
                            key={r.key}
                            type="button"
                            onClick={() => handleRoleChange(r.key)}
                            className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                              role === r.key
                                ? r.key === "salesman"
                                  ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/10"
                                  : r.key === "rider"
                                  ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/10"
                                  : r.key === "manager"
                                  ? "bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/10"
                                  : "bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/10"
                                : "bg-white border-slate-200 hover:border-slate-350"
                            }`}
                          >
                            <div className="w-full">
                              <div className="flex justify-between items-center w-full mb-1">
                                <div className={`font-black text-xs block ${
                                  role === r.key
                                    ? r.key === "salesman"
                                      ? "text-blue-700"
                                      : r.key === "rider"
                                      ? "text-emerald-700"
                                      : r.key === "manager"
                                      ? "text-indigo-700"
                                      : "text-purple-700"
                                    : "text-slate-800"
                                }`}>
                                  {r.title}
                                </div>
                                <div className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                  role === r.key 
                                    ? r.key === "superadmin" 
                                      ? "bg-purple-100 text-purple-700" 
                                      : "bg-blue-100 text-blue-700"
                                    : "bg-slate-100 text-slate-550"
                                }`}>
                                  {r.badge}
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1 block">
                                {r.desc}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {role === "superadmin" && (
                      <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-start gap-3 mt-4">
                        <ShieldAlert className="text-purple-600 shrink-0 mt-0.5" size={18} />
                        <div>
                          <h4 className="text-xs font-bold text-purple-900">Owner Superadmin Privilege Alert</h4>
                          <p className="text-[11px] text-purple-750 mt-1 leading-relaxed font-medium">
                            Setting this staff member as a **Superadmin** grants them absolute root power. They can perform all operations, configure other staff users, delete records, view database analytics, and issue payrolls.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // GRANULAR PANEL PERMISSIONS VIEW
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        Accessible Modules / Panels
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {PANELS.map((p) => {
                          const enabled = panelsPerms[p.key];
                          return (
                            <button
                              type="button"
                              key={p.key}
                              onClick={() => togglePanelPerm(p.key)}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border text-left text-xs font-bold transition-all duration-200 cursor-pointer ${
                                enabled
                                  ? "bg-emerald-50/50 border-emerald-500 text-emerald-950 shadow-sm"
                                  : "border-slate-200 hover:border-slate-350 bg-white text-slate-500"
                              }`}
                            >
                              <div className="truncate">{p.label}</div>
                              <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                                enabled ? "bg-emerald-600 flex justify-end" : "bg-slate-200 flex justify-start"
                              }`}>
                                <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Key size={16} className="text-blue-600" />
                        Restricted Actions Control (Sensative Actions)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ACTIONS.map((a) => {
                          const enabled = actionsPerms[a.key];
                          return (
                            <button
                              type="button"
                              key={a.key}
                              onClick={() => toggleActionPerm(a.key)}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border text-left text-xs font-bold transition-all duration-200 cursor-pointer ${
                                enabled
                                  ? "bg-emerald-50/50 border-emerald-500 text-emerald-950 shadow-sm"
                                  : "border-slate-200 hover:border-slate-350 bg-white text-slate-500"
                              }`}
                            >
                              <div className="truncate">{a.label}</div>
                              <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 shrink-0 ${
                                enabled ? "bg-emerald-600 flex justify-end" : "bg-slate-200 flex justify-start"
                              }`}>
                                <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                      <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        🛡️ Discount Limit Control
                      </h3>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150/60 max-w-md">
                        <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Max Allowed Discount (%)</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={maxDiscountPercentage}
                            onChange={(e) => setMaxDiscountPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                            className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                          />
                          <div className="text-[10px] text-slate-400 font-semibold leading-normal">
                            This staff member will be blocked from offering discounts higher than this percentage during POS billing. Set to 100 for unlimited.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold border border-slate-250 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors rounded-xl transition text-slate-500 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-md shadow-blue-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 className="animate-spin" size={14} />}
                    {selectedStaff ? "Update Permissions" : "Register Staff"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Staff Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && selectedStaff && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 border border-zinc-200 shadow-xl"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <Trash2 size={24} />
                <h3 className="text-lg font-bold">Remove Staff Member?</h3>
              </div>
              <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
                Are you sure you want to delete <strong>{selectedStaff.name}</strong> ({selectedStaff.email})? 
                This action is permanent and will delete their login credentials and profile. Historical data generated by this user (like sales, transactions) will be preserved.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Delete Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payroll Tab Rendering */}
      {activeTab === "payroll" && hasPayroll && !loading && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* Sub-tab Selection */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setPayrollSubTab("process")}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer ${
                    payrollSubTab === "process"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  💳 {t("process_salary_panel")}
                </button>
                <button
                  type="button"
                  onClick={() => setPayrollSubTab("history")}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer ${
                    payrollSubTab === "history"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  📜 {t("salary_history_log")}
                </button>
              </div>

              {/* Month, Cycle & Account selection selectors */}
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                {/* Account selector */}
                <div className="space-y-1 min-w-[200px]">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{t("select_account")}</label>
                  <select
                    value={slipAccountId}
                    onChange={(e) => setSlipAccountId(e.target.value)}
                    className="w-full h-9.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-750 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">-- Choose Payout Account --</option>
                    {cashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: Rs {Math.round(acc.current_balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Flexible Payroll Frequency / Cycle Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Disbursement Cycle:</div>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  {[
                    { key: "monthly", label: "💼 Monthly" },
                    { key: "weekly", label: "🗓️ Weekly" },
                    { key: "daily", label: "📅 Daily" },
                    { key: "custom", label: "🎯 Custom Range" }
                  ].map((cycle) => (
                    <button
                      key={cycle.key}
                      type="button"
                      onClick={() => setPayrollCycle(cycle.key as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        payrollCycle === cycle.key
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {cycle.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cycle Date Pickers */}
              <div className="flex items-center gap-3 flex-wrap">
                {payrollCycle === "monthly" && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Select Month:</label>
                    <input
                      type="month"
                      value={slipMonth}
                      onChange={(e) => setSlipMonth(e.target.value)}
                      className="h-8.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}

                {payrollCycle === "daily" && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Wage Date:</label>
                    <input
                      type="date"
                      value={slipDate}
                      onChange={(e) => setSlipDate(e.target.value)}
                      className="h-8.5 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}

                {payrollCycle === "weekly" && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Week Range:</label>
                    <input
                      type="date"
                      value={slipWeekStart}
                      onChange={(e) => {
                        const start = e.target.value;
                        setSlipWeekStart(start);
                        if (start) {
                          const d = new Date(start);
                          d.setDate(d.getDate() + 6);
                          setSlipWeekEnd(d.toISOString().split("T")[0]);
                        }
                      }}
                      className="h-8.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                    <div className="text-slate-400 font-bold text-xs">to</div>
                    <input
                      type="date"
                      value={slipWeekEnd}
                      onChange={(e) => setSlipWeekEnd(e.target.value)}
                      className="h-8.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                )}

                {payrollCycle === "custom" && (
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">From:</label>
                    <input
                      type="date"
                      value={slipCustomStart}
                      onChange={(e) => setSlipCustomStart(e.target.value)}
                      className="h-8.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                    <div className="text-slate-400 font-bold text-xs">To:</div>
                    <input
                      type="date"
                      value={slipCustomEnd}
                      onChange={(e) => setSlipCustomEnd(e.target.value)}
                      className="h-8.5 px-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                )}

                {/* Active Period Badge */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <div className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-mono">
                    {getPeriodLabel()} ({getCycleTotalDays()} Days)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {payrollSubTab === "process" ? (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider select-none text-[10.5px]">
                    <tr>
                      <th className="py-4 px-4 w-10 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          {isAllSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                        </button>
                      </th>
                      <th className="py-4 px-4">{t("employee_details")}</th>
                      <th className="py-4 px-3 text-center">Wage Type</th>
                      <th className="py-4 px-3 text-right">Base Rate (Rs)</th>
                      <th className="py-4 px-3 text-center">
                        {payrollCycle === "daily" ? "Cycle Days" : payrollCycle === "weekly" ? "Week Days" : payrollCycle === "custom" ? "Period Days" : "Month Days"}
                      </th>
                      <th className="py-4 px-3 text-center">Presents / Worked</th>
                      <th className="py-4 px-3 text-right">Allowances (+)</th>
                      <th className="py-4 px-3 text-right">Deductions (-)</th>
                      <th className="py-4 px-4 text-right">Net Payable (Rs)</th>
                      <th className="py-4 px-4 text-center">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {staffList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center text-slate-400 font-bold">
                          No staff members available.
                        </td>
                      </tr>
                    ) : (
                      staffList.map(staff => {
                        const totalDays = getCycleTotalDays();
                        const data = attendanceData[staff.id] || {
                          baseSalary: staff.permissions?.base_salary || 0,
                          presentDays: calculatePresentDays(staff, slipMonth),
                          allowances: 0,
                          deductions: calculateLoansDeduction(staff),
                          wageType: staff.permissions?.wage_type || "monthly"
                        };
                        const wageType = data.wageType || staff.permissions?.wage_type || "monthly";
                        const isChecked = selectedEmployeeIds.includes(staff.id);
                        
                        // Check if already paid
                        const alreadyPaid = payrollSlips.find(
                          slip => slip.staff_id === staff.id && slip.month_year === getPeriodKey()
                        );

                        // Advanced Net Salary Calculation
                        const { earnedSalary, netPayable } = calculateEarnedSalary(
                          data.baseSalary,
                          data.presentDays,
                          totalDays,
                          wageType,
                          payrollCycle,
                          data.allowances,
                          data.deductions
                        );

                        return (
                          <tr key={staff.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${alreadyPaid ? 'bg-slate-50/20 opacity-80' : ''}`}>
                            <td className="py-3.5 px-4 text-center">
                              {!alreadyPaid ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSelectEmployee(staff.id)}
                                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                >
                                  {isChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                                </button>
                              ) : (
                                <div className="text-emerald-500 font-bold">✓</div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col">
                                <div className="font-bold text-slate-800 text-sm">{staff.name}</div>
                                <div className="text-[10px] text-slate-400 capitalize">{staff.role}</div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center w-32">
                              <select
                                disabled={!!alreadyPaid}
                                value={wageType}
                                onChange={(e) => handleAttendanceChange(staff.id, "wageType", e.target.value)}
                                className="w-full h-8 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-[11px] font-bold text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none transition disabled:opacity-50"
                              >
                                <option value="monthly">💼 Monthly</option>
                                <option value="daily">📅 Daily Rate</option>
                                <option value="hourly">⏱️ Hourly</option>
                                <option value="weekly">🗓️ Weekly</option>
                              </select>
                            </td>
                            <td className="py-3.5 px-3 text-right w-36">
                              <div className="relative">
                                <input
                                  type="number"
                                  disabled={!!alreadyPaid}
                                  value={data.baseSalary || ""}
                                  onChange={(e) => handleAttendanceChange(staff.id, "baseSalary", Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full text-right h-8 px-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none transition disabled:opacity-50"
                                  placeholder="0"
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                              {totalDays}
                            </td>
                            <td className="py-3.5 px-3 text-center w-28">
                              <input
                                type="number"
                                disabled={!!alreadyPaid}
                                min={0}
                                max={wageType === "daily" || wageType === "monthly" ? totalDays : 365}
                                value={data.presentDays}
                                onChange={(e) => handleAttendanceChange(staff.id, "presentDays", Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-16 text-center h-8 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none transition disabled:opacity-50 mx-auto block font-mono"
                              />
                            </td>
                            <td className="py-3.5 px-3 text-right w-28">
                              <input
                                type="number"
                                disabled={!!alreadyPaid}
                                value={data.allowances || ""}
                                onChange={(e) => handleAttendanceChange(staff.id, "allowances", Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-20 text-right h-8 px-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none transition text-emerald-600 disabled:opacity-50 ml-auto block"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-3.5 px-3 text-right w-28">
                              <input
                                type="number"
                                disabled={!!alreadyPaid}
                                value={data.deductions || ""}
                                onChange={(e) => handleAttendanceChange(staff.id, "deductions", Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-20 text-right h-8 px-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none transition text-red-500 disabled:opacity-50 ml-auto block"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-sm text-slate-800">
                              Rs {netPayable.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {alreadyPaid ? (
                                <div className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                                  {t("already_issued")}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => handleIssueSingle(staff.id)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-black transition-all cursor-pointer disabled:opacity-50"
                                >
                                  💸 {t("issue_salary_btn")}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bulk action disburse footer */}
              {staffList.length > 0 && (
                <div className="bg-slate-50 border-t border-slate-150 p-4 px-6 flex justify-between items-center">
                  <div className="text-slate-500 text-xs font-bold">
                    {selectedEmployeeIds.length} employees selected for processing.
                  </div>
                  <button
                    type="button"
                    disabled={submitting || selectedEmployeeIds.length === 0}
                    onClick={handleIssueBulk}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black px-6 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-all text-xs cursor-pointer"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : "💸"}
                    {t("bulk_issue_salaries")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-4 px-5">Date Generated</th>
                      <th className="py-4 px-5">Staff Name</th>
                      <th className="py-4 px-5">Month</th>
                      <th className="py-4 px-5 text-right">Base Salary</th>
                      <th className="py-4 px-5 text-right">Net Payable</th>
                      <th className="py-4 px-5 text-center">Status</th>
                      <th className="py-4 px-5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {payrollSlips.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-bold">
                          No historical payslips found.
                        </td>
                      </tr>
                    ) : (
                      payrollSlips.map(slip => (
                        <tr key={slip.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                          <td className="py-3.5 px-5 font-mono text-slate-500">{new Date(slip.created_at).toLocaleDateString()}</td>
                          <td className="py-3.5 px-5 font-bold text-slate-800">{slip.user_profiles?.name}</td>
                          <td className="py-3.5 px-5 text-blue-600">{slip.month_year}</td>
                          <td className="py-3.5 px-5 text-right">Rs {Number(slip.base_salary).toLocaleString()}</td>
                          <td className="py-3.5 px-5 text-right font-black text-emerald-600">Rs {Number(slip.net_payable).toLocaleString()}</td>
                          <td className="py-3.5 px-5 text-center">
                            <div className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                              {slip.status}
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              type="button"
                              onClick={() => generatePayslipPDF(slip)}
                              className="px-2.5 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Printer size={12} />
                              Print Slip
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {(activeTab === "attendance" || activeTab === "loans" || activeTab === "leaves") && hasPayroll && !loading && (
        <div className="space-y-6 animate-fadeIn">
          {/* Sub-tab Selection */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setAttendanceSubTab("logs")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer ${
                attendanceSubTab === "logs"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              📅 Attendance Logs
            </button>
            <button
              type="button"
              onClick={() => setAttendanceSubTab("leaves")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer ${
                attendanceSubTab === "leaves"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🚪 Leave Records
            </button>
            <button
              type="button"
              onClick={() => setAttendanceSubTab("loans")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer ${
                attendanceSubTab === "loans"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              💰 Salary Advances & Loans
            </button>
          </div>

          {attendanceSubTab === "logs" && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Daily Attendance Logs</h3>
                    
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">Select Date</label>
                      <input
                        type="date"
                        value={attendanceDate}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="h-9.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-750 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-5">Employee Name</th>
                        <th className="py-4 px-5">Access Role</th>
                        <th className="py-4 px-5 text-center">Mark Status</th>
                        <th className="py-4 px-5 text-center">Month Presence Summary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {staffList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-16 text-center text-slate-400 font-bold">
                            No staff members found to record attendance.
                          </td>
                        </tr>
                      ) : (
                        staffList.map(staff => {
                          const status = attendanceTemp[staff.id] || "present";
                          const currentMonthStr = attendanceDate.substring(0, 7); // YYYY-MM
                          const presentDaysThisMonth = calculatePresentDays(staff, currentMonthStr);
                          const totalDaysThisMonth = getDaysInMonth(currentMonthStr);
                          
                          return (
                            <tr key={staff.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                              <td className="py-3.5 px-5">
                                <div className="flex flex-col">
                                  <div className="font-bold text-slate-800 text-sm">{staff.name}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {staff.permissions?.is_offline ? "Offline Employee" : (staff.email || "No Email")}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-5">
                                <div className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  staff.role === "manager" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-700"
                                }`}>
                                  {staff.role}
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <div className="flex justify-center gap-1.5">
                                  {[
                                    { key: "present", label: "✅ Present", activeColor: "bg-emerald-600 text-white shadow-sm shadow-emerald-200 border-emerald-600", inactiveColor: "hover:bg-emerald-50 text-emerald-600 border-emerald-100" },
                                    { key: "absent", label: "❌ Absent", activeColor: "bg-rose-600 text-white shadow-sm shadow-rose-200 border-rose-600", inactiveColor: "hover:bg-rose-50 text-rose-600 border-rose-100" },
                                    { key: "halfday", label: "🌗 Half Day", activeColor: "bg-amber-600 text-white shadow-sm shadow-amber-200 border-amber-600", inactiveColor: "hover:bg-amber-50 text-amber-600 border-amber-100" },
                                    { key: "late", label: "⏰ Late", activeColor: "bg-blue-600 text-white shadow-sm shadow-blue-200 border-blue-600", inactiveColor: "hover:bg-blue-50 text-blue-600 border-blue-100" }
                                  ].map(btn => {
                                    const active = status === btn.key;
                                    return (
                                      <button
                                        key={btn.key}
                                        type="button"
                                        onClick={() => setAttendanceTemp(prev => ({ ...prev, [staff.id]: btn.key }))}
                                        className={`px-3 py-1.5 rounded-xl border text-[10px] font-black transition-all cursor-pointer ${
                                          active ? btn.activeColor : btn.inactiveColor
                                        }`}
                                      >
                                        {btn.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-center font-mono font-bold text-slate-500">
                                {presentDaysThisMonth} / {totalDaysThisMonth} Days
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {staffList.length > 0 && (
                  <div className="bg-slate-50 border-t border-slate-150 p-4 px-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBiometricModalOpen(true);
                        setSelectedBioStaffId("");
                        setScanCompleted(false);
                      }}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-black px-5 py-2.5 rounded-xl shadow-md shadow-violet-200 transition-all text-xs cursor-pointer"
                    >
                      📳 Simulate Fingerprint Scan
                    </button>
                    <button
                      type="button"
                      disabled={savingAttendance}
                      onClick={handleSaveAttendance}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-55 text-white font-black px-6 py-2.5 rounded-xl shadow-md shadow-blue-200 transition-all text-xs cursor-pointer"
                    >
                      {savingAttendance ? <Loader2 size={14} className="animate-spin" /> : "💾"}
                      Save Attendance Logs
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {attendanceSubTab === "leaves" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Leave Application Records</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Track paid, unpaid, and medical leaves of employees.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nonAdmins = staffList;
                    if (nonAdmins.length > 0) setLeaveStaffId(nonAdmins[0].id);
                    setIsLeaveModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-5 py-2.5 rounded-xl shadow-sm text-xs cursor-pointer"
                >
                  <Plus size={14} />
                  Record New Leave
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-5">Date Recorded</th>
                        <th className="py-4 px-5">Employee Name</th>
                        <th className="py-4 px-5">Leave Date</th>
                        <th className="py-4 px-5 text-center">Type</th>
                        <th className="py-4 px-5">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {staffList.every(s => !(s.permissions?.leaves?.length)) ? (
                        <tr>
                          <td colSpan={5} className="py-16 text-center text-slate-400 font-bold">
                            No leave applications logged yet.
                          </td>
                        </tr>
                      ) : (
                        staffList.flatMap(staff => 
                          (staff.permissions?.leaves || []).map((leave: any) => (
                            <tr key={leave.id || leave.date} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                              <td className="py-3.5 px-5 font-mono text-slate-400">{leave.date}</td>
                              <td className="py-3.5 px-5 font-bold text-slate-800">{staff.name}</td>
                              <td className="py-3.5 px-5 text-blue-600 font-bold">{leave.date}</td>
                              <td className="py-3.5 px-5 text-center">
                                <div className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  leave.type === "unpaid" 
                                    ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                    : leave.type === "sick"
                                    ? "bg-amber-50 text-amber-600 border border-amber-100"
                                    : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                }`}>
                                  {leave.type}
                                </div>
                              </td>
                              <td className="py-3.5 px-5 text-slate-500 truncate max-w-xs">{leave.reason || "No reason details"}</td>
                            </tr>
                          ))
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {attendanceSubTab === "loans" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Salary Advances & Loans Ledger</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Disburse advances and track automatic monthly payroll deduction installments.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nonAdmins = staffList;
                    if (nonAdmins.length > 0) setLoanStaffId(nonAdmins[0].id);
                    if (cashAccounts.length > 0) setLoanAccountId(cashAccounts[0].id);
                    setIsLoanModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black px-5 py-2.5 rounded-xl shadow-sm text-xs cursor-pointer"
                >
                  <Plus size={14} />
                  Disburse Advance / Loan
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-5">Disbursed Date</th>
                        <th className="py-4 px-5">Employee Name</th>
                        <th className="py-4 px-5 text-right">Loan Amount</th>
                        <th className="py-4 px-5 text-center">Installments</th>
                        <th className="py-4 px-5 text-right">Installment Amount</th>
                        <th className="py-4 px-5 text-right">Remaining Balance</th>
                        <th className="py-4 px-5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {staffList.every(s => !(s.permissions?.loans?.length)) ? (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-slate-400 font-bold">
                            No employee loans registered yet.
                          </td>
                        </tr>
                      ) : (
                        staffList.flatMap(staff => 
                          (staff.permissions?.loans || []).map((loan: any) => (
                            <tr key={loan.id || loan.date} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                              <td className="py-3.5 px-5 font-mono text-slate-450">{loan.date}</td>
                              <td className="py-3.5 px-5 font-bold text-slate-800">{staff.name}</td>
                              <td className="py-3.5 px-5 text-right text-slate-800">Rs {loan.amount.toLocaleString()}</td>
                              <td className="py-3.5 px-5 text-center font-bold text-slate-500">
                                {loan.paidInstallments || 0} / {loan.totalInstallments} Months
                              </td>
                              <td className="py-3.5 px-5 text-right text-rose-600">Rs {loan.installmentAmount.toLocaleString()}/mo</td>
                              <td className="py-3.5 px-5 text-right font-black text-slate-900">Rs {loan.remainingAmount.toLocaleString()}</td>
                              <td className="py-3.5 px-5 text-center">
                                <div className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                  loan.remainingAmount <= 0
                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                    : "bg-amber-50 text-amber-600 border border-amber-100"
                                }`}>
                                  {loan.remainingAmount <= 0 ? "Cleared" : "Active"}
                                </div>
                              </td>
                            </tr>
                          ))
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Leave Application Modal Form */}
          <AnimatePresence>
            {isLeaveModalOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl w-full max-w-md p-6 border border-zinc-200 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900">Record Employee Leave</h3>
                    <button type="button" onClick={() => setIsLeaveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={handleSaveLeave} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase block">Select Employee</label>
                      <select
                        value={leaveStaffId}
                        onChange={(e) => setLeaveStaffId(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-450 uppercase block">Leave Type</label>
                        <select
                          value={leaveType}
                          onChange={(e: any) => setLeaveType(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="annual">Paid (Annual)</option>
                          <option value="sick">Paid (Sick)</option>
                          <option value="casual">Paid (Casual)</option>
                          <option value="unpaid">Unpaid Leave</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-450 uppercase block">Date</label>
                        <input
                          type="date"
                          value={leaveDate}
                          onChange={(e) => setLeaveDate(e.target.value)}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase block">Reason / Details</label>
                      <textarea
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder="Reason for leave application..."
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                        required
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
                      <button
                        type="button"
                        onClick={() => setIsLeaveModalOpen(false)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-slate-500 text-xs font-bold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
                      >
                        Save Leave
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Loan / Advance Disbursement Modal Form */}
          <AnimatePresence>
            {isLoanModalOpen && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl w-full max-w-md p-6 border border-zinc-200 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-900">Disburse Salary Advance / Loan</h3>
                    <button type="button" onClick={() => setIsLoanModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={handleSaveLoan} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase block">Select Employee</label>
                      <select
                        value={loanStaffId}
                        onChange={(e) => setLoanStaffId(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-455 uppercase block">Payout Account</label>
                      <select
                        value={loanAccountId}
                        onChange={(e) => setLoanAccountId(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">-- Choose Cash/Bank Account --</option>
                        {cashAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (Bal: Rs {Math.round(acc.current_balance).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-450 uppercase block">Loan Amount (Rs)</label>
                        <input
                          type="number"
                          min="1"
                          value={loanAmount || ""}
                          onChange={(e) => setLoanAmount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                          placeholder="e.g. 15000"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-455 uppercase block">Deduction Installments</label>
                        <select
                          value={loanInstallments}
                          onChange={(e) => setLoanInstallments(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={1}>1 Month (Advance)</option>
                          <option value={3}>3 Months</option>
                          <option value={6}>6 Months</option>
                          <option value={12}>12 Months</option>
                        </select>
                      </div>
                    </div>

                    {loanAmount > 0 && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[11px] font-bold text-amber-800">
                        Suggested Deduction: Rs {Math.round(loanAmount / loanInstallments).toLocaleString()} per month for {loanInstallments} month(s).
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase block">Reason / Remarks</label>
                      <input
                        type="text"
                        value={loanReason}
                        onChange={(e) => setLoanReason(e.target.value)}
                        placeholder="e.g. Personal emergency advance"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 mt-4">
                      <button
                        type="button"
                        onClick={() => setIsLoanModalOpen(false)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-slate-550 text-xs font-bold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
                      >
                        Disburse Loan
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Biometric Simulation Modal */}
          <AnimatePresence>
            {isBiometricModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 overflow-hidden flex flex-col items-center"
                >
                  <div className="w-full flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Biometric Hardware Scanner
                    </h3>
                    <button
                      onClick={() => setIsBiometricModalOpen(false)}
                      className="text-slate-400 hover:text-slate-650 font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="w-full space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-450 uppercase">Select Employee to Scan</label>
                      <select
                        value={selectedBioStaffId}
                        onChange={(e) => setSelectedBioStaffId(e.target.value)}
                        className="w-full bg-white border border-slate-200 h-10 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">-- Choose Employee --</option>
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.role.toUpperCase()})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="relative h-28 w-28 rounded-full border-4 border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
                        <div className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
                          isScanning 
                            ? "bg-blue-500/10" 
                            : scanCompleted 
                              ? "bg-emerald-500/15" 
                              : "opacity-0"
                        }`} />

                        {isScanning && (
                          <motion.div
                            animate={{ top: ["0%", "100%", "0%"] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute left-0 w-full h-1.5 bg-blue-500 shadow-md shadow-blue-400 z-10"
                          />
                        )}

                        <div className={`text-4xl transition-colors duration-300 ${
                          isScanning 
                            ? "text-blue-550 animate-pulse" 
                            : scanCompleted 
                              ? "text-emerald-500" 
                              : "text-slate-450 hover:text-slate-550 cursor-pointer"
                        }`}
                        onClick={handleSimulateScan}
                        >
                          📳
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">
                        {isScanning 
                          ? "Scanning Fingerprint..." 
                          : scanCompleted 
                            ? "Verification Successful! ✅" 
                            : "Tap Icon to Initiate Scan"}
                      </p>
                    </div>

                    <button
                      onClick={handleSimulateScan}
                      disabled={isScanning || !selectedBioStaffId}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold h-10 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="animate-spin h-3.5 w-3.5" />
                          Authenticating...
                        </>
                      ) : (
                        "Trigger Fingerprint Scan"
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
