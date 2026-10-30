"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, ShieldCheck, FileText, CheckCircle2, User, Phone, MapPin, Calendar, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InstallmentAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  shopDetails?: {
    name?: string;
    phone?: string;
    address?: string;
    tagline?: string;
  };
}

export const InstallmentAgreementModal: React.FC<InstallmentAgreementModalProps> = ({
  isOpen,
  onClose,
  invoice,
  shopDetails
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const customer = invoice.parties || {};
  const schedules = [...(invoice.emi_schedules || [])].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  const totalAmount = Number(invoice.total_amount || 0);
  const downPayment = Number(invoice.paid_amount || 0);
  const financedBalance = Math.max(0, totalAmount - downPayment);
  const monthlyInstallment = schedules.length > 0 ? Number(schedules[0].installment_amount || 0) : 0;

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=850,height=1000");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Installment Sales Agreement - #${invoice.id.slice(0, 8).toUpperCase()}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.4;
            }
            .header-box {
              text-align: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .shop-title {
              font-size: 20px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0;
            }
            .shop-meta {
              font-size: 10px;
              color: #475569;
              margin-top: 2px;
            }
            .contract-title {
              display: inline-block;
              background-color: #0f172a;
              color: #ffffff;
              padding: 4px 14px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
              border-radius: 4px;
              margin-top: 8px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 10px;
            }
            .info-card {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 8px 10px;
              background-color: #f8fafc;
            }
            .card-title {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              color: #1e293b;
              border-bottom: 1px dashed #cbd5e1;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .data-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .data-label {
              color: #64748b;
              font-size: 10px;
            }
            .data-val {
              font-weight: 600;
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 5px 6px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 700;
              color: #334155;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .terms-box {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 8px 10px;
              background-color: #ffffff;
              margin-top: 10px;
              font-size: 9.5px;
              color: #334155;
            }
            .terms-box ol {
              margin: 4px 0 0 16px;
              padding: 0;
            }
            .terms-box li {
              margin-bottom: 3px;
            }
            .signatures-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
              margin-top: 24px;
              padding-top: 8px;
            }
            .sig-box {
              border-top: 1.5px solid #0f172a;
              text-align: center;
              padding-top: 6px;
              font-size: 10px;
              font-weight: 600;
            }
            .thumb-box {
              display: inline-block;
              width: 50px;
              height: 40px;
              border: 1px dashed #94a3b8;
              border-radius: 4px;
              margin-top: 4px;
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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
        >
          {/* Top Action Bar */}
          <div className="bg-slate-900 p-4 text-white flex justify-between items-center px-6">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-emerald-400" />
              <div>
                <h3 className="font-bold text-base">Installment Sales Contract & Legal Agreement</h3>
                <p className="text-xs text-slate-400">Printable Hire Purchase Agreement for Customer & Guarantor</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-md"
              >
                <Printer size={15} />
                <span>Print Contract (A4)</span>
              </Button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Printable Document Preview Area */}
          <div className="p-6 overflow-y-auto bg-slate-100 flex justify-center">
            <div
              ref={printRef}
              className="bg-white border border-slate-300 shadow-sm p-8 w-full max-w-[800px] rounded-lg text-slate-800"
            >
              {/* Shop Header */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                <h1 className="text-2xl font-black uppercase tracking-wide text-slate-950">
                  {shopDetails?.name || "ELECTRONICS & APPLIANCES HUB"}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  {shopDetails?.address || "Main Commercial Market"} {shopDetails?.phone ? `| Ph: ${shopDetails.phone}` : ""}
                </p>
                <div className="inline-block bg-slate-900 text-white px-4 py-1 text-xs font-bold uppercase tracking-widest rounded mt-2">
                  Installment Sales Agreement & Undertaking
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-1">
                  Agreement No: #{invoice.id.slice(0, 8).toUpperCase()} | Date: {new Date(invoice.created_at || Date.now()).toLocaleDateString("en-PK", { dateStyle: "long" })}
                </div>
              </div>

              {/* Parties Grid (Buyer & Guarantor) */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                {/* Buyer Details */}
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div className="font-bold text-slate-900 uppercase border-b border-slate-200 pb-1.5 mb-2 flex items-center gap-1.5">
                    <User size={13} className="text-blue-600" />
                    <span>Buyer / Customer Details (خریدار)</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Name:</span> <span className="font-bold">{customer.name || "Walk-in Customer"}</span></div>
                    {customer.father_name && <div className="flex justify-between"><span className="text-slate-500">S/O (Father):</span> <span className="font-semibold">{customer.father_name}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">CNIC No:</span> <span className="font-mono font-semibold">{customer.cnic_number || "Not Recorded"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Phone:</span> <span className="font-semibold">{customer.phone || "Not Recorded"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Address:</span> <span className="text-[11px] truncate max-w-[200px]">{customer.address || "Local"}</span></div>
                  </div>
                </div>

                {/* Guarantor Details */}
                <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50/40">
                  <div className="font-bold text-indigo-900 uppercase border-b border-indigo-200 pb-1.5 mb-2 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-indigo-600" />
                    <span>Guarantor Details (ضامن)</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-slate-500">Guarantor Name:</span> <span className="font-bold text-slate-900">{invoice.guarantor_name || "N/A"}</span></div>
                    {invoice.guarantor_relation && <div className="flex justify-between"><span className="text-slate-500">Relation:</span> <span className="font-semibold">{invoice.guarantor_relation}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-500">CNIC No:</span> <span className="font-mono font-semibold">{invoice.guarantor_cnic || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Phone:</span> <span className="font-semibold">{invoice.guarantor_phone || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Address:</span> <span className="text-[11px] truncate max-w-[200px]">{invoice.guarantor_address || "N/A"}</span></div>
                  </div>
                </div>
              </div>

              {/* Items Purchased Table */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-slate-800 mb-1.5">Purchased Electronics & Appliances</div>
                <table className="w-full text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-2 border border-slate-200 text-left">Item Description</th>
                      <th className="p-2 border border-slate-200 text-center">Serial / IMEI</th>
                      <th className="p-2 border border-slate-200 text-center">Warranty</th>
                      <th className="p-2 border border-slate-200 text-center">Qty</th>
                      <th className="p-2 border border-slate-200 text-right">Cash / Financed Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.invoice_items || []).map((item: any) => (
                      <tr key={item.id}>
                        <td className="p-2 border border-slate-200 font-semibold">{item.products?.name || item.custom_name || "Product Item"}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-[11px]">{item.sold_imeis || "—"}</td>
                        <td className="p-2 border border-slate-200 text-center">{item.warranty || "Standard"}</td>
                        <td className="p-2 border border-slate-200 text-center">{item.quantity}</td>
                        <td className="p-2 border border-slate-200 text-right font-bold">Rs {Number(item.subtotal).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary Breakdown */}
              <div className="grid grid-cols-4 gap-2 mb-4 bg-slate-50 border border-slate-200 p-3 rounded-lg text-center text-xs">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Total Bill Value</div>
                  <div className="font-extrabold text-slate-900 text-sm mt-0.5">Rs {totalAmount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Down Payment Received</div>
                  <div className="font-extrabold text-emerald-700 text-sm mt-0.5">Rs {downPayment.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Financed Balance Due</div>
                  <div className="font-extrabold text-red-700 text-sm mt-0.5">Rs {financedBalance.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Monthly Installment</div>
                  <div className="font-extrabold text-indigo-700 text-sm mt-0.5">Rs {monthlyInstallment.toLocaleString()}</div>
                </div>
              </div>

              {/* Installment Plan Schedule Table */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase text-slate-800 mb-1.5">Approved Installment Payment Schedule</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {schedules.map((s: any, idx: number) => (
                    <div key={s.id || idx} className="flex justify-between items-center p-2 border border-slate-200 rounded bg-white">
                      <span className="font-bold text-slate-700">Installment #{idx + 1}</span>
                      <span className="text-slate-600 font-mono">Due: {new Date(s.due_date).toLocaleDateString()}</span>
                      <span className="font-bold text-slate-900">Rs {Number(s.installment_amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legal Terms & Undertaking */}
              <div className="border border-slate-200 rounded-lg p-3 bg-white text-[10px] text-slate-600 space-y-1 mb-6">
                <div className="font-bold text-slate-900 uppercase">Terms of Undertaking & Legal Agreement:</div>
                <ol className="list-decimal pl-4 space-y-0.5 leading-relaxed">
                  <li><strong>Ownership Clause:</strong> The purchased appliance/device shall remain the lawful property of the seller until 100% of the financed balance and surcharges are fully cleared.</li>
                  <li><strong>Timely Payment:</strong> The buyer agrees to pay every monthly installment on or before the due date specified in the schedule above.</li>
                  <li><strong>Late Surcharge:</strong> A late penalty fee of Rs 500 per week may be levied on overdue payments exceeding 7 days past due date.</li>
                  <li><strong>Guarantor Liability:</strong> In case of buyer default, the guarantor holds full financial and legal responsibility to settle the entire outstanding balance immediately.</li>
                  <li><strong>Legal Jurisdiction:</strong> Any dispute shall be subject to local legal jurisdiction and recovery laws.</li>
                </ol>
              </div>

              {/* Signatures & Stamp Grid */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-900 text-center text-xs">
                <div>
                  <div className="font-bold text-slate-900">Buyer's Signature</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Name: {customer.name || "Customer"}</div>
                  <div className="mt-2 w-16 h-12 border border-dashed border-slate-400 mx-auto rounded flex items-center justify-center text-[9px] text-slate-400">
                    Thumb Imp.
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-900">Guarantor's Signature</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Name: {invoice.guarantor_name || "Guarantor"}</div>
                  <div className="mt-2 w-16 h-12 border border-dashed border-slate-400 mx-auto rounded flex items-center justify-center text-[9px] text-slate-400">
                    Thumb Imp.
                  </div>
                </div>

                <div>
                  <div className="font-bold text-slate-900">Authorized Shop Sign & Stamp</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">For {shopDetails?.name || "The Shop"}</div>
                  <div className="mt-2 w-20 h-12 border border-dashed border-slate-400 mx-auto rounded flex items-center justify-center text-[9px] text-slate-400">
                    Shop Stamp
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
