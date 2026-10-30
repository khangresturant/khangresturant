"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, Save, Landmark, ToggleLeft, ToggleRight, Sparkles, Key, CreditCard, Upload, X, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPlatformShopId } from "@/lib/config";

export default function AdminGatewaysPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const platformShopId = getPlatformShopId();

  // Gateway config states — no secrets hardcoded (load from platform config)
  const [gatewaySettings, setGatewaySettings] = useState({
    jazzcash_active: false,
    jazzcash_till: "",
    jazzcash_account_title: "",
    jazzcash_qr_url: "",
    easypaisa_active: false,
    easypaisa_wallet: "",
    easypaisa_account_title: "",
    easypaisa_qr_url: "",
    bank_active: false,
    bank_name: "",
    bank_account_num: "",
    bank_account_title: "",
    bank_iban: "",
    bank_qr_url: "",
    stripe_active: false,
    stripe_publishable_key: "",
    stripe_secret_key: "",
    paypal_active: false,
    paypal_client_id: "",
    safepay_active: false,
    safepay_api_key: "",
    safepay_secret_key: "",
    safepay_sandbox: true,
    monthly_price_pkr: 3500,
    yearly_price_pkr: 35000,
    monthly_price_usd: 12,
    yearly_price_usd: 120,
    // Country Routing
    pk_gateways: ["jazzcash", "easypaisa", "bank"],
    global_gateways: ["stripe"],
    global_gemini_api_keys: "",
    global_gemini_model: "gemini-3.5-flash-lite"
  });

  const [uploadingQr, setUploadingQr] = useState<string | null>(null);

  const handleQrUpload = async (file: File, fieldName: string) => {
    setUploadingQr(fieldName);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", fieldName);
      const res = await fetch("/api/admin-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGatewaySettings(prev => ({ ...prev, [fieldName]: data.url }));
      toast.success("QR code uploaded! Click Save to apply.");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploadingQr(null);
    }
  };

  useEffect(() => {
    loadGatewaySettings();
  }, []);

  const loadGatewaySettings = async () => {
    setLoading(true);
    try {
      if (!platformShopId) {
        toast.error("NEXT_PUBLIC_PLATFORM_SHOP_ID is not configured");
        return;
      }
      const { data } = await supabase
        .from("company_details")
        .select("website")
        .eq("shop_id", platformShopId)
        .limit(1);

      const configRow = data?.[0];
      if (configRow && configRow.website && configRow.website.startsWith("{")) {
        try {
          const parsed = JSON.parse(configRow.website);
          setGatewaySettings(prev => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    } catch (err: any) {
      toast.error("Failed to load gateway configurations: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGateways = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/platform-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gatewaySettings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save gateways");

      toast.success("Billing and gateway settings updated successfully!");
    } catch (err: any) {
      toast.error("Failed to save gateway details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col justify-center items-center text-slate-450">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650 mb-2" />
        <p className="text-xs font-semibold">Loading gateway parameters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider">Billing Settings & Gateways</h2>
          <p className="text-xs text-slate-450 mt-0.5">Configure active payment methods and core subscription rates.</p>
        </div>
      </div>

      <div className="bg-white space-y-6">
        
        {/* Core Prices Config Card */}
        <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-3xl space-y-4">
          <div className="border-b pb-3 flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CreditCard size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">SaaS Billing Base Rates</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Configure default rates shown during checkouts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-650 uppercase tracking-wider">Monthly Price (PKR) 🇵🇰</label>
              <Input
                type="number"
                value={gatewaySettings.monthly_price_pkr}
                onChange={(e) => setGatewaySettings(prev => ({ ...prev, monthly_price_pkr: Number(e.target.value) }))}
                className="h-10 text-xs border-slate-200 bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-650 uppercase tracking-wider">Yearly Price (PKR) 🇵🇰</label>
              <Input
                type="number"
                value={gatewaySettings.yearly_price_pkr}
                onChange={(e) => setGatewaySettings(prev => ({ ...prev, yearly_price_pkr: Number(e.target.value) }))}
                className="h-10 text-xs border-slate-200 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Gemini API Keys Configuration Card */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-3xl space-y-4 shadow-sm border-l-4 border-l-indigo-650">
          <div className="border-b pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
                <Sparkles size={16} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">SaaS Global Gemini API Keys</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Bypass rate limits by configuring multiple global keys (round-robin rotation)</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-650 uppercase tracking-wider block">API Keys List (one key per line)</label>
              <textarea
                value={gatewaySettings.global_gemini_api_keys || ""}
                onChange={(e) => setGatewaySettings(prev => ({ ...prev, global_gemini_api_keys: e.target.value }))}
                placeholder="AIzaSyA...&#10;AIzaSyB...&#10;AIzaSyC..."
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs font-mono font-bold text-slate-755 focus:outline-none focus:border-indigo-650 transition"
              />
              <p className="text-[9.5px] text-slate-400 font-semibold mt-1">
                Enter multiple keys to cycle through them when parsing invoices or performing AI queries across all tenant shops.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-650 uppercase tracking-wider block">SaaS Global AI Model</label>
              <select
                value={gatewaySettings.global_gemini_model || "gemini-3.5-flash-lite"}
                onChange={(e) => setGatewaySettings(prev => ({ ...prev, global_gemini_model: e.target.value }))}
                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Recommended - High Limit)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Limit)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-3.6-flash">Gemini 3.6 Flash</option>
                <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
              </select>
              <p className="text-[9.5px] text-slate-400 font-semibold mt-2.5">
                Set which Gemini model version is used system-wide for bill scanning and invoice parsing.
              </p>
            </div>
          </div>
        </div>

        {/* Gateways Config Sections */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Landmark size={14} />
            </div>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Configure Channels</span>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            
            {/* EasyPaisa Instructions */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-xs font-extrabold text-slate-800">EasyPaisa Mobile Wallet</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGatewaySettings(prev => ({ ...prev, easypaisa_active: !prev.easypaisa_active }))}
                  className="text-slate-500 hover:text-indigo-600 transition"
                >
                  {gatewaySettings.easypaisa_active ? (
                    <ToggleRight className="text-emerald-500 h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
              {gatewaySettings.easypaisa_active && (
                <div className="space-y-3 max-w-md">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Account Title / Name</label>
                    <Input
                      value={gatewaySettings.easypaisa_account_title}
                      onChange={(e) => setGatewaySettings(prev => ({ ...prev, easypaisa_account_title: e.target.value }))}
                      placeholder="e.g. Muhammad Usman"
                      className="h-9 text-xs border-slate-200 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">EasyPaisa Mobile / Wallet Number</label>
                    <Input
                      value={gatewaySettings.easypaisa_wallet}
                      onChange={(e) => setGatewaySettings(prev => ({ ...prev, easypaisa_wallet: e.target.value }))}
                      placeholder="03XX-XXXXXXX"
                      className="h-9 text-xs border-slate-200 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1"><QrCode size={10} /> QR Code Image (optional)</label>
                    {gatewaySettings.easypaisa_qr_url ? (
                      <div className="flex items-center gap-2">
                        <img src={gatewaySettings.easypaisa_qr_url} alt="QR" className="h-16 w-16 rounded-lg border object-contain bg-white" />
                        <button onClick={() => setGatewaySettings(prev => ({ ...prev, easypaisa_qr_url: "" }))} className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1"><X size={12} /> Remove</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition w-fit">
                        {uploadingQr === "easypaisa_qr_url" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        Upload QR Code
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleQrUpload(e.target.files[0], "easypaisa_qr_url"); }} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* JazzCash Instructions */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <span className="text-xs font-extrabold text-slate-800">JazzCash Till ID Account</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGatewaySettings(prev => ({ ...prev, jazzcash_active: !prev.jazzcash_active }))}
                  className="text-slate-500 hover:text-indigo-650 transition"
                >
                  {gatewaySettings.jazzcash_active ? (
                    <ToggleRight className="text-emerald-500 h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
              {gatewaySettings.jazzcash_active && (
                <div className="space-y-3 max-w-md">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Account Title / Name</label>
                    <Input
                      value={gatewaySettings.jazzcash_account_title}
                      onChange={(e) => setGatewaySettings(prev => ({ ...prev, jazzcash_account_title: e.target.value }))}
                      placeholder="e.g. Muhammad Usman"
                      className="h-9 text-xs border-slate-200 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Till Merchant ID / Account Number</label>
                    <Input
                      value={gatewaySettings.jazzcash_till}
                      onChange={(e) => setGatewaySettings(prev => ({ ...prev, jazzcash_till: e.target.value }))}
                      placeholder="03XX-XXXXXXX or Till ID"
                      className="h-9 text-xs border-slate-200 bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1"><QrCode size={10} /> QR Code Image (optional)</label>
                    {gatewaySettings.jazzcash_qr_url ? (
                      <div className="flex items-center gap-2">
                        <img src={gatewaySettings.jazzcash_qr_url} alt="QR" className="h-16 w-16 rounded-lg border object-contain bg-white" />
                        <button onClick={() => setGatewaySettings(prev => ({ ...prev, jazzcash_qr_url: "" }))} className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1"><X size={12} /> Remove</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition w-fit">
                        {uploadingQr === "jazzcash_qr_url" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        Upload QR Code
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleQrUpload(e.target.files[0], "jazzcash_qr_url"); }} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bank Transfer Instructions */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <span className="text-xs font-extrabold text-slate-800">Bank Transfer details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGatewaySettings(prev => ({ ...prev, bank_active: !prev.bank_active }))}
                  className="text-slate-500 hover:text-indigo-650 transition"
                >
                  {gatewaySettings.bank_active ? (
                    <ToggleRight className="text-emerald-500 h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
              {gatewaySettings.bank_active && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Account Title / Name</label>
                      <Input
                        value={gatewaySettings.bank_account_title}
                        onChange={(e) => setGatewaySettings(prev => ({ ...prev, bank_account_title: e.target.value }))}
                        placeholder="e.g. Muhammad Usman"
                        className="h-9 text-xs border-slate-200 bg-slate-50/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bank Name</label>
                      <Input
                        value={gatewaySettings.bank_name}
                        onChange={(e) => setGatewaySettings(prev => ({ ...prev, bank_name: e.target.value }))}
                        placeholder="e.g. Meezan Bank"
                        className="h-9 text-xs border-slate-200 bg-slate-50/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Account Number</label>
                      <Input
                        value={gatewaySettings.bank_account_num}
                        onChange={(e) => setGatewaySettings(prev => ({ ...prev, bank_account_num: e.target.value }))}
                        placeholder="XXXX-XXXXXXX-X"
                        className="h-9 text-xs border-slate-200 bg-slate-50/50"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">IBAN Code</label>
                      <Input
                        value={gatewaySettings.bank_iban}
                        onChange={(e) => setGatewaySettings(prev => ({ ...prev, bank_iban: e.target.value }))}
                        placeholder="PK36MZNB0123456789012345"
                        className="h-9 text-xs border-slate-200 bg-slate-50/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1"><QrCode size={10} /> QR Code Image (optional)</label>
                    {gatewaySettings.bank_qr_url ? (
                      <div className="flex items-center gap-2">
                        <img src={gatewaySettings.bank_qr_url} alt="QR" className="h-16 w-16 rounded-lg border object-contain bg-white" />
                        <button onClick={() => setGatewaySettings(prev => ({ ...prev, bank_qr_url: "" }))} className="text-rose-500 hover:text-rose-700 text-xs flex items-center gap-1"><X size={12} /> Remove</button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition w-fit">
                        {uploadingQr === "bank_qr_url" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        Upload QR Code
                        <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleQrUpload(e.target.files[0], "bank_qr_url"); }} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Safepay Integration Settings */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm border-l-4 border-l-indigo-600">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-800 uppercase block">Safepay hosted Redirection Integration</span>
                  <span className="text-[9px] text-slate-400 font-bold block">Redirection endpoint for automated Visa/Mastercard payments</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGatewaySettings(prev => ({ ...prev, safepay_active: !prev.safepay_active }))}
                  className="text-slate-500 hover:text-indigo-650 transition"
                >
                  {gatewaySettings.safepay_active ? (
                    <ToggleRight className="text-emerald-500 h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
              {gatewaySettings.safepay_active && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                        <Key size={10} /> Public API Key
                      </label>
                      <Input
                        value={gatewaySettings.safepay_api_key}
                        onChange={(e) => setGatewaySettings(prev => ({ ...prev, safepay_api_key: e.target.value }))}
                        className="h-9 text-xs border-slate-200 bg-slate-50/50"
                        placeholder="sec_..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                        <Key size={10} /> Secret HMAC Key
                      </label>
                      <Input
                        value={gatewaySettings.safepay_secret_key}
                        onChange={(e) => setGatewaySettings(prev => ({ ...prev, safepay_secret_key: e.target.value }))}
                        className="h-9 text-xs border-slate-200 bg-slate-50/50"
                        placeholder="8a18..."
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={gatewaySettings.safepay_sandbox}
                      onChange={(e) => setGatewaySettings(prev => ({ ...prev, safepay_sandbox: e.target.checked }))}
                      className="h-4.5 w-4.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-650"
                      id="safepay_sandbox"
                    />
                    <label htmlFor="safepay_sandbox" className="text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                      Enable Sandbox Test Mode (Uses test payment profiles)
                    </label>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── COUNTRY ROUTING SECTION ────────────────────────────────── */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-3xl space-y-4 shadow-sm border-l-4 border-l-blue-500">
          <div className="border-b pb-3 flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <span className="text-sm font-black">🌐</span>
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Country Gateway Routing</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Configure which gateways show for Pakistan 🇵🇰 vs International 🌍 users</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pakistan Gateways */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl space-y-3">
              <h4 className="text-[10px] font-black text-green-800 uppercase tracking-wider flex items-center gap-1">🇵🇰 Pakistan — Active Gateways</h4>
              <p className="text-[9px] text-green-700 font-semibold">Select which payment methods show for Pakistani users (PKR)</p>
              {["jazzcash", "easypaisa", "bank", "safepay"].map(gw => (
                <label key={gw} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 capitalize">
                  <input
                    type="checkbox"
                    checked={Array.isArray(gatewaySettings.pk_gateways) ? gatewaySettings.pk_gateways.includes(gw) : false}
                    onChange={(e) => {
                      const current: string[] = Array.isArray(gatewaySettings.pk_gateways) ? gatewaySettings.pk_gateways : ["jazzcash", "easypaisa", "bank"];
                      setGatewaySettings(prev => ({
                        ...prev,
                        pk_gateways: e.target.checked ? [...current, gw] : current.filter(g => g !== gw)
                      }));
                    }}
                    className="h-4 w-4 rounded text-green-600 cursor-pointer accent-green-600"
                  />
                  {gw === "jazzcash" ? "JazzCash" : gw === "easypaisa" ? "EasyPaisa" : gw === "bank" ? "Bank Transfer" : "SafePay"}
                </label>
              ))}
            </div>

            {/* International Gateways */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
              <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-wider flex items-center gap-1">🌍 International — Active Gateways</h4>
              <p className="text-[9px] text-blue-700 font-semibold">Select which payment methods show for non-Pakistan users (USD)</p>
              {["stripe", "paypal"].map(gw => (
                <label key={gw} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 capitalize">
                  <input
                    type="checkbox"
                    checked={Array.isArray(gatewaySettings.global_gateways) ? gatewaySettings.global_gateways.includes(gw) : false}
                    onChange={(e) => {
                      const current: string[] = Array.isArray(gatewaySettings.global_gateways) ? gatewaySettings.global_gateways : ["stripe"];
                      setGatewaySettings(prev => ({
                        ...prev,
                        global_gateways: e.target.checked ? [...current, gw] : current.filter(g => g !== gw)
                      }));
                    }}
                    className="h-4 w-4 rounded text-blue-600 cursor-pointer accent-blue-600"
                  />
                  {gw === "stripe" ? "Stripe (Card/Online)" : "PayPal"}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── INTERNATIONAL GATEWAYS CONFIG ─────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <span className="text-sm">💳</span>
            </div>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">International Payment Channels</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Stripe */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm border-l-4 border-l-indigo-500">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-800 uppercase block flex items-center gap-1">💳 Stripe — International Cards & Online Payments</span>
                  <span className="text-[9px] text-slate-400 font-bold block">Accept Visa/Mastercard globally via Stripe Checkout (USD)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGatewaySettings(prev => ({ ...prev, stripe_active: !prev.stripe_active }))}
                  className="text-slate-500 hover:text-indigo-650 transition"
                >
                  {gatewaySettings.stripe_active ? (
                    <ToggleRight className="text-emerald-500 h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
              {gatewaySettings.stripe_active && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                      <Key size={10} /> Stripe Publishable Key
                    </label>
                    <Input
                      value={gatewaySettings.stripe_publishable_key}
                      onChange={(e) => setGatewaySettings(prev => ({ ...prev, stripe_publishable_key: e.target.value }))}
                      className="h-9 text-xs border-slate-200 bg-slate-50/50 font-mono"
                      placeholder="pk_live_..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                      <Key size={10} /> Stripe Secret Key
                    </label>
                    <Input
                      value={gatewaySettings.stripe_secret_key || ""}
                      onChange={(e) => setGatewaySettings(prev => ({ ...prev, stripe_secret_key: e.target.value }))}
                      className="h-9 text-xs border-slate-200 bg-slate-50/50 font-mono"
                      placeholder="sk_live_..."
                      type="password"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* PayPal */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-sm border-l-4 border-l-blue-400">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-800 uppercase block">🅿️ PayPal — Global Wallet Payments</span>
                  <span className="text-[9px] text-slate-400 font-bold block">Accept payments via PayPal internationally</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGatewaySettings(prev => ({ ...prev, paypal_active: !prev.paypal_active }))}
                  className="text-slate-500 hover:text-indigo-650 transition"
                >
                  {gatewaySettings.paypal_active ? (
                    <ToggleRight className="text-emerald-500 h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7" />
                  )}
                </button>
              </div>
              {gatewaySettings.paypal_active && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                    <Key size={10} /> PayPal Client ID
                  </label>
                  <Input
                    value={gatewaySettings.paypal_client_id || ""}
                    onChange={(e) => setGatewaySettings(prev => ({ ...prev, paypal_client_id: e.target.value }))}
                    className="h-9 text-xs border-slate-200 bg-slate-50/50 font-mono"
                    placeholder="AV..."
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save settings action button */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button
            onClick={handleSaveGateways}
            className="bg-indigo-600 hover:bg-indigo-750 font-bold text-xs text-white h-11 px-6 flex items-center gap-1.5 rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.01]"
          >
            <Save size={15} /> Save Gateway settings
          </Button>
        </div>

      </div>
    </div>
  );
}
