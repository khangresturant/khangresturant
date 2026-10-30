"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  PlusCircle,
  Building2,
  User,
  Phone,
  CreditCard,
  MapPin,
  Camera,
  Upload,
  Loader2,
  Trash2,
  Edit,
  X,
  CheckCircle2,
  Share2,
  ShieldCheck,
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import type { ShowroomParty, PartyType } from "@/lib/showroom-ops";
import {
  formatPKR,
  loadShowroomOfflineEntities,
  executeShowroomAction,
  isShowroomOffline,
} from "@/lib/showroom-ops";
import { uploadToShowroomDrive } from "@/lib/showroom-media-uploader";
import { ShowroomOfflineBar } from "@/components/showroom/ShowroomOfflineBar";

const emptyPartyForm = {
  party_type: "buyer" as PartyType,
  is_dealer_showroom: false,
  name: "",
  father_name: "",
  caste: "",
  cnic: "",
  phone: "",
  whatsapp: "",
  city: "Lahore",
  address: "",
  photo_url: "",
  cnic_front_url: "",
  cnic_back_url: "",
  opening_balance: 0,
  notes: "",
};

export default function ShowroomPartiesPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [parties, setParties] = useState<ShowroomParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "buyer" | "seller" | "dealer">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingParty, setEditingParty] = useState<ShowroomParty | null>(null);
  const [formData, setFormData] = useState(emptyPartyForm);

  // Uploading state indicators
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCnicFront, setUploadingCnicFront] = useState(false);
  const [uploadingCnicBack, setUploadingCnicBack] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cnicFrontInputRef = useRef<HTMLInputElement>(null);
  const cnicBackInputRef = useRef<HTMLInputElement>(null);

  const fetchParties = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const offParties = await loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId);
        setParties(offParties);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("showroom_parties")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Failed fetching showroom parties:", error.message);
        const offParties = await loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId);
        setParties(offParties);
      } else {
        const loaded = (data as ShowroomParty[]) || [];
        setParties(loaded);
        import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
          putManyOfflineData("showroom_parties", loaded.map((r) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        });
      }
    } catch (err: any) {
      try {
        const offParties = await loadShowroomOfflineEntities<ShowroomParty>("showroom_parties", shopId);
        setParties(offParties);
      } catch {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, [shopId]);

  const handleOpenAddModal = () => {
    setEditingParty(null);
    setFormData(emptyPartyForm);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: ShowroomParty) => {
    setEditingParty(p);
    setFormData({
      party_type: p.party_type || "buyer",
      is_dealer_showroom: p.is_dealer_showroom || false,
      name: p.name || "",
      father_name: p.father_name || "",
      caste: p.caste || "",
      cnic: p.cnic || "",
      phone: p.phone || "",
      whatsapp: p.whatsapp || "",
      city: p.city || "Lahore",
      address: p.address || "",
      photo_url: p.photo_url || "",
      cnic_front_url: p.cnic_front_url || "",
      cnic_back_url: p.cnic_back_url || "",
      opening_balance: Number(p.opening_balance) || 0,
      notes: p.notes || "",
    });
    setIsModalOpen(true);
  };

  // Upload handler for profile picture
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setUploadingPhoto(true);
    const toastId = toast.loading("Compressing & uploading photo to Drive...");
    try {
      const category = formData.is_dealer_showroom
        ? "Sellers"
        : formData.party_type === "seller"
        ? "Sellers"
        : "Customers";
      const res = await uploadToShowroomDrive(shopId, file, category, formData.name || "Party_Photo");
      if (res.url) {
        setFormData((prev) => ({ ...prev, photo_url: res.url }));
        toast.success("Photo uploaded successfully!", { id: toastId });
      } else {
        toast.error("Upload failed: " + (res.error || "Unknown error"), { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Upload handler for CNIC Front
  const handleCnicFrontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setUploadingCnicFront(true);
    const toastId = toast.loading("Compressing CNIC Front scan...");
    try {
      const res = await uploadToShowroomDrive(
        shopId,
        file,
        "Documents",
        `${formData.name || "Party"}_CNIC_Front`
      );
      if (res.url) {
        setFormData((prev) => ({ ...prev, cnic_front_url: res.url }));
        toast.success("CNIC Front uploaded!", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setUploadingCnicFront(false);
    }
  };

  // Upload handler for CNIC Back
  const handleCnicBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setUploadingCnicBack(true);
    const toastId = toast.loading("Compressing CNIC Back scan...");
    try {
      const res = await uploadToShowroomDrive(
        shopId,
        file,
        "Documents",
        `${formData.name || "Party"}_CNIC_Back`
      );
      if (res.url) {
        setFormData((prev) => ({ ...prev, cnic_back_url: res.url }));
        toast.success("CNIC Back uploaded!", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setUploadingCnicBack(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    if (!formData.name.trim()) {
      toast.error("Party name is required");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        shop_id: shopId,
        party_type: formData.party_type,
        is_dealer_showroom: formData.is_dealer_showroom,
        name: formData.name.trim(),
        father_name: formData.is_dealer_showroom ? null : formData.father_name.trim() || null,
        caste: formData.is_dealer_showroom ? null : formData.caste.trim() || null,
        cnic: formData.cnic.trim() || null,
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim() || formData.phone.trim(),
        city: formData.city.trim() || "Lahore",
        address: formData.address.trim() || null,
        photo_url: formData.photo_url || null,
        cnic_front_url: formData.cnic_front_url || null,
        cnic_back_url: formData.cnic_back_url || null,
        opening_balance: Number(formData.opening_balance) || 0,
        notes: formData.notes.trim() || null,
      };

      if (editingParty) {
        payload.id = editingParty.id;
        await executeShowroomAction({
          table: "showroom_parties",
          action: "update",
          payload,
          shopId,
        });
        toast.success("Party updated successfully!");
      } else {
        payload.id = crypto.randomUUID();
        await executeShowroomAction({
          table: "showroom_parties",
          action: "insert",
          payload,
          shopId,
        });
        toast.success("Party added successfully!");
      }

      setIsModalOpen(false);
      fetchParties();
    } catch (err: any) {
      toast.error("Error saving party: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await executeShowroomAction({
        table: "showroom_parties",
        action: "delete",
        payload: { id },
        shopId,
      });
      toast.success("Party removed");
      setParties((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Filtered list
  const filteredParties = parties.filter((p) => {
    // Tab filter
    if (activeTab === "buyer" && p.party_type !== "buyer" && p.party_type !== "both") return false;
    if (activeTab === "seller" && p.party_type !== "seller" && p.party_type !== "both") return false;
    if (activeTab === "dealer" && !p.is_dealer_showroom) return false;

    // Search query
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.father_name?.toLowerCase().includes(q) ||
      p.caste?.toLowerCase().includes(q) ||
      p.cnic?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q)
    );
  });

  const totalBuyers = parties.filter((p) => p.party_type === "buyer" || p.party_type === "both").length;
  const totalSellers = parties.filter((p) => p.party_type === "seller" || p.party_type === "both").length;
  const totalDealers = parties.filter((p) => p.is_dealer_showroom).length;

  return (
    <div className="space-y-6 font-sans animate-in fade-in duration-500">
      <ShowroomOfflineBar onSyncSuccess={fetchParties} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-600/10 text-violet-600">
              <Users size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Showroom Accounts & Parties (گاہک و ڈیلرز)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Manage buyers, sellers, dealerships, guarantors, and Pakistani legal profiles.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleOpenAddModal}
          className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2 shadow-lg shadow-violet-600/20"
        >
          <PlusCircle size={18} />
          <span>Add Customer / Dealer (نیا پارٹی شامل کریں)</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-50 text-violet-600">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Parties</p>
            <p className="text-xl font-black text-slate-900">{parties.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <ArrowDownLeft size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Buyers (گاہک)</p>
            <p className="text-xl font-black text-emerald-700">{totalBuyers}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <ArrowUpRight size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Sellers (فروخت کنندہ)</p>
            <p className="text-xl font-black text-blue-700">{totalSellers}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <Building2 size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Dealers (شو رومز)</p>
            <p className="text-xl font-black text-amber-700">{totalDealers}</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
              activeTab === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            All Parties ({parties.length})
          </button>
          <button
            onClick={() => setActiveTab("buyer")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
              activeTab === "buyer" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Buyers ({totalBuyers})
          </button>
          <button
            onClick={() => setActiveTab("seller")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
              activeTab === "seller" ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Sellers ({totalSellers})
          </button>
          <button
            onClick={() => setActiveTab("dealer")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition ${
              activeTab === "dealer" ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Showrooms / Dealers ({totalDealers})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, father, caste, CNIC, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white rounded-2xl border-slate-200 text-sm shadow-sm"
          />
        </div>
      </div>

      {/* Directory Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-xs text-slate-400 font-semibold">Loading showroom parties...</p>
        </div>
      ) : filteredParties.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
            <Users size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No parties found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No buyer, seller, or dealer matches your search."
              : "Start by registering your first customer, seller, or dealership."}
          </p>
          {!searchQuery && (
            <Button
              onClick={handleOpenAddModal}
              size="sm"
              className="mt-4 bg-violet-600 hover:bg-violet-700 text-white font-bold"
            >
              <PlusCircle size={14} className="mr-1.5" />
              Add First Party
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParties.map((p) => {
            const isDealer = p.is_dealer_showroom;
            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Photo or Avatar */}
                      <div className="relative w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {p.photo_url ? (
                          <img
                            src={p.photo_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as any).src = "";
                            }}
                          />
                        ) : isDealer ? (
                          <Building2 size={24} className="text-amber-600" />
                        ) : (
                          <User size={24} className="text-violet-600" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-black text-slate-900 tracking-tight">
                            {p.name}
                          </h3>
                          {isDealer && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              DEALER / شو روم
                            </span>
                          )}
                        </div>

                        {!isDealer && p.father_name && (
                          <p className="text-xs text-slate-500">
                            ولدیت: <span className="font-semibold text-slate-700">{p.father_name}</span>
                            {p.caste ? ` (${p.caste})` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Party Type Badge */}
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        p.party_type === "buyer"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : p.party_type === "seller"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}
                    >
                      {p.party_type}
                    </span>
                  </div>

                  {/* Details List */}
                  <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    {p.cnic && (
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-slate-400 shrink-0" />
                        <span className="font-mono font-semibold text-slate-800">{p.cnic}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <a
                          href={`tel:${p.phone}`}
                          className="font-semibold text-slate-800 hover:text-violet-600"
                        >
                          {p.phone}
                        </a>
                      </div>

                      {p.whatsapp && (
                        <a
                          href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                          title="Open WhatsApp"
                        >
                          <Share2 size={13} />
                        </a>
                      )}
                    </div>

                    {p.address && (
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-600 line-clamp-1">
                          {p.address} ({p.city || "Lahore"})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer / Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    Registered: {new Date(p.created_at || Date.now()).toLocaleDateString("en-PK")}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(p)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition"
                      title="Edit Profile"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete Party"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Party Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-600/30 text-violet-300">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">
                      {editingParty ? "Edit Party Profile" : "Register New Customer / Dealer"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Pakistani legal profile, photo, CNIC scans & contact details
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

              {/* Modal Form */}
              <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {/* 1. Party Type & Showroom Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Party Role (پارٹی کا کردار)
                    </label>
                    <select
                      value={formData.party_type}
                      onChange={(e) =>
                        setFormData({ ...formData, party_type: e.target.value as PartyType })
                      }
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="buyer">Buyer / Customer (گاہک / خریدار)</option>
                      <option value="seller">Seller / Supplier (فروخت کنندہ)</option>
                      <option value="both">Both (خریدار و فروخت کنندہ)</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.is_dealer_showroom}
                        onChange={(e) =>
                          setFormData({ ...formData, is_dealer_showroom: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Is Showroom / Dealer (ڈیلر یا شو روم ہے)
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Tick if trading with an authorized vehicle dealership
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* 2. Photo & Basic Info */}
                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                  {/* Photo Box */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center group">
                      {formData.photo_url ? (
                        <img
                          src={formData.photo_url}
                          alt="Party"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2 text-slate-400">
                          <Camera size={24} className="mx-auto mb-1" />
                          <span className="text-[9px] font-bold">Photo (تصویر)</span>
                        </div>
                      )}

                      {/* Hover Upload Button */}
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="absolute inset-0 bg-slate-950/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold transition"
                      >
                        {uploadingPhoto ? <Loader2 className="animate-spin" size={16} /> : "Change"}
                      </button>
                    </div>

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
                      className="text-[11px] h-7 px-2 font-bold"
                    >
                      {uploadingPhoto ? <Loader2 className="animate-spin mr-1" size={12} /> : <Upload size={12} className="mr-1" />}
                      Upload Photo
                    </Button>
                  </div>

                  {/* Primary Inputs */}
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {formData.is_dealer_showroom
                          ? "Showroom / Dealer Name (شو روم یا ڈیلر کا نام) *"
                          : "Full Name (مکمل نام) *"}
                      </label>
                      <Input
                        required
                        placeholder={
                          formData.is_dealer_showroom
                            ? "e.g., Al-Madina Motors / Usman Traders"
                            : "e.g., Muhammad Usman"
                        }
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="font-semibold"
                      />
                    </div>

                    {!formData.is_dealer_showroom && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Father's Name (والد کا نام)
                          </label>
                          <Input
                            placeholder="e.g., Muhammad Ramzan"
                            value={formData.father_name}
                            onChange={(e) =>
                              setFormData({ ...formData, father_name: e.target.value })
                            }
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Caste / Quom (قوم / برادری)
                          </label>
                          <Input
                            placeholder="e.g., Arain, Rajput, Jatt, Gujjar"
                            value={formData.caste}
                            onChange={(e) => setFormData({ ...formData, caste: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Identity & Contact Information */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      CNIC Number (شناختی کارڈ نمبر)
                    </label>
                    <Input
                      placeholder="e.g., 35202-1234567-1"
                      value={formData.cnic}
                      onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mobile Phone (موبائل نمبر) *
                    </label>
                    <Input
                      required
                      placeholder="e.g., 0300-1234567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Number (واٹس ایپ)
                    </label>
                    <Input
                      placeholder="e.g., 0300-1234567"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </div>

                {/* 4. Address & City */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City (شہر)</label>
                    <Input
                      placeholder="e.g., Lahore"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Address (مکمل پتہ)
                    </label>
                    <Input
                      placeholder="e.g., House #12, Street 4, Gulberg, Lahore"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>

                {/* 5. CNIC Documents Upload (Optional) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-violet-600" />
                      CNIC Scans & Documents (شناختی کارڈ کی تصاویر - اختیاری)
                    </span>
                    <span className="text-[10px] text-slate-400">Auto-compressed to Google Drive</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Front */}
                    <div className="border border-slate-200 rounded-xl p-2.5 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {formData.cnic_front_url ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : (
                          <FileText size={16} className="text-slate-400" />
                        )}
                        <span className="text-xs font-medium text-slate-700">CNIC Front</span>
                      </div>
                      <input
                        type="file"
                        ref={cnicFrontInputRef}
                        onChange={handleCnicFrontUpload}
                        accept="image/*,application/pdf"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cnicFrontInputRef.current?.click()}
                        disabled={uploadingCnicFront}
                        className="text-[10px] h-7 px-2"
                      >
                        {uploadingCnicFront ? <Loader2 className="animate-spin" size={12} /> : "Upload"}
                      </Button>
                    </div>

                    {/* Back */}
                    <div className="border border-slate-200 rounded-xl p-2.5 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {formData.cnic_back_url ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : (
                          <FileText size={16} className="text-slate-400" />
                        )}
                        <span className="text-xs font-medium text-slate-700">CNIC Back</span>
                      </div>
                      <input
                        type="file"
                        ref={cnicBackInputRef}
                        onChange={handleCnicBackUpload}
                        accept="image/*,application/pdf"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cnicBackInputRef.current?.click()}
                        disabled={uploadingCnicBack}
                        className="text-[10px] h-7 px-2"
                      >
                        {uploadingCnicBack ? <Loader2 className="animate-spin" size={12} /> : "Upload"}
                      </Button>
                    </div>
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
                    {editingParty ? "Update Profile" : "Save Party Profile"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
