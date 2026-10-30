"use client";

import React, { useState, useEffect } from "react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Database, Download, Upload, Cloud, RefreshCw, Loader2, 
  CheckCircle, AlertTriangle, Key, ShieldAlert, FolderSync, Info
} from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    google: any;
  }
}

interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export default function BackupPage() {
  const { shopId, shopName, userRole } = useShop();
  const supabase = createClient();

  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState("");
  
  // Google Drive states
  const [googleClientId, setGoogleClientId] = useState("");
  const [gdriveLinked, setGdriveLinked] = useState(false);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [driveBackups, setDriveBackups] = useState<BackupFile[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);

  // Load Google Client ID from localStorage if exists
  useEffect(() => {
    const savedId = localStorage.getItem("hx_google_client_id") || "";
    const OLD_DESKTOP_CLIENT_ID = "33744104728-qskgu0em07l0snt8lavuqjsim0snnfd3.apps.googleusercontent.com";
    if (savedId === OLD_DESKTOP_CLIENT_ID) {
      localStorage.removeItem("hx_google_client_id");
      setGoogleClientId("");
    } else {
      setGoogleClientId(savedId);
    }

    // Inject Google GSI script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("hx_google_client_id", googleClientId);
    toast.success("Google Client ID saved locally.");
  };

const DEFAULT_CLIENT_ID = "33744104728-c436hkgjls21oadr6skjbg9d19p1e539.apps.googleusercontent.com";

  const handleLinkGDrive = () => {
    const activeClientId = googleClientId.trim() || DEFAULT_CLIENT_ID;
    console.log("Using Google Client ID for OAuth:", activeClientId);
    if (!activeClientId) {
      toast.error("Please enter a Google OAuth Client ID first.");
      return;
    }

    try {
      setGdriveLoading(true);
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            toast.error("Google Auth failed: " + tokenResponse.error_description);
            setGdriveLoading(false);
            return;
          }
          if (tokenResponse.access_token) {
            setAccessToken(tokenResponse.access_token);
            setGdriveLinked(true);
            toast.success("Successfully connected to Google Drive!");
            // Initialize folder & list files
            await initializeGoogleDriveFolder(tokenResponse.access_token);
          }
        },
      });
      tokenClient.requestAccessToken();
    } catch (err: any) {
      console.error(err);
      toast.error("Could not load Google Identity client: " + err.message);
      setGdriveLoading(false);
    }
  };

  const initializeGoogleDriveFolder = async (token: string) => {
    try {
      setGdriveLoading(true);
      // 1. Search for folder HisabX_Backups
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='HisabX_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const searchData = await searchRes.json();
      
      let folderIdToUse = "";
      if (searchData.files && searchData.files.length > 0) {
        folderIdToUse = searchData.files[0].id;
      } else {
        // Create folder
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "HisabX_Backups",
            mimeType: "application/vnd.google-apps.folder",
          }),
        });
        const createData = await createRes.json();
        folderIdToUse = createData.id;
      }

      setFolderId(folderIdToUse);
      await fetchDriveBackups(token, folderIdToUse);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to setup Google Drive folder: " + err.message);
    } finally {
      setGdriveLoading(false);
    }
  };

  const fetchDriveBackups = async (token: string, currentFolderId: string) => {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${currentFolderId}' in parents and trashed=false&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setDriveBackups(data.files || []);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to list backups from Google Drive");
    }
  };

  // Export JSON Backup
  const generateBackupJson = async () => {
    const backup: Record<string, any> = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      shopName: shopName,
      shopId: shopId,
      data: {}
    };

    const directTables = [
      "brands", "categories", "units", "shelves", "formulations", 
      "products", "product_variants", "product_barcodes", "parties", 
      "cash_accounts", "expenses", "invoices", "returns", 
      "purchase_orders", "sales", "credit_transactions", "account_transactions",
      "stitching_orders", "repair_tickets", "fuel_tanks", "fuel_pumps", 
      "register_sessions", "installment_plans", "customers", 
      "company_details", "print_settings", "warehouses", "stock", 
      "stock_adjustments", "gift_cards"
    ];

    for (const table of directTables) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("shop_id", shopId);
      if (!error && data) {
        backup.data[table] = data;
      }
    }

    // Child tables
    // Invoices children
    if (backup.data.invoices && backup.data.invoices.length > 0) {
      const invIds = backup.data.invoices.map((i: any) => i.id);
      
      const { data: invItems } = await supabase.from("invoice_items").select("*").in("invoice_id", invIds);
      if (invItems) backup.data.invoice_items = invItems;
      
      const { data: emi } = await supabase.from("emi_schedules").select("*").in("invoice_id", invIds);
      if (emi) backup.data.emi_schedules = emi;
      
      const { data: measurements } = await supabase.from("tailor_measurements").select("*").in("invoice_id", invIds);
      if (measurements) backup.data.tailor_measurements = measurements;
    }

    // Returns children
    if (backup.data.returns && backup.data.returns.length > 0) {
      const retIds = backup.data.returns.map((r: any) => r.id);
      const { data: retItems } = await supabase.from("return_items").select("*").in("return_id", retIds);
      if (retItems) backup.data.return_items = retItems;
    }

    // Purchase orders children
    if (backup.data.purchase_orders && backup.data.purchase_orders.length > 0) {
      const poIds = backup.data.purchase_orders.map((p: any) => p.id);
      const { data: poItems } = await supabase.from("purchase_order_items").select("*").in("purchase_order_id", poIds);
      if (poItems) backup.data.purchase_order_items = poItems;
    }

    // Sales children
    if (backup.data.sales && backup.data.sales.length > 0) {
      const saleIds = backup.data.sales.map((s: any) => s.id);
      const { data: saleItems } = await supabase.from("sale_items").select("*").in("sale_id", saleIds);
      if (saleItems) backup.data.sale_items = saleItems;
    }

    // Register sessions children
    if (backup.data.register_sessions && backup.data.register_sessions.length > 0) {
      const sessIds = backup.data.register_sessions.map((s: any) => s.id);
      const { data: readings } = await supabase.from("shift_meter_readings").select("*").in("register_session_id", sessIds);
      if (readings) backup.data.shift_meter_readings = readings;
    }

    // Installments children
    if (backup.data.installment_plans && backup.data.installment_plans.length > 0) {
      const planIds = backup.data.installment_plans.map((p: any) => p.id);
      const { data: payments } = await supabase.from("installment_payments").select("*").in("plan_id", planIds);
      if (payments) backup.data.installment_payments = payments;
    }

    // Gift card children
    if (backup.data.gift_cards && backup.data.gift_cards.length > 0) {
      const gcIds = backup.data.gift_cards.map((g: any) => g.id);
      const { data: gcTransactions } = await supabase.from("gift_card_transactions").select("*").in("gift_card_id", gcIds);
      if (gcTransactions) backup.data.gift_card_transactions = gcTransactions;
    }

    return backup;
  };

  const handleLocalExport = async () => {
    setExporting(true);
    const toastId = toast.loading("Generating backup file...");
    try {
      const backupData = await generateBackupJson();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `hisabx_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Local backup downloaded successfully", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate backup: " + err.message, { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const handleGDriveExport = async () => {
    if (!accessToken || !folderId) {
      toast.error("Google Drive connection missing");
      return;
    }

    setExporting(true);
    const toastId = toast.loading("Exporting backup to Google Drive...");
    try {
      const backupData = await generateBackupJson();
      const content = JSON.stringify(backupData, null, 2);
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `hisabx_backup_${dateStr}.json`;

      // Multipart upload format
      const boundary = "314159265358979323846";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: filename,
        parents: [folderId],
        mimeType: "application/json"
      };

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        closeDelimiter;

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        }
      );

      if (!uploadRes.ok) throw new Error("Upload request failed");

      toast.success("Successfully uploaded to Google Drive!", { id: toastId });
      await fetchDriveBackups(accessToken, folderId);
    } catch (err: any) {
      console.error(err);
      toast.error("Google Drive upload failed: " + err.message, { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // Perform database restoration
  const performRestore = async (backup: any) => {
    if (!backup.data || typeof backup.data !== "object") {
      throw new Error("Invalid backup format: data object is missing");
    }

    setRestoring(true);
    
    // Child first deletion order to resolve dependencies
    const deleteOrder = [
      { table: "return_items", parentCol: "return_id", parentTable: "returns" },
      { table: "invoice_items", parentCol: "invoice_id", parentTable: "invoices" },
      { table: "sale_items", parentCol: "sale_id", parentTable: "sales" },
      { table: "purchase_order_items", parentCol: "purchase_order_id", parentTable: "purchase_orders" },
      { table: "emi_schedules", parentCol: "invoice_id", parentTable: "invoices" },
      { table: "tailor_measurements", parentCol: "invoice_id", parentTable: "invoices" },
      { table: "shift_meter_readings", parentCol: "register_session_id", parentTable: "register_sessions" },
      { table: "installment_payments", parentCol: "plan_id", parentTable: "installment_plans" },
      { table: "gift_card_transactions", parentCol: "gift_card_id", parentTable: "gift_cards" },

      { table: "returns", isDirect: true },
      { table: "invoices", isDirect: true },
      { table: "sales", isDirect: true },
      { table: "purchase_orders", isDirect: true },
      { table: "credit_transactions", isDirect: true },
      { table: "account_transactions", isDirect: true },
      { table: "expenses", isDirect: true },
      { table: "stitching_orders", isDirect: true },
      { table: "repair_tickets", isDirect: true },
      { table: "installment_plans", isDirect: true },
      { table: "gift_cards", isDirect: true },
      { table: "register_sessions", isDirect: true },
      { table: "fuel_pumps", isDirect: true },
      { table: "fuel_tanks", isDirect: true },
      { table: "stock_adjustments", isDirect: true },
      { table: "stock", isDirect: true },
      { table: "product_barcodes", isDirect: true },
      { table: "product_variants", isDirect: true },
      { table: "products", isDirect: true },
      { table: "formulations", isDirect: true },
      { table: "shelves", isDirect: true },
      { table: "units", isDirect: true },
      { table: "categories", isDirect: true },
      { table: "brands", isDirect: true },
      { table: "customers", isDirect: true },
      { table: "parties", isDirect: true },
      { table: "cash_accounts", isDirect: true },
      { table: "company_details", isDirect: true },
      { table: "print_settings", isDirect: true },
      { table: "warehouses", isDirect: true }
    ];

    // Deletion Phase
    for (const item of deleteOrder) {
      setRestoreProgress(`Clearing old records from ${item.table}...`);
      if (item.isDirect) {
        const { error } = await supabase
          .from(item.table)
          .delete()
          .eq("shop_id", shopId);
        if (error) console.warn(`Error deleting ${item.table}:`, error.message);
      } else if (item.parentTable && item.parentCol) {
        // Fetch parent IDs first
        const { data: parentRows } = await supabase
          .from(item.parentTable)
          .select("id")
          .eq("shop_id", shopId);
        
        if (parentRows && parentRows.length > 0) {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .in(item.parentCol, parentRows.map(p => p.id));
          if (error) console.warn(`Error deleting ${item.table}:`, error.message);
        }
      }
    }

    // Parent first insertion order
    const insertOrder = [
      "warehouses", "print_settings", "company_details", "cash_accounts", 
      "parties", "customers", "brands", "categories", "units", "shelves", 
      "formulations", "products", "product_variants", "product_barcodes", 
      "stock", "stock_adjustments", "register_sessions", "fuel_tanks", 
      "fuel_pumps", "stitching_orders", "repair_tickets", "gift_cards", 
      "installment_plans", "expenses", "account_transactions", "credit_transactions", 
      "purchase_orders", "purchase_order_items", "sales", "sale_items", 
      "invoices", "invoice_items", "emi_schedules", "tailor_measurements", 
      "returns", "return_items", "shift_meter_readings", "installment_payments", 
      "gift_card_transactions"
    ];

    // Insertion Phase
    for (const table of insertOrder) {
      const rows = backup.data[table];
      if (rows && rows.length > 0) {
        setRestoreProgress(`Restoring ${rows.length} rows to ${table}...`);
        
        // Force replace shop_id with current shopId
        const sanitizedRows = rows.map((row: any) => {
          if ("shop_id" in row) {
            return { ...row, shop_id: shopId };
          }
          return row;
        });

        const { error } = await supabase.from(table).insert(sanitizedRows);
        if (error) {
          console.error(`Failed to insert into ${table}:`, error);
          throw new Error(`Failed to restore ${table}: ${error.message}`);
        }
      }
    }

    setRestoreProgress("");
    setRestoring(false);
  };

  const handleLocalRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      "WARNING: Restoring a database backup will overwrite ALL current shop data. Are you sure you want to continue?"
    );
    if (!confirmRestore) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const toastId = toast.loading("Restoring local backup data...");
      try {
        const text = evt.target?.result as string;
        const backup = JSON.parse(text);
        
        await performRestore(backup);
        toast.success("Database restored successfully!", { id: toastId });
      } catch (err: any) {
        console.error(err);
        toast.error("Restoration failed: " + err.message, { id: toastId });
        setRestoring(false);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleGDriveRestore = async (fileId: string) => {
    if (!accessToken) {
      toast.error("Google Drive connection missing");
      return;
    }

    const confirmRestore = window.confirm(
      "WARNING: Restoring a database backup will overwrite ALL current shop data. Are you sure you want to continue?"
    );
    if (!confirmRestore) return;

    const toastId = toast.loading("Downloading backup from Google Drive...");
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to download file from Google Drive");

      const backup = await res.json();
      toast.loading("Restoring backup data...", { id: toastId });
      await performRestore(backup);
      toast.success("Database restored successfully from Google Drive!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Google Drive restore failed: " + err.message, { id: toastId });
      setRestoring(false);
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
          Only the Superadmin role has permission to export or restore database backups.
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
          <Database className="text-blue-600" />
          Database Backups
        </h1>
        <p className="text-sm text-zinc-500">
          Securely export your shop data to local JSON files or Google Drive, and restore them when needed.
        </p>
      </div>

      {restoring && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4 animate-pulse">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <div>
            <h4 className="text-sm font-bold text-blue-950">Restoration in Progress...</h4>
            <p className="text-xs text-blue-700 mt-1 font-semibold">{restoreProgress}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Backup Control */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
                <Download size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">Local Backups</h3>
                <p className="text-xs text-zinc-500">Download data directly or restore using a JSON file.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleLocalExport}
              disabled={exporting || restoring}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm transition disabled:opacity-50"
            >
              {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Export Local Backup
            </button>
            <label className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold py-2.5 rounded-lg text-sm transition cursor-pointer text-center disabled:opacity-50">
              <Upload size={16} />
              Restore Local Backup
              <input
                type="file"
                accept=".json"
                onChange={handleLocalRestore}
                disabled={exporting || restoring}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Google Drive Integration Control */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shadow-inner">
                <Cloud size={20} />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">Google Drive Integration</h3>
                <p className="text-xs text-zinc-500">Automate backups to Google Drive cloud storage.</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed mb-3">
              Authorize Hisab X to access a folder named <strong>HisabX_Backups</strong> in your personal Google Drive account to write and restore backups dynamically.
            </p>

            <form onSubmit={handleSaveClientId} className="space-y-2 mt-2 pt-2 border-t border-zinc-150">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Advanced: Use Custom Client ID (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  placeholder="Defaults to pre-configured app credentials..."
                  className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  className="bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-semibold px-3 rounded-lg transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>

          <div>
            {!gdriveLinked ? (
              <button
                onClick={handleLinkGDrive}
                disabled={gdriveLoading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm transition disabled:opacity-50"
              >
                {gdriveLoading ? <Loader2 className="animate-spin" size={16} /> : <Cloud size={16} />}
                Connect Google Drive
              </button>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-green-50 rounded-xl border border-green-200">
                <div className="flex items-center gap-2 text-xs font-semibold text-green-800">
                  <CheckCircle size={16} className="text-green-600" />
                  Drive connected successfully
                </div>
                <button
                  onClick={() => setGdriveLinked(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-900 underline"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {gdriveLinked && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2">
              <FolderSync size={18} className="text-blue-600" />
              Google Drive Backups Directory
            </h3>
            <button
              onClick={handleGDriveExport}
              disabled={exporting || restoring}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition disabled:opacity-50"
            >
              {exporting ? <Loader2 className="animate-spin" size={14} /> : <Cloud size={14} />}
              Upload New Backup
            </button>
          </div>

          {driveBackups.length === 0 ? (
            <div className="text-center py-10 bg-zinc-50 rounded-xl border border-zinc-100">
              <Database size={32} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">No backups found in Google Drive.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 max-h-60 overflow-y-auto">
              {driveBackups.map((file) => (
                <div key={file.id} className="flex items-center justify-between py-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-950 truncate max-w-md">{file.name}</h4>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">
                      Uploaded on: {new Date(file.createdTime).toLocaleString()} 
                      {file.size && ` • ${Math.round(parseInt(file.size) / 1024)} KB`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleGDriveRestore(file.id)}
                    disabled={restoring}
                    className="flex items-center gap-1 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    <RefreshCw size={12} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Helpful Instructions */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 flex gap-3.5">
        <Info size={20} className="text-zinc-500 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h4 className="text-xs font-black text-zinc-700 uppercase tracking-wider">How to enable Google Drive backups?</h4>
          <ol className="list-decimal pl-4 text-xs text-zinc-600 space-y-1 leading-relaxed">
            <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console</a> and create a project.</li>
            <li>Configure the OAuth consent screen with the <code>.../auth/drive.file</code> scope.</li>
            <li>Create an OAuth 2.0 Client ID for a <strong>Web application</strong>.</li>
            <li>Add <code>http://localhost:3000</code> to the <strong>Authorized JavaScript origins</strong>.</li>
            <li>Copy the client ID, paste it into the field above, and click Save. You can now securely link your drive.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
