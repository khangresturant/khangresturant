"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, Search, PlusCircle, Calendar, Loader2, Save, X, Phone, User, 
  Landmark, DollarSign, Check, Download, FileText, Printer, ShieldAlert, 
  TrendingUp, Clock, AlertCircle, FileSpreadsheet, Eye, Info, MessageCircle, ShieldCheck
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InstallmentAgreementModal } from "./components/InstallmentAgreementModal";

type EMISchedule = {
  id: string;
  invoice_id: string;
  due_date: string;
  installment_amount: number;
  late_fee: number;
  amount_paid: number;
  status: "unpaid" | "paid";
  created_at: string;
};

type Party = {
  id: string;
  name: string;
  phone: string | null;
  current_balance: number;
  cnic_number?: string | null;
  father_name?: string | null;
};

type InvoiceItem = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  warranty?: string | null;
  products: {
    name: string;
  } | null;
};

type EMIInvoice = {
  id: string;
  created_at: string;
  total_amount: number;
  paid_amount: number; // Down payment
  payment_mode: string;
  guarantor_name?: string | null;
  guarantor_cnic?: string | null;
  guarantor_phone?: string | null;
  guarantor_relation?: string | null;
  guarantor_address?: string | null;
  parties: Party | null;
  emi_schedules: EMISchedule[];
  invoice_items: InvoiceItem[];
};

type CashAccount = {
  id: string;
  name: string;
  current_balance: number;
};

type CompanyDetails = {
  name: string;
  phone: string | null;
  address: string | null;
};

