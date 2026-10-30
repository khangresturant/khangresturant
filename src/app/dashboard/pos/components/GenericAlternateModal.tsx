"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Pill, Sparkles, Search, X, Check, MapPin, 
  Calendar, ShoppingCart, ArrowRightLeft, Clock,
  ShieldCheck, AlertCircle, RefreshCw, ChevronRight,
  TrendingDown, Layers, Building2, BookOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DBProduct, ProductBatch } from "../types";
import { isControlledDrug } from "@/lib/pharmacy/controlledDrugs";

// Standard Pakistani & International Brand to Generic Salt Mapping Dictionary
const BRAND_SALT_MAP: Record<string, { salt: string; category: string }> = {
  // Analgesics & Antipyretics
  "panadol": { salt: "Paracetamol", category: "Analgesic & Antipyretic" },
  "calpol": { salt: "Paracetamol", category: "Analgesic & Antipyretic" },
  "febrol": { salt: "Paracetamol", category: "Analgesic & Antipyretic" },
  "disprol": { salt: "Paracetamol", category: "Analgesic & Antipyretic" },
  "tempra": { salt: "Paracetamol", category: "Analgesic & Antipyretic" },
  "disprin": { salt: "Aspirin", category: "Analgesic / Antiplatelet" },
  "loprin": { salt: "Aspirin", category: "Cardiac Antiplatelet" },
  "ascard": { salt: "Aspirin", category: "Cardiac Antiplatelet" },
  "solprin": { salt: "Aspirin", category: "Analgesic & Antiplatelet" },

  // NSAIDs (Pain, Arthritis & Inflammation)
  "brufen": { salt: "Ibuprofen", category: "NSAID Pain Relief" },
  "advil": { salt: "Ibuprofen", category: "NSAID Pain Relief" },
  "arinac": { salt: "Ibuprofen + Pseudoephedrine", category: "Cold & Sinus Pain" },
  "ponstan": { salt: "Mefenamic Acid", category: "NSAID Pain Relief" },
  "voltaren": { salt: "Diclofenac Sodium", category: "NSAID Pain Relief" },
  "voren": { salt: "Diclofenac Sodium", category: "NSAID Pain Relief" },
  "cataflam": { salt: "Diclofenac Potassium", category: "NSAID Pain Relief" },
  "caflam": { salt: "Diclofenac Potassium", category: "NSAID Pain Relief" },
  "mobic": { salt: "Meloxicam", category: "NSAID Anti-inflammatory" },
  "celebrex": { salt: "Celecoxib", category: "COX-2 Inhibitor" },
  "arcoxia": { salt: "Etoricoxib", category: "COX-2 Inhibitor" },
  "brexin": { salt: "Piroxicam", category: "NSAID Pain Relief" },
  "feldene": { salt: "Piroxicam", category: "NSAID Pain Relief" },
  "synflex": { salt: "Naproxen Sodium", category: "NSAID Pain Relief" },
  "naprosyn": { salt: "Naproxen", category: "NSAID Pain Relief" },
  "toradol": { salt: "Ketorolac Tromethamine", category: "NSAID Severe Pain" },

  // Antibiotics & Antivirals
  "augmentin": { salt: "Amoxicillin + Clavulanic Acid", category: "Broad Spectrum Antibiotic" },
  "amoxil": { salt: "Amoxicillin", category: "Penicillin Antibiotic" },
  "clavocin": { salt: "Amoxicillin + Clavulanic Acid", category: "Broad Spectrum Antibiotic" },
  "curam": { salt: "Amoxicillin + Clavulanic Acid", category: "Broad Spectrum Antibiotic" },
  "moxatag": { salt: "Amoxicillin", category: "Penicillin Antibiotic" },
  "cefspan": { salt: "Cefixime", category: "Cephalosporin Antibiotic" },
  "cefiget": { salt: "Cefixime", category: "Cephalosporin Antibiotic" },
  "cefix": { salt: "Cefixime", category: "Cephalosporin Antibiotic" },
  "caricef": { salt: "Cefixime", category: "Cephalosporin Antibiotic" },
  "maxima": { salt: "Cefixime", category: "Cephalosporin Antibiotic" },
  "klaricid": { salt: "Clarithromycin", category: "Macrolide Antibiotic" },
  "claritek": { salt: "Clarithromycin", category: "Macrolide Antibiotic" },
  "zithromax": { salt: "Azithromycin", category: "Macrolide Antibiotic" },
  "azomax": { salt: "Azithromycin", category: "Macrolide Antibiotic" },
  "azit": { salt: "Azithromycin", category: "Macrolide Antibiotic" },
  "novidat": { salt: "Ciprofloxacin", category: "Fluoroquinolone Antibiotic" },
  "cipro": { salt: "Ciprofloxacin", category: "Fluoroquinolone Antibiotic" },
  "ciprocin": { salt: "Ciprofloxacin", category: "Fluoroquinolone Antibiotic" },
  "flagyl": { salt: "Metronidazole", category: "Antiprotozoal / Antibacterial" },
  "flygel": { salt: "Metronidazole", category: "Antiprotozoal / Antibacterial" },
  "entamizole": { salt: "Metronidazole + Diloxanide", category: "Amoebiasis & Diarrhea" },
  "avelox": { salt: "Moxifloxacin", category: "Fluoroquinolone Antibiotic" },
  "moxif": { salt: "Moxifloxacin", category: "Fluoroquinolone Antibiotic" },
  "vibramycin": { salt: "Doxycycline", category: "Tetracycline Antibiotic" },
  "doxymycin": { salt: "Doxycycline", category: "Tetracycline Antibiotic" },

  // Stomach, PPIs & Acid Reflux
  "risek": { salt: "Omeprazole", category: "Proton Pump Inhibitor (PPI)" },
  "omega": { salt: "Omeprazole", category: "Proton Pump Inhibitor (PPI)" },
  "omitec": { salt: "Omeprazole", category: "Proton Pump Inhibitor (PPI)" },
  "nexum": { salt: "Esomeprazole", category: "Proton Pump Inhibitor (PPI)" },
  "esomac": { salt: "Esomeprazole", category: "Proton Pump Inhibitor (PPI)" },
  "esoz": { salt: "Esomeprazole", category: "Proton Pump Inhibitor (PPI)" },
  "eziday": { salt: "Esomeprazole", category: "Proton Pump Inhibitor (PPI)" },
  "capso": { salt: "Dexlansoprazole", category: "Proton Pump Inhibitor (PPI)" },
  "dexilant": { salt: "Dexlansoprazole", category: "Proton Pump Inhibitor (PPI)" },
  "gaviscon": { salt: "Sodium Alginate + Bicarbonate", category: "Antacid Reflux Barrier" },
  "mucaine": { salt: "Oxetacaine + Antacids", category: "Anesthetic Antacid" },
  "zantac": { salt: "Ranitidine / Famotidine", category: "H2 Blocker Antacid" },
  "famopsin": { salt: "Famotidine", category: "H2 Blocker Antacid" },
  "duphalac": { salt: "Lactulose", category: "Laxative Syrup" },
  "lilac": { salt: "Lactulose", category: "Laxative Syrup" },
  "motilium": { salt: "Domperidone", category: "Antiemetic & Prokinetic" },
  "vomidon": { salt: "Domperidone", category: "Antiemetic & Prokinetic" },
  "gravinate": { salt: "Dimenhydrinate", category: "Antiemetic & Motion Sickness" },
  "onopil": { salt: "Ondansetron", category: "Antiemetic" },
  "zofran": { salt: "Ondansetron", category: "Antiemetic" },

  // Blood Pressure & Cardiology
  "merol": { salt: "Metoprolol", category: "Beta Blocker" },
  "smecta": { salt: "Diosmectite", category: "Antidiarrheal Adsorbent" },
  "tio-veez": { salt: "Tiotropium Bromide", category: "Bronchodilator" },
  "tioveez": { salt: "Tiotropium Bromide", category: "Bronchodilator" },
  "lopressor": { salt: "Metoprolol", category: "Beta Blocker" },
  "tenormin": { salt: "Atenolol", category: "Beta Blocker" },
  "inderal": { salt: "Propranolol", category: "Beta Blocker" },
  "concor": { salt: "Bisoprolol", category: "Beta Blocker" },
  "bisocor": { salt: "Bisoprolol", category: "Beta Blocker" },
  "norvasc": { salt: "Amlodipine", category: "Calcium Channel Blocker" },
  "amcard": { salt: "Amlodipine", category: "Calcium Channel Blocker" },
  "softvasc": { salt: "Amlodipine", category: "Calcium Channel Blocker" },
  "exforge": { salt: "Amlodipine + Valsartan", category: "Combination Antihypertensive" },
  "co-diovan": { salt: "Valsartan + Hydrochlorothiazide", category: "ARB Antihypertensive" },
  "diovan": { salt: "Valsartan", category: "ARB Antihypertensive" },
  "valtec": { salt: "Valsartan", category: "ARB Antihypertensive" },
  "zestril": { salt: "Lisinopril", category: "ACE Inhibitor" },
  "zestoretic": { salt: "Lisinopril + Hydrochlorothiazide", category: "ACE Inhibitor Combo" },
  "capoten": { salt: "Captopril", category: "ACE Inhibitor" },
  "lipiget": { salt: "Atorvastatin", category: "Statin Lipid Lowering" },
  "lipitor": { salt: "Atorvastatin", category: "Statin Lipid Lowering" },
  "atorva": { salt: "Atorvastatin", category: "Statin Lipid Lowering" },
  "ezetrol": { salt: "Ezetimibe", category: "Cholesterol Absorption Inhibitor" },
  "crestor": { salt: "Rosuvastatin", category: "Statin Lipid Lowering" },
  "rovista": { salt: "Rosuvastatin", category: "Statin Lipid Lowering" },
  "plavix": { salt: "Clopidogrel", category: "Antiplatelet Agent" },
  "lowplat": { salt: "Clopidogrel", category: "Antiplatelet Agent" },
  "noclot": { salt: "Clopidogrel", category: "Antiplatelet Agent" },

  // Diabetes Care
  "getryl": { salt: "Glimepiride", category: "Sulfonylurea Antidiabetic" },
  "amaryl": { salt: "Glimepiride", category: "Sulfonylurea Antidiabetic" },
  "glimy": { salt: "Glimepiride", category: "Sulfonylurea Antidiabetic" },
  "glucophage": { salt: "Metformin HCl", category: "Biguanide Antidiabetic" },
  "neodipar": { salt: "Metformin HCl", category: "Biguanide Antidiabetic" },
  "galvus": { salt: "Vildagliptin", category: "DPP-4 Inhibitor" },
  "galvus met": { salt: "Vildagliptin + Metformin", category: "DPP-4 Combo" },
  "januvia": { salt: "Sitagliptin", category: "DPP-4 Inhibitor" },
  "janumet": { salt: "Sitagliptin + Metformin", category: "DPP-4 Combo" },
  "jardiance": { salt: "Empagliflozin", category: "SGLT-2 Inhibitor" },
  "forxiga": { salt: "Dapagliflozin", category: "SGLT-2 Inhibitor" },

  // Allergy, Asthma & Respiratory
  "softin": { salt: "Loratadine", category: "Antihistamine (Non-Drowsy)" },
  "clarityn": { salt: "Loratadine", category: "Antihistamine (Non-Drowsy)" },
  "rigix": { salt: "Cetirizine", category: "Antihistamine" },
  "zyrtec": { salt: "Cetirizine", category: "Antihistamine" },
  "kestine": { salt: "Ebastine", category: "Antihistamine" },
  "ebatin": { salt: "Ebastine", category: "Antihistamine" },
  "telfast": { salt: "Fexofenadine", category: "Antihistamine (Non-Sedating)" },
  "fexo": { salt: "Fexofenadine", category: "Antihistamine (Non-Sedating)" },
  "aerius": { salt: "Desloratadine", category: "Antihistamine" },
  "ventolin": { salt: "Salbutamol", category: "Bronchodilator (Inhaler/Syrup)" },
  "asmasol": { salt: "Salbutamol", category: "Bronchodilator (Inhaler/Syrup)" },
  "montiget": { salt: "Montelukast", category: "Leukotriene Receptor Antagonist" },
  "myteka": { salt: "Montelukast", category: "Leukotriene Receptor Antagonist" },
  "acefyl": { salt: "Acefylline Piperazine", category: "Bronchodilator Cough Syrup" },
  "pulmonol": { salt: "Cough Formulation", category: "Expectorant Cough Syrup" },
  "hydryllin": { salt: "Diphenhydramine + Aminophylline", category: "Antiallergic Cough Syrup" },
  "sancos": { salt: "Pholcodine", category: "Dry Cough Suppressant" },

  // Neurology & Psychiatry
  "epival": { salt: "Sodium Valproate", category: "Antiepileptic & Mood Stabilizer" },
  "tegretol": { salt: "Carbamazepine", category: "Anticonvulsant" },
  "tegral": { salt: "Carbamazepine", category: "Anticonvulsant" },
  "lexotanil": { salt: "Bromazepam", category: "Anxiolytic Sedative" },
  "rivotril": { salt: "Clonazepam", category: "Anticonvulsant & Anxiolytic" },
  "xanax": { salt: "Alprazolam", category: "Anxiolytic (Schedule G)" },
  "prozac": { salt: "Fluoxetine", category: "SSRI Antidepressant" },
  "seroxat": { salt: "Paroxetine", category: "SSRI Antidepressant" },
  "cipralex": { salt: "Escitalopram", category: "SSRI Antidepressant" },
  "esita": { salt: "Escitalopram", category: "SSRI Antidepressant" },

  // Multivitamins, Minerals & Supplements
  "surbex": { salt: "Vitamin B-Complex + Zinc + C", category: "Nutritional Supplement" },
  "fefol": { salt: "Iron + Folic Acid", category: "Hematinic Capsule" },
  "theragran": { salt: "Multivitamins with Minerals", category: "Nutritional Supplement" },
  "cac 1000": { salt: "Calcium + Vitamin C + D3", category: "Effervescent Calcium" },
  "osteocare": { salt: "Calcium + Magnesium + Zinc + D3", category: "Bone Health Supplement" },
  "qalsan": { salt: "Calcium Carbonate + D3", category: "Bone Health Supplement" }
};

