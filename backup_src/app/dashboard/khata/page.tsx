"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, PlusCircle, ArrowDownLeft, ArrowUpRight, 
  Phone, History, DollarSign, Loader2, Save, X, BookOpen, AlertCircle 
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Party = {
  id: string;
  name: string;
  phone: string | null;
  type: "customer" | "supplier";
  current_balance: number;
  created_at: string;
};

type LedgerEntry = {
  id: string;
  date: string;
  amount: number;
  type: "debit" | "credit"; // debit: increases customer balance (bill), credit: decreases customer balance (payment)
  source: "invoice" | "manual" | "system";
  remarks: string;
  runningBalance: number;
  edit_history?: any[];
  transaction_type?: string;
};

export default function KhataPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "customer" | "supplier">("all");

  // Ledger Filters & Pagination State
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<"all" | "debit" | "credit">("all");
  const [ledgerStartDate, setLedgerStartDate] = useState("");
  const [ledgerEndDate, setLedgerEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset pagination when party or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedParty, ledgerSearch, ledgerTypeFilter, ledgerStartDate, ledgerEndDate]);

  // Modals State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<"receive" | "pay">("receive"); // receive = customer pays us (reduces their balance), pay = we pay supplier (reduces our debt) or we refund
  
  // Forms State
  const [isSubmittingParty, setIsSubmittingParty] = useState(false);
  const [isSubmittingTx, setIsSubmittingTx] = useState(false);
  
  const [newParty, setNewParty] = useState({
    name: "",
    phone: "",
    type: "customer" as "customer" | "supplier",
    opening_balance: 0,
    address: "",
    note: ""
  });

  const [newTx, setNewTx] = useState({
    amount: 0,
    remarks: ""
  });

  // Edit Manual Transaction state
  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState(false);
  const [txToEdit, setTxToEdit] = useState<LedgerEntry | null>(null);
  const [editTxAmount, setEditTxAmount] = useState(0);
  const [editTxRemarks, setEditTxRemarks] = useState("");
  const [isSubmittingEditTx, setIsSubmittingEditTx] = useState(false);

  // Edit History Viewer Modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyTitle, setHistoryTitle] = useState("");

  useEffect(() => {
    if (shopId) {
      fetchParties();
    }
  }, [shopId]);

  useEffect(() => {
    if (selectedParty) {
      fetchLedger(selectedParty);
    }
  }, [selectedParty]);

  const fetchParties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .select("id, name, phone, type, current_balance, created_at")
        .eq("shop_id", shopId)
        .order("name", { ascending: true });

      if (error) throw error;
      setParties(data || []);
      if (data && data.length > 0 && !selectedParty) {
        setSelectedParty(data[0]);
      }
    } catch (err: any) {
      toast.error("Failed to load Khata Parties: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (party: Party) => {
    setLedgerLoading(true);
    try {
      // 1. Fetch Invoices for this party
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, created_at, total_amount, status, is_voided, edit_history")
        .eq("party_id", party.id);

      if (invoicesError) throw invoicesError;

      // 2. Fetch manual credit_transactions
      const { data: txs, error: txsError } = await supabase
        .from("credit_transactions")
        .select("id, created_at, amount, transaction_type, remarks, edit_history")
        .eq("customer_id", party.id);

      if (txsError) throw txsError;

      // 3. Union and map both datasets to a unified format
      const formattedInvoices: Omit<LedgerEntry, "runningBalance">[] = (invoices || [])
        .filter((inv: any) => !inv.is_voided)
        .map(inv => ({
          id: inv.id,
          date: inv.created_at,
          amount: Number(inv.total_amount),
          type: party.type === "customer" ? "debit" : "credit", // Customer bill is debit (they owe us more), Supplier bill is credit (we owe supplier more)
          source: "invoice",
          remarks: `Invoice Bill #${inv.id.slice(0, 8).toUpperCase()} (Status: ${inv.status})`,
          edit_history: inv.edit_history
        }));

      const formattedTxs: Omit<LedgerEntry, "runningBalance">[] = (txs || []).map(tx => {
        // Map transaction_type:
        // payment/receive -> reduces outstanding balance
        const isPayment = tx.transaction_type === "payment" || tx.transaction_type === "receive";
        return {
          id: tx.id,
          date: tx.created_at,
          amount: Number(tx.amount),
          type: isPayment 
            ? (party.type === "customer" ? "credit" : "debit") // Customer paying us reduces their balance (credit). We paying supplier reduces our balance (debit).
            : (party.type === "customer" ? "debit" : "credit"),
          source: "manual",
          remarks: tx.remarks || (isPayment ? "Cash Payment Received" : "Manual Adjustment"),
          edit_history: tx.edit_history,
          transaction_type: tx.transaction_type
        };
      });

      // Combine and sort by date ascending to calculate running balances chronologically
      const sortedAsc = [...formattedInvoices, ...formattedTxs].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Accumulate balances
      let currentBal = 0;
      const ledgerWithBalances = sortedAsc.map(entry => {
        if (party.type === "customer") {
          currentBal += entry.type === "debit" ? entry.amount : -entry.amount;
        } else {
          currentBal += entry.type === "credit" ? entry.amount : -entry.amount;
        }
        return {
          ...entry,
          runningBalance: currentBal
        } as LedgerEntry;
      });

      // Sort back to descending (newest first)
      const combined = ledgerWithBalances.reverse();

      setLedger(combined);
    } catch (err: any) {
      toast.error("Failed to load Ledger logs: " + err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleCreateParty = async () => {
    if (!newParty.name) {
      toast.error("Party Name is required.");
      return;
    }

    setIsSubmittingParty(true);
    try {
      const { data, error } = await supabase
        .from("parties")
        .insert({
          shop_id: shopId,
          name: newParty.name,
          phone: newParty.phone || null,
          type: newParty.type,
          current_balance: newParty.opening_balance,
          address: newParty.address || null,
          note: newParty.note || null
        })
        .select()
        .single();

      if (error) throw error;

      // If opening balance > 0, log an opening balance transaction
      if (newParty.opening_balance !== 0) {
        await supabase
          .from("credit_transactions")
          .insert({
            shop_id: shopId,
            customer_id: data.id,
            amount: Math.abs(newParty.opening_balance),
            transaction_type: newParty.opening_balance > 0 ? "charge" : "payment",
            remarks: "Opening Account Balance Entry"
          });
      }

      toast.success(`${newParty.type === 'customer' ? 'Customer' : 'Supplier'} added to Khata!`);
      setIsPartyModalOpen(false);
      setNewParty({ name: "", phone: "", type: "customer", opening_balance: 0, address: "", note: "" });
      
      // Reload parties list and set active
      fetchParties();
    } catch (err: any) {
      toast.error("Error creating party: " + err.message);
    } finally {
      setIsSubmittingParty(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!selectedParty || newTx.amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsSubmittingTx(false);
    try {
      const txType = txModalType === "receive" ? "receive" : "charge";
      const isCustomer = selectedParty.type === "customer";
      
      // Calculate net balance change:
      // Customer pay cash (receive) decreases their balance (credit)
      // Customer charges cash (pay) increases their balance (debit)
      // Supplier receive cash (we pay supplier) decreases our balance (debit)
      // Supplier charges cash (supplier refunds/credits us) increases our balance (credit)
      let balanceDiff = 0;
      if (isCustomer) {
        balanceDiff = txModalType === "receive" ? -newTx.amount : newTx.amount;
      } else {
        // Supplier
        balanceDiff = txModalType === "receive" ? -newTx.amount : newTx.amount;
      }

      // 1. Insert manual transaction log
      const { error: txError } = await supabase
        .from("credit_transactions")
        .insert({
          shop_id: shopId,
          customer_id: selectedParty.id,
          amount: newTx.amount,
          transaction_type: txModalType === "receive" ? "payment" : "charge",
          remarks: newTx.remarks || (txModalType === "receive" ? "Cash Received" : "Cash Disbursed/Refund")
        });

      if (txError) throw txError;

      // 2. Update Party balance
      const { error: balanceError } = await supabase
        .rpc("increment_party_balance", {
          p_id: selectedParty.id,
          amount: balanceDiff
        });

      if (balanceError) throw balanceError;

      toast.success("Transaction recorded successfully!");
      setIsTxModalOpen(false);
      setNewTx({ amount: 0, remarks: "" });

      // Refresh data
      const updatedParty = { 
        ...selectedParty, 
        current_balance: selectedParty.current_balance + balanceDiff 
      };
      setSelectedParty(updatedParty);
      
      // Refresh list
      fetchParties();
    } catch (err: any) {
      toast.error("Failed to post transaction: " + err.message);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  const handleDownloadPDF = async (downloadAll: boolean) => {
    if (!selectedParty) return;

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // Prepare data
      let exportData = downloadAll ? [...ledger] : [...filteredLedger];
      
      // Calculate opening balance for PDF
      if (!downloadAll && filteredLedger.length > 0 && filteredLedger.length < ledger.length) {
        const oldestVisibleEntry = filteredLedger[filteredLedger.length - 1];
        const oldestVisibleTime = new Date(oldestVisibleEntry.date).getTime();
        const olderEntries = ledger.filter(e => new Date(e.date).getTime() < oldestVisibleTime);

        if (olderEntries.length > 0) {
          const openingBalanceVal = olderEntries[0].runningBalance;
          const openingRow: LedgerEntry = {
            id: "opening-bal-forward-pdf",
            date: new Date(oldestVisibleTime - 1000).toISOString(), // 1 second older
            remarks: "Opening Balance (Balance Forward)",
            source: "system" as any,
            amount: 0,
            type: "debit",
            runningBalance: openingBalanceVal,
            edit_history: []
          };
          exportData.push(openingRow);
        }
      }

      // Sort chronologically (oldest first) so running balance flows correctly
      exportData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Business Info Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text(shopName || "HISAB X", 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("Business Account Ledger Statement", 15, 25);

      // Statement details
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("ACCOUNT STATEMENT", 130, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const todayStr = new Date().toLocaleString();
      doc.text(`Generated: ${todayStr}`, 130, 25);
      
      const rangeText = (ledgerStartDate || ledgerEndDate)
        ? `Period: ${ledgerStartDate || "Start"} to ${ledgerEndDate || "End"}`
        : "Period: Complete History";
      doc.text(rangeText, 130, 30);

      // Horizontal line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(15, 35, 195, 35);

      // Party Info Section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("PARTY DETAILS", 15, 43);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Name: ${selectedParty.name}`, 15, 49);
      doc.text(`Phone: ${selectedParty.phone || "N/A"}`, 15, 54);
      doc.text(`Type: ${selectedParty.type.toUpperCase()}`, 15, 59);

      // Financial Summary Block
      const exportDebits = exportData.filter(e => e.type === "debit").reduce((sum, e) => sum + e.amount, 0);
      const exportCredits = exportData.filter(e => e.type === "credit").reduce((sum, e) => sum + e.amount, 0);
      const closingBal = exportData.length > 0 ? exportData[exportData.length - 1].runningBalance : 0;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("STATEMENT SUMMARY", 120, 43);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total Debits (+): Rs ${exportDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 120, 49);
      doc.text(`Total Credits (-): Rs ${exportCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 120, 54);
      
      doc.setFont("helvetica", "bold");
      // Emerald if customer receivable (>0) or supplier payable (>0), else red/slate
      const isRed = (selectedParty.type === "customer" && closingBal < 0) || (selectedParty.type === "supplier" && closingBal > 0);
      if (isRed) {
        doc.setTextColor(220, 38, 38); // Red 600
      } else if (closingBal !== 0) {
        doc.setTextColor(5, 150, 105); // Emerald 600
      } else {
        doc.setTextColor(71, 85, 105); // Slate 600
      }
      doc.text(`Closing Balance: Rs ${Math.abs(closingBal).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${
        closingBal > 0 
          ? (selectedParty.type === "customer" ? "(Receivable)" : "(Payable)")
          : closingBal < 0
            ? (selectedParty.type === "customer" ? "(Payable)" : "(Receivable)")
            : "(Balanced)"
      }`, 120, 60);

      // Generate AutoTable
      const headers = [["Date", "Details / Remarks", "Source", "Debit (+)", "Credit (-)", "Balance"]];
      const tableRows = exportData.map(entry => [
        new Date(entry.date).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        entry.remarks,
        entry.source.toUpperCase(),
        entry.type === "debit" && entry.amount > 0 ? `+Rs ${entry.amount.toFixed(2)}` : "",
        entry.type === "credit" && entry.amount > 0 ? `-Rs ${entry.amount.toFixed(2)}` : "",
        `Rs ${entry.runningBalance.toFixed(2)}`
      ]);

      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: 68,
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59], // Slate 800
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: "bold",
          halign: "left"
        },
        columnStyles: {
          0: { cellWidth: 35 }, // Date
          1: { cellWidth: 55 }, // Details
          2: { cellWidth: 20 }, // Source
          3: { cellWidth: 25, halign: "right" }, // Debit
          4: { cellWidth: 25, halign: "right" }, // Credit
          5: { cellWidth: 30, halign: "right" }  // Balance
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252] // Slate 50
        },
        didParseCell: (data) => {
          // Right align headers for columns 3, 4, 5
          if (data.column.index >= 3 && data.cell.section === "head") {
            data.cell.styles.halign = "right";
          }
          // Highlight Debit and Credit cell text colors
          if (data.cell.section === "body") {
            if (data.column.index === 3 && data.cell.text[0]) {
              data.cell.styles.textColor = [220, 38, 38]; // Red 600
              data.cell.styles.fontStyle = "bold";
            }
            if (data.column.index === 4 && data.cell.text[0]) {
              data.cell.styles.textColor = [5, 150, 105]; // Emerald 600
              data.cell.styles.fontStyle = "bold";
            }
            if (data.column.index === 5) {
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      });

      // Save PDF
      const cleanName = selectedParty.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const scopeLabel = downloadAll ? "full" : "filtered";
      doc.save(`ledger_${cleanName}_${scopeLabel}.pdf`);
      toast.success(`Ledger statement downloaded!`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF: " + err.message);
    }
  };

  const handleEditTransaction = async () => {
    if (!selectedParty || !txToEdit || editTxAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setIsSubmittingEditTx(true);
    try {
      const oldAmount = txToEdit.amount;
      const newAmount = editTxAmount;
      const newRemarks = editTxRemarks;
      const txId = txToEdit.id;

      // 1. Fetch old transaction details for edit history
      const { data: oldTx, error: fetchTxErr } = await supabase
        .from("credit_transactions")
        .select("amount, remarks, transaction_type, edit_history")
        .eq("id", txId)
        .single();

      if (fetchTxErr) throw fetchTxErr;

      const isPayment = oldTx.transaction_type === "payment" || oldTx.transaction_type === "receive";

      // Calculate net balance change:
      // payment/receive -> reduces outstanding balance. So increase in payment decreases customer balance. balanceDiff = oldAmount - newAmount
      // charge -> increases outstanding balance. So increase in charge increases customer balance. balanceDiff = newAmount - oldAmount
      let balanceDiff = 0;
      if (isPayment) {
        balanceDiff = oldAmount - newAmount;
      } else {
        balanceDiff = newAmount - oldAmount;
      }

      // 2. Append to edit history
      const newHistoryEntry = {
        amount: Number(oldTx.amount),
        remarks: oldTx.remarks || "",
        transaction_type: oldTx.transaction_type,
        edited_at: new Date().toISOString()
      };

      const oldHistory = Array.isArray(oldTx.edit_history) ? oldTx.edit_history : [];
      const updatedHistory = [newHistoryEntry, ...oldHistory];

      // 3. Update transaction record
      const { error: updateTxErr } = await supabase
        .from("credit_transactions")
        .update({
          amount: newAmount,
          remarks: newRemarks,
          edit_history: updatedHistory
        })
        .eq("id", txId);

      if (updateTxErr) throw updateTxErr;

      // 4. Update Party current balance
      const { error: balanceError } = await supabase
        .rpc("increment_party_balance", {
          p_id: selectedParty.id,
          amount: balanceDiff
        });

      if (balanceError) throw balanceError;

      toast.success("Transaction updated successfully!");
      setIsEditTxModalOpen(false);
      setTxToEdit(null);

      // Refresh party balance in state
      const updatedParty = {
        ...selectedParty,
        current_balance: selectedParty.current_balance + balanceDiff
      };
      setSelectedParty(updatedParty);

      // Refresh lists
      fetchParties();
      fetchLedger(updatedParty);
    } catch (err: any) {
      toast.error("Failed to edit transaction: " + err.message);
    } finally {
      setIsSubmittingEditTx(false);
    }
  };

  const handleShowEditHistory = (entry: LedgerEntry) => {
    const history = entry.edit_history || [];
    setHistoryItems(history);
    
    if (entry.source === "invoice") {
      setHistoryTitle(`Bill Edit History: #${entry.id.slice(0, 8).toUpperCase()}`);
    } else {
      setHistoryTitle(`Transaction Edit History`);
    }
    
    setIsHistoryModalOpen(true);
  };

  const handleOpenEditTxModal = (entry: LedgerEntry) => {
    setTxToEdit(entry);
    setEditTxAmount(entry.amount);
    setEditTxRemarks(entry.remarks);
    setIsEditTxModalOpen(true);
  };

  // Filter parties based on search query and type filters
  const filteredParties = parties.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.phone && p.phone.includes(searchQuery));
    const matchesType = filterType === "all" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  // Calculate totals
  const totalReceivable = parties
    .filter(p => p.type === "customer" && p.current_balance > 0)
    .reduce((acc, p) => acc + p.current_balance, 0);

  const totalPayable = parties
    .filter(p => p.type === "supplier" && p.current_balance > 0)
    .reduce((acc, p) => acc + p.current_balance, 0);

  // Memoized Filtered Ledger History
  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => {
      // 1. Search Query
      const matchesSearch = 
        entry.remarks.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        entry.source.toLowerCase().includes(ledgerSearch.toLowerCase());

      // 2. Type Filter
      const matchesType = ledgerTypeFilter === "all" || entry.type === ledgerTypeFilter;

      // 3. Date Filter
      let matchesDate = true;
      if (ledgerStartDate || ledgerEndDate) {
        const entryDate = new Date(entry.date);
        if (ledgerStartDate) {
          const start = new Date(ledgerStartDate);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && entryDate >= start;
        }
        if (ledgerEndDate) {
          const end = new Date(ledgerEndDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && entryDate <= end;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [ledger, ledgerSearch, ledgerTypeFilter, ledgerStartDate, ledgerEndDate]);

  // Memoized visible ledger entries, including prepended opening balance / balance forward if filtered
  const visibleLedgerList = useMemo(() => {
    if (filteredLedger.length === 0) return [];
    if (filteredLedger.length === ledger.length) return filteredLedger; // No filters active or all entries match

    // Find the oldest visible entry in filteredLedger
    // Since filteredLedger is sorted descending (newest first), the last entry is the oldest visible.
    const oldestVisibleEntry = filteredLedger[filteredLedger.length - 1];
    
    // Find all entries in ledger that are chronologically older than oldestVisibleEntry
    const oldestVisibleTime = new Date(oldestVisibleEntry.date).getTime();
    const olderEntries = ledger.filter(e => new Date(e.date).getTime() < oldestVisibleTime);

    if (olderEntries.length > 0) {
      // The newest of these older entries represents the running balance right before the filtered period
      // Since ledger is sorted descending, the olderEntries will also be sorted descending.
      // So olderEntries[0] is the newest of the older entries.
      const openingBalanceVal = olderEntries[0].runningBalance;

      // Construct opening balance row
      const openingRow: LedgerEntry = {
        id: "opening-bal-forward",
        date: oldestVisibleEntry.date, // Use same date
        remarks: "Opening Balance (Balance Forward)",
        source: "system" as any, 
        amount: 0,
        type: "debit",
        runningBalance: openingBalanceVal,
        edit_history: []
      };

      // Append opening balance row to the end of descending filteredLedger list
      // (so it renders at the bottom of the table, as the oldest entry!)
      return [...filteredLedger, openingRow];
    }

    return filteredLedger;
  }, [ledger, filteredLedger]);

  // Paginated Ledger History
  const totalPages = Math.ceil(visibleLedgerList.length / itemsPerPage);
  const paginatedLedger = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return visibleLedgerList.slice(startIdx, startIdx + itemsPerPage);
  }, [visibleLedgerList, currentPage]);

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)] overflow-hidden -m-2 print:hidden">
      
      {/* Left List Pane: Parties */}
      <div className="w-full lg:w-80 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden shrink-0">
        
        {/* Ledger Summary Card */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-emerald-600 uppercase block">Receivable (Miliga)</span>
            <span className="text-sm font-black text-emerald-800">Rs {totalReceivable.toLocaleString()}</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
            <span className="text-[10px] font-bold text-rose-600 uppercase block">Payable (Dena Ha)</span>
            <span className="text-sm font-black text-rose-800">Rs {totalPayable.toLocaleString()}</span>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs mb-3">
          {(["all", "customer", "supplier"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`flex-1 py-1.5 rounded font-bold capitalize transition-colors ${
                filterType === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab === "all" ? "All Khata" : tab + "s"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input 
            placeholder="Search party by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-slate-50 border-slate-200 text-sm"
          />
        </div>

        {/* Add Party Button */}
        <Button onClick={() => setIsPartyModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 mb-4 shadow-sm shadow-blue-200 w-full">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Khata Party
        </Button>

        {/* Parties List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center items-center py-10 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-sm">Loading ledger...</span>
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No Khata ledger entries found
            </div>
          ) : (
            filteredParties.map(party => (
              <div
                key={party.id}
                onClick={() => setSelectedParty(party)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedParty?.id === party.id
                    ? "bg-blue-50/50 border-blue-300 shadow-sm"
                    : "bg-slate-50/50 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-snug">{party.name}</h4>
                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 uppercase ${
                      party.type === "customer" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {party.type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black ${
                      party.current_balance > 0 
                        ? (party.type === "customer" ? "text-emerald-600" : "text-rose-600")
                        : "text-slate-400"
                    }`}>
                      Rs {Math.abs(party.current_balance).toLocaleString()}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {party.current_balance > 0 
                        ? (party.type === "customer" ? "Receivable" : "Payable")
                        : "Balanced"
                      }
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Ledger History & Account Statements */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {selectedParty ? (
          <>
            {/* Header info */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="text-blue-600" /> {selectedParty.name}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500 text-xs mt-1.5">
                  {selectedParty.phone && (
                    <span className="flex items-center gap-1"><Phone size={12} /> {selectedParty.phone}</span>
                  )}
                  <span>Created: {new Date(selectedParty.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Transactions actions */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => { setTxModalType("receive"); setIsTxModalOpen(true); }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-sm shadow-emerald-100"
                >
                  <ArrowDownLeft className="mr-1.5 h-4 w-4" /> 
                  {selectedParty.type === "customer" ? "Cash Receive (+)" : "Refund/Receipt (-)"}
                </Button>
                <Button 
                  onClick={() => { setTxModalType("pay"); setIsTxModalOpen(true); }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 shadow-sm shadow-rose-100"
                >
                  <ArrowUpRight className="mr-1.5 h-4 w-4" /> 
                  {selectedParty.type === "customer" ? "Cash Give (-)" : "We Pay Supplier (+)"}
                </Button>
              </div>
            </div>

            {/* Current Balance Tracker */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Current Account Balance</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Net Status:</span>
                <span className={`text-base font-black px-3 py-1 rounded-full ${
                  selectedParty.current_balance > 0 
                    ? (selectedParty.type === "customer" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
                    : "bg-slate-100 text-slate-700"
                }`}>
                  Rs {Math.abs(selectedParty.current_balance).toLocaleString()} {
                    selectedParty.current_balance > 0 
                      ? (selectedParty.type === "customer" ? "(Receivable)" : "(Payable)")
                      : "(Settled)"
                  }
                </span>
              </div>
            </div>

            {/* Ledger Filters & Download Bar */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {/* Search */}
                <div className="relative w-full sm:w-45">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                  <Input
                    placeholder="Search logs by remark/source..."
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="pl-8 h-8 text-[11px] bg-white border-slate-200"
                  />
                </div>

                {/* Type Filter */}
                <select
                  value={ledgerTypeFilter}
                  onChange={(e: any) => setLedgerTypeFilter(e.target.value)}
                  className="bg-white border border-slate-200 h-8 rounded-lg px-2 text-[11px] text-slate-650 font-semibold cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="debit">Debits (+)</option>
                  <option value="credit">Credits (-)</option>
                </select>

                {/* Date range pickers */}
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={ledgerStartDate}
                    onChange={(e) => setLedgerStartDate(e.target.value)}
                    className="h-8 text-[11px] border-slate-200 w-28 bg-white"
                  />
                  <span className="text-slate-400">to</span>
                  <Input
                    type="date"
                    value={ledgerEndDate}
                    onChange={(e) => setLedgerEndDate(e.target.value)}
                    className="h-8 text-[11px] border-slate-200 w-28 bg-white"
                  />
                </div>

                {/* Clear filters if any active */}
                {(ledgerSearch || ledgerTypeFilter !== "all" || ledgerStartDate || ledgerEndDate) && (
                  <button
                    onClick={() => {
                      setLedgerSearch("");
                      setLedgerTypeFilter("all");
                      setLedgerStartDate("");
                      setLedgerEndDate("");
                    }}
                    className="text-[10px] text-red-500 hover:text-red-750 font-bold"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* PDF Download Options */}
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={() => handleDownloadPDF(false)}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] h-8 px-3 rounded-lg shadow-sm"
                >
                  Download Filtered PDF
                </Button>
                <Button
                  onClick={() => handleDownloadPDF(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] h-8 px-3 rounded-lg shadow-sm"
                >
                  Download Complete PDF
                </Button>
              </div>
            </div>

             {/* Ledger logs */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {ledgerLoading ? (
                <div className="h-full flex flex-col justify-center items-center py-20 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2 text-blue-550" />
                  <p>Loading ledger entries...</p>
                </div>
              ) : visibleLedgerList.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-slate-400 py-10">
                  <History size={40} className="text-slate-200 mb-2" />
                  <p className="text-sm font-medium">No ledger entries match current filters.</p>
                  <p className="text-xs text-slate-400 mt-1">Adjust search queries or date ranges above.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Details / Remarks</th>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3 text-right">Debit (+)</th>
                          <th className="px-4 py-3 text-right">Credit (-)</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                          <th className="px-4 py-3 text-center print:hidden">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-xs">
                        {paginatedLedger.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-500">
                              {new Date(entry.date).toLocaleString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </td>
                            <td className="px-4 py-3 font-sans font-medium text-slate-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{entry.remarks}</span>
                                {entry.edit_history && entry.edit_history.length > 0 && (
                                  <button
                                    onClick={() => handleShowEditHistory(entry)}
                                    className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-sm"
                                  >
                                    Edited
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-sans">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-bold capitalize ${
                                entry.source === "invoice" 
                                  ? "bg-blue-50 text-blue-700 border border-blue-100" 
                                  : entry.source === "system"
                                    ? "bg-purple-50 text-purple-700 border border-purple-100"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}>
                                {entry.source}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-rose-600">
                              {entry.type === "debit" && entry.amount > 0 ? `+Rs ${entry.amount.toFixed(2)}` : ""}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                              {entry.type === "credit" && entry.amount > 0 ? `-Rs ${entry.amount.toFixed(2)}` : ""}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-750">
                              Rs {entry.runningBalance.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center print:hidden font-sans">
                              {entry.source === "manual" && entry.id !== "opening-bal-forward" && (
                                <button
                                  onClick={() => handleOpenEditTxModal(entry)}
                                  className="text-blue-600 hover:text-blue-800 font-bold hover:underline text-[11px] cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 py-1 bg-transparent">
                      <span>Showing {paginatedLedger.length} of {visibleLedgerList.length} entries</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-650 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                        >
                          Previous
                        </button>
                        <span className="text-slate-700">Page {currentPage} of {totalPages}</span>
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-650 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center text-slate-400 py-10">
            <Users size={60} className="text-slate-200 mb-2" />
            <p className="text-base font-bold">No Account Selected</p>
            <p className="text-xs text-slate-400 mt-1">Please select a party from the sidebar to view ledger history.</p>
          </div>
        )}
      </div>

      {/* Modal: Create Party */}
      <AnimatePresence>
        {isPartyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsPartyModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">Add Khata Party</h3>
                <button onClick={() => setIsPartyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Party Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["customer", "supplier"] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewParty({...newParty, type})}
                        className={`py-2 rounded-lg text-xs font-bold capitalize transition-all border ${
                          newParty.type === type
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                  <Input 
                    placeholder="Party Name" 
                    value={newParty.name}
                    onChange={(e) => setNewParty({...newParty, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number (Optional)</label>
                  <Input 
                    placeholder="e.g. 03001234567" 
                    value={newParty.phone}
                    onChange={(e) => setNewParty({...newParty, phone: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Opening Balance (Rs)</label>
                  <Input 
                    type="number"
                    placeholder="0" 
                    value={newParty.opening_balance || ""}
                    onChange={(e) => setNewParty({...newParty, opening_balance: parseFloat(e.target.value) || 0})}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Positive means they owe us, negative means we owe them.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Address (Optional)</label>
                  <Input 
                    placeholder="Physical address" 
                    value={newParty.address}
                    onChange={(e) => setNewParty({...newParty, address: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Remarks / Note (Optional)</label>
                  <Input 
                    placeholder="Special comments or remarks" 
                    value={newParty.note}
                    onChange={(e) => setNewParty({...newParty, note: e.target.value})}
                  />
                </div>

                <Button onClick={handleCreateParty} disabled={isSubmittingParty} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-md shadow-blue-200">
                  {isSubmittingParty ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Account
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Add Manual Transaction */}
      <AnimatePresence>
        {isTxModalOpen && selectedParty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsTxModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    {txModalType === "receive" 
                      ? (selectedParty.type === "customer" ? "Receive Cash Payment" : "Supplier Refund Received")
                      : (selectedParty.type === "customer" ? "Refund Cash / Disburse" : "Pay Cash to Supplier")
                    }
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Account: {selectedParty.name}</p>
                </div>
                <button onClick={() => setIsTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Amount (Rs)</label>
                  <Input 
                    type="number"
                    placeholder="Enter amount..." 
                    value={newTx.amount || ""}
                    onChange={(e) => setNewTx({...newTx, amount: Math.max(0, parseFloat(e.target.value) || 0)})}
                    className="text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Remarks / Note</label>
                  <Input 
                    placeholder="e.g. Cash received in drawer, Bank transfer reference" 
                    value={newTx.remarks}
                    onChange={(e) => setNewTx({...newTx, remarks: e.target.value})}
                  />
                </div>

                {txModalType === "receive" ? (
                  <Button onClick={handleCreateTransaction} disabled={isSubmittingTx} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11">
                    {isSubmittingTx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownLeft size={16} className="mr-2" />}
                    Confirm Cash Receipt
                  </Button>
                ) : (
                  <Button onClick={handleCreateTransaction} disabled={isSubmittingTx} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-11">
                    {isSubmittingTx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight size={16} className="mr-2" />}
                    Confirm Cash Disbursal
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit Manual Transaction */}
      <AnimatePresence>
        {isEditTxModalOpen && txToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsEditTxModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative z-10 font-sans"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Edit Transaction</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Account: {selectedParty?.name}</p>
                </div>
                <button onClick={() => setIsEditTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Amount (Rs)</label>
                  <Input 
                    type="number"
                    placeholder="Enter amount..." 
                    value={editTxAmount || ""}
                    onChange={(e) => setEditTxAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Remarks / Note</label>
                  <Input 
                    placeholder="Remarks" 
                    value={editTxRemarks}
                    onChange={(e) => setEditTxRemarks(e.target.value)}
                  />
                </div>

                <Button onClick={handleEditTransaction} disabled={isSubmittingEditTx} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11">
                  {isSubmittingEditTx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Edit History Viewer */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsHistoryModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg relative z-10 font-sans max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4 border-b pb-3 shrink-0">
                <h3 className="font-bold text-slate-800 text-lg">{historyTitle}</h3>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar py-2 text-slate-650">
                {historyItems.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 text-xs">No edit history found.</p>
                ) : (
                  historyItems.map((hist, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Version #{historyItems.length - idx}</span>
                        <span>{new Date(hist.edited_at).toLocaleString()}</span>
                      </div>

                      {/* Manual Entry History */}
                      {hist.amount !== undefined ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount</span>
                            <span className="text-sm font-bold text-slate-800">Rs {hist.amount.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Remarks</span>
                            <span className="text-sm text-slate-800">{hist.remarks || "No remarks"}</span>
                          </div>
                        </div>
                      ) : (
                        /* Invoice/Bill History */
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total</span>
                              <span className="font-bold text-slate-800">Rs {hist.total_amount.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Paid Now</span>
                              <span className="font-bold text-emerald-600">Rs {(hist.paid_amount || 0).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Discount</span>
                              <span className="font-bold text-rose-600">Rs {(hist.discount || 0).toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Bill Items</span>
                            <table className="w-full text-left text-[11px] font-mono">
                              <thead>
                                <tr className="text-slate-400 border-b">
                                  <th className="py-1">Item Name</th>
                                  <th className="py-1 text-center">Qty</th>
                                  <th className="py-1 text-right">Price</th>
                                  <th className="py-1 text-right">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hist.items?.map((item: any, i: number) => (
                                  <tr key={i} className="text-slate-650 border-b border-slate-100 last:border-b-0">
                                    <td className="py-1 font-sans">{item.product_name}</td>
                                    <td className="py-1 text-center">{item.quantity}</td>
                                    <td className="py-1 text-right font-bold">Rs {item.unit_price.toFixed(2)}</td>
                                    <td className="py-1 text-right font-bold">Rs {item.subtotal.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
