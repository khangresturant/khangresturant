"use client";

import React, { useState, useRef } from "react";
import { useShop } from "@/context/ShopContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, FileText, Download, CheckCircle2,
  Loader2, ArrowRight, Table, Sparkles, Layers, Database, FileUp,
  Camera, Image as ImageIcon, Trash2, Plus, Edit3, RefreshCw,
  Eye, Check, AlertTriangle, HelpCircle, ArrowLeft, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";
import Link from "next/link";

type ImportType = "products" | "customers" | "suppliers";

interface ColumnMapping {
  name: string;
  sale_price: string;
  cost_price: string;
  current_stock: string;
  barcode: string;
  unit: string;
  phone: string;
  address: string;
  balance: string;
}

export default function DataMigrationPage() {
  const { shopId, shopName } = useShop();
  const { t } = useLanguage();

  const [importType, setImportType] = useState<ImportType>("products");
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [customAiInstructions, setCustomAiInstructions] = useState("");
  
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: "",
    sale_price: "",
    cost_price: "",
    current_stock: "",
    barcode: "",
    unit: "",
    phone: "",
    address: "",
    balance: "",
  });

  const [loading, setLoading] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ title?: string; language?: string } | null>(null);
  
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: string } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    importedCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-Detect Headers Match
  const autoDetectHeaders = (headers: string[]) => {
    const mapping: ColumnMapping = {
      name: "",
      sale_price: "",
      cost_price: "",
      current_stock: "",
      barcode: "",
      unit: "",
      phone: "",
      address: "",
      balance: "",
    };

    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();
      if (!mapping.name && (lower.includes("name") || lower.includes("title") || lower.includes("product") || lower.includes("item") || lower.includes("nam") || lower.includes("cheez"))) {
        mapping.name = h;
      } else if (!mapping.sale_price && (lower.includes("sale") || lower.includes("rate") || lower.includes("price") || lower.includes("retail") || lower.includes("qimat") || lower.includes("farokht"))) {
        mapping.sale_price = h;
      } else if (!mapping.cost_price && (lower.includes("cost") || lower.includes("purchase") || lower.includes("buy") || lower.includes("kharid") || lower.includes("wholesale"))) {
        mapping.cost_price = h;
      } else if (!mapping.current_stock && (lower.includes("stock") || lower.includes("qty") || lower.includes("quantity") || lower.includes("tadad") || lower.includes("units"))) {
        mapping.current_stock = h;
      } else if (!mapping.barcode && (lower.includes("code") || lower.includes("barcode") || lower.includes("sku") || lower.includes("upc"))) {
        mapping.barcode = h;
      } else if (!mapping.unit && (lower.includes("unit") || lower.includes("pack") || lower.includes("box") || lower.includes("type"))) {
        mapping.unit = h;
      } else if (!mapping.phone && (lower.includes("phone") || lower.includes("mobile") || lower.includes("contact") || lower.includes("num") || lower.includes("rabta"))) {
        mapping.phone = h;
      } else if (!mapping.address && (lower.includes("address") || lower.includes("city") || lower.includes("location") || lower.includes("pata"))) {
        mapping.address = h;
      } else if (!mapping.balance && (lower.includes("balance") || lower.includes("credit") || lower.includes("udhari") || lower.includes("amount") || lower.includes("baqi") || lower.includes("khata"))) {
        mapping.balance = h;
      }
    });

    setColumnMapping(mapping);
  };

  // Process image with real Gemini AI Vision OCR
  const scanImageWithAiVision = async (imageFile: File) => {
    setAiScanning(true);
    const toastId = toast.loading("AI Vision reading handwritten register & transcribing text...", { duration: 60000 });

    try {
      // 1. Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const base64Data = await base64Promise;
      setImagePreviewUrl(base64Data);

      // 2. Call /api/migrate/scan-ai
      const res = await fetch("/api/migrate/scan-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: imageFile.type || "image/jpeg",
          importType,
          customInstructions: customAiInstructions,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to scan image with AI Vision");
      }

      setAiMeta({ title: data.detectedTitle, language: data.detectedLanguage });
      setParsedHeaders(data.headers || []);
      setParsedRows(data.rows || []);
      autoDetectHeaders(data.headers || []);

      toast.success(`AI Vision scanned ${data.extractedCount} records successfully!`, { id: toastId });
    } catch (err: any) {
      console.error("AI Vision scan error:", err);
      toast.error(err.message || "Failed to transcribe handwritten image", { id: toastId });
    } finally {
      setAiScanning(false);
    }
  };

  // Process Excel files (.xlsx, .xls)
  const processExcelFile = async (excelFile: File) => {
    const data = await excelFile.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert sheet to json array of objects
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

    if (!jsonData || jsonData.length === 0) {
      throw new Error("The Excel worksheet is empty.");
    }

    const rawHeaders = (jsonData[0] as any[]).map(h => String(h || "").trim()).filter(Boolean);
    const rawRows = jsonData.slice(1).filter((r: any) => r && r.length > 0);

    const structuredRows = rawRows.map((row: any) => {
      const obj: Record<string, any> = {};
      rawHeaders.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? String(row[idx]).trim() : "";
      });
      return obj;
    });

    setParsedHeaders(rawHeaders);
    setParsedRows(structuredRows);
    autoDetectHeaders(rawHeaders);
    toast.success(`Loaded ${structuredRows.length} records from Excel sheet "${firstSheetName}"!`);
  };

  // Process CSV / TSV text
  const processCsvFile = async (csvFile: File) => {
    const text = await csvFile.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) throw new Error("CSV file is empty.");

    const rawRows = lines.map(line => line.split(/,|\t/).map(cell => cell.replace(/^["']|["']$/g, '').trim()));
    const headers = rawRows[0].map(h => String(h || "").trim()).filter(Boolean);
    const dataRows = rawRows.slice(1).filter(r => r.length > 0);

    const structuredRows = dataRows.map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = row[idx] !== undefined ? row[idx] : "";
      });
      return obj;
    });

    setParsedHeaders(headers);
    setParsedRows(structuredRows);
    autoDetectHeaders(headers);
    toast.success(`Successfully parsed ${structuredRows.length} records from CSV file.`);
  };

  // Main file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setImportResult(null);

    const isImage = uploadedFile.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic)$/i.test(uploadedFile.name);
    const isExcel = /\.(xlsx|xls|csv)$/i.test(uploadedFile.name);

    try {
      if (isImage) {
        await scanImageWithAiVision(uploadedFile);
      } else if (/\.(xlsx|xls)$/i.test(uploadedFile.name)) {
        await processExcelFile(uploadedFile);
      } else {
        await processCsvFile(uploadedFile);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to parse uploaded file");
    } finally {
      setLoading(false);
    }
  };

  // Cell Edit Handler
  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    setParsedRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [colKey]: value };
      return next;
    });
  };

  // Delete Row
  const handleDeleteRow = (index: number) => {
    setParsedRows(prev => prev.filter((_, i) => i !== index));
    toast.info("Row removed from import preview");
  };

  // Add New Row
  const handleAddNewRow = () => {
    const newObj: Record<string, any> = {};
    parsedHeaders.forEach(h => {
      newObj[h] = "";
    });
    setParsedRows(prev => [newObj, ...prev]);
    toast.success("New empty row added to the top of table");
  };

  // Download Sample Template CSV Files
  const downloadSampleTemplate = (type: ImportType) => {
    let headers: string[] = [];
    let sampleRows: any[] = [];
    let filename = "";

    if (type === "products") {
      filename = "TheAccounts_Sample_Products_Template.csv";
      headers = ["Item Name", "Sale Price", "Cost Price", "Stock Qty", "Barcode", "Unit"];
      sampleRows = [
        ["Panadol 500mg (Sample)", 350, 280, 50, "890123456789", "Box"],
        ["Augmentin 625mg", 450, 380, 20, "890987654321", "Pack"],
        ["Brufen 400mg", 180, 140, 100, "890112233445", "Pcs"]
      ];
    } else if (type === "customers") {
      filename = "TheAccounts_Sample_Customers_Khata_Template.csv";
      headers = ["Customer Name", "Phone", "Address", "Opening Balance"];
      sampleRows = [
        ["Muhammad Ali", "03001234567", "Gulberg III, Lahore", 5500],
        ["Usman Traders", "03219876543", "Saddar, Karachi", 12000],
        ["Zahid Pharmacy", "03334445556", "Raja Bazaar, Rawalpindi", 0]
      ];
    } else {
      filename = "TheAccounts_Sample_Suppliers_Template.csv";
      headers = ["Supplier Name", "Phone", "Address", "Opening Balance"];
      sampleRows = [
        ["Al-Madina Distributors", "03005556677", "Shah Alam Market, Lahore", 45000],
        ["National Pharma Distributors", "03127778899", "I.I Chundrigar, Karachi", 120000]
      ];
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...sampleRows.map(r => r.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded ${filename}`);
  };

  // Execute Batch Migration
  const handleExecuteMigration = async () => {
    if (parsedRows.length === 0) {
      toast.error("No data rows available to import.");
      return;
    }

    if (!columnMapping.name) {
      toast.error("Please map the 'Name' column before starting import.");
      return;
    }

    setImporting(true);
    const toastId = toast.loading(`Importing ${parsedRows.length} records into database...`, { duration: 60000 });

    try {
      // Map parsed rows
      const mappedItems = parsedRows.map((row) => ({
        name: row[columnMapping.name] || "",
        sale_price: Number(row[columnMapping.sale_price]) || 0,
        cost_price: Number(row[columnMapping.cost_price]) || 0,
        current_stock: Number(row[columnMapping.current_stock]) || 0,
        barcode: row[columnMapping.barcode] ? String(row[columnMapping.barcode]).trim() : "",
        unit: row[columnMapping.unit] ? String(row[columnMapping.unit]).trim() : "Pcs",
        phone: row[columnMapping.phone] ? String(row[columnMapping.phone]).trim() : "",
        address: row[columnMapping.address] ? String(row[columnMapping.address]).trim() : "",
        balance: Number(row[columnMapping.balance]) || 0,
      }));

      // Filter out totally empty names
      const validItems = mappedItems.filter(item => item.name && item.name.trim() !== "");

      if (validItems.length === 0) {
        throw new Error("All records had empty names. Please check your column mapping.");
      }

      const res = await fetch("/api/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importType,
          items: validItems,
          targetShopId: shopId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Migration failed");
      }

      setImportResult(data);
      toast.success(`Migration completed! Successfully imported ${data.importedCount} records.`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("Import failed: " + err.message, { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  // Calculations for summary banner
  const totalRecords = parsedRows.length;
  const totalStockUnits = importType === "products" && columnMapping.current_stock
    ? parsedRows.reduce((sum, r) => sum + (Number(r[columnMapping.current_stock]) || 0), 0)
    : 0;
  const totalRetailVal = importType === "products" && columnMapping.sale_price && columnMapping.current_stock
    ? parsedRows.reduce((sum, r) => sum + ((Number(r[columnMapping.sale_price]) || 0) * (Number(r[columnMapping.current_stock]) || 0)), 0)
    : 0;
  const totalBalanceVal = (importType === "customers" || importType === "suppliers") && columnMapping.balance
    ? parsedRows.reduce((sum, r) => sum + (Number(r[columnMapping.balance]) || 0), 0)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 min-h-screen text-slate-900 pb-28">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Sparkles size={14} className="text-indigo-400 animate-pulse" />
              Universal AI Migration Engine 2026
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Data Import & Handwritten OCR Studio
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Import existing products, customer khata balances, and supplier payables from 
              <strong className="text-indigo-300"> Handwritten Register Photos (Urdu/English)</strong>, Excel (.xlsx), CSV, and PDF documents.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSampleTemplate("products")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm text-xs font-semibold gap-1.5"
            >
              <Download size={14} /> Sample Products CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadSampleTemplate("customers")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm text-xs font-semibold gap-1.5"
            >
              <Download size={14} /> Sample Khata CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Step 1: Select Type */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600">
          <Layers size={16} /> Step 1: Select What You Want To Import
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => {
              setImportType("products");
              setParsedRows([]);
              setParsedHeaders([]);
              setFile(null);
            }}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-4 ${
              importType === "products"
                ? "bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600/20 shadow-sm"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className={`p-3 rounded-lg ${importType === "products" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Products & Stock Catalog</h3>
              <p className="text-xs text-slate-500 mt-1">Import item names, purchase rates, sale prices, current stock & barcodes</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportType("customers");
              setParsedRows([]);
              setParsedHeaders([]);
              setFile(null);
            }}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-4 ${
              importType === "customers"
                ? "bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600/20 shadow-sm"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className={`p-3 rounded-lg ${importType === "customers" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Customer Khata Balances</h3>
              <p className="text-xs text-slate-500 mt-1">Import customer ledger, phone contacts & opening udhaar receivables</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportType("suppliers");
              setParsedRows([]);
              setParsedHeaders([]);
              setFile(null);
            }}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-4 ${
              importType === "suppliers"
                ? "bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-600/20 shadow-sm"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className={`p-3 rounded-lg ${importType === "suppliers" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Supplier Payables</h3>
              <p className="text-xs text-slate-500 mt-1">Import vendor contacts, company names & opening payable balances</p>
            </div>
          </button>
        </div>
      </div>

      {/* Step 2: Upload File / Handwritten Photo */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-600">
            <FileUp size={16} /> Step 2: Upload File Or Scan Handwritten Register Photo
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            <Camera size={13} /> AI Handwritten Register Vision OCR Supported (اردو / English)
          </span>
        </div>

        {/* Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, .xlsx, .xls, .pdf, .jpg, .jpeg, .png, .webp, .heic, image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="p-4 rounded-full bg-white shadow-md border border-slate-200 group-hover:scale-110 group-hover:border-indigo-300 transition-all text-indigo-600">
            {loading || aiScanning ? (
              <Loader2 size={32} className="animate-spin text-indigo-600" />
            ) : (
              <Upload size={32} />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800">
              {file ? file.name : "Click or Drag & Drop File / Handwritten Photo Here"}
            </p>
            <p className="text-xs text-slate-500">
              Supports <strong>Handwritten Register Photos (.jpg, .png)</strong>, Excel (.xlsx, .xls), and CSV (.csv)
            </p>
          </div>

          {file && (
            <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              <CheckCircle2 size={12} /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>

        {/* Scanned Image Preview Thumbnail if available */}
        {imagePreviewUrl && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start gap-4">
            <div className="relative h-28 w-28 rounded-lg overflow-hidden border border-slate-300 shadow-sm flex-shrink-0 bg-slate-900">
              <img src={imagePreviewUrl} alt="Handwritten preview" className="h-full w-full object-cover" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[11px] font-bold">
                  AI OCR Scanned Photo
                </span>
                {aiMeta?.language && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                    Detected: {aiMeta.language}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {aiMeta?.title || "Handwritten document analyzed by Google Gemini Vision. Check the extracted grid below to review and edit any values before saving."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => scanImageWithAiVision(file!)}
                disabled={aiScanning || !file}
                className="text-xs font-semibold gap-1.5 h-8 mt-1"
              >
                <RefreshCw size={12} className={aiScanning ? "animate-spin" : ""} />
                Re-Scan with AI
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Step 3 & 4: Interactive Editable Table & Column Mapping */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Records</span>
              <p className="text-xl font-black text-slate-900 mt-1">{totalRecords}</p>
            </div>

            {importType === "products" ? (
              <>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Units in Stock</span>
                  <p className="text-xl font-black text-indigo-600 mt-1">{totalStockUnits.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Est. Retail Value</span>
                  <p className="text-xl font-black text-emerald-600 mt-1">Rs {totalRetailVal.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status</span>
                  <p className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-1">
                    <CheckCircle2 size={16} /> Ready to Import
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Opening Balance</span>
                  <p className="text-xl font-black text-indigo-600 mt-1">Rs {totalBalanceVal.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status</span>
                  <p className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-1">
                    <CheckCircle2 size={16} /> Ready to Import
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Visual Column Mapping Bar */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" />
                Column Auto-Mapping & Target Columns
              </span>
              <span className="text-xs text-slate-500 font-medium">Verify field associations below</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {importType === "products" ? (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Product Name <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={columnMapping.name}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Sale Price</label>
                    <select
                      value={columnMapping.sale_price}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, sale_price: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Cost / Purchase</label>
                    <select
                      value={columnMapping.cost_price}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, cost_price: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Stock Qty</label>
                    <select
                      value={columnMapping.current_stock}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, current_stock: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Barcode / SKU</label>
                    <select
                      value={columnMapping.barcode}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, barcode: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Unit (Pcs/Box)</label>
                    <select
                      value={columnMapping.unit}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      {importType === "customers" ? "Customer Name" : "Supplier Name"} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={columnMapping.name}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Phone Number</label>
                    <select
                      value={columnMapping.phone}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Address / City</label>
                    <select
                      value={columnMapping.address}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Opening Balance (Udhaar)</label>
                    <select
                      value={columnMapping.balance}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, balance: e.target.value }))}
                      className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Select Column --</option>
                      {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Editable Grid Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="font-bold text-base text-slate-900">Extracted Records Grid</h3>
              <p className="text-xs text-slate-500">You can click any cell to edit its value directly before executing the migration.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddNewRow}
                className="text-xs font-semibold gap-1.5 border-slate-300"
              >
                <Plus size={14} /> Add Row
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteMigration}
                disabled={importing || parsedRows.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-md shadow-indigo-500/20"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Import {parsedRows.length} Records to DB
              </Button>
            </div>
          </div>

          {/* Interactive Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200">
                <tr>
                  <th className="p-3 font-extrabold text-slate-600 w-12 text-center">#</th>
                  {parsedHeaders.map(header => (
                    <th key={header} className="p-3 font-extrabold text-slate-700 whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                  <th className="p-3 font-extrabold text-slate-600 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-800">
                {parsedRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-indigo-50/40 transition-colors group">
                    <td className="p-3 text-center text-slate-400 text-[11px] font-mono">{rIdx + 1}</td>
                    {parsedHeaders.map(col => {
                      const isEditing = editingCell?.rowIndex === rIdx && editingCell?.colKey === col;
                      return (
                        <td
                          key={col}
                          onClick={() => setEditingCell({ rowIndex: rIdx, colKey: col })}
                          className="p-2.5 cursor-pointer relative"
                        >
                          {isEditing ? (
                            <Input
                              autoFocus
                              value={row[col] ?? ""}
                              onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") setEditingCell(null);
                              }}
                              className="h-7 text-xs font-medium p-1.5 border-indigo-500 ring-2 ring-indigo-500/20"
                            />
                          ) : (
                            <span className="block truncate max-w-[200px]" title={String(row[col] ?? "")}>
                              {row[col] !== undefined && row[col] !== "" ? String(row[col]) : <span className="text-slate-300 italic">empty</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(rIdx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-60 group-hover:opacity-100"
                        title="Delete this row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Execution Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-sm font-bold">Ready to commit {parsedRows.length} records</p>
                <p className="text-xs text-slate-400">Items will be added into your active business ({shopName || "Active Business"})</p>
              </div>
            </div>

            <Button
              onClick={handleExecuteMigration}
              disabled={importing || parsedRows.length === 0}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm px-6 h-11 shadow-md shadow-indigo-500/30 gap-2 w-full sm:w-auto"
            >
              {importing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Importing to Database...
                </>
              ) : (
                <>
                  Start Migration Import <ArrowRight size={18} />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Migration Results Modal */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Migration Completed!</h3>
              <p className="text-xs text-slate-500">
                Your records have been successfully added to the database.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase">Imported</span>
                <p className="text-lg font-black text-emerald-600">{importResult.importedCount} Records</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-bold uppercase">Errors / Skipped</span>
                <p className="text-lg font-black text-slate-700">{importResult.errorCount}</p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-left max-h-32 overflow-y-auto">
                <p className="text-[11px] font-bold text-amber-800 mb-1">Warnings / Errors:</p>
                <ul className="text-[11px] text-amber-700 space-y-1 list-disc pl-4">
                  {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setImportResult(null)}
                className="flex-1 text-xs font-bold"
              >
                Close & Import More
              </Button>
              <Link
                href={importType === "products" ? "/dashboard/products" : "/dashboard/khata"}
                className="flex-1"
              >
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1">
                  View in Dashboard <ArrowUpRight size={14} />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