export const detectProductGenericFormula = (product: DBProduct): { salt: string; category?: string } => {
  // 1. Check explicit formulations relation
  if (product.formulations) {
    if (typeof product.formulations === "string" && product.formulations.trim()) {
      return { salt: product.formulations.trim() };
    }
    if (typeof product.formulations === "object" && product.formulations.name) {
      return { salt: String(product.formulations.name).trim() };
    }
  }

  // 2. Check note field for Formula/Salt mentions
  if (product.note && product.note.toLowerCase().includes("formula:")) {
    const parts = product.note.split(/formula:/i);
    if (parts[1]) {
      const clean = parts[1].split(/[\n,;]/)[0].trim();
      if (clean) return { salt: clean };
    }
  }

  // 3. Match against Standard Pakistani Brand Map
  const nameLower = product.name.toLowerCase().trim();
  for (const [brand, info] of Object.entries(BRAND_SALT_MAP)) {
    if (nameLower.startsWith(brand) || nameLower.includes(` ${brand}`) || nameLower.includes(`-${brand}`) || nameLower.includes(`/${brand}`)) {
      return { salt: info.salt, category: info.category };
    }
  }

  // 4. Extract Parentheses content if present e.g. "Panadol 500mg (Paracetamol)"
  const match = product.name.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (candidate.length > 2 && !candidate.toLowerCase().includes("shelf") && !candidate.toLowerCase().includes("rack") && !candidate.toLowerCase().includes("tab") && !candidate.toLowerCase().includes("pcs") && !candidate.toLowerCase().includes("box")) {
      return { salt: candidate };
    }
  }

  // 5. Check if the product name itself directly contains the standard salt name
  const KNOWN_SALTS = [
    "Paracetamol", "Ibuprofen", "Amoxicillin", "Cefixime", "Omeprazole",
    "Esomeprazole", "Diclofenac", "Metronidazole", "Azithromycin", "Clarithromycin",
    "Ciprofloxacin", "Loratadine", "Cetirizine", "Fexofenadine", "Montelukast",
    "Atorvastatin", "Rosuvastatin", "Amlodipine", "Metformin", "Glimepiride",
    "Aspirin", "Domperidone", "Ondansetron", "Metoprolol", "Bisoprolol"
  ];
  for (const kSalt of KNOWN_SALTS) {
    if (nameLower.includes(kSalt.toLowerCase())) {
      return { salt: kSalt };
    }
  }

  return { salt: "" };
};

