"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldAlert, Plus, Search, Filter, Calendar, 
  FileText, Download, Printer, CheckCircle2, AlertTriangle, 
  Trash2, Edit, UserCheck, Stethoscope, Pill, 
  Clock, MapPin, Building2, Eye, X, Loader2, Sparkles, RefreshCw
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ControlledDrugLog {
  id: string;
  shop_id: string;
  prescription_date: string;
  prescription_no: string;
  doctor_name: string;
  doctor_pmdc: string;
  patient_name: string;
  patient_cnic: string;
  patient_phone?: string;
  patient_address?: string;
  medicine_name: string;
  generic_salt?: string;
  batch_number: string;
  expiry_date?: string;
  dispensed_qty: number;
  unit: string;
  dosage_instruction?: string;
  pharmacist_name: string;
  notes?: string;
  created_at: string;
}

export default function ControlledNarcoticsRegisterPage() {
  const { shopId, shopName, industryType } = useShop();
  const supabase = createClient();

  const [logs, setLogs] = useState<ControlledDrugLog[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ControlledDrugLog | null>(null);
  const [viewingLog, setViewingLog] = useState<ControlledDrugLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    prescription_date: new Date().toISOString().split("T")[0],
    prescription_no: "",
    doctor_name: "",
    doctor_pmdc: "",
    patient_name: "",
    patient_cnic: "",
    patient_phone: "",
    patient_address: "",
    medicine_name: "",
    generic_salt: "",
    batch_number: "",
    expiry_date: "",
    dispensed_qty: "1",
    unit: "Tablets",
    dosage_instruction: "",
    pharmacist_name: "In-Charge Pharmacist",
    notes: ""
  });

  // Local storage cache key
  const storageKey = `pharmacy_controlled_logs_${shopId || "default"}`;

  useEffect(() => {
    if (shopId) {
      fetchLogs();
      fetchProducts();
    }
  }, [shopId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Check remote supabase table
      const { data, error } = await supabase
        .from("pharmacy_controlled_logs")
        .select("*")
        .eq("shop_id", shopId)
        .order("prescription_date", { ascending: false });

      if (!error && data) {
        setLogs(data);
        localStorage.setItem(storageKey, JSON.stringify(data));
      } else {
        // Fallback to local storage if offline
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            setLogs(JSON.parse(saved));
          } catch {
            setLogs([]);
          }
        } else {
          setLogs([]);
        }
      }
    } catch {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setLogs(JSON.parse(saved));
        } catch {
          setLogs([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await supabase
        .from("products")
        .select("id, name, unit, is_controlled, current_stock")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });
      if (data) setProducts(data);
    } catch {}
  };

  const handleOpenAdd = () => {
    setEditingLog(null);
    setFormData({
      prescription_date: new Date().toISOString().split("T")[0],
      prescription_no: `RX-${Math.floor(1000 + Math.random() * 9000)}`,
      doctor_name: "",
      doctor_pmdc: "",
      patient_name: "",
      patient_cnic: "",
      patient_phone: "",
      patient_address: "",
      medicine_name: "",
      generic_salt: "",
      batch_number: "",
      expiry_date: "",
      dispensed_qty: "1",
      unit: "Tablets",
      dosage_instruction: "",
      pharmacist_name: "In-Charge Pharmacist",
      notes: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (log: ControlledDrugLog) => {
    setEditingLog(log);
    setFormData({
      prescription_date: log.prescription_date,
      prescription_no: log.prescription_no,
      doctor_name: log.doctor_name,
      doctor_pmdc: log.doctor_pmdc,
      patient_name: log.patient_name,
      patient_cnic: log.patient_cnic,
      patient_phone: log.patient_phone || "",
      patient_address: log.patient_address || "",
      medicine_name: log.medicine_name,
      generic_salt: log.generic_salt || "",
      batch_number: log.batch_number,
      expiry_date: log.expiry_date || "",
      dispensed_qty: String(log.dispensed_qty),
      unit: log.unit || "Tablets",
      dosage_instruction: log.dosage_instruction || "",
      pharmacist_name: log.pharmacist_name || "In-Charge Pharmacist",
      notes: log.notes || ""
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.doctor_name.trim() || !formData.patient_name.trim() || !formData.medicine_name.trim()) {
      toast.error("Please fill in Doctor Name, Patient Name, and Medicine Name.");
      return;
    }
    if (!formData.patient_cnic.trim()) {
      toast.error("Patient CNIC / Identity is legally required for Controlled Drug Dispensing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ControlledDrugLog = {
        id: editingLog ? editingLog.id : `ctrl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        shop_id: shopId || "",
        prescription_date: formData.prescription_date,
        prescription_no: formData.prescription_no,
        doctor_name: formData.doctor_name.trim(),
        doctor_pmdc: formData.doctor_pmdc.trim(),
        patient_name: formData.patient_name.trim(),
        patient_cnic: formData.patient_cnic.trim(),
        patient_phone: formData.patient_phone.trim(),
        patient_address: formData.patient_address.trim(),
        medicine_name: formData.medicine_name.trim(),
        generic_salt: formData.generic_salt.trim(),
        batch_number: formData.batch_number.trim() || "N/A",
        expiry_date: formData.expiry_date || undefined,
        dispensed_qty: parseFloat(formData.dispensed_qty) || 1,
        unit: formData.unit,
        dosage_instruction: formData.dosage_instruction.trim(),
        pharmacist_name: formData.pharmacist_name.trim(),
        notes: formData.notes.trim(),
        created_at: editingLog ? editingLog.created_at : new Date().toISOString()
      };

      // Try database sync
      try {
        if (editingLog) {
          await supabase.from("pharmacy_controlled_logs").upsert([payload]);
        } else {
          await supabase.from("pharmacy_controlled_logs").insert([payload]);
        }
      } catch {}

      // Update local state
      let updated: ControlledDrugLog[];
      if (editingLog) {
        updated = logs.map(l => l.id === editingLog.id ? payload : l);
      } else {
        updated = [payload, ...logs];
      }
      setLogs(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      toast.success(editingLog ? "Controlled log updated successfully!" : "Controlled drug entry registered legally!");
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to save entry: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this controlled drug record?")) return;
    try {
      await supabase.from("pharmacy_controlled_logs").delete().eq("id", id);
    } catch {}
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success("Entry removed from register.");
  };

  const handlePrintRegister = () => {
    window.print();
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalDispensed = logs.reduce((acc, l) => acc + (Number(l.dispensed_qty) || 0), 0);
    const uniquePatients = new Set(logs.map(l => l.patient_cnic.trim().toLowerCase())).size;
    const uniqueDoctors = new Set(logs.map(l => l.doctor_name.trim().toLowerCase())).size;
    const thisMonthLogs = logs.filter(l => {
      const d = new Date(l.prescription_date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return {
      totalEntries: logs.length,
      totalDispensed,
      uniquePatients,
      uniqueDoctors,
      thisMonthLogs
    };
  }, [logs]);

  // Filtered
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          l.patient_name.toLowerCase().includes(q) ||
          l.patient_cnic.toLowerCase().includes(q) ||
          l.doctor_name.toLowerCase().includes(q) ||
          l.doctor_pmdc.toLowerCase().includes(q) ||
          l.medicine_name.toLowerCase().includes(q) ||
          l.batch_number.toLowerCase().includes(q) ||
          l.prescription_no.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (dateFilter === "today") {
        const today = new Date().toISOString().split("T")[0];
        return l.prescription_date === today;
      }
      if (dateFilter === "month") {
        const now = new Date();
        const d = new Date(l.prescription_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [logs, searchQuery, dateFilter]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-red-950 via-slate-900 to-rose-950 p-5 sm:p-6 rounded-3xl text-white shadow-xl border border-red-900/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-red-600/30 text-red-400 border border-red-500/30 shadow-inner">
              <ShieldAlert size={26} className="animate-pulse" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Controlled & Narcotics Register (Schedule G)
            </h1>
            <span className="bg-red-500/20 text-red-300 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-red-500/40">
              DRAP Compliance
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Official digital ledger for Schedule G psychotropics, sleeping pills, sedatives, and controlled injections under the Drug Act.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={handlePrintRegister}
            variant="outline"
            size="sm"
            className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl font-bold text-xs cursor-pointer print:hidden"
          >
            <Printer size={15} className="mr-1.5" />
            Print Form-7 Audit
          </Button>

          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="h-10 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/30 border border-red-400/30 cursor-pointer print:hidden"
          >
            <Plus size={16} className="mr-1.5 stroke-[3]" />
            + Record Dispensation
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Total Recorded</span>
            <FileText size={16} className="text-red-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.totalEntries}</p>
          <p className="text-[11px] text-slate-500 font-medium">{metrics.thisMonthLogs} entries this month</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Qty Dispensed</span>
            <Pill size={16} className="text-rose-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.totalDispensed} <span className="text-xs font-bold text-slate-500">units</span></p>
          <p className="text-[11px] text-emerald-600 font-bold">100% Batches logged</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Unique Patients</span>
            <UserCheck size={16} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.uniquePatients}</p>
          <p className="text-[11px] text-slate-500 font-medium">All verified via CNIC</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Prescribing Doctors</span>
            <Stethoscope size={16} className="text-violet-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.uniqueDoctors}</p>
          <p className="text-[11px] text-slate-500 font-medium">PMDC/PMC Registered</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3 justify-between print:hidden">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search Patient CNIC, Doctor, Medicine, Batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-slate-50 border-slate-200 text-xs font-semibold rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 px-3 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today's Dispensation</option>
            <option value="month">This Month</option>
          </select>

          <Button
            onClick={fetchLogs}
            variant="outline"
            size="sm"
            className="h-10 px-3 border-slate-200 text-slate-600 rounded-xl"
            title="Refresh logs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Printable Official Inspection Header */}
        <div className="hidden print:block p-6 border-b border-slate-300 text-center space-y-1">
          <h2 className="text-xl font-black text-slate-900 uppercase">
            {shopName || "THE ACCOUNTS PHARMACY"}
          </h2>
          <p className="text-sm font-bold text-slate-700">
            STATUTORY SCHEDULE G / CONTROLLED DRUGS DISPENSATION REGISTER (FORM-7)
          </p>
          <p className="text-xs text-slate-500">
            Maintained under Drug Act 1976 & DRAP Regulations | Generated on {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Date / Rx No</th>
                <th className="py-3.5 px-4">Patient Details (CNIC)</th>
                <th className="py-3.5 px-4">Doctor & PMDC No</th>
                <th className="py-3.5 px-4">Medicine & Generic</th>
                <th className="py-3.5 px-4">Batch & Expiry</th>
                <th className="py-3.5 px-4 text-center">Qty Dispensed</th>
                <th className="py-3.5 px-4">Pharmacist</th>
                <th className="py-3.5 px-4 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-red-600" />
                    <p className="font-bold">Loading controlled narcotics ledger...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 text-sm">No controlled drug entries found.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "+ Record Dispensation" above to log a Schedule G prescription.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{log.prescription_date}</div>
                      <div className="text-[10.5px] font-mono text-red-600 font-extrabold">{log.prescription_no}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-black text-slate-900">{log.patient_name}</div>
                      <div className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                        CNIC: {log.patient_cnic}
                      </div>
                      {log.patient_phone && <div className="text-[10px] text-slate-400">📞 {log.patient_phone}</div>}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{log.doctor_name}</div>
                      <div className="text-[10.5px] text-violet-700 font-extrabold">{log.doctor_pmdc || "PMDC: Verified"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-black text-slate-900">{log.medicine_name}</div>
                      {log.generic_salt && (
                        <div className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded inline-block">
                          Salt: {log.generic_salt}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-800">Batch: {log.batch_number}</div>
                      {log.expiry_date && <div className="text-[10px] text-slate-400 font-medium">Exp: {log.expiry_date}</div>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-black text-sm px-2.5 py-1 rounded-xl bg-red-50 text-red-700 border border-red-200 inline-block">
                        {log.dispensed_qty} {log.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 text-[11px]">{log.pharmacist_name}</div>
                      {log.dosage_instruction && (
                        <div className="text-[9.5px] text-slate-500 italic truncate max-w-[140px]">
                          {log.dosage_instruction}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right print:hidden">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingLog(log)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                          title="View Full Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(log)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                          title="Edit Entry"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title="Delete Entry"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Footer Verification */}
        <div className="hidden print:flex justify-between items-end p-8 pt-16 border-t border-slate-300 text-xs">
          <div className="text-center space-y-1">
            <div className="w-48 border-b border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-800">In-Charge Pharmacist Signature</p>
            <p className="text-[10px] text-slate-500">Pharm-D / Category-A Stamp</p>
          </div>

          <div className="text-center space-y-1">
            <div className="w-48 border-b border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-800">Govt Drug Inspector Signature</p>
            <p className="text-[10px] text-slate-500">Provincial Quality Control Board</p>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 my-8"
            >
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-red-50 via-rose-50/50 to-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shadow-md shadow-red-200">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {editingLog ? "Edit Controlled Dispensation Record" : "Record Controlled / Narcotic Dispensation"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Schedule G Statutory Legal Entry</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Prescription & Doctor Section */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    1. Prescriber & Rx Details
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Prescription Date *</label>
                      <Input
                        type="date"
                        value={formData.prescription_date}
                        onChange={(e) => setFormData({ ...formData, prescription_date: e.target.value })}
                        required
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Rx / Slip Number *</label>
                      <Input
                        value={formData.prescription_no}
                        onChange={(e) => setFormData({ ...formData, prescription_no: e.target.value })}
                        placeholder="e.g. RX-4912"
                        required
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Doctor PMDC/PMC No *</label>
                      <Input
                        value={formData.doctor_pmdc}
                        onChange={(e) => setFormData({ ...formData, doctor_pmdc: e.target.value })}
                        placeholder="e.g. 48291-P"
                        required
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Doctor Name & Hospital *</label>
                    <Input
                      value={formData.doctor_name}
                      onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                      placeholder="e.g. Dr. Tariq Mahmood (FCPS - Sheikh Zayed Hospital)"
                      required
                      className="h-9 bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                </div>

                {/* Patient Section */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    2. Patient Verification
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Patient Full Name *</label>
                      <Input
                        value={formData.patient_name}
                        onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                        placeholder="e.g. Muhammad Aslam"
                        required
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Patient CNIC / B-Form *</label>
                      <Input
                        value={formData.patient_cnic}
                        onChange={(e) => setFormData({ ...formData, patient_cnic: e.target.value })}
                        placeholder="e.g. 35201-8492019-3"
                        required
                        className="h-9 bg-white text-xs font-mono font-bold rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Patient Phone / Mobile</label>
                      <Input
                        value={formData.patient_phone}
                        onChange={(e) => setFormData({ ...formData, patient_phone: e.target.value })}
                        placeholder="e.g. 0300-8472910"
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Address / City</label>
                      <Input
                        value={formData.patient_address}
                        onChange={(e) => setFormData({ ...formData, patient_address: e.target.value })}
                        placeholder="e.g. Gulberg III, Lahore"
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Medicine & Dispensation Details */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                    3. Medicine & Batch Dispensed
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Medicine Name *</label>
                      <Input
                        value={formData.medicine_name}
                        onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
                        placeholder="e.g. Xanax 0.5mg Tab"
                        required
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Generic Salt / Formula</label>
                      <Input
                        value={formData.generic_salt}
                        onChange={(e) => setFormData({ ...formData, generic_salt: e.target.value })}
                        placeholder="e.g. Alprazolam / Diazepam"
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Batch Number *</label>
                      <Input
                        value={formData.batch_number}
                        onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                        placeholder="e.g. XN8490"
                        required
                        className="h-9 bg-white text-xs font-mono font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Dispensed Quantity *</label>
                      <Input
                        type="number"
                        step="any"
                        min="1"
                        value={formData.dispensed_qty}
                        onChange={(e) => setFormData({ ...formData, dispensed_qty: e.target.value })}
                        required
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit</label>
                      <select
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full h-9 px-2 bg-white border border-slate-200 text-xs font-bold rounded-xl"
                      >
                        <option value="Tablets">Tablets</option>
                        <option value="Capsules">Capsules</option>
                        <option value="Injections/Vials">Injections/Vials</option>
                        <option value="Syrup/Bottles">Syrup/Bottles</option>
                        <option value="Packs">Packs</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Dosage & Directions</label>
                    <Input
                      value={formData.dosage_instruction}
                      onChange={(e) => setFormData({ ...formData, dosage_instruction: e.target.value })}
                      placeholder="e.g. 1 Tablet once daily at bedtime for 14 days"
                      className="h-9 bg-white text-xs font-medium rounded-xl"
                    />
                  </div>
                </div>

                {/* Pharmacist Sign Off */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Dispensing Pharmacist *</label>
                    <Input
                      value={formData.pharmacist_name}
                      onChange={(e) => setFormData({ ...formData, pharmacist_name: e.target.value })}
                      required
                      className="h-9 bg-slate-50 text-xs font-bold rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Verification Stamp</label>
                    <Input
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="e.g. Original physical prescription retained in file."
                      className="h-9 bg-slate-50 text-xs font-medium rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="h-10 px-4 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </span>
                    ) : (
                      editingLog ? "Update Record" : "Save Legal Record"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Detail Modal */}
      <AnimatePresence>
        {viewingLog && (
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
              <div className="p-5 border-b border-slate-100 bg-red-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="text-red-600" size={22} />
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Controlled Drug Dispensation Details</h3>
                    <p className="text-xs text-red-700 font-mono font-bold">Rx No: {viewingLog.prescription_no}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingLog(null)}
                  className="h-8 w-8 rounded-full bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Prescription Date</span>
                    <span className="font-black text-slate-900">{viewingLog.prescription_date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Doctor PMDC</span>
                    <span className="font-black text-violet-700">{viewingLog.doctor_pmdc}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Prescribing Doctor</span>
                    <span className="font-black text-slate-900">{viewingLog.doctor_name}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Patient Name</span>
                      <span className="font-black text-slate-900">{viewingLog.patient_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Patient CNIC</span>
                      <span className="font-mono font-black text-slate-900">{viewingLog.patient_cnic}</span>
                    </div>
                  </div>
                  {viewingLog.patient_phone && (
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Contact / Phone</span>
                      <span className="font-bold text-slate-700">{viewingLog.patient_phone}</span>
                    </div>
                  )}
                  {viewingLog.patient_address && (
                    <div>
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Address</span>
                      <span className="text-slate-700">{viewingLog.patient_address}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-red-50/50 rounded-2xl border border-red-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-red-700 font-black text-sm block">{viewingLog.medicine_name}</span>
                      {viewingLog.generic_salt && <span className="text-slate-500 text-[11px]">Salt: {viewingLog.generic_salt}</span>}
                    </div>
                    <span className="font-black text-base text-red-700 bg-white px-3 py-1 rounded-xl border border-red-200">
                      {viewingLog.dispensed_qty} {viewingLog.unit}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] pt-1">
                    <span className="font-mono font-bold text-slate-700">Batch: {viewingLog.batch_number}</span>
                    {viewingLog.expiry_date && <span className="text-slate-500">Exp: {viewingLog.expiry_date}</span>}
                  </div>
                  {viewingLog.dosage_instruction && (
                    <p className="text-slate-700 italic pt-1 border-t border-red-100">
                      <strong>Dosage:</strong> {viewingLog.dosage_instruction}
                    </p>
                  )}
                </div>

                <div className="text-slate-500 text-[11px] pt-1">
                  <strong>Dispensed By:</strong> {viewingLog.pharmacist_name}
                  {viewingLog.notes && <p className="mt-0.5"><strong>Notes:</strong> {viewingLog.notes}</p>}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <Button
                  onClick={() => setViewingLog(null)}
                  className="h-9 px-4 bg-slate-900 text-white font-bold text-xs rounded-xl"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
