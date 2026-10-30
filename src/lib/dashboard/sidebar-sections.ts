import {
  LayoutDashboard,
  ShoppingCart, ShoppingBag,
  Package,
  Users,
  Settings,
  Scissors,
  Fuel,
  Pill,
  Car,
  Wrench,
  Shirt,
  Coffee,
  Leaf,
  CreditCard,
  Layers,
  Receipt,
  Tag,
  Building,
  Calculator,
  Truck,
  RotateCcw,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Search,
  Database,
  ChefHat,
  Scale,
  BookMarked,
  ClipboardList,
  ServerCog,
  Star,
  Crown,
  Sparkles,
  TrendingUp,
  BookOpen,
  Boxes,
  QrCode,
  BarChart3,
  HeartHandshake,
  Banknote,
  FlaskConical,
  FileUp,
  ArrowRightLeft,
  Landmark,
  AlertTriangle,
  Thermometer,
  Stethoscope,
  Smartphone,
} from "lucide-react";
import { getEffectiveTierId, resolvePlan } from "@/lib/planMatrix";
import { shouldHideBillingAndPlans, shouldDisableBackupRestore } from "@/lib/deployment/flame9-brand";
import type { SectionColorKey, SidebarLink, SidebarSection, SidebarSectionsInput } from "@/lib/dashboard/sidebar-types";

function buildIndustryModuleSection(
  industryType: string,
  hasEmi: boolean
): SidebarSection | null {
  const links: SidebarLink[] = [];
  let colorKey: SectionColorKey = "indigo";
  let titleKey = "system";

  switch (industryType) {
    case "pharmacy":
      titleKey = "pharmacy_title";
      colorKey = "pink";
      links.push(
        { nameKey: "pharmacy_expiry", path: "/dashboard/pharmacy/expiry", icon: Pill, permissionKey: "dashboard" },
        { nameKey: "pharmacy_controlled", path: "/dashboard/pharmacy/controlled", icon: ShieldAlert, permissionKey: "dashboard" },
        { nameKey: "pharmacy_temperature", path: "/dashboard/pharmacy/temperature", icon: Thermometer, permissionKey: "dashboard" },
        { nameKey: "pharmacy_short_book", path: "/dashboard/pharmacy/short-book", icon: BookOpen, permissionKey: "dashboard" },
        { nameKey: "pharmacy_doctors", path: "/dashboard/pharmacy/doctors", icon: Stethoscope, permissionKey: "dashboard" },
        { nameKey: "pharmacy_formulas", path: "/dashboard/pharmacy/formulas", icon: FlaskConical, permissionKey: "dashboard" },
        { nameKey: "pharmacy_claims", path: "/dashboard/pharmacy/claims", icon: Truck, permissionKey: "dashboard" },
        { nameKey: "low_stock_alerts", path: "/dashboard/inventory/low-stock", icon: AlertTriangle, permissionKey: "products" }
      );
      break;
    case "electronics":
      titleKey = "electronics_title";
      colorKey = "indigo";
      links.push(
        { nameKey: "electronics_emi", path: "/dashboard/electronics/emi", icon: CreditCard, permissionKey: "dashboard" },
        { nameKey: "electronics_repair", path: "/dashboard/electronics/repair", icon: Wrench, permissionKey: "dashboard" },
        { nameKey: "electronics_buyback", path: "/dashboard/electronics/buyback", icon: Smartphone, permissionKey: "dashboard" },
        { nameKey: "electronics_imei_tracker", path: "/dashboard/electronics/imei-tracker", icon: Search, permissionKey: "dashboard" }
      );
      break;
    case "fuel":
      titleKey = "fuel_title";
      colorKey = "amber";
      links.push(
        { nameKey: "fuel_tanks", path: "/dashboard/fuel/tanks", icon: Fuel, permissionKey: "dashboard" },
        { nameKey: "fuel_readings", path: "/dashboard/fuel/readings", icon: BarChart3, permissionKey: "dashboard" }
      );
      break;
    case "showroom":
      titleKey = "showroom_title";
      colorKey = "violet";
      links.push(
        { nameKey: "showroom_vehicles", path: "/dashboard/showroom/vehicles", icon: Car, permissionKey: "dashboard" },
        { nameKey: "showroom_sales", path: "/dashboard/showroom/sales", icon: ShoppingCart, permissionKey: "dashboard" },
        { nameKey: "showroom_installments", path: "/dashboard/showroom/installments", icon: CreditCard, permissionKey: "dashboard" },
        { nameKey: "showroom_parties", path: "/dashboard/showroom/parties", icon: Users, permissionKey: "dashboard" },
        { nameKey: "showroom_investors", path: "/dashboard/showroom/investors", icon: Landmark, permissionKey: "dashboard" },
        { nameKey: "showroom_rentals", path: "/dashboard/showroom/rentals", icon: Banknote, permissionKey: "dashboard" },
        { nameKey: "showroom_reports", path: "/dashboard/showroom/reports", icon: BarChart3, permissionKey: "dashboard" }
      );
      break;
    case "fertilizer":
      titleKey = "fertilizer_title";
      colorKey = "emerald";
      links.push(
        { nameKey: "fertilizer_batches", path: "/dashboard/fertilizer/batches", icon: Leaf, permissionKey: "dashboard" },
        { nameKey: "fertilizer_khata", path: "/dashboard/fertilizer/khata", icon: Users, permissionKey: "dashboard" }
      );
      break;
    case "hardware":
      titleKey = "hardware_title";
      colorKey = "amber";
      links.push({
        nameKey: "hardware_dimensions",
        path: "/dashboard/hardware/dimensions",
        icon: Wrench,
        permissionKey: "dashboard",
      });
      break;
    case "crockery":
      titleKey = "crockery_title";
      colorKey = "sky";
      if (hasEmi) {
        links.push({
          nameKey: "crockery_emi",
          path: "/dashboard/electronics/emi",
          icon: CreditCard,
          permissionKey: "dashboard",
        });
      }
      break;
    default:
      return null;
  }

  return links.length > 0 ? { titleKey, colorKey, links } : null;
}

