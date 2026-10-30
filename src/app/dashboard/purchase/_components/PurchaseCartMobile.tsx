"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartItem } from "./types";

type Props = {
  cart: CartItem[];
  onUpdateQty: (idx: number, qty: number) => void;
  onRemove: (idx: number) => void;
};

export function PurchaseCartMobile({ cart, onUpdateQty, onRemove }: Props) {
  if (cart.length === 0) return null;

  return (
    <div className="md:hidden flex flex-col gap-2.5 pb-2">
      {cart.map((item, idx) => (
        <div
          key={`${item.productId}-${item.variantId || "base"}-${idx}`}
          className="mobile-vip-card bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm text-slate-900 truncate">{item.name}</p>
              {item.packingName && (
                <p className="text-[10px] font-bold text-violet-600 mt-0.5">{item.packingName}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Cost Rs {item.purchasePrice?.toLocaleString()} · Sale Rs {item.salePrice?.toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-red-500 bg-red-50 border border-red-100"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateQty(idx, Math.max(1, item.quantity - 1))}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700"
              >
                <Minus size={14} />
              </button>
              <span className="text-sm font-black w-8 text-center">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onUpdateQty(idx, item.quantity + 1)}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-violet-100 text-violet-700"
              >
                <Plus size={14} />
              </button>
            </div>
            <p className="text-base font-black text-slate-900">
              Rs {Math.round(item.purchasePrice * item.quantity).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
