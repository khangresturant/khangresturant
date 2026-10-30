import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer, Zap, CheckCircle2, MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReceiptTemplate } from "@/components/ReceiptTemplate";
import { printReceiptDirect } from "@/lib/thermalPrinter";
import { printDirectEscPos, isDirectSerialPrintingSupported } from "@/lib/escposPrinter";
import { toast } from "sonner";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastInvoice: any;
  shopDetails: any;
  receiptSettings: any;
  language: string;
  whatsappInputPhone: string;
  setWhatsappInputPhone: (phone: string) => void;
  handleSendPOSWhatsApp: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  lastInvoice,
  shopDetails,
  receiptSettings,
  language,
  whatsappInputPhone,
  setWhatsappInputPhone,
  handleSendPOSWhatsApp,
}) => {
  const [isUsbPrinting, setIsUsbPrinting] = useState(false);

  const handleBrowserPrint = () => {
    const receiptElement = document.getElementById("pos-invoice-print-container");
    if (!receiptElement) return;

    printReceiptDirect({
      receiptHtml: receiptElement.innerHTML,
      settings: receiptSettings,
      title: `Invoice #${lastInvoice?.id?.slice(0, 8).toUpperCase() || "Receipt"}`,
      onSuccess: () => {
        toast.success("Opening print dialog...");
      },
      onError: (err) => {
        toast.error("Printing failed: " + (err?.message || "Check printer connection"));
      }
    });
  };

  const handleDirectUsbPrint = async () => {
    setIsUsbPrinting(true);
    try {
      const itemsList = (lastInvoice?.items || []).map((item: any) => ({
        name: item.name || item.products?.name || "Item",
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
        subtotal: item.subtotal !== undefined ? Number(item.subtotal) : Number((item.price || 0) * (item.quantity || 1)),
        batchNumber: item.batch_number || item.batchNumber,
        expiryDate: item.expiry_date || item.expiryDate
      }));

      await printDirectEscPos({
        shopName: shopDetails?.name || "THE ACCOUNTS STORE",
        shopAddress: shopDetails?.address,
        shopPhone: shopDetails?.phone,
        invoiceId: `#${lastInvoice?.id?.slice(0, 8).toUpperCase() || "RECEIPT"}`,
        dateStr: new Date(lastInvoice?.created_at || Date.now()).toLocaleString(),
        customerName: lastInvoice?.customer_name,
        items: itemsList,
        totalAmount: Number(lastInvoice?.total_amount || 0),
        discount: Number(lastInvoice?.discount || 0),
        taxAmount: Number(lastInvoice?.tax_amount || 0),
        paymentMode: lastInvoice?.payment_mode,
        receivedAmount: Number(lastInvoice?.received_amount || 0),
        thankYouMessage: receiptSettings?.thankYouMessage,
        footerText: receiptSettings?.footerText,
        currency: receiptSettings?.selectedCurrency || "Rs"
      }, receiptSettings?.pageSize === "MM58" ? "58mm" : "80mm");

      toast.success("Receipt printed instantly to USB printer!");
    } catch (err: any) {
      if (err?.message?.includes("No port selected") || err?.name === "NotFoundError") {
        return;
      }
      toast.error("Direct USB Error: " + (err?.message || "Check USB connection"));
    } finally {
      setIsUsbPrinting(false);
    }
  };

  const hasSerial = isDirectSerialPrintingSupported();
  const invoiceCode = lastInvoice?.id ? `#${lastInvoice.id.slice(0, 8).toUpperCase()}` : "INVOICE";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 0.94, y: 12 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md border border-slate-200/90 relative flex flex-col max-h-[calc(100dvh-1.5rem)] overflow-hidden my-auto"
          >
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-slate-900 text-xs sm:text-sm leading-tight truncate">Sale Completed</h3>
                    <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                      {invoiceCode}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Ready to print or share receipt</p>
                </div>
              </div>

              <button 
                type="button"
                onClick={onClose} 
                className="h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-750 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
                aria-label="Close receipt modal"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Receipt Preview Area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 custom-scrollbar space-y-3 bg-slate-100/50">
              <div className="bg-slate-200/70 p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 flex items-start justify-center shadow-inner overflow-x-hidden">
                <div id="pos-invoice-print-container" className="bg-white shadow-md rounded-xl max-w-full overflow-hidden">
                  <ReceiptTemplate 
                    settings={{
                      ...receiptSettings,
                      billingLanguage: receiptSettings.billingLanguage || language
                    }} 
                    invoice={lastInvoice} 
                    shopDetails={shopDetails} 
                  />
                </div>
              </div>

              {/* WhatsApp Quick Share Section */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10.5px] font-black text-slate-700 flex items-center gap-1">
                    <MessageSquare size={13} className="text-emerald-600" />
                    WhatsApp Invoice
                  </label>
                  <span className="text-[9.5px] text-slate-400">Optional</span>
                </div>
                <div className="flex gap-1.5">
                  <Input 
                    placeholder="e.g. 03001234567" 
                    value={whatsappInputPhone}
                    onChange={(e) => setWhatsappInputPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendPOSWhatsApp();
                      }
                    }}
                    className="rounded-xl h-8.5 text-xs border-slate-200 bg-slate-50/50 font-medium flex-1 focus:bg-white"
                  />
                  <Button
                    type="button"
                    onClick={handleSendPOSWhatsApp}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-8.5 px-3 rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    Send <ArrowRight size={12} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions (Sticky at bottom of modal) */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-col gap-2 shrink-0">
              {hasSerial && (
                <Button 
                  onClick={handleDirectUsbPrint}
                  disabled={isUsbPrinting}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black h-9.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer active:scale-98 transition-transform"
                >
                  <Zap size={14} className="text-amber-300 animate-pulse" /> Direct USB Print (No Dialog)
                </Button>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleBrowserPrint} 
                  variant="outline"
                  className="flex-1 border-slate-300 text-slate-800 hover:bg-slate-50 font-black h-9.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-transform"
                >
                  <Printer size={13} className="text-slate-600" /> Print Receipt
                </Button>
                <Button 
                  onClick={onClose}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black h-9.5 rounded-xl text-xs cursor-pointer shadow-xs active:scale-98 transition-transform"
                >
                  Done / Next Sale
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
