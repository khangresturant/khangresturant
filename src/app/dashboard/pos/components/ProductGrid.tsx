import React from "react";
import { motion } from "framer-motion";
import { Search, Camera, X, Loader2, ChevronLeft, ChevronRight, Plus, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DBProduct, Category } from "../types";

interface ProductGridProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
  categories: Category[];
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  loading: boolean;
  filteredProducts: DBProduct[];
  paginatedProducts: DBProduct[];
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  PAGE_SIZE: number;
  selectedGridIndex: number;
  setSelectedGridIndex: React.Dispatch<React.SetStateAction<number>>;
  selectedGridUnitIndex: number;
  handleAddProductToCart: (product: DBProduct, variant?: any) => void;
  handleAddBaseUnitDirectly: (product: DBProduct) => void;
  getProductUnitOptions: (product: DBProduct) => any[];
  language: string;
  isPharmacy?: boolean;
  showCostPrice?: boolean;
  onToggleCostPrice?: () => void;
  onOpenAlternateModal?: (product: DBProduct | null) => void;
  onOpenQuickAddModal?: (initialName?: string) => void;
  onOpenQuickShortBookModal?: (initialMedicineName?: string) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  searchQuery,
  setSearchQuery,
  isScannerOpen,
  setIsScannerOpen,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
  loading,
  filteredProducts,
  paginatedProducts,
  page,
  setPage,
  PAGE_SIZE,
  selectedGridIndex,
  setSelectedGridIndex,
  selectedGridUnitIndex,
  handleAddProductToCart,
  handleAddBaseUnitDirectly,
  getProductUnitOptions,
  language,
  isPharmacy = false,
  showCostPrice = false,
  onToggleCostPrice,
  onOpenAlternateModal,
  onOpenQuickAddModal,
  onOpenQuickShortBookModal,
}) => {
  return (
    <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white border border-slate-200 shadow-2xs rounded-2xl p-2.5 md:p-3 overflow-hidden h-full min-h-0 font-sans">
      {/* Search Bar & Actions */}
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input 
            id="pos-search-input"
            placeholder={isPharmacy ? "Search medicine, generic salt, or scan barcode..." : "Search or scan barcode..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-14 h-8.5 bg-slate-50 border-slate-200 text-slate-800 text-xs rounded-xl focus-visible:ring-indigo-500/20 font-bold shadow-2xs w-full"
            autoFocus
          />
          <button 
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ${searchQuery ? "right-8" : "right-2.5"}`}
            title="Scan Barcode via Camera"
          >
            <Camera size={14} />
          </button>
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery("")} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick Add Product Button */}
        {onOpenQuickAddModal && (
          <button
            type="button"
            onClick={() => onOpenQuickAddModal(searchQuery)}
            className="h-8.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
            title="Quickly add new product / medicine to inventory & cart"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add Item</span>
          </button>
        )}

        {/* Pharmacy Short Book Button */}
        {isPharmacy && onOpenQuickShortBookModal && (
          <button
            type="button"
            onClick={() => onOpenQuickShortBookModal(searchQuery)}
            className="h-8.5 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
            title="Add shortage / demanded medicine to Short Book"
          >
            <BookOpen size={13} />
            <span className="hidden sm:inline">Short Book</span>
          </button>
        )}

        {/* Pharmacy ALT Salt Finder Button */}
        {isPharmacy && onOpenAlternateModal && (
          <button
            type="button"
            onClick={() => onOpenAlternateModal(null)}
            className="h-8.5 px-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
            title="Generic Salt & Alternate Medicine Finder"
          >
            <span>💊 ALT</span>
          </button>
        )}

        {/* Live Cost Price Quick Toggle Button */}
        {onToggleCostPrice && (
          <button
            type="button"
            onClick={onToggleCostPrice}
            className={`h-8.5 px-2.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0 border ${
              showCostPrice
                ? "bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-400/30"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
            }`}
            title={showCostPrice ? "Hide Cost Price on POS" : "Show Purchase/Cost Price on POS"}
          >
            <span>💰</span>
            <span className="hidden lg:inline">{showCostPrice ? "Cost: ON" : "Cost: OFF"}</span>
          </button>
        )}
      </div>

      {/* Keyboard Quick Navigation Guide Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 text-white text-[10px] rounded-xl font-medium shadow-2xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="bg-indigo-500 text-white font-black px-1.5 py-0.5 rounded text-[8.5px] uppercase tracking-wider">Nav</span>
          <span className="text-slate-300">Use <kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded text-amber-300 font-mono text-[9px]">↑ ↓ ← →</kbd> to move</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300"><kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded text-indigo-300 font-mono text-[9px]">Space</kbd> toggle packing</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300"><kbd className="bg-slate-800 border border-slate-700 px-1 py-0.5 rounded text-emerald-300 font-mono text-[9px]">Enter</kbd> add to cart</span>
        </div>
        <span className="text-slate-400 hidden md:inline text-[9px] font-mono">Products: {filteredProducts.length}</span>
      </div>

      {/* Categories Horizontal Scroll */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1 custom-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryId("all");
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border cursor-pointer ${
              selectedCategoryId === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs font-black"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Products
          </button>
          {categories.map((cat, cIdx) => (
            <button
              type="button"
              key={`${cat.id}-${cIdx}`}
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap border cursor-pointer ${
                selectedCategoryId === cat.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs font-black"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid Container */}
      <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 pb-1 custom-scrollbar min-h-0">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mb-1 text-indigo-500" />
            <span className="text-xs font-medium">Loading catalog...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-10 px-4 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
            <div className="p-3 bg-white border border-slate-200 shadow-2xs rounded-2xl text-slate-400">
              <Search size={22} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-800">
                {searchQuery ? `No items found matching "${searchQuery}"` : "No products found in this category."}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Quickly add this item to inventory or record it in Short Book right now.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {onOpenQuickAddModal && (
                <button
                  type="button"
                  onClick={() => onOpenQuickAddModal(searchQuery)}
                  className="h-8.5 px-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} />
                  <span>{searchQuery ? `+ Add "${searchQuery.slice(0, 18)}" as New Product` : "+ Quick Add New Product"}</span>
                </button>
              )}
              {isPharmacy && onOpenQuickShortBookModal && (
                <button
                  type="button"
                  onClick={() => onOpenQuickShortBookModal(searchQuery)}
                  className="h-8.5 px-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <BookOpen size={14} />
                  <span>📝 Add to Short Book</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          paginatedProducts.map((product, idx) => {
            const options = getProductUnitOptions(product);
            const totalStock = product.current_stock;
            const isSelected = selectedGridIndex === idx;
            const minStock = product.min_stock_level ?? 10;
            const isLowStock = totalStock > 0 && totalStock <= minStock;

            const borderColors = [
              "border-t-indigo-500",
              "border-t-violet-500",
              "border-t-emerald-500",
              "border-t-amber-500",
              "border-t-sky-500",
              "border-t-pink-500",
            ];
            const borderTopColor = borderColors[idx % borderColors.length];

              return (
                <motion.div
                  whileHover={{ y: -2 }}
                  key={`${product.id}-${idx}`}
                  onClick={() => {
                    if (isSelected) {
                      if (selectedGridUnitIndex === 0) {
                        handleAddBaseUnitDirectly(product);
                      } else {
                        const opt = options[selectedGridUnitIndex - 1];
                        if (opt) handleAddProductToCart(product, opt);
                      }
                    } else {
                      handleAddBaseUnitDirectly(product);
                    }
                  }}
                  className={`group bg-white p-2.5 rounded-xl border-t-[3px] border-l border-r border-b cursor-pointer transition-all flex flex-col justify-between min-h-[125px] relative overflow-hidden select-none ${borderTopColor} ${
                    isSelected 
                      ? 'ring-2 ring-indigo-600 border-indigo-300 shadow-md bg-indigo-50/10' 
                      : 'border-slate-200/80 shadow-2xs hover:shadow-sm hover:border-slate-300 bg-slate-50/20'
                  } ${totalStock <= 0 && options.length === 0 ? 'opacity-70' : ''}`}
                >
                  {/* Visual indicator for keyboard focus */}
                  {isSelected && (
                    <div className="absolute top-1 right-1.5 text-[7.5px] bg-indigo-600 text-white font-black px-1 py-0.2 rounded flex items-center gap-0.5 shadow-2xs">
                      <span>ACTIVE</span>
                      <span className="font-mono">↵</span>
                    </div>
                  )}
                  {/* Low Stock / Reorder Level Warning */}
                  {!isSelected && isLowStock && (
                    <div className="absolute top-1 right-1.5 text-[7.5px] bg-amber-500 text-white font-black px-1 py-0.2 rounded flex items-center gap-0.5 shadow-2xs animate-pulse">
                      <span>⚠ Reorder</span>
                    </div>
                  )}
                  {!isSelected && totalStock <= 0 && (
                    <div className="absolute top-1 right-1.5 text-[7.5px] bg-rose-500 text-white font-black px-1 py-0.2 rounded flex items-center gap-0.5 shadow-2xs">
                      <span>Out</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-800 line-clamp-2 text-xs leading-snug tracking-tight mb-0.5 group-hover:text-indigo-950 transition-colors flex items-center flex-wrap gap-1">
                        {product.name}
                        {language && language !== "en" && product.translated_names?.[language] && (
                          <span className="text-[8.5px] text-violet-700 font-bold bg-violet-50 px-1 py-0.2 rounded border border-violet-100">
                            {product.translated_names[language]}
                          </span>
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1">
                        {product.code && (
                          <span className="text-[8.5px] text-slate-400 font-mono tracking-tighter bg-slate-50 border border-slate-100 rounded px-1">{product.code}</span>
                        )}
                        {product.shelf_location && (
                          <span className="text-[8px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 rounded px-1">📍 {product.shelf_location}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions (ALT & Short Book) */}
                    <div className="flex flex-col gap-1 shrink-0 z-10">
                      {isPharmacy && onOpenAlternateModal && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAlternateModal(product);
                          }}
                          className="h-5 px-1.5 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-[8px] font-black flex items-center gap-0.5 shadow-2xs cursor-pointer transition-colors"
                          title="View generic formula & in-stock alternatives"
                        >
                          <span>ALT</span>
                        </button>
                      )}

                      {/* 1-Click Short Book for Out-of-Stock Products */}
                      {isPharmacy && totalStock <= 0 && onOpenQuickShortBookModal && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenQuickShortBookModal(product.name);
                          }}
                          className="h-5 px-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[8px] font-black flex items-center gap-0.5 shadow-2xs cursor-pointer transition-colors"
                          title="Add to Short Book"
                        >
                          <span>📝 Short</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2.5">
                    {/* Stock Status Badge & Price */}
                    <div className="flex justify-between items-center text-[10px] mb-2.5 border-b border-dashed border-slate-200 pb-1.5">
                      {(() => {
                        let stockBg = "bg-emerald-50 border-emerald-100 text-emerald-700";
                        let stockDot = "bg-emerald-500 animate-pulse";
                        if (totalStock <= 0) {
                          stockBg = "bg-rose-50 border-rose-100 text-rose-700";
                          stockDot = "bg-rose-500";
                        } else if (isLowStock) {
                          stockBg = "bg-amber-50 border-amber-100 text-amber-700";
                          stockDot = "bg-amber-500 animate-pulse";
                        }
                        return (
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9.5px] font-bold ${stockBg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${stockDot}`} />
                            <span>{totalStock} {product.unit || "unit"}</span>
                          </div>
                        );
                      })()}
                      <div className="flex flex-col items-end">
                        <span className="font-black text-indigo-700 text-[11.5px] leading-tight">Rs {product.sale_price_single}</span>
                        {showCostPrice && (
                          <div className="flex items-center gap-1 text-[8.5px] font-bold text-amber-950 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/80 mt-0.5" title="Purchase/Cost Price and Markup">
                            <span>Cost: Rs {product.purchase_price_single ?? 0}</span>
                            {product.sale_price_single > (product.purchase_price_single ?? 0) ? (
                              <span className="text-emerald-700 font-black">
                                (+{Math.round(product.sale_price_single - (product.purchase_price_single ?? 0))})
                              </span>
                            ) : product.sale_price_single < (product.purchase_price_single ?? 0) ? (
                              <span className="text-rose-600 font-black">
                                (-{Math.round((product.purchase_price_single ?? 0) - product.sale_price_single)})
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Add Buttons (Pills) */}
                    <div className="mt-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                        {isSelected ? "🎁 Cycle Packings [Space]" : "Quick Add Packing"}
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-[56px] overflow-y-auto custom-scrollbar">
                        {/* Base Unit Pill */}
                        {(() => {
                          const isBaseActive = isSelected && selectedGridUnitIndex === 0;
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddBaseUnitDirectly(product);
                              }}
                              className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                isBaseActive 
                                  ? "bg-emerald-600 border-emerald-600 text-white font-black shadow-[0_0_8px_rgba(16,185,129,0.4)] scale-105" 
                                  : "bg-white hover:bg-slate-900 hover:text-white text-slate-700 border-slate-200 shadow-2xs"
                              }`}
                            >
                              <span>{product.unit || "Base"}</span>
                              {isBaseActive && <span className="text-[8px] font-bold opacity-80">↵</span>}
                            </button>
                          );
                        })()}

                        {/* Subunits Option Pills */}
                        {options.map((opt, optIdx) => {
                          const isSubActive = isSelected && selectedGridUnitIndex === (optIdx + 1);
                          return (
                            <button
                              type="button"
                              key={`${opt.id || opt.name}-${optIdx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddProductToCart(product, opt);
                              }}
                              title={showCostPrice && opt.purchase_price ? `Sale: Rs ${opt.price} | Cost: Rs ${opt.purchase_price}` : undefined}
                              className={`text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                isSubActive 
                                  ? "bg-emerald-600 border-emerald-600 text-white font-black shadow-[0_0_8px_rgba(16,185,129,0.4)] scale-105" 
                                  : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white shadow-2xs"
                              }`}
                            >
                              <span>{opt.name}</span>
                              {showCostPrice && opt.purchase_price ? (
                                <span className="text-[7.5px] opacity-75 font-mono">c:{opt.purchase_price}</span>
                              ) : null}
                              {isSubActive && <span className="text-[8px] font-bold opacity-80">↵</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && filteredProducts.length > 0 && (
        <div className="flex items-center justify-between shrink-0 px-0.5 mt-3 select-none">
          <span className="text-[10px] text-slate-400 font-semibold">
            Showing {Math.min(filteredProducts.length, (page - 1) * PAGE_SIZE + 1)}-{Math.min(filteredProducts.length, page * PAGE_SIZE)} of {filteredProducts.length} products · Page {page} of {Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedGridIndex(-1); }}
              disabled={page === 1}
              className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-all cursor-pointer"
              title="Previous Page (PageUp)"
            >
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)) }, (_, i) => i + 1)
              .filter(p => p === 1 || p === Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)) || Math.abs(p - page) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`dot-${i}`} className="text-[10px] text-slate-350 px-0.5">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPage(p as number); setSelectedGridIndex(-1); }}
                    className={`w-6 h-6 text-[10px] font-black rounded-lg transition-all cursor-pointer ${page === p ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"}`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              type="button"
              onClick={() => { setPage(p => Math.min(Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE)), p + 1)); setSelectedGridIndex(-1); }}
              disabled={page === Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))}
              className="p-1 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-all cursor-pointer"
              title="Next Page (PageDown)"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
