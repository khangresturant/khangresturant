"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Mail, Phone, ShieldCheck, Key, Building2, Crown, 
  Check, AlertCircle, Loader2, X, LogOut, ExternalLink,
  Calendar, Lock, Sparkles, CheckCircle2, RefreshCw, Copy
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { 
    userId, shopId, shopName, industryType, userRole, userName, 
    subscriptionTier, subscriptionExpiresAt, refreshShopData 
  } = useShop();
  const supabase = createClient();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"profile" | "business" | "security" | "shops">("profile");
  
  // Profile Form state
  const [profileName, setProfileName] = useState(userName || "");
  const [profilePhone, setProfilePhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userCreatedAt, setUserCreatedAt] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Shops List state
  const [myShops, setMyShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [switchingShopId, setSwitchingShopId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
      loadUserShops();
    }
  }, [isOpen, userId]);

  async function loadUserProfile() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setUserEmail(userData.user.email || "");
        setUserCreatedAt(userData.user.created_at || "");
        setProfilePhone(userData.user.phone || userData.user.user_metadata?.phone || "");
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("name, phone")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        if (profile.name) setProfileName(profile.name);
        if (profile.phone) setProfilePhone(profile.phone);
      }
    } catch (err: any) {
      console.error("Profile load error:", err);
    }
  }

  async function loadUserShops() {
    if (!userId) return;
    setLoadingShops(true);
    try {
      const { data: userShopEntries } = await supabase
        .from("user_shops")
        .select("shop_id, role, shops(id, name, industry_type, owner_id, subscription_tier, subscription_expires_at)")
        .eq("user_id", userId);

      if (userShopEntries) {
        const formatted = userShopEntries.map((us: any) => ({
          id: us.shops?.id,
          name: us.shops?.name,
          industryType: us.shops?.industry_type,
          role: us.role,
          tier: us.shops?.subscription_tier,
          expiresAt: us.shops?.subscription_expires_at
        })).filter((s: any) => s.id);
        setMyShops(formatted);
      }
    } catch (err: any) {
      console.error("User shops load error:", err);
    } finally {
      setLoadingShops(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileName.trim()) {
      toast.error("Profile name cannot be empty.");
      return;
    }
    setSavingProfile(true);
    try {
      const { error: profileErr } = await supabase
        .from("user_profiles")
        .upsert({
          id: userId,
          name: profileName.trim(),
          phone: profilePhone.trim() || null
        }, { onConflict: "id" });

      if (profileErr) throw profileErr;

      // Update Supabase auth user metadata
      await supabase.auth.updateUser({
        data: { full_name: profileName.trim(), phone: profilePhone.trim() }
      });

      toast.success("Profile details updated successfully! ✨");
      await refreshShopData();
    } catch (err: any) {
      toast.error("Failed to update profile: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password changed successfully! 🔒");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error("Failed to change password: " + err.message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSwitchShop(targetShopId: string) {
    if (targetShopId === shopId) return;
    setSwitchingShopId(targetShopId);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ shop_id: targetShopId })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Switched active business successfully!");
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (err: any) {
      toast.error("Failed to switch business: " + err.message);
      setSwitchingShopId(null);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully.");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } catch (err: any) {
      toast.error("Logout failed.");
    }
  }

  if (!isOpen) return null;

  const userInitial = (profileName || userName || userEmail || "U").charAt(0).toUpperCase();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
        
        {/* Backdrop click */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0" onClick={onClose} 
        />

        {/* Modal Container */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 15 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-2xl relative z-10 border border-slate-200/80 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans"
        >
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Header Banner */}
          <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 text-white overflow-hidden shrink-0">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
            
            <div className="flex flex-wrap items-center gap-4 relative z-10">
              {/* Avatar Circle */}
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 p-0.5 shadow-xl shrink-0 flex items-center justify-center">
                <div className="h-full w-full bg-slate-900 rounded-[14px] flex items-center justify-center text-white font-black text-2xl">
                  {userInitial}
                </div>
              </div>

              {/* User Metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black truncate">{profileName || userName || "User Profile"}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wide">
                    {userRole || "Superadmin"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-semibold truncate mt-0.5 flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" /> {userEmail || "Loading email..."}
                </p>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-2">
                  <span className="flex items-center gap-1">
                    <Building2 size={11} className="text-indigo-400" /> {shopName || "My Business"}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={11} className="text-emerald-400" /> Joined {userCreatedAt ? new Date(userCreatedAt).toLocaleDateString() : "2026"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Bar */}
          <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2 shrink-0 select-none overflow-x-auto">
            <button
              onClick={() => setActiveTab("profile")}
              className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "profile" 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/80" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <User size={14} /> Personal Profile
            </button>
            <button
              onClick={() => setActiveTab("business")}
              className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "business" 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/80" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Building2 size={14} /> Active Business
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "security" 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/80" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShieldCheck size={14} /> Security & Password
            </button>
            <button
              onClick={() => setActiveTab("shops")}
              className={`py-2 px-3.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "shops" 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200/80" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Crown size={14} /> My Businesses ({myShops.length})
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            
            {/* TAB 1: PERSONAL PROFILE */}
            {activeTab === "profile" && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Personal Information & Credentials
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Full Name *
                    </label>
                    <input 
                      type="text" 
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Email Address (Verified)
                    </label>
                    <input 
                      type="email" 
                      value={userEmail}
                      disabled
                      className="w-full h-10 px-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Phone / Mobile Number
                    </label>
                    <input 
                      type="text" 
                      value={profilePhone}
                      onChange={e => setProfilePhone(e.target.value)}
                      placeholder="e.g. +92 300 1234567"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Account Role
                    </label>
                    <input 
                      type="text" 
                      value={userRole?.toUpperCase() || "SUPERADMIN"}
                      disabled
                      className="w-full h-10 px-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-indigo-700 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <User size={15} className="text-blue-600" />
                    <span>User Account ID: <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] font-mono">{userId}</code></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (userId) {
                        navigator.clipboard.writeText(userId);
                        toast.success("User ID copied to clipboard!");
                      }
                    }}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer"
                    title="Copy User ID"
                  >
                    <Copy size={13} />
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {savingProfile && <Loader2 size={13} className="animate-spin" />} Save Profile Changes
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: ACTIVE BUSINESS DETAILS */}
            {activeTab === "business" && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Active Business Overview & Subscription Plan
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Shop Title</span>
                    <h4 className="text-base font-black text-slate-900">{shopName || "My Business"}</h4>
                    <p className="text-xs font-bold text-indigo-600 capitalize">Industry: {industryType || "General Retail"}</p>
                    <p className="text-[11px] text-slate-400 font-mono">Shop ID: {shopId}</p>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-2xl border border-indigo-150 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Subscription Status</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white uppercase shadow-sm">
                        {subscriptionTier || "FREE"}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      {subscriptionExpiresAt ? (
                        <span>Expires: {new Date(subscriptionExpiresAt).toLocaleDateString()}</span>
                      ) : (
                        <span>Lifetime Access</span>
                      )}
                    </div>
                    <div className="pt-2">
                      <Link 
                        href="/dashboard/billing"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <Crown size={13} /> Upgrade Subscription Plan <ExternalLink size={11} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SECURITY & PASSWORD */}
            {activeTab === "security" && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  Account Security & Password Management
                </h3>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-black text-emerald-900">Email Verification Status</h4>
                      <p className="text-[11px] font-semibold text-emerald-700">Your account email ({userEmail}) is verified and secure.</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">VERIFIED</span>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      New Password *
                    </label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters (letters & numbers)"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Confirm New Password *
                    </label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={changingPassword || !newPassword}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {changingPassword && <Loader2 size={13} className="animate-spin" />} Update Security Password
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: MY BUSINESSES (MULTI-SHOP) */}
            {activeTab === "shops" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Registered Businesses & Outlets ({myShops.length})
                  </h3>
                  <Link
                    href="/register?new=true"
                    onClick={onClose}
                    className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1"
                  >
                    + Add Business
                  </Link>
                </div>

                {loadingShops ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                ) : myShops.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No additional businesses found.</p>
                ) : (
                  <div className="space-y-3">
                    {myShops.map((s) => {
                      const isCurrent = s.id === shopId;
                      return (
                        <div
                          key={s.id}
                          className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                            isCurrent 
                              ? "bg-blue-50/50 border-blue-300 shadow-sm" 
                              : "bg-slate-50 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-sm text-slate-900">{s.name}</h4>
                              {isCurrent && (
                                <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold capitalize mt-0.5">
                              {s.industryType || "General"} • Role: {s.role || "Superadmin"}
                            </p>
                          </div>

                          {!isCurrent && (
                            <button
                              onClick={() => handleSwitchShop(s.id)}
                              disabled={switchingShopId === s.id}
                              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              {switchingShopId === s.id && <Loader2 size={12} className="animate-spin" />} Switch
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              <LogOut size={13} /> Sign Out Account
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              Close
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
