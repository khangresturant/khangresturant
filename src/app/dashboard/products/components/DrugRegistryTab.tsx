"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Plus, Check, Loader2, Sparkles, Pill, AlertCircle, RefreshCw, FolderPlus, Trash2, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { toast } from "sonner";
import { getPlatformShopId } from "@/lib/config";
import { DRAP_MASTER_MEDICINES } from "@/lib/pharma/drap-medicines";
import { isControlledDrug } from "@/lib/pharmacy/controlledDrugs";

interface DrugRegistryTabProps {
  shopId: string;
  onRefresh: () => void;
  categories: Array<{ id: string; name: string }>;
}

const CATEGORY_MAP: Record<string, string> = {
  analgesic: "Analgesics & Antipyretics",
  nsaid: "NSAIDs & Pain Relief",
  antibiotic: "Antibiotics & Antivirals",
  ppi: "Stomach & Acid Reflux",
  cardiac: "Heart & Blood Pressure",
  diabetes: "Diabetes Care",
  allergy: "Allergies & Asthma",
  neuro: "Neurology & Epilepsy",
  psych: "Psychiatry & Mood",
  cough: "Cough & Cold",
  vitamin: "Multivitamins & Zinc",
  topical: "Creams & Ointments"
};

const getBrandManufacturer = (brandName: string): string => {
  const nameLower = brandName.toLowerCase();
  if (nameLower.includes("panadol") || nameLower.includes("calpol") || nameLower.includes("augmentin") || nameLower.includes("ventolin") || nameLower.includes("becotide") || nameLower.includes("aerius")) {
    return "GSK (GlaxoSmithKline)";
  }
  if (nameLower.includes("brufen") || nameLower.includes("klaricid") || nameLower.includes("duphalac") || nameLower.includes("surbex") || nameLower.includes("epival") || nameLower.includes("tenormin") || nameLower.includes("norvasc")) {
    return "Abbott Laboratories";
  }
  if (nameLower.includes("risek") || nameLower.includes("getryl") || nameLower.includes("lipiget") || nameLower.includes("nexum") || nameLower.includes("kestine") || nameLower.includes("exforge")) {
    return "Getz Pharma";
  }
  if (nameLower.includes("novidat") || nameLower.includes("rigix") || nameLower.includes("softin") || nameLower.includes("fefol")) {
    return "Sami Pharmaceuticals";
  }
  if (nameLower.includes("gravinate") || nameLower.includes("hydryllin") || nameLower.includes("entamizole")) {
    return "Searle Company";
  }
  if (nameLower.includes("ponstan") || nameLower.includes("tegral") || nameLower.includes("lexotanil") || nameLower.includes("rivotril")) {
    return "Martin Dow";
  }
  if (nameLower.includes("xanax") || nameLower.includes("lipitor") || nameLower.includes("zithromax") || nameLower.includes("solu-cortef")) {
    return "Pfizer";
  }
  if (nameLower.includes("cefspan") || nameLower.includes("zestril") || nameLower.includes("diovan")) {
    return "Hilton Pharma";
  }
  if (nameLower.includes("acefyl") || nameLower.includes("pulmonol") || nameLower.includes("pyodine") || nameLower.includes("sancos")) {
    return "Ferozsons Laboratories";
  }
  if (nameLower.includes("inpax") || nameLower.includes("prociva") || nameLower.includes("xtrica")) {
    return "BARAX PHARMA (AR Plus Medicine Co)";
  }
  if (nameLower.includes("flexeril") || nameLower.includes("dexlap") || nameLower.includes("reliuslide") || nameLower.includes("visions calciferol") || nameLower.includes("nafcin") || nameLower.includes("esopep") || nameLower.includes("tumaplax") || nameLower.includes("coxyzin") || nameLower.includes("manacid")) {
    return "MIAN PHARMA";
  }
  return "Local General Pharma";
};

