"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, Smartphone, Wrench, ShieldAlert, CheckCircle2, User, Phone, Lock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RepairJobTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: any;
  shopDetails?: {
    name?: string;
    phone?: string;
    address?: string;
  };
}

export const RepairJobTokenModal: React.FC<RepairJobTokenModalProps> = ({
  isOpen,
  onClose,
  ticket,
  shopDetails
}) => {
  const [printFormat, setPrintFormat] = useState<"thermal" | "a5">("thermal");
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !ticket) return null;

  const custName = ticket.customer_name || ticket.parties?.name || "Walk-in Customer";
  const custPhone = ticket.customer_phone || ticket.parties?.phone || "N/A";
  const totalAmount = Number(ticket.estimated_cost || 0);
  const advancePaid = Number(ticket.advance_amount || 0);
  const balanceDue = Math.max(0, totalAmount - advancePaid);

  let patternPoints: number[] = [];
  if (ticket.pattern_lock) {
    try {
      patternPoints = typeof ticket.pattern_lock === "string" ? JSON.parse(ticket.pattern_lock) : ticket.pattern_lock;
    } catch {
      patternPoints = String(ticket.pattern_lock).split("-").map(Number).filter(n => !isNaN(n));
    }
  }

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const isThermal = printFormat === "thermal";
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Repair Job Ticket - #${ticket.id.slice(0, 8).toUpperCase()}</title>
          <style>
            @page {
              size: ${isThermal ? "80mm auto" : "A5 portrait"};
              margin: ${isThermal ? "2mm 4mm" : "10mm 12mm"};
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: ${isThermal ? "11px" : "11px"};
              line-height: 1.35;
              width: ${isThermal ? "72mm" : "100%"};
            }
            .header-center {
              text-align: center;
              border-bottom: 1.5px dashed #0f172a;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .shop-name {
              font-size: ${isThermal ? "14px" : "18px"};
              font-weight: 800;
              text-transform: uppercase;
              margin: 0;
            }
            .shop-meta {
              font-size: 9.5px;
              color: #475569;
              margin-top: 2px;
            }
            .badge-title {
              display: inline-block;
              background-color: #0f172a;
              color: #ffffff;
              padding: 2px 8px;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              border-radius: 3px;
              margin-top: 4px;
            }
            .data-group {
              border-bottom: 1px dashed #cbd5e1;
              padding-bottom: 6px;
              margin-bottom: 6px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .label {
              color: #64748b;
              font-size: ${isThermal ? "10px" : "10.5px"};
            }
            .val {
              font-weight: 700;
              color: #0f172a;
              text-align: right;
            }
            .pattern-box {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 6px;
              margin: 6px 0;
            }
            .disclaimer {
              font-size: 8.5px;
              color: #475569;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 5px;
              margin-top: 8px;
              background-color: #f8fafc;
            }
            .disclaimer ol {
              margin: 2px 0 0 12px;
              padding: 0;
            }
            .sig-area {
              display: flex;
              justify-content: space-between;
              margin-top: 18px;
              padding-top: 4px;
              border-top: 1px solid #0f172a;
              font-size: 9px;
              font-weight: 600;
            }
            .barcode-line {
              text-align: center;
              font-family: monospace;
              letter-spacing: 4px;
              font-size: 14px;
              font-weight: bold;
              margin: 6px 0 2px 0;
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        >
          {/* Top Bar */}
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center px-6">
            <div className="flex items-center gap-2">
              <Wrench size={18} className="text-amber-400" />
              <div>
                <h3 className="font-bold text-sm">Print Repair Job Token & Claim Slip</h3>
                <p className="text-[11px] text-slate-400">Token #{ticket.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Format Toggle */}
              <div className="bg-slate-800 p-0.5 rounded-lg flex text-xs">
                <button
                  onClick={() => setPrintFormat("thermal")}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    printFormat === "thermal" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  80mm Thermal
                </button>
                <button
                  onClick={() => setPrintFormat("a5")}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    printFormat === "a5" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-400 hover:text-white"
                  }`}
                >
                  A5 Ticket
                </button>
              </div>

              <Button
                onClick={handlePrint}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1 shadow-sm"
              >
                <Printer size={14} />
                <span>Print</span>
              </Button>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Printable Preview */}
          <div className="p-6 overflow-y-auto bg-slate-100 flex justify-center">
            <div
              ref={printRef}
              className={`bg-white border border-slate-300 shadow-sm p-6 rounded-lg text-slate-800 ${
                printFormat === "thermal" ? "w-[300px]" : "w-[420px]"
              }`}
            >
              {/* Header */}
              <div className="text-center border-b-2 border-dashed border-slate-900 pb-2 mb-3">
                <h2 className="text-base font-black uppercase text-slate-950 tracking-wide">
                  {shopDetails?.name || "MOBILE REPAIRING LAB & CARE"}
                </h2>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {shopDetails?.address || "Main Mobile Market"} {shopDetails?.phone ? `| Ph: ${shopDetails.phone}` : ""}
                </p>
                <div className="inline-block bg-slate-900 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded mt-1.5">
                  Customer Claim Token
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Token: #{ticket.id.slice(0, 8).toUpperCase()} | {new Date(ticket.created_at || Date.now()).toLocaleDateString("en-PK")}
                </div>
              </div>

              {/* Customer & Handset Info */}
              <div className="border-b border-dashed border-slate-300 pb-2 mb-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">{custName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-semibold text-slate-800">{custPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Device Model:</span>
                  <span className="font-bold text-blue-700">{ticket.device_model || "Mobile Device"}</span>
                </div>
                {ticket.imei_number && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">IMEI / Serial:</span>
                    <span className="font-mono text-[10px] text-slate-700">{ticket.imei_number}</span>
                  </div>
                )}
                {ticket.technician_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Technician:</span>
                    <span className="font-semibold text-slate-700">{ticket.technician_name}</span>
                  </div>
                )}
              </div>

              {/* Reported Fault */}
              <div className="border-b border-dashed border-slate-300 pb-2 mb-2 text-xs">
                <div className="text-slate-500 text-[10px] font-bold uppercase">Reported Issue / Fault:</div>
                <div className="font-bold text-slate-900 mt-0.5 bg-slate-50 p-1.5 rounded border border-slate-200 text-[11px]">
                  {ticket.issue_description || "General diagnosis & service"}
                </div>
              </div>

              {/* Pattern Lock / Passcode */}
              {(patternPoints.length > 0 || ticket.passcode) && (
                <div className="border-b border-dashed border-slate-300 pb-2 mb-2 text-xs">
                  <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">Device Security Lock:</div>
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                    {patternPoints.length > 0 && (
                      <div className="flex items-center gap-2">
                        {/* Mini 3x3 Grid */}
                        <div className="grid grid-cols-3 gap-1 w-12 h-12 p-1 bg-white border border-slate-300 rounded">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
                            const stepIdx = patternPoints.indexOf(idx);
                            const isSelected = stepIdx !== -1;
                            return (
                              <div
                                key={idx}
                                className={`w-2.5 h-2.5 rounded-full flex items-center justify-center text-[7px] font-bold ${
                                  isSelected ? "bg-amber-500 text-white font-extrabold" : "bg-slate-200 text-transparent"
                                }`}
                              >
                                {isSelected ? stepIdx + 1 : ""}
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-slate-600 font-mono">
                          Sequence: <br />
                          <strong>{patternPoints.map(p => p + 1).join(" → ")}</strong>
                        </div>
                      </div>
                    )}
                    {ticket.passcode && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">PIN Code:</span>
                        <span className="font-mono font-black text-xs text-slate-900">{ticket.passcode}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Charges */}
              <div className="border-b-2 border-dashed border-slate-900 pb-2 mb-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Total Bill:</span>
                  <span className="font-bold text-slate-900">Rs {totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Advance Paid:</span>
                  <span className="font-bold text-emerald-700">Rs {advancePaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold border-t border-slate-200 pt-1 mt-1">
                  <span className="text-slate-900">Balance Due on Delivery:</span>
                  <span className="text-red-600">Rs {balanceDue.toLocaleString()}</span>
                </div>
              </div>

              {/* Terms & Disclaimers */}
              <div className="text-[8.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2 space-y-0.5">
                <div className="font-bold text-slate-700 uppercase">Customer Policy & Disclaimer:</div>
                <ol className="list-decimal pl-3 space-y-0.5 leading-tight">
                  <li>Shop is not responsible for any prior internal data loss or water damage.</li>
                  <li>Please present this original token when collecting your device.</li>
                  <li>Unclaimed devices after 30 days are subject to disposal.</li>
                </ol>
              </div>

              {/* Barcode & Signature */}
              <div className="mt-3 text-center">
                <div className="barcode-line">*{ticket.id.slice(0, 8).toUpperCase()}*</div>
                <div className="text-[8px] text-slate-400">Scan token barcode upon collection</div>
                <div className="flex justify-between text-[9px] font-semibold pt-4 border-t border-slate-300 mt-3">
                  <span>Customer Signature</span>
                  <span>Authorized Signature</span>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
