"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, MessageSquare, CheckCircle, Clock,
  AlertTriangle, Building2, User, Phone, Calendar,
  Loader2, Receipt, ShieldCheck, Check, RefreshCw, Undo2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type ClaimRecord = {
  id: string;
  claim_number: string;
  supplier_id: string | null;
  supplier_name: string;
  booker_name: string | null;
  booker_phone: string | null;
  status: "submitted" | "approved" | "adjusted" | "rejected";
  total_items: number;
  total_claimed_amount: number;
  approved_amount: number;
  credit_note_number: string | null;
  notes: string | null;
  return_reason: string;
  submitted_at: string;
  approved_at: string | null;
  settled_at: string | null;
};

export type ClaimItem = {
  id: string;
  claim_id: string;
  product_id: string;
  product_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  pack_size: number | null;
  unit: string | null;
  purchase_price: number;
  subtotal: number;
  status: string;
};

interface ClaimDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  claim: ClaimRecord | null;
  shopId: string;
  shopName: string;
  onStatusUpdated: () => void;
}

export function ClaimDetailModal({
  isOpen,
  onClose,
  claim,
  shopId,
  shopName,
  onStatusUpdated,
}: ClaimDetailModalProps) {
  const supabase = createClient();

  const [items, setItems] = useState<ClaimItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Status Action Form State
  const [actionType, setActionType] = useState<"none" | "approve" | "settle" | "reject">("none");
  const [creditNoteNo, setCreditNoteNo] = useState("");
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [restoreStockOnReject, setRestoreStockOnReject] = useState(true);

  useEffect(() => {
    if (isOpen && claim?.id) {
      fetchClaimItems();
      setApprovedAmount(claim.total_claimed_amount || 0);
      setCreditNoteNo(claim.credit_note_number || "");
    }
  }, [isOpen, claim?.id]);

  const fetchClaimItems = async () => {
    if (!claim?.id) return;
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("supplier_expiry_claim_items")
        .select("*")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      toast.error("Failed to load claim items: " + e.message);
    } finally {
      setLoadingItems(false);
    }
  };

  if (!isOpen || !claim) return null;

  // 1-Click WhatsApp Share
  const handleSendWhatsApp = () => {
    const phone = claim.booker_phone ? claim.booker_phone.replace(/[^0-9]/g, "") : "";
    let text = `📦 *DISTRIBUTOR EXPIRY CLAIM & GATE PASS*\n`;
    text += `*Pharmacy:* ${shopName}\n`;
    text += `*Claim #:* ${claim.claim_number}\n`;
    text += `*Distributor:* ${claim.supplier_name}\n`;
    text += `*Date:* ${new Date(claim.submitted_at).toLocaleDateString()}\n`;
    text += `*Status:* ${claim.status.toUpperCase()}\n`;
    text += `────────────────────\n`;
    text += `*RETURNED EXPIRY BATCHES:*\n\n`;

    items.forEach((it, idx) => {
      text += `${idx + 1}. *${it.product_name}*\n`;
      text += `   • Batch: ${it.batch_number || "N/A"} · Exp: ${it.expiry_date || "N/A"}\n`;
      text += `   • Qty: ${it.quantity} ${it.unit || "Pcs"}\n`;
      text += `   • Claim Rate: Rs ${it.purchase_price} (Subtotal: Rs ${Math.round(it.subtotal).toLocaleString()})\n\n`;
    });

    text += `────────────────────\n`;
    text += `*Total Claim Value:* Rs ${Math.round(claim.total_claimed_amount).toLocaleString()}\n`;
    if (claim.credit_note_number) {
      text += `*Credit Note #:* ${claim.credit_note_number}\n`;
    }
    text += `\nPlease issue replacement / credit note in next invoice. Thank you!`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = phone
      ? `https://wa.me/${phone}?text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(whatsappUrl, "_blank");
    toast.success("WhatsApp message opened!");
  };

  // 1-Click Dual-Copy Gate Pass PDF Generation
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 32, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(shopName?.toUpperCase() || "THE ACCOUNTS PHARMACY", 14, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text("OFFICIAL EXPIRY RETURN CLAIM NOTE & DELIVERY GATE PASS", 14, 21);
      doc.text(`Claim #: ${claim.claim_number} · Date: ${new Date(claim.submitted_at).toLocaleString()}`, 14, 27);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(244, 63, 94); // Rose 500
      doc.text("DELIVERY GATE PASS", 155, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Status: ${claim.status.toUpperCase()}`, 155, 22);

      // Two Cards: Supplier & Delivery Representative
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 38, 88, 22, 2, 2, "FD");
      doc.roundedRect(108, 38, 88, 22, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("DISTRIBUTOR / SUPPLIER:", 18, 44);
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(claim.supplier_name, 18, 51);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("RECEIVED BY (DELIVERY BOOKER):", 112, 44);
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(claim.booker_name || "Delivery Representative", 112, 51);
      if (claim.booker_phone) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Phone: ${claim.booker_phone}`, 112, 56);
      }

      // Items Table
      const tableRows = items.map((it, idx) => [
        idx + 1,
        it.product_name,
        it.batch_number || "N/A",
        it.expiry_date || "N/A",
        `${it.quantity} ${it.unit || "Pcs"}`,
        `Rs ${it.purchase_price.toLocaleString()}`,
        `Rs ${Math.round(it.subtotal).toLocaleString()}`,
      ]);

      autoTable(doc, {
        head: [
          [
            "#",
            "Medicine / Item Description",
            "Batch #",
            "Expiry Date",
            "Returned Qty",
            "Purchase Rate",
            "Claim Amount",
          ],
        ],
        body: tableRows,
        startY: 65,
        theme: "striped",
        headStyles: {
          fillColor: [225, 29, 72], // Rose 600
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 60, fontStyle: "bold" },
          2: { cellWidth: 25, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 22, halign: "center" },
          4: { cellWidth: 22, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 22, halign: "right" },
          6: { cellWidth: 23, halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;

      // Summary & Signatures Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(120, finalY, 76, 24, 2, 2, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Returned Items: ${items.length}`, 124, finalY + 7);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total Claimed: Rs ${Math.round(claim.total_claimed_amount).toLocaleString()}`, 124, finalY + 16);

      // Signatures
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("DELIVERY BOY / BOOKER SIGNATURE", 14, finalY + 10);
      doc.line(14, finalY + 22, 80, finalY + 22);

      doc.text("PHARMACIST / DISPENSER SIGNATURE", 14, finalY + 32);
      doc.line(14, finalY + 44, 80, finalY + 44);

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Note: This Gate Pass confirms handover of expired/damaged medicines for company credit note.", 14, 285);

      doc.save(`expiry_claim_${claim.claim_number}.pdf`);
      toast.success("Gate Pass PDF downloaded!");
    } catch (err: any) {
      toast.error("PDF generation failed: " + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (newStatus: "approved" | "adjusted" | "rejected") => {
    setIsUpdatingStatus(true);
    try {
      const payload: any = { status: newStatus };

      if (newStatus === "approved") {
        payload.approved_at = new Date().toISOString();
        payload.credit_note_number = creditNoteNo.trim() || null;
        payload.approved_amount = approvedAmount || claim.total_claimed_amount;
      } else if (newStatus === "adjusted") {
        payload.settled_at = new Date().toISOString();
      } else if (newStatus === "rejected") {
        // If rejected and restoreStockOnReject is true, restore stock in product_batches
        if (restoreStockOnReject) {
          for (const it of items) {
            if (it.batch_number) {
              const { data: bRow } = await supabase
                .from("product_batches")
                .select("id, stock_quantity")
                .eq("shop_id", shopId)
                .eq("product_id", it.product_id)
                .eq("batch_number", it.batch_number)
                .maybeSingle();

              if (bRow) {
                await supabase
                  .from("product_batches")
                  .update({ stock_quantity: (bRow.stock_quantity || 0) + it.quantity })
                  .eq("id", bRow.id);
              }
            }
          }
        }
      }

      const { error } = await supabase
        .from("supplier_expiry_claims")
        .update(payload)
        .eq("id", claim.id);

      if (error) throw error;

      toast.success(`Claim #${claim.claim_number} updated to ${newStatus.toUpperCase()}!`);
      setActionType("none");
      onStatusUpdated();
      onClose();
    } catch (err: any) {
      toast.error("Failed to update status: " + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto"
        >
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 text-white flex justify-between items-start shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-indigo-400 bg-indigo-950 border border-indigo-800 px-2.5 py-0.5 rounded-md">
                  #{claim.claim_number}
                </span>
                <span
                  className={`text-[10.5px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                    claim.status === "approved"
                      ? "bg-blue-500/20 text-blue-300 border-blue-400/40"
                      : claim.status === "adjusted"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                      : claim.status === "rejected"
                      ? "bg-red-500/20 text-red-300 border-red-400/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                  }`}
                >
                  {claim.status === "submitted" ? "🟡 Submitted to Booker" : claim.status}
                </span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">{claim.supplier_name}</h2>
              <p className="text-xs text-slate-300">
                Submitted on: {new Date(claim.submitted_at).toLocaleDateString()} · Booker: {claim.booker_name || "N/A"}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50 custom-scrollbar">
            {/* Quick Actions (PDF / WhatsApp) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPdf}
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {isGeneratingPdf ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Download size={13} className="mr-1.5" />}
                  Download Gate Pass PDF
                </Button>

                <Button
                  onClick={handleSendWhatsApp}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  <MessageSquare size={13} className="mr-1.5" /> WhatsApp Booker
                </Button>
              </div>

              {/* Status Action Buttons */}
              <div className="flex items-center gap-2">
                {claim.status === "submitted" && (
                  <Button
                    onClick={() => setActionType("approve")}
                    size="sm"
                    variant="outline"
                    className="text-xs font-bold rounded-xl border-blue-300 text-blue-700 hover:bg-blue-50 cursor-pointer"
                  >
                    <CheckCircle size={13} className="mr-1" /> Mark Approved (CN #)
                  </Button>
                )}

                {claim.status === "approved" && (
                  <Button
                    onClick={() => handleUpdateStatus("adjusted")}
                    disabled={isUpdatingStatus}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <Check size={13} className="mr-1" /> Mark Settled in Purchase
                  </Button>
                )}

                {claim.status === "submitted" && (
                  <Button
                    onClick={() => setActionType("reject")}
                    size="sm"
                    variant="outline"
                    className="text-xs font-bold rounded-xl border-red-300 text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    Reject Claim
                  </Button>
                )}
              </div>
            </div>

            {/* In-Modal Status Update Form (Approve / Reject) */}
            {actionType === "approve" && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-blue-600" />
                    Enter Distributor Credit Note (CN) Details
                  </h4>
                  <button
                    onClick={() => setActionType("none")}
                    className="text-[10.5px] font-bold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600">Credit Note # (CN #) *</label>
                    <Input
                      placeholder="e.g. CN-9024"
                      value={creditNoteNo}
                      onChange={(e) => setCreditNoteNo(e.target.value)}
                      className="h-8 text-xs font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600">Approved Refund Value (Rs)</label>
                    <Input
                      type="number"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(Number(e.target.value) || 0)}
                      className="h-8 text-xs font-mono font-bold bg-white"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => handleUpdateStatus("approved")}
                  disabled={isUpdatingStatus || !creditNoteNo.trim()}
                  className="w-full h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer"
                >
                  {isUpdatingStatus ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
                  Confirm Approved Credit Note
                </Button>
              </div>
            )}

            {actionType === "reject" && (
              <div className="bg-red-50 p-4 rounded-2xl border border-red-200 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-red-900 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-red-600" />
                    Reject Claim & Restore Stock
                  </h4>
                  <button
                    onClick={() => setActionType("none")}
                    className="text-[10.5px] font-bold text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-red-700">
                  If the distributor refused replacement, do you want to restore the batch stock in your inventory?
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="restoreStockCheck"
                    checked={restoreStockOnReject}
                    onChange={(e) => setRestoreStockOnReject(e.target.checked)}
                    className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="restoreStockCheck" className="text-xs font-bold text-slate-700">
                    Yes, restore batch stock to active inventory
                  </label>
                </div>
                <Button
                  onClick={() => handleUpdateStatus("rejected")}
                  disabled={isUpdatingStatus}
                  className="w-full h-8 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer"
                >
                  {isUpdatingStatus ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
                  Confirm Reject Claim
                </Button>
              </div>
            )}

            {/* Items Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-100/70 border-b border-slate-200 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Claimed Items ({items.length})
                </h4>
                <span className="font-extrabold text-xs text-slate-700">
                  Total: Rs {Math.round(claim.total_claimed_amount).toLocaleString()}
                </span>
              </div>

              {loadingItems ? (
                <div className="text-center py-10 text-slate-400">
                  <Loader2 className="mx-auto h-6 w-6 text-indigo-600 animate-spin mb-1.5" />
                  <p className="text-xs font-bold text-slate-600">Loading claim items...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10.5px] font-black uppercase text-slate-600 border-b border-slate-200">
                      <th className="p-3">#</th>
                      <th className="p-3">Medicine Description</th>
                      <th className="p-3">Batch #</th>
                      <th className="p-3">Expiry</th>
                      <th className="p-3 text-center">Returned Qty</th>
                      <th className="p-3 text-right">TP Rate</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                    {items.map((it, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-slate-900">{it.product_name}</td>
                        <td className="p-3 font-mono font-bold text-indigo-700">{it.batch_number || "-"}</td>
                        <td className="p-3 font-mono text-slate-500">{it.expiry_date || "-"}</td>
                        <td className="p-3 text-center font-black text-rose-600">{it.quantity} {it.unit || "Pcs"}</td>
                        <td className="p-3 text-right font-mono">Rs {it.purchase_price}</td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">
                          Rs {Math.round(it.subtotal).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Booker Notes */}
            {claim.notes && (
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Special Notes</span>
                <p className="text-slate-700">{claim.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
            <Button
              onClick={onClose}
              variant="outline"
              className="text-xs font-bold rounded-xl px-6 cursor-pointer"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
