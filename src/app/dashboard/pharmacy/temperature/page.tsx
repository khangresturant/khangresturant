"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Thermometer, Plus, Search, Filter, Calendar, 
  Printer, CheckCircle2, AlertTriangle, AlertCircle, 
  Trash2, Edit, Clock, MapPin, Building2, 
  RefreshCw, FileText, Loader2, Sparkles, Snowflake, Zap, ZapOff, X
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TemperatureLog {
  id: string;
  shop_id: string;
  log_date: string;
  shift: "Morning" | "Evening";
  equipment_name: string; // e.g. Refrigerator #1 (Vaccines & Biologics)
  temperature: number; // e.g. 4.5
  min_temp?: number;
  max_temp?: number;
  humidity_percent?: number;
  power_cut_occurred: boolean;
  generator_backup_used: boolean;
  logged_by: string;
  remarks?: string;
  created_at: string;
}

export default function FridgeTemperatureLogPage() {
  const { shopId, shopName, industryType } = useShop();
  const supabase = createClient();

  const [logs, setLogs] = useState<TemperatureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TemperatureLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    log_date: new Date().toISOString().split("T")[0],
    shift: "Morning" as "Morning" | "Evening",
    equipment_name: "Fridge #1 (Main Vaccine & Insulin Unit)",
    temperature: "4.5",
    min_temp: "3.5",
    max_temp: "5.5",
    humidity_percent: "55",
    power_cut_occurred: false,
    generator_backup_used: false,
    logged_by: "Dr. Usman (Pharmacist)",
    remarks: ""
  });

  const storageKey = `pharmacy_temp_logs_${shopId || "default"}`;

  useEffect(() => {
    if (shopId) {
      fetchLogs();
    }
  }, [shopId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pharmacy_temperature_logs")
        .select("*")
        .eq("shop_id", shopId)
        .order("log_date", { ascending: false });

      if (!error && data && data.length > 0) {
        setLogs(data);
        localStorage.setItem(storageKey, JSON.stringify(data));
      } else {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            setLogs(JSON.parse(saved));
          } catch {
            setLogs([]);
          }
        } else {
          // Sample Initial 5 Days of Temperature Readings
          const sampleData: TemperatureLog[] = [
            {
              id: "temp-1",
              shop_id: shopId || "",
              log_date: new Date().toISOString().split("T")[0],
              shift: "Morning",
              equipment_name: "Fridge #1 (Main Vaccine & Insulin Unit)",
              temperature: 4.2,
              min_temp: 3.5,
              max_temp: 5.1,
              humidity_percent: 54,
              power_cut_occurred: false,
              generator_backup_used: false,
              logged_by: "Dr. Usman (Pharm-D)",
              remarks: "Optimal 2-8°C cold-chain maintained.",
              created_at: new Date().toISOString()
            },
            {
              id: "temp-2",
              shop_id: shopId || "",
              log_date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
              shift: "Evening",
              equipment_name: "Fridge #1 (Main Vaccine & Insulin Unit)",
              temperature: 4.8,
              min_temp: 4.0,
              max_temp: 5.6,
              humidity_percent: 56,
              power_cut_occurred: false,
              generator_backup_used: false,
              logged_by: "Shahid (Pharmacy Tech)",
              remarks: "Evening routine check verified.",
              created_at: new Date(Date.now() - 86400000).toISOString()
            },
            {
              id: "temp-3",
              shop_id: shopId || "",
              log_date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
              shift: "Morning",
              equipment_name: "Fridge #1 (Main Vaccine & Insulin Unit)",
              temperature: 4.1,
              min_temp: 3.2,
              max_temp: 4.9,
              humidity_percent: 52,
              power_cut_occurred: false,
              generator_backup_used: false,
              logged_by: "Dr. Usman (Pharm-D)",
              remarks: "Insulin & Sera stock inspected.",
              created_at: new Date(Date.now() - 86400000).toISOString()
            }
          ];
          setLogs(sampleData);
          localStorage.setItem(storageKey, JSON.stringify(sampleData));
        }
      }
    } catch {
      const saved = localStorage.getItem(storageKey);
      if (saved) setLogs(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    const currentHour = new Date().getHours();
    const autoShift = currentHour >= 14 ? "Evening" : "Morning";

    setEditingLog(null);
    setFormData({
      log_date: new Date().toISOString().split("T")[0],
      shift: autoShift,
      equipment_name: "Fridge #1 (Main Vaccine & Insulin Unit)",
      temperature: "4.5",
      min_temp: "3.5",
      max_temp: "5.5",
      humidity_percent: "55",
      power_cut_occurred: false,
      generator_backup_used: false,
      logged_by: "Dr. Usman (Pharmacist)",
      remarks: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (log: TemperatureLog) => {
    setEditingLog(log);
    setFormData({
      log_date: log.log_date,
      shift: log.shift,
      equipment_name: log.equipment_name,
      temperature: String(log.temperature),
      min_temp: log.min_temp !== undefined ? String(log.min_temp) : "",
      max_temp: log.max_temp !== undefined ? String(log.max_temp) : "",
      humidity_percent: log.humidity_percent !== undefined ? String(log.humidity_percent) : "55",
      power_cut_occurred: log.power_cut_occurred,
      generator_backup_used: log.generator_backup_used,
      logged_by: log.logged_by,
      remarks: log.remarks || ""
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempNum = parseFloat(formData.temperature);
    if (isNaN(tempNum)) {
      toast.error("Please enter a valid temperature.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: TemperatureLog = {
        id: editingLog ? editingLog.id : `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        shop_id: shopId || "",
        log_date: formData.log_date,
        shift: formData.shift,
        equipment_name: formData.equipment_name.trim(),
        temperature: tempNum,
        min_temp: formData.min_temp ? parseFloat(formData.min_temp) : undefined,
        max_temp: formData.max_temp ? parseFloat(formData.max_temp) : undefined,
        humidity_percent: formData.humidity_percent ? parseFloat(formData.humidity_percent) : undefined,
        power_cut_occurred: formData.power_cut_occurred,
        generator_backup_used: formData.generator_backup_used,
        logged_by: formData.logged_by.trim(),
        remarks: formData.remarks.trim(),
        created_at: editingLog ? editingLog.created_at : new Date().toISOString()
      };

      try {
        if (editingLog) {
          await supabase.from("pharmacy_temperature_logs").upsert([payload]);
        } else {
          await supabase.from("pharmacy_temperature_logs").insert([payload]);
        }
      } catch {}

      let updated: TemperatureLog[];
      if (editingLog) {
        updated = logs.map(l => l.id === editingLog.id ? payload : l);
      } else {
        updated = [payload, ...logs];
      }
      setLogs(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));

      if (tempNum < 2 || tempNum > 8) {
        toast.warning(`⚠️ Temperature recorded outside standard 2°C-8°C range (${tempNum}°C). Check cooling unit immediately!`);
      } else {
        toast.success("Temperature reading logged successfully!");
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to log reading: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this temperature log entry?")) return;
    try {
      await supabase.from("pharmacy_temperature_logs").delete().eq("id", id);
    } catch {}
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    toast.success("Entry deleted.");
  };

  // Metrics
  const metrics = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter(l => l.log_date === today);
    const inRangeLogs = logs.filter(l => l.temperature >= 2 && l.temperature <= 8).length;
    const alertLogs = logs.filter(l => l.temperature < 2 || l.temperature > 8).length;
    const complianceRate = logs.length > 0 ? Math.round((inRangeLogs / logs.length) * 100) : 100;
    const latestReading = logs[0]?.temperature || 4.2;

    return {
      todayMorningLogged: todayLogs.some(l => l.shift.includes("Morning")),
      todayEveningLogged: todayLogs.some(l => l.shift.includes("Evening")),
      latestReading,
      complianceRate,
      alertLogs,
      totalReadings: logs.length
    };
  }, [logs]);

  // Filtered Logs for Table
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (selectedEquipment !== "all" && l.equipment_name !== selectedEquipment) return false;
      if (selectedMonth && !l.log_date.startsWith(selectedMonth)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.equipment_name.toLowerCase().includes(q) ||
          l.logged_by.toLowerCase().includes(q) ||
          (l.remarks && l.remarks.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [logs, selectedEquipment, selectedMonth, searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-950 via-slate-900 to-cyan-950 p-5 sm:p-6 rounded-3xl text-white shadow-xl border border-sky-900/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 shadow-inner">
              <Snowflake size={26} className="animate-pulse" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Cold Chain & Fridge Temperature Log
            </h1>
            <span className="bg-cyan-500/20 text-cyan-300 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-cyan-400/40">
              2°C - 8°C GDP Standard
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Daily Morning & Evening temperature verification for Insulins, Vaccines, Eye Drops, and Biologics for Drug Inspection Audits.
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
            Print Monthly Inspection Log
          </Button>

          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="h-10 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-600/30 border border-cyan-400/30 cursor-pointer print:hidden"
          >
            <Plus size={16} className="mr-1.5 stroke-[3]" />
            + Record Temp Reading
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Latest Temperature</span>
            <Thermometer size={16} className="text-cyan-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className={`text-2xl font-black ${
              metrics.latestReading >= 2 && metrics.latestReading <= 8 
                ? "text-emerald-600" 
                : "text-red-600"
            }`}>
              {metrics.latestReading}°C
            </p>
            <span className="text-[10.5px] font-bold text-slate-500">
              {metrics.latestReading >= 2 && metrics.latestReading <= 8 ? "Optimal (2-8°C)" : "Breach Alert"}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-400">Target Range: 2.0°C to 8.0°C</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Today's Shifts</span>
            <Clock size={16} className="text-indigo-600" />
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${
              metrics.todayMorningLogged 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              {metrics.todayMorningLogged ? "✓ Morning Done" : "⏳ Morning Pending"}
            </span>
            <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${
              metrics.todayEveningLogged 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}>
              {metrics.todayEveningLogged ? "✓ Evening Done" : "⏳ Evening"}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-400">Twice daily requirement</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Cold-Chain Compliance</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.complianceRate}%</p>
          <p className="text-[10.5px] text-emerald-600 font-bold">DRAP Good Distribution Practice</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider">Breach / Alerts</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics.alertLogs}</p>
          <p className="text-[10.5px] text-slate-500 font-medium">Temperature excursions</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center gap-3 justify-between print:hidden">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-0.5">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 px-3 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl text-slate-700"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-0.5">Equipment / Refrigerator</label>
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="h-9 px-3 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl text-slate-700 cursor-pointer"
            >
              <option value="all">All Units</option>
              <option value="Fridge #1 (Main Vaccine & Insulin Unit)">Fridge #1 (Main Vaccine & Insulin Unit)</option>
              <option value="Fridge #2 (Eye Drops & Biologics)">Fridge #2 (Eye Drops & Biologics)</option>
              <option value="Freezer (Ice Packs / Cold Chain Box)">Freezer (Ice Packs / Cold Chain Box)</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
          <Input
            placeholder="Search staff, remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200 text-xs font-semibold rounded-xl"
          />
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Printable Official Header */}
        <div className="hidden print:block p-6 border-b border-slate-300 text-center space-y-1">
          <h2 className="text-xl font-black text-slate-900 uppercase">
            {shopName || "THE ACCOUNTS PHARMACY"}
          </h2>
          <p className="text-sm font-bold text-slate-700">
            OFFICIAL COLD-CHAIN & REFRIGERATOR TEMPERATURE LOG SHEET
          </p>
          <p className="text-xs text-slate-500">
            Compliant with WHO GDP & DRAP Drug Storage Rules (2°C - 8°C Standard) | Month: {selectedMonth}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Shift</th>
                <th className="py-3.5 px-4">Equipment Unit</th>
                <th className="py-3.5 px-4 text-center">Recorded Temp</th>
                <th className="py-3.5 px-4 text-center">Min / Max Range</th>
                <th className="py-3.5 px-4 text-center">Power / Gen Backup</th>
                <th className="py-3.5 px-4">Recorded By</th>
                <th className="py-3.5 px-4">Remarks & Action</th>
                <th className="py-3.5 px-4 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-600" />
                    <p className="font-bold">Loading cold-chain temperature logs...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Snowflake className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-600 text-sm">No temperature logs found for selected month.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "+ Record Temp Reading" to log daily morning and evening readings.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isNormal = log.temperature >= 2 && log.temperature <= 8;
                  const isFreezing = log.temperature < 2;
                  const isTooWarm = log.temperature > 8;
                  const cleanShift = log.shift.includes("Morning") ? "Morning" : "Evening";

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {log.log_date}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          cleanShift === "Morning" 
                            ? "bg-amber-50 text-amber-800 border border-amber-200" 
                            : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                        }`}>
                          {cleanShift}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {log.equipment_name}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-xl border ${
                          isNormal 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : isTooWarm
                              ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          <Thermometer size={12} />
                          {log.temperature}°C
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                        {log.min_temp !== undefined && log.max_temp !== undefined 
                          ? `${log.min_temp}°C - ${log.max_temp}°C` 
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {log.power_cut_occurred ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <ZapOff size={10} /> Outage (Gen Backup {log.generator_backup_used ? "✓" : "✗"})
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Normal AC Power</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {log.logged_by}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                        {log.remarks || (isNormal ? "Normal cold-chain." : "Excursion noted.")}
                      </td>
                      <td className="py-3.5 px-4 text-right print:hidden">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(log)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                            title="Edit Reading"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                            title="Delete Reading"
                          >
                            <Trash2 size={15} />
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

        {/* Printable Footer Stamp */}
        <div className="hidden print:flex justify-between items-end p-8 pt-16 border-t border-slate-300 text-xs">
          <div className="text-center space-y-1">
            <div className="w-48 border-b border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-800">Pharm-D / Pharmacist In-Charge</p>
            <p className="text-[10px] text-slate-500">Stamp & Daily Verification</p>
          </div>

          <div className="text-center space-y-1">
            <div className="w-48 border-b border-slate-400 mb-2"></div>
            <p className="font-bold text-slate-800">Drug Inspector Signature & Stamp</p>
            <p className="text-[10px] text-slate-500">Provincial Health Department</p>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-cyan-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-200">
                    <Thermometer size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">
                      {editingLog ? "Edit Temperature Log Entry" : "Record Daily Temperature Reading"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Standard WHO 2°C - 8°C Cold Chain</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Date *</label>
                    <Input
                      type="date"
                      value={formData.log_date}
                      onChange={(e) => setFormData({ ...formData, log_date: e.target.value })}
                      required
                      className="h-9 bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Shift *</label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                      className="w-full h-9 px-2 bg-white border border-slate-200 text-xs font-bold rounded-xl"
                    >
                      <option value="Morning">Morning</option>
                      <option value="Evening">Evening</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Equipment / Refrigerator *</label>
                  <select
                    value={formData.equipment_name}
                    onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 text-xs font-bold rounded-xl"
                  >
                    <option value="Fridge #1 (Main Vaccine & Insulin Unit)">Fridge #1 (Main Vaccine & Insulin Unit)</option>
                    <option value="Fridge #2 (Eye Drops & Biologics)">Fridge #2 (Eye Drops & Biologics)</option>
                    <option value="Freezer (Ice Packs / Cold Chain Box)">Freezer (Ice Packs / Cold Chain Box)</option>
                  </select>
                </div>

                <div className="p-4 bg-cyan-50/50 rounded-2xl border border-cyan-100 space-y-3">
                  <span className="text-[11px] font-black text-cyan-900 uppercase tracking-wider block">
                    Thermometer Readings (°C)
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Recorded °C *</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                        placeholder="e.g. 4.5"
                        required
                        className="h-9 bg-white text-xs font-black text-slate-900 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Min °C (24h)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.min_temp}
                        onChange={(e) => setFormData({ ...formData, min_temp: e.target.value })}
                        placeholder="e.g. 3.2"
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Max °C (24h)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.max_temp}
                        onChange={(e) => setFormData({ ...formData, max_temp: e.target.value })}
                        placeholder="e.g. 5.8"
                        className="h-9 bg-white text-xs font-bold rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.power_cut_occurred}
                      onChange={(e) => setFormData({ ...formData, power_cut_occurred: e.target.checked })}
                      className="rounded border-slate-300 text-cyan-600"
                    />
                    <span className="text-xs font-bold text-slate-700">Power outage occurred during shift</span>
                  </label>

                  {formData.power_cut_occurred && (
                    <label className="flex items-center gap-2 cursor-pointer ml-5">
                      <input
                        type="checkbox"
                        checked={formData.generator_backup_used}
                        onChange={(e) => setFormData({ ...formData, generator_backup_used: e.target.checked })}
                        className="rounded border-slate-300 text-emerald-600"
                      />
                      <span className="text-xs font-bold text-emerald-700">Generator / UPS backup was active</span>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Logged By (Staff Name) *</label>
                    <Input
                      value={formData.logged_by}
                      onChange={(e) => setFormData({ ...formData, logged_by: e.target.value })}
                      required
                      className="h-9 bg-white text-xs font-bold rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks</label>
                    <Input
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="e.g. Routine reading ok."
                      className="h-9 bg-white text-xs font-medium rounded-xl"
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
                    className="h-10 px-5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </span>
                    ) : (
                      editingLog ? "Update Reading" : "Save Reading"
                    )}
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
