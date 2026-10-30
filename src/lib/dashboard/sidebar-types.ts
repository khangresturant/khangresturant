import type { LucideIcon } from "lucide-react";

export const SECTION_COLORS = [
  "cyan",
  "sky",
  "rose",
  "purple",
  "amber",
  "emerald",
  "indigo",
  "teal",
  "pink",
  "violet",
] as const;

export type SectionColorKey = (typeof SECTION_COLORS)[number];

export type SidebarLink = {
  nameKey: string;
  path: string;
  icon: LucideIcon;
  permissionKey: string;
};

export type SidebarSection = {
  titleKey: string;
  colorKey: SectionColorKey;
  links: SidebarLink[];
};

export type SidebarSectionsInput = {
  industryType: string | null | undefined;
  hasEmi: boolean;
  hasPayroll: boolean;
  hasTax: boolean;
  hasAssetsRec: boolean;
  hasGiftCards?: boolean;
  hasEcommerce?: boolean;
  subscriptionTier: string | null | undefined;
  subscriptionExpiresAt: string | null | undefined;
  remotePlans?: Array<Record<string, unknown>>;
};
