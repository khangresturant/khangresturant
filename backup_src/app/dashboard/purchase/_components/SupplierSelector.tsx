"use client";
import { useRef, useEffect, useState, useMemo } from "react";
import { User, ChevronDown, Plus } from "lucide-react";
import type { Supplier } from "./types";

type Props = {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSelect: (id: string) => void;
  onAddNew: () => void;
};

export function SupplierSelector({ suppliers, selectedSupplierId, onSelect, onAddNew }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)));
  }, [suppliers, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm shrink-0" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Supplier</label>
        <button onClick={onAddNew} className="text-[10px] font-black text-violet-600 hover:text-violet-800 flex items-center gap-0.5">
          <Plus size={10} /> New Supplier
        </button>
      </div>

      <div className="relative">
        <button
          id="purchase-supplier-btn"
          onClick={() => setIsOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:border-violet-300 transition-all"
        >
          <div className="flex items-center gap-2">
            <User size={13} className="text-violet-500" />
            {selectedSupplier ? selectedSupplier.name : "Cash / Walk-in Purchase"}
          </div>
          <ChevronDown size={13} className="text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-52 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                placeholder="Search supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              <button
                onClick={() => { onSelect("walkin"); setSearch(""); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-all"
              >
                Cash / Walk-in Purchase
              </button>
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSelect(s.id); setSearch(s.name); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-violet-50 transition-all ${s.id === selectedSupplierId ? "bg-violet-50 font-bold text-violet-700" : "text-slate-700 font-medium"}`}
                >
                  <div className="font-bold">{s.name}</div>
                  {s.phone && <div className="text-[10px] text-slate-400">{s.phone}</div>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedSupplier && (
        <p className="text-[10px] text-slate-400 mt-1.5 font-semibold">
          Outstanding:{" "}
          <span className={selectedSupplier.current_balance > 0 ? "text-rose-500" : "text-emerald-600"}>
            Rs {Number(selectedSupplier.current_balance).toLocaleString()}
          </span>
        </p>
      )}
    </div>
  );
}