function buildRestaurantSections(input: SidebarSectionsInput): SidebarSection[] {
  return [
    {
      titleKey: "restaurant_ops",
      colorKey: "cyan",
      links: [
        { nameKey: "overview", path: "/dashboard", icon: LayoutDashboard, permissionKey: "dashboard" },
        ...(input.hasEcommerce
          ? [{ nameKey: "ecommerce_desk", path: "/dashboard/ecommerce", icon: ShoppingBag, permissionKey: "sales" }]
          : []),
        { nameKey: "restaurant_pos_link", path: "/dashboard/restaurant/pos", icon: ShoppingCart, permissionKey: "pos" },
        { nameKey: "restaurant_waiter", path: "/dashboard/restaurant/waiter", icon: Coffee, permissionKey: "pos" },
        { nameKey: "kitchen_display", path: "/dashboard/restaurant/kds", icon: ChefHat, permissionKey: "pos" },
      ],
    },
    {
      titleKey: "table_order_management",
      colorKey: "rose",
      links: [
        { nameKey: "restaurant_tables", path: "/dashboard/restaurant/tables", icon: Coffee, permissionKey: "pos" },
        { nameKey: "restaurant_reservations", path: "/dashboard/restaurant/reservations", icon: ClipboardList, permissionKey: "pos" },
        { nameKey: "restaurant_qr", path: "/dashboard/restaurant/qr", icon: Receipt, permissionKey: "pos" },
        { nameKey: "restaurant_active_bills", path: "/dashboard/restaurant/active-bills", icon: Receipt, permissionKey: "pos" },
        { nameKey: "restaurant_kot", path: "/dashboard/restaurant/kot", icon: ChefHat, permissionKey: "pos" },
        { nameKey: "restaurant_orders", path: "/dashboard/restaurant/orders", icon: ClipboardList, permissionKey: "sales" },
      ],
    },
    {
      titleKey: "menu_management",
      colorKey: "purple",
      links: [
        { nameKey: "menu_items", path: "/dashboard/products", icon: Boxes, permissionKey: "products" },
        { nameKey: "menu_categories", path: "/dashboard/products?tab=categories", icon: Tag, permissionKey: "categories" },
        { nameKey: "restaurant_deals", path: "/dashboard/restaurant/deals", icon: Tag, permissionKey: "pos" },
        { nameKey: "restaurant_modifiers", path: "/dashboard/restaurant/modifiers", icon: Layers, permissionKey: "pos" },
        { nameKey: "restaurant_stations", path: "/dashboard/restaurant/stations", icon: ChefHat, permissionKey: "pos" },
        { nameKey: "restaurant_recipes", path: "/dashboard/restaurant/recipes", icon: Layers, permissionKey: "products" },
      ],
    },
    {
      titleKey: "restaurant_procurement",
      colorKey: "sky",
      links: [
        { nameKey: "restaurant_purchases", path: "/dashboard/purchase", icon: Truck, permissionKey: "purchase" },
        { nameKey: "restaurant_expenses", path: "/dashboard/expenses", icon: TrendingDown, permissionKey: "expenses" },
      ],
    },
    {
      titleKey: "financials_khata",
      colorKey: "amber",
      links: [
        { nameKey: "register_ledger", path: "/dashboard/registers", icon: Calculator, permissionKey: "registers" },
        { nameKey: "accounts_ledger", path: "/dashboard/accounts", icon: Banknote, permissionKey: "accounts" },
        { nameKey: "restaurant_reports", path: "/dashboard/restaurant/reports", icon: BarChart3, permissionKey: "dashboard" },
        { nameKey: "general_ledger_link", path: "/dashboard/reports/gl", icon: Scale, permissionKey: "accounts" },
        { nameKey: "period_closing", path: "/dashboard/settings/closing", icon: BookMarked, permissionKey: "accounts" },
      ],
    },
    {
      titleKey: "hr_staff_section",
      colorKey: "teal",
      links: [
        { nameKey: "staff_management", path: "/dashboard/staff", icon: ShieldCheck, permissionKey: "staff" },
        ...(input.hasPayroll
          ? [{ nameKey: "payroll_module", path: "/dashboard/staff?tab=payroll", icon: Users, permissionKey: "staff" }]
          : []),
      ],
    },
    {
      titleKey: "analytics_reports_section",
      colorKey: "emerald",
      links: [{ nameKey: "reports_pdf", path: "/dashboard/reports", icon: BarChart3, permissionKey: "dashboard" }],
    },
    {
      titleKey: "system",
      colorKey: "violet",
      links: [
        { nameKey: "settings", path: "/dashboard/settings", icon: Settings, permissionKey: "settings" },
        { nameKey: "database_backups", path: "/dashboard/backup", icon: Database, permissionKey: "backup" },
        { nameKey: "billing_plans", path: "/dashboard/billing", icon: Crown, permissionKey: "dashboard" },
      ],
    },
  ];
}

