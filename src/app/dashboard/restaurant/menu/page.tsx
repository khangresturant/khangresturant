"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UtensilsCrossed, FolderOpen, Layers } from "lucide-react";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [tab, setTab] = useState<TabId>("items");

  const selectTab = (id: TabId) => {
    setTab(id);
    const product = searchParams.get("product");
    const qs = product ? `?tab=${id}&product=${product}` : `?tab=${id}`;
    router.replace(`/dashboard/restaurant/menu${qs}`);
  };

  useEffect(() => {
    if (tabParam === "categories" || tabParam === "items" || tabParam === "sizes") {
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
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 text-white p-5 shadow-lg">
        <h1 className="text-xl font-black tracking-tight">
          {isEn ? "Fast Food Menu" : "فاسٹ فوڈ مینو"}
        </h1>
        <p className="text-blue-100 text-sm mt-1 max-w-2xl">
          {isEn
            ? "Tabs: Items, Categories, Sizes (per dish). Recipe per size in Menu Items → Edit."
            : "آئٹمز، کیٹگریز، سائز - ہر ڈش کے الگ سائز۔"}
        </p>
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <Link href="/dashboard/restaurant/deals" className="underline text-blue-100 hover:text-white">
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
            onClick={() => selectTab(t.id)}
            className={tab === t.id ? "bg-slate-900" : ""}
          >
            {t.icon}
            <div className="ml-1.5">{t.label}</div>
          </Button>
        ))}
      </div>

      {tab === "items" && <MenuItemsTab />}
      {tab === "categories" && <MenuCategoriesTab />}
      {tab === "sizes" && <MenuSizesTab />}
    </div>
  );
}
