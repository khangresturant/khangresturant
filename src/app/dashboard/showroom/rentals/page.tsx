"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  PlusCircle,
  Trash2,
  Edit,
  Loader2,
  X,
  Phone,
  User,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopContext";
import { createClient } from "@/lib/supabase/client";
import {
  computeLateFee,
  deriveRentalStatus,
  rentalDayCount,
  vehicleLabel,
  type ShowroomRental,
  type ShowroomVehicle,
  loadShowroomOfflineEntities,
  executeShowroomAction,
  isShowroomOffline,
} from "@/lib/showroom-ops";
import { ShowroomOfflineBar } from "@/components/showroom/ShowroomOfflineBar";

export default function RentalTrackingPage() {
  const { shopId } = useShop();
  const supabase = createClient();

  const [rentals, setRentals] = useState<ShowroomRental[]>([]);
  const [vehicles, setVehicles] = useState<ShowroomVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRental, setEditingRental] = useState<ShowroomRental | null>(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_cnic: "",
    vehicle_id: "",
    start_date: "",
    end_date: "",
    daily_rate: 5000,
    security_deposit: 15000,
    late_fee_per_day: 0,
    notes: "",
  });

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      if (isShowroomOffline()) {
        const [offVehicles, offRentals] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomRental>("showroom_rentals", shopId),
        ]);
        setVehicles(offVehicles);
        const rows = offRentals.map((r) => ({
          ...r,
          status: deriveRentalStatus(r),
        }));
        setRentals(rows);
        setLoading(false);
        return;
      }

      const [vRes, rRes] = await Promise.all([
        supabase
          .from("showroom_vehicles")
          .select("*")
          .eq("shop_id", shopId)
          .order("make"),
        supabase
          .from("showroom_rentals")
          .select(
            `
            *,
            showroom_vehicles ( make, model, plate_number )
          `
          )
          .eq("shop_id", shopId)
          .order("created_at", { ascending: false }),
      ]);

      if (vRes.error) throw vRes.error;
      if (rRes.error) throw rRes.error;

      const loadedVeh = (vRes.data as ShowroomVehicle[]) || [];
      const loadedRent = (rRes.data as ShowroomRental[]) || [];
      setVehicles(loadedVeh);

      const rows = loadedRent.map((r) => {
        const derived = deriveRentalStatus(r);
        return { ...r, status: derived };
      });

      // Persist overdue flag when needed (best-effort)
      for (const r of rows) {
        if (r.status === "overdue" && r.id) {
          const original = loadedRent.find((x) => x.id === r.id);
          if (original && original.status === "active") {
            await supabase
              .from("showroom_rentals")
              .update({ status: "overdue" })
              .eq("id", r.id);
          }
        }
      }

      setRentals(rows);

      import("@/utils/syncQueue").then(({ putManyOfflineData }) => {
        putManyOfflineData("showroom_rentals", loadedRent.map((r) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
        putManyOfflineData("showroom_vehicles", loadedVeh.map((r) => ({ ...r, shopId, _shop_id: shopId }))).catch(() => {});
      });
    } catch (err: any) {
      try {
        const [offVehicles, offRentals] = await Promise.all([
          loadShowroomOfflineEntities<ShowroomVehicle>("showroom_vehicles", shopId),
          loadShowroomOfflineEntities<ShowroomRental>("showroom_rentals", shopId),
        ]);
        if (offVehicles.length > 0 || offRentals.length > 0) {
          setVehicles(offVehicles);
          setRentals(offRentals.map((r) => ({ ...r, status: deriveRentalStatus(r) })));
        } else {
          toast.error("Failed to load rentals: " + (err?.message || "unknown"));
          setRentals([]);
        }
      } catch {
        toast.error("Failed to load rentals: " + (err?.message || "unknown"));
        setRentals([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const rentableVehicles = useMemo(
    () =>
      vehicles.filter((v) => {
        const purpose = v.purpose || "sale";
        const canRent = purpose === "rental" || purpose === "both" || purpose === "sale";
        if (!canRent) return false;
        if (editingRental?.vehicle_id === v.id) return true;
        return v.status === "available" || v.status === "reserved";
      }),
    [vehicles, editingRental]
  );

  const handleOpenAddModal = () => {
    setEditingRental(null);
    const today = new Date().toISOString().split("T")[0];
    const next = new Date();
    next.setDate(next.getDate() + 5);
    const first = rentableVehicles[0];
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_cnic: "",
      vehicle_id: first?.id || "",
      start_date: today,
      end_date: next.toISOString().split("T")[0],
      daily_rate: Number(first?.daily_rental_rate) || 5000,
      security_deposit: 15000,
      late_fee_per_day: 0,
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (r: ShowroomRental) => {
    setEditingRental(r);
    setFormData({
      customer_name: r.customer_name,
      customer_phone: r.customer_phone || "",
      customer_cnic: r.customer_cnic || "",
      vehicle_id: r.vehicle_id || "",
      start_date: r.start_date,
      end_date: r.end_date,
      daily_rate: Number(r.daily_rate) || 0,
      security_deposit: Number(r.security_deposit) || 0,
      late_fee_per_day: Number(r.late_fee_per_day) || 0,
      notes: r.notes || "",
    });
    setIsModalOpen(true);
  };

  const onVehiclePick = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId);
    setFormData((prev) => ({
      ...prev,
      vehicle_id: vehicleId,
      daily_rate: Number(v?.daily_rental_rate) || prev.daily_rate,
    }));
  };

  const handleSave = async () => {
    if (!shopId) return;
    if (
      !formData.customer_name ||
      !formData.vehicle_id ||
      !formData.start_date ||
      !formData.end_date
    ) {
      toast.error("Customer, vehicle, and dates are required.");
      return;
    }
    if (formData.end_date < formData.start_date) {
      toast.error("Return date must be on/after start date.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        shop_id: shopId,
        vehicle_id: formData.vehicle_id,
        customer_name: formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim() || null,
        customer_cnic: formData.customer_cnic.trim() || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        daily_rate: formData.daily_rate,
        security_deposit: formData.security_deposit,
        late_fee_per_day: formData.late_fee_per_day,
        notes: formData.notes.trim() || null,
        status: deriveRentalStatus({
          status: "active",
          end_date: formData.end_date,
          returned_at: null,
        }),
      };

      if (editingRental) {
        payload.id = editingRental.id;
        const prevVehicleId = editingRental.vehicle_id;
        await executeShowroomAction({
          table: "showroom_rentals",
          action: "update",
          payload,
          shopId,
        });

        if (prevVehicleId && prevVehicleId !== formData.vehicle_id) {
          await executeShowroomAction({
            table: "showroom_vehicles",
            action: "update",
            payload: { id: prevVehicleId, status: "available" },
            shopId,
          });
        }
        await executeShowroomAction({
          table: "showroom_vehicles",
          action: "update",
          payload: { id: formData.vehicle_id, status: "rented" },
          shopId,
        });

        toast.success("Rental contract updated");
      } else {
        payload.id = crypto.randomUUID();
        await executeShowroomAction({
          table: "showroom_rentals",
          action: "insert",
          payload,
          shopId,
        });
        await executeShowroomAction({
          table: "showroom_vehicles",
          action: "update",
          payload: { id: formData.vehicle_id, status: "rented" },
          shopId,
        });
        toast.success("Rental booked");
      }

      setIsModalOpen(false);
      load();
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const markReturned = async (r: ShowroomRental) => {
    if (!shopId) return;
    if (!confirm("Mark this vehicle as returned and settle deposit?")) return;
    setIsSaving(true);
    try {
      const late = computeLateFee({
        endDate: r.end_date,
        returnedAt: new Date().toISOString(),
        lateFeePerDay: r.late_fee_per_day,
      });
      const deposit = Number(r.security_deposit) || 0;
      const depositReturned = Math.max(0, deposit - late);

      await executeShowroomAction({
        table: "showroom_rentals",
        action: "update",
        payload: {
          id: r.id,
          status: "returned",
          returned_at: new Date().toISOString(),
          late_fee_charged: late,
          deposit_returned: depositReturned,
        },
        shopId,
      });

      if (r.vehicle_id) {
        await executeShowroomAction({
          table: "showroom_vehicles",
          action: "update",
          payload: { id: r.vehicle_id, status: "available" },
          shopId,
        });
      }

      toast.success(
        late > 0
          ? `Returned. Late fee Rs ${late.toLocaleString()} deducted from deposit.`
          : "Returned. Full deposit ready to refund."
      );
      load();
    } catch (err: any) {
      toast.error(err.message || "Return failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (r: ShowroomRental) => {
    if (!shopId) return;
    if (!confirm("Delete this rental record?")) return;
    try {
      await executeShowroomAction({
        table: "showroom_rentals",
        action: "delete",
        payload: { id: r.id },
        shopId,
      });

      if (r.vehicle_id && r.status !== "returned") {
        await executeShowroomAction({
          table: "showroom_vehicles",
          action: "update",
          payload: { id: r.vehicle_id, status: "available" },
          shopId,
        });
      }
      toast.success("Rental removed");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filtered = rentals.filter((r) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    const vName = r.showroom_vehicles
      ? vehicleLabel(r.showroom_vehicles)
      : "";
    return (
      r.customer_name.toLowerCase().includes(q) ||
      (r.customer_phone || "").includes(q) ||
      vName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 font-sans">
      <ShowroomOfflineBar onSyncSuccess={load} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Rental Contracts
          </h2>
          <p className="text-slate-500 mt-1">
            Book rentals, track deposits, overdue returns, and late fees.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search customer/vehicle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button
            onClick={handleOpenAddModal}
            disabled={rentableVehicles.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Book Rental
          </Button>
        </div>
      </div>

      {rentableVehicles.length === 0 && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No available vehicles for rent. Add a vehicle in Inventory (purpose rental/both) first.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-400">
              No rental contracts yet.
            </div>
          ) : (
            filtered.map((item) => {
              const daysTotal = rentalDayCount(item.start_date, item.end_date);
              const totalRent = daysTotal * Number(item.daily_rate || 0);
              const projectedLate = computeLateFee({
                endDate: item.end_date,
                lateFeePerDay: item.late_fee_per_day,
                status: item.status,
              });
              const vLabel = item.showroom_vehicles
                ? vehicleLabel(item.showroom_vehicles)
                : "Vehicle";

              return (
                <motion.div
                  whileHover={{ y: -3 }}
                  key={item.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between"
                >
                  <div
                    className={`absolute top-0 left-0 w-full h-1.5 ${
                      item.status === "returned"
                        ? "bg-emerald-500"
                        : item.status === "overdue"
                          ? "bg-red-500"
                          : item.status === "cancelled"
                            ? "bg-slate-400"
                            : "bg-blue-500"
                    }`}
                  />

                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <User size={16} className="text-slate-400" /> {item.customer_name}
                        </h3>
                        {item.customer_phone && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {item.customer_phone}
                          </p>
                        )}
                        {item.customer_cnic && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            CNIC: {item.customer_cnic}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${
                          item.status === "returned"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : item.status === "overdue"
                              ? "bg-red-50 border-red-200 text-red-800"
                              : "bg-blue-50 border-blue-200 text-blue-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 mb-4">
                      <p className="text-xs font-semibold text-slate-700 truncate">{vLabel}</p>
                      <div className="flex justify-between items-center text-xs border-t border-slate-200/60 pt-2 font-mono">
                        <span>
                          {new Date(item.start_date).toLocaleDateString()} →{" "}
                          {new Date(item.end_date).toLocaleDateString()}
                        </span>
                        <span className="font-black text-slate-800">
                          Rs {Number(item.daily_rate).toLocaleString()}/day
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center mb-3">
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 font-mono text-xs">
                        <span className="text-[9px] text-slate-400 uppercase font-sans font-semibold block">
                          Sec Deposit
                        </span>
                        <span className="font-bold text-slate-700">
                          Rs {Number(item.security_deposit).toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 font-mono text-xs">
                        <span className="text-[9px] text-blue-500 uppercase font-sans font-semibold block">
                          Est Rent ({daysTotal}d)
                        </span>
                        <span className="font-bold text-blue-700">
                          Rs {totalRent.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {(item.status === "overdue" || item.status === "returned") &&
                      (projectedLate > 0 || Number(item.late_fee_charged) > 0) && (
                        <p className="text-[11px] text-red-600 font-semibold mb-2">
                          Late fee: Rs{" "}
                          {(
                            Number(item.late_fee_charged) || projectedLate
                          ).toLocaleString()}
                        </p>
                      )}

                    {item.status === "returned" && (
                      <p className="text-[11px] text-emerald-700 mb-2">
                        Deposit to return: Rs{" "}
                        {Number(item.deposit_returned ?? item.security_deposit).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-1 border-t border-slate-100 pt-3">
                    {item.status !== "returned" && item.status !== "cancelled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markReturned(item)}
                        disabled={isSaving}
                        className="text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
                      >
                        <CheckCircle size={14} className="mr-1" /> Return
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEditModal(item)}
                      className="text-slate-500 hover:text-blue-600 hover:bg-slate-100 text-xs font-bold"
                    >
                      <Edit size={14} className="mr-1" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item)}
                      className="text-slate-500 hover:text-red-600 hover:bg-slate-100 text-xs font-bold"
                    >
                      <Trash2 size={14} className="mr-1" /> Remove
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative z-10 font-sans max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-lg">
                  {editingRental ? "Edit Rental" : "Book Rental"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Customer Name *
                  </label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      Phone
                    </label>
                    <Input
                      value={formData.customer_phone}
                      onChange={(e) =>
                        setFormData({ ...formData, customer_phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      CNIC
                    </label>
                    <Input
                      value={formData.customer_cnic}
                      onChange={(e) =>
                        setFormData({ ...formData, customer_cnic: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Vehicle *
                  </label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => onVehiclePick(e.target.value)}
                    className="w-full bg-white border border-slate-200 h-10 rounded-lg px-3 text-sm"
                  >
                    <option value="">Select vehicle</option>
                    {rentableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {vehicleLabel(v)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      Return Due
                    </label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      Daily Rent (Rs)
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.daily_rate || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          daily_rate: parseFloat(e.target.value.replace(/\D/g, "")) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      Security Deposit
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formData.security_deposit || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          security_deposit: parseFloat(e.target.value.replace(/\D/g, "")) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Late fee / day (Rs)
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.late_fee_per_day || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        late_fee_per_day: parseFloat(e.target.value.replace(/\D/g, "")) || 0,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                    Notes
                  </label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Rental Contract
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