function buildTailorSections(input: SidebarSectionsInput): SidebarSection[] {
  return [
    {
      titleKey: "tailor_ops",
      colorKey: "teal",
      links: [
        { nameKey: "overview", path: "/dashboard", icon: LayoutDashboard, permissionKey: "dashboard" },
        { nameKey: "tailor_measurements", path: "/dashboard/tailor/measurements", icon: Scissors, permissionKey: "dashboard" },
        { nameKey: "tailor_orders", path: "/dashboard/tailor/orders", icon: Shirt, permissionKey: "dashboard" },
        { nameKey: "tailor_karigar", path: "/dashboard/tailor/karigar", icon: Users, permissionKey: "dashboard" },
        { nameKey: "tailor_reports", path: "/dashboard/tailor/reports", icon: BarChart3, permissionKey: "dashboard" },
      ],
    },
    {
      titleKey: "sales_relations",
      colorKey: "sky",
      links: [{ nameKey: "khata_ledger", path: "/dashboard/khata", icon: BookOpen, permissionKey: "khata" }],
    },
    {
      titleKey: "financials_khata",
      colorKey: "amber",
      links: [
        { nameKey: "accounts_ledger", path: "/dashboard/accounts", icon: Banknote, permissionKey: "accounts" },
        { nameKey: "general_ledger_link", path: "/dashboard/reports/gl", icon: Scale, permissionKey: "accounts" },
        { nameKey: "expenses", path: "/dashboard/expenses", icon: TrendingDown, permissionKey: "expenses" },
        { nameKey: "period_closing", path: "/dashboard/settings/closing", icon: BookMarked, permissionKey: "accounts" },
      ],
    },
    {
      titleKey: "hr_staff_section",
      colorKey: "violet",
      links: [
        { nameKey: "staff_management", path: "/dashboard/staff", icon: ShieldCheck, permissionKey: "staff" },
        ...(input.hasPayroll
          ? [{ nameKey: "payroll_module", path: "/dashboard/staff?tab=payroll", icon: Users, permissionKey: "staff" }]
          : []),
      ],
    },
    {
      titleKey: "system",
      colorKey: "rose",
      links: [
        { nameKey: "settings", path: "/dashboard/settings", icon: Settings, permissionKey: "settings" },
        { nameKey: "database_backups", path: "/dashboard/backup", icon: Database, permissionKey: "backup" },
        { nameKey: "billing_plans", path: "/dashboard/billing", icon: Crown, permissionKey: "dashboard" },
      ],
    },
  ];
}

