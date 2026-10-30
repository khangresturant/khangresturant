"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Stethoscope, Plus, Search, Filter, Calendar, 
  DollarSign, Receipt, CheckCircle2, AlertCircle, 
  Trash2, Edit, UserCheck, Building2, Phone,
  RefreshCw, FileText, Loader2, Sparkles, Printer,
  CreditCard, ArrowUpRight, ArrowDownRight, Wallet, Users, X
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DoctorProfile {
  id: string;
  shop_id: string;
  doctor_name: string;
  pmdc_no: string;
  speciality: string;
  clinic_hospital: string;
  phone: string;
  commission_type: "percentage" | "fixed";
  commission_rate: number; // e.g. 5% or Rs 100 per Rx
  total_prescriptions_count: number;
  total_sales_generated: number;
  total_commission_earned: number;
  total_commission_paid: number;
  created_at: string;
}

export interface DoctorCommissionLog {
  id: string;
  shop_id: string;
  doctor_id: string;
  doctor_name: string;
  prescription_no: string;
  prescription_date: string;
  patient_name: string;
  medicine_total_amount: number;
  commission_amount: number;
  status: "accrued" | "paid";
  payment_date?: string;
  payment_mode?: string;
  created_at: string;
}

export default function DoctorCommissionLedgerPage() {
  const { shopId, shopName, industryType } = useShop();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"directory" | "logs">("directory");
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [commissionLogs, setCommissionLogs] = useState<DoctorCommissionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Doctor Form State
  const [doctorFormData, setDoctorFormData] = useState({
    doctor_name: "",
    pmdc_no: "",
    speciality: "General Physician",
    clinic_hospital: "",
    phone: "",
    commission_type: "percentage" as "percentage" | "fixed",
    commission_rate: "5"
  });

  // Commission Log Form State
  const [logFormData, setLogFormData] = useState({
    doctor_id: "",
    prescription_no: "",
    prescription_date: new Date().toISOString().split("T")[0],
    patient_name: "",
    medicine_total_amount: "1500",
    commission_amount: "75"
  });

  // Payout Form State
  const [payoutFormData, setPayoutFormData] = useState({
    amount: "0",
    payment_mode: "Cash",
    notes: ""
  });

  const doctorsKey = `pharmacy_doctors_${shopId || "default"}`;
  const logsKey = `pharmacy_doc_logs_${shopId || "default"}`;

  useEffect(() => {
    if (shopId) {
      fetchDoctorsAndLogs();
    }
  }, [shopId]);

  const fetchDoctorsAndLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch Doctors
      const savedDocs = localStorage.getItem(doctorsKey);
      if (savedDocs) {
        setDoctors(JSON.parse(savedDocs));
      } else {
        const sampleDocs: DoctorProfile[] = [
          {
            id: "doc-1",
            shop_id: shopId || "",
            doctor_name: "Dr. Tariq Mahmood",
            pmdc_no: "48291-P",
            speciality: "Cardiologist",
            clinic_hospital: "Sheikh Zayed Medical Complex",
            phone: "0300-8492019",
            commission_type: "percentage",
            commission_rate: 5,
            total_prescriptions_count: 42,
            total_sales_generated: 148500,
            total_commission_earned: 7425,
            total_commission_paid: 5000,
            created_at: new Date().toISOString()
          },
          {
            id: "doc-2",
            shop_id: shopId || "",
            doctor_name: "Dr. Samina Rizvi",
            pmdc_no: "19842-N",
            speciality: "Neurologist / Psychiatrist",
            clinic_hospital: "Rizvi Neuro Clinic, Jail Road",
            phone: "0321-9876543",
            commission_type: "percentage",
            commission_rate: 7,
            total_prescriptions_count: 28,
            total_sales_generated: 98000,
            total_commission_earned: 6860,
            total_commission_paid: 6860,
            created_at: new Date().toISOString()
          },
          {
            id: "doc-3",
            shop_id: shopId || "",
            doctor_name: "Dr. Kamran Qureshi",
            pmdc_no: "56201-G",
            speciality: "Consultant Pediatrician",
            clinic_hospital: "Children Care Clinic",
            phone: "0333-4567890",
            commission_type: "fixed",
            commission_rate: 100,
            total_prescriptions_count: 19,
            total_sales_generated: 45000,
            total_commission_earned: 1900,
            total_commission_paid: 1000,
            created_at: new Date().toISOString()
          }
        ];
        setDoctors(sampleDocs);
        localStorage.setItem(doctorsKey, JSON.stringify(sampleDocs));
      }

      // 2. Fetch Logs
      const savedLogs = localStorage.getItem(logsKey);
      if (savedLogs) {
        setCommissionLogs(JSON.parse(savedLogs));
      } else {
        const sampleLogs: DoctorCommissionLog[] = [
          {
            id: "log-1",
            shop_id: shopId || "",
            doctor_id: "doc-1",
            doctor_name: "Dr. Tariq Mahmood",
            prescription_no: "RX-9082",
            prescription_date: new Date().toISOString().split("T")[0],
            patient_name: "Muhammad Aslam",
            medicine_total_amount: 3200,
            commission_amount: 160,
            status: "accrued",
            created_at: new Date().toISOString()
          },
          {
            id: "log-2",
            shop_id: shopId || "",
            doctor_id: "doc-2",
            doctor_name: "Dr. Samina Rizvi",
            prescription_no: "RX-8841",
            prescription_date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
            patient_name: "Farhan Ali",
            medicine_total_amount: 2500,
            commission_amount: 175,
            status: "paid",
            payment_date: new Date().toISOString().split("T")[0],
            payment_mode: "Cash Voucher",
            created_at: new Date(Date.now() - 86400000).toISOString()
          }
        ];
        setCommissionLogs(sampleLogs);
        localStorage.setItem(logsKey, JSON.stringify(sampleLogs));
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleOpenAddDoctor = () => {
    setSelectedDoctor(null);
    setDoctorFormData({
      doctor_name: "",
      pmdc_no: "",
      speciality: "General Physician",
      clinic_hospital: "",
      phone: "",
      commission_type: "percentage",
      commission_rate: "5"
    });
    setIsDoctorModalOpen(true);
  };

  const handleOpenEditDoctor = (doc: DoctorProfile) => {
    setSelectedDoctor(doc);
    setDoctorFormData({
      doctor_name: doc.doctor_name,
      pmdc_no: doc.pmdc_no,
      speciality: doc.speciality,
      clinic_hospital: doc.clinic_hospital,
      phone: doc.phone,
      commission_type: doc.commission_type,
      commission_rate: String(doc.commission_rate)
    });
    setIsDoctorModalOpen(true);
  };

  const handleSaveDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorFormData.doctor_name.trim()) {
      toast.error("Doctor name is required.");
      return;
    }

    const payload: DoctorProfile = {
      id: selectedDoctor ? selectedDoctor.id : `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shop_id: shopId || "",
      doctor_name: doctorFormData.doctor_name.trim(),
      pmdc_no: doctorFormData.pmdc_no.trim() || "PMDC-Verified",
      speciality: doctorFormData.speciality.trim(),
      clinic_hospital: doctorFormData.clinic_hospital.trim(),
      phone: doctorFormData.phone.trim(),
      commission_type: doctorFormData.commission_type,
      commission_rate: parseFloat(doctorFormData.commission_rate) || 0,
      total_prescriptions_count: selectedDoctor ? selectedDoctor.total_prescriptions_count : 0,
      total_sales_generated: selectedDoctor ? selectedDoctor.total_sales_generated : 0,
      total_commission_earned: selectedDoctor ? selectedDoctor.total_commission_earned : 0,
      total_commission_paid: selectedDoctor ? selectedDoctor.total_commission_paid : 0,
      created_at: selectedDoctor ? selectedDoctor.created_at : new Date().toISOString()
    };

    let updated: DoctorProfile[];
    if (selectedDoctor) {
      updated = doctors.map(d => d.id === selectedDoctor.id ? payload : d);
    } else {
      updated = [payload, ...doctors];
    }
    setDoctors(updated);
    localStorage.setItem(doctorsKey, JSON.stringify(updated));
    toast.success(selectedDoctor ? "Doctor profile updated!" : "New Doctor added to register!");
    setIsDoctorModalOpen(false);
  };

  const handleOpenAddLog = () => {
    setLogFormData({
      doctor_id: doctors[0]?.id || "",
      prescription_no: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      prescription_date: new Date().toISOString().split("T")[0],
      patient_name: "",
      medicine_total_amount: "1500",
      commission_amount: "75"
    });
    setIsLogModalOpen(true);
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = doctors.find(d => d.id === logFormData.doctor_id);
    if (!doc) {
      toast.error("Please select a doctor.");
      return;
    }

    const saleAmt = parseFloat(logFormData.medicine_total_amount) || 0;
    const commAmt = parseFloat(logFormData.commission_amount) || 0;

    const newLog: DoctorCommissionLog = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shop_id: shopId || "",
      doctor_id: doc.id,
      doctor_name: doc.doctor_name,
      prescription_no: logFormData.prescription_no.trim(),
      prescription_date: logFormData.prescription_date,
      patient_name: logFormData.patient_name.trim() || "Walk-in Patient",
      medicine_total_amount: saleAmt,
      commission_amount: commAmt,
      status: "accrued",
      created_at: new Date().toISOString()
    };

    const updatedLogs = [newLog, ...commissionLogs];
    setCommissionLogs(updatedLogs);
    localStorage.setItem(logsKey, JSON.stringify(updatedLogs));

    // Update doctor's accumulated ledger
    const updatedDocs = doctors.map(d => {
      if (d.id === doc.id) {
        return {
          ...d,
          total_prescriptions_count: d.total_prescriptions_count + 1,
          total_sales_generated: d.total_sales_generated + saleAmt,
          total_commission_earned: d.total_commission_earned + commAmt
        };
      }
      return d;
    });
    setDoctors(updatedDocs);
    localStorage.setItem(doctorsKey, JSON.stringify(updatedDocs));

    toast.success("Prescription commission logged successfully!");
    setIsLogModalOpen(false);
  };

  const handleOpenPayout = (doc: DoctorProfile) => {
    setSelectedDoctor(doc);
    const balance = doc.total_commission_earned - doc.total_commission_paid;
    setPayoutFormData({
      amount: String(Math.max(0, balance)),
      payment_mode: "Cash",
      notes: "Commission settlement"
    });
    setIsPayoutModalOpen(true);
  };

  const handleSavePayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) return;
    const payAmt = parseFloat(payoutFormData.amount) || 0;
    if (payAmt <= 0) {
      toast.error("Please enter a valid payout amount.");
      return;
    }

    const updatedDocs = doctors.map(d => {
      if (d.id === selectedDoctor.id) {
        return {
          ...d,
          total_commission_paid: d.total_commission_paid + payAmt
        };
      }
      return d;
    });
    setDoctors(updatedDocs);
    localStorage.setItem(doctorsKey, JSON.stringify(updatedDocs));

    // Mark relevant logs as paid
    const updatedLogs = commissionLogs.map(l => {
      if (l.doctor_id === selectedDoctor.id && l.status === "accrued") {
        return {
          ...l,
          status: "paid" as const,
          payment_date: new Date().toISOString().split("T")[0],
          payment_mode: payoutFormData.payment_mode
        };
      }
      return l;
    });
    setCommissionLogs(updatedLogs);
    localStorage.setItem(logsKey, JSON.stringify(updatedLogs));

    toast.success(`Rs ${payAmt} commission settlement paid to ${selectedDoctor.doctor_name}!`);
    setIsPayoutModalOpen(false);
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalDoctors = doctors.length;
    const totalSales = doctors.reduce((acc, d) => acc + (d.total_sales_generated || 0), 0);
    const totalEarned = doctors.reduce((acc, d) => acc + (d.total_commission_earned || 0), 0);
    const totalPaid = doctors.reduce((acc, d) => acc + (d.total_commission_paid || 0), 0);
    const netPayable = Math.max(0, totalEarned - totalPaid);

    return {
      totalDoctors,
      totalSales,
      totalEarned,
      totalPaid,
      netPayable
    };
  }, [doctors]);

  // Filtered
  const filteredDoctors = useMemo(() => {
    return doctors.filter(d => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.doctor_name.toLowerCase().includes(q) ||
          d.speciality.toLowerCase().includes(q) ||
          d.clinic_hospital.toLowerCase().includes(q) ||
          d.pmdc_no.toLowerCase().includes(q) ||
          d.phone.includes(q)
        );
      }
      return true;
    });
  }, [doctors, searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 p-5 sm:p-6 rounded-3xl text-white shadow-xl border border-emerald-900/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 shadow-inner">
              <Stethoscope size={26} className="animate-pulse" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Doctor Incentive & Commission Ledger
            </h1>
            <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-emerald-400/40">
              Prescription Referrals
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Manage nearby clinics, specialists, prescription referral volumes, incentive agreements, and settlement vouchers.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl font-bold text-xs cursor-pointer print:hidden"
          >
            <Printer size={15} className="mr-1.5" />
            Print Ledger Statement
          </Button>

          <Button
            onClick={handleOpenAddLog}
            size="sm"
            className="h-10 px-4 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-xl border border-white/20 cursor-pointer print:hidden"
          >
            <Receipt size={15} className="mr-1.5" />
            + Log Prescription
          </Button>

          <Button
            onClick={handleOpenAddDoctor}
            size="sm"
            className="h-10 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/30 border border-emerald-400/40 cursor-pointer print:hidden"
          >
            <Plus size={16} className="mr-1.5 stroke-[3]" />
            + Add Doctor Profile
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Registered Prescribers</span>
            <Users size={16} className="text-teal-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.totalDoctors}</p>
          <p className="text-[11px] text-slate-500 font-medium">Clinics & Specialists</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Referred Medicine Sales</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">Rs {metrics.totalSales.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-600 font-bold">Total revenue generated</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Commission Paid</span>
            <CheckCircle2 size={16} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-600">Rs {metrics.totalPaid.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 font-medium">Settled via vouchers</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Balance Payable</span>
            <Wallet size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">Rs {metrics.netPayable.toLocaleString()}</p>
          <p className="text-[11px] text-amber-700 font-bold">Accrued outstanding</p>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3 justify-between print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "directory"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Doctors Directory & Ledger ({doctors.length})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Prescriptions History ({commissionLogs.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search doctor, PMDC, hospital..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200 text-xs font-semibold rounded-xl"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "directory" ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Doctor & PMDC No</th>
                  <th className="py-3.5 px-4">Speciality & Clinic</th>
                  <th className="py-3.5 px-4">Commission Terms</th>
                  <th className="py-3.5 px-4 text-center">Total Rx Count</th>
                  <th className="py-3.5 px-4 text-right">Sales Generated</th>
                  <th className="py-3.5 px-4 text-right">Earned Commission</th>
                  <th className="py-3.5 px-4 text-right">Balance Due</th>
                  <th className="py-3.5 px-4 text-right print:hidden">Action / Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Stethoscope className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-600 text-sm">No doctors registered yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Click "+ Add Doctor Profile" to start tracking referrals.</p>
                    </td>
                  </tr>
                ) : (
                  filteredDoctors.map((doc) => {
                    const balance = Math.max(0, doc.total_commission_earned - doc.total_commission_paid);

                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-black text-slate-900 text-sm">{doc.doctor_name}</div>
                          <div className="text-[10.5px] font-mono text-emerald-700 font-extrabold">PMDC: {doc.pmdc_no}</div>
                          {doc.phone && <div className="text-[10px] text-slate-400">📞 {doc.phone}</div>}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{doc.speciality}</div>
                          <div className="text-[10.5px] text-slate-500">{doc.clinic_hospital || "Private Clinic"}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-[11px] px-2 py-0.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                            {doc.commission_type === "percentage" ? `${doc.commission_rate}% of Bill` : `Rs ${doc.commission_rate} Fixed / Rx`}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-black text-slate-900">
                          {doc.total_prescriptions_count} Rx
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          Rs {doc.total_sales_generated.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                          Rs {doc.total_commission_earned.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-amber-600">
                          Rs {balance.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right print:hidden">
                          <div className="flex items-center justify-end gap-1.5">
                            {balance > 0 && (
                              <Button
                                onClick={() => handleOpenPayout(doc)}
                                size="sm"
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs"
                              >
                                Pay Commission
                              </Button>
                            )}
                            <button
                              onClick={() => handleOpenEditDoctor(doc)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Rx No / Date</th>
                  <th className="py-3.5 px-4">Doctor Name</th>
                  <th className="py-3.5 px-4">Patient Name</th>
                  <th className="py-3.5 px-4 text-right">Medicine Bill Amount</th>
                  <th className="py-3.5 px-4 text-right">Commission Earned</th>
                  <th className="py-3.5 px-4 text-center">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {commissionLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{log.prescription_no}</div>
                      <div className="text-[10px] text-slate-400">{log.prescription_date}</div>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      {log.doctor_name}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      {log.patient_name}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      Rs {log.medicine_total_amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                      Rs {log.commission_amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        log.status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {log.status === "paid" ? `✓ Paid (${log.payment_mode || "Cash"})` : "⏳ Accrued Due"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Doctor Modal */}
      <AnimatePresence>
        {isDoctorModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                    <Stethoscope size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {selectedDoctor ? "Edit Doctor Profile" : "Register New Doctor"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Doctor Referral & Incentive Structure</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDoctorModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveDoctor} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Doctor Name *</label>
                    <Input
                      value={doctorFormData.doctor_name}
                      onChange={(e) => setDoctorFormData({ ...doctorFormData, doctor_name: e.target.value })}
                      placeholder="e.g. Dr. Tariq Mahmood"
                      required
                      className="h-9 bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">PMDC/PMC No</label>
                    <Input
                      value={doctorFormData.pmdc_no}
                      onChange={(e) => setDoctorFormData({ ...doctorFormData, pmdc_no: e.target.value })}
                      placeholder="e.g. 48291-P"
                      className="h-9 bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Speciality</label>
                    <Input
                      value={doctorFormData.speciality}
                      onChange={(e) => setDoctorFormData({ ...doctorFormData, speciality: e.target.value })}
                      placeholder="e.g. Cardiologist, Physician"
                      className="h-9 bg-white text-xs font-medium rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Clinic / Hospital</label>
                    <Input
                      value={doctorFormData.clinic_hospital}
                      onChange={(e) => setDoctorFormData({ ...doctorFormData, clinic_hospital: e.target.value })}
                      placeholder="e.g. Mayo Hospital / Clinic"
                      className="h-9 bg-white text-xs font-medium rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <Input
                    value={doctorFormData.phone}
                    onChange={(e) => setDoctorFormData({ ...doctorFormData, phone: e.target.value })}
                    placeholder="e.g. 0300-1234567"
                    className="h-9 bg-white text-xs font-medium rounded-xl"
                  />
                </div>

                <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                  <span className="text-[10.5px] font-black text-emerald-900 uppercase tracking-wider block">
                    Commission & Incentive Agreement
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Type</label>
                      <select
                        value={doctorFormData.commission_type}
                        onChange={(e) => setDoctorFormData({ ...doctorFormData, commission_type: e.target.value as any })}
                        className="w-full h-9 px-2 bg-white border border-slate-200 text-xs font-bold rounded-xl"
                      >
                        <option value="percentage">% Percentage of Prescription Bill</option>
                        <option value="fixed">Fixed Rs per Prescription</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Rate (% or Rs)</label>
                      <Input
                        type="number"
                        step="any"
                        value={doctorFormData.commission_rate}
                        onChange={(e) => setDoctorFormData({ ...doctorFormData, commission_rate: e.target.value })}
                        placeholder="e.g. 5"
                        required
                        className="h-9 bg-white text-xs font-black rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDoctorModalOpen(false)}
                    className="h-10 px-4 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {selectedDoctor ? "Update Profile" : "Save Doctor Profile"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Prescription Modal */}
      <AnimatePresence>
        {isLogModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-200">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Log Prescription Referral</h3>
                    <p className="text-xs text-slate-500 font-medium">Record doctor commission for a dispensed Rx</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsLogModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveLog} className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Prescribing Doctor *</label>
                  <select
                    value={logFormData.doctor_id}
                    onChange={(e) => {
                      const docId = e.target.value;
                      const d = doctors.find(x => x.id === docId);
                      const saleAmt = parseFloat(logFormData.medicine_total_amount) || 0;
                      let comm = "0";
                      if (d) {
                        if (d.commission_type === "percentage") {
                          comm = String(Math.round((saleAmt * d.commission_rate) / 100));
                        } else {
                          comm = String(d.commission_rate);
                        }
                      }
                      setLogFormData({ ...logFormData, doctor_id: docId, commission_amount: comm });
                    }}
                    required
                    className="w-full h-9 px-3 bg-white border border-slate-200 text-xs font-bold rounded-xl"
                  >
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.doctor_name} ({d.speciality} - {d.commission_rate}{d.commission_type === "percentage" ? "%" : " Rs"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Rx / Bill Number *</label>
                    <Input
                      value={logFormData.prescription_no}
                      onChange={(e) => setLogFormData({ ...logFormData, prescription_no: e.target.value })}
                      required
                      className="h-9 bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Prescription Date *</label>
                    <Input
                      type="date"
                      value={logFormData.prescription_date}
                      onChange={(e) => setLogFormData({ ...logFormData, prescription_date: e.target.value })}
                      required
                      className="h-9 bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Patient Name</label>
                  <Input
                    value={logFormData.patient_name}
                    onChange={(e) => setLogFormData({ ...logFormData, patient_name: e.target.value })}
                    placeholder="e.g. Muhammad Aslam"
                    className="h-9 bg-white text-xs font-medium rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Medicine Bill (Rs) *</label>
                    <Input
                      type="number"
                      step="any"
                      value={logFormData.medicine_total_amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        const saleAmt = parseFloat(val) || 0;
                        const d = doctors.find(x => x.id === logFormData.doctor_id);
                        let comm = "0";
                        if (d) {
                          if (d.commission_type === "percentage") {
                            comm = String(Math.round((saleAmt * d.commission_rate) / 100));
                          } else {
                            comm = String(d.commission_rate);
                          }
                        }
                        setLogFormData({ ...logFormData, medicine_total_amount: val, commission_amount: comm });
                      }}
                      required
                      className="h-9 bg-white text-xs font-black rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Commission Accrued (Rs) *</label>
                    <Input
                      type="number"
                      step="any"
                      value={logFormData.commission_amount}
                      onChange={(e) => setLogFormData({ ...logFormData, commission_amount: e.target.value })}
                      required
                      className="h-9 bg-emerald-50 text-emerald-900 text-xs font-black rounded-xl border-emerald-200"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsLogModalOpen(false)}
                    className="h-10 px-4 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    Log Prescription Commission
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payout Modal */}
      <AnimatePresence>
        {isPayoutModalOpen && selectedDoctor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 bg-emerald-50 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900 text-base">Pay Commission Settlement</h3>
                  <p className="text-xs text-emerald-800 font-bold">{selectedDoctor.doctor_name}</p>
                </div>
                <button
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePayout} className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payout Amount (Rs) *</label>
                  <Input
                    type="number"
                    step="any"
                    value={payoutFormData.amount}
                    onChange={(e) => setPayoutFormData({ ...payoutFormData, amount: e.target.value })}
                    required
                    className="h-10 bg-white text-base font-black text-emerald-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={payoutFormData.payment_mode}
                    onChange={(e) => setPayoutFormData({ ...payoutFormData, payment_mode: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 text-xs font-bold rounded-xl"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="JazzCash / EasyPaisa">JazzCash / EasyPaisa</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Voucher Reference</label>
                  <Input
                    value={payoutFormData.notes}
                    onChange={(e) => setPayoutFormData({ ...payoutFormData, notes: e.target.value })}
                    placeholder="e.g. Monthly referral incentive settled in full"
                    className="h-9 bg-white text-xs font-medium rounded-xl"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="h-10 px-4 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    Confirm Settlement Payout
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
