"use client";

import React, { useState } from "react";
import { Minus, Plus, Trash2, Layers } from "lucide-react";
import type { CartItem } from "../types";
import { BatchSelectorModal } from "./BatchSelectorModal";

type PosMobileCartCardsProps = {
  cart: CartItem[];
  industryType: string | null;
  allowPriceEdit: boolean;
  updateCartQty: (index: number, newQty: number) => void;
  updateCartItemPrice: (index: number, newPrice: number) => void;
  onUpdateBatch?: (index: number, batchNumber: string | null, expiryDate: string | null, batchId?: string | null) => void;
};

export function PosMobileCartCards({
  cart,
  industryType,
  allowPriceEdit,
  updateCartQty,
  updateCartItemPrice,
  onUpdateBatch,
}: PosMobileCartCardsProps) {
  const [activeBatchIndex, setActiveBatchIndex] = useState<number | null>(null);
  const minQty = industryType === "karyana" ? 0.001 : 1;

  const isExpired = (expDate?: string | null) => {
    if (!expDate) return false;
    const d = new Date(expDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d < now;
  };

  const isNearExpiry = (expDate?: string | null) => {
    if (!expDate) return false;
    const d = new Date(expDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90;
  };

  return (
    <div className="lg:hidden space-y-2">
      {cart.map((item, idx) => {
        const lineTotal = item.price * item.quantity;
        return (
          <div
            key={`${item.productId}-${item.variantId || "base"}-${idx}`}
            className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                  {item.name}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {item.packingName ? (
                    <span className="text-[10px] font-semibold text-indigo-600">
                      {item.packingName}
                    </span>
                  ) : null}

                  {/* Batch Selector Badge */}
                  {(item.batchNumber || (item.availableBatches && item.availableBatches.length > 0) || industryType === "pharmacy") && (
                    <button
                      type="button"
                      onClick={() => setActiveBatchIndex(idx)}
                      className={`inline-flex items-center gap-1 text-[8.5px] font-bold px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                        isExpired(item.expiryDate)
                          ? "bg-red-50 text-red-700 border-red-200"
                          : isNearExpiry(item.expiryDate)
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      <Layers size={10} />
                      <span>{item.batchNumber ? `Batch: ${item.batchNumber}` : `Select Batch`}</span>
                      {item.expiryDate && <span>· {item.expiryDate}</span>}
                      <span className="underline ml-0.5">▾</span>
                    </button>
                  )}
                  {item.shelfLocation && (
                    <span className="inline-flex items-center text-[8px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60">
                      📍 {item.shelfLocation}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateCartQty(idx, 0)}
                className="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                aria-label="Remove item"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              {allowPriceEdit ? (
                <input
                  type="number"
                  step="any"
                  value={item.price}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    updateCartItemPrice(idx, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                  }}
                  className="w-20 h-8 rounded-lg border border-slate-200 px-2 text-xs font-bold text-right"
                />
              ) : (
                <span className="text-xs font-bold text-slate-600">Rs {item.price}</span>
              )}

              <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    updateCartQty(idx, Math.max(minQty, item.quantity - (industryType === "karyana" ? 0.1 : 1)))
                  }
                  className="p-1.5 rounded-md text-slate-600 hover:bg-white"
                >
                  <Minus size={12} />
                </button>
                <span className="min-w-[2rem] text-center text-xs font-black text-slate-800">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateCartQty(idx, item.quantity + (industryType === "karyana" ? 0.1 : 1))}
                  className="p-1.5 rounded-md text-slate-600 hover:bg-white"
                >
                  <Plus size={12} />
                </button>
              </div>

              <span className="text-sm font-black text-indigo-600 shrink-0">
                Rs {Math.round(lineTotal).toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}

      {/* Mobile Batch Selector Modal */}
      {activeBatchIndex !== null && cart[activeBatchIndex] && (
        <BatchSelectorModal
          isOpen={true}
          onClose={() => setActiveBatchIndex(null)}
          productName={cart[activeBatchIndex].name}
          productId={cart[activeBatchIndex].productId}
          currentBatchNumber={cart[activeBatchIndex].batchNumber || null}
          currentExpiryDate={cart[activeBatchIndex].expiryDate || null}
          availableBatches={cart[activeBatchIndex].availableBatches || []}
          onSelectBatch={(batchNumber, expiryDate, batchId) => {
            if (onUpdateBatch) {
              onUpdateBatch(activeBatchIndex, batchNumber, expiryDate, batchId);
            }
            setActiveBatchIndex(null);
          }}
        />
      )}
    </div>
  );
}