function buildDefaultSections(input: SidebarSectionsInput): SidebarSection[] {
  const industryModuleSection =
    input.industryType &&
    input.industryType !== "tailor" &&
    input.industryType !== "restaurant"
      ? buildIndustryModuleSection(input.industryType, input.hasEmi)
      : null;

  return [
    {
      titleKey: "core_sales",
      colorKey: "cyan",
      links: [
        { nameKey: "overview", path: "/dashboard", icon: LayoutDashboard, permissionKey: "dashboard" },
        { nameKey: "pos", path: "/dashboard/pos", icon: ShoppingCart, permissionKey: "pos" },
        ...(input.hasEcommerce
          ? [{ nameKey: "ecommerce_desk", path: "/dashboard/ecommerce", icon: ShoppingBag, permissionKey: "sales" }]
          : []),
      ],
    },
    {
      titleKey: "sales_relations",
      colorKey: "sky",
      links: [
        { nameKey: "sales_ledger", path: "/dashboard/sales", icon: TrendingUp, permissionKey: "sales" },
        { nameKey: "khata_ledger", path: "/dashboard/khata", icon: BookOpen, permissionKey: "khata" },
        ...(input.hasGiftCards
          ? [{ nameKey: "general_giftcards", path: "/dashboard/general/cards", icon: CreditCard, permissionKey: "sales" }]
          : []),
      ],
    },
    {
      titleKey: "procurement_expenses",
      colorKey: "rose",
      links: [
        { nameKey: "purchase_stock_in", path: "/dashboard/purchase", icon: Truck, permissionKey: "purchase" },
        { nameKey: "Stock Transfer", path: "/dashboard/products/stock-transfer", icon: ArrowRightLeft, permissionKey: "products" },
        { nameKey: "returns_adjustments", path: "/dashboard/returns", icon: RotateCcw, permissionKey: "returns" },
      ],
    },
    {
      titleKey: "inventory_catalog",
      colorKey: "purple",
      links: [
        { nameKey: "products_stock", path: "/dashboard/products", icon: Boxes, permissionKey: "products" },
        ...(input.industryType === "pharmacy" || input.industryType === "medical" || input.industryType === "health"
          ? [{ nameKey: "drug_directory", path: "/dashboard/products?tab=master-drugs", icon: Pill, permissionKey: "products" }]
          : []),
        { nameKey: "low_stock_alerts", path: "/dashboard/inventory/low-stock", icon: AlertTriangle, permissionKey: "products" },
        { nameKey: "categories", path: "/dashboard/products?tab=categories", icon: Tag, permissionKey: "categories" },
        ...(input.industryType !== "general"
          ? [{ nameKey: "brands", path: "/dashboard/products?tab=brands", icon: Star, permissionKey: "brands" }]
          : []),
        ...(input.industryType !== "general"
          ? [{ nameKey: "units_packings", path: "/dashboard/units", icon: Layers, permissionKey: "units" }]
          : []),
        { nameKey: "general_variations", path: "/dashboard/general/variations", icon: Package, permissionKey: "products" },
        { nameKey: "general_barcodes", path: "/dashboard/general/barcodes", icon: QrCode, permissionKey: "products" },
      ],
    },
    ...(industryModuleSection ? [industryModuleSection] : []),
    {
      titleKey: "financials_khata",
      colorKey: "amber",
      links: [
        { nameKey: "register_ledger", path: "/dashboard/registers", icon: Calculator, permissionKey: "registers" },
        { nameKey: "accounts_ledger", path: "/dashboard/accounts", icon: Banknote, permissionKey: "accounts" },
        { nameKey: "general_ledger_link", path: "/dashboard/reports/gl", icon: Scale, permissionKey: "accounts" },
        { nameKey: "expenses", path: "/dashboard/expenses", icon: TrendingDown, permissionKey: "expenses" },
        ...(input.hasTax
          ? [{ nameKey: "tax_module", path: "/dashboard/reports?tab=tax", icon: Calculator, permissionKey: "reports" }]
          : []),
        ...(input.hasAssetsRec
          ? [{ nameKey: "assets_module", path: "/dashboard/accounts?tab=assets", icon: Building, permissionKey: "accounts" }]
          : []),
        { nameKey: "period_closing", path: "/dashboard/settings/closing", icon: BookMarked, permissionKey: "accounts" },
      ],
    },
    {
      titleKey: "hr_staff_section",
      colorKey: "teal",
      links: [
        { nameKey: "staff_management", path: "/dashboard/staff", icon: ShieldCheck, permissionKey: "staff" },
        ...(input.hasPayroll
          ? [{ nameKey: "payroll_module", path: "/dashboard/staff?tab=payroll", icon: Users, permissionKey: "staff" }]
          : []),
      ],
    },
    {
      titleKey: "analytics_reports_section",
      colorKey: "emerald",
      links: [{ nameKey: "reports_pdf", path: "/dashboard/reports", icon: BarChart3, permissionKey: "dashboard" }],
    },
    {
      titleKey: "system",
      colorKey: "violet",
      links: [
        { nameKey: "settings", path: "/dashboard/settings", icon: Settings, permissionKey: "settings" },
        { nameKey: "ai_store_wizard", path: "/dashboard/settings/wizard", icon: Sparkles, permissionKey: "settings" },
        { nameKey: "data_migration", path: "/dashboard/settings/migration", icon: FileUp, permissionKey: "settings" },
        { nameKey: "database_backups", path: "/dashboard/backup", icon: Database, permissionKey: "backup" },
        { nameKey: "billing_plans", path: "/dashboard/billing", icon: Crown, permissionKey: "dashboard" },
      ],
    },
  ];
}