const BASE_BRANDS = [
  // Analgesics & Antipyretics
  { brand: "Panadol", formula: "Paracetamol", type: "analgesic" },
  { brand: "Calpol", formula: "Paracetamol", type: "analgesic" },
  { brand: "Febrol", formula: "Paracetamol", type: "analgesic" },
  { brand: "Disprin", formula: "Aspirin", type: "analgesic" },
  { brand: "Loprin", formula: "Aspirin", type: "cardiac" },
  { brand: "Ascard", formula: "Aspirin", type: "cardiac" },
  { brand: "Solprin", formula: "Aspirin", type: "analgesic" },
  { brand: "Tempra", formula: "Paracetamol", type: "analgesic" },
  { brand: "Febrol Extra", formula: "Paracetamol + Caffeine", type: "analgesic" },
  { brand: "Panadol Extra", formula: "Paracetamol + Caffeine", type: "analgesic" },
  { brand: "Panadol CF", formula: "Paracetamol + Pseudoephedrine", type: "cough" },
  { brand: "Panadol Extend", formula: "Paracetamol", type: "analgesic" },
  { brand: "Panadol Actifast", formula: "Paracetamol Sodium", type: "analgesic" },
  
  // NSAIDs (Pain & Inflammation)
  { brand: "Brufen", formula: "Ibuprofen", type: "nsaid" },
  { brand: "Arinac", formula: "Ibuprofen + Pseudoephedrine", type: "cough" },
  { brand: "Ponstan", formula: "Mefenamic Acid", type: "nsaid" },
  { brand: "Voltaren", formula: "Diclofenac Sodium", type: "nsaid" },
  { brand: "Voren", formula: "Diclofenac Sodium", type: "nsaid" },
  { brand: "Cataflam", formula: "Diclofenac Potassium", type: "nsaid" },
  { brand: "Caflam", formula: "Diclofenac Potassium", type: "nsaid" },
  { brand: "Mobic", formula: "Meloxicam", type: "nsaid" },
  { brand: "Celebrex", formula: "Celecoxib", type: "nsaid" },
  { brand: "Arcoxia", formula: "Etoricoxib", type: "nsaid" },
  { brand: "Feldene", formula: "Piroxicam", type: "nsaid" },
  { brand: "Brexin", formula: "Piroxicam Beta-Cyclodextrin", type: "nsaid" },
  { brand: "Synflex", formula: "Naproxen Sodium", type: "nsaid" },
  { brand: "Naprosyn", formula: "Naproxen", type: "nsaid" },
  { brand: "Brufen Retard", formula: "Ibuprofen Sustained Release", type: "nsaid" },
  { brand: "Ponstan Forte", formula: "Mefenamic Acid", type: "nsaid" },
  
  // Antibiotics & Antivirals
  { brand: "Augmentin", formula: "Co-Amoxiclav", type: "antibiotic" },
  { brand: "Amoxil", formula: "Amoxicillin", type: "antibiotic" },
  { brand: "Cefspan", formula: "Cefixime", type: "antibiotic" },
  { brand: "Novidat", formula: "Ciprofloxacin", type: "antibiotic" },
  { brand: "Leflox", formula: "Levofloxacin", type: "antibiotic" },
  { brand: "Cravit", formula: "Levofloxacin", type: "antibiotic" },
  { brand: "Klaricid", formula: "Clarithromycin", type: "antibiotic" },
  { brand: "Azomax", formula: "Azithromycin", type: "antibiotic" },
  { brand: "Zithromax", formula: "Azithromycin", type: "antibiotic" },
  { brand: "Flagyl", formula: "Metronidazole", type: "antibiotic" },
  { brand: "Vibramycin", formula: "Doxycycline", type: "antibiotic" },
  { brand: "Septran", formula: "Co-Trimoxazole", type: "antibiotic" },
  { brand: "Rocephin", formula: "Ceftriaxone", type: "antibiotic" },
  { brand: "Claforan", formula: "Cefotaxime", type: "antibiotic" },
  { brand: "Fortum", formula: "Ceftazidime", type: "antibiotic" },
  { brand: "Maxipime", formula: "Cefepime", type: "antibiotic" },
  { brand: "Keflex", formula: "Cephalexin", type: "antibiotic" },
  { brand: "Velosef", formula: "Cephradine", type: "antibiotic" },
  { brand: "Zinnat", formula: "Cefuroxime", type: "antibiotic" },
  { brand: "Tarivid", formula: "Ofloxacin", type: "antibiotic" },
  { brand: "Zovirax", formula: "Acyclovir", type: "antibiotic" },
  { brand: "Augmentin Forte", formula: "Co-Amoxiclav", type: "antibiotic" },
  { brand: "Cefspan DS", formula: "Cefixime Trihydrate", type: "antibiotic" },
  
  // Acid Control & PPIs
  { brand: "Risek", formula: "Omeprazole", type: "ppi" },
  { brand: "Nexum", formula: "Esomeprazole", type: "ppi" },
  { brand: "Esomed", formula: "Esomeprazole", type: "ppi" },
  { brand: "Zantac", formula: "Ranitidine", type: "ppi" },
  { brand: "Gaviscon", formula: "Sodium Alginate + Sodium Bicarbonate", type: "ppi" },
  { brand: "Mucaine", formula: "Oxetacaine + Aluminium + Magnesium", type: "ppi" },
  { brand: "Gastrogel", formula: "Aluminium + Magnesium Trisilicate", type: "ppi" },
  { brand: "Tagamet", formula: "Cimetidine", type: "ppi" },
  { brand: "Pepcid", formula: "Famotidine", type: "ppi" },
  { brand: "Famopsin", formula: "Famotidine", type: "ppi" },
  { brand: "Neutracid", formula: "Aluminium Hydroxide", type: "ppi" },
  { brand: "Maalox", formula: "Aluminium + Magnesium Hydroxide", type: "ppi" },
  { brand: "Risek Instra", formula: "Omeprazole + Sodium Bicarbonate", type: "ppi" },
  { brand: "Nexum Instra", formula: "Esomeprazole + Sodium Bicarbonate", type: "ppi" },
  
  // Antihistamines & Allergy
  { brand: "Softin", formula: "Loratadine", type: "allergy" },
  { brand: "Rigix", formula: "Cetirizine HCl", type: "allergy" },
  { brand: "Kestine", formula: "Ebastine", type: "allergy" },
  { brand: "Telfast", formula: "Fexofenadine HCl", type: "allergy" },
  { brand: "Aerius", formula: "Desloratadine", type: "allergy" },
  { brand: "Avil", formula: "Pheniramine Maleate", type: "allergy" },
  { brand: "Rigix Cold", formula: "Cetirizine + Pseudoephedrine", type: "cough" },
  { brand: "Telfast D", formula: "Fexofenadine + Pseudoephedrine", type: "cough" },
  { brand: "Softin D", formula: "Loratadine + Pseudoephedrine", type: "cough" },
  { brand: "Kestine L", formula: "Ebastine + Montelukast", type: "cough" },
  { brand: "Aerius D", formula: "Desloratadine + Pseudoephedrine", type: "cough" },
  
  // Diabetes (Hypoglycemics)
  { brand: "Glucophage", formula: "Metformin HCl", type: "diabetes" },
  { brand: "Getryl", formula: "Glimepiride", type: "diabetes" },
  { brand: "Secrin", formula: "Glimepiride", type: "diabetes" },
  { brand: "Amaryl", formula: "Glimepiride", type: "diabetes" },
  { brand: "Januvia", formula: "Sitagliptin", type: "diabetes" },
  { brand: "Janumet", formula: "Sitagliptin + Metformin", type: "diabetes" },
  { brand: "Galvus", formula: "Vildagliptin", type: "diabetes" },
  { brand: "Galvus Met", formula: "Vildagliptin + Metformin", type: "diabetes" },
  { brand: "Jardiance", formula: "Empagliflozin", type: "diabetes" },
  { brand: "Glucovance", formula: "Glyburide + Metformin", type: "diabetes" },
  { brand: "Trajenta", formula: "Linagliptin", type: "diabetes" },
  { brand: "Trajenta Duo", formula: "Linagliptin + Metformin", type: "diabetes" },
  { brand: "Neodipar", formula: "Metformin", type: "diabetes" },
  { brand: "Daonil", formula: "Glibenclamide", type: "diabetes" },
  { brand: "Glucophage XR", formula: "Metformin Extended Release", type: "diabetes" },
  { brand: "Getryl M", formula: "Glimepiride + Metformin", type: "diabetes" },
  { brand: "Secrin M", formula: "Glimepiride + Metformin", type: "diabetes" },
  { brand: "Amaryl M", formula: "Glimepiride + Metformin", type: "diabetes" },
  { brand: "Galvus Met XR", formula: "Vildagliptin + Metformin ER", type: "diabetes" },
  { brand: "Janumet XR", formula: "Sitagliptin + Metformin ER", type: "diabetes" },
  { brand: "Trajenta Duo XR", formula: "Linagliptin + Metformin ER", type: "diabetes" },
  { brand: "Jardiance Duo", formula: "Empagliflozin + Metformin", type: "diabetes" },
  
  // Cardiac & Lipid Regulators
  { brand: "Concor", formula: "Bisoprolol Fumarate", type: "cardiac" },
  { brand: "Norvasc", formula: "Amlodipine Besylate", type: "cardiac" },
  { brand: "Exforge", formula: "Amlodipine + Valsartan", type: "cardiac" },
  { brand: "Zestril", formula: "Lisinopril", type: "cardiac" },
  { brand: "Tenormin", formula: "Atenolol", type: "cardiac" },
  { brand: "Capoten", formula: "Captopril", type: "cardiac" },
  { brand: "Diovan", formula: "Valsartan", type: "cardiac" },
  { brand: "Lipiget", formula: "Atorvastatin Calcium", type: "cardiac" },
  { brand: "Lipitor", formula: "Atorvastatin", type: "cardiac" },
  { brand: "Crestor", formula: "Rosuvastatin Calcium", type: "cardiac" },
  { brand: "Zocor", formula: "Simvastatin", type: "cardiac" },
  { brand: "Lopresor", formula: "Metoprolol Tartrate", type: "cardiac" },
  { brand: "Inderal", formula: "Propranolol HCl", type: "cardiac" },
  { brand: "Lasix", formula: "Furosemide", type: "cardiac" },
  { brand: "Spiromide", formula: "Furosemide + Spironolactone", type: "cardiac" },
  { brand: "Aldactone", formula: "Spironolactone", type: "cardiac" },
  { brand: "Coversyl", formula: "Perindopril Arginine", type: "cardiac" },
  { brand: "Olmetec", formula: "Olmesartan Medoxomil", type: "cardiac" },
  { brand: "Plavix", formula: "Clopidogrel Bisulphate", type: "cardiac" },
  { brand: "Brilinta", formula: "Ticagrelor", type: "cardiac" },
  { brand: "Xarelto", formula: "Rivaroxaban", type: "cardiac" },
  { brand: "Concor Plus", formula: "Bisoprolol + Hydrochlorothiazide", type: "cardiac" },
  { brand: "Norvasc Plus", formula: "Amlodipine + Atorvastatin", type: "cardiac" },
  { brand: "Zestril Co", formula: "Lisinopril + Hydrochlorothiazide", type: "cardiac" },
  { brand: "Tenormin Co", formula: "Atenolol + Chlorthalidone", type: "cardiac" },
  { brand: "Capoten Co", formula: "Captopril + Hydrochlorothiazide", type: "cardiac" },
  { brand: "Diovan Co", formula: "Valsartan + Hydrochlorothiazide", type: "cardiac" },
  { brand: "Lipitor Plus", formula: "Atorvastatin + Ezetimibe", type: "cardiac" },
  { brand: "Crestor Plus", formula: "Rosuvastatin + Ezetimibe", type: "cardiac" },
  { brand: "Concor AM", formula: "Bisoprolol + Amlodipine", type: "cardiac" },
  { brand: "Norvasc Forte", formula: "Amlodipine Besylate", type: "cardiac" },
  { brand: "Lipiget EZ", formula: "Atorvastatin + Ezetimibe", type: "cardiac" },
  { brand: "Lipitor EZ", formula: "Atorvastatin + Ezetimibe", type: "cardiac" },
  { brand: "Crestor EZ", formula: "Rosuvastatin + Ezetimibe", type: "cardiac" },
  { brand: "Zestril Plus", formula: "Lisinopril + Amlodipine", type: "cardiac" },
  { brand: "Co-Diovan Forte", formula: "Valsartan + HCTZ", type: "cardiac" },
  { brand: "Exforge HCT", formula: "Amlodipine + Valsartan + HCTZ", type: "cardiac" },
  
  // Neuro, Epilepsy & Psychotropics
  { brand: "Epival", formula: "Sodium Valproate", type: "neuro" },
  { brand: "Tegral", formula: "Carbamazepine", type: "neuro" },
  { brand: "Keppra", formula: "Levetiracetam", type: "neuro" },
  { brand: "Xanax", formula: "Alprazolam", type: "psych" },
  { brand: "Lexotanil", formula: "Bromazepam", type: "psych" },
  { brand: "Rivotril", formula: "Clonazepam", type: "psych" },
  { brand: "Lyrica", formula: "Pregabalin", type: "neuro" },
  { brand: "Haldol", formula: "Haloperidol", type: "psych" },
  { brand: "Risperdal", formula: "Risperidone", type: "psych" },
  { brand: "Zyprexa", formula: "Olanzapine", type: "psych" },
  { brand: "Seroquel", formula: "Quetiapine Fumarate", type: "psych" },
  { brand: "Abilify", formula: "Aripiprazole", type: "psych" },
  { brand: "Prozac", formula: "Fluoxetine HCl", type: "psych" },
  { brand: "Lustral", formula: "Sertraline HCl", type: "psych" },
  { brand: "Cipralex", formula: "Escitalopram Oxalate", type: "psych" },
  { brand: "Valium", formula: "Diazepam", type: "psych" },
  { brand: "Ativan", formula: "Lorazepam", type: "psych" },
  { brand: "Dormicum", formula: "Midazolam", type: "psych" },
  { brand: "Epival Chrono", formula: "Sodium Valproate Controlled Release", type: "neuro" },
  { brand: "Tegretol", formula: "Carbamazepine", type: "neuro" },
  { brand: "Dilantin", formula: "Phenytoin Sodium", type: "neuro" },
  
  // Vitamins & Nutrients
  { brand: "Surbex-Z", formula: "Vitamin B-Complex + Zinc", type: "vitamin" },
  { brand: "Surbex-T", formula: "Vitamin B-Complex + Vitamin C", type: "vitamin" },
  { brand: "Neurobion", formula: "Vitamin B1 + B6 + B12", type: "vitamin" },
  { brand: "Fefol", formula: "Iron + Folic Acid", type: "vitamin" },
  { brand: "Sangobion", formula: "Vitamins + Minerals", type: "vitamin" },
  { brand: "Neurobion Extra", formula: "Vitamin B1 + B6 + B12 + CoQ10", type: "vitamin" },
  
  // Gastrointestinal & Cough/Respiratory
  { brand: "Motilium", formula: "Domperidone", type: "nsaid" },
  { brand: "Gravinate", formula: "Dimenhydrinate", type: "nsaid" },
  { brand: "Duphalac", formula: "Lactulose", type: "nsaid" },
  { brand: "Hydryllin", formula: "Aminophylline + Diphenhydramine", type: "cough" },
  { brand: "Pulmonol", formula: "Ammonium Chloride + Menthol", type: "cough" },
  { brand: "Sancos", formula: "Pipazethate HCl", type: "cough" },
  { brand: "Acefyl", formula: "Acefylline Piperazine", type: "cough" },
  { brand: "Ventolin", formula: "Salbutamol", type: "cough" },
  { brand: "Singulair", formula: "Montelukast Sodium", type: "cough" },
  { brand: "Pulmicort", formula: "Budesonide", type: "cough" },
  { brand: "Symbicort", formula: "Budesonide + Formoterol Fumarate", type: "cough" },
  { brand: "Flixotide", formula: "Fluticasone Propionate", type: "cough" },
  
  // Topicals, Antifungals & Skin
  { brand: "Canesten", formula: "Clotrimazole", type: "topical" },
  { brand: "Daktarin", formula: "Miconazole Nitrate", type: "topical" },
  { brand: "Lamisil", formula: "Terbinafine HCl", type: "topical" },
  { brand: "Polyfax", formula: "Polymyxin B + Bacitracin", type: "topical" },
  { brand: "Betnovate", formula: "Betamethasone Valerate", type: "topical" },
  { brand: "Pyodine", formula: "Povidone Iodine", type: "topical" }
];