interface GenericAlternateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: DBProduct | null;
  allProducts: DBProduct[];
  productBatches?: Record<string, ProductBatch[]>;
  onSelectAlternate: (product: DBProduct, variant?: any) => void;
  onReplaceCartItem?: (targetIndex: number, newProduct: DBProduct) => void;
  targetCartIndex?: number | null;
}

export const GenericAlternateModal: React.FC<GenericAlternateModalProps> = ({
  isOpen,
  onClose,
  selectedProduct,
  allProducts,
  productBatches = {},
  onSelectAlternate,
  onReplaceCartItem,
  targetCartIndex
}) => {
  const [activeSaltSearch, setActiveSaltSearch] = useState<string>("");

  // Determine initial generic salt
  const currentFormula = useMemo(() => {
    if (selectedProduct) {
      const det = detectProductGenericFormula(selectedProduct);
      return det.salt || "";
    }
    return "";
  }, [selectedProduct]);

  // Sync search input when opening modal on a product
  React.useEffect(() => {
    if (isOpen) {
      if (selectedProduct) {
        const det = detectProductGenericFormula(selectedProduct);
        setActiveSaltSearch(det.salt || "");
      } else {
        setActiveSaltSearch("");
      }
    }
  }, [isOpen, selectedProduct]);

  // Active query to filter by
  const activeQuery = (activeSaltSearch || currentFormula || "").trim().toLowerCase();

  // Find all alternative products that strictly share this generic salt
  const matchingAlternatives = useMemo(() => {
    if (!activeQuery || activeQuery.length < 2) return [];

    return allProducts.filter(p => {
      const pFormula = detectProductGenericFormula(p);
      const saltName = pFormula.salt.trim().toLowerCase();
      const pName = p.name.toLowerCase();

      // Condition 1: Product has a valid detected salt (>= 3 chars) that matches the active salt query
      if (saltName.length >= 3) {
        if (saltName.includes(activeQuery) || activeQuery.includes(saltName)) {
          return true;
        }
      }

      // Condition 2: Product title itself explicitly contains the exact salt search term (>= 4 chars)
      if (activeQuery.length >= 4 && pName.includes(activeQuery)) {
        return true;
      }

      return false;
    });
  }, [allProducts, activeQuery]);

  // Sort matching alternatives: In-Stock first, then highest stock, then lowest price
  const sortedAlternatives = useMemo(() => {
    return [...matchingAlternatives].sort((a, b) => {
      const stockA = a.current_stock || 0;
      const stockB = b.current_stock || 0;
      if (stockA > 0 && stockB <= 0) return -1;
      if (stockB > 0 && stockA <= 0) return 1;
      return stockB - stockA;
    });
  }, [matchingAlternatives]);

  const handleChooseProduct = (prod: DBProduct) => {
    if (typeof targetCartIndex === "number" && targetCartIndex >= 0 && onReplaceCartItem) {
      onReplaceCartItem(targetCartIndex, prod);
    } else {
      onSelectAlternate(prod);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-indigo-50/50 to-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-200">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 text-base">
                    Generic Salt & Alternate Medicine Finder
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {selectedProduct ? (
                    <span>
                      Alternative brands with same formula as <strong className="text-slate-800">{selectedProduct.name}</strong>
                    </span>
                  ) : (
                    <span>Search any formula or generic salt to view all available brand substitutes.</span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Active Formula & Search Strip */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* Formula Search Box */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500" />
                <Input
                  placeholder="Type generic salt (e.g. Paracetamol, Cefixime, Omeprazole)..."
                  value={activeSaltSearch}
                  onChange={(e) => setActiveSaltSearch(e.target.value)}
                  className="pl-9 h-10 bg-white border-violet-200 text-xs font-bold rounded-xl focus-visible:ring-violet-500/20"
                />
                {activeSaltSearch && (
                  <button
                    onClick={() => setActiveSaltSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Reset to Selected Product Salt */}
              {currentFormula && activeSaltSearch && activeSaltSearch.toLowerCase() !== currentFormula.toLowerCase() && (
                <Button
                  onClick={() => setActiveSaltSearch(currentFormula)}
                  variant="outline"
                  size="sm"
                  className="h-10 px-3 text-xs font-bold border-violet-200 text-violet-700 bg-white hover:bg-violet-50 rounded-xl shrink-0 cursor-pointer"
                >
                  <RefreshCw size={12} className="mr-1" /> Reset to {currentFormula}
                </Button>
              )}
            </div>

            {/* Quick Salt Tag Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Popular Salts:</span>
              {[
                "Paracetamol", "Ibuprofen", "Amoxicillin + Clavulanate", "Cefixime",
                "Omeprazole", "Esomeprazole", "Diclofenac", "Metronidazole",
                "Azithromycin", "Loratadine", "Montelukast", "Atorvastatin"
              ].map(salt => (
                <button
                  key={salt}
                  onClick={() => setActiveSaltSearch(salt)}
                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer border ${
                    activeQuery.includes(salt.toLowerCase())
                      ? "bg-violet-600 text-white border-violet-600 shadow-2xs font-black"
                      : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700"
                  }`}
                >
                  {salt}
                </button>
              ))}
            </div>
          </div>

          {/* Results Area */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2.5 max-h-[480px]">
            {sortedAlternatives.length === 0 ? (
              <div className="p-10 text-center text-slate-400 space-y-2">
                <Pill className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">No matching alternative medicines found.</p>
                <p className="text-[11px] text-slate-400">
                  Try typing another salt name or general formula above to search the pharmacy catalog.
                </p>
              </div>
            ) : (
              sortedAlternatives.map((alt) => {
                const isCurrent = selectedProduct?.id === alt.id;
                const inStock = (alt.current_stock || 0) > 0;
                const batches = productBatches[alt.id] || [];
                const sortedB = [...batches].sort((a, b) => {
                  if (!a.expiry_date) return 1;
                  if (!b.expiry_date) return -1;
                  return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
                });
                const fefoBatch = sortedB.find(b => b.stock_quantity > 0) || sortedB[0];
                const formulaInfo = detectProductGenericFormula(alt);

                return (
                  <div
                    key={alt.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent 
                        ? "bg-violet-50/40 border-violet-200 ring-1 ring-violet-300"
                        : inStock 
                          ? "bg-white border-slate-200 hover:border-violet-300 hover:shadow-sm" 
                          : "bg-slate-50/70 border-slate-200/80 opacity-70"
                    }`}
                  >
                    {/* Left: Product Info & Generic Salt */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-black text-slate-900 text-sm leading-snug">
                          {alt.name}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-violet-100 text-violet-800 border border-violet-200">
                            Current Item
                          </span>
                        )}
                        {inStock ? (
                          <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            In Stock ({alt.current_stock} {alt.unit || "unit"})
                          </span>
                        ) : (
                          <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            Out of Stock (0)
                          </span>
                        )}
                        {isControlledDrug(alt) && (
                          <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 shadow-2xs">
                            <span>🚨</span> Controlled (Schedule G)
                          </span>
                        )}
                      </div>

                      {/* Generic Salt and Shelf Location */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        {formulaInfo.salt && (
                          <span className="inline-flex items-center gap-1 font-extrabold text-violet-800 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100 text-[10.5px]">
                            <Pill size={11} className="text-violet-600" />
                            Salt: {formulaInfo.salt}
                          </span>
                        )}
                        {alt.shelf_location && (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-[10px]">
                            <MapPin size={10} className="text-amber-700" />
                            Shelf: {alt.shelf_location}
                          </span>
                        )}
                        {fefoBatch?.expiry_date && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                            <Clock size={10} />
                            FEFO Exp: {new Date(fefoBatch.expiry_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Price & Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Retail Price</p>
                        <p className="text-base font-black text-slate-900 leading-none">
                          Rs {alt.sale_price_single}
                        </p>
                        {selectedProduct && selectedProduct.sale_price_single !== alt.sale_price_single && (
                          <p className="text-[9.5px] font-bold mt-0.5 flex items-center justify-end gap-0.5">
                            {alt.sale_price_single < selectedProduct.sale_price_single ? (
                              <span className="text-emerald-600 flex items-center">
                                <TrendingDown size={10} /> Saves Rs {selectedProduct.sale_price_single - alt.sale_price_single}
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                +Rs {alt.sale_price_single - selectedProduct.sale_price_single} diff
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      {!inStock ? (
                        <Button
                          onClick={() => {
                            const key = `pharmacy_short_book_${(alt as any).shop_id || "default"}`;
                            const existing = JSON.parse(localStorage.getItem(key) || "[]");
                            const entry = {
                              id: `sb_${Date.now()}`,
                              shop_id: (alt as any).shop_id || "",
                              medicine_name: alt.name,
                              generic_salt: formulaInfo.salt || "",
                              company_distributor: "General Distributor",
                              pack_qty_demanded: 1,
                              priority: "urgent",
                              status: "pending",
                              demand_count: 1,
                              notes: "Logged via POS Alternate Finder",
                              created_at: new Date().toISOString()
                            };
                            localStorage.setItem(key, JSON.stringify([entry, ...existing]));
                            toast.success(`"${alt.name}" added to Short Book!`);
                          }}
                          className="h-9 px-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <BookOpen size={13} />
                          <span>+ Short Book</span>
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleChooseProduct(alt)}
                          className={`h-9 px-3.5 rounded-xl font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 ${
                            typeof targetCartIndex === "number" && targetCartIndex >= 0
                              ? "bg-violet-600 hover:bg-violet-700 text-white"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                        >
                          {typeof targetCartIndex === "number" && targetCartIndex >= 0 ? (
                            <>
                              <ArrowRightLeft size={13} />
                              <span>Replace</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={13} />
                              <span>Add to Cart</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Guide */}
          <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <ShieldCheck size={14} className="text-violet-600" />
              Formula matching ensures identical active pharmaceutical ingredient (API) and bio-equivalence.
            </span>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-xl border-slate-200 bg-white font-bold text-xs text-slate-700 cursor-pointer"
            >
              Close
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
