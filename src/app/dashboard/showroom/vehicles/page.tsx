"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car,
  Search,
  PlusCircle,
  Trash2,
  Edit,
  Loader2,
  X,
  AlertTriangle,
  FileCheck,
  Banknote,
  Camera,
  Upload,
  CreditCard,
  Building2,
  User,
  Phone,
  ShieldCheck,
  Calendar,
  Share2,
  Printer,
  SlidersHorizontal,
  DollarSign,
  Tag,
  CheckCircle2,
  Sparkles,
  Landmark,
  Scale,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import type {
  ShowroomVehicle,
  ShowroomParty,
  ShowroomInvestor,
  InvestorShareType,
  VehiclePurpose,
  VehicleStatus,
  DocumentStatus,
} from "@/lib/showroom-ops";
import {
  vehicleLabel,
  formatPKR,
  formatInvestorShareBadge,
  formatDocumentStatusBadge,
  DOCUMENT_STATUS_CONFIG,
  loadShowroomOfflineEntities,
  executeShowroomAction,
  isShowroomOffline,
} from "@/lib/showroom-ops";
import { uploadToShowroomDrive } from "@/lib/showroom-media-uploader";
import { ShowroomDeedPrintModal } from "@/components/showroom/ShowroomDeedPrintModal";
import { ShowroomOfflineBar } from "@/components/showroom/ShowroomOfflineBar";
import { autoPostVehiclePurchaseJournal, autoPostVehicleSaleJournal } from "@/lib/showroom-accounting";
import { ShowroomCapitalFloatWizard } from "@/components/showroom/ShowroomCapitalFloatWizard";
import { Coins } from "lucide-react";

const EXPIRY_WARN_DAYS = 30;

function daysDiff(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}

interface CashAccountItem {
  id: string;
  name: string;
  type?: string | null;
  current_balance?: number | null;
}

const emptyVehicleForm = {
  vehicle_type: "car" as "car" | "bike" | "commercial",
  make: "",
  model: "",
  year: new Date().getFullYear().toString(),
  plate_number: "",
  is_applied_for: false,
  chassis_number: "",
  engine_number: "",
  color: "",
  engine_cc: null as number | null,
  
  // Document Custody & Status
  document_status: "in_showroom" as DocumentStatus,
  document_location: "",
  document_notes: "",
  document_checklist: {
    file_complete: false,
    smart_card: false,
    original_book: false,
    return_file: false,
    biometric_letter: false,
  },
  
  // Purchase & Sourcing
  purchase_party_id: "" as string,
  purchase_cost: 0,
  purchase_paid_amount: 0,
  purchase_remaining_amount: 0,
  purchase_date: new Date().toISOString().split("T")[0],
  purchase_payment_mode: "cash" as "cash" | "bank" | "credit" | "partial",
  purchase_account_id: "" as string,
  
  // Investor Co-funding
  is_investor_funded: false,
  investor_id: "",
  investor_share_type: "profit_only" as InvestorShareType,
  investor_share_value: 50,
  investor_investment_amount: 0,
  
  // Prices
  price: 0,
  cash_price: 0,
  installment_price: 0,
  daily_rental_rate: 0,
  
  status: "available" as VehicleStatus,
  purpose: "sale" as VehiclePurpose,
  
  // Photos & Docs
  photos: [] as string[],
  documents: [] as { name: string; url: string }[],
  
  tracker_installed: false,
  tracker_company: "",
  notes: "",
  excise_token_expiry: null as string | null,
  insurance_expiry: null as string | null,
  fitness_expiry: null as string | null,
  route_permit_expiry: null as string | null,
};