function buildShowroomSections(input: SidebarSectionsInput): SidebarSection[] {
  return [
    {
      titleKey: "showroom_title",
      colorKey: "violet",
      links: [
        { nameKey: "overview", path: "/dashboard", icon: LayoutDashboard, permissionKey: "dashboard" },
        { nameKey: "showroom_vehicles", path: "/dashboard/showroom/vehicles", icon: Car, permissionKey: "dashboard" },
        { nameKey: "showroom_sales", path: "/dashboard/showroom/sales", icon: ShoppingCart, permissionKey: "dashboard" },
        { nameKey: "showroom_installments", path: "/dashboard/showroom/installments", icon: CreditCard, permissionKey: "dashboard" },
        { nameKey: "showroom_parties", path: "/dashboard/showroom/parties", icon: Users, permissionKey: "dashboard" },
        { nameKey: "showroom_investors", path: "/dashboard/showroom/investors", icon: Landmark, permissionKey: "dashboard" },
        { nameKey: "showroom_rentals", path: "/dashboard/showroom/rentals", icon: Banknote, permissionKey: "dashboard" },
      ],
    },
    {
      titleKey: "sales_relations",
      colorKey: "sky",
      links: [
        { nameKey: "sales_ledger", path: "/dashboard/sales", icon: TrendingUp, permissionKey: "sales" },
        { nameKey: "khata_ledger", path: "/dashboard/khata", icon: BookOpen, permissionKey: "khata" },
      ],
    },
    {
      titleKey: "financials_khata",
      colorKey: "amber",
      links: [
        { nameKey: "register_ledger", path: "/dashboard/registers", icon: Calculator, permissionKey: "registers" },
        { nameKey: "accounts_ledger", path: "/dashboard/accounts", icon: Banknote, permissionKey: "accounts" },
        { nameKey: "general_ledger_link", path: "/dashboard/reports/gl", icon: Scale, permissionKey: "accounts" },
        { nameKey: "expenses", path: "/dashboard/expenses", icon: TrendingDown, permissionKey: "expenses" },
        { nameKey: "period_closing", path: "/dashboard/settings/closing", icon: BookMarked, permissionKey: "accounts" },
      ],
    },
    {
      titleKey: "analytics_reports_section",
      colorKey: "emerald",
      links: [
        { nameKey: "showroom_reports", path: "/dashboard/showroom/reports", icon: BarChart3, permissionKey: "dashboard" },
      ],
    },
    {
      titleKey: "hr_staff_section",
      colorKey: "teal",
      links: [
        { nameKey: "staff_management", path: "/dashboard/staff", icon: ShieldCheck, permissionKey: "staff" },
        ...(input.hasPayroll
          ? [{ nameKey: "payroll_module", path: "/dashboard/staff?tab=payroll", icon: Users, permissionKey: "staff" }]
          : []),
      ],
    },
    {
      titleKey: "system",
      colorKey: "rose",
      links: [
        { nameKey: "settings", path: "/dashboard/settings", icon: Settings, permissionKey: "settings" },
        { nameKey: "database_backups", path: "/dashboard/backup", icon: Database, permissionKey: "backup" },
        { nameKey: "billing_plans", path: "/dashboard/billing", icon: Crown, permissionKey: "dashboard" },
      ],
    },
  ];
}

