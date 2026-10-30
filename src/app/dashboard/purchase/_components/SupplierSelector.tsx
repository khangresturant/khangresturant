"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { User, Search, Plus, X, ChevronDown, Check, Building2, Phone, Wallet } from "lucide-react";
import type { Supplier } from "./types";

type Props = {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  compact?: boolean;
};

export function SupplierSelector({
  suppliers,
  selectedSupplierId,
  onSelect,
  onAddNew,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId),
    [suppliers, selectedSupplierId]
  );

  // Sync display search with selected supplier when not actively typing/open
  useEffect(() => {
    if (!isOpen) {
      if (selectedSupplierId === "walkin" || !selectedSupplier) {
        setSearch("");
      } else {
        setSearch(selectedSupplier.name);
      }
    }
  }, [selectedSupplierId, selectedSupplier, isOpen]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    // If search text exactly equals selected supplier name, show all suppliers for easy browsing
    if (selectedSupplier && q === selectedSupplier.name.toLowerCase()) {
      return suppliers;
    }
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
    );
  }, [suppliers, search, selectedSupplier]);

  // Combined options list for keyboard navigation: [Walkin, ...filteredSuppliers]
  const totalOptions = useMemo(() => {
    return [{ id: "walkin", name: "Cash / Walk-in", isWalkin: true } as any, ...filteredSuppliers];
  }, [filteredSuppliers]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedSupplierId === "walkin" || !selectedSupplier) {
          setSearch("");
        } else {
          setSearch(selectedSupplier.name);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedSupplierId, selectedSupplier]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredSuppliers.length]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      if (id === "walkin") {
        setSearch("");
      } else {
        const sup = suppliers.find((s) => s.id === id);
        if (sup) setSearch(sup.name);
      }
      setIsOpen(false);
    },
    [onSelect, suppliers]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalOptions.length);
      scrollHighlightedIntoView((highlightedIndex + 1) % totalOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalOptions.length) % totalOptions.length);
      scrollHighlightedIntoView((highlightedIndex - 1 + totalOptions.length) % totalOptions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = totalOptions[highlightedIndex];
      if (target) {
        handleSelect(target.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
      if (selectedSupplierId === "walkin" || !selectedSupplier) {
        setSearch("");
      } else {
        setSearch(selectedSupplier.name);
      }
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-option-item]");
    if (items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect("walkin");
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Label Row */}
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 truncate">
          <Building2 size={10} className="text-violet-500" />
          <span>Supplier</span>
          {selectedSupplier && selectedSupplier.current_balance !== 0 && (
            <span
              className={`ml-1 text-[8px] font-extrabold px-1 rounded ${
                selectedSupplier.current_balance > 0
                  ? "bg-rose-100 text-rose-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {selectedSupplier.current_balance > 0
                ? `Due: Rs ${Number(selectedSupplier.current_balance).toLocaleString()}`
                : `Adv: Rs ${Math.abs(Number(selectedSupplier.current_balance)).toLocaleString()}`}
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={onAddNew}
          className="text-[9px] font-black text-violet-600 hover:text-violet-800 flex items-center gap-0.5 shrink-0 transition-colors cursor-pointer"
          title="Create New Supplier"
        >
          <Plus size={9} /> New
        </button>
      </div>

      {/* Search Input Trigger */}
      <div className="relative group">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-violet-600">
          {search || selectedSupplierId !== "walkin" ? (
            <Search size={12} className="text-violet-500" />
          ) : (
            <User size={12} className="text-slate-400" />
          )}
        </div>

        <input
          ref={inputRef}
          id="purchase-supplier-search-input"
          type="text"
          value={isOpen ? search : selectedSupplier ? selectedSupplier.name : ""}
          placeholder="Cash / Walk-in (Type to search...)"
          onFocus={() => {
            setIsOpen(true);
            // Select text on focus for quick overwrite
            setTimeout(() => inputRef.current?.select(), 50);
          }}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full ${
            compact ? "h-8 text-xs pl-7 pr-12" : "h-9 text-xs pl-8 pr-12"
          } bg-white border border-slate-250 hover:border-violet-300 focus:border-violet-500 rounded-xl font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 shadow-2xs transition-all`}
        />

        {/* Action icons on right */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {selectedSupplierId !== "walkin" || (isOpen && search.trim()) ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Reset to Cash / Walk-in"
            >
              <X size={11} />
            </button>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsOpen((v) => !v);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-violet-600" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Floating Dropdown Autocomplete Menu (Opens upwards in sticky bottom checkout bar) */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 w-full min-w-[280px] sm:min-w-[340px] max-w-[420px] bg-white border border-slate-200 rounded-2xl shadow-[0_15px_40px_-10px_rgba(0,0,0,0.22)] z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{ maxHeight: "300px" }}
        >
          {/* Header Bar inside popup */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {filteredSuppliers.length} Supplier{filteredSuppliers.length === 1 ? "" : "s"} Available
            </span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onAddNew();
              }}
              className="text-[10.5px] font-black text-violet-700 hover:text-violet-900 flex items-center gap-1 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded-lg border border-violet-200/60 transition-all cursor-pointer"
            >
              <Plus size={11} /> + Add Supplier
            </button>
          </div>

          {/* List of Options */}
          <div ref={listRef} className="overflow-y-auto flex-1 p-1 divide-y divide-slate-50">
            {/* Option 0: Cash / Walk-in */}
            <div
              data-option-item
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect("walkin");
              }}
              className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                highlightedIndex === 0
                  ? "bg-violet-100/70 text-violet-900 font-bold"
                  : selectedSupplierId === "walkin"
                  ? "bg-violet-50 text-violet-800 font-semibold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Wallet size={12} />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-[11.5px]">Cash / Walk-in Supplier</div>
                  <div className="text-[9.5px] text-slate-400 font-medium">No credit ledger account</div>
                </div>
              </div>
              {selectedSupplierId === "walkin" && (
                <Check size={13} className="text-violet-600 shrink-0" />
              )}
            </div>

            {/* Filtered Suppliers List */}
            {filteredSuppliers.map((s, idx) => {
              const optionIndex = idx + 1;
              const isSelected = s.id === selectedSupplierId;
              const isHighlighted = optionIndex === highlightedIndex;

              return (
                <div
                  key={s.id}
                  data-option-item
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(s.id);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isHighlighted
                      ? "bg-violet-100/70 text-violet-900 font-bold"
                      : isSelected
                      ? "bg-violet-50 text-violet-800 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 text-[11.5px] truncate">
                        {s.name}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] font-black bg-violet-200/80 text-violet-800 px-1.5 py-0.2 rounded-md shrink-0">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      {s.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone size={9} /> {s.phone}
                        </span>
                      )}
                      {s.address && (
                        <span className="truncate max-w-[120px] text-slate-400">
                          • {s.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Balance badge */}
                  <div className="shrink-0 text-right">
                    <div
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${
                        s.current_balance > 0
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : s.current_balance < 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {s.current_balance > 0
                        ? `Rs ${Number(s.current_balance).toLocaleString()} Due`
                        : s.current_balance < 0
                        ? `Rs ${Math.abs(Number(s.current_balance)).toLocaleString()} Adv`
                        : "Rs 0.00"}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty Search State */}
            {filteredSuppliers.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  No supplier found for &ldquo;<span className="font-bold text-slate-800">{search}</span>&rdquo;
                </p>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAddNew();
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-black text-violet-700 bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <Plus size={12} /> Create &ldquo;{search}&rdquo; as Supplier
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