export default function ShowroomVehiclesPage() {
  const { shopId, shopName, shopPhone, shopAddress } = useShop();
  const supabase = createClient();

  const [vehicles, setVehicles] = useState<ShowroomVehicle[]>([]);
  const [parties, setParties] = useState<ShowroomParty[]>([]);
  const [investors, setInvestors] = useState<ShowroomInvestor[]>([]);
  const [accounts, setAccounts] = useState<CashAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [docFilter, setDocFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<ShowroomVehicle | null>(null);
  const [formData, setFormData] = useState(emptyVehicleForm);

  // Cash Sale Modal
  const [isCashSaleOpen, setIsCashSaleOpen] = useState(false);
  const [selectedVehicleForSale, setSelectedVehicleForSale] = useState<ShowroomVehicle | null>(null);
  const [cashSaleForm, setCashSaleForm] = useState({
    buyer_party_id: "",
    buyer_name: "",
    buyer_phone: "",
    buyer_cnic: "",
    sold_price: 0,
    sold_date: new Date().toISOString().split("T")[0],
    bill_no: "",
    manual_book_no: "",
    manual_receipt_no: "",
    witness_name: "",
    witness_phone: "",
    witness_cnic: "",
  });

  // Print Deed Modal
  const [isDeedModalOpen, setIsDeedModalOpen] = useState(false);
  const [deedTargetVehicle, setDeedTargetVehicle] = useState<ShowroomVehicle | null>(null);

  // Capital Float Wizard Modal
  const [isCapitalWizardOpen, setIsCapitalWizardOpen] = useState(false);
  const totalCashInHand = accounts.reduce((s, a) => s + (Number(a.current_balance) || 0), 0);

  // Photo / Document uploading states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const fetchVehiclesAndParties = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const [offVehicles, offParties, offAccounts, offInvestors] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
          loadShowroomOfflineEntities<ShowroomInvestor>("showroom_investors", shopId),
        ]);
        setVehicles(offVehicles);
        setParties(offParties);
        setAccounts(offAccounts);
        setInvestors(offInvestors);
        setLoading(false);
        return;
      }

      const [vRes, pRes, aRes, invRes] = await Promise.all([
        supabase
          .from("showroom_vehicles")
          .select("*")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
        supabase
          .from("showroom_parties")
          .select("*")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("cash_accounts")
          .select("id, name, type, current_balance")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
        supabase
          .from("showroom_investors")
          .select("*")
          .eq("shop_id", shopId)
          .order("name", { ascending: true }),
      ]);

      if (vRes.data) {
        setVehicles((vRes.data as ShowroomVehicle[]) || []);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_vehicles", (vRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (pRes.data) {
        setParties((pRes.data as ShowroomParty[]) || []);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_parties", (pRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (invRes.data) {
        setInvestors((invRes.data as ShowroomInvestor[]) || []);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_investors", (invRes.data as any[]).map((r: any) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
      if (aRes.data) {
        setAccounts(aRes.data as CashAccountItem[]);
      }
    } catch (err: any) {
      // Fallback to IndexedDB on network drop
      try {
        const [offVehicles, offParties, offAccounts, offInvestors] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId),
          loadShowroomOfflineEntities<CashAccountItem>("cash_accounts", shopId),
          loadShowroomOfflineEntities<ShowroomInvestor>("showroom_investors", shopId),
        ]);
        if (offVehicles.length > 0 || offParties.length > 0) {
          setVehicles(offVehicles);
          setParties(offParties);
          setAccounts(offAccounts);
          setInvestors(offInvestors);
        } else {
          toast.error(err.message || "Failed to load vehicles");
        }
      } catch {
        toast.error(err.message || "Failed to load vehicles");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehiclesAndParties();
  }, [shopId]);

  const handleOpenAddModal = () => {
    setEditingVehicle(null);
    setFormData({
      ...emptyVehicleForm,
      purchase_account_id: accounts[0]?.id || "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: ShowroomVehicle) => {
    setEditingVehicle(v);
    setFormData({
      vehicle_type: v.vehicle_type || "car",
      make: v.make || "",
      model: v.model || "",
      year: v.year ? String(v.year) : "",
      plate_number: v.plate_number || "",
      is_applied_for: v.is_applied_for || false,
      chassis_number: v.chassis_number || "",
      engine_number: v.engine_number || "",
      color: v.color || "",
      engine_cc: v.engine_cc || null,
      
      // Document Custody & Status
      document_status: (v.document_status as DocumentStatus) || "in_showroom",
      document_location: v.document_location || "",
      document_notes: v.document_notes || "",
      document_checklist: {
        file_complete: Boolean(v.document_checklist?.file_complete),
        smart_card: Boolean(v.document_checklist?.smart_card),
        original_book: Boolean(v.document_checklist?.original_book),
        return_file: Boolean(v.document_checklist?.return_file),
        biometric_letter: Boolean(v.document_checklist?.biometric_letter),
      },

      purchase_party_id: v.purchase_party_id || "",
      purchase_cost: Number(v.purchase_cost) || 0,
      purchase_paid_amount: Number(v.purchase_paid_amount ?? (v.purchase_payment_mode === "credit" ? 0 : v.purchase_cost)) || 0,
      purchase_remaining_amount: Number(v.purchase_remaining_amount ?? (v.purchase_payment_mode === "credit" ? v.purchase_cost : Math.max(0, Number(v.purchase_cost || 0) - Number(v.purchase_paid_amount || 0)))) || 0,
      purchase_date: v.purchase_date || new Date().toISOString().split("T")[0],
      purchase_payment_mode: v.purchase_payment_mode || "cash",
      purchase_account_id: accounts[0]?.id || "",
      is_investor_funded: Boolean(v.investor_id),
      investor_id: v.investor_id || "",
      investor_share_type: v.investor_share_type || "profit_only",
      investor_share_value: Number(v.investor_share_value ?? 50),
      investor_investment_amount: Number(v.investor_investment_amount || 0),
      price: Number(v.price) || 0,
      cash_price: Number(v.cash_price || v.price) || 0,
      installment_price: Number(v.installment_price) || 0,
      daily_rental_rate: Number(v.daily_rental_rate) || 0,
      status: v.status || "available",
      purpose: v.purpose || "sale",
      photos: Array.isArray(v.photos) ? v.photos : [],
      documents: Array.isArray(v.documents) ? v.documents : [],
      tracker_installed: v.tracker_installed || false,
      tracker_company: v.tracker_company || "",
      notes: v.notes || "",
      excise_token_expiry: v.excise_token_expiry || null,
      insurance_expiry: v.insurance_expiry || null,
      fitness_expiry: v.fitness_expiry || null,
      route_permit_expiry: v.route_permit_expiry || null,
    });
    setIsModalOpen(true);
  };

  // Upload vehicle photo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setUploadingPhoto(true);
    const toastId = toast.loading("Compressing & uploading photo to Drive...");
    try {
      const itemTitle = `${formData.make}_${formData.model}_${formData.plate_number || "Veh"}`;
      const res = await uploadToShowroomDrive(shopId, file, "Vehicles", itemTitle);
      if (res.url) {
        setFormData((prev) => ({ ...prev, photos: [...prev.photos, res.url] }));
        toast.success("Photo uploaded to vehicle folder!", { id: toastId });
      } else {
        toast.error("Upload failed: " + (res.error || "Unknown error"), { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Upload vehicle doc (PDF or registration image)
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setUploadingDoc(true);
    const toastId = toast.loading("Uploading vehicle document scan...");
    try {
      const itemTitle = `${formData.make}_${formData.model}_${formData.plate_number || "Veh"}`;
      const res = await uploadToShowroomDrive(shopId, file, "Documents", `${itemTitle}_${file.name}`);
      if (res.url) {
        setFormData((prev) => ({
          ...prev,
          documents: [...prev.documents, { name: file.name, url: res.url }],
        }));
        toast.success("Document attached successfully!", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    if (!formData.make.trim() || !formData.model.trim()) {
      toast.error("Vehicle make and model are required");
      return;
    }

    setIsSaving(true);
    try {
      const cost = Number(formData.purchase_cost) || 0;
      let paidAmt = cost;
      let remAmt = 0;
      if (formData.purchase_payment_mode === "credit") {
        paidAmt = 0;
        remAmt = cost;
      } else if (formData.purchase_payment_mode === "partial") {
        paidAmt = Math.min(cost, Math.max(0, Number(formData.purchase_paid_amount) || 0));
        remAmt = Math.max(0, cost - paidAmt);
      }

      const payload: Record<string, any> = {
        shop_id: shopId,
        vehicle_type: formData.vehicle_type,
        make: formData.make.trim(),
        model: formData.model.trim(),
        year: formData.year ? String(formData.year).trim() : null,
        plate_number: formData.is_applied_for ? "Applied For" : formData.plate_number.trim() || null,
        is_applied_for: formData.is_applied_for,
        chassis_number: formData.chassis_number.trim() || null,
        engine_number: formData.engine_number.trim() || null,
        color: formData.color.trim() || null,
        engine_cc: Number(formData.engine_cc) || null,
        
        // Document Custody & Status
        document_status: formData.document_status || "in_showroom",
        document_location: formData.document_location.trim() || null,
        document_notes: formData.document_notes.trim() || null,
        document_checklist: formData.document_checklist || {},

        purchase_party_id: formData.purchase_party_id || null,
        purchase_cost: cost,
        purchase_paid_amount: paidAmt,
        purchase_remaining_amount: remAmt,
        purchase_date: formData.purchase_date || null,
        purchase_payment_mode: formData.purchase_payment_mode,
        price: Number(formData.cash_price || formData.price) || 0,
        cash_price: Number(formData.cash_price || formData.price) || 0,
        installment_price: Number(formData.installment_price) || 0,
        daily_rental_rate: Number(formData.daily_rental_rate) || 0,
        status: formData.status,
        purpose: formData.purpose,
        photos: formData.photos,
        documents: formData.documents,
        tracker_installed: formData.tracker_installed,
        tracker_company: formData.tracker_company.trim() || null,
        notes: formData.notes.trim() || null,
        excise_token_expiry: formData.excise_token_expiry || null,
        insurance_expiry: formData.insurance_expiry || null,
        fitness_expiry: formData.fitness_expiry || null,
        route_permit_expiry: formData.route_permit_expiry || null,
        investor_id: formData.is_investor_funded ? formData.investor_id || null : null,
        investor_share_type: formData.is_investor_funded ? formData.investor_share_type : null,
        investor_share_value: formData.is_investor_funded ? Number(formData.investor_share_value || 0) : null,
        investor_investment_amount: formData.is_investor_funded ? Number(formData.investor_investment_amount || 0) : null,
      };

      if (editingVehicle) {
        await executeShowroomAction({
          shopId,
          action: "UPDATE",
          tableName: "showroom_vehicles",
          payload: { ...payload, id: editingVehicle.id },
          label: `Edit vehicle ${formData.make} ${formData.model}`,
          onlineMutation: async () => {
            const { error } = await supabase
              .from("showroom_vehicles")
              .update(payload)
              .eq("id", editingVehicle.id);
            if (error) throw error;
          },
        });
        toast.success(isShowroomOffline() ? "گاڑی کی معلومات محفوظ ہو گئیں (Offline)!" : "Vehicle updated successfully!");
      } else {
        const generatedId = crypto.randomUUID();
        const finalPayload = { ...payload, id: generatedId };

        await executeShowroomAction({
          shopId,
          action: "INSERT",
          tableName: "showroom_vehicles",
          payload: finalPayload,
          label: `Add vehicle ${formData.make} ${formData.model}`,
          onlineMutation: async () => {
            const { data: insertedVeh, error } = await supabase
              .from("showroom_vehicles")
              .insert([finalPayload])
              .select()
              .single();
            if (error) throw error;
            return insertedVeh;
          },
        });

        // Investor transaction if needed
        if (formData.is_investor_funded && formData.investor_id && Number(formData.investor_investment_amount) > 0) {
          const invTxId = crypto.randomUUID();
          const invTxPayload = {
            id: invTxId,
            shop_id: shopId,
            investor_id: formData.investor_id,
            vehicle_id: generatedId,
            tx_type: "vehicle_investment",
            share_type: formData.investor_share_type,
            share_percentage: formData.investor_share_value,
            amount: Number(formData.investor_investment_amount),
            date: formData.purchase_date || new Date().toISOString().split("T")[0],
            description: `سرمایہ برائے مشترکہ خریداری گاڑی: ${formData.make} ${formData.model}`,
          };
          await executeShowroomAction({
            shopId,
            action: "INSERT",
            tableName: "showroom_investor_transactions",
            payload: invTxPayload,
            label: `Investor vehicle investment ${formData.make}`,
            onlineMutation: async () => {
              await supabase.from("showroom_investor_transactions").insert(invTxPayload);
            },
          });
        }

        // Account transaction if cash/bank outflow
        if (paidAmt > 0 && formData.purchase_payment_mode !== "credit" && formData.purchase_account_id) {
          const accTxId = crypto.randomUUID();
          const modeLabel = formData.purchase_payment_mode === "partial" ? "Partial / Advance" : "Full Payment";
          const accTxPayload = {
            id: accTxId,
            shop_id: shopId,
            account_id: formData.purchase_account_id,
            type: "expense",
            amount: paidAmt,
            description: `🚗 Vehicle Purchase Outflow (${modeLabel}): ${formData.make} ${formData.model} — Total: Rs ${cost.toLocaleString()}${remAmt > 0 ? ` (Remaining Payable Udhar: Rs ${remAmt.toLocaleString()})` : ""}`,
            date: formData.purchase_date || new Date().toISOString().split("T")[0],
          };
          await executeShowroomAction({
            shopId,
            action: "INSERT",
            tableName: "account_transactions",
            payload: accTxPayload,
            label: `Purchase expense for ${formData.make}`,
            onlineMutation: async () => {
              await supabase.from("account_transactions").insert(accTxPayload);
              const chosenAcc = accounts.find((a) => a.id === formData.purchase_account_id);
              if (chosenAcc) {
                const updatedBal = (Number(chosenAcc.current_balance) || 0) - paidAmt;
                await supabase
                  .from("cash_accounts")
                  .update({ current_balance: updatedBal })
                  .eq("id", formData.purchase_account_id);
              }
            },
          });
        }

        // Update seller party balance if remaining payable udhar exists
        if (formData.purchase_party_id && remAmt > 0) {
          const sellerParty = parties.find((p) => p.id === formData.purchase_party_id);
          if (sellerParty) {
            const updatedPartyBal = (Number(sellerParty.current_balance) || 0) - remAmt;
            try {
              await executeShowroomAction({
                shopId,
                action: "UPDATE",
                tableName: "showroom_parties",
                payload: { id: formData.purchase_party_id, current_balance: updatedPartyBal },
                label: `Update party balance for vehicle purchase udhar`,
                onlineMutation: async () => {
                  await supabase
                    .from("showroom_parties")
                    .update({ current_balance: updatedPartyBal })
                    .eq("id", formData.purchase_party_id);
                },
              });
            } catch (pBalErr) {
              console.warn("Party balance update warning:", pBalErr);
            }
          }
        }

        // Auto-post balanced double-entry general journal voucher (Debit 1003 Vehicle Inventory, Credit 1001 Cash & 2001 AP)
        try {
          const sellerName = parties.find((p) => p.id === formData.purchase_party_id)?.name;
          await autoPostVehiclePurchaseJournal(supabase, shopId, finalPayload, {
            accountId: formData.purchase_account_id,
            sellerName,
          });
        } catch (jeErr) {
          console.warn("Auto-posting vehicle purchase journal warning:", jeErr);
        }

        toast.success(isShowroomOffline() ? "گاڑی انوینٹری میں درج ہو گئی (Offline)!" : "Vehicle registered to inventory & payment logged!");
      }

      setIsModalOpen(false);
      fetchVehiclesAndParties();
    } catch (err: any) {
      toast.error("Save error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to delete ${label}?`)) return;
    try {
      await executeShowroomAction({
        shopId: shopId!,
        action: "DELETE",
        tableName: "showroom_vehicles",
        payload: { id },
        label: `Delete vehicle ${label}`,
        onlineMutation: async () => {
          const { error } = await supabase.from("showroom_vehicles").delete().eq("id", id);
          if (error) throw error;
        },
      });
      toast.success("Vehicle removed from inventory");
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Open Cash Sale Modal
  const handleOpenCashSale = (v: ShowroomVehicle) => {
    setSelectedVehicleForSale(v);
    const genBillNo = `CS-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
    setCashSaleForm({
      buyer_party_id: "",
      buyer_name: "",
      buyer_phone: "",
      buyer_cnic: "",
      sold_price: Number(v.cash_price || v.price) || 0,
      sold_date: new Date().toISOString().split("T")[0],
      bill_no: genBillNo,
      manual_book_no: "",
      manual_receipt_no: "",
      witness_name: "",
      witness_phone: "",
      witness_cnic: "",
    });
    setIsCashSaleOpen(true);
  };

  const handleExecuteCashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForSale || !shopId) return;

    const bName = cashSaleForm.buyer_name.trim();
    if (!bName) {
      toast.error("Buyer name is required");
      return;
    }

    try {
      const saleUpdatePayload = {
        id: selectedVehicleForSale.id,
        status: "sold" as VehicleStatus,
        buyer_party_id: cashSaleForm.buyer_party_id || null,
        buyer_name: bName,
        buyer_phone: cashSaleForm.buyer_phone.trim() || null,
        sold_at: new Date(cashSaleForm.sold_date).toISOString(),
        sold_price: Number(cashSaleForm.sold_price) || 0,
        bill_no: cashSaleForm.bill_no.trim() || null,
        manual_book_no: cashSaleForm.manual_book_no.trim() || null,
        manual_receipt_no: cashSaleForm.manual_receipt_no.trim() || null,
        witness_name: cashSaleForm.witness_name.trim() || null,
        witness_phone: cashSaleForm.witness_phone.trim() || null,
        witness_cnic: cashSaleForm.witness_cnic.trim() || null,
      };

      await executeShowroomAction({
        shopId,
        action: "UPDATE",
        tableName: "showroom_vehicles",
        payload: saleUpdatePayload,
        label: `Cash sale vehicle ${selectedVehicleForSale.make} to ${bName}`,
        onlineMutation: async () => {
          const { error } = await supabase
            .from("showroom_vehicles")
            .update(saleUpdatePayload)
            .eq("id", selectedVehicleForSale.id);
          if (error) throw error;
        },
      });

      // Also record in showroom_sales
      const saleRecordId = crypto.randomUUID();
      const saleRecordPayload = {
        id: saleRecordId,
        shop_id: shopId,
        vehicle_id: selectedVehicleForSale.id,
        buyer_party_id: cashSaleForm.buyer_party_id || null,
        buyer_name: bName,
        buyer_phone: cashSaleForm.buyer_phone.trim() || null,
        buyer_cnic: cashSaleForm.buyer_cnic.trim() || null,
        sale_type: "cash",
        sale_price: Number(cashSaleForm.sold_price) || 0,
        sale_date: cashSaleForm.sold_date || new Date().toISOString().split("T")[0],
        bill_no: cashSaleForm.bill_no.trim() || null,
        manual_book_no: cashSaleForm.manual_book_no.trim() || null,
        manual_receipt_no: cashSaleForm.manual_receipt_no.trim() || null,
        witness_name: cashSaleForm.witness_name.trim() || null,
        witness_phone: cashSaleForm.witness_phone.trim() || null,
        witness_cnic: cashSaleForm.witness_cnic.trim() || null,
        created_at: new Date().toISOString(),
      };
      await executeShowroomAction({
        shopId,
        action: "INSERT",
        tableName: "showroom_sales",
        payload: saleRecordPayload,
        label: `Showroom cash sale record for ${bName}`,
        onlineMutation: async () => {
          await supabase.from("showroom_sales").insert(saleRecordPayload);
        },
      });

      // Auto-post balanced double-entry general journal voucher (Debit 1001 Cash & 1002 AR, Credit 4001 Revenue; Debit 5001 COGS, Credit 1003 Inventory)
      try {
        await autoPostVehicleSaleJournal(
          supabase,
          shopId,
          saleRecordPayload,
          selectedVehicleForSale,
          { buyerName: bName }
        );
      } catch (jeErr) {
        console.warn("Auto-posting vehicle sale journal warning:", jeErr);
      }

      toast.success(isShowroomOffline() ? "نقد فروخت درج ہو گئی (Offline)!" : "Vehicle sold on cash successfully!");

      const updatedVehicle: ShowroomVehicle = {
        ...selectedVehicleForSale,
        status: "sold" as VehicleStatus,
        buyer_name: bName,
        buyer_phone: cashSaleForm.buyer_phone,
        sold_price: Number(cashSaleForm.sold_price),
        sold_at: cashSaleForm.sold_date,
        bill_no: cashSaleForm.bill_no || undefined,
        manual_book_no: cashSaleForm.manual_book_no || undefined,
        manual_receipt_no: cashSaleForm.manual_receipt_no || undefined,
        witness_name: cashSaleForm.witness_name || undefined,
        witness_phone: cashSaleForm.witness_phone || undefined,
        witness_cnic: cashSaleForm.witness_cnic || undefined,
      };

      setIsCashSaleOpen(false);
      setDeedTargetVehicle(updatedVehicle);
      setIsDeedModalOpen(true);
      fetchVehiclesAndParties();
    } catch (err: any) {
      toast.error("Sale error: " + err.message);
    }
  };

  // Filtered vehicles
  const filteredVehicles = vehicles.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (typeFilter !== "all" && v.vehicle_type !== typeFilter) return false;
    if (docFilter !== "all" && (v.document_status || "in_showroom") !== docFilter) return false;

    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      vehicleLabel(v).toLowerCase().includes(q) ||
      v.chassis_number?.toLowerCase().includes(q) ||
      v.engine_number?.toLowerCase().includes(q) ||
      v.color?.toLowerCase().includes(q) ||
      v.buyer_name?.toLowerCase().includes(q) ||
      v.document_location?.toLowerCase().includes(q) ||
      v.document_notes?.toLowerCase().includes(q)
    );
  });

  const availableCount = vehicles.filter((v) => v.status === "available").length;
  const soldCount = vehicles.filter((v) => v.status === "sold").length;
  const installmentCount = vehicles.filter((v) => v.status === "installment_active").length;

  return (
    <div className="space-y-6 font-sans animate-in fade-in duration-500">
      {/* Offline Status Bar */}
      <ShowroomOfflineBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-600/10 text-violet-600">
              <Car size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Showroom Vehicle Inventory (گاڑی و موٹر سائیکل انوینٹری)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track cars & motorbikes, chassis/engine numbers, photos, documents & instant sales.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/showroom/parties">
            <Button variant="outline" className="font-bold text-xs gap-1.5">
              <User size={15} />
              Parties / Accounts
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCapitalWizardOpen(true)}
            className="border-amber-300 bg-amber-50/80 hover:bg-amber-100 text-amber-900 font-bold gap-1.5 shadow-xs"
          >
            <Coins size={16} className="text-amber-600" />
            <span>Capital Float (ابتدائی سرمایہ)</span>
          </Button>

          <Button
            onClick={handleOpenAddModal}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2 shadow-lg shadow-violet-600/20"
          >
            <PlusCircle size={18} />
            <span>Add Vehicle (گاڑی شامل کریں)</span>
          </Button>
        </div>
      </div>

      {/* Negative Cash Anomaly Warning Banner */}
      {totalCashInHand < 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 font-black">
              <Coins size={20} />
            </div>
            <div>
              <p className="font-black text-rose-900 text-sm">
                Cash in Hand Deficit Anomaly: {formatPKR(totalCashInHand)}
              </p>
              <p className="text-slate-600 mt-0.5">
                Vehicles were purchased in cash without an initial capital float. Normalize your General Ledger with an Owner Capital injection.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setIsCapitalWizardOpen(true)}
            size="sm"
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0 rounded-xl shadow-md"
          >
            Fix Deficit with Capital Wizard
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-50 text-violet-600">
            <Car size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Units</p>
            <p className="text-xl font-black text-slate-900">{vehicles.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Available (موجود)</p>
            <p className="text-xl font-black text-emerald-700">{availableCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">On Installments</p>
            <p className="text-xl font-black text-purple-700">{installmentCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-slate-100 text-slate-600">
            <Banknote size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Sold Units</p>
            <p className="text-xl font-black text-slate-900">{soldCount}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                statusFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All ({vehicles.length})
            </button>
            <button
              onClick={() => setStatusFilter("available")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                statusFilter === "available" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Available ({availableCount})
            </button>
            <button
              onClick={() => setStatusFilter("installment_active")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                statusFilter === "installment_active" ? "bg-purple-600 text-white shadow-sm font-black" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Installments ({installmentCount})
            </button>
            <button
              onClick={() => setStatusFilter("sold")}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                statusFilter === "sold" ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sold ({soldCount})
            </button>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition ${
                typeFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter("car")}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition ${
                typeFilter === "car" ? "bg-violet-600 text-white shadow-sm" : "text-slate-500"
              }`}
            >
              Cars
            </button>
            <button
              onClick={() => setTypeFilter("bike")}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl transition ${
                typeFilter === "bike" ? "bg-violet-600 text-white shadow-sm" : "text-slate-500"
              }`}
            >
              Motorbikes
            </button>
          </div>

          {/* Document Status Filter */}
          <select
            value={docFilter}
            onChange={(e) => setDocFilter(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="all">📁 All Documents (تمام فائلز)</option>
            <option value="in_showroom">🏢 With Showroom (ہمارے پاس)</option>
            <option value="with_seller">👤 With Seller (سیلر کے پاس)</option>
            <option value="with_customer">🤝 Handed to Customer (کسٹمر کے پاس)</option>
            <option value="in_bank_excise">🏛️ Bank / Excise Process</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search make, model, chassis, plate, doc location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white rounded-2xl border-slate-200 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Vehicles Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-xs text-slate-400 font-semibold">Loading vehicle stock...</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
            <Car size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No vehicles found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No vehicle matches your search query."
              : "Register your first car or motorbike into inventory."}
          </p>
          {!searchQuery && (
            <Button
              onClick={handleOpenAddModal}
              size="sm"
              className="mt-4 bg-violet-600 hover:bg-violet-700 text-white font-bold"
            >
              <PlusCircle size={14} className="mr-1.5" />
              Add First Vehicle
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVehicles.map((v) => {
            const isSold = v.status === "sold";
            const isAvailable = v.status === "available";
            const firstPhoto = Array.isArray(v.photos) && v.photos.length > 0 ? v.photos[0] : null;

            return (
              <div
                key={v.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                {/* Image & Badges */}
                <div className="relative h-48 bg-slate-900 overflow-hidden flex items-center justify-center">
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt={vehicleLabel(v)}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center">
                      <Car size={48} className="opacity-40" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-2">
                        {v.vehicle_type === "bike" ? "Motorbike" : "Vehicle"}
                      </span>
                    </div>
                  )}

                  {/* Status Overlay */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md ${
                        isAvailable
                          ? "bg-emerald-500/90 text-white shadow-sm"
                          : v.status === "installment_active"
                          ? "bg-purple-600/95 text-white shadow-sm font-black"
                          : isSold
                          ? "bg-slate-900/90 text-slate-300"
                          : "bg-amber-500/90 text-white shadow-sm"
                      }`}
                    >
                      {isAvailable
                        ? "Available"
                        : v.status === "installment_active"
                        ? "On Installment (اقساط)"
                        : isSold
                        ? "Cash Sold"
                        : v.status}
                    </span>

                    {v.is_applied_for && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/90 text-white backdrop-blur-md">
                        Applied For
                      </span>
                    )}
                  </div>

                  {/* Photo count indicator */}
                  {Array.isArray(v.photos) && v.photos.length > 1 && (
                    <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-slate-950/70 text-white text-[10px] font-bold flex items-center gap-1">
                      <Camera size={11} />
                      {v.photos.length} photos
                    </div>
                  )}
                </div>

                {/* Body Details */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                          {v.make} {v.model}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {v.year || "—"} • {v.color || "Color —"} • {v.engine_cc ? `${v.engine_cc} CC` : ""}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Cash Price</p>
                        <p className="text-sm font-black text-slate-900">
                          {formatPKR(v.cash_price || v.price)}
                        </p>
                      </div>
                    </div>

                    {/* Specs Tags */}
                    <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded-2xl space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-semibold text-slate-400 text-[11px]">Plate / Reg:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {v.is_applied_for ? "Applied For" : (v.plate_number || "—")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-semibold text-slate-400 text-[11px]">Chassis (چیسس):</span>
                        <span className="font-mono text-[11px] font-semibold text-slate-800 truncate max-w-[170px]">
                          {v.chassis_number || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-semibold text-slate-400 text-[11px]">Engine (انجن):</span>
                        <span className="font-mono text-[11px] font-semibold text-slate-800 truncate max-w-[170px]">
                          {v.engine_number || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Document Custody Status Badge */}
                    {(() => {
                      const docBadge = formatDocumentStatusBadge(v.document_status);
                      return (
                        <div
                          className={`mt-2.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between transition ${docBadge.bgClass} ${docBadge.borderClass} ${docBadge.colorClass}`}
                        >
                          <span className="flex items-center gap-1.5 font-urdu">
                            <span>{docBadge.icon}</span>
                            <span>{docBadge.labelUrdu}</span>
                          </span>
                          {v.document_location ? (
                            <span className="text-[10px] opacity-80 truncate max-w-[120px] font-mono" title={v.document_location}>
                              📍 {v.document_location}
                            </span>
                          ) : (
                            <span className="text-[10px] opacity-75 font-sans uppercase tracking-wider font-extrabold">
                              {v.document_status === "with_seller" ? "Seller Hold" : v.document_status === "with_customer" ? "Customer" : "In Safe"}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Sold / Installment Info */}
                    {isSold && (
                      <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                        <p className="font-bold">🔴 Cash Sold to: {v.buyer_name || "Buyer"}</p>
                        <p className="text-[11px] text-rose-700 font-semibold">
                          Price: {formatPKR(v.sold_price || v.price)}
                        </p>
                      </div>
                    )}

                    {v.status === "installment_active" && (
                      <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-950">
                        <p className="font-bold">🟣 Sold on Installment to: {v.buyer_name || "Customer"}</p>
                        <p className="text-[11px] text-purple-700 font-semibold">
                          Financed: {formatPKR(v.sold_price || v.installment_price || v.price)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(v)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"
                        title="Edit Vehicle"
                      >
                        <Edit size={16} />
                      </button>

                      <button
                        onClick={() => {
                          setDeedTargetVehicle(v);
                          setIsDeedModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                        title="Print Deed / Iqrar Nama"
                      >
                        <Printer size={16} />
                      </button>

                      <button
                        onClick={() => handleDelete(v.id, vehicleLabel(v))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Vehicle"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {isAvailable ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          onClick={() => handleOpenCashSale(v)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 px-3"
                        >
                          <Banknote size={13} className="mr-1" />
                          Cash Sale
                        </Button>

                        <Link href={`/dashboard/showroom/installments?vehicleId=${v.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-violet-700 border-violet-200 hover:bg-violet-50 text-xs font-bold h-8 px-3"
                          >
                            <CreditCard size={13} className="mr-1" />
                            Installments
                          </Button>
                        </Link>
                      </div>
                    ) : v.status === "installment_active" ? (
                      <Link href="/dashboard/showroom/installments">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300 text-xs font-bold h-8 px-3"
                        >
                          <CreditCard size={13} className="mr-1" />
                          اقساط کھاتہ
                        </Button>
                      </Link>
                    ) : isSold ? (
                      <Button
                        onClick={() => {
                          setDeedTargetVehicle(v);
                          setIsDeedModalOpen(true);
                        }}
                        size="sm"
                        variant="outline"
                        className="text-xs font-bold h-8 px-3 border-slate-200"
                      >
                        <FileCheck size={13} className="mr-1 text-emerald-600" />
                        Sales Deed
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Vehicle Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-600/30 text-violet-300">
                    <Car size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">
                      {editingVehicle ? "Edit Vehicle Details" : "Add Vehicle to Showroom Stock (گاڑی شامل کریں)"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Chassis, Engine, Sourcing, Photos & Registration details
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {/* 1. Vehicle Type Selector */}
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicle_type: "car" })}
                    className={`py-2 text-xs font-black rounded-xl transition ${
                      formData.vehicle_type === "car" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    🚗 Car (کار)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicle_type: "bike" })}
                    className={`py-2 text-xs font-black rounded-xl transition ${
                      formData.vehicle_type === "bike" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    🏍️ Motorbike (موٹر سائیکل)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicle_type: "commercial" })}
                    className={`py-2 text-xs font-black rounded-xl transition ${
                      formData.vehicle_type === "commercial" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    🚛 Commercial (کمرشل)
                  </button>
                </div>

                {/* 2. Basic Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Make / Company (کمپنی) *</label>
                    <Input
                      required
                      placeholder="e.g. Honda, Toyota, Suzuki"
                      value={formData.make}
                      onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                      className="font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Model (ماڈل) *</label>
                    <Input
                      required
                      placeholder="e.g. Civic, Corolla, CD70, YBR"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Model Year (ماڈل سال) <span className="text-[10px] font-normal text-slate-400">مثلاً: 2026 یا 2026/27</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. 2026 or 2026/27"
                      value={formData.year || ""}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      className="font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* 3. Number Plate & Applied For */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Number Plate / Reg No</label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-violet-700">
                        <input
                          type="checkbox"
                          checked={formData.is_applied_for}
                          onChange={(e) => setFormData({ ...formData, is_applied_for: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-violet-600"
                        />
                        <span>Applied For (اپلائیڈ فار)</span>
                      </label>
                    </div>
                    <Input
                      disabled={formData.is_applied_for}
                      placeholder={formData.is_applied_for ? "Applied For" : "e.g. LEA-2024-1234"}
                      value={formData.is_applied_for ? "Applied For" : formData.plate_number}
                      onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                      className="font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Color (رنگ)</label>
                    <Input
                      placeholder="e.g. White, Black, Red"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                </div>

                {/* 4. Chassis, Engine, CC */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Chassis Number (چیسس نمبر)</label>
                    <Input
                      placeholder="e.g. NZE120-1234567"
                      value={formData.chassis_number}
                      onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Engine Number (انجن نمبر)</label>
                    <Input
                      placeholder="e.g. 1NZ-FE-7654321"
                      value={formData.engine_number}
                      onChange={(e) => setFormData({ ...formData, engine_number: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Engine CC (پاور)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g. 70, 125, 1300, 1800"
                      value={formData.engine_cc || ""}
                      onChange={(e) => setFormData({ ...formData, engine_cc: Number(e.target.value.replace(/\D/g, "")) || null })}
                    />
                  </div>
                </div>

                {/* 5. Sourcing & Purchasing Details */}
                <div className="p-4 bg-violet-50/50 rounded-2xl border border-violet-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-violet-950 uppercase flex items-center gap-1.5">
                      <DollarSign size={14} />
                      خریداری کی تفصیل (PURCHASE & SOURCING DETAILS)
                    </h4>
                    <Link href="/dashboard/showroom/parties" target="_blank" className="text-[11px] font-bold text-violet-700 hover:underline">
                      + Add New Seller
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchased From (کس سے خریدی)</label>
                      <select
                        value={formData.purchase_party_id}
                        onChange={(e) => setFormData({ ...formData, purchase_party_id: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                      >
                        <option value="">Select Seller / Dealer...</option>
                        {parties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.is_dealer_showroom ? "(Dealer)" : ""} - {p.phone}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Cost (قیمتِ خریداری)</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={formData.purchase_cost || ""}
                        onChange={(e) => setFormData({ ...formData, purchase_cost: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                        className="font-bold text-rose-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode (طریقہ ادائیگی)</label>
                      <select
                        value={formData.purchase_payment_mode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            purchase_payment_mode: e.target.value as "cash" | "bank" | "credit" | "partial",
                          })
                        }
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer"
                      >
                        <option value="cash">Spot Cash (نقد ادائیگی)</option>
                        <option value="bank">Bank Transfer / Cheque</option>
                        <option value="partial">Partial (کچھ نقد / ایڈوانس + باقی ادھار)</option>
                        <option value="credit">Credit / Payable (مکمل ادھار پر)</option>
                      </select>
                    </div>
                  </div>

                  {/* Partial Payment Specific Inputs: Advance Paid & Remaining Udhar */}
                  {formData.purchase_payment_mode === "partial" && (
                    <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/70 rounded-2xl border border-amber-200/80 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                        <span className="flex items-center gap-1.5">
                          <DollarSign size={14} className="text-amber-700" />
                          جزوی ادائیگی کی تقسیم (Partial Payment Breakdown)
                        </span>
                        <span className="text-[11px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-extrabold">
                          Advance + Udhar
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Paid Advance Amount (ادا کردہ نقد رقم / ایڈوانس) *
                          </label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={formData.purchase_paid_amount || ""}
                            onChange={(e) => {
                              const pVal = Number(e.target.value.replace(/\D/g, "")) || 0;
                              const cost = Number(formData.purchase_cost || 0);
                              const rem = Math.max(0, cost - pVal);
                              setFormData({
                                ...formData,
                                purchase_paid_amount: pVal,
                                purchase_remaining_amount: rem,
                              });
                            }}
                            className="font-black text-emerald-700 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Remaining Udhar / Payable (باقایا واجب الادا ادھار)
                          </label>
                          <div className="h-10 px-3.5 rounded-xl bg-white border border-rose-200 flex items-center justify-between font-mono font-black text-rose-700">
                            <span>Rs {Math.max(0, Number(formData.purchase_cost || 0) - Number(formData.purchase_paid_amount || 0)).toLocaleString()}</span>
                            <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-sans">
                              سیلر کھاتہ
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-amber-800 font-medium">
                        💡 ادا کردہ رقم <span className="font-bold">Rs {Number(formData.purchase_paid_amount || 0).toLocaleString()}</span> منتخب اکاؤنٹ سے کٹے گی، اور باقایا <span className="font-bold text-rose-700">Rs {Math.max(0, Number(formData.purchase_cost || 0) - Number(formData.purchase_paid_amount || 0)).toLocaleString()}</span> سیلر / ڈیلر کے کھاتے میں ادھار رہے گی۔
                      </p>
                    </div>
                  )}

                  {/* Account Selector for Spot Cash / Bank / Partial */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-violet-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>
                          {formData.purchase_payment_mode === "credit"
                            ? "Khata Settlement (کھاتہ ایڈجسٹمنٹ)"
                            : formData.purchase_payment_mode === "partial"
                            ? "Paid Advance From Account (ایڈوانس رقم کس اکاؤنٹ سے ادا کی گئی) *"
                            : "Paid From Account (رقم کس اکاؤنٹ سے ادا کی گئی) *"}
                        </span>
                        {formData.purchase_payment_mode !== "credit" && (
                          <span className="text-[10px] text-violet-700 font-bold">
                            {formData.purchase_payment_mode === "partial" ? "Advance Deduction" : "Cash / Bank Deduction"}
                          </span>
                        )}
                      </label>

                      {formData.purchase_payment_mode === "credit" ? (
                        <div className="h-10 px-3 rounded-xl bg-amber-50 border border-amber-200 text-xs flex items-center text-amber-800 font-semibold">
                          <span>⚠️ مکمل رقم سیلر / ڈیلر کے کھاتے میں ادھار درج ہوگی۔</span>
                        </div>
                      ) : (
                        <select
                          value={formData.purchase_account_id}
                          onChange={(e) => setFormData({ ...formData, purchase_account_id: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border-2 border-violet-300 bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-violet-500/20"
                        >
                          <option value="">Select Cash / Bank Account...</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.type || "Cash"}) — Balance: {formatPKR(acc.current_balance)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Date (تاریخ خریداری)</label>
                      <Input
                        type="date"
                        value={formData.purchase_date || ""}
                        onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                        className="h-10 rounded-xl text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 5b. Document Custody & Paper Status Section */}
                <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                      <FileCheck size={15} className="text-emerald-600" />
                      گاڑی کے اصل کاغذات و فائل کی تفصیل (VEHICLE DOCUMENTS CUSTODY)
                    </h4>
                    <span className="text-[11px] font-bold text-slate-500 font-urdu">کاغذات فی الوقت کس کے پاس ہیں؟</span>
                  </div>

                  {/* Document Location Selector Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "in_showroom", icon: "🏢", title: "ہمارے پاس", sub: "شو روم سیف / محفوظ" },
                      { id: "with_seller", icon: "👤", title: "سیلر کے پاس", sub: "پچھلے مالک کے پاس" },
                      { id: "with_customer", icon: "🤝", title: "خریدار کے حوالے", sub: "کسٹمر کو ہینڈ اوور" },
                      { id: "in_bank_excise", icon: "🏛️", title: "ایکسائز / بینک", sub: "ٹرانسفر پروسیس" },
                    ].map((item) => {
                      const isSelected = formData.document_status === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, document_status: item.id as DocumentStatus })}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                            isSelected
                              ? "bg-violet-50 border-violet-500 ring-2 ring-violet-500/20 text-violet-950 font-bold shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center justify-between text-base mb-1">
                            <span>{item.icon}</span>
                            {isSelected && <CheckCircle2 size={14} className="text-violet-600" />}
                          </div>
                          <div>
                            <p className="text-xs font-urdu font-black">{item.title}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{item.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Document Checklist Items */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[11px] font-bold text-slate-700 font-urdu">موجودہ دستیاب دستاویزات (Checklist):</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      {[
                        { key: "file_complete", label: "📄 مکمل فائل" },
                        { key: "smart_card", label: "💳 سمارٹ کارڈ" },
                        { key: "original_book", label: "📘 اصل کاپی/بک" },
                        { key: "return_file", label: "🗂️ ریٹرن فائل" },
                        { key: "biometric_letter", label: "✍️ بائیو میٹرک" },
                      ].map((chk) => (
                        <label
                          key={chk.key}
                          className="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-800 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean((formData.document_checklist as any)?.[chk.key])}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                document_checklist: {
                                  ...formData.document_checklist,
                                  [chk.key]: e.target.checked,
                                },
                              })
                            }
                            className="w-3.5 h-3.5 rounded text-violet-600"
                          />
                          <span className="font-urdu font-bold text-[11px]">{chk.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Document Location Details / Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 font-urdu">
                        کاغذات کا درست مقام / الماری یا لاکر نمبر (Specific Location / Locker)
                      </label>
                      <Input
                        placeholder="مثلاً: شو روم لاکر نمبر 3، یا فائل سیلر کے پاس محفوظ ہے"
                        value={formData.document_location}
                        onChange={(e) => setFormData({ ...formData, document_location: e.target.value })}
                        className="text-xs h-9 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 font-urdu">
                        اضافی ریمارکس / بائیو میٹرک شرط (Notes / Remarks)
                      </label>
                      <Input
                        placeholder="مثلاً: رقم کی مکمل ادائیگی پر بائیو میٹرک دی جائے گی"
                        value={formData.document_notes}
                        onChange={(e) => setFormData({ ...formData, document_notes: e.target.value })}
                        className="text-xs h-9 bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 5c. Investor Co-funding & Partnership */}
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.is_investor_funded}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_investor_funded: e.target.checked,
                            investor_id: e.target.checked ? formData.investor_id || investors[0]?.id || "" : "",
                            investor_investment_amount: e.target.checked ? formData.investor_investment_amount || formData.purchase_cost || 0 : 0,
                          })
                        }
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
                        <Landmark size={15} className="text-amber-600" />
                        انویسٹر شراکت داری (CO-FINANCED WITH INVESTOR / PARTNER)
                      </span>
                    </label>
                    <Link
                      href="/dashboard/showroom/investors"
                      target="_blank"
                      className="text-[11px] font-bold text-amber-700 hover:underline"
                    >
                      + Manage Investors
                    </Link>
                  </div>

                  {formData.is_investor_funded && (
                    <div className="space-y-3 pt-2 border-t border-amber-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Select Investor (انویسٹر منتخب کریں) *</label>
                          <select
                            value={formData.investor_id}
                            onChange={(e) => {
                              const inv = investors.find((item) => item.id === e.target.value);
                              setFormData({
                                ...formData,
                                investor_id: e.target.value,
                                investor_share_type: inv?.default_share_type || "profit_only",
                                investor_share_value: inv?.default_share_value ?? 50,
                              });
                            }}
                            className="w-full h-10 px-3 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-slate-800"
                          >
                            <option value="">-- انویسٹر منتخب کریں --</option>
                            {investors.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.name} ({inv.phone})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Investor Capital Injected (انویسٹر کا سرمایہ) *</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={formData.investor_investment_amount || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                investor_investment_amount: Number(e.target.value.replace(/\D/g, "")) || 0,
                              })
                            }
                            className="font-bold text-amber-800 bg-white border-amber-300"
                          />
                        </div>
                      </div>

                      {/* Display Locked Predetermined Rule from Investor Profile */}
                      {(() => {
                        const selectedInv = investors.find((i) => i.id === formData.investor_id);
                        if (!selectedInv) return null;
                        return (
                          <div className="p-3 rounded-xl bg-amber-100/80 border border-amber-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg">
                                <Scale size={14} />
                              </div>
                              <div>
                                <span className="font-urdu font-bold text-slate-900 block sm:inline mr-2">
                                  انویسٹر کا طے شدہ شراکت داری کا اصول:
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-black bg-white text-amber-900 border border-amber-200 shadow-2xs">
                                  {formatInvestorShareBadge(selectedInv.default_share_type, selectedInv.default_share_value)}
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] text-amber-800 font-urdu font-semibold">
                              (انویسٹر پروفائل کے اصول کے مطابق منافع کیلکولیٹ ہوگا)
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* 6. Selling Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cash Selling Price (نقد فروخت قیمت)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.cash_price || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value.replace(/\D/g, "")) || 0;
                        setFormData({
                          ...formData,
                          cash_price: val,
                          price: val,
                        });
                      }}
                      className="font-bold text-emerald-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Installment Plan Price (اقساط کی طے شدہ قیمت)</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.installment_price || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, installment_price: Number(e.target.value.replace(/\D/g, "")) || 0 })
                      }
                      className="font-bold text-violet-700"
                    />
                  </div>
                </div>

                {/* 7. Photos & Google Drive Organizer */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera size={15} className="text-violet-600" />
                      Vehicle Photos (گاڑی کی تصاویر - Auto Compressed & Organized)
                    </span>
                    <span className="text-[10px] text-slate-400">Google Drive Linked Folder</span>
                  </div>

                  {/* Photo Thumbnails */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {formData.photos.map((url, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden group">
                        <img src={url} alt="Veh" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              photos: prev.photos.filter((_, i) => i !== idx),
                            }))
                          }
                          className="absolute inset-0 bg-rose-900/70 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    <input
                      type="file"
                      ref={photoInputRef}
                      onChange={handlePhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="h-16 w-24 border-dashed border-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1"
                    >
                      {uploadingPhoto ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      <span>Add Photo</span>
                    </Button>
                  </div>
                </div>

                {/* Form Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 shadow-lg shadow-violet-600/20"
                  >
                    {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    {editingVehicle ? "Update Vehicle" : "Register Vehicle"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cash Sale Modal */}
      <AnimatePresence>
        {isCashSaleOpen && selectedVehicleForSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 bg-emerald-700 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/20">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">Cash Sale & Agreement (نقد فروخت)</h3>
                    <p className="text-xs text-emerald-100">{vehicleLabel(selectedVehicleForSale)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCashSaleOpen(false)}
                  className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleExecuteCashSale} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Existing Buyer (کسٹمر منتخب کریں)
                  </label>
                  <select
                    value={cashSaleForm.buyer_party_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const selectedP = parties.find((p) => p.id === pid);
                      setCashSaleForm({
                        ...cashSaleForm,
                        buyer_party_id: pid,
                        buyer_name: selectedP?.name || cashSaleForm.buyer_name,
                        buyer_phone: selectedP?.phone || cashSaleForm.buyer_phone,
                        buyer_cnic: selectedP?.cnic || cashSaleForm.buyer_cnic,
                      });
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                  >
                    <option value="">Or enter buyer manually below...</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.father_name ? `s/o ${p.father_name}` : ""} ({p.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Buyer Name (خریدار کا نام) *</label>
                    <Input
                      required
                      placeholder="e.g. Tariq Mehmood"
                      value={cashSaleForm.buyer_name}
                      onChange={(e) => setCashSaleForm({ ...cashSaleForm, buyer_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone (موبائل نمبر)</label>
                    <Input
                      placeholder="e.g. 0300-1234567"
                      value={cashSaleForm.buyer_phone}
                      onChange={(e) => setCashSaleForm({ ...cashSaleForm, buyer_phone: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Agreed Cash Price (طے شدہ قیمت) *</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={cashSaleForm.sold_price || ""}
                    onChange={(e) => setCashSaleForm({ ...cashSaleForm, sold_price: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    className="text-lg font-black text-emerald-700"
                  />
                </div>

                {/* Bill / Book / Receipt References */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <FileText size={14} className="text-emerald-600" />
                    <span>Bill, Khata & Receipt Details (بل، کھاتہ و رسید نمبر)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Bill / Invoice # (بل نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.bill_no}
                        onChange={(e) => setCashSaleForm({ ...cashSaleForm, bill_no: e.target.value })}
                        placeholder="CS-2609-001"
                        className="h-9 text-xs font-mono font-bold text-slate-800 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Khata / Book # (کھاتہ نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.manual_book_no}
                        onChange={(e) => setCashSaleForm({ ...cashSaleForm, manual_book_no: e.target.value })}
                        placeholder="Khata # / کھاتہ نمبر"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Receipt / Slip # (رسید / پرچی نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.manual_receipt_no}
                        onChange={(e) => setCashSaleForm({ ...cashSaleForm, manual_receipt_no: e.target.value })}
                        placeholder="Receipt # / پرچی"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Witness Details (گواہ) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <ShieldCheck size={14} className="text-violet-600" />
                    <span>Witness / Guarantor (گواہ کی تفصیلات)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Witness Name (گواہ کا نام)
                      </label>
                      <Input
                        value={cashSaleForm.witness_name}
                        onChange={(e) => setCashSaleForm({ ...cashSaleForm, witness_name: e.target.value })}
                        placeholder="e.g. Aslam Khan"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Witness Phone (فون نمبر)
                      </label>
                      <Input
                        value={cashSaleForm.witness_phone}
                        onChange={(e) => setCashSaleForm({ ...cashSaleForm, witness_phone: e.target.value })}
                        placeholder="0300-1234567"
                        className="h-9 text-xs font-mono rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Witness CNIC (شناختی کارڈ)
                      </label>
                      <Input
                        value={cashSaleForm.witness_cnic}
                        onChange={(e) => setCashSaleForm({ ...cashSaleForm, witness_cnic: e.target.value })}
                        placeholder="35201-XXXXXXX-X"
                        className="h-9 text-xs font-mono rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sale Date (تاریخ فروخت)</label>
                  <Input
                    type="date"
                    value={cashSaleForm.sold_date}
                    onChange={(e) => setCashSaleForm({ ...cashSaleForm, sold_date: e.target.value })}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={() => setIsCashSaleOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
                  >
                    Confirm Sale & Generate Deed
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deed & Invoice Print Modal */}
      {deedTargetVehicle && (
        <ShowroomDeedPrintModal
          isOpen={isDeedModalOpen}
          onClose={() => setIsDeedModalOpen(false)}
          shopName={shopName || "Showroom"}
          shopPhone={shopPhone || undefined}
          shopAddress={shopAddress || undefined}
          vehicle={deedTargetVehicle}
          buyer={{
            name: deedTargetVehicle.buyer_name || "Buyer",
            phone: deedTargetVehicle.buyer_phone || "",
          }}
          saleType="cash"
          salePrice={Number(deedTargetVehicle.sold_price || deedTargetVehicle.price || 0)}
          downPayment={Number(deedTargetVehicle.sold_price || deedTargetVehicle.price || 0)}
          saleDate={
            deedTargetVehicle.sold_at
              ? new Date(deedTargetVehicle.sold_at).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0]
          }
          billNo={deedTargetVehicle.bill_no}
          manualBookNo={deedTargetVehicle.manual_book_no}
          manualReceiptNo={deedTargetVehicle.manual_receipt_no}
          witnessName={deedTargetVehicle.witness_name}
          witnessPhone={deedTargetVehicle.witness_phone}
          witnessCnic={deedTargetVehicle.witness_cnic}
        />
      )}

      {/* Showroom Capital Float Wizard */}
      <ShowroomCapitalFloatWizard
        isOpen={isCapitalWizardOpen}
        onClose={() => setIsCapitalWizardOpen(false)}
        shopId={shopId || ""}
        accounts={accounts}
        currentCashInHand={totalCashInHand}
        onSuccess={fetchVehiclesAndParties}
      />
    </div>
  );
}