export function buildSidebarSections(input: SidebarSectionsInput): SidebarSection[] {
  let sections: SidebarSection[];

  if (input.industryType === "restaurant") {
    sections = buildRestaurantSections(input);
  } else if (input.industryType === "tailor") {
    sections = buildTailorSections(input);
  } else if (input.industryType === "showroom") {
    sections = buildShowroomSections(input);
  } else {
    sections = buildDefaultSections(input);
  }

  const effectiveTier = getEffectiveTierId(input.subscriptionTier, input.subscriptionExpiresAt);
  const planForSupport = resolvePlan(effectiveTier, input.remotePlans || []);

  if (planForSupport.allow_support) {
    sections.push({
      titleKey: "support_section",
      colorKey: "indigo",
      links: [{ nameKey: "support_tickets", path: "/dashboard/support", icon: HeartHandshake, permissionKey: "dashboard" }],
    });
  }

  if (shouldHideBillingAndPlans()) {
    sections = sections.map((section) => ({
      ...section,
      links: section.links.filter((link) => link.path !== "/dashboard/billing"),
    }));
  }

  if (shouldDisableBackupRestore()) {
    sections = sections.map((section) => ({
      ...section,
      links: section.links.filter((link) => link.path !== "/dashboard/backup"),
    }));
  }

  return sections;
}
