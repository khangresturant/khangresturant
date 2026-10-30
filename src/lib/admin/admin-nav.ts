import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Sliders,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

export type AdminNavLink = {
  name: string;
  path: string;
  icon: LucideIcon;
  description?: string;
};

export type AdminNavSection = {
  title: string;
  links: AdminNavLink[];
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "Command Center",
    links: [
      {
        name: "Overview",
        path: "/admin",
        icon: LayoutDashboard,
        description: "Stats, announcements & system health",
      },
    ],
  },
  {
    title: "Tenants & Users",
    links: [
      {
        name: "Businesses",
        path: "/admin/shops",
        icon: Store,
        description: "All registered shops & tiers",
      },
      {
        name: "Registrations",
        path: "/admin/users",
        icon: Users,
        description: "User profiles & onboarding",
      },
    ],
  },
  {
    title: "Billing & Revenue",
    links: [
      {
        name: "Subscriptions",
        path: "/admin/subscriptions",
        icon: Calendar,
        description: "Active plans & expiry dates",
      },
      {
        name: "Manage Plans",
        path: "/admin/plans",
        icon: Sliders,
        description: "SaaS plan flags & pricing",
      },
      {
        name: "Payment Gateways",
        path: "/admin/gateways",
        icon: CreditCard,
        description: "JazzCash, Stripe, bank config",
      },
      {
        name: "Referrals",
        path: "/admin/referrals",
        icon: TrendingUp,
        description: "MLM credits & payout reports",
      },
    ],
  },
  {
    title: "Operations",
    links: [
      {
        name: "Support Desk",
        path: "/admin/support",
        icon: MessageSquare,
        description: "Customer tickets & replies",
      },
    ],
  },
];

export function flattenAdminNavLinks(): AdminNavLink[] {
  return ADMIN_NAV_SECTIONS.flatMap((s) => s.links);
}

export function getAdminPageTitle(pathname: string): string {
  const match = flattenAdminNavLinks().find(
    (l) => l.path === pathname || (l.path !== "/admin" && pathname.startsWith(l.path))
  );
  return match?.name ?? "Admin Portal";
}
