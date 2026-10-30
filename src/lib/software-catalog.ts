export interface SoftwareProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: 'Pharmacy' | 'Restaurant' | 'Retail & POS' | 'Specialized ERP' | 'Services';
  pricePKR: number;
  originalPricePKR: number;
  version: string;
  downloadUrl: string;
  fileSize: string;
  iconName: string;
  badge?: string;
  description: string;
  features: string[];
  systemRequirements: string[];
  supportsNarcotics?: boolean;
  supportsThermalPrinter?: boolean;
  supportsBarcodeScanner?: boolean;
  supportsDoubleEntry?: boolean;
}

export const SOFTWARE_PRODUCTS: SoftwareProduct[] = [
  {
    id: 'soft-pharmacy-vip',
    slug: 'The Accounts-pharmacy-vip',
    name: 'The Accounts VIP Pharmacy POS & ERP',
    tagline: 'Complete Narcotics Tracking, Batch Expiry Management & Double-Entry Accounting for Pharmacies',
    category: 'Pharmacy',
    pricePKR: 25000,
    originalPricePKR: 35000,
    version: 'v4.2.0',
    downloadUrl: '/downloads/TheAccounts_Pharmacy_Setup.exe',
    fileSize: '89.5 MB',
    iconName: 'Pill',
    badge: 'BESTSELLER',
    description: 'Specialized point of sale and stock management system designed specifically for retail pharmacies, medical stores, and wholesale medicine distributors.',
    features: [
      'Narcotics & Controlled Drugs Patient/Doctor Registration',
      'Batch & Expiry Date Auto-Alerts',
      'Box/Pack to Single Tablet/Strip Unit Conversion',
      'Automated Double-Entry Accounting (COGS & General Ledger)',
      'Thermal Receipt (58mm/80mm) & A4 Invoice Printing',
      'Hardware Cash Drawer & Barcode Scanner Integration',
      'Google Drive Automatic Database Backups'
    ],
    systemRequirements: ['Windows 10 / 11 (64-bit)', '4 GB RAM (8 GB Recommended)', 'Core i3 or higher', '500 MB Free Disk Space'],
    supportsNarcotics: true,
    supportsThermalPrinter: true,
    supportsBarcodeScanner: true,
    supportsDoubleEntry: true,
  },
  {
    id: 'soft-restaurant-pos',
    slug: 'The Accounts-restaurant-pos',
    name: 'The Accounts Restaurant & Cafe POS',
    tagline: 'KOT Printing, Table Management, Recipe Costing & Takeaway/Delivery Billing System',
    category: 'Restaurant',
    pricePKR: 30000,
    originalPricePKR: 45000,
    version: 'v3.8.0',
    downloadUrl: '/downloads/TheAccounts_Restaurant_Setup.exe',
    fileSize: '76.2 MB',
    iconName: 'Utensils',
    badge: 'POPULAR',
    description: 'All-in-one restaurant management software with Kitchen Order Token (KOT) routing, table layout management, recipe ingredient stock deduction, and rider delivery tracking.',
    features: [
      'Kitchen Order Token (KOT) Multi-Printer Dispatch',
      'Graphical Floor & Table Order Management',
      'Dine-In, Takeaway, and Home Delivery Billing Modes',
      'Ingredient Level Inventory Deduction (Recipe Costing)',
      'Deal & Combo Meal Builder with Modifiers',
      'Waiter Order App Sync & Rider Management',
      'Daily Sales & Shift Closing (Z-Report)'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM', 'Core i3 / Celeron', '300 MB Free Space'],
    supportsThermalPrinter: true,
    supportsDoubleEntry: true,
  },
  {
    id: 'soft-grocery-supermarket',
    slug: 'The Accounts-grocery-supermarket',
    name: 'The Accounts Supermarket & General Store POS',
    tagline: 'High-Speed Barcode Billing, Weighing Scale Integration & Bulk Stock Management',
    category: 'Retail & POS',
    pricePKR: 25000,
    originalPricePKR: 35000,
    version: 'v5.1.0',
    downloadUrl: '/downloads/TheAccounts_Supermarket_Setup.exe',
    fileSize: '82.0 MB',
    iconName: 'ShoppingBag',
    badge: 'FEATURED',
    description: 'Designed for fast-paced retail checkout in general stores, marts, and departmental supermarkets with support for barcode label printing and electronic weight scale barcode parsing.',
    features: [
      'Ultra-Fast Barcode Scanning & Checkout Interface',
      'Electronic Weight Scale Barcode Auto-Parsing',
      'Barcode Label Generator & Designer Built-in',
      'Customer Loyalty Points & Membership Cards',
      'Multi-Pack & Wholesale Tier Pricing',
      'Re-order Alerts & Supplier Purchase Orders',
      'Low Stock & Fast Selling Item Reports'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM', 'Core i3', '400 MB Free Space'],
    supportsBarcodeScanner: true,
    supportsThermalPrinter: true,
  },
  {
    id: 'soft-electronics-mobile',
    slug: 'The Accounts-electronics-mobile',
    name: 'The Accounts Electronics & Mobile Shop ERP',
    tagline: 'IMEI/Serial Tracking, Installment Sales Management & Mobile Repair Ticketing',
    category: 'Specialized ERP',
    pricePKR: 28000,
    originalPricePKR: 40000,
    version: 'v4.0.1',
    downloadUrl: '/downloads/TheAccounts_Electronics_Setup.exe',
    fileSize: '91.0 MB',
    iconName: 'Smartphone',
    badge: 'NEW',
    description: 'Specialized management system for mobile phone shops, electronics stores, and home appliance showrooms with complete IMEI tracking and customer installment schedule manager.',
    features: [
      'Unique IMEI / Serial Number Purchase & Sale Tracking',
      'Customer Installment (Kist) Plan Builder & Due Date Reminders',
      'Mobile Repairing Job Sheet & Status Ticketing',
      'Old Phone Trade-in / Exchange Billing',
      'Warranty Card & Guarantee Slip Generation',
      'Vendor Payable & Customer Receivable Ledger'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM', 'Core i3 or higher'],
    supportsBarcodeScanner: true,
    supportsDoubleEntry: true,
  },
  {
    id: 'soft-fertilizer-pesticides',
    slug: 'The Accounts-fertilizer-pesticides',
    name: 'The Accounts Agriculture & Fertilizer ERP',
    tagline: 'Batch Control, Government Subsidy Records, Farmer Credit Ledger & Chemical Stocking',
    category: 'Specialized ERP',
    pricePKR: 35000,
    originalPricePKR: 50000,
    version: 'v3.1.0',
    downloadUrl: '/downloads/TheAccounts_Fertilizer_Setup.exe',
    fileSize: '88.4 MB',
    iconName: 'Tractor',
    description: 'Comprehensive software for agri-dealers selling fertilizers, seeds, and crop protection chemicals with farmer ledger management and seasonal credit tracking.',
    features: [
      'CNIC-based Farmer Credit Account Management',
      'Subsidy & Govt Regulatory Compliance Logging',
      'Batch Number & Expiry Date Verification',
      'Seasonal Recovery & Due Payment Reminders',
      'Commission Agent (Arhtia) Billing Support'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM'],
    supportsDoubleEntry: true,
  },
  {
    id: 'soft-garments-boutique',
    slug: 'The Accounts-garments-boutique',
    name: 'The Accounts Apparel, Garments & Boutique POS',
    tagline: 'Size, Color & Style Matrix Management with Barcode Tag Generation',
    category: 'Retail & POS',
    pricePKR: 22000,
    originalPricePKR: 32000,
    version: 'v2.9.0',
    downloadUrl: '/downloads/TheAccounts_Garments_Setup.exe',
    fileSize: '69.0 MB',
    iconName: 'Shirt',
    description: 'Designed for clothing stores, footwear outlets, and boutique shops with multi-dimensional variant management (Size/Color/Fabric).',
    features: [
      'Size & Color Grid Inventory Matrix',
      'Custom Hanging Tag Barcode Label Printing',
      'Season Sales & Discount Campaign Manager',
      'Exchange & Return Policy Enforcement',
      'Sales Commission by Staff / Salesman'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM'],
    supportsBarcodeScanner: true,
    supportsThermalPrinter: true,
  },
  {
    id: 'soft-tailor-master',
    slug: 'The Accounts-tailor-master',
    name: 'The Accounts Tailor Master & Boutique ERP',
    tagline: 'Customer Body Measurements Records, Karigar Job Orders & Delivery Management',
    category: 'Services',
    pricePKR: 20000,
    originalPricePKR: 28000,
    version: 'v3.0.0',
    downloadUrl: '/downloads/TheAccounts_Tailor_Setup.exe',
    fileSize: '64.5 MB',
    iconName: 'Scissors',
    description: 'Tailoring shop software for keeping detailed customer measurement history, suit/shirt style preferences, craftsman (Karigar) labor payouts, and order trial dates.',
    features: [
      'Custom Measurement Profiles per Customer',
      'Karigar Job Slips & Wage Ledger',
      'Order Status: Booked, Stitched, Trial, Ready, Delivered',
      'SMS Alert Notification on Order Completion',
      'Advance Deposit & Remaining Payment Tracking'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM'],
  },
  {
    id: 'soft-hardware-building',
    slug: 'The Accounts-hardware-building',
    name: 'The Accounts Hardware & Building Material ERP',
    tagline: 'Multi-Unit Sales (Kg, Feet, Meter, Bag), Labor Transportation Charges & Wholesale Billing',
    category: 'Specialized ERP',
    pricePKR: 28000,
    originalPricePKR: 40000,
    version: 'v2.5.0',
    downloadUrl: '/downloads/TheAccounts_Hardware_Setup.exe',
    fileSize: '84.0 MB',
    iconName: 'Wrench',
    description: 'Built for sanitary, hardware, and building material stores that handle flexible measurement units, loading/unloading fees, and contractor account ledgers.',
    features: [
      'Multi-Dimensional Selling Units (Square Feet, Ton, Bundle, Piece)',
      'Contractor & Builder Ledger Management',
      'Freight & Carriage Expense Distribution',
      'Estimate / Quotation Generator with Conversion to Bill',
      'Partial Delivery Order Tracking'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM'],
    supportsDoubleEntry: true,
  },
  {
    id: 'soft-auto-parts',
    slug: 'The Accounts-auto-parts',
    name: 'The Accounts Auto Parts & Spare Store ERP',
    tagline: 'OEM Part Number Indexing, Vehicle Compatibility Search & Bin Location Locator',
    category: 'Specialized ERP',
    pricePKR: 27000,
    originalPricePKR: 38000,
    version: 'v2.2.0',
    downloadUrl: '/downloads/TheAccounts_AutoParts_Setup.exe',
    fileSize: '81.5 MB',
    iconName: 'Car',
    description: 'Specialized for automotive spare parts shops, car accessories dealers, and motorcycle spare parts wholesalers.',
    features: [
      'Part Number, Cross-Reference & OEM Lookup',
      'Vehicle Make / Model Compatibility Tagging',
      'Racks & Shelf Bin Locator Codes',
      'Mechanic & Garage Commission Accounting',
      'Wholesale vs Retail Pricing Levels'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM'],
  },
  {
    id: 'soft-bakery-sweets',
    slug: 'The Accounts-bakery-sweets',
    name: 'The Accounts Bakery & Confectionery POS',
    tagline: 'Production Batch Tracking, Expiry Items Return & Fast Touchscreen Counter Billing',
    category: 'Restaurant',
    pricePKR: 24000,
    originalPricePKR: 34000,
    version: 'v3.3.0',
    downloadUrl: '/downloads/TheAccounts_Bakery_Setup.exe',
    fileSize: '73.0 MB',
    iconName: 'Cake',
    description: 'Designed for bakeries, sweet shops, and cake boutiques with daily fresh production logging, customized cake order booking, and weight-scale pricing.',
    features: [
      'Daily Production & Raw Material Consumption Log',
      'Advance Booking for Custom Event & Birthday Cakes',
      'Expired/Damaged Goods Waste Management',
      'Fast Touchscreen Billing with Quick Buttons',
      'Shift-wise Cash Box Balancing'
    ],
    systemRequirements: ['Windows 10 / 11', '4 GB RAM'],
    supportsThermalPrinter: true,
  }
];
