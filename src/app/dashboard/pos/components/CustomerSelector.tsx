import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Party } from "../types";
import { toast } from "sonner";

interface CustomerSelectorProps {
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  customerSearchQuery: string;
  setCustomerSearchQuery: (query: string) => void;
  isCustomerDropdownOpen: boolean;
  setIsCustomerDropdownOpen: (open: boolean) => void;
  selectedCustomerSearchIndex: number;
  setSelectedCustomerSearchIndex: React.Dispatch<React.SetStateAction<number>>;
  customerChoices: Party[];
  customers: Party[];
  hasLoyalty: boolean;
  redeemedPoints: number;
  setRedeemedPoints: React.Dispatch<React.SetStateAction<number>>;
  setDiscount: React.Dispatch<React.SetStateAction<number>>;
  setIsCustomerModalOpen: (open: boolean) => void;
  setIsCartFocused: (focused: boolean) => void;
  t: (key: string) => string;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomerId,
  setSelectedCustomerId,
  customerSearchQuery,
  setCustomerSearchQuery,
  isCustomerDropdownOpen,
  setIsCustomerDropdownOpen,
  selectedCustomerSearchIndex,
  setSelectedCustomerSearchIndex,
  customerChoices,
  customers,
  hasLoyalty,
  redeemedPoints,
  setRedeemedPoints,
  setDiscount,
  setIsCustomerModalOpen,
  setIsCartFocused,
  t,
}) => {
  const selectedCustomer = selectedCustomerId !== "walkin" ? customers.find(c => c.id === selectedCustomerId) : null;

  return (
    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 shadow-inner">
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
          Select Customer (F2)
        </label>
        <button 
          type="button"
          onClick={() => setIsCustomerModalOpen(true)}
          className="text-[10px] font-bold text-indigo-650 hover:text-indigo-850 flex items-center gap-1 cursor-pointer"
          title="Add New Customer (Alt+N)"
        >
          <UserPlus size={11} /> Add New (Alt+N)
        </button>
      </div>
      
      <div className="relative">
        <Input 
          id="pos-customer-search-input"
          placeholder={
            selectedCustomerId === "walkin" 
              ? "Walk-in Customer" 
              : (selectedCustomer?.name || "Walk-in Customer")
          }
          value={customerSearchQuery}
          onChange={(e) => {
            setCustomerSearchQuery(e.target.value);
            setIsCustomerDropdownOpen(true);
            setSelectedCustomerSearchIndex(0);
          }}
          onFocus={() => {
            setIsCustomerDropdownOpen(true);
            setCustomerSearchQuery("");
            setSelectedCustomerSearchIndex(0);
            setIsCartFocused(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedCustomerSearchIndex(prev => (prev + 1 < customerChoices.length ? prev + 1 : prev));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedCustomerSearchIndex(prev => (prev - 1 >= 0 ? prev - 1 : prev));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const choice = customerChoices[selectedCustomerSearchIndex];
              if (choice) {
                setSelectedCustomerId(choice.id);
                setCustomerSearchQuery("");
                setIsCustomerDropdownOpen(false);
                e.currentTarget.blur();
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              setIsCustomerDropdownOpen(false);
              e.currentTarget.blur();
            }
          }}
          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 h-8.5 text-[11px] focus-visible:ring-indigo-500/20 font-bold text-slate-800"
        />
        {selectedCustomerId !== "walkin" && (
          <button
            type="button"
            onClick={() => {
              setSelectedCustomerId("walkin");
              setCustomerSearchQuery("");
              setIsCustomerDropdownOpen(false);
              setDiscount(prev => Math.max(0, prev - redeemedPoints));
              setRedeemedPoints(0);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
        
        {/* Floating Dropdown Results */}
        <AnimatePresence>
          {isCustomerDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsCustomerDropdownOpen(false)} 
              />
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-[180px] overflow-y-auto custom-scrollbar p-1"
              >
                {customerChoices.length === 0 ? (
                  <div className="py-2.5 text-center text-[11px] text-slate-400 font-medium">
                    No customers found.
                  </div>
                ) : (
                  customerChoices.map((c, cIdx) => {
                    const isChosen = selectedCustomerId === c.id;
                    const isKeyboardSelected = selectedCustomerSearchIndex === cIdx;
                    return (
                      <button
                        key={`${c.id}-${cIdx}`}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerSearchQuery("");
                          setIsCustomerDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex flex-col transition-all cursor-pointer ${
                          isKeyboardSelected
                            ? "bg-indigo-50 text-indigo-900 font-bold"
                            : isChosen
                              ? "bg-slate-50 text-slate-900 font-bold"
                              : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="flex justify-between w-full items-center">
                          <span>{c.name}</span>
                          {c.id !== "walkin" && c.current_balance !== undefined && (
                            <span className={`text-[9.5px] font-bold ${Number(c.current_balance) > 0 ? "text-amber-600" : "text-slate-400"}`}>
                              Bal: Rs {c.current_balance}
                            </span>
                          )}
                        </span>
                        {c.phone && (
                          <span className="text-[9.5px] text-slate-455 font-mono mt-0.5">{c.phone}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Loyalty Points Panel */}
      {hasLoyalty && selectedCustomerId !== "walkin" && selectedCustomer && (
        (() => {
          const points = Number(selectedCustomer.loyalty_points || 0);
          return (
            <div className="mt-2 p-2.5 bg-violet-50/50 border border-violet-100 rounded-xl flex items-center justify-between text-[11px]">
              <div>
                <p className="font-bold text-violet-950 flex items-center gap-1.5">
                  ✨ Loyalty Points: <span className="text-violet-750 font-black">{points}</span>
                </p>
                <p className="text-[10px] text-violet-600/80 mt-0.5">Value: Rs {points.toLocaleString()} discount</p>
              </div>
              {points > 0 && redeemedPoints === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const pointsToRedeem = points;
                    setRedeemedPoints(pointsToRedeem);
                    setDiscount(prev => prev + pointsToRedeem);
                    toast.success(`Redeemed ${pointsToRedeem} points as discount! 🎁`);
                  }}
                  className="px-2 py-1 bg-violet-650 hover:bg-violet-755 text-white rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                >
                  Redeem
                </button>
              )}
              {redeemedPoints > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDiscount(prev => Math.max(0, prev - redeemedPoints));
                    setRedeemedPoints(0);
                    toast.info(`Redeemed points cancelled.`);
                  }}
                  className="px-2 py-1 bg-red-650 hover:bg-red-750 text-white rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                >
                  Cancel (Rs {redeemedPoints})
                </button>
              )}
            </div>
          );
        })()
      )}


    </div>
  );
};
