"use client";

import React from "react";
import { Plus, X, ShoppingCart, User, Layers } from "lucide-react";

export interface POSTab {
  id: string;
  tabNumber: number;
  cart: any[];
  selectedCustomerId: string;
  customerName?: string;
  discount: number;
  discountType: "percentage" | "fixed";
  taxRate: number;
  taxType: string;
  paymentMode: string;
  remarks: string;
  receivedAmount: number;
  selectedAccountId: string | null;
  tradeInItem?: any | null;
  createdAt: number;
}

interface PosTabBarProps {
  tabs: POSTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  customers: Array<{ id: string; name: string }>;
  isEditing?: boolean;
}

export const PosTabBar: React.FC<PosTabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
  customers,
  isEditing = false,
}) => {
  // Helper to resolve customer name
  const getCustomerLabel = (customerId: string) => {
    if (!customerId || customerId === "walkin") return "Walk-in";
    const found = customers.find((c) => c.id === customerId);
    return found ? found.name : "Customer";
  };

  // Helper to calculate total for a tab's cart
  const calculateTabTotal = (tab: POSTab) => {
    const rawSubtotal = (tab.cart || []).reduce((sum, item) => {
      const itPrice = Number(item.price || 0);
      const itQty = Number(item.quantity || 1);
      const itDisc = Number(item.discount || 0);
      const itDiscType = item.discountType || "percentage";
      const itemSub = itDiscType === "percentage"
        ? (itPrice * itQty) * (1 - itDisc / 100)
        : Math.max(0, (itPrice * itQty) - itDisc);
      return sum + itemSub;
    }, 0);

    const disc = Number(tab.discount || 0);
    const discType = tab.discountType || "fixed";
    const afterDisc = discType === "percentage"
      ? rawSubtotal * (1 - disc / 100)
      : Math.max(0, rawSubtotal - disc);

    const taxR = Number(tab.taxRate || 0);
    const taxT = tab.taxType || "percentage";
    const taxAmt = taxT === "flat" ? taxR : (afterDisc * taxR / 100);

    return Math.round(afterDisc + taxAmt);
  };

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0 select-none overflow-hidden">
      {/* Scrollable Tabs Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 pr-1 text-slate-400 font-black text-[10px] uppercase tracking-wider hidden sm:flex">
          <Layers size={13} className="text-indigo-400" />
          <span>Bills:</span>
        </div>

        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const itemsCount = tab.cart?.length || 0;
          const custName = getCustomerLabel(tab.selectedCustomerId);
          const tabTotal = calculateTabTotal(tab);

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all border text-xs font-semibold shrink-0 shadow-xs ${
                isActive
                  ? "bg-white text-slate-900 border-indigo-400 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-400"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-slate-600"
              }`}
              title={`Switch to Bill #${tab.tabNumber} (Alt+${idx + 1})`}
            >
              {/* Active Dot / Icon */}
              <div className="flex items-center gap-1">
                {isActive ? (
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                )}
                <span className={`font-black font-mono ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                  #{tab.tabNumber}
                </span>
              </div>

              {/* Title & Customer */}
              <div className="flex items-center gap-1.5 min-w-0 max-w-[140px] sm:max-w-[190px]">
                <span className={`truncate text-[11px] font-bold ${isActive ? "text-slate-900" : "text-slate-200"}`}>
                  {custName}
                </span>

                {/* Items & Amount Badge */}
                {itemsCount > 0 ? (
                  <span
                    className={`text-[9.5px] px-1.5 py-0.2 rounded-md font-mono font-bold shrink-0 ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {itemsCount} · Rs {tabTotal.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-400 italic shrink-0">Empty</span>
                )}
              </div>

              {/* Keyboard Shortcut Indicator on Desktop */}
              {idx < 9 && (
                <span
                  className={`text-[8px] font-mono px-1 py-0.2 rounded opacity-50 hidden md:inline shrink-0 ${
                    isActive ? "bg-slate-100 text-slate-500" : "bg-slate-900 text-slate-400"
                  }`}
                >
                  Alt+{idx + 1}
                </span>
              )}

              {/* Close Tab Button */}
              {tabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={`p-0.5 rounded-md transition-colors ${
                    isActive
                      ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      : "text-slate-500 hover:text-rose-400 hover:bg-slate-700"
                  }`}
                  title={`Close Bill #${tab.tabNumber}`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        {/* New Tab Button */}
        <button
          type="button"
          onClick={onNewTab}
          disabled={tabs.length >= 10 || isEditing}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Open New Sale Bill Tab (Shortcut: F7 or Alt+T)"
        >
          <Plus size={13} className="font-bold" />
          <span>New Bill</span>
          <span className="text-[8.5px] font-mono bg-indigo-700/60 px-1 py-0.2 rounded hidden sm:inline">
            Alt+T
          </span>
        </button>
      </div>

      {/* Right Side Stats & Shortcuts Hint */}
      <div className="hidden lg:flex items-center gap-2 shrink-0 text-slate-400 text-[10px] font-medium border-l border-slate-800 pl-3">
        <span className="text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded-md">
          {tabs.length} {tabs.length === 1 ? "Active Bill" : "Active Bills"}
        </span>
        <span className="text-slate-500 hidden xl:inline">
          Shortcuts: <kbd className="font-mono text-slate-300">Alt+1..9</kbd> switch · <kbd className="font-mono text-slate-300">Alt+T</kbd> new · <kbd className="font-mono text-slate-300">Alt+W</kbd> close
        </span>
      </div>
    </div>
  );
};