export default function EMISchedulesPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<EMIInvoice[]>([]);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "active" | "due_today" | "overdue" | "paid">("all");

  // Agreement Modal states
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [activeAgreementInvoice, setActiveAgreementInvoice] = useState<EMIInvoice | null>(null);

  // Collection modal states
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<EMIInvoice | null>(null);
  const [amountToCollect, setAmountToCollect] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("0");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Detail Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeInvoiceDetails, setActiveInvoiceDetails] = useState<EMIInvoice | null>(null);

  // Print Modal states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [activeSlipData, setActiveSlipData] = useState<{
    invoice: EMIInvoice;
    amountCollected: number;
    surcharge: number;
    accountName: string;
    date: string;
  } | null>(null);
  const [invoiceTransactions, setInvoiceTransactions] = useState<{[invoiceId: string]: any[]}>({});

  useEffect(() => {
    if (shopId) {
      fetchEMIInvoices();
      fetchAccounts();
      fetchCompanyDetails();
    }
  }, [shopId]);

  const fetchEMIInvoices = async () => {
    setLoading(true);
    try {
      // Query invoices with payment_mode = 'emi'
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          created_at,
          total_amount,
          paid_amount,
          payment_mode,
          guarantor_name,
          guarantor_cnic,
          guarantor_phone,
          guarantor_relation,
          guarantor_address,
          parties (
            id,
            name,
            phone,
            current_balance,
            cnic_number,
            father_name
          ),
          emi_schedules (
            id,
            due_date,
            installment_amount,
            late_fee,
            status,
            amount_paid,
            created_at
          ),
          invoice_items (
            id,
            quantity,
            unit_price,
            subtotal,
            warranty,
            products (
              name
            )
          )
        `)
        .eq("shop_id", shopId)
        .eq("payment_mode", "emi")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices((data as any) || []);

      // Fetch all payment transactions for EMI invoices
      const { data: txData, error: txError } = await supabase
        .from("account_transactions")
        .select("id, amount, remarks, created_at, ref_id, account_id")
        .eq("shop_id", shopId)
        .eq("ref_type", "invoice")
        .order("created_at", { ascending: true });

      if (!txError && txData) {
        const groups: {[invoiceId: string]: any[]} = {};
        txData.forEach((tx: any) => {
          if (!tx.ref_id) return;
          if (!groups[tx.ref_id]) {
            groups[tx.ref_id] = [];
          }
          groups[tx.ref_id].push(tx);
        });
        setInvoiceTransactions(groups);
      }
    } catch (err: any) {
      toast.error("Failed to load installments: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("cash_accounts")
        .select("id, name, current_balance")
        .eq("shop_id", shopId)
        .order("name");
      if (error) throw error;
      setAccounts(data || []);
      if (data && data.length > 0) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load accounts:", err);
    }
  };

  const fetchCompanyDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("company_details")
        .select("name, phone, address")
        .eq("shop_id", shopId)
        .maybeSingle();
      if (error) throw error;
      
      if (data && (data.address || data.phone)) {
        setCompanyDetails(data);
      } else {
        // Fallback: fetch from shops table
        const { data: shopData, error: shopErr } = await supabase
          .from("shops")
          .select("name, phone, address")
          .eq("id", shopId)
          .maybeSingle();
          
        if (!shopErr && shopData) {
          setCompanyDetails({
            name: shopData.name || "THE ACCOUNTS STORE",
            phone: shopData.phone || "",
            address: shopData.address || ""
          });
        } else {
          setCompanyDetails({
            name: "THE ACCOUNTS STORE",
            phone: "",
            address: ""
          });
        }
      }
    } catch (err: any) {
      console.error("Failed to load company details:", err);
      setCompanyDetails({
        name: "THE ACCOUNTS STORE",
        phone: "",
        address: ""
      });
    }
  };

  // Helper to get customer data safely
  const getCustomerDetails = (inv: EMIInvoice) => {
    if (!inv || !inv.parties) return { id: "", name: "Walk-in Customer", phone: null, balance: 0, cnic_number: null, father_name: null };
    const party = Array.isArray(inv.parties) ? inv.parties[0] : inv.parties;
    if (!party) return { id: "", name: "Walk-in Customer", phone: null, balance: 0, cnic_number: null, father_name: null };
    return { 
      id: party.id,
      name: party.name || "Walk-in Customer", 
      phone: party.phone || null,
      balance: Number(party.current_balance || 0),
      cnic_number: (party as any).cnic_number || null,
      father_name: (party as any).father_name || null
    };
  };

  // 1-Click WhatsApp Reminder for Installment
  const sendWhatsAppReminder = (inv: EMIInvoice, specificSchedule?: EMISchedule) => {
    const cust = getCustomerDetails(inv);
    if (!cust.phone) {
      toast.error("Customer phone number is not available.");
      return;
    }
    const cleanPhone = cust.phone.replace(/[^0-9]/g, "").replace(/^0/, "92");
    const schedules = inv.emi_schedules || [];
    const unpaid = [...schedules].filter(s => s.status !== "paid").sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const targetSchedule = specificSchedule || unpaid[0];
    
    const totalBill = Number(inv.total_amount);
    const downPayment = Number(inv.paid_amount);
    const totalPaidSchedules = schedules.reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);
    const totalRemaining = totalBill - downPayment - totalPaidSchedules;

    let msg = `*محترم ${cust.name}!* \n\n*${companyDetails?.name || "دی اکاؤنٹس الیکٹرانکس"}* کی جانب سے قسط کی یاد دہانی:\n\n`;
    if (targetSchedule) {
      const remainingForThis = Number(targetSchedule.installment_amount) + Number(targetSchedule.late_fee || 0) - Number(targetSchedule.amount_paid || 0);
      msg += `📅 *قسط کی آخری تاریخ:* ${new Date(targetSchedule.due_date).toLocaleDateString()}\n💰 *موجودہ قسط کی رقم:* Rs ${remainingForThis.toLocaleString()}\n`;
    }
    msg += `🏷️ *کل بقایا قسطیں:* Rs ${totalRemaining.toLocaleString()}\n📌 *انوائس ID:* #${inv.id.substring(0, 8).toUpperCase()}\n\nبرائے مہربانی قسط کی بروقت ادائیگی فرما دیں۔ آن لائن ٹرانسفر (JazzCash / EasyPaisa / Bank) کے لیے ہم سے رابطہ کریں۔ شکریہ!\n\n*${companyDetails?.name || "دی اکاؤنٹس الیکٹرانکس"}*`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Update Guarantor Info
  const handleSaveGuarantor = async (invoiceId: string, guarantor: { name: string; cnic: string; phone: string; relation: string; address: string }) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          guarantor_name: guarantor.name,
          guarantor_cnic: guarantor.cnic,
          guarantor_phone: guarantor.phone,
          guarantor_relation: guarantor.relation,
          guarantor_address: guarantor.address
        })
        .eq("id", invoiceId);

      if (error) throw error;
      toast.success("Guarantor (ضامن) details updated!");
      fetchEMIInvoices();
      if (activeInvoiceDetails && activeInvoiceDetails.id === invoiceId) {
        setActiveInvoiceDetails(prev => prev ? {
          ...prev,
          guarantor_name: guarantor.name,
          guarantor_cnic: guarantor.cnic,
          guarantor_phone: guarantor.phone,
          guarantor_relation: guarantor.relation,
          guarantor_address: guarantor.address
        } : null);
      }
    } catch (e: any) {
      toast.error("Failed to update guarantor: " + e.message);
    }
  };

  // Open payment collection modal with pre-filled details
  const handleOpenCollect = (invoice: EMIInvoice) => {
    setSelectedInvoice(invoice);
    
    // Sort schedules to find the first unpaid or partially paid installment
    const unpaidSchedules = [...(invoice.emi_schedules || [])]
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .filter(s => s.status !== "paid");

    if (unpaidSchedules.length > 0) {
      const nextSched = unpaidSchedules[0];
      const dueVal = Number(nextSched.installment_amount) + Number(nextSched.late_fee || 0) - Number(nextSched.amount_paid || 0);
      setAmountToCollect(Math.max(0, dueVal).toString());
    } else {
      setAmountToCollect("0");
    }
    
    setPenaltyAmount("0");
    setIsCollectModalOpen(true);
  };

  // Process payment collection
  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const amt = parseFloat(amountToCollect);
    const surcharge = parseFloat(penaltyAmount) || 0;

    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount to collect.");
      return;
    }
    if (isNaN(surcharge) || surcharge < 0) {
      toast.error("Fine/Surcharge must be a non-negative number.");
      return;
    }
    if (!selectedAccountId) {
      toast.error("Please select a deposit account.");
      return;
    }

    setSubmittingPayment(true);
    try {
      const customer = getCustomerDetails(selectedInvoice);

      // 1. Fetch latest schedules for this invoice from DB to avoid race conditions
      const { data: dbSchedules, error: schedError } = await supabase
        .from("emi_schedules")
        .select("*")
        .eq("invoice_id", selectedInvoice.id)
        .order("due_date", { ascending: true });

      if (schedError) throw schedError;
      if (!dbSchedules || dbSchedules.length === 0) {
        throw new Error("No installments found for this invoice.");
      }

      // Filter unpaid schedules
      const unpaid = dbSchedules.filter((s: any) => s.status !== "paid");
      if (unpaid.length === 0 && surcharge === 0) {
        throw new Error("This EMI plan is already fully paid!");
      }

      const safeRound = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
      let paymentLeft = safeRound(amt);
      const schedulesToUpdate: any[] = [];

      // If surcharge is added, apply it to the oldest unpaid installment
      if (surcharge > 0 && unpaid.length > 0) {
        unpaid[0].late_fee = safeRound(Number(unpaid[0].late_fee || 0) + surcharge);
      }

      // Distribute payment chronologically
      for (const s of unpaid) {
        if (paymentLeft <= 0) break;

        const originalAmount = safeRound(Number(s.installment_amount));
        const currentLateFee = safeRound(Number(s.late_fee || 0));
        const totalDue = safeRound(originalAmount + currentLateFee);
        const currentPaid = safeRound(Number(s.amount_paid || 0));
        const remainingDue = safeRound(totalDue - currentPaid);

        if (remainingDue <= 0) continue;

        if (paymentLeft >= remainingDue) {
          s.amount_paid = totalDue;
          s.status = "paid";
          paymentLeft = safeRound(paymentLeft - remainingDue);
          schedulesToUpdate.push(s);
        } else {
          s.amount_paid = safeRound(currentPaid + paymentLeft);
          s.status = "unpaid"; // remains unpaid as it's partial
          paymentLeft = 0;
          schedulesToUpdate.push(s);
        }
      }

      // If there is still payment left over (overpayment), allocate it to the last updated schedule item
      if (paymentLeft > 0 && schedulesToUpdate.length > 0) {
        const lastIdx = schedulesToUpdate.length - 1;
        schedulesToUpdate[lastIdx].amount_paid = safeRound(schedulesToUpdate[lastIdx].amount_paid + paymentLeft);
        paymentLeft = 0;
      }

      // If paymentLeft > 0, it means they overpaid all installments.
      // The leftover will still be deducted from customer Khata balance.

      // 2. Perform database updates
      // A. Update modified schedules
      for (const s of schedulesToUpdate) {
        const { error } = await supabase
          .from("emi_schedules")
          .update({
            amount_paid: s.amount_paid,
            late_fee: s.late_fee,
            status: s.status
          })
          .eq("id", s.id);
        if (error) throw error;
      }

      // B. Check if all schedules are paid to update invoice status
      const updatedAllSchedules = dbSchedules.map((s: any) => {
        const found = schedulesToUpdate.find((u: any) => u.id === s.id);
        return found ? found : s;
      });
      const allSettled = updatedAllSchedules.every((s: any) => s.status === "paid");
      
      const { error: invStatusError } = await supabase
        .from("invoices")
        .update({ status: allSettled ? "paid" : "partial" })
        .eq("id", selectedInvoice.id);
      if (invStatusError) throw invStatusError;

      // C. Update cash account balance
      const currentAcc = accounts.find(a => a.id === selectedAccountId);
      if (currentAcc) {
        const { error } = await supabase
          .from("cash_accounts")
          .update({ current_balance: Number(currentAcc.current_balance) + amt })
          .eq("id", selectedAccountId);
        if (error) throw error;
      }

      // D. Insert account transactions log
      const { error: accTxError } = await supabase
        .from("account_transactions")
        .insert({
          shop_id: shopId,
          account_id: selectedAccountId,
          type: "deposit",
          amount: amt,
          ref_type: "invoice",
          ref_id: selectedInvoice.id,
          remarks: `EMI Installment Payment - Invoice #${selectedInvoice.id.slice(0, 8).toUpperCase()}`
        });
      if (accTxError) throw accTxError;

      // E. Update customer's outstanding balance in Khata (if customer exists)
      if (customer.id) {
        // Decrement customer outstanding balance by collected amount (which reduces what they owe us)
        const { error: balanceError } = await supabase
          .rpc("increment_party_balance", {
            p_id: customer.id,
            amount: -amt
          });
        if (balanceError) throw balanceError;

        // F. Insert credit transactions log
        const { error: creditTxError } = await supabase
          .from("credit_transactions")
          .insert({
            shop_id: shopId,
            customer_id: customer.id,
            amount: amt,
            transaction_type: "payment",
            remarks: `EMI Installment Collection - Invoice #${selectedInvoice.id.slice(0, 8).toUpperCase()}`,
            account_id: selectedAccountId
          });
        if (creditTxError) throw creditTxError;
      }

      // Construct the updated invoice with modified schedules for the PDF receipt
      const updatedInvoiceForReceipt = {
        ...selectedInvoice,
        emi_schedules: selectedInvoice.emi_schedules.map((s: any) => {
          const updated = schedulesToUpdate.find((u: any) => u.id === s.id);
          return updated ? updated : s;
        })
      };

      toast.success("Payment collected and schedules updated successfully!");
      setIsCollectModalOpen(false);
      setSelectedInvoice(null);
      
      // Open print preview popup
      setActiveSlipData({
        invoice: updatedInvoiceForReceipt,
        amountCollected: amt,
        surcharge,
        accountName: currentAcc?.name || "Cash",
        date: new Date().toLocaleString()
      });
      setIsPrintModalOpen(true);
      
      // Refresh list
      fetchEMIInvoices();
      fetchAccounts();
    } catch (err: any) {
      toast.error("Failed to collect payment: " + err.message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handlePrintSlip = () => {
    if (!activeSlipData) return;

    let iframe = document.getElementById("print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-iframe";
      iframe.style.position = "absolute";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      toast.error("Printing failed: Could not access printer frame.");
      return;
    }

    const shopName = companyDetails?.name || "THE ACCOUNTS STORE";
    const shopPhone = companyDetails?.phone || "";
    const shopAddress = companyDetails?.address || "";
    const customer = getCustomerDetails(activeSlipData.invoice);
    const invoiceIdShort = activeSlipData.invoice.id.slice(0, 8).toUpperCase();

    // Calculations
    const totalBill = Number(activeSlipData.invoice.total_amount);
    const downPayment = Number(activeSlipData.invoice.paid_amount);
    const principal = totalBill - downPayment;
    
    const schedules = activeSlipData.invoice.emi_schedules || [];
    const totalPaidSchedules = schedules.reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);
    const totalLateFee = schedules.reduce((sum: number, s: any) => sum + Number(s.late_fee || 0), 0);
    
    const totalPaidAmount = downPayment + totalPaidSchedules;
    const totalRemaining = (principal + totalLateFee) - totalPaidSchedules;

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>EMI Payment Slip</title>
          <style>
            @page { margin: 0; }
            body { 
              margin: 0; 
              padding: 5mm; 
              background: white; 
              width: 80mm;
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          <div style="width: 70mm; color: #1e293b; font-size: 9.5px; line-height: 1.4;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 6px;">
              <h2 style="margin: 0; font-size: 13px; font-weight: bold;">${shopName.toUpperCase()}</h2>
              ${shopAddress ? `<p style="margin: 2px 0 0 0; font-size: 8px; color: #64748b;">${shopAddress}</p>` : ""}
              ${shopPhone ? `<p style="margin: 2px 0 0 0; font-size: 8px; color: #64748b;">Phone: ${shopPhone}</p>` : ""}
            </div>
            
            <div style="border-top: 1px dashed #cbd5e1; margin: 6px 0;"></div>
            
            <!-- Title -->
            <div style="text-align: center; margin-bottom: 6px;">
              <h3 style="margin: 0; font-size: 10px; font-weight: bold; text-transform: uppercase;">EMI PAYMENT RECEIPT</h3>
              <span style="font-size: 8.5px; color: #64748b;">(رسیدِ وصولی قسط)</span>
            </div>
            
            <div style="border-top: 1px dashed #cbd5e1; margin: 6px 0;"></div>
            
            <!-- Info -->
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; color: #475569;">
              <tr>
                <td style="padding: 1.5px 0;">Date & Time:</td>
                <td style="text-align: right; padding: 1.5px 0; font-family: monospace;">${activeSlipData.date}</td>
              </tr>
              <tr>
                <td style="padding: 1.5px 0;">Receipt ID:</td>
                <td style="text-align: right; padding: 1.5px 0; font-family: monospace;">INV-${invoiceIdShort}-RC</td>
              </tr>
              <tr>
                <td style="padding: 1.5px 0;">Customer:</td>
                <td style="text-align: right; padding: 1.5px 0; font-weight: bold; color: #1e293b;">${customer.name}</td>
              </tr>
              ${customer.father_name ? `
              <tr>
                <td style="padding: 1.5px 0;">S/O:</td>
                <td style="text-align: right; padding: 1.5px 0;">${customer.father_name}</td>
              </tr>` : ""}
              ${customer.cnic_number ? `
              <tr>
                <td style="padding: 1.5px 0;">CNIC:</td>
                <td style="text-align: right; padding: 1.5px 0; font-family: monospace;">${customer.cnic_number}</td>
              </tr>` : ""}
              ${customer.phone ? `
              <tr>
                <td style="padding: 1.5px 0;">Phone:</td>
                <td style="text-align: right; padding: 1.5px 0; font-family: monospace;">${customer.phone}</td>
              </tr>` : ""}
            </table>
            
            <div style="border-top: 1px dashed #cbd5e1; margin: 6px 0;"></div>

            <!-- Items Bought -->
            <div style="font-size: 8.5px; color: #475569; margin: 4px 0;">
              <p style="font-weight: bold; color: #334155; margin: 0 0 3px 0; font-size: 9px;">Items Purchased</p>
              ${activeSlipData.invoice.invoice_items?.map(it => `
                <div style="display: flex; justify-content: space-between; padding: 1px 0;">
                  <span>${it.products?.name || "Product"} (x${Number(it.quantity)})</span>
                  ${it.warranty ? `<span style="color: #4f46e5; font-weight: bold;">[Warr: ${it.warranty}]</span>` : ""}
                </div>
              `).join("") || ""}
            </div>

            <div style="border-top: 1px dashed #cbd5e1; margin: 6px 0;"></div>
            
            <!-- Collection Highlight Box -->
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px; margin: 6px 0;">
              <div style="display: flex; justify-content: space-between; font-weight: bold; color: #166534; font-size: 10px;">
                <span>Amount Collected:</span>
                <span>Rs ${activeSlipData.amountCollected.toLocaleString()}</span>
              </div>
              ${activeSlipData.surcharge > 0 ? `
              <div style="display: flex; justify-content: space-between; color: #b45309; font-size: 8px; margin-top: 2px;">
                <span>Late Surcharge/Penalty:</span>
                <span>+Rs ${activeSlipData.surcharge.toLocaleString()}</span>
              </div>` : ""}
              <div style="display: flex; justify-content: space-between; color: #475569; font-size: 8px; margin-top: 2px;">
                <span>Payment Mode:</span>
                <span>${activeSlipData.accountName}</span>
              </div>
            </div>
            
            <div style="border-top: 1px dashed #cbd5e1; margin: 6px 0;"></div>
            
            <!-- Balance Summary -->
            <div style="font-size: 8.5px; color: #475569;">
              <p style="font-weight: bold; color: #334155; margin: 0 0 4px 0; font-size: 9px;">EMI Balance Statement</p>
              <div style="display: flex; justify-content: space-between; padding: 1px 0;">
                <span>Total Bill Value:</span>
                <span>Rs ${totalBill.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 1px 0;">
                <span>Down Payment:</span>
                <span>Rs ${downPayment.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 1px 0;">
                <span>Total Paid So Far:</span>
                <span>Rs ${totalPaidAmount.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0 1px 0; font-weight: bold; border-top: 1px dashed #e2e8f0; margin-top: 3px; color: #b91c1c; font-size: 9px;">
                <span>Remaining Balance:</span>
                <span>Rs ${totalRemaining.toLocaleString()}</span>
              </div>
            </div>
            
            <div style="border-top: 1px dashed #cbd5e1; margin: 6px 0;"></div>
            
            <!-- Signatures -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 8px; color: #64748b; text-align: center;">
              <tr>
                <td style="width: 50%; padding-bottom: 25px;">Customer Sign</td>
                <td style="width: 50%; padding-bottom: 25px;">Shop Stamp & Sign</td>
              </tr>
              <tr>
                <td>_________________</td>
                <td>_________________</td>
              </tr>
            </table>
            
            <div style="text-align: center; color: #94a3b8; font-size: 7.5px; margin-top: 20px; font-style: italic;">
              <p style="margin: 0;">Thank you for your business!</p>
              <p style="margin: 2px 0 0 0;">Powered by The Accounts</p>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();
  };

  // Dynamic thermal slip receipt PDF download (80mm format)
  const downloadPaymentSlipPDF = async (
    invoice: EMIInvoice,
    collectedAmt: number,
    surchargeAmt: number,
    accountName: string
  ) => {
    try {
      const { default: jsPDF } = await import("jspdf");

      // 80mm width standard thermal roll. Standard height is 180mm.
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 180]
      });

      const shopName = companyDetails?.name || "THE ACCOUNTS STORE";
      const shopPhone = companyDetails?.phone || "";
      const shopAddress = companyDetails?.address || "";
      const customer = getCustomerDetails(invoice);

      // Calculations
      const totalBill = Number(invoice.total_amount);
      const downPayment = Number(invoice.paid_amount);
      const principal = totalBill - downPayment;
      
      const schedules = invoice.emi_schedules || [];
      const totalPaidSchedules = schedules.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
      const totalLateFee = schedules.reduce((sum, s) => sum + Number(s.late_fee || 0), 0);
      
      const totalPaidAmount = downPayment + totalPaidSchedules;
      const totalRemaining = (principal + totalLateFee) - totalPaidSchedules;

      // Font configurations
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      
      // Center shop name
      const shopNameWidth = doc.getTextWidth(shopName);
      doc.text(shopName, (80 - shopNameWidth) / 2, 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      
      let headerY = 14;
      if (shopAddress) {
        const splitAddress = doc.splitTextToSize(shopAddress, 70);
        splitAddress.forEach((line: string) => {
          const w = doc.getTextWidth(line);
          doc.text(line, (80 - w) / 2, headerY);
          headerY += 3.5;
        });
      }
      if (shopPhone) {
        const phoneText = `Phone: ${shopPhone}`;
        const w = doc.getTextWidth(phoneText);
        doc.text(phoneText, (80 - w) / 2, headerY);
        headerY += 3.5;
      }

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(5, headerY, 75, headerY);
      headerY += 4;

      // Receipt Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      const titleText = "PAYMENT RECEIPT";
      const titleWidth = doc.getTextWidth(titleText);
      doc.text(titleText, (80 - titleWidth) / 2, headerY);
      headerY += 5;

      doc.line(5, headerY, 75, headerY);
      headerY += 5;

      // Date, Ref & Customer Info
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      
      doc.text(`Date & Time: ${new Date().toLocaleString()}`, 5, headerY);
      headerY += 3.5;
      doc.text(`Receipt ID: INV-${invoice.id.slice(0, 8).toUpperCase()}-RC`, 5, headerY);
      headerY += 3.5;
      doc.text(`Customer: ${customer.name}`, 5, headerY);
      headerY += 3.5;
      if (customer.father_name) {
        doc.text(`S/O: ${customer.father_name}`, 5, headerY);
        headerY += 3.5;
      }
      if (customer.cnic_number) {
        doc.text(`CNIC: ${customer.cnic_number}`, 5, headerY);
        headerY += 3.5;
      }
      if (customer.phone) {
        doc.text(`Phone: ${customer.phone}`, 5, headerY);
        headerY += 3.5;
      }

      // Render small list of items bought
      doc.line(5, headerY, 75, headerY);
      headerY += 4;
      doc.setFont("helvetica", "bold");
      doc.text("ITEMS BOUGHT", 5, headerY);
      headerY += 3.5;
      doc.setFont("helvetica", "normal");
      invoice.invoice_items?.forEach(it => {
        const itemText = `${it.products?.name || "Product"} (x${it.quantity})${it.warranty ? ` [Warr: ${it.warranty}]` : ""}`;
        const splitText = doc.splitTextToSize(itemText, 70);
        splitText.forEach((line: string) => {
          doc.text(line, 5, headerY);
          headerY += 3.5;
        });
      });

      doc.line(5, headerY, 75, headerY);
      headerY += 5;

      // COLLECTION HIGHLIGHTS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105); // Emerald 600
      doc.text(`Amount Collected: Rs ${collectedAmt.toLocaleString()}`, 5, headerY);
      headerY += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      if (surchargeAmt > 0) {
        doc.text(`Penalty/Surcharge: Rs ${surchargeAmt.toLocaleString()}`, 5, headerY);
        headerY += 3.5;
      }
      doc.text(`Payment Account: ${accountName}`, 5, headerY);
      headerY += 4.5;

      doc.line(5, headerY, 75, headerY);
      headerY += 5;

      // EMI BALANCE SUMMARY
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text("EMI BALANCE STATEMENT", 5, headerY);
      headerY += 4.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Bill Value: Rs ${totalBill.toLocaleString()}`, 5, headerY);
      headerY += 3.5;
      doc.text(`Down Payment: Rs ${downPayment.toLocaleString()}`, 5, headerY);
      headerY += 3.5;
      doc.text(`Total Paid So Far: Rs ${totalPaidAmount.toLocaleString()}`, 5, headerY);
      headerY += 3.5;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38); // Red 600
      doc.text(`Remaining Balance: Rs ${totalRemaining.toLocaleString()}`, 5, headerY);
      headerY += 6;

      doc.line(5, headerY, 75, headerY);
      headerY += 6;

      // Signature Area (Side by side)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      
      doc.text("Customer Sign", 8, headerY);
      doc.text("Shop Stamp/Sign", 48, headerY);
      headerY += 8;

      doc.text("_____________", 8, headerY);
      doc.text("_______________", 48, headerY);
      headerY += 8;

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      const footerText = "Thank you for your business! Powered by The Accounts";
      const footerWidth = doc.getTextWidth(footerText);
      doc.text(footerText, (80 - footerWidth) / 2, headerY);

      doc.save(`EMI_Slip_${customer.name.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
      toast.success("Thermal Payment Slip downloaded successfully!");
    } catch (err: any) {
      toast.error("Failed to generate thermal receipt: " + err.message);
    }
  };

  // Dynamic receipt PDF download
  const downloadReceiptPDF = async (invoice: EMIInvoice) => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const shopName = companyDetails?.name || "THE ACCOUNTS STORE";
      const shopPhone = companyDetails?.phone || "";
      const shopAddress = companyDetails?.address || "";
      const customer = getCustomerDetails(invoice);

      // Colors
      const primaryColor = [30, 41, 59]; // Slate 800
      const secondaryColor = [71, 85, 105]; // Slate 600

      // Header block design
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(shopName, 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      let headerY = 25;
      if (shopAddress) {
        doc.text(shopAddress, 15, headerY);
        headerY += 5;
      }
      if (shopPhone) {
        doc.text(`Phone: ${shopPhone}`, 15, headerY);
        headerY += 5;
      }

      // Title & Reference
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("CUSTOMER EMI RECEIPT", 130, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(`Invoice ID: #${invoice.id.slice(0, 8).toUpperCase()}`, 130, 25);
      doc.text(`Sale Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 130, 30);
      doc.text(`Print Date: ${new Date().toLocaleDateString()}`, 130, 35);

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, 38, 195, 38);

      // Customer Details (Left Column)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("CUSTOMER INFO", 15, 46);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Name: ${customer.name}`, 15, 52);
      doc.text(`S/O (Father): ${customer.father_name || "N/A"}`, 15, 57);
      doc.text(`CNIC: ${customer.cnic_number || "N/A"}`, 15, 62);
      doc.text(`Phone: ${customer.phone || "N/A"}`, 15, 67);
      doc.text(`Ledger Balance: Rs ${customer.balance.toLocaleString()}`, 15, 72);

      // Financial breakdown (Right Column)
      const totalBill = Number(invoice.total_amount);
      const downPayment = Number(invoice.paid_amount);
      const principal = totalBill - downPayment;
      
      const schedules = invoice.emi_schedules || [];
      const totalPaidSchedules = schedules.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
      const totalLateFee = schedules.reduce((sum, s) => sum + Number(s.late_fee || 0), 0);
      
      const totalPaidAmount = downPayment + totalPaidSchedules;
      const totalRemaining = (principal + totalLateFee) - totalPaidSchedules;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("FINANCIAL SUMMARY", 120, 46);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total Bill Amount: Rs ${totalBill.toLocaleString()}`, 120, 52);
      doc.text(`Down Payment: Rs ${downPayment.toLocaleString()}`, 120, 57);
      doc.text(`Installment Principal: Rs ${principal.toLocaleString()}`, 120, 62);
      doc.text(`Late Penalties Added: Rs ${totalLateFee.toLocaleString()}`, 120, 67);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(5, 150, 105); // Emerald 600
      doc.text(`Total Paid So Far: Rs ${totalPaidAmount.toLocaleString()}`, 120, 74);
      doc.setTextColor(220, 38, 38); // Red 600
      doc.text(`Remaining Balance: Rs ${totalRemaining.toLocaleString()}`, 120, 79);

      // Items purchased block (Shifted down to Y=82 to make space for CNIC/Father Name)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("ITEMS BOUGHT", 15, 82);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const itemNames = invoice.invoice_items?.map(it => `${it.products?.name || "Product"} (x${it.quantity})${it.warranty ? ` [Warranty: ${it.warranty}]` : ""}`).join(", ") || "N/A";
      const splitItems = doc.splitTextToSize(itemNames, 90);
      doc.text(splitItems, 15, 87);

      // Table for installments (Shifted down to startY=98)
      const tableHeaders = [["Installment", "Due Date", "Original", "Penalty", "Paid Amount", "Remaining", "Status"]];
      const sortedSchedules = [...schedules].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      
      const tableRows = sortedSchedules.map((s, idx) => {
        const instAmt = Number(s.installment_amount);
        const penalty = Number(s.late_fee || 0);
        const paid = Number(s.amount_paid || 0);
        const rem = (instAmt + penalty) - paid;
        return [
          `Installment ${idx + 1}`,
          new Date(s.due_date).toLocaleDateString(),
          `Rs ${instAmt.toLocaleString()}`,
          `Rs ${penalty.toLocaleString()}`,
          `Rs ${paid.toLocaleString()}`,
          `Rs ${rem.toLocaleString()}`,
          s.status === "paid" ? "PAID" : rem < (instAmt + penalty) && rem > 0 ? "PARTIAL" : "UNPAID"
        ];
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 98,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Slate 800
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 8.5
        }
      });

      const txs = invoiceTransactions[invoice.id] || [];
      const lastY = (doc as any).lastAutoTable?.finalY || 160;
      let nextStartY = lastY + 12;

      // Check if we need to add a new page if it exceeds page height (A4 height is 297mm)
      if (nextStartY > 240) {
        doc.addPage();
        nextStartY = 20;
      }

      // Title for payment history (English only to avoid font corruption)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("PAYMENT & COLLECTION HISTORY", 15, nextStartY);
      nextStartY += 5;

      if (txs.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text("No payment transactions recorded for this plan.", 15, nextStartY);
      } else {
        const txHeaders = [["S#", "Date & Time", "Payment Mode", "Remarks", "Amount Paid"]];
        const txRows = txs.map((tx, idx) => {
          const accName = accounts.find(a => a.id === tx.account_id)?.name || "Cash/Bank";
          return [
            (idx + 1).toString(),
            new Date(tx.created_at).toLocaleString(),
            accName,
            tx.remarks || "Installment Payment",
            `Rs ${Number(tx.amount).toLocaleString()}`
          ];
        });

        autoTable(doc, {
          head: txHeaders,
          body: txRows,
          startY: nextStartY,
          theme: "striped",
          headStyles: {
            fillColor: [71, 85, 105], // Slate 600
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: "bold"
          },
          styles: {
            fontSize: 8
          }
        });
      }

      doc.save(`EMI_Receipt_${customer.name.replace(/\s+/g, "_")}_${invoice.id.slice(0, 8)}.pdf`);
      toast.success("Receipt downloaded successfully!");
    } catch (err: any) {
      toast.error("Failed to generate PDF receipt: " + err.message);
    }
  };

  // Master PDF report download
  const downloadMasterReportPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const shopName = companyDetails?.name || "THE ACCOUNTS STORE";

      // Header Design
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text(shopName, 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text("EMI / Installment Book - Master Statement", 15, 26);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 32);

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(15, 36, 282, 36);

      let totalDebtSum = 0;
      let totalPaidSum = 0;
      let totalOutstandingSum = 0;

      const tableRows = filteredInvoices.map((inv, idx) => {
        const customer = getCustomerDetails(inv);
        const totalBill = Number(inv.total_amount);
        const downPayment = Number(inv.paid_amount);
        const principal = totalBill - downPayment;
        
        const schedules = inv.emi_schedules || [];
        const totalPaidSchedules = schedules.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
        const totalLateFee = schedules.reduce((sum, s) => sum + Number(s.late_fee || 0), 0);
        
        const totalDebt = principal + totalLateFee;
        const totalRemaining = (principal + totalLateFee) - totalPaidSchedules;

        totalDebtSum += totalDebt;
        totalPaidSum += totalPaidSchedules;
        totalOutstandingSum += totalRemaining;

        return [
          idx + 1,
          customer.name,
          customer.phone || "N/A",
          `#${inv.id.slice(0, 8).toUpperCase()}`,
          new Date(inv.created_at).toLocaleDateString(),
          `Rs ${totalBill.toLocaleString()}`,
          `Rs ${downPayment.toLocaleString()}`,
          `Rs ${totalDebt.toLocaleString()}`,
          `Rs ${totalPaidSchedules.toLocaleString()}`,
          `Rs ${totalRemaining.toLocaleString()}`
        ];
      });

      // Append totals row
      tableRows.push([
        "",
        "TOTALS",
        "",
        "",
        "",
        "",
        "",
        `Rs ${totalDebtSum.toLocaleString()}`,
        `Rs ${totalPaidSum.toLocaleString()}`,
        `Rs ${totalOutstandingSum.toLocaleString()}`
      ]);

      const tableHeaders = [[
        "S#",
        "Customer Name",
        "Phone",
        "Invoice ID",
        "Sale Date",
        "Total Bill",
        "Down Payment",
        "Installment Debt",
        "Installments Paid",
        "Outstanding Debt"
      ]];

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 42,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Slate 800
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 8.5
        },
        didParseCell: (data) => {
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [241, 245, 249]; // Slate 100
          }
        }
      });

      doc.save(`EMI_Master_Report_${Date.now()}.pdf`);
      toast.success("Master EMI Report downloaded successfully!");
    } catch (err: any) {
      toast.error("Failed to generate master report: " + err.message);
    }
  };

  // Perform client-side filter & search
  const filteredInvoices = invoices.filter(inv => {
    const customer = getCustomerDetails(inv);
    
    // Search query matches customer name or phone
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (customer.phone && customer.phone.includes(searchQuery));
    
    if (!matchesSearch) return false;

    // Filters
    const schedules = inv.emi_schedules || [];
    const unpaidSchedules = schedules.filter(s => s.status !== "paid");
    
    if (filterMode === "active") {
      return unpaidSchedules.length > 0;
    }

    if (filterMode === "due_today") {
      const todayStr = new Date().toISOString().split("T")[0];
      return unpaidSchedules.some(s => s.due_date && s.due_date.startsWith(todayStr));
    }
    
    if (filterMode === "paid") {
      return schedules.length > 0 && unpaidSchedules.length === 0;
    }
    
    if (filterMode === "overdue") {
      const now = new Date();
      return unpaidSchedules.some(s => new Date(s.due_date) < now);
    }

    return true;
  });

  // Calculate high-level stats
  const stats = React.useMemo(() => {
    let activeCount = 0;
    let totalOutstanding = 0;
    let overdueCount = 0;
    let totalCollected = 0;

    invoices.forEach(inv => {
      const schedules = inv.emi_schedules || [];
      const unpaid = schedules.filter(s => s.status !== "paid");
      
      if (unpaid.length > 0) {
        activeCount++;
      }

      // Add down payment
      totalCollected += Number(inv.paid_amount || 0);

      schedules.forEach(s => {
        const instAmt = Number(s.installment_amount);
        const penalty = Number(s.late_fee || 0);
        const paid = Number(s.amount_paid || 0);
        
        totalOutstanding += (instAmt + penalty) - paid;
        totalCollected += paid;

        if (s.status !== "paid" && new Date(s.due_date) < new Date()) {
          overdueCount++;
        }
      });
    });

    return { activeCount, totalOutstanding, overdueCount, totalCollected };
  }, [invoices]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans pb-12">
      
      {/* Header & Master Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
            <CreditCard className="text-blue-600 h-8 w-8" />
            <span>EMI & Installment Customer Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage installment plans, guarantor records, legal agreements, and collections</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            onClick={downloadMasterReportPDF}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
          >
            <Download size={16} />
            <span>Download Master Report</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Plans</p>
            <h3 className="text-2xl font-black text-slate-800">{stats.activeCount}</h3>
          </div>
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            <TrendingUp size={22} />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding Balance</p>
            <h3 className="text-2xl font-black text-red-600">Rs {stats.totalOutstanding.toLocaleString()}</h3>
          </div>
          <div className="h-12 w-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-bold">
            <DollarSign size={22} />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Overdue Installments</p>
            <h3 className={`text-2xl font-black ${stats.overdueCount > 0 ? "text-amber-600 animate-pulse" : "text-slate-800"}`}>
              {stats.overdueCount}
            </h3>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold ${stats.overdueCount > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"}`}>
            <Clock size={22} />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Collected</p>
            <h3 className="text-2xl font-black text-emerald-600">Rs {stats.totalCollected.toLocaleString()}</h3>
          </div>
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold">
            <Check size={22} />
          </div>
        </motion.div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {(
            [
              { id: "all", label: "All Plans" },
              { id: "due_today", label: "Due Today" },
              { id: "active", label: "Active Plans" },
              { id: "overdue", label: "Overdue / Defaulters" },
              { id: "paid", label: "Fully Settled" },
            ] as const
          ).map(mode => (
            <button
              key={mode.id}
              onClick={() => setFilterMode(mode.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === mode.id
                  ? mode.id === "overdue" ? "bg-amber-600 text-white shadow-sm" : "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search customer, phone, or CNIC..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-full bg-slate-50/50 border-slate-200/80 text-sm focus:bg-white rounded-xl"
          />
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
          <span>Loading installment books...</span>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center space-y-2">
          <AlertCircle size={32} className="text-slate-300" />
          <span className="font-semibold text-slate-600">No matching EMI/Installment records found.</span>
          <span className="text-xs text-slate-400">Add an EMI sale in the POS interface to get started.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredInvoices.map(inv => {
            const customer = getCustomerDetails(inv);
            const totalBill = Number(inv.total_amount);
            const downPayment = Number(inv.paid_amount);
            const principal = totalBill - downPayment;

            const schedules = inv.emi_schedules || [];
            const sortedSchedules = [...schedules].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
            
            const totalPaidSchedules = schedules.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
            const totalLateFee = schedules.reduce((sum, s) => sum + Number(s.late_fee || 0), 0);
            
            const totalPaid = downPayment + totalPaidSchedules;
            const totalRemaining = (principal + totalLateFee) - totalPaidSchedules;
            
            // Progress Bar calc
            const totalEmiSum = totalBill + totalLateFee;
            const progressPct = totalEmiSum > 0 ? Math.min(100, Math.round((totalPaid / totalEmiSum) * 100)) : 0;
            
            const unpaidSchedules = sortedSchedules.filter(s => s.status !== "paid");
            const isFullySettled = unpaidSchedules.length === 0;

            // Next Installment details
            const nextInstallment = unpaidSchedules.length > 0 ? unpaidSchedules[0] : null;
            const nextDueAmount = nextInstallment 
              ? Number(nextInstallment.installment_amount) + Number(nextInstallment.late_fee || 0) - Number(nextInstallment.amount_paid || 0)
              : 0;
            const isOverdue = nextInstallment ? new Date(nextInstallment.due_date) < new Date() : false;

            // Product names list
            const productsList = inv.invoice_items?.map(it => `${it.products?.name || "Product"} (x${it.quantity})`).join(", ") || "No items listed";

            return (
              <motion.div 
                layout
                whileHover={{ y: -3 }}
                key={inv.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between p-5"
              >
                {/* Visual indicator bar */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  isFullySettled 
                    ? 'bg-emerald-500' 
                    : isOverdue 
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' 
                      : 'bg-blue-500'
                }`}></div>

                {/* Card Top Section: Customer details */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                        <User size={18} className="text-slate-400" /> 
                        <span>{customer.name}</span>
                        {customer.phone && (
                          <span className="text-xs text-slate-400 font-normal">({customer.phone})</span>
                        )}
                      </h3>
                      <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                        <span className="font-sans">Invoice:</span> #{inv.id.slice(0, 8).toUpperCase()}
                        <span className="text-slate-300">|</span>
                        <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isFullySettled
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : isOverdue
                          ? "bg-amber-50 border-amber-200 text-amber-800 animate-pulse"
                          : "bg-blue-50 border-blue-200 text-blue-800"
                    }`}>
                      {isFullySettled ? "Settled" : isOverdue ? "Overdue" : "Active"}
                    </span>
                  </div>

                  {/* Bought Products Pill */}
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs text-slate-600 flex items-center gap-1.5">
                    <Info size={14} className="text-slate-400 shrink-0" />
                    <span className="line-clamp-1 font-medium">{productsList}</span>
                  </div>

                  {/* Progress Indicator */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>Progress (وصولی)</span>
                      <span className="text-slate-700">
                        Rs {totalPaid.toLocaleString()} / Rs {totalEmiSum.toLocaleString()} ({progressPct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          isFullySettled ? "bg-emerald-500" : "bg-blue-600"
                        }`} 
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Detailed Financial Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Down Payment</p>
                      <p className="text-sm font-black text-slate-800">Rs {downPayment.toLocaleString()}</p>
                    </div>

                    <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Pending Balance</p>
                      <p className="text-sm font-black text-red-600">Rs {totalRemaining.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Next Installment detail */}
                  {!isFullySettled && nextInstallment ? (
                    <div className={`p-3 border rounded-xl flex items-center justify-between text-xs ${
                      isOverdue 
                        ? 'bg-amber-50/60 border-amber-200 text-amber-900' 
                        : 'bg-blue-50/40 border-blue-100 text-slate-700'
                    }`}>
                      <div className="space-y-0.5">
                        <p className="font-semibold flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" />
                          <span>Next Due: {new Date(nextInstallment.due_date).toLocaleDateString()}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Installment {schedules.indexOf(nextInstallment) + 1} of {schedules.length}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm text-slate-800">Rs {nextDueAmount.toLocaleString()}</p>
                        {isOverdue && (
                          <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">OVERDUE</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl text-xs text-emerald-800 text-center font-bold">
                      🎉 Customer EMI plan is fully paid and settled!
                    </div>
                  )}
                </div>

                {/* Actions Bottom Bar */}
                <div className="flex flex-wrap justify-between items-center gap-2 border-t border-slate-100 pt-4 mt-4">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setActiveInvoiceDetails(inv);
                        setIsDetailModalOpen(true);
                      }}
                      className="border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs h-9 px-3 rounded-lg flex items-center gap-1"
                    >
                      <Eye size={14} />
                      <span>Details</span>
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setActiveAgreementInvoice(inv);
                        setIsAgreementModalOpen(true);
                      }}
                      className="border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-xs h-9 px-3 rounded-lg flex items-center gap-1"
                      title="Print Legal Installment Sales Agreement"
                    >
                      <FileText size={14} className="text-indigo-600" />
                      <span>Agreement</span>
                    </Button>

                    <Button 
                      variant="outline"
                      onClick={() => sendWhatsAppReminder(inv)}
                      className="border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold text-xs h-9 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                      title="Send WhatsApp Due Installment Reminder"
                    >
                      <MessageCircle size={14} className="text-emerald-600" />
                      <span>WhatsApp</span>
                    </Button>
                  </div>

                  {!isFullySettled && (
                    <Button 
                      onClick={() => handleOpenCollect(inv)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1 shadow-sm active:scale-[0.98]"
                    >
                      <DollarSign size={14} />
                      <span>Collect Payment</span>
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Collection Modal */}
      <AnimatePresence>
        {isCollectModalOpen && selectedInvoice && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col"
            >
              {/* Header */}
              <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-1.5">
                    <DollarSign size={18} />
                    <span>Collect EMI Payment</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Receive installment payment</p>
                </div>
                <button 
                  onClick={() => setIsCollectModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleCollectSubmit} className="p-6 space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-bold text-slate-800">{getCustomerDetails(selectedInvoice).name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Invoice Ref:</span>
                    <span className="font-mono">#{selectedInvoice.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-red-600 font-bold border-t border-slate-200/60 pt-1.5 mt-1.5">
                    <span>Outstanding:</span>
                    <span>
                      Rs {(Number(selectedInvoice.total_amount) - Number(selectedInvoice.paid_amount) + 
                        (selectedInvoice.emi_schedules?.reduce((sum, s) => sum + Number(s.late_fee || 0), 0) || 0) - 
                        (selectedInvoice.emi_schedules?.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0) || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment mode / Cash Account selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Deposit to Account
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="" disabled>Select cash/bank account...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: Rs {Number(acc.current_balance || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Surcharge / Fine Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Add Late Penalty / Surcharge (If any)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rs</span>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={penaltyAmount}
                      onChange={(e) => setPenaltyAmount(e.target.value)}
                      className="pl-9 bg-white border-slate-200"
                    />
                  </div>
                </div>

                {/* Amount to collect */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Amount to Collect Now
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rs</span>
                    <Input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="Enter amount..."
                      value={amountToCollect}
                      onChange={(e) => setAmountToCollect(e.target.value)}
                      className="pl-9 bg-white border-slate-200 text-base font-bold text-slate-800"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    * Collected amount is adjusted across unpaid installments chronologically.
                  </p>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCollectModalOpen(false)}
                    className="border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs h-10 px-4 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingPayment}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 rounded-xl flex items-center gap-1.5 shadow-md"
                  >
                    {submittingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Collect Rs {parseFloat(amountToCollect) ? parseFloat(amountToCollect).toLocaleString() : "0"}</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details & History Modal */}
      <AnimatePresence>
        {isDetailModalOpen && activeInvoiceDetails && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-1.5">
                    <FileText size={18} />
                    <span>EMI Plan Details & Payment History</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">Invoice ID: #{activeInvoiceDetails.id.substring(0, 8).toUpperCase()}</p>
                </div>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Top Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 border border-slate-100 rounded-xl text-sm">
                  {/* Customer Details */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Customer Details</h4>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800">{getCustomerDetails(activeInvoiceDetails).name}</p>
                      {getCustomerDetails(activeInvoiceDetails).father_name && (
                        <p className="text-xs text-slate-600">S/O (Father): {getCustomerDetails(activeInvoiceDetails).father_name}</p>
                      )}
                      {getCustomerDetails(activeInvoiceDetails).cnic_number && (
                        <p className="text-xs text-slate-600">CNIC: {getCustomerDetails(activeInvoiceDetails).cnic_number}</p>
                      )}
                      {getCustomerDetails(activeInvoiceDetails).phone && (
                        <p className="text-xs text-slate-600 flex items-center gap-1"><Phone size={12} /> {getCustomerDetails(activeInvoiceDetails).phone}</p>
                      )}
                      <p className="text-xs text-slate-600">Khata Balance: Rs {getCustomerDetails(activeInvoiceDetails).balance.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Guarantor Details */}
                  <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-200/60 pt-2 md:pt-0 md:pl-4">
                    <h4 className="font-bold text-indigo-700 text-xs uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck size={13}/>
                      <span>Guarantor Details</span>
                    </h4>
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-slate-800">
                        {activeInvoiceDetails.guarantor_name || "No Guarantor Named"}
                      </p>
                      {activeInvoiceDetails.guarantor_relation && (
                        <p className="text-slate-600">Relation: {activeInvoiceDetails.guarantor_relation}</p>
                      )}
                      {activeInvoiceDetails.guarantor_cnic && (
                        <p className="text-slate-600 font-mono">CNIC: {activeInvoiceDetails.guarantor_cnic}</p>
                      )}
                      {activeInvoiceDetails.guarantor_phone && (
                        <p className="text-slate-600 flex items-center gap-1"><Phone size={11}/> {activeInvoiceDetails.guarantor_phone}</p>
                      )}
                      {activeInvoiceDetails.guarantor_address && (
                        <p className="text-slate-500 text-[11px] truncate">{activeInvoiceDetails.guarantor_address}</p>
                      )}
                    </div>
                  </div>

                  {/* Purchase Overview */}
                  <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-200/60 pt-2 md:pt-0 md:pl-4">
                    <h4 className="font-bold text-slate-500 text-xs uppercase tracking-wider">Purchase Overview</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">Total Bill:</span>
                        <p className="font-bold text-slate-800">Rs {Number(activeInvoiceDetails.total_amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Down Payment:</span>
                        <p className="font-bold text-slate-800">Rs {Number(activeInvoiceDetails.paid_amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Surcharges:</span>
                        <p className="font-bold text-slate-800">
                          Rs {(activeInvoiceDetails.emi_schedules?.reduce((sum, s) => sum + Number(s.late_fee || 0), 0) || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Total Paid:</span>
                        <p className="font-bold text-emerald-600">
                          Rs {(activeInvoiceDetails.emi_schedules?.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0) || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Purchased list */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Items Purchased</h4>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs bg-white overflow-x-auto w-full custom-scrollbar">
                    <table className="w-full text-left min-w-[500px] surface-table-1">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Product Name</th>
                          <th className="p-3 text-right">Quantity</th>
                          <th className="p-3 text-right">Unit Price</th>
                          <th className="p-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeInvoiceDetails.invoice_items?.map((item) => (
                          <tr key={item.id}>
                            <td className="p-3 font-semibold text-slate-800">
                              <div>{item.products?.name || "Product"}</div>
                              {item.warranty && (
                                <div className="text-[10px] text-indigo-600 font-normal mt-0.5">Warranty: {item.warranty}</div>
                              )}
                            </td>
                            <td className="p-3 text-right text-slate-600">{Number(item.quantity)}</td>
                            <td className="p-3 text-right text-slate-600">Rs {Number(item.unit_price).toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-slate-800 font-bold">Rs {Number(item.subtotal).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Installment Schedules Table */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Installment Plan & Payment Status</h4>
                    <Button
                      onClick={() => sendWhatsAppReminder(activeInvoiceDetails)}
                      size="sm"
                      className="h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 shadow-2xs"
                    >
                      <MessageCircle size={12} className="mr-1"/>
                      Send Full Plan WhatsApp
                    </Button>
                  </div>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs bg-white overflow-x-auto w-full custom-scrollbar">
                    <table className="w-full text-left min-w-[500px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Installment #</th>
                          <th className="p-3">Due Date</th>
                          <th className="p-3 text-right">Original Amt</th>
                          <th className="p-3 text-right">Late Surcharge</th>
                          <th className="p-3 text-right">Amt Paid</th>
                          <th className="p-3 text-right">Remaining</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Reminder</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...(activeInvoiceDetails.emi_schedules || [])]
                          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                          .map((s, idx) => {
                            const instAmt = Number(s.installment_amount);
                            const penalty = Number(s.late_fee || 0);
                            const paid = Number(s.amount_paid || 0);
                            const rem = (instAmt + penalty) - paid;
                            const isPaid = s.status === "paid";
                            const isOverdue = new Date(s.due_date) < new Date() && !isPaid;

                            return (
                              <tr key={s.id} className={isOverdue ? "bg-amber-50/20" : ""}>
                                <td className="p-3 font-semibold text-slate-800">Installment {idx + 1}</td>
                                <td className="p-3 text-slate-600 font-mono">{new Date(s.due_date).toLocaleDateString()}</td>
                                <td className="p-3 text-right text-slate-600 font-mono">Rs {instAmt.toLocaleString()}</td>
                                <td className="p-3 text-right text-amber-600 font-mono font-semibold">
                                  {penalty > 0 ? `+Rs ${penalty.toLocaleString()}` : "Rs 0"}
                                </td>
                                <td className="p-3 text-right text-emerald-600 font-mono font-semibold">Rs {paid.toLocaleString()}</td>
                                <td className="p-3 text-right text-red-600 font-mono font-bold">Rs {rem.toLocaleString()}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                    isPaid
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                      : rem < (instAmt + penalty) && rem > 0
                                        ? "bg-amber-50 border-amber-200 text-amber-800"
                                        : isOverdue
                                          ? "bg-red-50 border-red-200 text-red-800 animate-pulse"
                                          : "bg-blue-50 border-blue-200 text-blue-800"
                                  }`}>
                                    {isPaid ? "Paid" : rem < (instAmt + penalty) && rem > 0 ? "Partial" : isOverdue ? "Overdue" : "Unpaid"}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  {!isPaid && (
                                    <button
                                      type="button"
                                      onClick={() => sendWhatsAppReminder(activeInvoiceDetails, s)}
                                      className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                      title="Send WhatsApp Reminder for this installment"
                                    >
                                      <MessageCircle size={13}/>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Collection & Payment History */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Payment & Collection History (وصولیوں کی تفصیل)</h4>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs bg-white overflow-x-auto w-full custom-scrollbar">
                    <table className="w-full text-left min-w-[500px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">S#</th>
                          <th className="p-3">Date & Time</th>
                          <th className="p-3">Payment Mode</th>
                          <th className="p-3">Remarks</th>
                          <th className="p-3 text-right">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(!invoiceTransactions[activeInvoiceDetails.id] || invoiceTransactions[activeInvoiceDetails.id].length === 0) ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400 italic bg-slate-50/50">
                              No payment transactions recorded for this plan.
                            </td>
                          </tr>
                        ) : (
                          invoiceTransactions[activeInvoiceDetails.id].map((tx, idx) => {
                            const accName = accounts.find(a => a.id === tx.account_id)?.name || "Cash/Bank";
                            return (
                              <tr key={tx.id}>
                                <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                                <td className="p-3 text-slate-600 font-mono">{new Date(tx.created_at).toLocaleString()}</td>
                                <td className="p-3 text-slate-700 font-medium">{accName}</td>
                                <td className="p-3 text-slate-600">{tx.remarks || "Installment Payment"}</td>
                                <td className="p-3 text-right font-mono font-bold text-emerald-600">Rs {Number(tx.amount).toLocaleString()}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
                <Button 
                  onClick={() => downloadReceiptPDF(activeInvoiceDetails)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-4 rounded-xl flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Download Customer Receipt</span>
                  <span className="text-[10px] text-slate-400 font-urdu border-l border-slate-700 pl-1.5 ml-1">(رسید ڈاؤن لوڈ)</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs h-10 px-4 rounded-xl"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Slip Preview Modal */}
      <AnimatePresence>
        {isPrintModalOpen && activeSlipData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Printer size={16} />
                    <span>Print Installment Receipt</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-urdu mt-0.5">رسید پرنٹ یا ڈاؤن لوڈ کریں</p>
                </div>
                <button 
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Preview Box */}
              <div className="p-4 bg-slate-50 overflow-y-auto flex justify-center items-start flex-1 border-b border-slate-100">
                <div 
                  id="thermal-slip-preview"
                  className="w-[72mm] bg-white border border-slate-200/80 shadow-sm p-4 rounded-lg text-slate-800 text-[10px] line-height-normal space-y-3 font-sans"
                >
                  {/* Shop Details */}
                  <div className="text-center space-y-0.5">
                    <h4 className="font-extrabold text-[12px] text-slate-900 uppercase tracking-tight">
                      {companyDetails?.name || "THE ACCOUNTS STORE"}
                    </h4>
                    {companyDetails?.address && (
                      <p className="text-[8.5px] text-slate-400 leading-tight">{companyDetails.address}</p>
                    )}
                    {companyDetails?.phone && (
                      <p className="text-[8.5px] text-slate-400">Phone: {companyDetails.phone}</p>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-200 my-1.5"></div>

                  {/* Title */}
                  <div className="text-center">
                    <h5 className="font-bold text-[10.5px] text-slate-900">EMI PAYMENT RECEIPT</h5>
                    <span className="text-[8px] font-urdu text-slate-500">(رسیدِ وصولی قسط)</span>
                  </div>

                  <div className="border-t border-dashed border-slate-200 my-1.5"></div>

                  {/* Info table */}
                  <div className="space-y-1 text-slate-500 text-[8.5px]">
                    <div className="flex justify-between">
                      <span>Date & Time:</span>
                      <span className="font-mono text-slate-700">{activeSlipData.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Receipt ID:</span>
                      <span className="font-mono text-slate-700">
                        INV-{activeSlipData.invoice.id.slice(0, 8).toUpperCase()}-RC
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer:</span>
                      <span className="font-bold text-slate-800">
                        {getCustomerDetails(activeSlipData.invoice).name}
                      </span>
                    </div>
                    {getCustomerDetails(activeSlipData.invoice).phone && (
                      <div className="flex justify-between">
                        <span>Phone:</span>
                        <span className="font-mono text-slate-700">
                          {getCustomerDetails(activeSlipData.invoice).phone}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-200 my-1.5"></div>

                  {/* Collection Details */}
                  <div className="space-y-1 p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg text-[8.5px]">
                    <div className="flex justify-between text-emerald-800 font-extrabold text-[10px]">
                      <span>Amount Collected:</span>
                      <span>Rs {activeSlipData.amountCollected.toLocaleString()}</span>
                    </div>
                    {activeSlipData.surcharge > 0 && (
                      <div className="flex justify-between text-amber-700 font-bold">
                        <span>Late Surcharge:</span>
                        <span>+Rs {activeSlipData.surcharge.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Payment Account:</span>
                      <span className="font-semibold">{activeSlipData.accountName}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-200 my-1.5"></div>

                  {/* EMI Balance Summary */}
                  <div className="space-y-1 text-slate-500 text-[8.5px]">
                    <p className="font-bold text-slate-700 text-[9px] mb-0.5">EMI Balance Statement</p>
                    <div className="flex justify-between">
                      <span>Total Bill Value:</span>
                      <span className="text-slate-700">Rs {Number(activeSlipData.invoice.total_amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Down Payment:</span>
                      <span className="text-slate-700">Rs {Number(activeSlipData.invoice.paid_amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Paid So Far:</span>
                      <span className="text-slate-700">
                        Rs {(Number(activeSlipData.invoice.paid_amount) + 
                          activeSlipData.invoice.emi_schedules.reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600 font-extrabold border-t border-dashed border-slate-200 pt-1 mt-1 text-[9px]">
                      <span>Remaining Balance:</span>
                      <span>
                        Rs {((Number(activeSlipData.invoice.total_amount) - Number(activeSlipData.invoice.paid_amount) + 
                          activeSlipData.invoice.emi_schedules.reduce((sum: number, s: any) => sum + Number(s.late_fee || 0), 0)) - 
                          activeSlipData.invoice.emi_schedules.reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-200 my-1.5"></div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-4 pt-2 text-[8px] text-slate-400">
                    <div className="text-center space-y-4">
                      <p>Customer Sign</p>
                      <div className="border-b border-slate-200 w-full"></div>
                    </div>
                    <div className="text-center space-y-4">
                      <p>Shop Stamp & Sign</p>
                      <div className="border-b border-slate-200 w-full"></div>
                    </div>
                  </div>

                  {/* Thank you footer */}
                  <div className="text-center text-[8px] text-slate-400 pt-3">
                    <p>Thank you for your business!</p>
                    <p className="text-[7px]">Powered by The Accounts</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-white flex gap-2">
                <Button 
                  onClick={handlePrintSlip}
                  className="flex-1 bg-slate-900 hover:bg-slate-950 text-white font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  <Printer size={14} />
                  <span>Print Receipt</span>
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => downloadPaymentSlipPDF(
                    activeSlipData.invoice,
                    activeSlipData.amountCollected,
                    activeSlipData.surcharge,
                    activeSlipData.accountName
                  )}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold h-10 rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  <Download size={14} />
                  <span>PDF Slip</span>
                </Button>

                <Button 
                  variant="outline"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold h-10 rounded-xl text-xs"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Installment Legal Agreement Modal */}
      <InstallmentAgreementModal
        isOpen={isAgreementModalOpen}
        onClose={() => setIsAgreementModalOpen(false)}
        invoice={activeAgreementInvoice}
        shopDetails={{
          name: companyDetails?.name,
          phone: companyDetails?.phone || "",
          address: companyDetails?.address || ""
        }}
      />

    </div>
  );
}
