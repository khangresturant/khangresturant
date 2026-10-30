"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Database, CheckCircle2, AlertTriangle, Copy, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useShop } from "@/context/ShopContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  VENUE_PRESETS,
  type VenuePresetId,
  applyVenuePreset,
} from "@/lib/restaurant-modifiers";
import { P1P2_MIGRATION_SQL } from "@/lib/restaurant-ops";

const WORKFLOW_SQL = `-- Restaurant Order Workflow
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS restaurant_order_status VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_type VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_printed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS additional_charges NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rider_id UUID;
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS waiter_id UUID;`;

const EXTENDED_SQL = `-- Deals, menu sizes, waiter calls, modifiers
CREATE TABLE IF NOT EXISTS restaurant_menu_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    size_name VARCHAR(30) NOT NULL,
    size_description VARCHAR(100),
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(shop_id, product_id, size_name)
);

CREATE TABLE IF NOT EXISTS restaurant_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    original_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    deal_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_deal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES restaurant_deals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    item_type VARCHAR(30) DEFAULT 'item',
    quantity NUMERIC(15, 2) NOT NULL DEFAULT 1,
    size_name VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_waiter_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    message VARCHAR(255) DEFAULT 'Waiter requested',
    call_type VARCHAR(30) DEFAULT 'help',
    status VARCHAR(20) DEFAULT 'pending',
    waiter_id UUID,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_add NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    applies_to VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_menu_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_deal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_modifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_menu_sizes_all" ON restaurant_menu_sizes;
CREATE POLICY "restaurant_menu_sizes_all" ON restaurant_menu_sizes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "restaurant_deals_all" ON restaurant_deals;
CREATE POLICY "restaurant_deals_all" ON restaurant_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "restaurant_deal_items_all" ON restaurant_deal_items;
CREATE POLICY "restaurant_deal_items_all" ON restaurant_deal_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "restaurant_waiter_calls_all" ON restaurant_waiter_calls;
CREATE POLICY "restaurant_waiter_calls_all" ON restaurant_waiter_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "restaurant_modifiers_all" ON restaurant_modifiers;
CREATE POLICY "restaurant_modifiers_all" ON restaurant_modifiers FOR ALL TO authenticated USING (true) WITH CHECK (true);`;

const MIGRATION_SQL = `${WORKFLOW_SQL}\n\n${EXTENDED_SQL}\n\n${P1P2_MIGRATION_SQL}`;

type MigrationStatus = "loading" | "ok" | "needed";

export default function RestaurantSetupMigrationPage() {
  const supabase = createClient();
  const { shopId } = useShop();
  const [status, setStatus] = useState<MigrationStatus>("loading");
  const [workflowOk, setWorkflowOk] = useState(false);
  const [extendedOk, setExtendedOk] = useState(false);
  const [modifiersOk, setModifiersOk] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const checkMigration = async () => {
    setStatus("loading");
    const [invRes, dealsRes, modRes, stRes] = await Promise.all([
      supabase.from("invoices").select("restaurant_order_status, service_type, rider_id, tip_amount").limit(1),
      supabase.from("restaurant_deals").select("id").limit(1),
      supabase.from("restaurant_modifiers").select("id").limit(1),
      supabase.from("restaurant_stations").select("id").limit(1),
    ]);

    const wfOk = !invRes.error?.message?.includes("restaurant_order_status");
    const extOk = !dealsRes.error?.message?.includes("does not exist");
    const modOk = !modRes.error?.message?.includes("does not exist");
    const stOk = !stRes.error?.message?.includes("does not exist");
    setWorkflowOk(wfOk);
    setExtendedOk(extOk);
    setModifiersOk(modOk && stOk);
    setStatus(wfOk && extOk && modOk && stOk ? "ok" : "needed");
  };

  useEffect(() => {
    checkMigration();
  }, []);

  const copySql = () => {
    navigator.clipboard.writeText(MIGRATION_SQL);
    toast.success("SQL copied — paste in Supabase SQL Editor and click Run");
  };

  const seedVenue = async (presetId: VenuePresetId) => {
    if (!shopId) {
      toast.error("Shop not loaded");
      return;
    }
    setSeeding(true);
    try {
      const result = await applyVenuePreset(supabase, shopId, presetId);
      toast.success(
        `${VENUE_PRESETS[presetId].label}: +${result.tables} tables, +${result.categories} categories, +${result.modifiers} modifiers`
      );
    } catch (e: any) {
      toast.error(e.message || "Seed failed — run SQL migration first");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in font-sans py-4">
      <div>
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <Database className="text-blue-600" /> Restaurant DB Setup
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Migration for workflow, deals, sizes, modifiers, riders — plus venue presets (dhaba to fine dining)
        </p>
      </div>

      {status === "loading" && (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Checking database...
        </div>
      )}

      {status === "ok" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-emerald-800 font-bold">
            <CheckCircle2 /> All migrations applied
          </div>
          <ul className="text-sm text-emerald-700 mt-2 space-y-1">
            <li>✓ Order workflow &amp; status columns (incl. rider_id)</li>
            <li>✓ Deals, menu sizes &amp; waiter calls tables</li>
            <li>✓ Configurable modifiers table</li>
          </ul>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/dashboard/restaurant/orders">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Order History</Button>
            </Link>
            <Link href="/dashboard/restaurant/modifiers">
              <Button variant="outline">Add-ons / Modifiers</Button>
            </Link>
            <Link href="/dashboard/restaurant/deals">
              <Button variant="outline">Deals &amp; Sizes</Button>
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">Venue presets (seed once)</h3>
        <p className="text-xs text-slate-500">
          Empty shops get default tables + categories + add-ons. Existing tables are left untouched.
        </p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VENUE_PRESETS) as VenuePresetId[]).map((id) => (
            <Button
              key={id}
              variant="outline"
              size="sm"
              disabled={seeding || !shopId}
              onClick={() => seedVenue(id)}
            >
              {VENUE_PRESETS[id].label}
            </Button>
          ))}
        </div>
      </div>

      {status === "needed" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <AlertTriangle /> Migration required
            </div>
            <ul className="text-sm text-amber-800 mt-2 space-y-1">
              <li>{workflowOk ? "✓" : "✗"} Order workflow columns</li>
              <li>{extendedOk ? "✓" : "✗"} Deals, sizes &amp; waiter calls tables</li>
              <li>{modifiersOk ? "✓" : "✗"} Modifiers table</li>
            </ul>
            <p className="text-sm text-amber-800 mt-3">
              Run the SQL below in the Supabase Dashboard SQL Editor.
            </p>
          </div>

          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 bg-white border rounded-xl p-5">
            <li>
              Open{" "}
              <a
                href="https://supabase.com/dashboard/project/bzlryfostkzotfgeozjr/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-semibold inline-flex items-center gap-1"
              >
                Supabase SQL Editor <ExternalLink size={12} />
              </a>
            </li>
            <li>Click <strong>Copy SQL</strong> below and paste into the editor</li>
            <li>Click <strong>Run</strong> in Supabase</li>
            <li>Come back here and click <strong>Check again</strong></li>
          </ol>

          <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-96">
            {MIGRATION_SQL}
          </pre>

          <div className="flex flex-wrap gap-2">
            <Button onClick={copySql} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Copy size={14} className="mr-1.5" /> Copy SQL
            </Button>
            <Button variant="outline" onClick={checkMigration}>
              Check again
            </Button>
            <a
              href="https://supabase.com/dashboard/project/bzlryfostkzotfgeozjr/sql/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">
                <ExternalLink size={14} className="mr-1.5" /> Open SQL Editor
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
