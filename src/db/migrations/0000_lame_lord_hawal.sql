CREATE TABLE "cylinder_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"cylinder_id" uuid NOT NULL,
	"deposit_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cylinder_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"size_kg" numeric(6, 2) NOT NULL,
	"owner_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'empty' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_market_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"cost_price" numeric(12, 2) NOT NULL,
	"sale_price" numeric(12, 2) NOT NULL,
	"rate_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gas_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"cylinder_serial" varchar(100) NOT NULL,
	"empty_weight" numeric(8, 3) NOT NULL,
	"filled_weight" numeric(8, 3) NOT NULL,
	"net_gas_weight" numeric(8, 3) NOT NULL,
	"rate_per_kg" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gold_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"gross_weight" numeric(10, 4) NOT NULL,
	"net_weight" numeric(10, 4) NOT NULL,
	"carat_purity" integer NOT NULL,
	"stock_status" varchar(50) DEFAULT 'in_stock' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gold_karigar_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"karigar_id" uuid,
	"transaction_type" varchar(50) NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"weight_grams" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"wastage_grams" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gold_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"gold_24k_rate" numeric(12, 2) NOT NULL,
	"gold_22k_rate" numeric(12, 2) NOT NULL,
	"gold_21k_rate" numeric(12, 2) NOT NULL,
	"gold_18k_rate" numeric(12, 2) NOT NULL,
	"silver_rate" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gold_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"party_id" uuid,
	"weight_tola" numeric(8, 3) DEFAULT '0.000' NOT NULL,
	"weight_masha" numeric(8, 3) DEFAULT '0.000' NOT NULL,
	"weight_ratti" numeric(8, 3) DEFAULT '0.000' NOT NULL,
	"net_weight_grams" numeric(10, 4) NOT NULL,
	"metal_type" varchar(50) NOT NULL,
	"rate_per_gram" numeric(12, 2) NOT NULL,
	"total_price" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"adjustment_type" varchar(50) NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"cost_loss" numeric(12, 2) NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"customer_name" varchar(255),
	"paper_size" varchar(50) NOT NULL,
	"print_type" varchar(50) NOT NULL,
	"total_pages" integer NOT NULL,
	"total_copies" integer DEFAULT 1 NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_pricing_grids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"paper_size" varchar(50) NOT NULL,
	"print_type" varchar(50) NOT NULL,
	"rate_per_page" numeric(8, 2) NOT NULL,
	"discount_threshold" integer DEFAULT 0 NOT NULL,
	"discount_rate" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
