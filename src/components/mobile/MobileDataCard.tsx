"use client";

import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "purple";

type MobileDataCardProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: { label: string; tone?: BadgeTone };
  primaryAmount?: string;
  secondaryAmount?: string;
  secondaryLabel?: string;
  actions?: ReactNode;
  onClick?: () => void;
};

const badgeTone: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border-amber-100",
  danger: "bg-red-50 text-red-700 border-red-100",
  neutral: "bg-slate-50 text-slate-600 border-slate-100",
  purple: "bg-purple-50 text-purple-700 border-purple-100",
};

export function MobileDataCard({
  title,
  subtitle,
  meta,
  badge,
  primaryAmount,
  secondaryAmount,
  secondaryLabel,
  actions,
  onClick,
}: MobileDataCardProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`mobile-vip-card w-full text-left bg-white border border-slate-100 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-transform ${
        onClick ? "cursor-pointer hover:border-indigo-100 hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-slate-900 text-sm truncate">{title}</p>
            {badge && (
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                  badgeTone[badge.tone ?? "neutral"]
                }`}
              >
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
              {subtitle}
            </p>
          )}
          {meta && (
            <p className="text-[10px] text-slate-400 font-semibold mt-1">{meta}</p>
          )}
        </div>
        {onClick && (
          <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
        )}
      </div>

      {(primaryAmount || secondaryAmount) && (
        <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-slate-50">
          {primaryAmount && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                Total
              </p>
              <p className="text-lg font-black text-slate-900">{primaryAmount}</p>
            </div>
          )}
          {secondaryAmount && (
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                {secondaryLabel || "Due"}
              </p>
              <p className="text-sm font-black text-amber-600">{secondaryAmount}</p>
            </div>
          )}
        </div>
      )}

      {actions && (
        <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-slate-50">
          {actions}
        </div>
      )}
    </Wrapper>
  );
}

export function MobileCardList({ children }: { children: ReactNode }) {
  return (
    <div className="md:hidden mobile-vip-card-list flex flex-col gap-2.5">
      {children}
    </div>
  );
}
