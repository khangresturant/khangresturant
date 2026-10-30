"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";

type WarehouseRow = {
  id: string;
  name: string;
  location: string | null;
  created_at: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  current_stock: number;
};

type StockRow = {
  id: string;
  product_id: string | null;
  warehouse_id: string | null;
  quantity_single: number | null;
};

type TransferLog = {
  id: string;
  created_at: string | null;
  notes: string | null;
  products?: { name: string } | { name: string }[] | null;
};

const DEFAULT_WAREHOUSES = [
  { name: "Main Store", location: "Shop floor" },
  { name: "Back Store", location: "Storage / godown" },
];

export default function StockTransferPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [transferLogs, setTransferLogs] = useState<TransferLog[]>([]);

  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [addingWarehouse, setAddingWarehouse] = useState(false);

  const primaryWarehouseId = warehouses[0]?.id ?? "";

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.name })),
    [warehouses]
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name}${p.code ? ` (${p.code})` : ""}`,
      })),
    [products]
  );

  const getAvailableAtWarehouse = useCallback(
    (pid: string, warehouseId: string): number => {
      const product = productMap.get(pid);
      if (!product || !warehouseId) return 0;

      const rowsForProduct = stockRows.filter((r) => r.product_id === pid);
      const allocated = rowsForProduct.reduce(
        (sum, r) => sum + (r.quantity_single ?? 0),
        0
      );
      const rowQty =
        rowsForProduct.find((r) => r.warehouse_id === warehouseId)
          ?.quantity_single ?? 0;

      if (rowsForProduct.length === 0) {
        return warehouseId === primaryWarehouseId
          ? product.current_stock ?? 0
          : 0;
      }

      if (warehouseId === primaryWarehouseId) {
        const unallocated = Math.max(0, (product.current_stock ?? 0) - allocated);
        return rowQty + unallocated;
      }

      return rowQty;
    },
    [productMap, primaryWarehouseId, stockRows]
  );

  const availableQty = productId && fromWarehouseId
    ? getAvailableAtWarehouse(productId, fromWarehouseId)
    : 0;

  const ensureDefaultWarehouses = async (): Promise<WarehouseRow[]> => {
    const { data: existing, error } = await supabase
      .from("warehouses")
      .select("id, name, location, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if ((existing?.length ?? 0) >= 2) return existing ?? [];

    const existingNames = new Set(
      (existing ?? []).map((w: WarehouseRow) => w.name.toLowerCase())
    );
    const toInsert = DEFAULT_WAREHOUSES.filter(
      (w) => !existingNames.has(w.name.toLowerCase())
    )
      .slice(0, Math.max(0, 2 - (existing?.length ?? 0)))
      .map((w) => ({
        shop_id: shopId,
        name: w.name,
        location: w.location,
      }));

    let created: WarehouseRow[] = [];
    if (toInsert.length > 0) {
      const { data, error: insertError } = await supabase
        .from("warehouses")
        .insert(toInsert)
        .select("id, name, location, created_at");

      if (insertError) throw insertError;
      created = data ?? [];
    }

    const merged = [...(existing ?? []), ...created];
    return merged.sort(
      (a, b) =>
        new Date(a.created_at ?? 0).getTime() -
        new Date(b.created_at ?? 0).getTime()
    );
  };

  const loadData = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const wh = await ensureDefaultWarehouses();
      setWarehouses(wh);

      const [productsRes, stockRes, logsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, code, unit, current_stock")
          .eq("shop_id", shopId)
          .order("name"),
        supabase
          .from("stock")
          .select("id, product_id, warehouse_id, quantity_single")
          .eq("shop_id", shopId),
        supabase
          .from("stock_adjustments")
          .select("id, created_at, notes, products(name)")
          .eq("shop_id", shopId)
          .eq("reason", "transfer")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (stockRes.error) throw stockRes.error;
      if (logsRes.error) throw logsRes.error;

      setProducts(productsRes.data ?? []);
      setStockRows(stockRes.data ?? []);
      setTransferLogs(logsRes.data ?? []);

      if (wh.length >= 2) {
        setFromWarehouseId((prev) => prev || wh[0].id);
        setToWarehouseId((prev) => prev || wh[1].id);
      } else if (wh.length === 1) {
        setFromWarehouseId(wh[0].id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to load stock transfer data: " + message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shopId) loadData();
  }, [shopId]);

  const swapWarehouses = () => {
    setFromWarehouseId(toWarehouseId);
    setToWarehouseId(fromWarehouseId);
  };

  const upsertStockRow = async (
    pid: string,
    warehouseId: string,
    newQty: number
  ) => {
    const existing = stockRows.find(
      (r) => r.product_id === pid && r.warehouse_id === warehouseId
    );

    if (newQty <= 0) {
      if (existing) {
        const { error } = await supabase
          .from("stock")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      }
      return;
    }

    if (existing) {
      const { error } = await supabase
        .from("stock")
        .update({ quantity_single: newQty })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("stock").insert({
        shop_id: shopId,
        product_id: pid,
        warehouse_id: warehouseId,
        quantity_single: newQty,
        quantity_pack: 0,
      });
      if (error) throw error;
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;

    if (!fromWarehouseId || !toWarehouseId) {
      toast.error("Select both source and destination locations.");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      toast.error("Source and destination must be different.");
      return;
    }
    if (!productId) {
      toast.error("Select a product to transfer.");
      return;
    }
    if (quantity <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }

    const avail = getAvailableAtWarehouse(productId, fromWarehouseId);
    if (quantity > avail) {
      toast.error(`Only ${avail} units available at the source location.`);
      return;
    }

    const fromName =
      warehouses.find((w) => w.id === fromWarehouseId)?.name ?? "Source";
    const toName =
      warehouses.find((w) => w.id === toWarehouseId)?.name ?? "Destination";

    setSubmitting(true);
    try {
      const rowsForProduct = stockRows.filter((r) => r.product_id === productId);
      const fromRow = rowsForProduct.find(
        (r) => r.warehouse_id === fromWarehouseId
      );
      const toRow = rowsForProduct.find((r) => r.warehouse_id === toWarehouseId);

      const product = productMap.get(productId);
      const allocated = rowsForProduct.reduce(
        (sum, r) => sum + (r.quantity_single ?? 0),
        0
      );
      const unallocated = Math.max(
        0,
        (product?.current_stock ?? 0) - allocated
      );

      let fromNewQty: number;
      if (fromWarehouseId === primaryWarehouseId) {
        const rowQty = fromRow?.quantity_single ?? 0;
        const takeFromUnallocated = Math.min(quantity, unallocated);
        const takeFromRow = quantity - takeFromUnallocated;
        fromNewQty = rowQty - takeFromRow;
      } else {
        fromNewQty = (fromRow?.quantity_single ?? 0) - quantity;
      }

      const toNewQty = (toRow?.quantity_single ?? 0) + quantity;

      await upsertStockRow(productId, fromWarehouseId, fromNewQty);
      await upsertStockRow(productId, toWarehouseId, toNewQty);

      const logNotes = [
        `Transferred ${quantity} unit(s) from "${fromName}" to "${toName}".`,
        notes.trim() || null,
      ]
        .filter(Boolean)
        .join(" ");

      const { error: logError } = await supabase.from("stock_adjustments").insert({
        shop_id: shopId,
        product_id: productId,
        quantity: 0,
        reason: "transfer",
        notes: logNotes,
      });
      if (logError) throw logError;

      toast.success("Stock transferred successfully.");
      setQuantity(0);
      setNotes("");
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Transfer failed: " + message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddWarehouse = async () => {
    const name = newWarehouseName.trim();
    if (!name) {
      toast.error("Enter a location name.");
      return;
    }
    if (warehouses.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A location with this name already exists.");
      return;
    }

    setAddingWarehouse(true);
    try {
      const { error } = await supabase.from("warehouses").insert({
        shop_id: shopId,
        name,
        location: null,
      });
      if (error) throw error;
      toast.success(`Location "${name}" added.`);
      setNewWarehouseName("");
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Could not add location: " + message);
    } finally {
      setAddingWarehouse(false);
    }
  };

  const formatLogProduct = (log: TransferLog) => {
    const p = log.products;
    if (!p) return "—";
    if (Array.isArray(p)) return p[0]?.name ?? "—";
    return p.name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-slate-800">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2.5 bg-gradient-to-br from-rose-500 to-orange-500 rounded-2xl text-white shadow-md shadow-rose-200">
              <ArrowRightLeft className="h-6 w-6" />
            </span>
            Stock Transfer
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Move inventory between shop floor, godown, or other storage locations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="rounded-xl border-slate-200"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.form
          onSubmit={handleTransfer}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
        >
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            New Transfer
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">
                From location
              </label>
              <SearchableSelect
                options={warehouseOptions}
                value={fromWarehouseId}
                onChange={setFromWarehouseId}
                placeholder="Select source..."
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={swapWarehouses}
              className="rounded-xl shrink-0 mb-0.5"
              title="Swap locations"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">
                To location
              </label>
              <SearchableSelect
                options={warehouseOptions}
                value={toWarehouseId}
                onChange={setToWarehouseId}
                placeholder="Select destination..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500">Product</label>
            <SearchableSelect
              options={productOptions}
              value={productId}
              onChange={setProductId}
              placeholder="Search product..."
            />
            {productId && fromWarehouseId && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mt-2">
                Available at source:{" "}
                <span className="font-bold">{availableQty}</span>
                {productMap.get(productId)?.unit
                  ? ` ${productMap.get(productId)?.unit}`
                  : " units"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">
                Quantity
              </label>
              <Input
                type="number"
                min={1}
                step={1}
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                placeholder="0"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">
                Notes (optional)
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Restock counter display"
                className="rounded-xl"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer Stock
              </>
            )}
          </Button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-slate-400" />
            Locations
          </h2>
          <ul className="space-y-2">
            {warehouses.map((w) => (
              <li
                key={w.id}
                className="flex items-start gap-2 text-sm border border-slate-100 rounded-xl px-3 py-2.5 bg-slate-50"
              >
                <MapPin className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-800">{w.name}</p>
                  {w.location && (
                    <p className="text-xs text-slate-500">{w.location}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <Input
              value={newWarehouseName}
              onChange={(e) => setNewWarehouseName(e.target.value)}
              placeholder="New location name"
              className="rounded-xl text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddWarehouse();
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddWarehouse}
              disabled={addingWarehouse}
              className="rounded-xl shrink-0"
            >
              {addingWarehouse ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            Recent Transfers
          </h2>
        </div>
        {transferLogs.length === 0 ? (
          <p className="text-sm text-slate-500 px-6 py-8 text-center">
            No transfers recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Product</th>
                  <th className="px-6 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {transferLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-6 py-3 whitespace-nowrap text-slate-600">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {formatLogProduct(log)}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{log.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
