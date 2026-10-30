"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SHOWROOM_MIGRATION_SQL } from "@/lib/showroom-ops";

type Status = "loading" | "ok" | "needed";

export default function ShowroomSetupMigrationPage() {
  const supabase = createClient();
  const { shopId } = useShop();
  const [status, setStatus] = useState<Status>("loading");
  const [vehiclesOk, setVehiclesOk] = useState(false);
  const [rentalsOk, setRentalsOk] = useState(false);
  const [chassisOk, setChassisOk] = useState(false);
  const [investorsOk, setInvestorsOk] = useState(false);

  const check = async () => {
    setStatus("loading");
    try {
      const v = await supabase.from("showroom_vehicles").select("id").limit(1);
      const vehiclesExist = !v.error || !v.error.message?.includes("does not exist");
      setVehiclesOk(vehiclesExist && !v.error?.message?.includes("schema cache"));

      const chassis = await supabase
        .from("showroom_vehicles")
        .select("chassis_number")
        .limit(1);
      setChassisOk(!chassis.error);

      const r = await supabase.from("showroom_rentals").select("id").limit(1);
      const rentalsExist = !r.error || !r.error.message?.includes("does not exist");
      setRentalsOk(rentalsExist && !r.error);

      const inv = await supabase.from("showroom_investors").select("id").limit(1);
      const investorsExist = !inv.error || !inv.error.message?.includes("does not exist");
      setInvestorsOk(investorsExist && !inv.error?.message?.includes("schema cache"));

      const ok = vehiclesExist && !chassis.error && rentalsExist && !r.error && investorsExist && !inv.error;
      setStatus(ok ? "ok" : "needed");
    } catch {
      setStatus("needed");
    }
  };

  useEffect(() => {
    check();
  }, [shopId]);

  const copySql = async () => {
    await navigator.clipboard.writeText(SHOWROOM_MIGRATION_SQL);
    toast.success("SQL copied — paste in Supabase SQL Editor");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Showroom Database Setup & Migration (ڈیٹا بیس سیٹ اپ)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          اگر آپ کو شوروم انوینٹری، انویسٹرز یا رینٹل میں ڈیٹا بیس ایرر ملے تو نیچے دیا گیا SQL کوڈ ایک بار Supabase میں رن کریں۔
        </p>
      </div>

      <div
        className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3.5 ${
          status === "ok"
            ? "border-emerald-200 bg-emerald-50/60"
            : status === "needed"
              ? "border-amber-200 bg-amber-50/60"
              : "border-slate-200 bg-slate-50"
        }`}
      >
        {status === "loading" ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-500 mt-0.5" />
        ) : status === "ok" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
        )}
        <div className="flex-1">
          <p className="font-semibold text-slate-800">
            {status === "loading"
              ? "Checking schema…"
              : status === "ok"
                ? "Showroom schema looks ready"
                : "Migration needed"}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>Vehicles table: {vehiclesOk ? "OK ✓" : "missing / error"}</li>
            <li>Chassis columns: {chassisOk ? "OK ✓" : "missing"}</li>
            <li>Rentals table: {rentalsOk ? "OK ✓" : "missing"}</li>
            <li>Investors table: {investorsOk ? "OK ✓" : "missing"}</li>
          </ul>
          <Button variant="outline" size="sm" className="mt-3" onClick={check}>
            Re-check
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <Database size={18} /> How to apply
        </div>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600">
          <li>
            Open{" "}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 inline-flex items-center gap-1 font-medium"
            >
              Supabase SQL Editor <ExternalLink size={12} />
            </a>
          </li>
          <li>Click Copy SQL below and paste into the editor</li>
          <li>Run the query, then click Re-check here</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copySql} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Copy size={14} className="mr-1.5" /> Copy SQL
          </Button>
          <Link href="/dashboard/showroom/vehicles">
            <Button variant="outline">Open Vehicles</Button>
          </Link>
          <Link href="/dashboard/showroom/investors">
            <Button variant="outline">Open Investors</Button>
          </Link>
          <Link href="/dashboard/showroom/rentals">
            <Button variant="outline">Open Rentals</Button>
          </Link>
        </div>
        <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] text-slate-100 leading-relaxed">
          {SHOWROOM_MIGRATION_SQL}
        </pre>
      </div>
    </div>
  );
}
