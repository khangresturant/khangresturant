"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Loader2, Search, Trash2, Mail, Key, Phone, Award, Store, 
  Calendar, CreditCard, Clock, CheckCircle2, XCircle,
  Building2, Users, Activity, ToggleLeft, ToggleRight, Sparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface Shop {
  phone?: string | null;
  id: string;
  name: string;
  industry_type: string;
  subscription_tier: string;
  subscription_expires_at: string | null;
  created_at: string;
  owner_id: string;
  has_payroll: boolean;
  has_tax: boolean;
  has_emi: boolean;
  has_assets_rec: boolean;
  allow_negative_stock: boolean;
}

interface OwnerBusiness {
  phone?: string | null;
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  shop_id: string;
  shops: Shop[]; // Array of shops instead of a single shop
}

export default function AdminRegistrationsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<OwnerBusiness[]>([]);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Active Sub-Tab: "directory" (Owners & Shops) or "logs" (Activity Logs)
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "logs">("directory");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Saving indicator for toggles
  const [savingShopId, setSavingShopId] = useState<string | null>(null);

  useEffect(() => {
    loadOwnersData();
  }, []);

  const loadOwnersData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all profiles (all registered users)
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, name, email, phone, role, created_at, shop_id")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // 2. Fetch all shops
      const { data: shopsData, error: shopsError } = await supabase
        .from("shops")
        .select(`
          id, name, phone, industry_type, subscription_tier,
          subscription_expires_at, created_at, owner_id,
          has_payroll, has_tax, has_emi, has_assets_rec, allow_negative_stock
        `)
        .order("created_at", { ascending: false });

      if (shopsError) throw shopsError;

      // 3. Fetch all user-shop assignments
      const { data: userShopsData, error: userShopsError } = await supabase
        .from("user_shops")
        .select("user_id, shop_id, role");

      // Don't crash if user_shops isn't loaded or doesn't exist
      const typedUserShops = userShopsData || [];

      const typedShops = (shopsData as Shop[] || []);
      setAllShops(typedShops);

      // 4. Map shops dynamically (owned shops + member shops + direct shop_id links)
      const mappedOwners = (profilesData || []).map((profile: any) => {
        const ownedShops = typedShops.filter((shop) => shop.owner_id === profile.id);
        
        const memberShopIds = typedUserShops
          .filter((us: any) => us.user_id === profile.id)
          .map((us: any) => us.shop_id);

        const uniqueShops = [...ownedShops];
        memberShopIds.forEach((shopId: string) => {
          if (!uniqueShops.some((s) => s.id === shopId)) {
            const foundShop = typedShops.find((s) => s.id === shopId);
            if (foundShop) uniqueShops.push(foundShop);
          }
        });

        if (profile.shop_id && !uniqueShops.some((s) => s.id === profile.shop_id)) {
          const foundShop = typedShops.find((s) => s.id === profile.shop_id);
          if (foundShop) uniqueShops.push(foundShop);
        }

        return {
          ...profile,
          shops: uniqueShops
        };
      });

      setOwners(mappedOwners);
    } catch (err: any) {
      toast.error("Failed to load business registrations: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load live activity logs from audit_logs table
  const loadAuditLogsData = async () => {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select(`
          id, shop_id, user_id, action, table_name, record_id, details, ip_address, created_at
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (err: any) {
      toast.error("Failed to load platform activities: " + err.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Modify individual shop settings/features in the database
  const handleUpdateShopFeature = async (shopId: string, updates: any) => {
    setSavingShopId(shopId);
    try {
      const { error } = await supabase
        .from("shops")
        .update(updates)
        .eq("id", shopId);

      if (error) throw error;
      toast.success("Business database settings altered successfully!");

      // Update local states
      setAllShops(prev => prev.map(s => s.id === shopId ? { ...s, ...updates } : s));
      setOwners(prev => prev.map(owner => {
        return {
          ...owner,
          shops: owner.shops.map((shop) => 
            shop.id === shopId ? { ...shop, ...updates } : shop
          )
        };
      }));
    } catch (err: any) {
      toast.error("Alteration failed: " + err.message);
    } finally {
      setSavingShopId(null);
    }
  };

  // Alter shop plan expiry date
  const handleUpdateShopExpiry = async (shopId: string, dateStr: string) => {
    if (!dateStr) return;
    const dateObj = new Date(dateStr);
    dateObj.setHours(23, 59, 59, 999);
    await handleUpdateShopFeature(shopId, { subscription_expires_at: dateObj.toISOString() });
  };

  // Delete business shop
  const handleDeleteShop = async (shopId: string, shopName: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete the business "${shopName}"? This action is irreversible.`);
    if (!confirmDelete) return;

    setSavingShopId(shopId);
    try {
      const { error } = await supabase
        .from("shops")
        .delete()
        .eq("id", shopId);

      if (error) throw error;
      toast.success(`Business "${shopName}" deleted successfully!`);

      // Update local states
      setAllShops(prev => prev.filter(s => s.id !== shopId));
      setOwners(prev => prev.map(owner => {
        return {
          ...owner,
          shops: owner.shops.filter((shop) => shop.id !== shopId)
        };
      }));
    } catch (err: any) {
      toast.error("Failed to delete business: " + err.message);
    } finally {
      setSavingShopId(null);
    }
  };

    const handleImpersonateUser = (owner: OwnerBusiness, targetShop?: Shop) => {
    const shopToImpersonate = targetShop || owner.shops[0];
    if (!shopToImpersonate) {
      toast.error("User has no registered shops to impersonate!");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("impersonated_shop_id", shopToImpersonate.id);
      localStorage.setItem("impersonated_shop_name", shopToImpersonate.name);
      localStorage.setItem("impersonated_user_name", owner.name);
      localStorage.setItem("is_impersonating", "true");
      localStorage.removeItem("hisabx_shop_context");
      localStorage.removeItem("The Accounts_shop_context");
      
      toast.success(`Logging in as SaaS Admin to ${shopToImpersonate.name} (${owner.name})...`);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    }
  };

  const handleDeleteOwner = async (owner: OwnerBusiness) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete owner "${owner.name}" and ALL (${owner.shops.length}) associated business shops? This action is irreversible.`
    );
    if (!confirmDelete) return;

    setDeletingId(owner.id);
    const toastId = toast.loading("Deleting owner profile and all associated businesses...");
    try {
      // 1. Delete all shops owned by this user
      const ownedShopIds = owner.shops.map(s => s.id);
      if (ownedShopIds.length > 0) {
        await supabase.from("audit_logs").delete().in("shop_id", ownedShopIds);
        await supabase.from("online_orders").delete().in("shop_id", ownedShopIds);
        await supabase.from("invoices").delete().in("shop_id", ownedShopIds);
        await supabase.from("products").delete().in("shop_id", ownedShopIds);
        await supabase.from("shops").delete().in("id", ownedShopIds);
      }

      // 2. Delete user_shops mappings
      await supabase.from("user_shops").delete().eq("user_id", owner.id);

      // 3. Delete user profile
      const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", owner.id);

      if (error) throw error;

      toast.success("Owner profile and all associated businesses deleted successfully!", { id: toastId });
      setOwners(prev => prev.filter(o => o.id !== owner.id));
      setAllShops(prev => prev.filter(s => s.owner_id !== owner.id));
    } catch (err: any) {
      toast.error("Delete failed: " + err.message, { id: toastId });
    } finally {
      setDeletingId(null);
    }
  };

  const getSubStatus = (shop: Shop) => {
    const expires = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;
    if (!expires) return { isActive: false, isExpired: true, daysLeft: 0 };
    const now = new Date();
    const isActive = expires > now;
    const daysLeft = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { isActive, isExpired: !isActive, daysLeft, expires };
  };

  const uniqueRoles = useMemo(() => {
    const rolesSet = new Set<string>();
    owners.forEach(o => {
      if (o.role) rolesSet.add(o.role.toLowerCase());
    });
    return Array.from(rolesSet);
  }, [owners]);

  const filteredOwners = useMemo(() => {
    return owners.filter(o => {
      // Owner matches search or has at least one shop that matches the criteria
      const matchesSearch =
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.email.toLowerCase().includes(search.toLowerCase()) ||
        (o.phone && o.phone.toLowerCase().includes(search.toLowerCase())) ||
        o.shops.some(shop => 
          shop.name.toLowerCase().includes(search.toLowerCase()) ||
          shop.industry_type.toLowerCase().includes(search.toLowerCase())
        );

      const matchesTier =
        tierFilter === "all" || o.shops.some(shop => shop.subscription_tier === tierFilter);

      const matchesStatus =
        statusFilter === "all" || o.shops.some(shop => {
          const { isActive } = getSubStatus(shop);
          return (statusFilter === "active" && isActive) || (statusFilter === "expired" && !isActive);
        });

      const matchesRole =
        roleFilter === "all" || 
        (o.role && o.role.toLowerCase() === roleFilter.toLowerCase());

      return matchesSearch && matchesTier && matchesStatus && matchesRole;
    });
  }, [owners, search, tierFilter, statusFilter, roleFilter]);

  // Activity stream name resolvers
  const resolveShopName = (shopId: string | null) => {
    if (!shopId) return "Global / System";
    const shop = allShops.find(s => s.id === shopId);
    return shop ? shop.name : `Shop (${shopId.slice(0, 8)})`;
  };

  const resolveUserName = (userId: string | null) => {
    if (!userId) return "System Event";
    const owner = owners.find(o => o.id === userId);
    if (owner) return owner.name;
    return `User (${userId.slice(0, 8)})`;
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col justify-center items-center text-slate-450">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650 mb-2" />
        <p className="text-xs font-semibold">Loading business registry and logs...</p>
      </div>
    );
  }

  // Active / Expired stats calculation
  const activeCount = allShops.filter(s => getSubStatus(s).isActive).length;
  const expiredCount = allShops.filter(s => !getSubStatus(s).isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600" />
            SaaS System Registrations & Logs
          </h2>
          <p className="text-xs text-slate-450 mt-0.5">
            Admin directory to inspect owner credentials, manage all their registered shops, alter active modules, and track log entries.
          </p>
        </div>
        <button
          onClick={() => {
            loadOwnersData();
            if (activeSubTab === "logs") loadAuditLogsData();
          }}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200/60 border border-slate-200 text-slate-700 text-xs font-black rounded-xl shrink-0"
        >
          Refresh Data
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users size={16} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Total Users</span>
            <span className="text-2xl font-black text-slate-800">{owners.length}</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-650 rounded-xl">
            <Store size={16} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Total Shops</span>
            <span className="text-2xl font-black text-purple-750">{allShops.length}</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Active Plans</span>
            <span className="text-2xl font-black text-emerald-600">{activeCount}</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
            <XCircle size={16} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Expired Plans</span>
            <span className="text-2xl font-black text-rose-500">{expiredCount}</span>
          </div>
        </div>
      </div>

      {/* Sub Tabs menu */}
      <div className="flex gap-4 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab("directory")}
          className={`pb-1 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeSubTab === "directory" 
              ? "border-indigo-650 text-indigo-750" 
              : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Owners & Shops Directory
        </button>
        <button
          onClick={() => {
            setActiveSubTab("logs");
            loadAuditLogsData();
          }}
          className={`pb-1 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeSubTab === "logs" 
              ? "border-indigo-650 text-indigo-750" 
              : "border-transparent text-slate-450 hover:text-slate-700"
          }`}
        >
          Live Platform Activity Logs
        </button>
      </div>

      {/* VIEW 1: DIRECTORY TAB */}
      {activeSubTab === "directory" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search by owner name, email, shop name, or industry..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white border-slate-200 h-9 text-xs"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="bg-white border border-slate-200 h-9 rounded-lg px-3 text-xs font-semibold cursor-pointer text-slate-750 focus:outline-none"
              >
                <option value="all">All Plans</option>
                
                <option value="starter">Starter</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 h-9 rounded-lg px-3 text-xs font-semibold cursor-pointer text-slate-750 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired Only</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-white border border-slate-200 h-9 rounded-lg px-3 text-xs font-semibold cursor-pointer text-slate-750 focus:outline-none"
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map(r => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Directory Listings */}
          <div className="space-y-4">
            {filteredOwners.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm font-semibold bg-white border border-slate-200/80 rounded-3xl">
                No matching user profiles found.
              </div>
            ) : (
              filteredOwners.map(owner => {
                const userShops = owner.shops || [];
                const isExpanded = expandedId === owner.id;

                return (
                  <div
                    key={owner.id}
                    className="bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all rounded-3xl overflow-hidden"
                  >
                    {/* Owner summary row */}
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Left side: Owner Name + shops list */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="h-12 w-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-black text-base shrink-0">
                          {owner.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-slate-800 text-sm leading-tight">
                              {owner.name}
                            </h3>
                            <Award size={12} className="text-amber-500 fill-amber-500" />
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full ${
                              owner.role === 'superadmin' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                              owner.role === 'salesman' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              owner.role === 'admin' ? 'bg-indigo-50 text-indigo-755 border border-indigo-100' :
                              'bg-slate-100 text-slate-650 border border-slate-200'
                            }`}>
                              {owner.role || 'User'}
                            </span>
                            <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full bg-slate-100 text-slate-600 border">
                              {userShops.length} Shop{userShops.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Mail size={10} className="shrink-0" /> {owner.email}
                          </p>
                          
                          {/* Business shops summary pills */}
                          {userShops.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              <Store size={11} className="text-indigo-500 shrink-0" />
                              <div className="flex gap-1.5 flex-wrap">
                                {userShops.map((shop) => (
                                  <span key={shop.id} className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-50 text-slate-650 border border-slate-200/50">
                                    {shop.name} ({shop.industry_type}){shop.phone ? ` • 📱 ${shop.phone}` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-semibold italic">No registered businesses</div>
                          )}
                        </div>
                      </div>

                      {/* Right side: Expand and profiles options */}
                      <div className="flex flex-col sm:items-end gap-3 shrink-0">
                        <div className="text-[10px] text-slate-400 font-mono sm:text-right">
                          <div className="flex items-center gap-1 sm:justify-end">
                            <Calendar size={9} />
                            <span>Joined: {new Date(owner.created_at).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : owner.id)}
                            className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                          >
                            {isExpanded ? "Hide Shops ▲" : `Manage Shops (${userShops.length}) ▼`}
                          </button>
                          
                          <button
                            type="button"
                            disabled={deletingId === owner.id}
                            onClick={() => handleDeleteOwner(owner)}
                            className="p-2 bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
                            title="Delete Owner Profile"
                          >
                            {deletingId === owner.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED SHOPS CONTROL SECTION */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-5">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Registered Businesses & Feature Toggles</p>
                        
                        {userShops.length === 0 ? (
                          <div className="text-center py-6 text-slate-450 text-xs font-bold italic">
                            No businesses registered for this owner profile.
                          </div>
                        ) : (
                          userShops.map((shop) => {
                            const { isActive, daysLeft, expires } = getSubStatus(shop);
                            return (
                              <div key={shop.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-sm relative">
                                
                                {/* Shop Title, Expiry & Tier */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3.5 border-b border-slate-100">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-black text-slate-800 text-sm">{shop.name}</h4>
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 font-bold text-indigo-650 uppercase">
                                        {shop.industry_type}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold mt-1 font-mono">
                                      ID: {shop.id} • Registered: {new Date(shop.created_at).toLocaleDateString("en-PK")}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3">
                                    {/* Expiry date setting */}
                                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px]">
                                      <span className="font-black text-slate-450 uppercase">Expires:</span>
                                      <input 
                                        type="date"
                                        defaultValue={shop.subscription_expires_at ? new Date(shop.subscription_expires_at).toISOString().split('T')[0] : ""}
                                        onChange={(e) => handleUpdateShopExpiry(shop.id, e.target.value)}
                                        className="bg-transparent border-none text-slate-700 font-black focus:outline-none cursor-pointer"
                                      />
                                    </div>

                                    {/* Subscription status badge */}
                                    <span className={`px-2 py-1 text-[9px] font-black uppercase rounded-md border flex items-center gap-1 ${
                                      isActive
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                        : "bg-rose-50 text-rose-600 border-rose-100"
                                    }`}>
                                      {isActive ? `Active (${daysLeft}d left)` : "Expired"}
                                    </span>

                                    {/* Tier Dropdown */}
                                    <select
                                      value={shop.subscription_tier || "premium"}
                                      onChange={(e) => handleUpdateShopFeature(shop.id, { subscription_tier: e.target.value })}
                                      className="bg-slate-50 border border-slate-200 text-[10px] font-bold rounded-lg px-2 py-1.5 cursor-pointer text-slate-700 focus:outline-none"
                                    >
                                      <option value="free">Free Tier</option>
                                      <option value="starter">Starter Plan</option>
                                      <option value="premium">Premium Plan</option>
                                      <option value="enterprise">Enterprise Plan</option>
                                    </select>

                                    {/* Login as SaaS Admin / Developer for this specific Business */}
                                    <button
                                      type="button"
                                      onClick={() => handleImpersonateUser(owner, shop)}
                                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[10px] shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                                      title="Login to this Business Dashboard as SaaS Admin / Developer"
                                    >
                                      <Key size={11} /> Login as SaaS Admin (لاگ ان کریں)
                                    </button>

                                    {/* Delete Business */}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteShop(shop.id, shop.name)}
                                      className="p-1.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 rounded-lg transition-all cursor-pointer animate-in fade-in"
                                      title="Delete Business"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Feature Toggles */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 text-xs text-slate-650">
                                  
                                  {/* Allow Negative Stock */}
                                  <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/60">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-450">Neg. Stock</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateShopFeature(shop.id, { allow_negative_stock: !shop.allow_negative_stock })}
                                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                                    >
                                      {shop.allow_negative_stock ? (
                                        <ToggleRight className="text-emerald-500 h-6 w-6" />
                                      ) : (
                                        <ToggleLeft className="h-6 w-6" />
                                      )}
                                    </button>
                                  </div>

                                  {/* EMI / Installments */}
                                  <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/60">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-450">EMI Plan</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateShopFeature(shop.id, { has_emi: !shop.has_emi })}
                                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                                    >
                                      {shop.has_emi ? (
                                        <ToggleRight className="text-emerald-500 h-6 w-6" />
                                      ) : (
                                        <ToggleLeft className="h-6 w-6" />
                                      )}
                                    </button>
                                  </div>

                                  {/* Staff Payroll */}
                                  <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/60">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-450">Payroll</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateShopFeature(shop.id, { has_payroll: !shop.has_payroll })}
                                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                                    >
                                      {shop.has_payroll ? (
                                        <ToggleRight className="text-emerald-500 h-6 w-6" />
                                      ) : (
                                        <ToggleLeft className="h-6 w-6" />
                                      )}
                                    </button>
                                  </div>

                                  {/* Tax Systems */}
                                  <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/60">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-450">Tax System</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateShopFeature(shop.id, { has_tax: !shop.has_tax })}
                                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                                    >
                                      {shop.has_tax ? (
                                        <ToggleRight className="text-emerald-500 h-6 w-6" />
                                      ) : (
                                        <ToggleLeft className="h-6 w-6" />
                                      )}
                                    </button>
                                  </div>

                                  {/* Fixed Assets */}
                                  <div className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-xl border border-slate-200/60">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-slate-450">Fixed Assets</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateShopFeature(shop.id, { has_assets_rec: !shop.has_assets_rec })}
                                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                                    >
                                      {shop.has_assets_rec ? (
                                        <ToggleRight className="text-emerald-500 h-6 w-6" />
                                      ) : (
                                        <ToggleLeft className="h-6 w-6" />
                                      )}
                                    </button>
                                  </div>

                                </div>

                                {/* Loading Overlay */}
                                {savingShopId === shop.id && (
                                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center text-xs font-black text-indigo-650 rounded-2xl animate-pulse">
                                    <Loader2 size={14} className="animate-spin mr-1.5" /> Modifying Database Settings...
                                  </div>
                                )}

                              </div>
                            );
                          })
                        )}

                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: ACTIVITY LOGS TAB */}
      {activeSubTab === "logs" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-slate-50 border p-3.5 rounded-2xl">
            <div>
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-600" /> Platform Audit Trail Logs
              </span>
              <p className="text-[10px] text-slate-450 mt-0.5">Filterable sequence of database alterations and mutations globally.</p>
            </div>
            <button
              onClick={loadAuditLogsData}
              disabled={loadingAudit}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border text-slate-655 text-[10px] font-black rounded-lg transition-all cursor-pointer"
            >
              {loadingAudit ? "Refreshing Logs..." : "Refresh Audit Trail"}
            </button>
          </div>

          {loadingAudit ? (
            <div className="py-16 text-center text-slate-450">
              <Loader2 className="animate-spin h-7 w-7 text-indigo-650 mx-auto mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">Aggregating database audit stream...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm font-semibold bg-white border rounded-3xl">
              No audit logs recorded in database.
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-black uppercase tracking-wider text-[9px]">
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Operator User</th>
                      <th className="p-4">Target Shop</th>
                      <th className="p-4">Action Event</th>
                      <th className="p-4">Table</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4">Action Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 whitespace-nowrap font-mono text-slate-450 text-[10px]">
                          {new Date(log.created_at).toLocaleString("en-PK", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })}
                        </td>
                        <td className="p-4 font-bold whitespace-nowrap">{resolveUserName(log.user_id)}</td>
                        <td className="p-4 text-indigo-650 font-bold whitespace-nowrap">{resolveShopName(log.shop_id)}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-[10px] whitespace-nowrap">{log.table_name || "—"}</td>
                        <td className="p-4 font-mono text-slate-450 text-[10px] whitespace-nowrap">{log.ip_address || "—"}</td>
                        <td className="p-4 max-w-[240px] truncate" title={JSON.stringify(log.details)}>
                          <span className="font-mono text-slate-400 text-[9px]">
                            {log.details ? JSON.stringify(log.details) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
