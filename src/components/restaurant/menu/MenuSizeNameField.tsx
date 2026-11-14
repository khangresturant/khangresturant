"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { MENU_SIZE_SUGGESTIONS } from "@/lib/restaurant-menu-products";

type Props = {
  value: string;
  onChange: (value: string) => void;
  isEn: boolean;
  className?: string;
  id?: string;
};

export function MenuSizeNameField({ value, onChange, isEn, className = "", id = "menu-size-name" }: Props) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-bold text-slate-500">
        {isEn ? "Size name (type anything)" : "سائز کا نام"}
      </label>
      <Input
        id={id}
        list={`${id}-suggestions`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isEn ? "e.g. Personal, Jumbo, 12 inch…" : "کچھ بھی لکھیں"}
        className={`mt-1 ${className}`}
      />
      <datalist id={`${id}-suggestions`}>
        {MENU_SIZE_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p className="text-[10px] text-slate-400 mt-0.5">
        {isEn ? "Suggestions appear while typing - any custom name is OK (like POSRESTURANT)." : "کوئی بھی نام۔"}
      </p>
    </div>
  );
}

export function normalizeSizeName(raw: string): string | null {
  const t = raw.trim();
  return t.length ? t : null;
}
