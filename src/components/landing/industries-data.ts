import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Building2,
  Car,
  ChefHat,
  FileText,
  FlaskConical,
  Fuel,
  Gem,
  Leaf,
  Pill,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Store,
  Truck,
  Wrench,
  BookOpen,
  Eye,
  Heart,
  Home,
  Sparkles,
  Utensils
} from "lucide-react";

export type IndustryPack = {
  id: string;
  title: string;
  desc: string;
  status: "ready" | "development";
  covers: string[];
  features: string[];
  icon: LucideIcon;
  accent: string;
  image: string;
};

export const industries: IndustryPack[] = [
  {
    id: "pharmacy",
    title: "Pharmacy & Medical Store",
    desc: "Narcotics tracking, Batch expiry alerts & generic formula search",
    status: "ready",
    covers: ["Pharmacies", "Medical Stores", "Surgical Goods", "Distributors"],
    features: ["Batch Expiry Alerts", "Formula Search", "Pill/Strip Math", "Doctor Rx Log"],
    icon: Pill,
    accent: "#0f9f6e",
    image: "/images/theaccounts_pos_dashboard_monitor.png"
  },
  {
    id: "restaurant",
    title: "Restaurant, Cafe & Fast Food",
    desc: "Kitchen display (KDS), KOT print slips, Table floor maps & QR menus",
    status: "ready",
    covers: ["Fine Dining", "Fast Food", "Cafes", "Bakeries", "Dhabas"],
    features: ["Kitchen Display (KDS)", "KOT Ticket Printing", "Table Floor Map", "QR Order App"],
    icon: ChefHat,
    accent: "#e11d48",
    image: "/images/pos_terminal_3d.png"
  },
  {
    id: "garments",
    title: "Garments, Apparel & Boutique",
    desc: "Size, Color & Fit matrix grid with barcode tags & fitting notes",
    status: "ready",
    covers: ["Boutiques", "Cloth Stores", "Garments", "Footwear Chains"],
    features: ["Size/Color Matrix", "Custom Barcode Tags", "Fitting Notes", "Seasonal Discount"],
    icon: Shirt,
    accent: "#9333ea",
    image: "/hero_preview.png"
  },
  {
    id: "electronics",
    title: "Mobile Shop & Electronics",
    desc: "IMEI / Serial number tracking, Repair job sheets & Warranty slips",
    status: "ready",
    covers: ["Mobile Shops", "Computer Hardware", "Home Appliances", "Repairs"],
    features: ["IMEI Tracking", "Repair Job Sheets", "Serial Warranty", "Parts Inventory"],
    icon: Smartphone,
    accent: "#2563eb",
    image: "/images/ai_scanner_preview.png"
  },
  {
    id: "tailor",
    title: "Tailor & Stitching Shop",
    desc: "Customer body naap, Canvas collar sketches & Karigar wage assignment",
    status: "ready",
    covers: ["Gents Tailor", "Ladies Boutique", "Stitching Shops", "Dress Makers"],
    features: ["Body Naap Book", "Collar Canvas Sketch", "Karigar Wages", "Order Status"],
    icon: Scissors,
    accent: "#d97706",
    image: "/images/pos_terminal_isolated.png"
  },
  {
    id: "fertilizer",
    title: "Fertilizer, Seeds & Agro Chemical",
    desc: "Kisan CNIC logs, Govt subsidy compliance & Batch pesticide licenses",
    status: "ready",
    covers: ["Fertilizer Dealers", "Seed Outlets", "Agro Chemicals", "Pesticide Outlets"],
    features: ["Kisan CNIC Register", "Govt Subsidy Log", "Pesticide Licenses", "Batch Expiry"],
    icon: Leaf,
    accent: "#16a34a",
    image: "/images/theaccounts_pos_dashboard_monitor.png"
  },
  {
    id: "supermarket",
    title: "Supermarket & Karyana Store",
    desc: "Fast barcode scanning, Serial weighing scale & Loose item lookup",
    status: "ready",
    covers: ["General Stores", "Supermarkets", "Mart Outlets", "Cash & Carry"],
    features: ["Scale Auto Sync", "Fast Barcode POS", "Multi-Cart Hold", "WhatsApp Bills"],
    icon: Store,
    accent: "#0891b2",
    image: "/images/pos_terminal_3d.png"
  },
  {
    id: "showroom",
    title: "Auto Showroom & Spare Parts",
    desc: "Vehicle chassis tracking, Installment ledger & Spare parts rack numbers",
    status: "ready",
    covers: ["Car Showrooms", "Bike Dealers", "Spare Parts", "Auto Workshops"],
    features: ["Chassis/Engine Log", "Installment Ledger", "Part Rack Numbers", "Work Orders"],
    icon: Car,
    accent: "#dc2626",
    image: "/hero_preview.png"
  },
  {
    id: "fuel",
    title: "Fuel Pump & Filling Station",
    desc: "Tank dip readings, Nozzle meter counters & Fuel density records",
    status: "ready",
    covers: ["Petrol Pumps", "CNG Stations", "LPG Outlets", "Oil Depots"],
    features: ["Tank Dip Reading", "Nozzle Meter Counter", "Density Records", "Shift Closing"],
    icon: Fuel,
    accent: "#ea580c",
    image: "/images/ai_scanner_preview.png"
  },
  {
    id: "hardware",
    title: "Hardware & Building Material",
    desc: "Dimensional feet/meter calculations, Cement bag bundles & Contractor ledgers",
    status: "ready",
    covers: ["Hardware Stores", "Sanitary Shops", "Paint Outlets", "Building Supply"],
    features: ["Dimensional Billing", "Contractor Ledgers", "Truck Weight Slips", "Bulk Items"],
    icon: Wrench,
    accent: "#4f46e5",
    image: "/images/pos_terminal_isolated.png"
  },
  {
    id: "cosmetics",
    title: "Cosmetics & Beauty Parlor",
    desc: "Batch expiry tracking, Salon appointments & Parlor service packages",
    status: "ready",
    covers: ["Cosmetic Shops", "Beauty Salons", "Barber Shops", "Spa Centers"],
    features: ["Service Packages", "Staff Commission", "Expiry Warning", "Appointment Book"],
    icon: Sparkles,
    accent: "#ec4899",
    image: "/images/theaccounts_pos_dashboard_monitor.png"
  },
  {
    id: "jewelry",
    title: "Jewelry & Gold Shop",
    desc: "Ratti/Masha gold weight conversion, Making charges & Purity gold rate",
    status: "ready",
    covers: ["Gold Jewellers", "Silver Outlets", "Gem Stores", "Ornaments"],
    features: ["Ratti/Masha Conversion", "Making Charges", "Daily Gold Rate", "Certificate Print"],
    icon: Gem,
    accent: "#ca8a04",
    image: "/images/pos_terminal_3d.png"
  },
  {
    id: "bakery",
    title: "Bakery & Confectionery",
    desc: "Perishable item batch expiry, Custom cake booking & Live KOT slips",
    status: "ready",
    covers: ["Bakeries", "Sweets Shops", "Ice Cream Parlors", "Confectionery"],
    features: ["Custom Cake Booking", "Perishable Batch", "Fast Counter POS", "Weight Scale"],
    icon: Utensils,
    accent: "#b45309",
    image: "/hero_preview.png"
  },
  {
    id: "bookshop",
    title: "Bookshop & Stationers",
    desc: "Publisher codes, Author index, School syllabus bundles & Custom barcodes",
    status: "ready",
    covers: ["Bookstores", "Stationery Shops", "School Supplies", "Publishers"],
    features: ["School Syllabus Bundles", "Publisher Index", "Barcode Printing", "Return Ledger"],
    icon: BookOpen,
    accent: "#0284c7",
    image: "/images/ai_scanner_preview.png"
  },
  {
    id: "optical",
    title: "Optical & Eyewear Store",
    desc: "Eye refraction specs (Sphere/Cylinder/Axis), Frame codes & Lens orders",
    status: "ready",
    covers: ["Optical Shops", "Eyewear Outlets", "Opticians", "Lens Centers"],
    features: ["Eye Refraction Log", "Lens Order Status", "Frame Barcodes", "Doctor Prescriptions"],
    icon: Eye,
    accent: "#0d9488",
    image: "/images/pos_terminal_isolated.png"
  },
  {
    id: "footwear",
    title: "Shoe Store & Footwear",
    desc: "Pair size grid, Brand article codes, Box barcodes & Clearance tags",
    status: "ready",
    covers: ["Shoe Stores", "Footwear Chains", "Leather Goods", "Bag Outlets"],
    features: ["Pair Size Matrix", "Article Code Search", "Box Barcodes", "Clearance Discount"],
    icon: ShoppingBag,
    accent: "#6366f1",
    image: "/images/theaccounts_pos_dashboard_monitor.png"
  },
  {
    id: "marquee",
    title: "Marquee & Banquet Hall",
    desc: "Event booking calendar, Per-head package calculator & Catering menu",
    status: "ready",
    covers: ["Banquet Halls", "Marquees", "Catering Services", "Event Planners"],
    features: ["Event Calendar Book", "Per-Head Pricing", "Catering Menu", "Advance Receipts"],
    icon: Building2,
    accent: "#7c3aed",
    image: "/images/pos_terminal_3d.png"
  },
  {
    id: "matchmaking",
    title: "Hopelink Rishta & Matchmaking",
    desc: "Client matchmaking CRM with caste/location filtering & family notes",
    status: "ready",
    covers: ["Rishta Services", "Matchmaking Agencies", "Family Consultants", "CRM Outlets"],
    features: ["Caste/Location Filter", "Private Profile Matching", "Subscription Ledger", "WhatsApp Profiles"],
    icon: Heart,
    accent: "#e11d48",
    image: "/hero_preview.png"
  },
  {
    id: "realestate",
    title: "Real Estate & Property Agency",
    desc: "Plot & property listings, Buyer lead management & Monthly rent ledgers",
    status: "ready",
    covers: ["Real Estate Agencies", "Property Dealers", "Rent Managers", "Builders"],
    features: ["Property Listings", "Buyer Lead CRM", "Rent Collection Book", "Commission Calculator"],
    icon: Home,
    accent: "#059669",
    image: "/images/ai_scanner_preview.png"
  },
  {
    id: "wholesale",
    title: "Wholesale Distribution & FMCG",
    desc: "Bulk carton pricing, Credit payment terms & Route salesman dispatch",
    status: "ready",
    covers: ["Wholesale Hubs", "FMCG Distributors", "Commodity Outlets", "Trade Supply"],
    features: ["Carton Tier Pricing", "Route Salesman App", "Credit Cap Ledger", "Dispatch Invoices"],
    icon: Truck,
    accent: "#3b82f6",
    image: "/images/pos_terminal_isolated.png"
  }
];
