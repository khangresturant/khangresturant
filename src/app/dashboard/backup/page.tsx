"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "@/context/ShopContext";
import { shouldDisableBackupRestore } from "@/lib/deployment/flame9-brand";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, Download, Upload, Cloud, RefreshCw, Loader2,
  CheckCircle, AlertTriangle, Key, ShieldAlert, FolderSync, Info,
  History, Calendar, Search, Filter, Clock, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { SubscriptionBlocker } from "@/components/dashboard/SubscriptionBlocker";

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
  const router = useRouter();
  const { shopId, shopName, userRole, allowBackup } = useShop();
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

  // Automatic Backup states
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupTime, setAutoBackupTime] = useState("03:00");
  const [serverBackups, setServerBackups] = useState<any[]>([]);
  const [serverBackupsLoading, setServerBackupsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Audit Logs states
  const [activeSubTab, setActiveSubTab] = useState<"backups" | "audit">("backups");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditUserFilter, setAuditUserFilter] = useState("all");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    if (shouldDisableBackupRestore()) {
      router.replace("/dashboard/restaurant/pos");
    }
  }, [router]);

  // Load Google Client ID from localStorage if exists
  useEffect(() => {
    const savedId = localStorage.getItem("hx_google_client_id") || "";
    // Prefer user-saved ID, else env default (never hardcode OAuth client secrets in source)
    if (savedId) {
      setGoogleClientId(savedId);
    } else if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      setGoogleClientId(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
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

  // Load automatic backup settings + Google Drive status from shops table
  useEffect(() => {
    const loadBackupSettings = async () => {
      if (!shopId) return;
      try {
        const { data, error } = await supabase
          .from("shops")
          .select("backup_enabled, backup_time, gdrive_refresh_token, gdrive_folder_id")
          .eq("id", shopId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setAutoBackupEnabled(data.backup_enabled || false);
          setAutoBackupTime(data.backup_time || "03:00");
          // If refresh token saved in DB → Drive is permanently linked
          if (data.gdrive_refresh_token) {
            setGdriveLinked(true);
            setFolderId(data.gdrive_folder_id || null);
            // Auto-load Drive backups using stored refresh token
            autoLoadDriveBackups(shopId);
          }
        }
      } catch (err: any) {
        console.error("Failed to load automatic backup settings:", err);
      }
    };

    const autoLoadDriveBackups = async (sid: string) => {
      try {
        const tokenRes = await fetch(`/api/backups/gdrive-token?shopId=${sid}`);
        if (!tokenRes.ok) return;
        const tokenData = await tokenRes.json();
        if (tokenData.access_token && tokenData.folder_id) {
          setAccessToken(tokenData.access_token);
          setFolderId(tokenData.folder_id);
          // Fetch Drive backup files list
          const filesRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${tokenData.folder_id}' in parents and trashed=false&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`,
            { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
          );
          const filesData = await filesRes.json();
          setDriveBackups(filesData.files || []);
        }
      } catch (err: any) {
        console.error("Auto Drive backups load failed:", err);
      }
    };

    loadBackupSettings();
  }, [shopId]);

  const handleSaveAutoBackupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;
    setSavingSettings(true);
    const toastId = toast.loading("Saving backup settings...");
    try {
      const { error } = await supabase
        .from("shops")
        .update({
          backup_enabled: autoBackupEnabled,
          backup_time: autoBackupTime
        })
        .eq("id", shopId);

      if (error) throw error;
      toast.success("Automatic backup settings updated successfully!", { id: toastId });
    } catch (err: any) {
      toast.error("Failed to save settings: " + err.message, { id: toastId });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteServerBackup = async (filename: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete backup "${filename}" from the server?`);
    if (!confirmDelete) return;

    const toastId = toast.loading("Deleting backup from server...");
    try {
      const res = await fetch("/api/backups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete backup");

      toast.success("Backup deleted from server successfully!", { id: toastId });
      // Refresh list
      const freshRes = await fetch("/api/backups");
      const freshData = await freshRes.json();
      if (freshData.files) {
        setServerBackups(freshData.files);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete backup.", { id: toastId });
    }
  };

  const handleServerBackupRestore = async (filename: string) => {
    const confirmRestore = window.confirm(
      "WARNING: Restoring a database backup will overwrite ALL current shop data. Are you sure you want to continue?"
    );
    if (!confirmRestore) return;

    const toastId = toast.loading("Downloading backup from server...");
    try {
      const res = await fetch(`/api/backups?filename=${filename}`);
      if (!res.ok) throw new Error("Failed to download backup file");

      const backup = await res.json();
      toast.loading("Restoring backup data...", { id: toastId });
      await performRestore(backup);
      toast.success("Database restored successfully from server backup!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Server backup restore failed: " + err.message, { id: toastId });
      setRestoring(false);
    }
  };

  const fetchUsers = async () => {
    if (!shopId) return;
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, name")
        .eq("shop_id", shopId);
      if (error) throw error;
      setUsersList(data || []);
    } catch (err: any) {
      console.error("Failed to load users: ", err);
    }
  };

  const fetchAuditLogs = async () => {
    if (!shopId) return;
    setAuditLoading(true);
    try {
      let queryBuilder = supabase
        .from("audit_logs")
        .select(`
          id,
          action,
          details,
          ip_address,
          created_at,
          table_name,
          record_id,
          user_id,
          old_data,
          new_data
        `)
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (auditStartDate) {
        queryBuilder = queryBuilder.gte("created_at", `${auditStartDate}T00:00:00Z`);
      }
      if (auditEndDate) {
        queryBuilder = queryBuilder.lte("created_at", `${auditEndDate}T23:59:59Z`);
      }
      if (auditUserFilter && auditUserFilter !== "all") {
        queryBuilder = queryBuilder.eq("user_id", auditUserFilter);
      }
      if (auditSearch) {
        queryBuilder = queryBuilder.or(`action.ilike.%${auditSearch}%,table_name.ilike.%${auditSearch}%`);
      }

      const { data, error } = await queryBuilder.limit(200);
      if (error) throw error;

      const logsWithUsers = (data || []).map((log: any) => {
        const userObj = usersList.find(u => u.id === log.user_id);
        return {
          ...log,
          user_name: userObj ? userObj.name : "System / Unknown"
        };
      });

      setAuditLogs(logsWithUsers);
    } catch (err: any) {
      toast.error("Failed to load audit logs: " + err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (shopId) {
      fetchUsers();
    }
  }, [shopId]);

  useEffect(() => {
    if (activeSubTab === "audit" && shopId) {
      fetchAuditLogs();
    }
  }, [activeSubTab, shopId, auditStartDate, auditEndDate, auditUserFilter, auditSearch, usersList.length]);

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("hx_google_client_id", googleClientId);
    toast.success("Google Client ID saved locally.");
  };

  const handleLinkGDrive = () => {
    const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
    const activeClientId = googleClientId.trim() || envClientId;
    if (!activeClientId) {
      toast.error("Google OAuth Client ID not configured.");
      return;
    }

    try {
      setGdriveLoading(true);
      // Use initCodeClient (authorization code flow) to get refresh token
      const codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: activeClientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        ux_mode: "popup",
        callback: async (codeResponse: any) => {
          if (codeResponse.error) {
            toast.error("Google Auth failed: " + (codeResponse.error_description || codeResponse.error));
            setGdriveLoading(false);
            return;
          }
          if (codeResponse.code) {
            const toastId = toast.loading("Linking Google Drive permanently...");
            try {
              // Exchange code server-side to get refresh token
              const res = await fetch("/api/backups/gdrive-auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: codeResponse.code, shopId }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Token exchange failed");

              setAccessToken(data.access_token);
              setFolderId(data.folderId);
              setGdriveLinked(true);
              toast.success("Google Drive linked permanently! Automatic backups will go to Drive.", { id: toastId });
              // List existing drive backups
              if (data.access_token && data.folderId) {
                await fetchDriveBackups(data.access_token, data.folderId);
              }
            } catch (err: any) {
              toast.error("Failed to link Google Drive: " + err.message, { id: toastId });
            } finally {
              setGdriveLoading(false);
            }
          }
        },
      });
      codeClient.requestCode();
    } catch (err: any) {
      console.error(err);
      toast.error("Could not load Google Identity client: " + err.message);
      setGdriveLoading(false);
    }
  };

  const handleUnlinkGDrive = async () => {
    if (!shopId) return;
    const confirmed = window.confirm("Disconnect Google Drive? Automatic backups will stop going to Drive.");
    if (!confirmed) return;
    const toastId = toast.loading("Disconnecting Google Drive...");
    try {
      const res = await fetch("/api/backups/gdrive-auth", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGdriveLinked(false);
      setAccessToken(null);
      setFolderId(null);
      setDriveBackups([]);
      toast.success("Google Drive disconnected.", { id: toastId });
    } catch (err: any) {
      toast.error("Failed to disconnect: " + err.message, { id: toastId });
    }
  };

  const initializeGoogleDriveFolder = async (token: string) => {
    try {
      setGdriveLoading(true);
      // 1. Search for folder TheAccounts_Backups
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='TheAccounts_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
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
            name: "TheAccounts_Backups",
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

  const fetchDriveBackups = async (token: string | null, currentFolderId: string | null) => {
    if (!token || !currentFolderId) return;
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
      downloadAnchor.setAttribute("download", `theaccounts_backup_${dateStr}.json`);
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
    setExporting(true);
    const toastId = toast.loading("Exporting backup to Google Drive...");
    try {
      // Get or refresh access token
      let token = accessToken;
      let folder = folderId;

      if (!token || !folder) {
        // Try to get fresh token from server using stored refresh token
        const tokenRes = await fetch(`/api/backups/gdrive-token?shopId=${shopId}`);
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
          toast.error("Google Drive not linked. Please connect Drive first.", { id: toastId });
          setExporting(false);
          return;
        }
        token = tokenData.access_token;
        folder = tokenData.folder_id;
        setAccessToken(token);
        setFolderId(folder);
        setGdriveLinked(true);
      }

      const backupData = await generateBackupJson();
      const content = JSON.stringify(backupData, null, 2);
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `theaccounts_backup_${dateStr}.json`;

      // Multipart upload format
      const boundary = "314159265358979323846";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: filename,
        parents: [folder],
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
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        }
      );

      if (!uploadRes.ok) throw new Error("Upload request failed");

      toast.success("Successfully uploaded to Google Drive!", { id: toastId });
      await fetchDriveBackups(token, folder);
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
            .in(item.parentCol, parentRows.map((p: any) => p.id));
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

  if (shouldDisableBackupRestore()) {
    return null;
  }

  if (!allowBackup) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-lg font-black text-zinc-900 flex items-center gap-2">
            <Database className="text-blue-600" />
            Database Backups
          </h1>
          <p className="text-sm text-zinc-500">
            Securely export your shop data to local JSON files or Google Drive, and restore them when needed.
          </p>
        </div>
        <SubscriptionBlocker featureName="Database Cloud Backups" requiredPlan="Starter" />
      </div>
    );
  }

  if (!allowBackup) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <SubscriptionBlocker 
          featureName="System Database & Cloud Backups" 
          requiredPlan="Starter" 
          description="Automated Google Drive cloud backups, local JSON exports, and point-in-time database restoration require an active Starter or Premium subscription plan."
        />
      </div>
    );
  }

  if (userRole !== "superadmin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-lg mx-auto mt-12">
        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4 animate-bounce">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-lg font-black text-zinc-900 mb-2">Access Denied</h1>
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-zinc-200 p-5 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-lg font-black text-zinc-900 flex items-center gap-2">
            {activeSubTab === "backups" ? (
              <>
                <Database className="text-blue-600 animate-pulse" />
                Database Backups
              </>
            ) : (
              <>
                <History className="text-violet-600" />
                Audit Logs & History
              </>
            )}
          </h1>
          
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab("backups")}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer ${activeSubTab === "backups"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
              }`}
          >
            📂 Backups
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("audit")}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer ${activeSubTab === "audit"
              ? "bg-white text-violet-750 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
              }`}
          >
            🛡️ Audit Logs
          </button>
        </div>
      </div>

      {activeSubTab === "backups" && (
        <>
          {restoring && (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-4 animate-pulse">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <div>
                <h4 className="text-sm font-bold text-blue-950">Restoration in Progress...</h4>
                
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
                    
                  </div>
                </div>
                


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
                      onClick={handleUnlinkGDrive}
                      className="text-xs text-zinc-500 hover:text-rose-600 underline"
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const toastId = toast.loading("Refreshing Drive backups...");
                      try {
                        const tokenRes = await fetch(`/api/backups/gdrive-token?shopId=${shopId}`);
                        const tokenData = await tokenRes.json();
                        if (!tokenRes.ok || !tokenData.access_token) {
                          toast.error("Drive not linked or token expired.", { id: toastId });
                          return;
                        }
                        setAccessToken(tokenData.access_token);
                        setFolderId(tokenData.folder_id);
                        const filesRes = await fetch(
                          `https://www.googleapis.com/drive/v3/files?q='${tokenData.folder_id}' in parents and trashed=false&orderBy=createdTime desc&fields=files(id,name,createdTime,size)`,
                          { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
                        );
                        const filesData = await filesRes.json();
                        setDriveBackups(filesData.files || []);
                        toast.success(`${(filesData.files || []).length} backups found.`, { id: toastId });
                      } catch (err: any) {
                        toast.error("Refresh failed: " + err.message, { id: toastId });
                      }
                    }}
                    className="flex items-center gap-1.5 border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-semibold px-3 py-2 rounded-lg text-xs transition"
                    title="Refresh Drive backups list"
                  >
                    <RefreshCw size={13} />
                    Refresh
                  </button>
                  <button
                    onClick={handleGDriveExport}
                    disabled={exporting || restoring}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow-sm transition disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="animate-spin" size={14} /> : <Cloud size={14} />}
                    Upload New Backup
                  </button>
                </div>
              </div>

              {driveBackups.length === 0 ? (
                <div className="text-center py-10 bg-zinc-50 rounded-xl border border-zinc-100">
                  <Database size={32} className="text-zinc-300 mx-auto mb-2" />
                  
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

          {/* Daily Automatic Backups */}
          <div className="my-6">
            {/* Settings Card */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm space-y-4 max-w-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">Daily Automatic Backups</h3>
                  
                </div>
              </div>

              <form onSubmit={handleSaveAutoBackupSettings} className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <div>
                    <label className="text-xs font-bold text-zinc-800 block">Enable Automatic Backup</label>
                    <span className="text-[10px] text-zinc-500">Backups will run automatically daily even if you are logged out.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoBackupEnabled}
                    onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                    className="h-5 w-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 block">Preferred Backup Time (Pakistan Standard Time)</label>
                  <input
                    type="time"
                    value={autoBackupTime}
                    onChange={(e) => setAutoBackupTime(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 font-bold"
                    required
                  />
                </div>

                {!gdriveLinked && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-semibold">
                    <AlertTriangle size={14} className="shrink-0" />
                    Google Drive connect karein — automatic backup Drive par jaaye ga.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingSettings ? <Loader2 className="animate-spin" size={14} /> : null}
                  Save Backup Settings
                </button>
              </form>
            </div>
          </div>

        </>
      )}

      {activeSubTab === "audit" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Filters Bar */}
          <div className="bg-white border border-zinc-200 p-5 rounded-3xl shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="w-full h-9.5 px-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-750 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                />
                <Calendar size={13} className="absolute left-2.5 top-3 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="w-full h-9.5 px-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-750 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                />
                <Calendar size={13} className="absolute left-2.5 top-3 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">User Filter</label>
              <select
                value={auditUserFilter}
                onChange={(e) => setAuditUserFilter(e.target.value)}
                className="w-full h-9.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-750 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
              >
                <option value="all">All Employees</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">Search Logs</label>
              <div className="relative">
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search action or table..."
                  className="w-full h-9.5 px-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                />
                <Search size={13} className="absolute left-2.5 top-3.5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
            {auditLoading ? (
              <div className="py-20 flex justify-center items-center">
                <Loader2 className="animate-spin text-violet-600 h-8 w-8" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-20 text-center text-slate-450">
                <History size={36} className="mx-auto mb-3 opacity-25" />
                <p className="font-bold text-sm">No audit logs found.</p>
                
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <tr>
                      <th className="py-3.5 px-5">Timestamp</th>
                      <th className="py-3.5 px-5">User</th>
                      <th className="py-3.5 px-5">Action</th>
                      <th className="py-3.5 px-5">Table/Ref</th>
                      <th className="py-3.5 px-5">IP Address</th>
                      <th className="py-3.5 px-5 text-center">Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                        <td className="py-3 px-5 text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-5 text-slate-800 font-bold">{log.user_name}</td>
                        <td className="py-3 px-5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-violet-50 text-violet-750 uppercase">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-5 font-mono text-[10px] text-slate-500">
                          {log.table_name || "—"}
                        </td>
                        <td className="py-3 px-5 text-slate-500">{log.ip_address || "—"}</td>
                        <td className="py-3 px-5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                          >
                            👁️ View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-800">Audit Trail Log Details</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase ${selectedLog.action === "INSERT" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                      selectedLog.action === "UPDATE" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                        "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}>
                      {selectedLog.action}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-450 mt-1 font-semibold">
                    Table: <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{selectedLog.table_name || "—"}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* Event Summary Card */}
                <div className="p-4 bg-violet-50/50 border border-violet-100/50 rounded-2xl flex gap-3">
                  <Info size={16} className="text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-violet-950 text-xs">Action Summary</h4>
                    <p className="text-[11px] text-violet-900 mt-1 leading-relaxed">
                      {selectedLog.user_name} performed an <strong>{selectedLog.action}</strong> on <strong>{selectedLog.table_name || "records"}</strong> on <strong>{new Date(selectedLog.created_at).toLocaleString()}</strong>.
                    </p>
                  </div>
                </div>

                {/* Main Data Changes */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Data Payload Changes</h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-450 uppercase">
                          <th className="py-2.5 px-4 w-1/3">Field</th>
                          {selectedLog.action === "UPDATE" ? (
                            <>
                              <th className="py-2.5 px-4 w-1/3">Previous Value</th>
                              <th className="py-2.5 px-4 w-1/3">New Value</th>
                            </>
                          ) : (
                            <th className="py-2.5 px-4" colSpan={2}>Value</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-700">
                        {(() => {
                          const SYSTEM_FIELDS = [
                            "id", "shop_id", "created_at", "closing_book_id", "register_session_id",
                            "waiter_id", "rider_id", "edit_history", "permissions", "is_edited",
                            "is_voided", "client_id", "user_id"
                          ];

                          const formatVal = (val: any) => {
                            if (val === null || val === undefined) return <span className="text-slate-400">—</span>;
                            if (typeof val === "boolean") {
                              return val ? (
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] border border-emerald-100 font-bold">Yes</span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] border border-slate-200 font-bold">No</span>
                              );
                            }
                            if (typeof val === "object") return JSON.stringify(val);
                            return String(val);
                          };

                          const details = selectedLog.details || {};
                          const oldData = selectedLog.old_data || {};
                          const newData = selectedLog.new_data || {};

                          // Gather all relevant keys
                          const allKeys = Array.from(new Set([
                            ...Object.keys(details),
                            ...Object.keys(oldData),
                            ...Object.keys(newData)
                          ])).filter(k => !SYSTEM_FIELDS.includes(k));

                          if (allKeys.length === 0) {
                            return (
                              <tr>
                                <td className="py-4 px-4 text-center text-slate-450 font-medium" colSpan={3}>
                                  No business data changes logged in payload.
                                </td>
                              </tr>
                            );
                          }

                          return allKeys.map(key => {
                            const friendlyName = key
                              .replace(/_id$/, " ID")
                              .replace(/_/g, " ")
                              .replace(/([A-Z])/g, " $1")
                              .trim()
                              .replace(/\b\w/g, c => c.toUpperCase());

                            if (selectedLog.action === "UPDATE") {
                              const before = oldData[key];
                              const after = newData[key];
                              const isChanged = before !== after;

                              return (
                                <tr key={key} className={isChanged ? "bg-amber-50/10 hover:bg-amber-50/20" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50"}>
                                  <td className="py-2 px-4 font-bold text-slate-800">{friendlyName}</td>
                                  <td className="py-2 px-4 font-mono text-[10px] text-rose-600 line-through max-w-[180px] overflow-hidden text-ellipsis">
                                    {formatVal(before)}
                                  </td>
                                  <td className={`py-2 px-4 font-mono text-[10px] max-w-[180px] overflow-hidden text-ellipsis ${isChanged ? "text-emerald-600 font-bold" : "text-slate-600"}`}>
                                    {formatVal(after)}
                                  </td>
                                </tr>
                              );
                            } else {
                              const val = selectedLog.action === "DELETE" ? oldData[key] : (newData[key] !== undefined ? newData[key] : details[key]);
                              return (
                                <tr key={key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors/50">
                                  <td className="py-2 px-4 font-bold text-slate-800">{friendlyName}</td>
                                  <td className="py-2 px-4 font-mono text-[10px] text-slate-600" colSpan={2}>
                                    {formatVal(val)}
                                  </td>
                                </tr>
                              );
                            }
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Technical / System Info Accordion */}
                <details className="group border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/20">
                  <summary className="p-4 flex items-center justify-between font-bold text-[10px] uppercase text-slate-450 tracking-wider cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors select-none list-none">
                    <span>Technical / System Info</span>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-4 border-t border-slate-100 bg-white font-mono text-[10px] text-slate-600 space-y-2">
                    <p><strong>Log ID:</strong> {selectedLog.id}</p>
                    <p><strong>User ID:</strong> {selectedLog.user_id || "N/A"}</p>
                    <p><strong>Record UUID:</strong> {selectedLog.record_id || "N/A"}</p>
                    <p><strong>IP Address:</strong> {selectedLog.ip_address || "—"}</p>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="font-bold mb-1">Raw JSON Payload:</p>
                      <pre className="p-3 bg-slate-50 border border-slate-150 rounded-xl overflow-x-auto text-[9px] max-h-40 overflow-y-auto">
                        {JSON.stringify(selectedLog, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs rounded-xl shadow-md shadow-violet-600/10 hover:shadow-violet-600/20 transition-all cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
