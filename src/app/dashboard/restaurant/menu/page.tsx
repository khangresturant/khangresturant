"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UtensilsCrossed, Layers, FolderOpen } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { MenuItemsTab } from "@/components/restaurant/menu/MenuItemsTab";
import { MenuCategoriesTab } from "@/components/restaurant/menu/MenuCategoriesTab";
import { MenuSizesTab } from "@/components/restaurant/menu/MenuSizesTab";
import Link from "next/link";

type TabId = "items" | "categories" | "sizes";

export default function RestaurantMenuManagementPage() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabId | null;

  const [tab, setTab] = useState<TabId>("items");

  useEffect(() => {
    if (tabParam === "categories" || tabParam === "sizes" || tabParam === "items") {
      setTab(tabParam);
    }
  }, [tabParam]);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "items", label: isEn ? "Menu Items" : "مینو آئٹمز", icon: <UtensilsCrossed size={14} /> },
    { id: "categories", label: isEn ? "Categories" : "کیٹگریز", icon: <FolderOpen size={14} /> },
    { id: "sizes", label: isEn ? "Sizes & Pricing" : "سائز و قیمت", icon: <Layers size={14} /> },
  ];

  return (
    <div className="space-y-6 font-sans animate-in fade-in max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
        <p className="text-xs text-slate-600 font-medium">
          {isEn
            ? "Sales menu items, categories, and size prices. Raw ingredients stay under Products (ingredient flag) or Recipes for BOM."
            : "فروخت مینو، کیٹگریز اور سائز قیمتیں۔"}
        </p>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link href="/dashboard/restaurant/recipes" className="underline text-blue-600 hover:text-blue-800 font-semibold">
            {isEn ? "Recipes & food cost →" : "ریسیپی →"}
          </Link>
          <Link href="/dashboard/restaurant/deals" className="underline text-blue-600 hover:text-blue-800 font-semibold">
            {isEn ? "Deals & combos →" : "ڈیلز →"}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "bg-slate-900" : ""}
          >
            {t.icon}
            <div className="ml-1.5 inline-block">{t.label}</div>
          </Button>
        ))}
      </div>

      {tab === "items" && <MenuItemsTab />}
      {tab === "categories" && <MenuCategoriesTab />}
      {tab === "sizes" && <MenuSizesTab />}
    </div>
  );
}
