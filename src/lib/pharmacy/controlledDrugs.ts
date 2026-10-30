// Centralized Controlled & Schedule G Drugs Recognition Helper

export const CONTROLLED_KEYWORDS: string[] = [
  // Benzodiazepines & Sedatives
  "xanax", "lexotanil", "rivotril", "valium", "diazepam", 
  "alprazolam", "bromazepam", "clonazepam", "lorazepam", "midazolam",
  "nitrazepam", "mogadon", "clobazam", "frisium", "librium", "chlordiazepoxide",
  "ativan", "serax", "oxazepam", "stilnox", "zolpidem", "restoril", "temazepam",
  "dormicum", "flurazepam", "triazolam",

  // Opioids & Narcotic Analgesics
  "tramadol", "tramal", "t-dol", "ketamine", "morphine", "nalbuphine", "nalbin",
  "pethidine", "fentanyl", "buprenorphine", "codeine", "methadone",

  // Neuropathic & Anticonvulsants
  "epival", "valproate", "tegretol", "tegral", "carbamazepine", 
  "gabapentin", "gaba", "neurontin", "pregabalin", "lyrica", "gabica",
  "phenobarbital", "phenobarbitone", "luminal"
];

export const isControlledDrug = (item: { 
  name?: string | null; 
  note?: string | null; 
  is_controlled?: boolean | null; 
  formulations?: any;
  category?: string | null;
} | null | undefined): boolean => {
  if (!item) return false;
  if (item.is_controlled) return true;
  if (item.note?.includes("[CONTROLLED_DRUG]")) return true;
  
  const text = `${item.name || ""} ${item.note || ""} ${item.formulations?.name || ""} ${item.category || ""}`.toLowerCase();
  return CONTROLLED_KEYWORDS.some(kw => text.includes(kw));
};
