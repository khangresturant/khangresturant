import { pgTable, uuid, timestamp, numeric, varchar, integer, text, date } from "drizzle-orm/pg-core";

// -------------------------------------------------------------
// 1. GOLDSMITH & JEWELRY MODULE TABLES
// -------------------------------------------------------------

export const goldRates = pgTable("gold_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  gold24kRate: numeric("gold_24k_rate", { precision: 12, scale: 2 }).notNull(),
  gold22kRate: numeric("gold_22k_rate", { precision: 12, scale: 2 }).notNull(),
  gold21kRate: numeric("gold_21k_rate", { precision: 12, scale: 2 }).notNull(),
  gold18kRate: numeric("gold_18k_rate", { precision: 12, scale: 2 }).notNull(),
  silverRate: numeric("silver_rate", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const goldTransactions = pgTable("gold_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  partyId: uuid("party_id"), // Customer reference (nullable)
  weightTola: numeric("weight_tola", { precision: 8, scale: 3 }).default("0.000").notNull(),
  weightMasha: numeric("weight_masha", { precision: 8, scale: 3 }).default("0.000").notNull(),
  weightRatti: numeric("weight_ratti", { precision: 8, scale: 3 }).default("0.000").notNull(),
  netWeightGrams: numeric("net_weight_grams", { precision: 10, scale: 4 }).notNull(),
  metalType: varchar("metal_type", { length: 50 }).notNull(), // 'gold_24k', 'gold_22k', etc.
  ratePerGram: numeric("rate_per_gram", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const goldKarigarTransactions = pgTable("gold_karigar_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  karigarId: uuid("karigar_id"), // Karigar reference
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // 'wage', 'metal_handover', 'wastage'
  amount: numeric("amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  weightGrams: numeric("weight_grams", { precision: 10, scale: 4 }).default("0.0000").notNull(),
  wastageGrams: numeric("wastage_grams", { precision: 10, scale: 4 }).default("0.0000").notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const goldInventory = pgTable("gold_inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  grossWeight: numeric("gross_weight", { precision: 10, scale: 4 }).notNull(),
  netWeight: numeric("net_weight", { precision: 10, scale: 4 }).notNull(),
  caratPurity: integer("carat_purity").notNull(), // 24, 22, 21, 18
  stockStatus: varchar("stock_status", { length: 50 }).default("in_stock").notNull(), // 'in_stock', 'sold'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------
// 2. FRUIT & VEGETABLE MODULE TABLES
// -------------------------------------------------------------

export const dailyMarketRates = pgTable("daily_market_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  productId: uuid("product_id").notNull(),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull(),
  rateDate: date("rate_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  productId: uuid("product_id").notNull(),
  adjustmentType: varchar("adjustment_type", { length: 50 }).notNull(), // 'spoilage', 'dehydration', 'theft'
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  costLoss: numeric("cost_loss", { precision: 12, scale: 2 }).notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------
// 3. PHOTOCOPY & PRINT SHOP MODULE TABLES
// -------------------------------------------------------------

export const printPricingGrids = pgTable("print_pricing_grids", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  paperSize: varchar("paper_size", { length: 50 }).notNull(), // 'A4', 'Legal', 'A3', etc.
  printType: varchar("print_type", { length: 50 }).notNull(), // 'color', 'bw'
  ratePerPage: numeric("rate_per_page", { precision: 8, scale: 2 }).notNull(),
  discountThreshold: integer("discount_threshold").default(0).notNull(),
  discountRate: numeric("discount_rate", { precision: 8, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const printJobs = pgTable("print_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  paperSize: varchar("paper_size", { length: 50 }).notNull(),
  printType: varchar("print_type", { length: 50 }).notNull(),
  totalPages: integer("total_pages").notNull(),
  totalCopies: integer("total_copies").default(1).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // 'pending', 'printing', 'completed', 'collected'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// -------------------------------------------------------------
// 4. SUI GAS & LPG CYLINDER SHOP MODULE TABLES
// -------------------------------------------------------------

export const gasTransactions = pgTable("gas_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  cylinderSerial: varchar("cylinder_serial", { length: 100 }).notNull(),
  emptyWeight: numeric("empty_weight", { precision: 8, scale: 3 }).notNull(),
  filledWeight: numeric("filled_weight", { precision: 8, scale: 3 }).notNull(),
  netGasWeight: numeric("net_gas_weight", { precision: 8, scale: 3 }).notNull(),
  ratePerKg: numeric("rate_per_kg", { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cylinderInventory = pgTable("cylinder_inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  serialNumber: varchar("serial_number", { length: 100 }).notNull(),
  sizeKg: numeric("size_kg", { precision: 6, scale: 2 }).notNull(),
  ownerType: varchar("owner_type", { length: 50 }).notNull(), // 'shop', 'customer', 'supplier'
  status: varchar("status", { length: 50 }).default("empty").notNull(), // 'empty', 'filled', 'loaned'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cylinderDeposits = pgTable("cylinder_deposits", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").notNull(),
  partyId: uuid("party_id").notNull(), // Customer ID
  cylinderId: uuid("cylinder_id").notNull(),
  depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(), // 'active', 'refunded'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
