"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Smartphone, Search, PlusCircle, Trash2, Edit, Calendar, 
  Loader2, Save, X, Phone, User, Wrench, ShieldCheck,
  MessageCircle, Download, KeyRound, Grid, Lock, CheckCircle2,
  DollarSign, Clock, AlertCircle, TrendingUp, Sparkles, Plus,
  Layers, Package, Check, UserPlus, Printer, Percent
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import { RepairJobTokenModal } from "./components/RepairJobTokenModal";

type SparePartItem = {
  name: string;
  cost_price: number;     // What shop paid to market/supplier
  customer_price: number; // What is charged to customer
  source?: "market" | "inventory";
};

type RepairTicket = {
  id: string;
  party_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  device_model: string | null;
  imei_number: string | null;
  issue_description: string | null;
  estimated_cost: number; // Customer total bill
  repair_cost?: number;   // Shop total procurement/parts cost
  advance_amount?: number;
  pattern_lock?: string | null;
  passcode?: string | null;
  spare_parts?: SparePartItem[] | null;
  technician_name?: string | null;
  technician_commission_type?: "percent" | "fixed";
  technician_commission_value?: number;
  technician_commission_amount?: number;
  status: "pending" | "repairing" | "ready" | "delivered";
  created_at: string;
  parties?: any;
};

type Party = { id: string; name: string; phone: string | null };

