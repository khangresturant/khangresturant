import React, { useState } from "react";
import { ShoppingCart, Trash2, CreditCard, DollarSign, AlertTriangle, Loader2, Minus, Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartItem, Party, DBProduct } from "../types";
import { CustomerSelector } from "./CustomerSelector";
import { BatchSelectorModal } from "./BatchSelectorModal";
import { toast } from "sonner";
import { useShop } from "@/context/ShopContext";

interface CartSidebarProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  subtotal: number;
  discount: number;
  setDiscount: React.Dispatch<React.SetStateAction<number>>;
  taxRate: number;
  setTaxRate: React.Dispatch<React.SetStateAction<number>>;
  taxAmount: number;
  total: number;
  paymentMode: string;
  setPaymentMode: (mode: string) => void;
  receivedAmount: number;
  setReceivedAmount: (amt: number) => void;
  accounts: any[];
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  appliedGiftCardAmount: number;
  giftCardInput: string;
  setGiftCardInput: (code: string) => void;
  isVerifyingGiftCard: boolean;
  handleVerifyGiftCard: () => void;
  handleHoldCart: () => void;
  handlePrintQuotation: () => void;
  handleCheckout: () => void;
  isSubmitting: boolean;
  activeClosingBook: any;
  heldCarts: any[];
  setIsHeldModalOpen: (open: boolean) => void;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  customers: Party[];
  t: (key: string) => string;
  permissions: any;
  redeemedPoints: number;
  setRedeemedPoints: React.Dispatch<React.SetStateAction<number>>;
  customerSearchQuery: string;
  setCustomerSearchQuery: (query: string) => void;
  isCustomerDropdownOpen: boolean;
  setIsCustomerDropdownOpen: (open: boolean) => void;
  selectedCustomerSearchIndex: number;
  setSelectedCustomerSearchIndex: React.Dispatch<React.SetStateAction<number>>;
  customerChoices: Party[];
  hasLoyalty: boolean;
  setIsCustomerModalOpen: (open: boolean) => void;
  setIsCartFocused: (focused: boolean) => void;
  allowPriceEdit: boolean;
  showMobileCart?: boolean;
  onCloseMobileCart?: () => void;
  onOpenAlternateModal?: (cartItem: CartItem, index: number) => void;
  products?: DBProduct[];
  getProductUnitOptions?: (product: DBProduct) => any[];
  onCartItemUnitChange?: (index: number, value: string) => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  cart,
  setCart,
  subtotal,
  discount,
  setDiscount,
  taxRate,
  setTaxRate,
  taxAmount,
  total,
  paymentMode,
  setPaymentMode,
  receivedAmount,
  setReceivedAmount,
  accounts,
  selectedAccountId,
  setSelectedAccountId,
  appliedGiftCardAmount,
  giftCardInput,
  setGiftCardInput,
  isVerifyingGiftCard,
  handleVerifyGiftCard,
  handleHoldCart,
  handlePrintQuotation,
  handleCheckout,
  isSubmitting,
  activeClosingBook,
  heldCarts,
  setIsHeldModalOpen,
  selectedCustomerId,
  setSelectedCustomerId,
  customers,
  t,
  permissions,
  redeemedPoints,
  setRedeemedPoints,
  customerSearchQuery,
  setCustomerSearchQuery,
  isCustomerDropdownOpen,
  setIsCustomerDropdownOpen,
  selectedCustomerSearchIndex,
  setSelectedCustomerSearchIndex,
  customerChoices,
  hasLoyalty,
  setIsCustomerModalOpen,
  setIsCartFocused,
  allowPriceEdit,
  showMobileCart = false,
  onCloseMobileCart,
  onOpenAlternateModal,
  products = [],
  getProductUnitOptions,
  onCartItemUnitChange,
}) => {
  const { hasGiftCards, hasTax, industryType, showCostPriceOnPos } = useShop();
  const [batchModalItemIndex, setBatchModalItemIndex] = useState<number | null>(null);

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

  const selectedCustomer = selectedCustomerId !== "walkin" ? customers.find(c => c.id === selectedCustomerId) : null;

  return (
    <div className={`
      lg:col-span-5 xl:col-span-4 flex flex-col bg-white border border-slate-200/80 shadow-sm rounded-2xl p-4 overflow-y-auto custom-scrollbar h-full min-h-0
      ${ showMobileCart
        ? "fixed inset-0 z-[150] rounded-none border-0 shadow-2xl p-4 flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto bg-white lg:relative lg:inset-auto lg:z-auto lg:rounded-2xl lg:border lg:pb-4"
        : "hidden lg:flex"
      }
    `}>
      {/* Mobile Close Button */}
      {showMobileCart && onCloseMobileCart && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0 lg:hidden">
          <button
            type="button"
            onClick={onCloseMobileCart}
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold text-sm transition-colors cursor-pointer"
          >
            <span className="text-lg">←</span> Back to Products
          </button>
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            {cart.length} items · Rs {cart.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center mb-3 shrink-0">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <ShoppingCart size={15} /> Checkout Cart
        </h3>
        <div className="flex items-center gap-1.5">
          {cart.length > 0 && (
            <button 
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to empty the cart?")) {
                  setCart([]);
                  setDiscount(prev => Math.max(0, prev - redeemedPoints));
                  setRedeemedPoints(0);
                }
              }}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer shadow-2xs"
              title="Clear Cart"
            >
              <Trash2 size={12} />
            </button>
          )}
          <span className="bg-indigo-600 text-white text-[8.5px] font-black px-1.5 py-0.5 rounded shadow-2xs">
            {cart.length} Items
          </span>
        </div>
      </div>

      {/* Customer Selector */}
      <div className="mb-2 shrink-0">
        <CustomerSelector 
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          customerSearchQuery={customerSearchQuery}
          setCustomerSearchQuery={setCustomerSearchQuery}
          isCustomerDropdownOpen={isCustomerDropdownOpen}
          setIsCustomerDropdownOpen={setIsCustomerDropdownOpen}
          selectedCustomerSearchIndex={selectedCustomerSearchIndex}
          setSelectedCustomerSearchIndex={setSelectedCustomerSearchIndex}
          customerChoices={customerChoices}
          customers={customers}
          hasLoyalty={hasLoyalty}
          redeemedPoints={redeemedPoints}
          setRedeemedPoints={setRedeemedPoints}
          setDiscount={setDiscount}
          setIsCustomerModalOpen={setIsCustomerModalOpen}
          setIsCartFocused={setIsCartFocused}
          t={t}
        />
      </div>

      {/* Cart Items List */}
      <div className="min-h-[120px] flex-1 overflow-y-auto p-1.5 space-y-1.5 custom-scrollbar border border-slate-200 rounded-xl mb-2 bg-slate-50/40">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-4">
            <ShoppingCart size={20} className="text-slate-300 mb-1" />
            <p className="text-[10px] font-bold text-slate-600">Checkout cart is empty</p>
            <p className="text-[8.5px] text-slate-400 mt-0.5">Select products or scan barcodes</p>
          </div>
        ) : (
          cart.map((item, idx) => {
            const totalCost = (() => {
              const discVal = item.discount || 0;
              const gross = item.price * item.quantity;
              return Math.max(0, item.discountType === "percentage" ? gross - (gross * discVal) / 100 : gross - discVal);
            })();

            return (
              <div key={idx} className="flex flex-col gap-2.5 bg-slate-50/55 p-2.5 border border-slate-200 rounded-xl relative overflow-hidden">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-slate-850 text-[11px] leading-snug">{item.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {/* Pharmacy Interactive Packing Dropdown */}
                      {industryType === "pharmacy" && onCartItemUnitChange && getProductUnitOptions && products ? (() => {
                        const prod = products.find(p => p.id === item.productId);
                        if (!prod) return item.packingName ? (
                          <span className="inline-block bg-indigo-50 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                            {item.packingName}
                          </span>
                        ) : null;
                        const options = getProductUnitOptions(prod);
                        const selectedVal = item.variantId || (item.packingName ? (options.find(o => o.name === item.packingName)?.id || "base") : "base");
                        return (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-[7.5px] font-black text-violet-700 uppercase">📦</span>
                            <select
                              value={selectedVal}
                              onChange={(e) => onCartItemUnitChange(idx, e.target.value)}
                              className="text-[8.5px] font-extrabold bg-violet-50 text-violet-900 border border-violet-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer shadow-2xs h-5 hover:bg-violet-100 transition-colors"
                              title="Change medicine packing (Loose Tablet / Leaf / Strip / Box)"
                            >
                              <option value="base">{prod.unit || "Base"} (Rs {prod.sale_price_single})</option>
                              {options.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name} (Rs {opt.price})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })() : (
                        item.packingName && (
                          <span className="inline-block bg-indigo-50 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                            {item.packingName}
                          </span>
                        )
                      )}

                      {/* One-Time Arranged Item Badge */}
                      {item.isCustomItem && (
                        <span className="inline-block bg-amber-50 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wide">
                          ⚡ Arranged Item
                        </span>
                      )}

                      {/* Batch Chip with Quick Override */}
                      {(item.batchNumber || (item.availableBatches && item.availableBatches.length > 0) || industryType === "pharmacy") && (
                        <button
                          type="button"
                          onClick={() => setBatchModalItemIndex(idx)}
                          className={`inline-flex items-center gap-1 text-[8.5px] font-bold px-1.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                            isExpired(item.expiryDate)
                              ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 animate-pulse"
                              : isNearExpiry(item.expiryDate)
                              ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          }`}
                          title="Click to view or switch batch (FEFO)"
                        >
                          <span>
                            {item.batchNumber ? (
                              <>Batch: <strong className="font-mono">{item.batchNumber}</strong></>
                            ) : (
                              <span className="font-sans font-bold">Select Batch</span>
                            )}
                          </span>
                          {item.expiryDate && (
                            <span className="opacity-80 font-mono">
                              · Exp: {item.expiryDate}
                            </span>
                          )}
                          <span className="underline ml-0.5 text-indigo-700 font-sans font-black">
                            Change ▾
                          </span>
                        </button>
                      )}
                      {item.shelfLocation && (
                        <span className="inline-flex items-center text-[8px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60">
                          📍 {item.shelfLocation}
                        </span>
                      )}

                      {/* Pharmacy Generic Substitute Swap Button */}
                      {industryType === "pharmacy" && onOpenAlternateModal && (
                        <button
                          type="button"
                          onClick={() => onOpenAlternateModal(item, idx)}
                          className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors cursor-pointer"
                          title="Swap or find generic substitute"
                        >
                          <span>ALT</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCart(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="p-1 hover:bg-red-55 hover:text-red-500 text-slate-400 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Remove Item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {allowPriceEdit ? (
                  /* Editable input fields for Price, Qty, Discount */
                  <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-dashed border-slate-200">
                    {/* Price/Rate */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[7.5px] font-black text-indigo-500 uppercase tracking-wide">Rate</span>
                      <input
                        id={`sb-rate-${idx}`}
                        type="number"
                        step="1"
                        value={Math.round(item.price)}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          const val = isNaN(parsed) ? 0 : Math.max(0, parsed);
                          const updated = [...cart];
                          updated[idx].price = val;
                          setCart(updated);
                        }}
                        onFocus={(e) => { e.target.select(); setIsCartFocused(true); }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                            const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                            if (next >= 0 && next < cart.length) {
                              document.getElementById(`sb-rate-${next}`)?.focus();
                            }
                          } else if (e.key === "ArrowRight") {
                            e.preventDefault();
                            document.getElementById(`sb-qty-${idx}`)?.focus();
                          }
                        }}
                        className="no-spin w-full h-6 bg-white border border-indigo-200 rounded px-1.5 text-[10px] font-black focus:outline-none focus:border-indigo-500 text-slate-800 text-right"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[7.5px] font-black text-purple-500 uppercase tracking-wide">Qty</span>
                      <input
                        id={`sb-qty-${idx}`}
                        type="number"
                        step="1"
                        value={item.quantity}
                        min={1}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          if (!isNaN(parsed) && parsed > 0) {
                            const updated = [...cart];
                            updated[idx].quantity = parsed;
                            setCart(updated);
                          }
                        }}
                        onFocus={(e) => { e.target.select(); setIsCartFocused(true); }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                            const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                            if (next >= 0 && next < cart.length) {
                              document.getElementById(`sb-qty-${next}`)?.focus();
                            }
                          } else if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            document.getElementById(`sb-rate-${idx}`)?.focus();
                          } else if (e.key === "ArrowRight") {
                            e.preventDefault();
                            document.getElementById(`sb-discount-${idx}`)?.focus();
                          }
                        }}
                        className="no-spin w-full h-6 bg-white border border-purple-200 rounded px-1 text-[10px] font-black focus:outline-none focus:border-purple-500 text-slate-800 text-center"
                      />
                    </div>

                    {/* Discount */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[7.5px] font-black text-rose-500 uppercase tracking-wide">Disc</span>
                      <div className="flex items-center gap-0.5">
                        <input
                          id={`sb-discount-${idx}`}
                          type="number"
                          step="any"
                          value={item.discount || 0}
                          min={0}
                          onChange={(e) => {
                            const parsed = parseFloat(e.target.value);
                            const updated = [...cart];
                            updated[idx].discount = isNaN(parsed) ? 0 : Math.max(0, parsed);
                            setCart(updated);
                          }}
                          onFocus={(e) => { e.target.select(); setIsCartFocused(true); }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                              e.preventDefault();
                              const next = idx + (e.key === "ArrowDown" ? 1 : -1);
                              if (next >= 0 && next < cart.length) {
                                document.getElementById(`sb-discount-${next}`)?.focus();
                              }
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              document.getElementById(`sb-qty-${idx}`)?.focus();
                            }
                          }}
                          className="no-spin w-full h-6 bg-white border border-rose-200 rounded px-1 text-[10px] font-black focus:outline-none focus:border-rose-550 text-slate-800 text-center"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...cart];
                            updated[idx].discountType = item.discountType === "percentage" ? "fixed" : "percentage";
                            setCart(updated);
                          }}
                          className={"h-6 px-1 rounded border text-[8px] font-black transition-all cursor-pointer " + 
                            (item.discountType === "percentage"
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-amber-50 border-amber-250 text-amber-800")
                          }
                        >
                          {item.discountType === "percentage" ? "%" : "Rs"}
                        </button>
                      </div>
                    </div>

                    {/* Row Total */}
                    <div className="flex flex-col gap-0.5 items-end justify-end">
                      <span className="text-[7.5px] font-black text-emerald-600 uppercase tracking-wide">Total</span>
                      <span className="font-extrabold text-slate-800 text-[10.5px] h-6 flex items-center pr-0.5 font-mono">
                        Rs {Math.round(totalCost)}
                      </span>
                    </div>

                    {/* Cost Price & Profit Indicator Row */}
                    {showCostPriceOnPos && (
                      <div className="col-span-4 flex items-center justify-between text-[8.5px] bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-md text-amber-950 font-bold mt-0.5">
                        <span>Cost: <strong className="font-mono">Rs {item.purchasePrice || 0}</strong></span>
                        {item.price > (item.purchasePrice || 0) ? (
                          <span className="text-emerald-700 font-extrabold">
                            Margin: +Rs {Math.round(item.price - (item.purchasePrice || 0))} ({Math.round(((item.price - (item.purchasePrice || 0)) / (item.purchasePrice || 1)) * 100)}%)
                          </span>
                        ) : item.price < (item.purchasePrice || 0) ? (
                          <span className="text-rose-600 font-black animate-pulse">
                            🚨 Below Cost (-Rs {Math.round((item.purchasePrice || 0) - item.price)})
                          </span>
                        ) : (
                          <span className="text-slate-600">At Cost</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard display with fast increment/decrement quantity buttons */
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-slate-150/60 mt-0.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...cart];
                            updated[idx].quantity = Math.max(1, item.quantity - 1);
                            setCart(updated);
                          }}
                          className="p-0.5 text-slate-500 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="font-black text-slate-800 px-1 text-[10.5px] font-mono leading-none">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...cart];
                            updated[idx].quantity = item.quantity + 1;
                            setCart(updated);
                          }}
                          className="p-0.5 text-slate-500 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-550 font-semibold font-mono">
                          {item.price > 0 && "@ Rs " + item.price + " = "}
                          <span className="font-black text-slate-850 text-xs">Rs {Math.round(totalCost)}</span>
                        </span>
                        {showCostPriceOnPos && (
                          <span className="text-[8px] text-amber-900 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-bold">
                            Cost: Rs {item.purchasePrice || 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Selected Customer Card Details */}
      {selectedCustomerId !== "walkin" && selectedCustomer && (
        <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[10px] text-slate-700 relative overflow-hidden shadow-xs mb-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900">{selectedCustomer.name}</span>
            <span className={`px-2 py-0.5 rounded-full font-black text-[9px] border uppercase ${
              selectedCustomer.type === "dual" 
                ? "bg-purple-50 text-purple-700 border-purple-100" 
                : "bg-blue-50 text-blue-700 border-blue-100"
            }`}>
              {selectedCustomer.type === "dual" ? "Dual (Both)" : "Customer"}
            </span>
          </div>
          
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 mt-1">
            <span className="text-slate-400 font-bold">Khata Balance:</span>
            <span className={`font-black font-mono ${
              selectedCustomer.current_balance > 0 
                ? "text-rose-600" 
                : selectedCustomer.current_balance < 0 
                  ? "text-emerald-600" 
                  : "text-slate-500"
            }`}>
              {selectedCustomer.current_balance > 0 
                ? `Rs ${selectedCustomer.current_balance.toLocaleString()} (Receivable)` 
                : selectedCustomer.current_balance < 0 
                  ? `Rs ${Math.abs(selectedCustomer.current_balance).toLocaleString()} (Payable)` 
                  : "Rs 0 (Settled)"
              }
            </span>
          </div>

          {selectedCustomer.credit_limit !== undefined && selectedCustomer.credit_limit !== null && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
              <span className="text-slate-400 font-bold">Credit Limit:</span>
              <span className="font-extrabold text-indigo-600 font-mono">
                Rs {selectedCustomer.credit_limit.toLocaleString()}
              </span>
            </div>
          )}

          {selectedCustomer.credit_limit !== undefined && selectedCustomer.credit_limit !== null && selectedCustomer.current_balance > selectedCustomer.credit_limit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-1.5 text-[9px] text-red-600 font-extrabold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle size={12} className="text-red-500 shrink-0" />
              <span>Credit Limit Exceeded!</span>
            </div>
          )}
        </div>
      )}

      {/* Discount & Tax */}
      <div className={`grid ${hasTax ? "grid-cols-2" : "grid-cols-1"} gap-2.5`}>
        <div>
          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Discount (Rs) (F4)</label>
          <Input 
            id="pos-discount-input"
            type="number" 
            placeholder="0" 
            value={discount || ""} 
            onChange={(e) => {
              const newDiscount = Math.max(0, parseFloat(e.target.value) || 0);
              if (subtotal > 0 && newDiscount >= subtotal) {
                toast.error("100% discount is not allowed!", {
                  description: "100% or greater discount is not allowed."
                });
                setDiscount(0);
                return;
              }

              if (subtotal > 0) {
                const pct = (newDiscount / subtotal) * 100;
                const maxPct = permissions?.max_discount_percentage ?? 100;
                if (pct > maxPct) {
                  const maxAllowedDiscount = Math.floor((subtotal * maxPct) / 100);
                  toast.error(`Discount limit exceeded! Maximum allowed discount is ${maxPct}% (Rs ${maxAllowedDiscount}).`, {
                    description: `Maximum allowed discount is ${maxPct}% for your profile.`
                  });
                  setDiscount(maxAllowedDiscount);
                  return;
                }
              }

              if (newDiscount > 0 && cart.length > 0) {
                const rawSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
                const totalPurchaseCost = cart.reduce((acc, item) => acc + item.purchasePrice * item.quantity, 0);
                const effectiveTotal = Math.max(0, rawSubtotal + (rawSubtotal * taxRate) / 100 - newDiscount);
                if (totalPurchaseCost > 0 && effectiveTotal < totalPurchaseCost) {
                  toast.error("Selling at a loss is not allowed!", {
                    description: "Selling price after discount cannot fall below procurement cost."
                  });
                  setDiscount(0);
                  return;
                }
              }

              setDiscount(newDiscount);
            }}
            className="h-8 bg-slate-50 border-slate-200 text-slate-800 text-xs rounded-xl focus-visible:ring-indigo-500/20 font-bold"
          />
        </div>
        {hasTax && (
          <div>
            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sales Tax (%) (F7)</label>
            <Input 
              id="pos-tax-input"
              type="number" 
              placeholder="0" 
              value={taxRate || ""} 
              onChange={(e) => setTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-8 bg-slate-50 border-slate-200 text-slate-800 text-xs rounded-xl focus-visible:ring-indigo-500/20 font-bold"
            />
          </div>
        )}
      </div>

      {/* Gift Card Coupon */}
      {hasGiftCards && (
        <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Gift Card / Coupon</label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter Code (e.g. GIFT-XYZ)"
              value={giftCardInput}
              onChange={(e) => setGiftCardInput(e.target.value.toUpperCase())}
              className="h-8 bg-slate-50 border-slate-200 text-slate-800 text-xs rounded-xl focus-visible:ring-indigo-500/20 font-bold flex-1"
            />
            <button
              type="button"
              onClick={handleVerifyGiftCard}
              disabled={isVerifyingGiftCard || !giftCardInput}
              className="px-3 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-white rounded-xl text-[10px] font-black tracking-wide cursor-pointer"
            >
              {isVerifyingGiftCard ? <Loader2 size={12} className="animate-spin" /> : "Apply"}
            </button>
          </div>
        </div>
      )}

      {/* Payment Modes */}
      <div className="mt-3.5 select-none shrink-0">
        <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method (F8)</label>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: "cash", label: "Cash", icon: <DollarSign size={12} /> },
            { id: "bank", label: "Bank / Card", icon: <CreditCard size={12} /> },
            { id: "credit", label: "Credit Ledger", icon: <AlertTriangle size={12} /> },
            { id: "quotation", label: "Estimate", icon: <Loader2 size={12} /> }
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                if (mode.id === "credit" && selectedCustomerId === "walkin") {
                  toast.error("Customer selection is required for Credit Ledger!", {
                    description: "Select a customer to post an unpaid ledger balance."
                  });
                  return;
                }
                setPaymentMode(mode.id);
              }}
              className={`flex flex-col items-center justify-center py-2 border rounded-xl gap-1 text-[9px] font-bold transition-all cursor-pointer ${
                paymentMode === mode.id 
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Deposit cash account details */}
      {(paymentMode !== "credit" || receivedAmount > 0) && accounts.length > 0 && (
        <div className="mt-2 select-none shrink-0">
          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Deposit payment to</label>
          <select 
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
            className="w-full h-8 px-2.5 bg-slate-55 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-700 cursor-pointer"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} (Rs {Number(acc.current_balance).toLocaleString()})</option>
            ))}
          </select>
        </div>
      )}

      {/* Pricing Totals */}
      <div className="border-t border-slate-200 pt-2.5 mt-3.5 space-y-1 text-[11px] shrink-0">
        <div className="flex justify-between text-slate-500">
          <span>Subtotal:</span>
          <span className="font-semibold text-slate-700">Rs {Math.round(subtotal * 100) / 100}</span>
        </div>
        {taxRate > 0 && (
          <div className="flex justify-between text-slate-500">
            <span>Tax ({taxRate}%):</span>
            <span className="font-semibold text-slate-700">Rs {Math.round(taxAmount * 100) / 100}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-red-655 font-bold">
            <span>Discount:</span>
            <span>-Rs {discount}</span>
          </div>
        )}
        {appliedGiftCardAmount > 0 && (
          <div className="flex justify-between text-emerald-655 font-bold">
            <span>Gift Card:</span>
            <span>-Rs {appliedGiftCardAmount}</span>
          </div>
        )}
        <div className="flex justify-between font-black text-slate-900 text-xs border-t border-slate-100 pt-2">
          <span>Grand Total:</span>
          <span className="text-indigo-650 text-sm font-black font-mono">Rs {Math.round(total * 100) / 100}</span>
        </div>

        {/* Live Bill-level Cost & Estimated Margin (Visible when showCostPriceOnPos is active) */}
        {showCostPriceOnPos && cart.length > 0 && (() => {
          const totalCartCost = cart.reduce((sum, item) => sum + ((item.purchasePrice || 0) * item.quantity), 0);
          const netProfit = total - totalCartCost;
          const marginPercent = totalCartCost > 0 ? Math.round((netProfit / totalCartCost) * 100) : 0;
          return (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/90 rounded-xl p-2 mt-2 flex items-center justify-between text-[9.5px] font-black text-amber-950 shadow-2xs">
              <div className="flex items-center gap-1">
                <span className="text-amber-800">💰 Cost:</span>
                <span className="font-mono">Rs {Math.round(totalCartCost)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Profit:</span>
                <span className={netProfit >= 0 ? "text-emerald-700 font-mono" : "text-rose-600 font-mono animate-pulse"}>
                  {netProfit >= 0 ? `+Rs ${Math.round(netProfit)}` : `-Rs ${Math.round(Math.abs(netProfit))}`}
                  <span className="text-[8px] opacity-80 font-sans ml-0.5">({marginPercent}%)</span>
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Secondary Actions: Hold / Resume */}
      <div className="grid grid-cols-3 gap-1.5 mt-3 select-none shrink-0">
        <button
          type="button"
          onClick={handleHoldCart}
          disabled={cart.length === 0}
          className="py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
          title="Hold active sale (F6)"
        >
          Hold (F6)
        </button>
        <button
          type="button"
          onClick={() => setIsHeldModalOpen(true)}
          className="py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm relative cursor-pointer"
          title="View held sales (Alt+R)"
        >
          Resume (Alt+R)
          {heldCarts.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-4.5 h-4.5 text-[8px] flex items-center justify-center font-bold animate-pulse">
              {heldCarts.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handlePrintQuotation}
          disabled={cart.length === 0}
          className="py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-lg text-[9px] font-black border border-slate-200 transition-all flex items-center justify-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
          title="Download Quotation PDF estimate (F5)"
        >
          Quotation (F5)
        </button>
      </div>

      {/* Submit Button */}
      <Button 
        onClick={handleCheckout}
        disabled={isSubmitting || cart.length === 0 || !!activeClosingBook}
        className={`w-full font-black h-9.5 rounded-lg shadow-lg mt-3 shrink-0 text-xs transition-colors cursor-pointer ${
          paymentMode === "quotation"
            ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/15"
            : "bg-indigo-600 hover:bg-indigo-755 text-white shadow-indigo-500/15"
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Processing Checkout...
          </>
        ) : paymentMode === "quotation" ? (
          "Save Estimate Quotation (F5 / F9)"
        ) : (
          "Complete POS Sale (F9)"
        )}
      </Button>

      {/* Batch Selector Modal */}
      {batchModalItemIndex !== null && cart[batchModalItemIndex] && (() => {
        const item = cart[batchModalItemIndex];
        return (
          <BatchSelectorModal
            isOpen={true}
            onClose={() => setBatchModalItemIndex(null)}
            productName={item.name}
            productId={item.productId}
            packingName={item.packingName}
            currentBatchNumber={item.batchNumber || null}
            currentExpiryDate={item.expiryDate || null}
            availableBatches={item.availableBatches || []}
            onSelectBatch={(batchNumber, expiryDate, batchId) => {
              setCart(prev => {
                const updated = [...prev];
                if (updated[batchModalItemIndex]) {
                  updated[batchModalItemIndex] = {
                    ...updated[batchModalItemIndex],
                    batchNumber,
                    expiryDate,
                    batchId: batchId || null,
                  };
                }
                return updated;
              });
              toast.info(`Switched to Batch ${batchNumber || "FEFO"} (Exp: ${expiryDate || "N/A"})`);
              setBatchModalItemIndex(null);
            }}
          />
        );
      })()}
    </div>
  );
};
