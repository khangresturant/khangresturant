AAAA
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
