"use client";

import React, { useState, useEffect } from "react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Plus, Edit2, Trash2, Key, ShieldAlert, Loader2, 
  X, CheckSquare, Square, ShieldCheck, Mail, User, Shield
} from "lucide-react";
import { toast } from "sonner";

interface StaffProfile {
  id: string;
  name: string;
  email: string;
  role: string; // 'salesman' | 'manager' | 'superadmin'
  created_at: string;
  permissions: {
    panels: Record<string, boolean>;
    actions: Record<string, boolean>;
  } | null;
}

const PANELS = [
  { key: "dashboard", label: "Overview Dashboard" },
  { key: "pos", label: "POS / Cashier" },
  { key: "sales", label: "Sales & Ledger" },
  { key: "products", label: "Products & Stock" },
  { key: "categories", label: "Categories" },
  { key: "brands", label: "Brands" },
  { key: "units", label: "Units & Packings" },
  { key: "purchase", label: "Purchase / Stock-In" },
  { key: "returns", label: "Returns / Adjustments" },
  { key: "expenses", label: "Expenses" },
  { key: "khata", label: "Khata (Ledger)" },
  { key: "registers", label: "Register Ledger" },
  { key: "accounts", label: "Accounts Ledger" },
  { key: "staff", label: "Staff Management" },
  { key: "backup", label: "Database Backups" }
];

const ACTIONS = [
  { key: "edit_bill", label: "Edit Bills" },
  { key: "delete_bill", label: "Delete / Void Bills" },
  { key: "edit_account", label: "Edit Accounts" },
  { key: "delete_account", label: "Delete Accounts" }
];

const DEFAULT_PERMISSIONS = {
  panels: {
    dashboard: true,
    pos: true,
    sales: true,
    registers: true,
    purchase: true,
    products: true,
    categories: true,
    brands: true,
    units: true,
    khata: true,
    returns: true,
    expenses: true,
    accounts: true,
    staff: false,
    backup: false
  },
  actions: {
    edit_bill: false,
    delete_bill: false,
    edit_account: false,
    delete_account: false
  }
};