const getDeterministicPrice = (str: string, min: number, max: number) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const diff = max - min;
  const value = min + (Math.abs(hash) % diff);
  return Math.round(value / 5) * 5;
};

const generateMasterMedicinesList = (): Array<{ name: string; formula: string; pack_size: number; purchase_price: number; sale_price: number; type: string; manufacturer: string }> => {
  const list: Array<{ name: string; formula: string; pack_size: number; purchase_price: number; sale_price: number; type: string; manufacturer: string }> = [];
  
  const formsByCat: Record<string, Array<{ strength: string; form: string; pack_size: number; min_price: number; max_price: number }>> = {
    analgesic: [
      { strength: "125mg", form: "Tablet", pack_size: 100, min_price: 60, max_price: 110 },
      { strength: "250mg", form: "Tablet", pack_size: 100, min_price: 110, max_price: 160 },
      { strength: "500mg", form: "Tablet", pack_size: 100, min_price: 180, max_price: 240 },
      { strength: "650mg", form: "Tablet", pack_size: 100, min_price: 220, max_price: 290 },
      { strength: "1g", form: "Tablet", pack_size: 30, min_price: 150, max_price: 220 },
      { strength: "Extra", form: "Tablet", pack_size: 100, min_price: 260, max_price: 320 },
      { strength: "Extend", form: "Tablet", pack_size: 100, min_price: 280, max_price: 350 },
      { strength: "Actifast", form: "Tablet", pack_size: 20, min_price: 80, max_price: 120 },
      { strength: "Baby 60ml", form: "Syrup", pack_size: 1, min_price: 45, max_price: 65 },
      { strength: "DS 120ml", form: "Syrup", pack_size: 1, min_price: 75, max_price: 115 },
      { strength: "Drops 15ml", form: "Drops", pack_size: 1, min_price: 50, max_price: 75 },
      { strength: "Infant Drops", form: "Drops", pack_size: 1, min_price: 60, max_price: 90 },
      { strength: "150mg", form: "Suppository", pack_size: 10, min_price: 90, max_price: 140 },
      { strength: "250mg", form: "Suppository", pack_size: 10, min_price: 120, max_price: 180 },
      { strength: "500mg IV", form: "Infusion", pack_size: 1, min_price: 140, max_price: 210 }
    ],
    nsaid: [
      { strength: "50mg", form: "Tablet", pack_size: 20, min_price: 50, max_price: 80 },
      { strength: "75mg", form: "Tablet", pack_size: 20, min_price: 70, max_price: 110 },
      { strength: "100mg", form: "Tablet", pack_size: 30, min_price: 85, max_price: 135 },
      { strength: "200mg", form: "Tablet", pack_size: 100, min_price: 120, max_price: 180 },
      { strength: "250mg", form: "Tablet", pack_size: 100, min_price: 150, max_price: 220 },
      { strength: "400mg", form: "Tablet", pack_size: 100, min_price: 190, max_price: 280 },
      { strength: "500mg", form: "Tablet", pack_size: 100, min_price: 260, max_price: 360 },
      { strength: "Forte 500mg", form: "Tablet", pack_size: 100, min_price: 280, max_price: 390 },
      { strength: "600mg", form: "Tablet", pack_size: 30, min_price: 180, max_price: 260 },
      { strength: "Retard 800mg", form: "Tablet", pack_size: 30, min_price: 240, max_price: 350 },
      { strength: "Suspension 90ml", form: "Suspension", pack_size: 1, min_price: 65, max_price: 90 },
      { strength: "DS Suspension", form: "Suspension", pack_size: 1, min_price: 95, max_price: 135 },
      { strength: "Gel 20g", form: "Gel Ointment", pack_size: 1, min_price: 80, max_price: 120 },
      { strength: "Gel 50g", form: "Gel Ointment", pack_size: 1, min_price: 160, max_price: 240 },
      { strength: "75mg Injection", form: "Ampoule", pack_size: 5, min_price: 110, max_price: 180 }
    ],
    antibiotic: [
      { strength: "125mg", form: "Suspension", pack_size: 1, min_price: 80, max_price: 120 },
      { strength: "250mg", form: "Capsule", pack_size: 100, min_price: 450, max_price: 680 },
      { strength: "250mg", form: "Suspension", pack_size: 1, min_price: 120, max_price: 190 },
      { strength: "250mg DS", form: "Suspension", pack_size: 1, min_price: 160, max_price: 240 },
      { strength: "375mg", form: "Tablet", pack_size: 12, min_price: 260, max_price: 350 },
      { strength: "500mg", form: "Capsule", pack_size: 100, min_price: 750, max_price: 1100 },
      { strength: "500mg", form: "Tablet", pack_size: 10, min_price: 200, max_price: 290 },
      { strength: "625mg", form: "Tablet", pack_size: 12, min_price: 390, max_price: 490 },
      { strength: "1g", form: "Tablet", pack_size: 12, min_price: 520, max_price: 690 },
      { strength: "1g IV", form: "Injection", pack_size: 1, min_price: 160, max_price: 250 },
      { strength: "500mg IV", form: "Injection", pack_size: 1, min_price: 110, max_price: 180 },
      { strength: "250mg IV", form: "Injection", pack_size: 1, min_price: 80, max_price: 130 },
      { strength: "Dry Syrup 30ml", form: "Suspension", pack_size: 1, min_price: 180, max_price: 260 },
      { strength: "DS Dry Syrup", form: "Suspension", pack_size: 1, min_price: 260, max_price: 380 },
      { strength: "Drops 10ml", form: "Eye Drops", pack_size: 1, min_price: 70, max_price: 110 }
    ],
    ppi: [
      { strength: "10mg", form: "Capsule", pack_size: 14, min_price: 100, max_price: 150 },
      { strength: "20mg", form: "Capsule", pack_size: 14, min_price: 150, max_price: 250 },
      { strength: "20mg", form: "Tablet", pack_size: 14, min_price: 160, max_price: 270 },
      { strength: "40mg", form: "Capsule", pack_size: 14, min_price: 260, max_price: 390 },
      { strength: "40mg", form: "Tablet", pack_size: 14, min_price: 280, max_price: 420 },
      { strength: "20mg IV", form: "Injection", pack_size: 1, min_price: 90, max_price: 150 },
      { strength: "40mg IV", form: "Injection", pack_size: 1, min_price: 130, max_price: 240 },
      { strength: "Sachet 20mg", form: "Sachet", pack_size: 10, min_price: 180, max_price: 260 },
      { strength: "Sachet 40mg", form: "Sachet", pack_size: 10, min_price: 280, max_price: 390 },
      { strength: "Suspension 120ml", form: "Suspension", pack_size: 1, min_price: 90, max_price: 130 },
      { strength: "Chewable Tablet", form: "Chewable Pack", pack_size: 16, min_price: 140, max_price: 210 },
      { strength: "Mint Chewable", form: "Chewable Pack", pack_size: 16, min_price: 150, max_price: 220 },
      { strength: "Liquid 120ml", form: "Syrup", pack_size: 1, min_price: 120, max_price: 180 },
      { strength: "Liquid 240ml", form: "Syrup", pack_size: 1, min_price: 220, max_price: 320 },
      { strength: "Extra Strength", form: "Tablet", pack_size: 20, min_price: 180, max_price: 260 }
    ],
    cardiac: [
      { strength: "1.25mg", form: "Tablet", pack_size: 28, min_price: 90, max_price: 130 },
      { strength: "2.5mg", form: "Tablet", pack_size: 28, min_price: 130, max_price: 190 },
      { strength: "2.5mg Co", form: "Tablet", pack_size: 28, min_price: 160, max_price: 240 },
      { strength: "5mg", form: "Tablet", pack_size: 30, min_price: 200, max_price: 310 },
      { strength: "5mg Co", form: "Tablet", pack_size: 30, min_price: 240, max_price: 360 },
      { strength: "5mg Plus", form: "Tablet", pack_size: 30, min_price: 260, max_price: 390 },
      { strength: "10mg", form: "Tablet", pack_size: 30, min_price: 310, max_price: 450 },
      { strength: "10mg Co", form: "Tablet", pack_size: 30, min_price: 360, max_price: 495 },
      { strength: "10mg Plus", form: "Tablet", pack_size: 30, min_price: 390, max_price: 540 },
      { strength: "20mg", form: "Tablet", pack_size: 30, min_price: 450, max_price: 620 },
      { strength: "40mg", form: "Tablet", pack_size: 30, min_price: 620, max_price: 880 },
      { strength: "50mg", form: "Tablet", pack_size: 28, min_price: 160, max_price: 240 },
      { strength: "100mg", form: "Tablet", pack_size: 28, min_price: 250, max_price: 380 },
      { strength: "75mg", form: "Tablet", pack_size: 30, min_price: 50, max_price: 80 },
      { strength: "150mg", form: "Tablet", pack_size: 30, min_price: 90, max_price: 140 }
    ],
    diabetes: [
      { strength: "1mg", form: "Tablet", pack_size: 30, min_price: 95, max_price: 145 },
      { strength: "2mg", form: "Tablet", pack_size: 30, min_price: 155, max_price: 235 },
      { strength: "3mg", form: "Tablet", pack_size: 30, min_price: 210, max_price: 310 },
      { strength: "4mg", form: "Tablet", pack_size: 30, min_price: 260, max_price: 380 },
      { strength: "500mg", form: "Tablet", pack_size: 50, min_price: 120, max_price: 195 },
      { strength: "850mg", form: "Tablet", pack_size: 30, min_price: 140, max_price: 220 },
      { strength: "1000mg", form: "Tablet", pack_size: 30, min_price: 195, max_price: 290 },
      { strength: "500mg XR", form: "Tablet", pack_size: 30, min_price: 130, max_price: 195 },
      { strength: "1000mg XR", form: "Tablet", pack_size: 30, min_price: 210, max_price: 310 },
      { strength: "1mg M", form: "Tablet", pack_size: 30, min_price: 180, max_price: 260 },
      { strength: "2mg M", form: "Tablet", pack_size: 30, min_price: 240, max_price: 350 },
      { strength: "2mg Met", form: "Tablet", pack_size: 30, min_price: 260, max_price: 380 },
      { strength: "5/500mg", form: "Tablet", pack_size: 30, min_price: 160, max_price: 240 },
      { strength: "10/500mg", form: "Tablet", pack_size: 30, min_price: 220, max_price: 320 },
      { strength: "25/1000mg", form: "Tablet", pack_size: 30, min_price: 350, max_price: 490 }
    ],
    allergy: [
      { strength: "5mg", form: "Tablet", pack_size: 10, min_price: 50, max_price: 80 },
      { strength: "10mg", form: "Tablet", pack_size: 10, min_price: 80, max_price: 135 },
      { strength: "10mg", form: "Tablet", pack_size: 30, min_price: 220, max_price: 360 },
      { strength: "60ml", form: "Syrup", pack_size: 1, min_price: 65, max_price: 95 },
      { strength: "120ml", form: "Syrup", pack_size: 1, min_price: 100, max_price: 160 },
      { strength: "D 5mg", form: "Tablet", pack_size: 10, min_price: 90, max_price: 140 },
      { strength: "D Forte", form: "Tablet", pack_size: 10, min_price: 120, max_price: 180 },
      { strength: "120mg", form: "Tablet", pack_size: 10, min_price: 120, max_price: 160 },
      { strength: "180mg", form: "Tablet", pack_size: 10, min_price: 180, max_price: 240 },
      { strength: "Nasal 10ml", form: "Spray", pack_size: 1, min_price: 160, max_price: 250 },
      { strength: "Eye 5ml", form: "Drops", pack_size: 1, min_price: 90, max_price: 150 },
      { strength: "Drops 10ml", form: "Drops", pack_size: 1, min_price: 80, max_price: 130 },
      { strength: "Sachet 4mg", form: "Sachet", pack_size: 14, min_price: 180, max_price: 260 },
      { strength: "Sachet 10mg", form: "Sachet", pack_size: 14, min_price: 280, max_price: 390 },
      { strength: "Fast 10mg", form: "Tablet", pack_size: 10, min_price: 110, max_price: 160 }
    ],
    neuro: [
      { strength: "125mg", form: "Tablet", pack_size: 50, min_price: 190, max_price: 310 },
      { strength: "250mg", form: "Tablet", pack_size: 100, min_price: 420, max_price: 620 },
      { strength: "500mg", form: "Tablet", pack_size: 100, min_price: 780, max_price: 1080 },
      { strength: "Chrono 500mg", form: "Tablet", pack_size: 30, min_price: 380, max_price: 520 },
      { strength: "Syrup 120ml", form: "Syrup", pack_size: 1, min_price: 160, max_price: 240 },
      { strength: "75mg", form: "Capsule", pack_size: 14, min_price: 180, max_price: 280 },
      { strength: "150mg", form: "Capsule", pack_size: 14, min_price: 290, max_price: 450 },
      { strength: "200mg", form: "Tablet", pack_size: 50, min_price: 190, max_price: 290 },
      { strength: "100mg IV", form: "Injection", pack_size: 1, min_price: 120, max_price: 190 },
      { strength: "250mg IV", form: "Injection", pack_size: 1, min_price: 220, max_price: 320 },
      { strength: "500mg IV", form: "Injection", pack_size: 1, min_price: 380, max_price: 490 },
      { strength: "XR 500mg", form: "Tablet", pack_size: 30, min_price: 420, max_price: 580 },
      { strength: "XR 1000mg", form: "Tablet", pack_size: 30, min_price: 680, max_price: 890 },
      { strength: "Epival 250mg", form: "Tablet", pack_size: 100, min_price: 490, max_price: 590 },
      { strength: "Epival 500mg", form: "Tablet", pack_size: 100, min_price: 850, max_price: 990 }
    ],
    psych: [
      { strength: "0.25mg", form: "Tablet", pack_size: 30, min_price: 50, max_price: 80 },
      { strength: "0.5mg", form: "Tablet", pack_size: 30, min_price: 80, max_price: 130 },
      { strength: "1mg", form: "Tablet", pack_size: 30, min_price: 120, max_price: 190 },
      { strength: "2mg", form: "Tablet", pack_size: 30, min_price: 160, max_price: 250 },
      { strength: "3mg", form: "Tablet", pack_size: 30, min_price: 210, max_price: 310 },
      { strength: "5mg", form: "Tablet", pack_size: 30, min_price: 280, max_price: 390 },
      { strength: "10mg", form: "Tablet", pack_size: 30, min_price: 350, max_price: 490 },
      { strength: "20mg", form: "Tablet", pack_size: 28, min_price: 420, max_price: 580 },
      { strength: "25mg", form: "Tablet", pack_size: 30, min_price: 110, max_price: 160 },
      { strength: "50mg", form: "Tablet", pack_size: 30, min_price: 180, max_price: 260 },
      { strength: "100mg", form: "Tablet", pack_size: 30, min_price: 290, max_price: 390 },
      { strength: "150mg", form: "Tablet", pack_size: 30, min_price: 380, max_price: 490 },
      { strength: "Drops 10ml", form: "Drops", pack_size: 1, min_price: 110, max_price: 180 },
      { strength: "Ampoule 2ml", form: "Injection", pack_size: 5, min_price: 180, max_price: 260 },
      { strength: "Forte", form: "Tablet", pack_size: 30, min_price: 180, max_price: 260 }
    ],
    cough: [
      { strength: "60ml", form: "Syrup", pack_size: 1, min_price: 45, max_price: 65 },
      { strength: "120ml", form: "Syrup", pack_size: 1, min_price: 70, max_price: 110 },
      { strength: "Compound 120ml", form: "Syrup", pack_size: 1, min_price: 80, max_price: 120 },
      { strength: "DM 120ml", form: "Syrup", pack_size: 1, min_price: 85, max_price: 125 },
      { strength: "Tablet", form: "Tablet", pack_size: 100, min_price: 140, max_price: 200 },
      { strength: "2mg", form: "Tablet", pack_size: 100, min_price: 160, max_price: 220 },
      { strength: "4mg", form: "Tablet", pack_size: 100, min_price: 210, max_price: 280 },
      { strength: "Inhaler 100mcg", form: "Inhaler", pack_size: 1, min_price: 240, max_price: 310 },
      { strength: "Inhaler 200mcg", form: "Inhaler", pack_size: 1, min_price: 340, max_price: 450 },
      { strength: "Rotacaps 200mcg", form: "Capsule", pack_size: 30, min_price: 140, max_price: 190 },
      { strength: "Nebules 2.5mg", form: "Respules", pack_size: 20, min_price: 220, max_price: 310 },
      { strength: "Accuhaler 100mcg", form: "Inhaler", pack_size: 1, min_price: 850, max_price: 990 },
      { strength: "Accuhaler 250mcg", form: "Inhaler", pack_size: 1, min_price: 1100, max_price: 1290 },
      { strength: "Sachet 4mg", form: "Sachet", pack_size: 14, min_price: 180, max_price: 240 },
      { strength: "Sachet 5mg", form: "Sachet", pack_size: 14, min_price: 220, max_price: 290 }
    ],
    vitamin: [
      { strength: "Tablet", form: "Tablet", pack_size: 30, min_price: 180, max_price: 250 },
      { strength: "Capsule", form: "Capsule", pack_size: 30, min_price: 210, max_price: 290 },
      { strength: "Gold Tablet", form: "Tablet", pack_size: 30, min_price: 290, max_price: 390 },
      { strength: "Syrup 120ml", form: "Syrup", pack_size: 1, min_price: 80, max_price: 120 },
      { strength: "Ampoule 3ml", form: "Injection", pack_size: 6, min_price: 150, max_price: 210 },
      { strength: "Extra Tablet", form: "Tablet", pack_size: 30, min_price: 220, max_price: 310 },
      { strength: "Effervescent", form: "Tablet", pack_size: 10, min_price: 190, max_price: 240 },
      { strength: "Z Tablet", form: "Tablet", pack_size: 30, min_price: 260, max_price: 350 },
      { strength: "Z Syrup 120ml", form: "Syrup", pack_size: 1, min_price: 90, max_price: 135 },
      { strength: "Infant Drops 10ml", form: "Drops", pack_size: 1, min_price: 80, max_price: 120 }
    ],
    topical: [
      { strength: "Cream 10g", form: "Cream", pack_size: 1, min_price: 50, max_price: 75 },
      { strength: "Cream 15g", form: "Cream", pack_size: 1, min_price: 70, max_price: 95 },
      { strength: "Cream 20g", form: "Cream", pack_size: 1, min_price: 90, max_price: 120 },
      { strength: "Cream 50g", form: "Cream", pack_size: 1, min_price: 180, max_price: 240 },
      { strength: "Ointment 5g", form: "Ointment", pack_size: 1, min_price: 60, max_price: 85 },
      { strength: "Ointment 15g", form: "Ointment", pack_size: 1, min_price: 75, max_price: 105 },
      { strength: "Ointment 20g", form: "Ointment", pack_size: 1, min_price: 90, max_price: 130 },
      { strength: "Dusting Powder 20g", form: "Powder", pack_size: 1, min_price: 90, max_price: 140 },
      { strength: "Solution 60ml", form: "Solution", pack_size: 1, min_price: 110, max_price: 150 },
      { strength: "Solution 120ml", form: "Solution", pack_size: 1, min_price: 180, max_price: 250 },
      { strength: "Solution 450ml", form: "Solution", pack_size: 1, min_price: 450, max_price: 580 },
      { strength: "Scrub 500ml", form: "Solution", pack_size: 1, min_price: 520, max_price: 690 },
      { strength: "Mouthwash 120ml", form: "Mouthwash", pack_size: 1, min_price: 90, max_price: 130 },
      { strength: "Lotion 30ml", form: "Lotion", pack_size: 1, min_price: 85, max_price: 120 },
      { strength: "Vaginal Cream 35g", form: "Cream", pack_size: 1, min_price: 140, max_price: 195 }
    ]
  };

  const defaultVariants = [
    { strength: "Tablet", form: "Tablet", pack_size: 30, min_price: 120, max_price: 210 },
    { strength: "Capsule", form: "Capsule", pack_size: 30, min_price: 150, max_price: 280 },
    { strength: "Suspension 120ml", form: "Suspension", pack_size: 1, min_price: 80, max_price: 130 }
  ];

  BASE_BRANDS.forEach(bb => {
    const variants = formsByCat[bb.type] || defaultVariants;
    const manufacturer = getBrandManufacturer(bb.brand);
    variants.forEach(v => {
      const name = `${bb.brand} ${v.strength} ${v.form}`;
      const purchase_price = getDeterministicPrice(name + "_pur", v.min_price, v.max_price);
      const margin = getDeterministicPrice(name + "_margin", 10, 15);
      const sale_price = Math.round(purchase_price * (1 + margin / 100));

      list.push({
        name,
        formula: bb.formula,
        pack_size: v.pack_size,
        purchase_price,
        sale_price,
        type: bb.type,
        manufacturer
      });
    });
  });

  return list;
};

