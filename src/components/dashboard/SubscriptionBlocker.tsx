import React from "react";
import Link from "next/link";
import { ShieldAlert, CreditCard, Sparkles } from "lucide-react";

interface SubscriptionBlockerProps {
  featureName: string;
  requiredPlan: "Starter" | "Premium";
  description?: string;
}

export function SubscriptionBlocker({ 
  featureName, 
  requiredPlan, 
  description = "This advanced business feature requires an active paid plan. Upgrade now to unlock immediate access." 
}: SubscriptionBlockerProps) {
  return (
    <div className="w-full min-h-[400px] flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-3xl border border-slate-200/80 shadow-md">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 bg-rose-50 border border-rose-200 text-rose-600 rounded-3xl flex items-center justify-center shadow-lg shadow-rose-100/50 animate-bounce-subtle">
          <ShieldAlert size={28} className="animate-pulse" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-850 tracking-tight uppercase">Upgrade Plan Required</h3>
          <p className="text-xs text-rose-650 font-black uppercase tracking-wider">
            {featureName} • Locked Feature
          </p>
        </div>

        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          {description}
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-[11px] font-bold text-slate-600 flex items-center gap-2 justify-center">
          <Sparkles size={14} className="text-amber-550 shrink-0" />
          <span>Unlocked by migrating to the <strong className="text-slate-800">{requiredPlan} Plan</strong> today.</span>
        </div>

        <div className="pt-2">
          <Link href="/dashboard/billing">
            <button className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer">
              <CreditCard size={14} />
              Upgrade Subscription
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
