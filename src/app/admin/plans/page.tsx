"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Save, Trash2, Edit2, Sliders, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPlatformShopId } from "@/lib/config";

interface SaaSPlan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  monthly_price_usd?: number;
  yearly_price_usd?: number;
  allow_trial: boolean;
  trial_days: number;
  allow_simple_accounts: boolean;
  allow_industrial_accounts: boolean;
  allow_sales_purchases: boolean;
  allow_whatsapp: boolean;
  allow_emi: boolean;
  allow_credits: boolean;
  allow_pdf: boolean;
  allow_backup: boolean;
  allow_payroll: boolean;
  allow_tax: boolean;
  allow_assets: boolean;
  allow_user_roles: boolean;
  allow_inventory: boolean;
  allow_barcode: boolean;
  allow_multi_shop: boolean;
  allow_universal_import: boolean;
  allow_ai_product_add: boolean;
  allow_ai_purchase_order: boolean;
  max_devices: "1" | "3" | "unlimited";
  platforms: {
    mobile: boolean;
    desktop: boolean;
    web: boolean;
  };
}

export default function AdminPlansPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  // Form State for creating/editing plan
  const [formState, setFormState] = useState<SaaSPlan>({
    id: "",
    name: "",
    monthly_price: 0,
    yearly_price: 0,
    monthly_price_usd: 0,
    yearly_price_usd: 0,
    allow_trial: false,
    trial_days: 7,
    allow_simple_accounts: true,
    allow_industrial_accounts: true,
    allow_sales_purchases: true,
    allow_whatsapp: false,
    allow_emi: false,
    allow_credits: true,
    allow_pdf: true,
    allow_backup: false,
    allow_payroll: false,
    allow_tax: false,
    allow_assets: false,
    allow_user_roles: true,
    allow_inventory: true,
    allow_barcode: true,
    allow_multi_shop: true,
    allow_universal_import: true,
    allow_ai_product_add: true,
    allow_ai_purchase_order: true,
    max_devices: "1",
    platforms: {
      mobile: true,
      desktop: true,
      web: true
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadPlansConfig();
  }, []);

  const loadPlansConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("company_details")
        .select("website")
        .eq("shop_id", getPlatformShopId()) // Super admin shop
        .limit(1);

      const configRow = data?.[0];
      if (configRow && configRow.website && configRow.website.startsWith("{")) {
        try {
          const parsed = JSON.parse(configRow.website);
          if (parsed.saas_plans && Array.isArray(parsed.saas_plans)) {
            setPlans(parsed.saas_plans);
            setLoading(false);
            return;
          }
        } catch (e) {}
      }

      // Default fallback plans if none stored yet
      const defaultPlans: SaaSPlan[] = [
        {
          id: "free",
          name: "Free Trial Plan",
          monthly_price: 0,
          yearly_price: 0,
          allow_trial: true,
          trial_days: 14,
          allow_simple_accounts: true, // Free has customer panel/simple accounts
          allow_industrial_accounts: false, // Free does not have advanced ledger
          allow_sales_purchases: true,
          allow_whatsapp: false, // Free does not have whatsapp alerts
          allow_emi: false,
          allow_credits: true,
          allow_pdf: true,
          allow_backup: false,
          allow_payroll: false,
          allow_tax: false,
          allow_assets: false,
          allow_user_roles: false,
          allow_inventory: true,
          allow_barcode: false,
          allow_multi_shop: false,
          allow_universal_import: false,
          allow_ai_product_add: false,
          allow_ai_purchase_order: false,
          max_devices: "1", // Single device
          platforms: {
            mobile: true,
            desktop: true,
            web: false
          }
        },
        {
          id: "starter",
          name: "Starter Plan",
          monthly_price: 1500,
          yearly_price: 15000,
          allow_trial: true,
          trial_days: 7,
          allow_simple_accounts: true,
          allow_industrial_accounts: true,
          allow_sales_purchases: true,
          allow_whatsapp: false,
          allow_emi: true,
          allow_credits: true,
          allow_pdf: true,
          allow_backup: true,
          allow_payroll: false,
          allow_tax: false,
          allow_assets: false,
          allow_user_roles: true,
          allow_inventory: true,
          allow_barcode: true,
          allow_multi_shop: false,
          allow_universal_import: true,
          allow_ai_product_add: false,
          allow_ai_purchase_order: false,
          max_devices: "3",
          platforms: {
            mobile: true,
            desktop: true,
            web: true
          }
        },
        {
          id: "premium",
          name: "Premium POS ERP",
          monthly_price: 3500,
          yearly_price: 35000,
          allow_trial: false,
          trial_days: 0,
          allow_simple_accounts: true,
          allow_industrial_accounts: true,
          allow_sales_purchases: true,
          allow_whatsapp: true,
          allow_emi: true,
          allow_credits: true,
          allow_pdf: true,
          allow_backup: true,
          allow_payroll: true,
          allow_tax: true,
          allow_assets: true,
          allow_user_roles: true,
          allow_inventory: true,
          allow_barcode: true,
          allow_multi_shop: true,
          allow_universal_import: true,
          allow_ai_product_add: true,
          allow_ai_purchase_order: true,
          max_devices: "unlimited",
          platforms: {
            mobile: true,
            desktop: true,
            web: true
          }
        }
      ];
      setPlans(defaultPlans);
    } catch (err: any) {
      toast.error("Failed to load plans config: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDatabase = async (updatedPlans: SaaSPlan[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saas_plans: updatedPlans })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save plans");

      toast.success("SaaS plans saved and updated dynamically!");
    } catch (err: any) {
      toast.error("Failed to save plans configuration: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrUpdatePlan = () => {
    if (!formState.name.trim()) {
      toast.error("Please enter a valid plan name.");
      return;
    }

    let updatedPlans: SaaSPlan[] = [];
    if (activeEditId) {
      updatedPlans = plans.map(p => p.id === activeEditId ? { ...formState } : p);
    } else {
      const newPlan: SaaSPlan = {
        ...formState,
        id: "plan_" + Date.now()
      };
      updatedPlans = [...plans, newPlan];
    }

    setPlans(updatedPlans);
    setIsModalOpen(false);
    setActiveEditId(null);
    handleSaveToDatabase(updatedPlans);
  };

  const handleEditPlan = (plan: SaaSPlan) => {
    setActiveEditId(plan.id);
    setFormState(plan);
    setIsModalOpen(true);
  };

  const handleDeletePlan = (planId: string) => {
    const updatedPlans = plans.filter(p => p.id !== planId);
    setPlans(updatedPlans);
    handleSaveToDatabase(updatedPlans);
  };

  const handleOpenCreateModal = () => {
    setActiveEditId(null);
    setFormState({
      id: "",
      name: "",
      monthly_price: 0,
      yearly_price: 0,
      monthly_price_usd: 0,
      yearly_price_usd: 0,
      allow_trial: false,
      trial_days: 7,
      allow_simple_accounts: true,
      allow_industrial_accounts: true,
      allow_sales_purchases: true,
      allow_whatsapp: false,
      allow_emi: false,
      allow_credits: true,
      allow_pdf: true,
      allow_backup: false,
      allow_payroll: false,
      allow_tax: false,
      allow_assets: false,
      allow_user_roles: true,
      allow_inventory: true,
      allow_barcode: true,
      allow_multi_shop: true,
      allow_universal_import: true,
      allow_ai_product_add: true,
      allow_ai_purchase_order: true,
      max_devices: "1",
      platforms: {
        mobile: true,
        desktop: true,
        web: true
      }
    });
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col justify-center items-center text-slate-450">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650 mb-2" />
        <p className="text-xs font-semibold">Loading SaaS plan configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders size={18} className="text-indigo-600" /> SaaS Plans Configuration
          </h2>
          <p className="text-xs text-slate-455 mt-0.5">Define feature matrices, pricing packages, and limitations for subscription levels.</p>
        </div>

        <Button
          onClick={handleOpenCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md flex items-center gap-1.5 w-fit"
        >
          <Plus size={15} /> Make SaaS Plan
        </Button>
      </div>

      {/* Grid of existing plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="bg-white border border-slate-200/80 shadow-md hover:shadow-lg transition-all rounded-3xl p-6 flex flex-col justify-between space-y-5 hover:scale-[1.01] duration-200">
            <div>
              <div className="flex justify-between items-start gap-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">{plan.name}</h3>
                  <p className="text-[10px] text-indigo-600 font-black uppercase tracking-wider mt-1">
                    {plan.monthly_price === 0 ? "Free Access" : `Rs ${plan.monthly_price.toLocaleString()}/mo`}
                  </p>
                  {plan.monthly_price_usd ? (
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">${plan.monthly_price_usd}/mo USD</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => handleEditPlan(plan)} className="p-2 bg-slate-50 text-slate-600 hover:text-indigo-650 hover:bg-indigo-50 border border-slate-200/60 rounded-xl shadow-sm transition-all">
                    <Edit2 size={12} />
                  </button>
                  {plan.id !== "free" && plan.id !== "starter" && plan.id !== "premium" && (
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-2 bg-red-50 text-red-650 hover:text-red-700 border border-slate-200 rounded-xl shadow-sm transition-all">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Lists of enabled modules */}
              <div className="mt-4 space-y-2.5 text-[10px] font-bold text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Simple Customer Accounts:</span>
                  <span className={plan.allow_simple_accounts ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_simple_accounts ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Industrial Accounts Ledger:</span>
                  <span className={plan.allow_industrial_accounts ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_industrial_accounts ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Sales & Purchases Matrix:</span>
                  <span className={plan.allow_sales_purchases ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_sales_purchases ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Staff Roles & Control:</span>
                  <span className={plan.allow_user_roles ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_user_roles ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Inventory Control & Alert:</span>
                  <span className={plan.allow_inventory ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_inventory ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Barcode Generation & Print:</span>
                  <span className={plan.allow_barcode ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_barcode ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Multi-Shop Manager:</span>
                  <span className={plan.allow_multi_shop ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_multi_shop ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Universal Products Import:</span>
                  <span className={plan.allow_universal_import ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_universal_import ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>AI Product Add (OCR):</span>
                  <span className={plan.allow_ai_product_add ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_ai_product_add ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>AI Auto Purchase Order:</span>
                  <span className={plan.allow_ai_purchase_order ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_ai_purchase_order ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>WhatsApp Alerts:</span>
                  <span className={plan.allow_whatsapp ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_whatsapp ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Device Limits:</span>
                  <span className="text-slate-800 capitalize font-mono text-[9px] px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">{plan.max_devices} Device</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>EMI / Installments:</span>
                  <span className={plan.allow_emi ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_emi ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>Free Trial Period:</span>
                  <span className={plan.allow_trial ? "text-indigo-650 font-bold" : "text-slate-500"}>
                    {plan.allow_trial ? `${plan.trial_days} Days Free` : "No Trial"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Cloud Backup Logs:</span>
                  <span className={plan.allow_backup ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>
                    {plan.allow_backup ? "✓ Active" : "✕ Blocked"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-100 text-[9px] text-slate-400 font-semibold leading-relaxed flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-500" /> Auto-synchronized to corresponding subscription tiers.
            </div>
          </div>
        ))}
      </div>

      {/* Plans Configurer Modal / Overlay Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] select-none">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar space-y-6">
            
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-black text-slate-850 uppercase tracking-wider">
                {activeEditId ? "Modify SaaS Plan Configuration" : "Configure New SaaS Plan Parameters"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-xs text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕ Close
              </button>
            </div>

            {/* Basic details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">Plan Display Name</label>
                <Input
                  value={formState.name}
                  onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Premium ERP"
                  className="h-8.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">Monthly Cost (PKR) 🇵🇰</label>
                <Input
                  type="number"
                  value={formState.monthly_price}
                  onChange={(e) => setFormState(prev => ({ ...prev, monthly_price: Number(e.target.value) }))}
                  className="h-8.5 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">Yearly Cost (PKR) 🇵🇰</label>
                <Input
                  type="number"
                  value={formState.yearly_price}
                  onChange={(e) => setFormState(prev => ({ ...prev, yearly_price: Number(e.target.value) }))}
                  className="h-8.5 text-xs"
                />
              </div>
            </div>

            {/* USD International Pricing */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🌍</span>
                <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">International Pricing (USD)</h4>
                <span className="text-[9px] text-emerald-600 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">For non-Pakistan users</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700">Monthly Price ($USD)</label>
                  <Input
                    type="number"
                    value={formState.monthly_price_usd || 0}
                    onChange={(e) => setFormState(prev => ({ ...prev, monthly_price_usd: Number(e.target.value) }))}
                    placeholder="e.g. 12"
                    className="h-8.5 text-xs border-emerald-200 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700">Yearly Price ($USD)</label>
                  <Input
                    type="number"
                    value={formState.yearly_price_usd || 0}
                    onChange={(e) => setFormState(prev => ({ ...prev, yearly_price_usd: Number(e.target.value) }))}
                    placeholder="e.g. 120"
                    className="h-8.5 text-xs border-emerald-200 bg-white"
                  />
                </div>
              </div>
              <p className="text-[9px] text-emerald-600 font-semibold">💡 Leave at 0 to hide plan for international users. These prices show when country is not Pakistan.</p>
            </div>

            {/* Core Feature Access Switches */}
            <div className="space-y-4 pt-3 border-t">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Configure Access Constraints</h4>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                
                {/* Simple Accounts */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_simple_accounts}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_simple_accounts: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Simple Accounts</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Allows basic Customer and Supplier Khata Ledgers.</span>
                  </div>
                </label>

                {/* Industrial Accounts */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_industrial_accounts}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_industrial_accounts: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Advanced Industrial Accounts</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Double-entry ledger, Cash/Bank books, & Profit/Loss.</span>
                  </div>
                </label>

                {/* POS Sales & Purchase */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_sales_purchases}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_sales_purchases: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Sales & Purchases Matrix</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">POS billing and supplier tracking.</span>
                  </div>
                </label>

                {/* WhatsApp & Alerts */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_whatsapp}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_whatsapp: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">WhatsApp Alert messaging</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Send transaction messages automatically.</span>
                  </div>
                </label>

                {/* EMI Logs */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_emi}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_emi: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Installments / EMI Module</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Track customer installments schemas.</span>
                  </div>
                </label>

                {/* Backup & PDF */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_pdf}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_pdf: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">PDF Invoices Download</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Export bills and reports to PDF.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_backup}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_backup: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Cloud Backup & Recovery</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Secure auto backups to database logs.</span>
                  </div>
                </label>

                {/* Payroll, Tax, Assets */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_payroll}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_payroll: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Staff Payroll Tracker</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Advanced salary and attendance logs.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_tax}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_tax: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Taxation Matrix Setup</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Apply custom taxes on billing desks.</span>
                  </div>
                </label>

                {/* User Roles */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_user_roles}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_user_roles: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">User Role-Based Access</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Custom staff permissions and salesman controls.</span>
                  </div>
                </label>

                {/* Inventory Control */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_inventory}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_inventory: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Inventory Control & Stock</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Negative stock override and min stock warnings.</span>
                  </div>
                </label>

                {/* Barcode Printing */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_barcode}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_barcode: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Barcode Label Printing</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Generate and print custom item barcodes.</span>
                  </div>
                </label>

                {/* Multi Shop Switcher */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_multi_shop}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_multi_shop: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Multi-Shop Switcher</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Create and toggle between multiple businesses.</span>
                  </div>
                </label>

                {/* Universal Product Import */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_universal_import}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_universal_import: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Universal Products Import</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Import industry templates and catalog datasets.</span>
                  </div>
                </label>

                {/* AI Product Add */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_ai_product_add}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_ai_product_add: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">AI Product Scan & Add</span>
                    <span className="text-[9.5px] text-slate-500 font-semibold block mt-0.5 leading-relaxed">
                      Upload store bill photos to extract product names, scan stock photos, or select from interactive AI suggestions to set prices.
                    </span>
                  </div>
                </label>

                {/* AI Auto Purchase Order */}
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50">
                  <input
                    type="checkbox"
                    checked={formState.allow_ai_purchase_order}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_ai_purchase_order: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">AI Auto Purchase Orders (Bill Scanner)</span>
                    <span className="text-[9.5px] text-slate-500 font-semibold block mt-0.5 leading-relaxed">
                      Upload supplier purchasing bills to automatically parse and add items to purchase orders, requesting verification before posting.
                    </span>
                  </div>
                </label>

              </div>
            </div>

            {/* Limitations configuration */}
            <div className="space-y-4 pt-3 border-t">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Configure Hardware & Platforms limits</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">Max Allowed Active Devices</label>
                  <select
                    value={formState.max_devices}
                    onChange={(e) => setFormState(prev => ({ ...prev, max_devices: e.target.value as any }))}
                    className="bg-slate-55 border border-slate-200 h-9 rounded-lg px-2 text-xs font-semibold cursor-pointer w-full focus:outline-none"
                  >
                    <option value="1">1 Device Limit</option>
                    <option value="3">3 Devices Limit</option>
                    <option value="unlimited">Unlimited Devices Allowed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">Supported Platform Apps</label>
                  <div className="flex gap-4 items-center h-9 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-650">
                      <input
                        type="checkbox"
                        checked={formState.platforms.mobile}
                        onChange={(e) => setFormState(prev => ({ 
                          ...prev, 
                          platforms: { ...prev.platforms, mobile: e.target.checked } 
                        }))}
                        className="h-3.5 w-3.5 rounded text-indigo-600"
                      /> Mobile App
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-650">
                      <input
                        type="checkbox"
                        checked={formState.platforms.desktop}
                        onChange={(e) => setFormState(prev => ({ 
                          ...prev, 
                          platforms: { ...prev.platforms, desktop: e.target.checked } 
                        }))}
                        className="h-3.5 w-3.5 rounded text-indigo-600"
                      /> Desktop App
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-650">
                      <input
                        type="checkbox"
                        checked={formState.platforms.web}
                        onChange={(e) => setFormState(prev => ({ 
                          ...prev, 
                          platforms: { ...prev.platforms, web: e.target.checked } 
                        }))}
                        className="h-3.5 w-3.5 rounded text-indigo-600"
                      /> Web Browser
                    </label>
                  </div>
                </div>
              </div>

            {/* Free Trial Settings */}
            <div className="space-y-4 pt-3 border-t">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Configure Free Trial Offers</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100/50 text-xs">
                  <input
                    type="checkbox"
                    checked={formState.allow_trial}
                    onChange={(e) => setFormState(prev => ({ ...prev, allow_trial: e.target.checked }))}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-700 block">Offer Free Trial Period</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Let users test this plan before purchasing.</span>
                  </div>
                </label>

                {formState.allow_trial && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Trial Period Duration (Days)</label>
                    <Input
                      type="number"
                      value={formState.trial_days}
                      onChange={(e) => setFormState(prev => ({ ...prev, trial_days: Number(e.target.value) }))}
                      placeholder="7"
                      className="h-9 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 text-xs border-slate-200 text-slate-600 font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrUpdatePlan}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-5 flex items-center gap-1.5 rounded-xl shadow-md"
              >
                <Save size={14} /> Save Plan Configuration
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