export const MASTER_MEDICINES = DRAP_MASTER_MEDICINES;

export function DrugRegistryTab({ shopId, onRefresh, categories }: DrugRegistryTabProps) {
  const supabase = createClient();
  const { subscriptionTier, subscriptionExpiresAt } = useShop();
  const [search, setSearch] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedMedicines, setImportedMedicines] = useState<string[]>([]);

  const isPremium = useMemo(() => {
    const isExpired = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) < new Date() : true;
    return !isExpired && subscriptionTier === "premium";
  }, [subscriptionTier, subscriptionExpiresAt]);
  
  // Confiming / Editing prices before import
  const [confirmingMed, setConfirmingMed] = useState<any | null>(null);
  const [confirmPurchasePrice, setConfirmPurchasePrice] = useState(0);
  const [confirmSalePrice, setConfirmSalePrice] = useState(0);
  const [isFetchingAIPrice, setIsFetchingAIPrice] = useState(false);
  const [apiKeysList, setApiKeysList] = useState<string[]>([]);

  // Bulk Import State
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importAllStep, setImportAllStep] = useState("");
  const [importAllProgress, setImportAllProgress] = useState(0);

  // Load superadmin API keys and fetch currently imported products
  useEffect(() => {
    const loadGlobalKeys = async () => {
      try {
        const { data } = await supabase
          .from("company_details")
          .select("website")
          .eq("shop_id", getPlatformShopId())
          .maybeSingle();

        if (data && data.website && data.website.startsWith("{")) {
          const parsed = JSON.parse(data.website);
          if (parsed.global_gemini_api_keys) {
            const keys = parsed.global_gemini_api_keys.split("\n").map((k: string) => k.trim()).filter(Boolean);
            setApiKeysList(keys);
          }
        }
      } catch (e) {}
    };

    const loadAlreadyImported = async () => {
      try {
        // Fetch all product names currently in database to show "Added" and prevent duplicates
        let allNames: string[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("products")
            .select("name")
            .eq("shop_id", shopId)
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;
          allNames.push(...(data || []).map((p: any) => p.name));
          if ((data || []).length < pageSize) break;
          page++;
        }
        setImportedMedicines(allNames);
      } catch (e) {}
    };

    loadGlobalKeys();
    loadAlreadyImported();
  }, [shopId]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Filter medicines based on query
  const filteredMedicines = useMemo(() => {
    setCurrentPage(1);
    if (!search.trim()) return MASTER_MEDICINES;
    const query = search.toLowerCase();
    return MASTER_MEDICINES.filter(med => 
      med.name.toLowerCase().includes(query) || 
      (med.formula && med.formula.toLowerCase().includes(query)) ||
      (med.manufacturer && med.manufacturer.toLowerCase().includes(query)) ||
      (med.reg_number && med.reg_number.toLowerCase().includes(query))
    );
  }, [search]);

  // Paginated View
  const paginatedMedicines = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMedicines.slice(start, start + itemsPerPage);
  }, [filteredMedicines, currentPage]);

  const totalPages = Math.ceil(filteredMedicines.length / itemsPerPage);

  const handleFetchLatestPrice = async (med: any) => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    if (apiKeysList.length === 0) {
      toast.error("جیمنی API کیز سیٹنگز میں کنفیگر نہیں ہیں!");
      return;
    }
    setIsFetchingAIPrice(true);
    toast.info("جیمنی سے تازہ ترین ریٹس حاصل کیے جا رہے ہیں...");
    try {
      const activeIndex = Math.floor(Math.random() * apiKeysList.length);
      const apiKey = apiKeysList[activeIndex];
      
      const promptText = `
        You are a pakistani pharmacy database assistant. What are the latest average trade price (purchase price) and retail price (sale price / MRP) in Pakistani Rupees (PKR) for this medicine:
        Name: "${med.name}"
        Generic Salt: "${med.formula}"
        Pack Size: ${med.pack_size}
        Return the result strictly in this JSON format (no markdown blocks, no text):
        {
          "purchase_price": 0.0,
          "sale_price": 0.0
        }
      `;

      const candidateModels = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
      ];
      let response: Response | null = null;
      for (const m of candidateModels) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { responseMimeType: "application/json" }
              })
            }
          );
          if (res.ok) {
            response = res;
            break;
          }
        } catch (e) {}
      }

      if (!response || !response.ok) throw new Error("AI request failed across supported models.");
      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.purchase_price && parsed.sale_price) {
          setConfirmPurchasePrice(Math.round(Number(parsed.purchase_price)));
          setConfirmSalePrice(Math.round(Number(parsed.sale_price)));
          toast.success("جیمنی AI سے تازہ ترین قیمتیں حاصل کر لی گئی ہیں!");
        } else {
          toast.warning("AI نے درست قیمتیں فراہم نہیں کیں، ڈیفالٹ ریٹ استعمال کریں۔");
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error("AI سے ریٹ حاصل کرنے میں خرابی: " + e.message);
    } finally {
      setIsFetchingAIPrice(false);
    }
  };

  const handleImportMedicine = async (med: typeof MASTER_MEDICINES[0], finalPurchasePrice: number, finalSalePrice: number) => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    setImportingId(med.name);
    try {
      // 1. Get or create category
      const targetCategoryName = CATEGORY_MAP[med.type] || "Medicines";
      let categoryId = categories.find(c => c.name.toLowerCase() === targetCategoryName.toLowerCase())?.id;
      if (!categoryId) {
        const { data: newCat, error: catError } = await supabase
          .from("categories")
          .insert({ name: targetCategoryName, shop_id: shopId })
          .select()
          .single();
        if (catError) throw catError;
        categoryId = newCat.id;
      }

      // 2. Get or create Brand/Manufacturer
      let brandId = null;
      if (med.manufacturer) {
        const { data: existingBrand } = await supabase
          .from("brands")
          .select("id")
          .eq("shop_id", shopId)
          .eq("name", med.manufacturer)
          .maybeSingle();

        if (existingBrand) {
          brandId = existingBrand.id;
        } else {
          const { data: newBrand, error: brandError } = await supabase
            .from("brands")
            .insert({ name: med.manufacturer, shop_id: shopId })
            .select()
            .single();
          if (!brandError && newBrand) brandId = newBrand.id;
        }
      }

      // 3. Get or create Formulation
      let formulationId = null;
      if (med.formula) {
        const { data: formulaRow } = await supabase
          .from("formulations")
          .select("id")
          .eq("shop_id", shopId)
          .eq("name", med.formula)
          .maybeSingle();

        if (formulaRow) {
          formulationId = formulaRow.id;
        } else {
          const { data: newForm, error: formError } = await supabase
            .from("formulations")
            .insert({ name: med.formula, shop_id: shopId })
            .select()
            .single();
          if (!formError && newForm) formulationId = newForm.id;
        }
      }

      // 4. Insert Product
      const isSyrup = med.name.toLowerCase().includes("syrup") || med.name.toLowerCase().includes("suspension") || med.name.toLowerCase().includes("liquid") || med.name.toLowerCase().includes("drops") || med.name.toLowerCase().includes("solution");
      const unit = isSyrup ? "bottle" : (med.name.toLowerCase().includes("injection") || med.name.toLowerCase().includes("ampoule") ? "vial" : "pcs");
      
      const purchasePriceSingle = med.pack_size > 1 ? Number((finalPurchasePrice / med.pack_size).toFixed(2)) : finalPurchasePrice;
      const salePriceSingle = med.pack_size > 1 ? Number((finalSalePrice / med.pack_size).toFixed(2)) : finalSalePrice;

      const { data: insertedProduct, error: prodError } = await supabase
        .from("products")
        .insert({
          shop_id: shopId,
          name: med.name,
          unit: unit,
          purchase_price_single: purchasePriceSingle,
          sale_price_single: salePriceSingle,
          current_stock: 0,
          min_stock_level: 10,
          category_id: categoryId,
          brand_id: brandId,
          measurement_type: "standard",
          formulation_id: formulationId,
          pack_size: med.pack_size > 1 ? med.pack_size : null,
          purchase_price_pack: med.pack_size > 1 ? finalPurchasePrice : null,
          sale_price_pack: med.pack_size > 1 ? finalSalePrice : null,
          note: isControlledDrug(med) ? "[CONTROLLED_DRUG]" : null
        })
        .select()
        .single();

      if (prodError) throw prodError;

      // 5. Create packing variation if pack size > 1
      if (med.pack_size > 1 && insertedProduct) {
        const packingName = `Pack (${med.pack_size} ${unit})`;
        const { error: varError } = await supabase
          .from("product_variants")
          .insert({
            product_id: insertedProduct.id,
            shop_id: shopId,
            packing_name: packingName,
            purchase_price: finalPurchasePrice,
            sale_price: finalSalePrice,
            stock_quantity: 0,
            is_packing: true,
            pack_size: med.pack_size
          });

        if (varError) console.error("Error inserting variation:", varError);
      }

      setImportedMedicines(prev => [...prev, med.name]);
      toast.success(`${med.name} permanently add ho gayi hai!`);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error("Import failed: " + (err.message || "Unknown error"));
    } finally {
      setImportingId(null);
    }
  };

  // Safe Clean Duplicates Helper (keep the oldest, delete duplicates)
  const handleCleanDuplicates = async () => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    const consent = window.confirm("Kya aap waqai duplicate products ko database se clean karna chahte hain? Same name wali double entries khatam ho jayengi.");
    if (!consent) return;

    try {
      toast.info("Database se duplicate entries delete ki ja rahi hain...");
      
      // Fetch all products
      let allProducts: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, created_at")
          .eq("shop_id", shopId)
          .order("created_at", { ascending: true }) // Oldest first
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        allProducts.push(...(data || []));
        if ((data || []).length < pageSize) break;
        page++;
      }

      // Group by name
      const nameMap: Record<string, string[]> = {};
      allProducts.forEach(p => {
        const key = p.name.toLowerCase().trim();
        if (!nameMap[key]) {
          nameMap[key] = [];
        }
        nameMap[key].push(p.id);
      });

      // Find duplicates (all IDs after the first one)
      const duplicateIds: string[] = [];
      Object.values(nameMap).forEach(ids => {
        if (ids.length > 1) {
          duplicateIds.push(...ids.slice(1));
        }
      });

      if (duplicateIds.length === 0) {
        toast.success("Koi duplicate medicine nahi mili! Catalog bilkul clean hai.");
        return;
      }

      // Batch delete duplicates in chunks of 100
      for (let i = 0; i < duplicateIds.length; i += 100) {
        const chunk = duplicateIds.slice(i, i + 100);
        const { error } = await supabase
          .from("products")
          .delete()
          .in("id", chunk);

        if (error) throw error;
      }

      toast.success(`🎉 Successful! ${duplicateIds.length} duplicate medicines successfully deleted!`);
      
      // Reload imported list
      const cleanNames = allProducts
        .filter(p => !duplicateIds.includes(p.id))
        .map(p => p.name);
      setImportedMedicines(cleanNames);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error("Cleanup failed: " + err.message);
    }
  };

  // Bulk Import all medicines in optimized parallelized chunks with deduplication
  const handleImportAllMedicines = async () => {
    if (!isPremium) {
      toast.error("یہ فیچر صرف پریمیم سبسکرپشن پلان میں دستیاب ہے۔", {
        description: "This feature is only available in the Premium plan. Please upgrade."
      });
      return;
    }
    // 1. Identify which medicines are not yet imported
    const importedSet = new Set(importedMedicines.map(n => n.toLowerCase().trim()));
    const medicinesToImport = MASTER_MEDICINES.filter(
      med => !importedSet.has(med.name.toLowerCase().trim())
    );

    if (medicinesToImport.length === 0) {
      toast.info("Tammam medicines pehle se imported hain!");
      return;
    }

    const consent = window.confirm(`Kya aap waqai bachi hui ${medicinesToImport.length.toLocaleString()} medicines ko bulk mein import karna chahte hain? (Deduplication on hai, duplicate entries nahi banengi).`);
    if (!consent) return;

    setIsImportingAll(true);
    setImportAllProgress(10);
    
    try {
      // 1. Create categories in bulk (with recursive pagination checks)
      setImportAllStep("Step 1/5: Importing Categories...");
      const uniqueCategoryNames = Array.from(new Set(medicinesToImport.map(m => CATEGORY_MAP[m.type] || "Medicines")));
      
      const allExistingCats: any[] = [];
      let catPage = 0;
      while (true) {
        const { data, error } = await supabase
          .from("categories")
          .select("id, name")
          .eq("shop_id", shopId)
          .range(catPage * 1000, (catPage + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allExistingCats.push(...data);
        if (data.length < 1000) break;
        catPage++;
      }

      const existingCatNames = allExistingCats.map((c: any) => c.name.toLowerCase());
      const categoriesToInsert = uniqueCategoryNames
        .filter(name => !existingCatNames.includes(name.toLowerCase()))
        .map(name => ({ name, shop_id: shopId }));

      if (categoriesToInsert.length > 0) {
        await supabase.from("categories").insert(categoriesToInsert);
      }
      
      const allCatsFetched: any[] = [];
      let catReloadPage = 0;
      while (true) {
        const { data, error } = await supabase
          .from("categories")
          .select("id, name")
          .eq("shop_id", shopId)
          .range(catReloadPage * 1000, (catReloadPage + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allCatsFetched.push(...data);
        if (data.length < 1000) break;
        catReloadPage++;
      }

      const catLookup: Record<string, string> = {};
      allCatsFetched.forEach((c: any) => {
        catLookup[c.name.toLowerCase()] = c.id;
      });

      setImportAllProgress(25);

      // 2. Create brands in bulk (with recursive pagination checks)
      setImportAllStep("Step 2/5: Importing Medicine Brands...");
      const uniqueBrands = Array.from(new Set(medicinesToImport.map(m => m.manufacturer)));
      
      const allExistingBrands: any[] = [];
      let brandPageIndex = 0;
      while (true) {
        const { data, error } = await supabase
          .from("brands")
          .select("id, name")
          .eq("shop_id", shopId)
          .range(brandPageIndex * 1000, (brandPageIndex + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allExistingBrands.push(...data);
        if (data.length < 1000) break;
        brandPageIndex++;
      }

      const existingBrandNames = allExistingBrands.map((b: any) => b.name.toLowerCase());
      const brandsToInsert = uniqueBrands
        .filter(name => !existingBrandNames.includes(name.toLowerCase()))
        .map(name => ({ name, shop_id: shopId }));

      if (brandsToInsert.length > 0) {
        await supabase.from("brands").insert(brandsToInsert);
      }

      const allBrandsFetched: any[] = [];
      let brandReloadPage = 0;
      while (true) {
        const { data, error } = await supabase
          .from("brands")
          .select("id, name")
          .eq("shop_id", shopId)
          .range(brandReloadPage * 1000, (brandReloadPage + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allBrandsFetched.push(...data);
        if (data.length < 1000) break;
        brandReloadPage++;
      }

      const brandLookup: Record<string, string> = {};
      allBrandsFetched.forEach((b: any) => {
        brandLookup[b.name.toLowerCase()] = b.id;
      });

      setImportAllProgress(40);

      // 3. Create generic formulations in bulk (with recursive pagination checks)
      setImportAllStep("Step 3/5: Registering Salts & Formulations...");
      const uniqueFormulas = Array.from(new Set(medicinesToImport.map(m => m.formula).filter(Boolean)));
      
      const allExistingFormulations: any[] = [];
      let formPageIndex = 0;
      while (true) {
        const { data, error } = await supabase
          .from("formulations")
          .select("id, name")
          .eq("shop_id", shopId)
          .range(formPageIndex * 1000, (formPageIndex + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allExistingFormulations.push(...data);
        if (data.length < 1000) break;
        formPageIndex++;
      }

      const existingFormulationNames = allExistingFormulations.map((f: any) => f.name.toLowerCase());
      const formulationsToInsert = uniqueFormulas
        .filter(name => !existingFormulationNames.includes(name.toLowerCase()))
        .map(name => ({ name, shop_id: shopId }));

      if (formulationsToInsert.length > 0) {
        await supabase.from("formulations").insert(formulationsToInsert);
      }

      const allFormulationsFetched: any[] = [];
      let formReloadPage = 0;
      while (true) {
        const { data, error } = await supabase
          .from("formulations")
          .select("id, name")
          .eq("shop_id", shopId)
          .range(formReloadPage * 1000, (formReloadPage + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allFormulationsFetched.push(...data);
        if (data.length < 1000) break;
        formReloadPage++;
      }

      const formulationsLookup: Record<string, string> = {};
      allFormulationsFetched.forEach((f: any) => {
        formulationsLookup[f.name.toLowerCase()] = f.id;
      });

      setImportAllProgress(55);

      // 4. Batch insert products in chunks of 500
      setImportAllStep("Step 4/5: Inserting Products catalog...");
      const productsToInsert = medicinesToImport.map(med => {
        const targetCategoryName = CATEGORY_MAP[med.type] || "Medicines";
        const categoryId = catLookup[targetCategoryName.toLowerCase()] || null;
        const brandId = brandLookup[med.manufacturer.toLowerCase()] || null;
        const formulationId = formulationsLookup[med.formula.toLowerCase()] || null;

        const isSyrup = med.name.toLowerCase().includes("syrup") || med.name.toLowerCase().includes("suspension") || med.name.toLowerCase().includes("liquid") || med.name.toLowerCase().includes("drops") || med.name.toLowerCase().includes("solution");
        const unit = isSyrup ? "bottle" : (med.name.toLowerCase().includes("injection") || med.name.toLowerCase().includes("ampoule") ? "vial" : "pcs");
        
        const purchasePriceSingle = med.pack_size > 1 ? Number((med.purchase_price / med.pack_size).toFixed(2)) : med.purchase_price;
        const salePriceSingle = med.pack_size > 1 ? Number((med.sale_price / med.pack_size).toFixed(2)) : med.sale_price;

        return {
          shop_id: shopId,
          name: med.name,
          unit,
          purchase_price_single: purchasePriceSingle,
          sale_price_single: salePriceSingle,
          current_stock: 0,
          min_stock_level: 10,
          category_id: categoryId,
          brand_id: brandId,
          measurement_type: "standard",
          formulation_id: formulationId,
          pack_size: med.pack_size > 1 ? med.pack_size : null,
          purchase_price_pack: med.pack_size > 1 ? med.purchase_price : null,
          sale_price_pack: med.pack_size > 1 ? med.sale_price : null,
          note: isControlledDrug(med) ? "[CONTROLLED_DRUG]" : null
        };
      });

      const insertedProductRefs: any[] = [];
      for (let i = 0; i < productsToInsert.length; i += 500) {
        const chunk = productsToInsert.slice(i, i + 500);
        const { data: insertedChunk, error: prodErr } = await supabase
          .from("products")
          .insert(chunk)
          .select("id, name, pack_size, unit");

        if (prodErr) throw prodErr;
        if (insertedChunk) insertedProductRefs.push(...insertedChunk);
        
        setImportAllProgress(Math.min(85, 55 + Math.round((i / productsToInsert.length) * 30)));
      }

      // 5. Create variations for all packed products in chunks of 500
      setImportAllStep("Step 5/5: Creating pack variations...");
      const variationsToInsert = insertedProductRefs
        .filter(p => p.pack_size && p.pack_size > 1)
        .map(p => {
          const medRef = medicinesToImport.find(m => m.name === p.name);
          if (!medRef) return null;
          
          return {
            product_id: p.id,
            shop_id: shopId,
            packing_name: `Pack (${p.pack_size} ${p.unit})`,
            purchase_price: medRef.purchase_price,
            sale_price: medRef.sale_price,
            stock_quantity: 0,
            is_packing: true,
            pack_size: p.pack_size
          };
        })
        .filter(Boolean);

      for (let i = 0; i < variationsToInsert.length; i += 500) {
        const chunk = variationsToInsert.slice(i, i + 500);
        const { error: varErr } = await supabase.from("product_variants").insert(chunk);
        if (varErr) console.error("Error batch inserting variants:", varErr);
      }

      setImportAllProgress(100);
      toast.success(`🎉 Successful! ${medicinesToImport.length} new medicines successfully imported!`);
      
      const newImportedNames = [...importedMedicines, ...medicinesToImport.map(m => m.name)];
      setImportedMedicines(newImportedNames);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error("Bulk import failed: " + (err.message || "Unknown error"));
    } finally {
      setIsImportingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Registry Intro & Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
            <Pill size={16} className="text-blue-500 animate-pulse" /> Master Drug Registry ({MASTER_MEDICINES.length.toLocaleString()} Medicines preloaded)
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            Pakistani pharmaceutical medicines, generic formulas, specific brands, and pack variations mapped correctly.
          </p>
        </div>

        <div className="flex w-full md:w-auto items-center gap-2">
          <button
            onClick={handleCleanDuplicates}
            className="h-9 px-4 bg-rose-50 text-rose-650 hover:bg-rose-100 rounded-xl text-xs font-black border border-rose-200 flex items-center gap-1.5 cursor-pointer transition"
          >
            <Trash2 size={14} />
            <span>Clean Duplicates</span>
            {!isPremium && <Lock size={10} className="text-rose-400" />}
          </button>

          <button
            onClick={handleImportAllMedicines}
            disabled={isImportingAll}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
          >
            <FolderPlus size={14} />
            <span>Import All Medicines</span>
            {!isPremium && <Lock size={10} className="text-emerald-200" />}
          </button>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search medicine name or generic salt formula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-xs overflow-x-auto w-full custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider select-none">
              <th className="py-3 px-4">Brand / Product Name</th>
              <th className="py-3 px-4">Generic Formula</th>
              <th className="py-3 px-4">Manufacturer</th>
              <th className="py-3 px-4 text-center">Pack Size</th>
              <th className="py-3 px-4 text-right">Pack Purchase (Rs)</th>
              <th className="py-3 px-4 text-right">Pack Sale (Rs)</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-bold">
            {paginatedMedicines.map((med, idx) => {
              const isAlreadyImported = importedMedicines.some(
                n => n.toLowerCase().trim() === med.name.toLowerCase().trim()
              );
              return (
                <tr key={`${med.name}_${med.reg_number || ''}_${med.pack_size}_${idx}`} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-black text-slate-800">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span>{med.name}</span>
                      {isControlledDrug(med) && (
                        <span className="text-[9px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.2 rounded-md font-black flex items-center gap-0.5 shadow-2xs">
                          🚨 Controlled (Schedule G)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium italic">{med.formula}</td>
                  <td className="py-3.5 px-4 text-slate-500 font-semibold">{med.manufacturer}</td>
                  <td className="py-3.5 px-4 text-center font-mono text-slate-650">{med.pack_size}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-650">Rs {med.purchase_price}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">Rs {med.sale_price}</td>
                  <td className="py-3.5 px-4 text-center">
                    {isAlreadyImported ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-650 rounded-xl text-[10px] font-black">
                        <Check size={11} /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setConfirmingMed(med);
                          setConfirmPurchasePrice(med.purchase_price);
                          setConfirmSalePrice(med.sale_price);
                        }}
                        disabled={importingId !== null}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 transition"
                      >
                        <Plus size={11} />
                        <span>Add to Inventory</span>
                        {!isPremium && <Lock size={9} className="text-blue-200" />}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredMedicines.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                  No medicines matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-slate-50 border border-slate-200/60 p-3 rounded-2xl text-xs font-bold text-slate-600">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredMedicines.length)} of {filteredMedicines.length} medicines
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 bg-white border rounded-xl hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-black text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3.5 py-1.5 bg-white border rounded-xl hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Import Price Confirmation with AI Enrichment */}
      {confirmingMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                <Pill size={14} className="text-blue-650" /> Confirm Price & Import
              </h4>
              <button 
                onClick={() => setConfirmingMed(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 space-y-4 text-xs">
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3.5 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Medicine / Formulation</span>
                <span className="font-black text-slate-850 block">{confirmingMed.name}</span>
                <span className="text-[10px] text-slate-500 font-semibold italic mt-0.5 block">{confirmingMed.formula} · Pack of {confirmingMed.pack_size}</span>
                <span className="text-[10.5px] font-bold text-slate-600 block mt-1">Manufacturer: {confirmingMed.manufacturer}</span>
              </div>

              {/* Price Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pack Purchase Price (Rs)</label>
                  <input
                    type="number"
                    value={confirmPurchasePrice}
                    onChange={(e) => setConfirmPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pack Sale Price (Rs)</label>
                  <input
                    type="number"
                    value={confirmSalePrice}
                    onChange={(e) => setConfirmSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                  />
                </div>
              </div>

              {/* AI Rates Button */}
              {apiKeysList.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleFetchLatestPrice(confirmingMed)}
                  disabled={isFetchingAIPrice}
                  className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-[10px] font-black shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isFetchingAIPrice ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Fetching latest rates via AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} className="animate-pulse" />
                      <span>Fetch Latest Price from AI</span>
                      {!isPremium && <Lock size={10} className="text-indigo-200" />}
                    </>
                  )}
                </button>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setConfirmingMed(null)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 font-bold text-slate-500 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleImportMedicine(confirmingMed, confirmPurchasePrice, confirmSalePrice);
                    setConfirmingMed(null);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md cursor-pointer flex items-center gap-1"
                >
                  Confirm & Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Import Progress Tracker */}
      {isImportingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-650">
                <RefreshCw size={24} className="animate-spin" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Bulk Importing Database</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Please wait, loading medicines...</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>{importAllStep}</span>
                <span>{importAllProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${importAllProgress}%` }}
                />
              </div>
            </div>
            
            <p className="text-[9.5px] text-center text-slate-400 font-semibold italic">
              Do not close this page or refresh until migration finishes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