export default function StaffPage() {
  const { shopId, userRole } = useShop();
  const supabase = createClient();

  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("salesman");
  const [panelsPerms, setPanelsPerms] = useState<Record<string, boolean>>({});
  const [actionsPerms, setActionsPerms] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shopId && userRole === "superadmin") {
      fetchStaff();
    }
  }, [shopId, userRole]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("shop_id", shopId)
        .order("name");

      if (error) throw error;
      setStaffList(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load staff list: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (userRole !== "superadmin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-lg mx-auto mt-12">
        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 animate-bounce">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Access Denied</h1>
        <p className="text-zinc-600 mb-6">
          Only the Superadmin role has permission to access Staff Management and modify access controls.
        </p>
        <button
          onClick={() => window.location.href = "/dashboard"}
          className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          Go Back to Dashboard
        </button>
      </div>
    );
  }

  const openAddModal = () => {
    setSelectedStaff(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("salesman");
    
    // Initialize permissions with defaults
    const initialPanels: Record<string, boolean> = {};
    const initialActions: Record<string, boolean> = {};
    PANELS.forEach(p => initialPanels[p.key] = DEFAULT_PERMISSIONS.panels[p.key as keyof typeof DEFAULT_PERMISSIONS.panels] ?? false);
    ACTIONS.forEach(a => initialActions[a.key] = DEFAULT_PERMISSIONS.actions[a.key as keyof typeof DEFAULT_PERMISSIONS.actions] ?? false);
    
    setPanelsPerms(initialPanels);
    setActionsPerms(initialActions);
    setModalOpen(true);
  };

  const openEditModal = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setName(staff.name);
    setEmail(staff.email || "");
    setPassword("");
    setRole(staff.role);

    // Load existing permissions or defaults
    const staffPanels = staff.permissions?.panels || {};
    const staffActions = staff.permissions?.actions || {};
    
    const initialPanels: Record<string, boolean> = {};
    const initialActions: Record<string, boolean> = {};
    
    PANELS.forEach(p => {
      initialPanels[p.key] = staffPanels[p.key] ?? false;
    });
    
    ACTIONS.forEach(a => {
      initialActions[a.key] = staffActions[a.key] ?? false;
    });

    setPanelsPerms(initialPanels);
    setActionsPerms(initialActions);
    setModalOpen(true);
  };

  const togglePanelPerm = (key: string) => {
    setPanelsPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleActionPerm = (key: string) => {
    setActionsPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    // Auto-adjust permissions based on role
    if (newRole === "superadmin") {
      const allTruePanels: Record<string, boolean> = {};
      const allTrueActions: Record<string, boolean> = {};
      PANELS.forEach(p => allTruePanels[p.key] = true);
      ACTIONS.forEach(a => allTrueActions[a.key] = true);
      setPanelsPerms(allTruePanels);
      setActionsPerms(allTrueActions);
    } else if (newRole === "salesman") {
      // salesman typically doesn't manage staff or backups
      const salePanels: Record<string, boolean> = {};
      PANELS.forEach(p => salePanels[p.key] = p.key !== "staff" && p.key !== "backup" && p.key !== "accounts");
      setPanelsPerms(salePanels);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");

    setSubmitting(true);
    const toastId = toast.loading(selectedStaff ? "Updating staff..." : "Registering new staff...");

    try {
      const formattedPermissions = {
        panels: panelsPerms,
        actions: actionsPerms
      };

      if (selectedStaff) {
        // Edit staff user
        const { error } = await supabase.rpc("update_staff_user", {
          staff_id: selectedStaff.id,
          staff_name: name,
          staff_role: role,
          staff_permissions: formattedPermissions,
          staff_password: password || null
        });

        if (error) throw error;
        toast.success("Staff profile updated successfully", { id: toastId });
      } else {
        // Create new staff user
        if (!email.trim()) throw new Error("Email is required");
        if (!password.trim()) throw new Error("Password is required");

        const { data: newUserId, error } = await supabase.rpc("create_staff_user", {
          staff_email: email,
          staff_password: password,
          staff_name: name,
          staff_shop_id: shopId,
          staff_role: role,
          staff_permissions: formattedPermissions
        });

        if (error) throw error;
        toast.success("Staff registered successfully", { id: toastId });
      }

      setModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;
    setSubmitting(true);
    const toastId = toast.loading("Deleting staff user...");

    try {
      const { error } = await supabase.rpc("delete_staff_user", {
        staff_id: selectedStaff.id
      });

      if (error) throw error;
      toast.success("Staff member deleted successfully", { id: toastId });
      setDeleteConfirmOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete: " + err.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Users className="text-blue-600" />
            Staff Management
          </h1>
          <p className="text-sm text-zinc-500">
            Create staff accounts, configure roles, and customize granular permissions.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all text-sm shrink-0 self-start md:self-auto"
        >
          <Plus size={16} />
          Register New Staff
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-zinc-400 mb-3" size={32} />
          <span className="text-zinc-500 text-sm">Loading staff members...</span>
        </div>
      ) : staffList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-zinc-200 border-dashed rounded-xl text-center">
          <Users className="text-zinc-300 mb-3" size={48} />
          <h3 className="font-semibold text-zinc-800 text-base">No Staff Found</h3>
          <p className="text-zinc-500 text-sm max-w-sm mt-1 mb-4">
            Get started by adding staff members to your shop and assigning their respective permissions.
          </p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            Add First Staff
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffList.map((staff) => (
            <motion.div
              layout
              key={staff.id}
              className="bg-white rounded-2xl border border-zinc-200 hover:border-zinc-300 p-5 shadow-sm flex flex-col justify-between transition duration-200"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-base shadow-inner">
                      {staff.name?.charAt(0).toUpperCase() || "S"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-950 leading-tight">{staff.name}</h3>
                      <span className={`inline-block text-[10px] font-black uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full ${
                        staff.role === "superadmin" 
                          ? "bg-purple-100 text-purple-700" 
                          : staff.role === "manager" 
                          ? "bg-blue-100 text-blue-700" 
                          : "bg-zinc-100 text-zinc-700"
                      }`}>
                        {staff.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-zinc-600 border-t border-zinc-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-zinc-400" />
                    <span className="truncate">{staff.email || "No Email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-zinc-400" />
                    <span>
                      {staff.role === "superadmin"
                        ? "Full Administrative Access"
                        : `${Object.values(staff.permissions?.panels || {}).filter(Boolean).length} / ${PANELS.length} Panels enabled`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4 mt-5">
                <button
                  onClick={() => openEditModal(staff)}
                  className="p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Edit2 size={14} />
                  Permissions
                </button>
                {staff.role !== "superadmin" && (
                  <button
                    onClick={() => {
                      setSelectedStaff(staff);
                      setDeleteConfirmOpen(true);
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit Staff Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-zinc-200"
            >
              <div className="p-6 border-b border-zinc-100 sticky top-0 bg-white flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-zinc-950 flex items-center gap-2">
                  {selectedStaff ? <Edit2 className="text-blue-600" size={18} /> : <Plus className="text-blue-600" size={18} />}
                  {selectedStaff ? "Modify Staff Permissions" : "Register New Staff Member"}
                </h2>
                <button 
                  onClick={() => setModalOpen(false)} 
                  className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">Full Name</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="email"
                        required
                        disabled={!!selectedStaff}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">
                      {selectedStaff ? "New Password (Leave blank to keep current)" : "Password"}
                    </label>
                    <div className="relative">
                      <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="password"
                        required={!selectedStaff}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700">Security Role</label>
                    <select
                      value={role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                    >
                      <option value="salesman">Salesman (Limited access)</option>
                      <option value="manager">Manager (Intermediate access)</option>
                      <option value="superadmin">Superadmin (All access)</option>
                    </select>
                  </div>
                </div>

                {role !== "superadmin" && (
                  <div className="space-y-6 border-t border-zinc-100 pt-6">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-1.5">
                        <ShieldCheck size={16} className="text-blue-600" />
                        Accessible Modules / Panels
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {PANELS.map((p) => {
                          const enabled = panelsPerms[p.key];
                          return (
                            <button
                              type="button"
                              key={p.key}
                              onClick={() => togglePanelPerm(p.key)}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-xs font-semibold transition ${
                                enabled
                                  ? "bg-blue-50/50 border-blue-200 text-blue-900"
                                  : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
                              }`}
                            >
                              {enabled ? (
                                <CheckSquare size={16} className="text-blue-600 shrink-0" />
                              ) : (
                                <Square size={16} className="text-zinc-400 shrink-0" />
                              )}
                              <span className="truncate">{p.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-1.5">
                        <Key size={16} className="text-blue-600" />
                        Restricted Actions Control
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ACTIONS.map((a) => {
                          const enabled = actionsPerms[a.key];
                          return (
                            <button
                              type="button"
                              key={a.key}
                              onClick={() => toggleActionPerm(a.key)}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-xs font-semibold transition ${
                                enabled
                                  ? "bg-blue-50/50 border-blue-200 text-blue-900"
                                  : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
                              }`}
                            >
                              {enabled ? (
                                <CheckSquare size={16} className="text-blue-600 shrink-0" />
                              ) : (
                                <Square size={16} className="text-zinc-400 shrink-0" />
                              )}
                              <span className="truncate">{a.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {role === "superadmin" && (
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-start gap-3">
                    <ShieldAlert className="text-purple-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <h4 className="text-xs font-bold text-purple-900">Superadmin Privilege Alert</h4>
                      <p className="text-xs text-purple-700 mt-1 leading-relaxed">
                        Setting this staff member as a Superadmin grants them absolute control, enabling them to access all modules and perform all actions, including deleting or editing transactions, cash accounts, and managing other staff.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 border-t border-zinc-100 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold border border-zinc-200 hover:bg-zinc-50 rounded-lg transition text-zinc-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="animate-spin" size={16} />}
                    {selectedStaff ? "Update Permissions" : "Register Staff"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Staff Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && selectedStaff && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 border border-zinc-200 shadow-xl"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <Trash2 size={24} />
                <h3 className="text-lg font-bold">Remove Staff Member?</h3>
              </div>
              <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
                Are you sure you want to delete <strong>{selectedStaff.name}</strong> ({selectedStaff.email})? 
                This action is permanent and will delete their login credentials and profile. Historical data generated by this user (like sales, transactions) will be preserved.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  Delete Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
