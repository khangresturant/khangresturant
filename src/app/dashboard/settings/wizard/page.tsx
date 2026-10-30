"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShop } from "@/context/ShopContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Layers, Tag, Check, ArrowRight, ArrowLeft,
  PauseCircle, PlayCircle, Loader2, Plus, Trash2, CheckCircle2,
  Trophy, Rocket, Brain, Wand2, Package,
  ChevronDown, ChevronUp, Search, TrendingUp,
  Edit2, EyeOff, Star, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SHOP_NICHES, CATS, BRANDS, type BrandItem, type CatItem } from "./wizard-data";




const WIZARD_STEPS = [
  { num: 1, title: "Store Types", icon: Store },
  { num: 2, title: "Categories", icon: Layers },
  { num: 3, title: "Brands & Sizes", icon: Tag },
  { num: 4, title: "AI Price Sheet", icon: TrendingUp },
];

export default function AIStoreSetupWizardPage() {
  const router = useRouter();
  const { shopId, shopName, industryType } = useShop();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selNiches, setSelNiches] = useState<string[]>([industryType || "karyana"]);
  const [selCats, setSelCats] = useState<string[]>([]);
  const [customCatInput, setCustomCatInput] = useState("");
  const [selItemKeys, setSelItemKeys] = useState<Record<string, boolean>>({});
  const [gridProducts, setGridProducts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [editingPrices, setEditingPrices] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const draftKey = `shop_wizard_draft_${shopId || "default"}`;

  useEffect(() => {
    if (!shopId) return;
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.step) setStep(p.step);
        if (p.selNiches) setSelNiches(p.selNiches);
        if (p.selCats) setSelCats(p.selCats);
        if (p.selItemKeys) setSelItemKeys(p.selItemKeys);
        if (p.gridProducts) setGridProducts(p.gridProducts);
        setIsDraftRestored(true);
        toast.info("✅ Previous progress restored!");
      } catch {}
    }
  }, [shopId]);

  const handleSaveAndPause = () => {
    setIsSaving(true);
    localStorage.setItem(draftKey, JSON.stringify({ step, selNiches, selCats, selItemKeys, gridProducts, savedAt: new Date().toISOString() }));
    setTimeout(() => { setIsSaving(false); toast.success("⏸ Progress saved! Resume anytime."); }, 700);
  };

  const toggleNiche = (id: string) => {
    if (selNiches.includes(id)) {
      if (selNiches.length > 1) setSelNiches(selNiches.filter(n => n !== id));
      else toast.warning("At least one store type required!");
    } else setSelNiches([...selNiches, id]);
  };

  useEffect(() => {
    if (step === 2 && selCats.length === 0) {
      const cats: string[] = [];
      selNiches.forEach(nId => { (CATS[nId] || []).forEach(c => { if (!cats.includes(c.name)) cats.push(c.name); }); });
      setSelCats(cats);
    }
  }, [step, selNiches]);

  const addCustomCat = () => {
    if (!customCatInput.trim()) return;
    if (!selCats.includes(customCatInput.trim())) { setSelCats([...selCats, customCatInput.trim()]); toast.success("Category added!"); }
    else toast.warning("Already exists!");
    setCustomCatInput("");
  };

  const toggleCat = (n: string) => {
    if (selCats.includes(n)) setSelCats(selCats.filter(c => c !== n));
    else setSelCats([...selCats, n]);
  };

  useEffect(() => {
    if (step === 3 && Object.keys(selItemKeys).length === 0) {
      const keys: Record<string, boolean> = {};
      selCats.forEach(cat => { (BRANDS[cat] || []).forEach(b => { b.sizes.forEach(sz => { keys[`${cat}||${b.brand}||${sz}`] = true; }); }); });
      setSelItemKeys(keys);
      const exp: Record<string, boolean> = {};
      selCats.forEach(c => exp[c] = true);
      setExpandedSections(exp);
    }
  }, [step, selCats]);

  const genGrid = () => {
    const list: any[] = [];
    selCats.forEach(cat => {
      const bl = BRANDS[cat] || [];
      if (bl.length > 0) {
        bl.forEach(b => {
          b.sizes.forEach(sz => {
            if (selItemKeys[`${cat}||${b.brand}||${sz}`] !== false) {
              list.push({ id: Math.random().toString(36).substring(7), category: cat, brand: b.brand, name: `${b.brand} ${sz}`, purchase_price: b.avgBuy, sale_price: b.avgSale, current_stock: 24, unit: "Pcs", barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}` });
            }
          });
        });
      } else {
        list.push({ id: Math.random().toString(36).substring(7), category: cat, brand: "General", name: `${cat} Standard`, purchase_price: 150, sale_price: 180, current_stock: 20, unit: "Pcs", barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}` });
      }
    });
    setGridProducts(list);
  };

  const handleFinalImport = async () => {
    if (gridProducts.length === 0) { toast.error("No products!"); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/products/batch-setup", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ shop_id: shopId, products: gridProducts }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      localStorage.removeItem(draftKey);
      setShowSuccess(true);
      toast.success(`🎉 ${gridProducts.length} products imported!`);
      setTimeout(() => router.push("/dashboard/products"), 2500);
    } catch (err: any) { toast.error("Import failed: " + err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleResetCatalog = () => {
    localStorage.removeItem(draftKey);
    setIsDraftRestored(false);
    // Populate all categories for selected niches
    const cats: string[] = [];
    selNiches.forEach(nId => {
      (CATS[nId] || []).forEach(c => {
        if (!cats.includes(c.name)) cats.push(c.name);
      });
    });
    setSelCats(cats);
    
    // Populate all item keys for all selected categories with 5 sizes
    const keys: Record<string, boolean> = {};
    cats.forEach(cat => {
      (BRANDS[cat] || []).forEach(b => {
        b.sizes.forEach(sz => {
          keys[`${cat}||${b.brand}||${sz}`] = true;
        });
      });
    });
    setSelItemKeys(keys);
    setGridProducts([]);
    toast.success("🔄 Master Catalog Refreshed with All Categories & 5 Pack Sizes!");
  };

  const filteredCats = selCats.filter(c => c.toLowerCase().includes(catSearch.toLowerCase()));
  const allAvailCats = Array.from(new Set(selNiches.flatMap(nId => (CATS[nId] || []).map(c => c.name))));
  const unselCats = allAvailCats.filter(c => !selCats.includes(c));
  const selCount = Object.values(selItemKeys).filter(Boolean).length;
  const totalCount = Object.keys(selItemKeys).length;


  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-5 font-sans">
      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-10 flex flex-col items-center gap-4 shadow-2xl max-w-md w-full mx-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl"><Trophy size={44} className="text-white" /></div>
              <h2 className="text-2xl font-black text-slate-900">Store Setup Complete!</h2>
              <p className="text-sm text-slate-500 text-center">{gridProducts.length} products added to your inventory. Redirecting...</p>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }} className="w-2 h-2 rounded-full bg-emerald-500" />)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white p-7 rounded-3xl shadow-2xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-indigo-600/15 blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-violet-600/10 blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-xs uppercase tracking-widest"><Brain size={15} className="animate-pulse" /> AI-Powered Store Configuration Wizard</div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">🏪 Build Your First Inventory — <span className="text-indigo-400">{shopName || "My Store"}</span></h1>
            <p className="text-slate-400 text-sm max-w-xl">4-step catalog builder with AI brand and price suggestions. Pause anytime — progress is auto-saved.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["✅ Pakistan Market Prices", "🤖 AI Brand Suggestions", "⏸ Pause & Resume", "📊 Excel-Style Grid"].map(b => (<span key={b} className="text-[11px] bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg font-semibold text-slate-300">{b}</span>))}
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex items-center gap-2">
              <Button onClick={handleResetCatalog} variant="outline" className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 font-bold text-xs rounded-xl h-10 cursor-pointer px-3">
                <Rocket size={13} className="mr-1.5" /> Load 2026 Master Data
              </Button>
              <Button onClick={handleSaveAndPause} disabled={isSaving} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/25 font-bold text-xs rounded-xl h-10 cursor-pointer px-4">
                {isSaving ? <><Loader2 size={13} className="animate-spin mr-1.5" /> Saving...</> : <><PauseCircle size={13} className="mr-1.5" /> Save & Pause</>}
              </Button>
            </div>
            {isDraftRestored && <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 text-[11px]"><PlayCircle size={11} /> Draft Restored — Click "Load 2026 Master Data" to update</span>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center">
          {WIZARD_STEPS.map((s, idx) => {
            const isActive = step === s.num; const isDone = step > s.num; const Icon = s.icon;
            return (
              <React.Fragment key={s.num}>
                <button onClick={() => isDone && setStep(s.num as any)} disabled={!isDone} className="flex items-center gap-2.5 transition-all">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black transition-all ${isActive ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30" : isDone ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300" : "bg-slate-100 text-slate-400"}`}>
                    {isDone ? <Check size={16} strokeWidth={3} /> : <Icon size={15} />}
                  </div>
                  <div className="hidden sm:block">
                    <div className={`text-xs font-extrabold ${isActive ? "text-indigo-600" : isDone ? "text-emerald-600" : "text-slate-400"}`}>Step {s.num}</div>
                    <div className={`text-[11px] font-semibold ${isActive ? "text-indigo-500" : isDone ? "text-emerald-500" : "text-slate-400"}`}>{s.title}</div>
                  </div>
                </button>
                {idx < WIZARD_STEPS.length - 1 && <div className={`flex-1 h-1 mx-3 rounded-full transition-all ${step > s.num ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-slate-100"}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div><h3 className="text-xl font-black text-slate-900">Step 1: Select Your Business Type(s)</h3><p className="text-sm text-slate-500 mt-1">Choose one or multiple. Mixed stores are fully supported (e.g. Karyana + General).</p></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {SHOP_NICHES.map(niche => {
                  const isSel = selNiches.includes(niche.id);
                  return (
                    <motion.div key={niche.id} whileTap={{ scale: 0.97 }} onClick={() => toggleNiche(niche.id)}
                      className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${isSel ? niche.sb + " shadow-md" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"}`}>
                      {isSel && <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow"><Check size={11} className="text-indigo-600" strokeWidth={3} /></div>}
                      <span className="text-3xl block mb-2">{niche.icon}</span>
                      <h4 className="font-extrabold text-xs text-slate-900 leading-tight">{niche.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">{niche.urduName}</p>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed hidden sm:block">{niche.desc}</p>
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-sm text-slate-500"><span className="font-extrabold text-indigo-600">{selNiches.length}</span> selected</span>
                <Button onClick={() => { setSelCats([]); setStep(2); }} className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm rounded-xl px-7 h-10 shadow-md cursor-pointer">
                  Next: AI Categories <ArrowRight size={15} className="ml-1.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div><h3 className="text-xl font-black text-slate-900">Step 2: Choose Product Categories</h3><p className="text-sm text-slate-500 mt-1">AI pre-selected your categories. Uncheck what you do not sell. Add custom ones below.</p></div>
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 max-w-lg">
                <Input placeholder="Add custom category..." value={customCatInput} onChange={e => setCustomCatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomCat()} className="bg-white border-slate-200 text-sm h-9" />
                <Button onClick={addCustomCat} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl shrink-0 cursor-pointer px-4"><Plus size={14} className="mr-1" /> Add</Button>
              </div>
              <div className="relative max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Filter categories..." value={catSearch} onChange={e => setCatSearch(e.target.value)} className="pl-9 text-sm h-9" /></div>
              <div>
                <div className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-500" /> Selected ({filteredCats.length})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredCats.map(cat => {
                    const ci = Object.values(CATS).flat().find(c => c.name === cat);
                    return (
                      <motion.div key={cat} layout whileTap={{ scale: 0.98 }} onClick={() => toggleCat(cat)} className="p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between bg-indigo-50/80 border-indigo-400 hover:bg-indigo-100/80">
                        <div className="flex items-center gap-2"><span className="text-lg">{ci?.icon || "📦"}</span><div><p className="text-xs font-extrabold text-indigo-900">{cat}</p>{ci?.urduName && <p className="text-[10px] text-indigo-500 font-semibold">{ci.urduName}</p>}</div></div>
                        <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0"><Check size={11} strokeWidth={3} /></div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              {unselCats.filter(c => c.toLowerCase().includes(catSearch.toLowerCase())).length > 0 && (
                <div>
                  <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">Available to Add ({unselCats.length})</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {unselCats.filter(c => c.toLowerCase().includes(catSearch.toLowerCase())).map(cat => {
                      const ci = Object.values(CATS).flat().find(c => c.name === cat);
                      return (
                        <motion.div key={cat} layout whileTap={{ scale: 0.98 }} onClick={() => toggleCat(cat)} className="p-3 rounded-xl border-2 cursor-pointer flex items-center justify-between bg-slate-50 border-slate-200 hover:border-slate-300">
                          <div className="flex items-center gap-2 opacity-60"><span className="text-lg">{ci?.icon || "📦"}</span><p className="text-xs font-bold text-slate-600">{cat}</p></div>
                          <Plus size={14} className="text-slate-400 shrink-0" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <Button onClick={() => setStep(1)} variant="outline" className="text-sm font-bold rounded-xl h-10 px-5 cursor-pointer"><ArrowLeft size={14} className="mr-1.5" /> Back</Button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500"><span className="font-black text-violet-600">{selCats.length}</span> selected</span>
                  <Button onClick={() => { setSelItemKeys({}); setStep(3); }} disabled={selCats.length === 0} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl px-7 h-10 shadow-md cursor-pointer">Next: AI Brands <ArrowRight size={15} className="ml-1.5" /></Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><h3 className="text-xl font-black text-slate-900">Step 3: Select Brands & Pack Sizes</h3><p className="text-sm text-slate-500 mt-1">AI pre-ticked popular brands with 5-tier pack sizes. Untick what you do not stock.</p></div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={() => {
                    const keys: Record<string, boolean> = {};
                    selCats.forEach(cat => {
                      (BRANDS[cat] || []).forEach(b => {
                        b.sizes.forEach(sz => { keys[`${cat}||${b.brand}||${sz}`] = true; });
                      });
                    });
                    setSelItemKeys(keys);
                    toast.success("✅ Selected all items and 5 pack sizes!");
                  }} variant="outline" size="sm" className="text-xs font-bold rounded-xl h-9 px-3 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 cursor-pointer">
                    <CheckCircle2 size={13} className="mr-1" /> Select All 5-Pack Sizes
                  </Button>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 text-center">
                    <p className="text-xs text-indigo-600 font-extrabold">{selCount} selected</p>
                    <p className="text-[10px] text-indigo-400 font-semibold">of {totalCount} total</p>
                  </div>
                </div>
              </div>
              <div className="relative max-w-sm"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input placeholder="Search brands..." value={brandSearch} onChange={e => setBrandSearch(e.target.value)} className="pl-9 text-sm h-9" /></div>
              <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                {selCats.map(cat => {
                  const brandList = (BRANDS[cat] || []).filter(b => b.brand.toLowerCase().includes(brandSearch.toLowerCase()));
                  if (BRANDS[cat] && brandList.length === 0 && brandSearch) return null;
                  if (!BRANDS[cat]) return null;
                  const ci = Object.values(CATS).flat().find(c => c.name === cat);
                  const isExp = expandedSections[cat] !== false;
                  const catSel = brandList.flatMap(b => b.sizes.map(sz => `${cat}||${b.brand}||${sz}`)).filter(k => selItemKeys[k] !== false).length;
                  return (
                    <div key={cat} className="border border-slate-200 rounded-2xl overflow-hidden">
                      <button className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition cursor-pointer" onClick={() => setExpandedSections(prev => ({ ...prev, [cat]: !isExp }))}>
                        <div className="flex items-center gap-2.5"><span className="text-xl">{ci?.icon || "📦"}</span><div className="text-left"><p className="text-xs font-extrabold text-slate-900">{cat}</p><p className="text-[10px] text-slate-500">{brandList.length} brands · {catSel} items selected</p></div></div>
                        {isExp ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                      </button>
                      <AnimatePresence>
                        {isExp && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {brandList.map(b => (
                                <div key={b.brand} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div><span className="font-black text-sm text-slate-900">{b.brand}</span>{b.urdu && <span className="text-[11px] text-slate-400 font-semibold ml-2">{b.urdu}</span>}</div>
                                    <div className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">{Math.round(((b.avgSale - b.avgBuy) / b.avgBuy) * 100)}% margin</div>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {b.sizes.map(sz => {
                                      const k = `${cat}||${b.brand}||${sz}`; const isChk = selItemKeys[k] !== false;
                                      return (
                                        <button key={sz} type="button" onClick={() => setSelItemKeys({ ...selItemKeys, [k]: !isChk })}
                                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${isChk ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                                          {isChk && <Check size={9} strokeWidth={3} />} {sz}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold">Buy: Rs {b.avgBuy} · Sale: Rs {b.avgSale}</div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <Button onClick={() => setStep(2)} variant="outline" className="text-sm font-bold rounded-xl h-10 px-5 cursor-pointer"><ArrowLeft size={14} className="mr-1.5" /> Back</Button>
                <Button onClick={() => { genGrid(); setStep(4); }} disabled={selCount === 0} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white font-bold text-sm rounded-xl px-7 h-10 shadow-md cursor-pointer">
                  Generate AI Price Sheet <Wand2 size={15} className="ml-1.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div><h3 className="text-xl font-black text-slate-900">Step 4: Review AI Price Sheet</h3><p className="text-sm text-slate-500 mt-1">Pakistan market prices auto-filled. Edit any value before importing.</p></div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button onClick={() => setStep(3)} variant="outline" size="sm" className="text-xs font-bold rounded-xl h-9 px-4 cursor-pointer"><ArrowLeft size={13} className="mr-1" /> Back</Button>
                  <Button onClick={() => setEditingPrices(!editingPrices)} variant="outline" size="sm" className={`text-xs font-bold rounded-xl h-9 px-3 cursor-pointer ${editingPrices ? "bg-amber-50 border-amber-300 text-amber-700" : ""}`}>
                    {editingPrices ? <><EyeOff size={13} className="mr-1" /> Lock</> : <><Edit2 size={13} className="mr-1" /> Edit Prices</>}
                  </Button>
                  <Button onClick={handleFinalImport} disabled={isSubmitting || gridProducts.length === 0} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-xl h-9 px-5 shadow-md cursor-pointer">
                    {isSubmitting ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Importing...</> : <><Rocket size={14} className="mr-1.5" /> Import {gridProducts.length} Products</>}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Products", value: gridProducts.length, icon: Package },
                  { label: "Categories", value: new Set(gridProducts.map(p => p.category)).size, icon: Layers },
                  { label: "Brands", value: new Set(gridProducts.map(p => p.brand)).size, icon: Star },
                  { label: "Avg Margin", value: `${Math.round(gridProducts.reduce((a, p) => a + ((p.sale_price - p.purchase_price) / Math.max(p.purchase_price, 1) * 100), 0) / Math.max(gridProducts.length, 1))}%`, icon: TrendingUp },
                ].map(stat => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center"><Icon size={16} className="text-slate-600" /></div>
                      <div><p className="text-lg font-black text-slate-800">{stat.value}</p><p className="text-[10px] text-slate-500 font-semibold">{stat.label}</p></div>
                    </div>
                  );
                })}
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white font-extrabold text-[10px] uppercase tracking-wider sticky top-0 z-10">
                        <th className="p-3 w-8">#</th><th className="p-3">Product Name</th><th className="p-3">Category</th><th className="p-3">Brand</th>
                        <th className="p-3 text-right">Buy Price</th><th className="p-3 text-right">Sale Price</th><th className="p-3 text-center">Margin</th><th className="p-3 text-center">Stock</th><th className="p-3 text-center">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {gridProducts.map((p, idx) => {
                        const margin = p.purchase_price > 0 ? Math.round(((p.sale_price - p.purchase_price) / p.purchase_price) * 100) : 0;
                        return (
                          <tr key={p.id} className="hover:bg-indigo-50/30 transition group">
                            <td className="p-2.5 font-bold text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="p-2.5"><Input value={p.name} onChange={e => { const u = [...gridProducts]; u[idx].name = e.target.value; setGridProducts(u); }} className="h-8 text-xs font-extrabold bg-transparent border-transparent focus:border-indigo-300 focus:bg-white min-w-[160px]" /></td>
                            <td className="p-2.5 text-slate-500 font-semibold text-[11px] whitespace-nowrap">{p.category}</td>
                            <td className="p-2.5 text-slate-600 font-bold text-[11px] whitespace-nowrap">{p.brand}</td>
                            <td className="p-2.5 text-right"><Input type="number" value={p.purchase_price} readOnly={!editingPrices} onChange={e => { const u = [...gridProducts]; u[idx].purchase_price = Number(e.target.value) || 0; setGridProducts(u); }} className={`h-8 w-24 text-xs text-right font-bold bg-transparent ml-auto ${editingPrices ? "border-amber-200 focus:border-amber-400" : "border-transparent"}`} /></td>
                            <td className="p-2.5 text-right"><Input type="number" value={p.sale_price} readOnly={!editingPrices} onChange={e => { const u = [...gridProducts]; u[idx].sale_price = Number(e.target.value) || 0; setGridProducts(u); }} className={`h-8 w-24 text-xs text-right font-extrabold text-indigo-600 bg-transparent ml-auto ${editingPrices ? "border-amber-200 focus:border-amber-400" : "border-transparent"}`} /></td>
                            <td className="p-2.5 text-center"><span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg ${margin >= 20 ? "bg-emerald-100 text-emerald-700" : margin >= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>{margin}%</span></td>
                            <td className="p-2.5 text-center"><Input type="number" value={p.current_stock} onChange={e => { const u = [...gridProducts]; u[idx].current_stock = Number(e.target.value) || 0; setGridProducts(u); }} className="h-8 w-16 text-xs text-center font-bold bg-transparent border-transparent focus:border-indigo-300 focus:bg-white mx-auto" /></td>
                            <td className="p-2.5 text-center"><button onClick={() => setGridProducts(gridProducts.filter((_, i) => i !== idx))} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-500"><Info size={15} className="text-indigo-500 shrink-0" /><span>All prices are AI-recommended Pakistan market rates. Edit freely before import.</span></div>
                <Button onClick={handleFinalImport} disabled={isSubmitting || gridProducts.length === 0} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-2xl h-12 px-8 shadow-xl cursor-pointer w-full sm:w-auto">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin mr-2" /> Importing...</> : <><CheckCircle2 size={16} className="mr-2" /> Confirm & Import {gridProducts.length} Products <Rocket size={14} className="ml-2" /></>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