export default function MobileRepairTicketsPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTicket, setEditingTicket] = useState<RepairTicket | null>(null);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenTicket, setTokenTicket] = useState<RepairTicket | null>(null);

  // Customer Mode: "walkin" or "registered"
  const [customerMode, setCustomerMode] = useState<"walkin" | "registered">("walkin");

  // Form State
  const [formData, setFormData] = useState({
    party_id: "" as string | null,
    customer_name: "Walk-in Customer",
    customer_phone: "",
    device_model: "",
    imei_number: "",
    issue_description: "",
    service_charges: 1000, // Labor / Service Fee
    estimated_cost: 1000,  // Total Customer Bill
    repair_cost: 0,        // Total Shop Cost (parts/market)
    advance_amount: 0,
    pattern_lock: [] as number[],
    passcode: "",
    technician_name: "",
    technician_commission_type: "percent" as "percent" | "fixed",
    technician_commission_value: 0,
    technician_commission_amount: 0,
    spare_parts: [] as SparePartItem[],
    status: "pending" as "pending" | "repairing" | "ready" | "delivered"
  });

  // Spare part temp input
  const [newPartName, setNewPartName] = useState("");
  const [newPartCost, setNewPartCost] = useState(0);
  const [newPartPrice, setNewPartPrice] = useState(0);
  const [newPartSource, setNewPartSource] = useState<"market" | "inventory">("market");

  useEffect(() => {
    if (shopId) {
      fetchTickets();
      fetchCustomers();
    }
  }, [shopId]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("repair_tickets")
        .select(`
          id, party_id, customer_name, customer_phone, device_model, imei_number, 
          issue_description, estimated_cost, repair_cost, advance_amount, 
          pattern_lock, passcode, spare_parts, technician_name, 
          technician_commission_type, technician_commission_value, technician_commission_amount,
          status, created_at, parties ( name, phone )
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      toast.error("Failed to load repair tickets: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, phone")
        .eq("shop_id", shopId)
        .eq("type", "customer")
        .order("name", { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTicket(null);
    setCustomerMode("walkin");
    setFormData({
      party_id: null,
      customer_name: "",
      customer_phone: "",
      device_model: "",
      imei_number: "",
      issue_description: "",
      service_charges: 1000,
      estimated_cost: 1000,
      repair_cost: 0,
      advance_amount: 0,
      pattern_lock: [],
      passcode: "",
      technician_name: "",
      technician_commission_type: "percent",
      technician_commission_value: 0,
      technician_commission_amount: 0,
      spare_parts: [],
      status: "pending"
    });
    setNewPartName("");
    setNewPartCost(0);
    setNewPartPrice(0);
    setNewPartSource("market");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: RepairTicket) => {
    setEditingTicket(t);
    let parsedPattern: number[] = [];
    if (t.pattern_lock) {
      try {
        parsedPattern = JSON.parse(t.pattern_lock);
      } catch {
        parsedPattern = t.pattern_lock.split("-").map(Number).filter(n => !isNaN(n));
      }
    }

    const isReg = !!t.party_id;
    setCustomerMode(isReg ? "registered" : "walkin");

    const parts: SparePartItem[] = Array.isArray(t.spare_parts) ? t.spare_parts.map((p: any) => ({
      name: p.name || "",
      cost_price: Number(p.cost_price || p.cost || 0),
      customer_price: Number(p.customer_price || p.cost || 0),
      source: p.source || "market"
    })) : [];

    const totalPartsCustomerPrice = parts.reduce((s, p) => s + p.customer_price, 0);
    const totalPartsCost = parts.reduce((s, p) => s + p.cost_price, 0);
    const labor = Math.max(0, Number(t.estimated_cost || 0) - totalPartsCustomerPrice);

    const commType = t.technician_commission_type || "percent";
    const commVal = Number(t.technician_commission_value || 0);
    const commAmt = Number(t.technician_commission_amount || (commType === "percent" ? (labor * commVal) / 100 : commVal));

    setFormData({
      party_id: t.party_id || null,
      customer_name: t.customer_name || getCustomerDetails(t.parties, t).name,
      customer_phone: t.customer_phone || getCustomerDetails(t.parties, t).phone || "",
      device_model: t.device_model || "",
      imei_number: t.imei_number || "",
      issue_description: t.issue_description || "",
      service_charges: labor,
      estimated_cost: Number(t.estimated_cost) || 0,
      repair_cost: Number(t.repair_cost) || totalPartsCost,
      advance_amount: Number(t.advance_amount) || 0,
      pattern_lock: parsedPattern,
      passcode: t.passcode || "",
      technician_name: t.technician_name || "",
      technician_commission_type: commType,
      technician_commission_value: commVal,
      technician_commission_amount: commAmt,
      spare_parts: parts,
      status: t.status
    });
    setNewPartName("");
    setNewPartCost(0);
    setNewPartPrice(0);
    setIsModalOpen(true);
  };

  const handlePatternDotClick = (dotIndex: number) => {
    setFormData(prev => {
      if (prev.pattern_lock.includes(dotIndex)) {
        return prev;
      }
      return {
        ...prev,
        pattern_lock: [...prev.pattern_lock, dotIndex]
      };
    });
  };

  const handleClearPattern = () => {
    setFormData(prev => ({ ...prev, pattern_lock: [] }));
  };

  // Recalculate totals whenever parts, labor, or commission change
  const recalculateTotals = (
    parts: SparePartItem[],
    serviceCharges: number,
    commType = formData.technician_commission_type,
    commVal = formData.technician_commission_value
  ) => {
    const totalPartsCost = parts.reduce((s, p) => s + Number(p.cost_price || 0), 0);
    const totalPartsCustomerPrice = parts.reduce((s, p) => s + Number(p.customer_price || 0), 0);
    const totalCustomerBill = totalPartsCustomerPrice + Number(serviceCharges || 0);

    let commissionAmt = 0;
    if (commType === "percent") {
      commissionAmt = Math.round((Number(serviceCharges || 0) * Number(commVal || 0)) / 100);
    } else {
      commissionAmt = Number(commVal || 0);
    }

    setFormData(prev => ({
      ...prev,
      spare_parts: parts,
      service_charges: serviceCharges,
      estimated_cost: totalCustomerBill,
      repair_cost: totalPartsCost,
      technician_commission_type: commType,
      technician_commission_value: commVal,
      technician_commission_amount: commissionAmt
    }));
  };

  const handleAddSparePart = () => {
    if (!newPartName.trim()) {
      toast.error("Please enter part name (e.g. OLED Panel, Battery)");
      return;
    }
    const part: SparePartItem = {
      name: newPartName.trim(),
      cost_price: Number(newPartCost) || 0,
      customer_price: Number(newPartPrice) > 0 ? Number(newPartPrice) : Number(newPartCost) || 0,
      source: newPartSource
    };

    const updatedParts = [...formData.spare_parts, part];
    recalculateTotals(updatedParts, formData.service_charges);
    setNewPartName("");
    setNewPartCost(0);
    setNewPartPrice(0);
  };

  const handleRemoveSparePart = (idx: number) => {
    const updatedParts = formData.spare_parts.filter((_, i) => i !== idx);
    recalculateTotals(updatedParts, formData.service_charges);
  };

  const handleSaveTicket = async () => {
    const finalCustName = customerMode === "registered"
      ? customers.find(c => c.id === formData.party_id)?.name || formData.customer_name
      : formData.customer_name.trim() || "Walk-in Customer";

    const finalCustPhone = customerMode === "registered"
      ? customers.find(c => c.id === formData.party_id)?.phone || formData.customer_phone
      : formData.customer_phone.trim();

    if (!formData.device_model.trim()) {
      toast.error("Please enter the device model (e.g. Samsung A32 / iPhone 13).");
      return;
    }

    setIsSubmitting(true);
    try {
      const dbPayload = {
        shop_id: shopId,
        party_id: customerMode === "registered" ? formData.party_id : null,
        customer_name: finalCustName,
        customer_phone: finalCustPhone || null,
        device_model: formData.device_model.trim(),
        imei_number: formData.imei_number.trim() || null,
        issue_description: formData.issue_description.trim() || null,
        estimated_cost: formData.estimated_cost,
        repair_cost: formData.repair_cost,
        advance_amount: formData.advance_amount,
        pattern_lock: formData.pattern_lock.length > 0 ? JSON.stringify(formData.pattern_lock) : null,
        passcode: formData.passcode.trim() || null,
        technician_name: formData.technician_name.trim() || null,
        technician_commission_type: formData.technician_commission_type,
        technician_commission_value: formData.technician_commission_value,
        technician_commission_amount: formData.technician_commission_amount,
        spare_parts: formData.spare_parts,
        status: formData.status
      };

      if (editingTicket) {
        const { error } = await supabase
          .from("repair_tickets")
          .update(dbPayload)
          .eq("id", editingTicket.id);

        if (error) throw error;
        toast.success("Repair ticket updated!");
      } else {
        const { data: inserted, error } = await supabase
          .from("repair_tickets")
          .insert(dbPayload)
          .select(`*, parties(name, phone)`)
          .single();

        if (error) throw error;
        toast.success("Repair job ticket opened!");
        if (inserted) {
          setTokenTicket(inserted as any);
          setIsTokenModalOpen(true);
        }
      }
      setIsModalOpen(false);
      fetchTickets();
    } catch (err: any) {
      toast.error("Failed to save repair ticket: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: "pending" | "repairing" | "ready" | "delivered") => {
    try {
      const { error } = await supabase
        .from("repair_tickets")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Ticket status updated to ${status.toUpperCase()}`);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this repair ticket?")) return;
    try {
      const { error } = await supabase
        .from("repair_tickets")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Ticket deleted.");
      fetchTickets();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const getCustomerDetails = (parties: any, ticket?: RepairTicket) => {
    if (ticket?.customer_name) {
      return {
        name: ticket.customer_name,
        phone: ticket.customer_phone || null
      };
    }
    if (!parties) return { name: "Walk-in Customer", phone: null };
    const party = Array.isArray(parties) ? parties[0] : parties;
    return {
      name: party?.name || "Walk-in Customer",
      phone: party?.phone || null
    };
  };

  // 1-Click WhatsApp Status Notification
  const sendWhatsAppUpdate = (ticket: RepairTicket) => {
    const customer = getCustomerDetails(ticket.parties, ticket);
    if (!customer.phone) {
      toast.error("Customer phone number is not available. Please edit ticket to add phone.");
      return;
    }

    const cleanPhone = customer.phone.replace(/[^0-9]/g, "").replace(/^0/, "92");
    const balance = Math.max(0, Number(ticket.estimated_cost || 0) - Number(ticket.advance_amount || 0));

    let msg = "";
    if (ticket.status === "ready") {
      msg = `*Dear ${customer.name}!* \n\nYour handset (*${ticket.device_model || "Device"}*) repair is completed and tested.\n\n💰 *Total Bill:* Rs ${Number(ticket.estimated_cost).toLocaleString()}\n💵 *Advance Paid:* Rs ${Number(ticket.advance_amount || 0).toLocaleString()}\n🏷️ *Balance Due:* Rs ${balance.toLocaleString()}\n\nPlease visit our shop with your job token slip to collect your handset.\n\n*${shopName || "Mobile Service Center"}*`;
    } else if (ticket.status === "delivered") {
      msg = `*Dear ${customer.name}!* \n\nYour handset (*${ticket.device_model || "Device"}*) has been delivered. For any inquiries, please contact us with your job token. Thank you!\n\n*${shopName || "Mobile Service Center"}*`;
    } else {
      msg = `*Dear ${customer.name}!* \n\nYour handset (*${ticket.device_model || "Device"}*) is currently in progress under repair. Token ID: *${ticket.id.substring(0, 8).toUpperCase()}*. We will notify you once ready.\n\n*${shopName || "Mobile Service Center"}*`;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  const generateRepairTokenPDF = (ticket: RepairTicket) => {
    try {
      const customer = getCustomerDetails(ticket.parties, ticket);
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a5"
      });

      // Outer border
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.rect(5, 5, 138, 200);

      // Header
      doc.setFillColor(241, 245, 249);
      doc.rect(6, 6, 136, 22, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(shopName || "THE ACCOUNTS ELECTRONICS", 74, 14, { align: "center" });

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229);
      doc.text("MOBILE SERVICE & REPAIR JOB TOKEN", 74, 20, { align: "center" });

      // Token Details Section
      let currentY = 35;
      const drawField = (label: string, value: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(label, 12, currentY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(value || "—", 52, currentY);
        currentY += 6.5;
      };

      const dateStr = new Date(ticket.created_at).toLocaleDateString();
      const tokenShortId = ticket.id.substring(0, 8).toUpperCase();
      const balance = Math.max(0, Number(ticket.estimated_cost || 0) - Number(ticket.advance_amount || 0));

      drawField("Job Token No:", tokenShortId);
      drawField("Date Received:", dateStr);
      drawField("Customer Name:", customer.name);
      drawField("Contact Number:", customer.phone || "—");
      drawField("Handset Model:", ticket.device_model || "—");
      drawField("IMEI / Serial:", ticket.imei_number || "—");
      drawField("Total Repair Bill:", `Rs ${Number(ticket.estimated_cost).toLocaleString()}`);
      drawField("Advance Paid:", `Rs ${Number(ticket.advance_amount || 0).toLocaleString()}`);
      drawField("Balance Due:", `Rs ${balance.toLocaleString()}`);

      // Passcode & Pattern
      if (ticket.passcode) {
        drawField("Screen PIN/Pass:", ticket.passcode);
      }

      // Draw Pattern Lock Box if present
      let patternArr: number[] = [];
      if (ticket.pattern_lock) {
        try {
          patternArr = JSON.parse(ticket.pattern_lock);
        } catch {
          patternArr = ticket.pattern_lock.split("-").map(Number).filter(n => !isNaN(n));
        }
      }

      if (patternArr.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text("Pattern Lock:", 12, currentY);

        const startX = 52;
        const startY = currentY - 3;
        const gap = 6;
        const dotCoords: { [idx: number]: { x: number; y: number } } = {};

        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const idx = row * 3 + col + 1;
            const x = startX + col * gap;
            const y = startY + row * gap;
            dotCoords[idx] = { x, y };

            const isPart = patternArr.includes(idx);
            doc.setFillColor(isPart ? 79 : 203, isPart ? 70 : 213, isPart ? 229 : 225);
            doc.circle(x, y, isPart ? 1.2 : 0.8, "F");
          }
        }

        // Draw connecting lines between sequence
        doc.setDrawColor(79, 70, 229);
        doc.setLineWidth(0.4);
        for (let i = 0; i < patternArr.length - 1; i++) {
          const p1 = dotCoords[patternArr[i]];
          const p2 = dotCoords[patternArr[i + 1]];
          if (p1 && p2) {
            doc.line(p1.x, p1.y, p2.x, p2.y);
          }
        }
        currentY += 18;
      }

      // Issue diagnosis box
      currentY += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("Reported Fault / Problem:", 12, currentY);
      currentY += 4.5;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const splitIssue = doc.splitTextToSize(ticket.issue_description || "General servicing and repair diagnostics.", 120);
      doc.text(splitIssue, 12, currentY);
      currentY += splitIssue.length * 4 + 4;

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.line(10, currentY, 138, currentY);
      currentY += 6;

      // Terms and conditions
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text("Terms & Conditions:", 12, currentY);
      currentY += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      const disclaimers = [
        "1. Token receipt must be presented to claim handset return.",
        "2. Customer is responsible for backup of personal data and files.",
        "3. Handsets uncollected after 30 days will not be shop's responsibility.",
        "4. Display / Glass replacement testing must be verified at counter upon pickup."
      ];
      disclaimers.forEach(line => {
        doc.text(line, 12, currentY);
        currentY += 3.5;
      });

      // Signature area
      currentY += 8;
      doc.setDrawColor(180, 180, 180);
      doc.line(12, currentY, 48, currentY);
      doc.line(95, currentY, 135, currentY);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text("Customer Signature", 16, currentY + 3.5);
      doc.text("Shopkeeper Stamp", 100, currentY + 3.5);

      doc.save(`Repair_Token_${tokenShortId}_${customer.name.replace(/\s+/g, "_")}.pdf`);
      toast.success("Repair Token PDF generated!");
    } catch (e: any) {
      toast.error("Failed to generate PDF: " + e.message);
    }
  };

  const filteredTickets = tickets.filter(t => {
    const cust = getCustomerDetails(t.parties, t);
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (t.device_model && t.device_model.toLowerCase().includes(q)) ||
      (t.imei_number && t.imei_number.toLowerCase().includes(q)) ||
      (t.issue_description && t.issue_description.toLowerCase().includes(q)) ||
      cust.name.toLowerCase().includes(q) ||
      (cust.phone && cust.phone.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Financial aggregates
  const totalRevenue = tickets.reduce((s, t) => s + Number(t.estimated_cost || 0), 0);
  const totalCost = tickets.reduce((s, t) => s + Number(t.repair_cost || 0), 0);
  const netProfit = totalRevenue - totalCost;

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Wrench className="text-indigo-600 h-6 w-6" />
            <span>Mobile Repairing &amp; Service Desk</span>
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Walk-in customer records, spare parts procurement costs, profit tracking, pattern locks, and WhatsApp alerts
          </p>
        </div>

        <Button
          onClick={handleOpenAddModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs px-4 rounded-xl shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="mr-1.5 h-4 w-4" />
          New Repair Job Card
        </Button>
      </div>

      {/* KPI Cards with Profit Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-indigo-50/70 border border-indigo-200/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">Total Customer Revenue</span>
            <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-800"><DollarSign size={13}/></span>
          </div>
          <p className="text-2xl font-black text-indigo-950 mt-1">
            Rs {Math.round(totalRevenue).toLocaleString()}
          </p>
          <p className="text-[11px] font-semibold text-indigo-800/80 mt-0.5">Customer billed amount</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Procurement &amp; Parts Cost</span>
            <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800"><Layers size={13}/></span>
          </div>
          <p className="text-2xl font-black text-amber-950 mt-1">
            Rs {Math.round(totalCost).toLocaleString()}
          </p>
          <p className="text-[11px] font-semibold text-amber-800/80 mt-0.5">Market parts procurement cost</p>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Net Repair Profit</span>
            <span className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800"><TrendingUp size={13}/></span>
          </div>
          <p className="text-2xl font-black text-emerald-950 mt-1">
            Rs {Math.round(netProfit).toLocaleString()}
          </p>
          <p className="text-[11px] font-semibold text-emerald-800/80 mt-0.5">
            Margin: {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0"}%
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Active Jobs</span>
            <span className="p-1.5 rounded-xl bg-slate-200 text-slate-700"><Wrench size={13}/></span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {tickets.filter(t => t.status !== "delivered").length}
          </p>
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {tickets.filter(t => t.status === "ready").length} Ready for pickup
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by Customer Name, Phone, Model, Fault, or IMEI..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="repairing">Under Repair</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left text-slate-600">
            <thead className="bg-slate-100/80 text-[10px] uppercase font-black text-slate-700 border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-3.5">Token &amp; Date</th>
                <th className="py-3 px-3.5">Customer Details</th>
                <th className="py-3 px-3.5">Device &amp; Security</th>
                <th className="py-3 px-3.5">Fault &amp; Parts Used</th>
                <th className="py-3 px-3.5 text-right">Bill / Cost / Profit</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-center">WhatsApp &amp; Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading repair job sheets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Wrench className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    No repair tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => {
                  const cust = getCustomerDetails(ticket.parties, ticket);
                  const bill = Number(ticket.estimated_cost || 0);
                  const cost = Number(ticket.repair_cost || 0);
                  const profit = bill - cost;
                  const balance = Math.max(0, bill - Number(ticket.advance_amount || 0));

                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 text-[10px]">
                          #{ticket.id.substring(0, 8).toUpperCase()}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{cust.name}</span>
                          {!ticket.party_id && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-normal">Walk-in</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone size={10} className="text-slate-400"/>
                          <span>{cust.phone || "No Phone"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800">{ticket.device_model}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {ticket.imei_number ? `IMEI: ${ticket.imei_number}` : "No IMEI"}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {ticket.pattern_lock && (
                            <span className="inline-flex items-center text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold border border-indigo-100">
                              <Grid size={9} className="mr-0.5"/> Pattern Set
                            </span>
                          )}
                          {ticket.passcode && (
                            <span className="inline-flex items-center text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                              <KeyRound size={9} className="mr-0.5"/> PIN: {ticket.passcode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <p className="truncate text-slate-700 font-semibold">{ticket.issue_description || "No fault noted"}</p>
                        {Array.isArray(ticket.spare_parts) && ticket.spare_parts.length > 0 && (
                          <div className="text-[10px] text-indigo-600 truncate mt-0.5 font-bold">
                            Parts: {ticket.spare_parts.map((p: any) => p.name).join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <div className="font-black text-slate-900 text-sm">
                          Rs {bill.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400 space-x-1">
                          <span>Cost: Rs {cost.toLocaleString()}</span>
                          <span>·</span>
                          <span className="text-emerald-600 font-bold">Profit: Rs {profit.toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-rose-600 font-bold">
                          Due: Rs {balance.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <select
                          value={ticket.status}
                          onChange={e => updateStatus(ticket.id, e.target.value as any)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer ${
                            ticket.status === "ready" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            ticket.status === "repairing" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            ticket.status === "delivered" ? "bg-slate-100 text-slate-700 border-slate-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="repairing">Under Repair</option>
                          <option value="ready">Ready</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1-Click WhatsApp Notification */}
                          <Button
                            onClick={() => sendWhatsAppUpdate(ticket)}
                            size="sm"
                            className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 rounded-lg cursor-pointer shadow-2xs"
                            title="Send WhatsApp Status Alert"
                          >
                            <MessageCircle size={12} className="mr-1"/>
                            WhatsApp
                          </Button>

                          {/* Print Token Slip (80mm Thermal / A5) */}
                          <Button
                            onClick={() => {
                              setTokenTicket(ticket);
                              setIsTokenModalOpen(true);
                            }}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] font-bold border-slate-200 text-slate-700 hover:bg-slate-50 px-2 rounded-lg cursor-pointer flex items-center gap-1"
                            title="Print 80mm Thermal or A5 Repair Token"
                          >
                            <Printer size={11}/>
                            <span>Token</span>
                          </Button>

                          {/* Edit Ticket */}
                          <Button
                            onClick={() => handleOpenEditModal(ticket)}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 rounded-lg"
                          >
                            <Edit size={13}/>
                          </Button>

                          {/* Delete Ticket */}
                          <Button
                            onClick={() => handleDelete(ticket.id)}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 rounded-lg"
                          >
                            <Trash2 size={13}/>
                          </Button>
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

      {/* Add / Edit Repair Job Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-indigo-50 text-indigo-600">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {editingTicket ? "Edit Repair Job Card" : "New Mobile Repair Job Sheet"}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Walk-in customer entry, pattern lock, parts procurement cost &amp; profit tracking
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 pt-4 text-xs">
                {/* 1. Customer Selection (Walk-in vs Ledger) */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <User size={13}/>
                      <span>Customer Information</span>
                    </span>

                    {/* Mode Toggle */}
                    <div className="flex bg-white p-0.5 rounded-xl border border-slate-200 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setCustomerMode("walkin")}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          customerMode === "walkin"
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Walk-in
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerMode("registered");
                          if (!formData.party_id && customers.length > 0) {
                            setFormData(prev => ({
                              ...prev,
                              party_id: customers[0].id,
                              customer_name: customers[0].name,
                              customer_phone: customers[0].phone || ""
                            }));
                          }
                        }}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                          customerMode === "registered"
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        From Ledger
                      </button>
                    </div>
                  </div>

                  {customerMode === "walkin" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Customer Full Name *
                        </label>
                        <Input
                          value={formData.customer_name}
                          onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                          placeholder="e.g. Usman Ali / Walk-in Customer"
                          className="h-8 text-xs font-bold rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Phone / WhatsApp Number (For Alerts)
                        </label>
                        <Input
                          value={formData.customer_phone}
                          onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
                          placeholder="0300-1234567"
                          className="h-8 text-xs font-bold rounded-xl bg-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Select Ledger Customer *
                      </label>
                      <select
                        value={formData.party_id || ""}
                        onChange={e => {
                          const p = customers.find(c => c.id === e.target.value);
                          setFormData({
                            ...formData,
                            party_id: e.target.value,
                            customer_name: p ? p.name : formData.customer_name,
                            customer_phone: p?.phone || formData.customer_phone
                          });
                        }}
                        className="w-full h-8 text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5"
                      >
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.phone || "No Phone"})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 2. Device Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Device Model &amp; Color *
                    </label>
                    <Input
                      value={formData.device_model}
                      onChange={e => setFormData({ ...formData, device_model: e.target.value })}
                      placeholder="e.g. Samsung A32 (Black)"
                      className="h-8 text-xs font-bold rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      IMEI / Serial Number
                    </label>
                    <Input
                      value={formData.imei_number}
                      onChange={e => setFormData({ ...formData, imei_number: e.target.value })}
                      placeholder="15-digit IMEI"
                      className="h-8 text-xs font-mono font-bold rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Assigned Technician
                    </label>
                    <Input
                      value={formData.technician_name}
                      onChange={e => setFormData({ ...formData, technician_name: e.target.value })}
                      placeholder="e.g. Ali Technician"
                      className="h-8 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* Technician Commission Split */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Technician Commission Type
                    </label>
                    <select
                      value={formData.technician_commission_type}
                      onChange={e => {
                        const type = e.target.value as "percent" | "fixed";
                        recalculateTotals(formData.spare_parts, formData.service_charges, type, formData.technician_commission_value);
                      }}
                      className="w-full h-8 text-xs bg-white border border-slate-200 rounded-xl px-2 font-bold"
                    >
                      <option value="percent">% of Labor Fee</option>
                      <option value="fixed">Fixed Rs Amount</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Commission Value ({formData.technician_commission_type === "percent" ? "%" : "Rs"})
                    </label>
                    <Input
                      type="number"
                      value={formData.technician_commission_value || ""}
                      onChange={e => {
                        const val = Number(e.target.value) || 0;
                        recalculateTotals(formData.spare_parts, formData.service_charges, formData.technician_commission_type, val);
                      }}
                      placeholder={formData.technician_commission_type === "percent" ? "50%" : "Rs 500"}
                      className="h-8 text-xs font-bold rounded-xl bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1">
                      Technician Payout
                    </label>
                    <div className="h-8 flex items-center text-xs font-black text-indigo-700 font-mono bg-indigo-50/60 px-3 rounded-xl border border-indigo-100">
                      Rs {Number(formData.technician_commission_amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* 3. Pattern Lock & PIN Code Section */}
                <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={13}/>
                      <span>Device Pattern Lock &amp; PIN</span>
                    </span>
                    {formData.pattern_lock.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearPattern}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Reset Pattern
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    {/* 3x3 Interactive Pattern Canvas */}
                    <div className="flex flex-col items-center bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                      <p className="text-[10px] font-bold text-slate-400 mb-2">Click / Tap dots to draw lock:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(dot => {
                          const order = formData.pattern_lock.indexOf(dot);
                          const isSelected = order !== -1;

                          return (
                            <button
                              key={dot}
                              type="button"
                              onClick={() => handlePatternDotClick(dot)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-indigo-600 text-white shadow-md scale-105"
                                  : "bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-700"
                              }`}
                            >
                              {isSelected ? order + 1 : "•"}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] font-mono text-indigo-700 font-bold mt-2">
                        {formData.pattern_lock.length > 0
                          ? `Path: ${formData.pattern_lock.join(" → ")}`
                          : "No pattern recorded"}
                      </p>
                    </div>

                    {/* PIN / Password Code */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Numeric Screen PIN / Password
                      </label>
                      <Input
                        value={formData.passcode}
                        onChange={e => setFormData({ ...formData, passcode: e.target.value })}
                        placeholder="e.g. 1234 or 0000"
                        className="h-8 text-xs font-mono font-bold rounded-xl bg-white"
                      />
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Lock details allow technicians to test touch, camera, microphone &amp; speaker after repair.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Issue Description */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Reported Fault / Problem Description *
                  </label>
                  <Input
                    value={formData.issue_description}
                    onChange={e => setFormData({ ...formData, issue_description: e.target.value })}
                    placeholder="e.g. Panel Broken, Touch not responding, Charging port loose, Battery health 60%"
                    className="h-8 text-xs font-medium rounded-xl"
                  />
                </div>

                {/* 5. Spare Parts Procurement & Costing */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Package size={13} className="text-indigo-600"/>
                      <span>Spare Parts Consumed &amp; Procurement Cost</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      Procured from Market / Stock
                    </span>
                  </div>

                  {/* Add Part Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80">
                    <div className="sm:col-span-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Part Name</label>
                      <Input
                        placeholder="e.g. OLED Panel"
                        value={newPartName}
                        onChange={e => setNewPartName(e.target.value)}
                        className="h-7 text-xs rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Our Cost Price</label>
                      <Input
                        type="number"
                        placeholder="Rs 3500"
                        value={newPartCost || ""}
                        onChange={e => setNewPartCost(Number(e.target.value))}
                        className="h-7 text-xs font-bold text-amber-800 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Customer Rate</label>
                      <Input
                        type="number"
                        placeholder="Rs 5000"
                        value={newPartPrice || ""}
                        onChange={e => setNewPartPrice(Number(e.target.value))}
                        className="h-7 text-xs font-bold text-slate-900 rounded-lg"
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={handleAddSparePart}
                        size="sm"
                        className="h-7 w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                      >
                        + Add Part
                      </Button>
                    </div>
                  </div>

                  {/* Parts List */}
                  {formData.spare_parts.length > 0 ? (
                    <div className="space-y-1.5">
                      {formData.spare_parts.map((p, idx) => {
                        const partProfit = (p.customer_price || 0) - (p.cost_price || 0);
                        return (
                          <div key={idx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="text-amber-800 font-semibold">Cost: Rs {p.cost_price.toLocaleString()}</span>
                              <span className="text-slate-900 font-bold">Charge: Rs {p.customer_price.toLocaleString()}</span>
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                Profit: +Rs {partProfit.toLocaleString()}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSparePart(idx)}
                                className="text-rose-500 hover:text-rose-700 p-0.5"
                              >
                                <X size={13}/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic text-center py-1">
                      No spare parts added. (If handset only requires service/labor, specify labor charges below).
                    </p>
                  )}
                </div>

                {/* 6. Final Financial Summary & Profit Live Calculation */}
                <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Labor / Service Fee
                      </label>
                      <Input
                        type="number"
                        value={formData.service_charges}
                        onChange={e => {
                          const labor = Number(e.target.value) || 0;
                          recalculateTotals(formData.spare_parts, labor);
                        }}
                        className="h-8 text-xs font-bold text-white bg-slate-800 border-slate-700 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-wider mb-1">
                        Total Shop Cost
                      </label>
                      <div className="h-8 flex items-center text-sm font-black text-amber-400 font-mono">
                        Rs {formData.repair_cost.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider mb-1">
                        Net Shop Profit
                      </label>
                      <div className="h-8 flex items-center text-sm font-black text-emerald-400 font-mono">
                        +Rs {(formData.estimated_cost - formData.repair_cost - (formData.technician_commission_amount || 0)).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-blue-300 uppercase tracking-wider mb-1">
                        Total Customer Bill *
                      </label>
                      <Input
                        type="number"
                        value={formData.estimated_cost}
                        onChange={e => setFormData({ ...formData, estimated_cost: Number(e.target.value) })}
                        className="h-8 text-sm font-black text-white bg-blue-950 border-blue-800 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Advance Paid
                      </label>
                      <Input
                        type="number"
                        value={formData.advance_amount}
                        onChange={e => setFormData({ ...formData, advance_amount: Number(e.target.value) })}
                        className="h-8 text-xs font-bold text-emerald-400 bg-slate-800 border-slate-700 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                        Initial Job Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        className="w-full h-8 text-xs bg-slate-800 text-white border border-slate-700 rounded-xl px-2.5 font-bold"
                      >
                        <option value="pending">Pending</option>
                        <option value="repairing">Under Repair</option>
                        <option value="ready">Ready</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-5 border-t border-slate-100 mt-5">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl h-9 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTicket}
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 text-xs font-bold shadow-xs cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5"/> : <Save className="h-4 w-4 mr-1.5"/>}
                  Save &amp; Generate Job Token
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Job Card & Claim Token Modal */}
      <RepairJobTokenModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        ticket={tokenTicket}
        shopDetails={{
          name: shopName || "Mobile Care",
          phone: "",
          address: ""
        }}
      />
    </div>
  );
}
