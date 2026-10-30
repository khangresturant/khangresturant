"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, Plus, Search, Filter, Calendar, Clock,
  CheckCircle, AlertTriangle, Download, MessageSquare,
  Building2, Layers, RefreshCw, FileText, Loader2, ArrowUpRight,
  ShieldAlert, ShieldCheck
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewClaimModal } from "./_components/NewClaimModal";
import { ClaimDetailModal, ClaimRecord } from "./_components/ClaimDetailModal";

export default function PharmacyClaimsPage() {
  const { shopId, shopName } = useShop();
  const supabase = createClient();

  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [isNewClaimOpen, setIsNewClaimOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRecord | null>(null);

  useEffect(() => {
    if (shopId) {
      fetchClaims();
    }
  }, [shopId]);

  const fetchClaims = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("supplier_expiry_claims")
        .select("*")
        .eq("shop_id", shopId)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setClaims(data || []);
    } catch (err: any) {
      toast.error("Failed to load expiry claims: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let pendingCount = 0;
    let pendingAmount = 0;
    let approvedCount = 0;
    let approvedAmount = 0;
    let settledAmount = 0;

    claims.forEach((c) => {
      if (c.status === "submitted") {
        pendingCount++;
        pendingAmount += Number(c.total_claimed_amount) || 0;
      } else if (c.status === "approved") {
        approvedCount++;
        approvedAmount += Number(c.approved_amount || c.total_claimed_amount) || 0;
      } else if (c.status === "adjusted") {
        settledAmount += Number(c.approved_amount || c.total_claimed_amount) || 0;
      }
    });

    return {
      totalClaims: claims.length,
      pendingCount,
      pendingAmount,
      approvedCount,
      approvedAmount,
      settledAmount,
    };
  }, [claims]);

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.claim_number.toLowerCase().includes(q) ||
          c.supplier_name.toLowerCase().includes(q) ||
          (c.booker_name && c.booker_name.toLowerCase().includes(q)) ||
          (c.credit_note_number && c.credit_note_number.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [claims, statusFilter, searchQuery]);

  return (
    <div className="space-y-5 font-sans text-slate-800 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl text-white shadow-md shadow-rose-200">
              <Truck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Distributor Expiry Return & Claim Register
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Generate delivery gate passes, quarantine batch stock, and track company credit notes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchClaims()}
            variant="outline"
            size="sm"
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>

          <Button
            onClick={() => setIsNewClaimOpen(true)}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black text-xs shadow-md shadow-rose-200 cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={14} /> + Create Expiry Claim / Gate Pass
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Claims */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Total Claims</p>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{metrics.totalClaims} Claims</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Lifetime Handover Log</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600">
            <FileText size={20} />
          </div>
        </div>

        {/* Pending with Booker */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold text-amber-600 uppercase tracking-wider">Pending with Booker</p>
            <h3 className="text-xl font-black text-amber-700 font-mono mt-0.5">
              Rs {Math.round(metrics.pendingAmount).toLocaleString()}
            </h3>
            <p className="text-[11px] text-amber-600/80 mt-0.5">{metrics.pendingCount} Claims Awaiting CN</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-amber-600">
            <Clock size={20} />
          </div>
        </div>

        {/* Approved Credit Notes */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold text-blue-600 uppercase tracking-wider">Approved Credit Notes</p>
            <h3 className="text-xl font-black text-blue-700 font-mono mt-0.5">
              Rs {Math.round(metrics.approvedAmount).toLocaleString()}
            </h3>
            <p className="text-[11px] text-blue-600/80 mt-0.5">{metrics.approvedCount} CN Ready for Bill</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600">
            <CheckCircle size={20} />
          </div>
        </div>

        {/* Settled in Purchases */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-bold text-emerald-600 uppercase tracking-wider">Settled in Bills</p>
            <h3 className="text-xl font-black text-emerald-700 font-mono mt-0.5">
              Rs {Math.round(metrics.settledAmount).toLocaleString()}
            </h3>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Adjusted in Purchase Bills</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-600">
            <ShieldCheck size={20} />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
          {[
            { id: "all", label: `All (${claims.length})` },
            { id: "submitted", label: `🟡 Submitted (${metrics.pendingCount})` },
            { id: "approved", label: `🔵 Approved CN (${metrics.approvedCount})` },
            { id: "adjusted", label: "🟢 Settled" },
            { id: "rejected", label: "🔴 Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search claim #, distributor, booker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8.5 text-xs bg-slate-50"
          />
        </div>
      </div>

      {/* Claims List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <Loader2 className="mx-auto h-8 w-8 text-rose-600 animate-spin mb-2" />
            <p className="text-xs font-bold text-slate-600">Loading claims register...</p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <div className="h-14 w-14 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Truck size={28} />
            </div>
            <h3 className="text-base font-black text-slate-800">No Expiry Return Claims Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              When near-expiry or expired medicines are handed over to delivery boys, create a claim note to track credit notes.
            </p>
            <Button
              onClick={() => setIsNewClaimOpen(true)}
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl"
            >
              + Create First Claim Note
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-100/80 text-[11px] font-black uppercase text-slate-700 border-b border-slate-200">
                  <th className="p-3.5">Claim #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Distributor / Supplier</th>
                  <th className="p-3.5">Delivery Booker</th>
                  <th className="p-3.5 text-center">Items</th>
                  <th className="p-3.5 text-right">Claim Amount</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredClaims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Claim # */}
                    <td className="p-3.5">
                      <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                        {c.claim_number}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                      {new Date(c.submitted_at).toLocaleDateString()}
                    </td>

                    {/* Distributor */}
                    <td className="p-3.5 font-extrabold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-400 shrink-0" />
                        <span>{c.supplier_name}</span>
                      </div>
                    </td>

                    {/* Booker */}
                    <td className="p-3.5 text-slate-600">
                      {c.booker_name ? (
                        <div>
                          <p className="font-bold text-slate-800 text-[11.5px]">{c.booker_name}</p>
                          {c.booker_phone && (
                            <p className="font-mono text-[10.5px] text-slate-400">{c.booker_phone}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Delivery Rep</span>
                      )}
                    </td>

                    {/* Total Items */}
                    <td className="p-3.5 text-center font-bold font-mono">
                      {c.total_items}
                    </td>

                    {/* Claim Amount */}
                    <td className="p-3.5 text-right font-black font-mono text-slate-900 text-xs">
                      Rs {Math.round(c.total_claimed_amount).toLocaleString()}
                      {c.credit_note_number && (
                        <span className="block text-[9.5px] text-blue-600 font-normal">
                          CN: {c.credit_note_number}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                          c.status === "approved"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : c.status === "adjusted"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.status === "rejected"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {c.status === "submitted" ? "🟡 Submitted" : c.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <Button
                        onClick={() => setSelectedClaim(c)}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-bold rounded-lg border-slate-200 hover:bg-slate-100 text-slate-800 cursor-pointer"
                      >
                        View & PDF <ArrowUpRight size={12} className="ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewClaimModal
        isOpen={isNewClaimOpen}
        onClose={() => setIsNewClaimOpen(false)}
        shopId={shopId || ""}
        shopName={shopName || "Pharmacy"}
        onClaimCreated={() => fetchClaims()}
      />

      <ClaimDetailModal
        isOpen={!!selectedClaim}
        onClose={() => setSelectedClaim(null)}
        claim={selectedClaim}
        shopId={shopId || ""}
        shopName={shopName || "Pharmacy"}
        onStatusUpdated={() => fetchClaims()}
      />
    </div>
  );
}
