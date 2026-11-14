const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Read DATABASE_URL from environment or local .env.local
let dbUrl = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL;

if (!dbUrl) {
  try {
    const envPath = path.resolve(__dirname, "../.env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^DATABASE_URL=(.+)$/m);
      if (match) {
        dbUrl = match[1].trim();
      }
    }
  } catch (e) {
    // Ignore read errors
  }
}

if (!dbUrl) {
  console.error("Error: DATABASE_URL is required.");
  process.exit(1);
}

async function generateSchemaDocs() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: false,
  });

  console.log("Connecting to PostgreSQL to fetch metadata...");
  await client.connect();

  try {
    // 1. Get all tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables.`);

    // 2. Get all columns
    const columnsRes = await client.query(`
      SELECT 
        table_name,
        column_name,
        ordinal_position,
        column_default,
        is_nullable,
        data_type,
        udt_name,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    // Group columns by table
    const tableColumns = {};
    for (const row of columnsRes.rows) {
      if (!tableColumns[row.table_name]) {
        tableColumns[row.table_name] = [];
      }
      tableColumns[row.table_name].push(row);
    }

    // 3. Get Primary Keys
    const pkRes = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public';
    `);
    const primaryKeys = {};
    for (const row of pkRes.rows) {
      if (!primaryKeys[row.table_name]) primaryKeys[row.table_name] = new Set();
      primaryKeys[row.table_name].add(row.column_name);
    }

    // 4. Get Foreign Keys
    const fkRes = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);

    const foreignKeys = fkRes.rows;
    console.log(`Found ${foreignKeys.length} foreign key relationships.`);

    // Map FK by table and column for quick lookup
    const fkByTableCol = {};
    for (const fk of foreignKeys) {
      const key = `${fk.source_table}.${fk.source_column}`;
      fkByTableCol[key] = fk;
    }

    // 5. Categorize tables into functional modules
    const modules = [
      {
        name: "1. Core SaaS, Tenants & Authentication",
        description: "Multi-tenant shop management, user authentication profiles, shop memberships, company profile branding and print settings.",
        tables: ["shops", "user_profiles", "user_shops", "company_details", "print_settings"]
      },
      {
        name: "2. Restaurant & Food Service POS",
        description: "Restaurant tables, floors/sections, KDS kitchen orders, dual kitchen stations, menu sizes, combos/deals, modifiers, reservations, QR ordering and waiter call bells.",
        tables: [
          "restaurant_tables",
          "restaurant_stations",
          "restaurant_menu_sizes",
          "restaurant_deals",
          "restaurant_deal_items",
          "restaurant_modifiers",
          "restaurant_reservations",
          "restaurant_qr_orders",
          "restaurant_waiter_calls",
          "kitchen_orders",
          "kitchen_order_items"
        ]
      },
      {
        name: "3. Inventory, Catalog & Multi-Warehouse",
        description: "Products, size-based BOM recipe costing, barcodes, batches, IMEIs, variants, categories, brands, units, warehouses, shelves, stock logs and wastage.",
        tables: [
          "products",
          "product_recipes",
          "product_variants",
          "product_batches",
          "product_barcodes",
          "product_imeis",
          "product_wastage",
          "stock",
          "stock_adjustments",
          "categories",
          "brands",
          "units",
          "warehouses",
          "shelves"
        ]
      },
      {
        name: "4. Invoicing, Sales & Orders",
        description: "Sales invoices, invoice line items, retail sales, returns, customer/supplier parties, counter register sessions, online orders and rider delivery assignments.",
        tables: [
          "invoices",
          "invoice_items",
          "sales",
          "sale_items",
          "returns",
          "return_items",
          "parties",
          "register_sessions",
          "online_orders",
          "online_customers"
        ]
      },
      {
        name: "5. Accounting, General Ledger & Khata",
        description: "Double-entry bookkeeping, chart of accounts, bank/cash balances, journal entries, credit transactions, daily books closing, operational expenses, fixed assets and post-dated cheques.",
        tables: [
          "cash_accounts",
          "account_transactions",
          "journal_entries",
          "journal_lines",
          "credit_transactions",
          "closing_balances",
          "closing_books",
          "closing_stocks",
          "expenses",
          "fixed_assets",
          "asset_depreciation_logs",
          "seasonal_khata",
          "post_dated_cheques",
          "currencies",
          "exchange_rates"
        ]
      },
      {
        name: "6. Purchasing & Supplier Management",
        description: "Purchase orders from vendors, line-item receiving, and supplier expiry claims.",
        tables: [
          "purchase_orders",
          "purchase_order_items",
          "supplier_expiry_claims",
          "supplier_expiry_claim_items"
        ]
      },
      {
        name: "7. SaaS Platform Administration & Security",
        description: "Payment gateway proofs, subscription settlements, referral partner tracking, customer support tickets and system audit activity logs.",
        tables: [
          "payment_submissions",
          "pending_payments",
          "referral_transactions",
          "support_tickets",
          "support_ticket_replies",
          "audit_logs"
        ]
      },
      {
        name: "8. Staff, HR & Payroll Management",
        description: "Staff monthly/daily salary payroll slips and individual compensation allowances/deduction items.",
        tables: ["payroll_slips", "payroll_items"]
      },
      {
        name: "9. Specialized Vertical: Pharmacy & Healthcare",
        description: "Doctor commissions, drug catalog formulations, drug temperature monitoring, short book logs and narcotics/controlled substance registers.",
        tables: [
          "pharmacy_doctors",
          "pharmacy_doctor_commissions",
          "pharmacy_controlled_logs",
          "pharmacy_temperature_logs",
          "pharmacy_short_book",
          "platform_drug_catalog",
          "formulations"
        ]
      },
      {
        name: "10. Specialized Vertical: Showroom, Automobile & EMI",
        description: "Showroom vehicle inventory, vehicle sales, rentals, external investor financing, installment contracts (EMI) and repair ticketing.",
        tables: [
          "showroom_vehicles",
          "showroom_parties",
          "showroom_investors",
          "showroom_investor_transactions",
          "showroom_sales",
          "showroom_rentals",
          "showroom_installments",
          "showroom_installment_schedules",
          "installment_plans",
          "installment_payments",
          "emi_schedules",
          "used_mobile_purchases",
          "repair_tickets"
        ]
      },
      {
        name: "11. Specialized Vertical: Tailoring & Boutique",
        description: "Customer bespoke measurements, tailoring stitching orders, and artisan (Karigar) task tracking.",
        tables: ["tailor_measurements", "stitching_orders", "karigars"]
      },
      {
        name: "12. Specialized Vertical: Fuel Station & Utilities",
        description: "Underground fuel tanks, dispensing pumps, meter shift closing readings, dimension quotes and gift cards.",
        tables: [
          "fuel_tanks",
          "fuel_pumps",
          "fuel_shift_readings",
          "shift_meter_readings",
          "hardware_dimension_quotes",
          "gift_cards",
          "gift_card_transactions",
          "bank_statement_lines"
        ]
      }
    ];

    // Find any unmapped tables
    const mappedTables = new Set(modules.flatMap(m => m.tables));
    const unmapped = tables.filter(t => !mappedTables.has(t));
    if (unmapped.length > 0) {
      modules.push({
        name: "13. Additional Tables",
        description: "Additional platform and utility tables.",
        tables: unmapped
      });
    }

    // 6. Build Markdown Document
    let md = "";
    md += "# Supabase PostgreSQL Database Schema Documentation\n\n";
    md += "> **System:** The Accounts / Cafe Master ERP Database Architecture\n";
    md += `> **Generated At:** ${new Date().toISOString()}\n`;
    md += `> **Database Version:** PostgreSQL 17.6\n`;
    md += `> **Total Tables:** ${tables.length}\n`;
    md += `> **Total Foreign Key Relationships:** ${foreignKeys.length}\n\n`;

    md += "## Table of Contents\n\n";
    for (const mod of modules) {
      md += `- [${mod.name}](#${mod.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")})\n`;
    }
    md += `- [Complete Foreign Key Relationships Matrix](#complete-foreign-key-relationships-matrix)\n\n`;

    md += "## Entity Relationship Overview (Core Architecture)\n\n";
    md += "```mermaid\nerDiagram\n";
    md += "    shops ||--o{ user_shops : \"has members\"\n";
    md += "    user_profiles ||--o{ user_shops : \"member of\"\n";
    md += "    shops ||--o{ company_details : \"configures\"\n";
    md += "    shops ||--o{ products : \"catalogs\"\n";
    md += "    shops ||--o{ categories : \"classifies\"\n";
    md += "    shops ||--o{ invoices : \"bills\"\n";
    md += "    shops ||--o{ parties : \"transacts with\"\n";
    md += "    shops ||--o{ cash_accounts : \"maintains\"\n";
    md += "    shops ||--o{ restaurant_tables : \"manages\"\n";
    md += "    invoices ||--o{ invoice_items : \"contains lines\"\n";
    md += "    invoices ||--o{ kitchen_orders : \"triggers KOT\"\n";
    md += "    products ||--o{ invoice_items : \"billed in\"\n";
    md += "    products ||--o{ product_recipes : \"has BOM\"\n";
    md += "    restaurant_menu_sizes ||--o{ product_recipes : \"sizes BOM\"\n";
    md += "    restaurant_tables ||--o{ invoices : \"serves\"\n";
    md += "    parties ||--o{ invoices : \"customer/vendor\"\n";
    md += "```\n\n";

    md += "---\n\n";

    // Format Type Helper
    function formatType(c) {
      if (c.data_type === "character varying") {
        return c.character_maximum_length ? `varchar(${c.character_maximum_length})` : "varchar";
      }
      if (c.data_type === "numeric") {
        return c.numeric_precision ? `numeric(${c.numeric_precision},${c.numeric_scale || 0})` : "numeric";
      }
      if (c.data_type === "USER-DEFINED") {
        return c.udt_name;
      }
      return c.data_type;
    }

    // Detail each module
    for (const mod of modules) {
      md += `## ${mod.name}\n\n`;
      md += `${mod.description}\n\n`;

      for (const tableName of mod.tables) {
        const cols = tableColumns[tableName] || [];
        const pks = primaryKeys[tableName] || new Set();

        md += `### Table: \`${tableName}\`\n\n`;

        if (cols.length === 0) {
          md += `*Table exists in schema with no documented columns or view.*\n\n`;
          continue;
        }

        md += `| Column | Type | Nullable | Default | Key / Relation |\n`;
        md += `|---|---|:---:|---|---|\n`;

        for (const col of cols) {
          const isPk = pks.has(col.column_name);
          const fkKey = `${tableName}.${col.column_name}`;
          const fk = fkByTableCol[fkKey];

          let keyStr = "";
          if (isPk) keyStr += "`PK` ";
          if (fk) {
            keyStr += `FK -> \`${fk.target_table}.${fk.target_column}\` (ON DELETE ${fk.delete_rule})`;
          }

          const colDefault = col.column_default
            ? `\`${col.column_default.replace(/::[a-zA-Z0-9_\s]+/g, "").replace(/\n/g, " ")}\``
            : "-";

          md += `| **\`${col.column_name}\`** | \`${formatType(col)}\` | ${col.is_nullable === "YES" ? "Yes" : "No"} | ${colDefault} | ${keyStr || "-"} |\n`;
        }

        // List foreign keys originated from this table
        const tableFks = foreignKeys.filter(f => f.source_table === tableName);
        if (tableFks.length > 0) {
          md += `\n**Foreign Keys Outgoing:**\n`;
          for (const f of tableFks) {
            md += `- \`${f.source_column}\` references [\`${f.target_table}.${f.target_column}\`](#table-${f.target_table}) (ON DELETE ${f.delete_rule}, ON UPDATE ${f.update_rule})\n`;
          }
        }

        // List incoming references to this table
        const incomingFks = foreignKeys.filter(f => f.target_table === tableName && f.source_table !== tableName);
        if (incomingFks.length > 0) {
          md += `\n**Referenced By (Incoming Relationships):**\n`;
          for (const f of incomingFks) {
            md += `- [\`${f.source_table}.${f.source_column}\`](#table-${f.source_table}) -> \`${f.target_column}\`\n`;
          }
        }

        md += `\n---\n\n`;
      }
    }

    // Full Matrix
    md += `## Complete Foreign Key Relationships Matrix\n\n`;
    md += `Total relationships defined in database: **${foreignKeys.length}**.\n\n`;
    md += `| Source Table | Source Column | Target Table | Target Column | On Delete | On Update | Constraint Name |\n`;
    md += `|---|---|---|---|:---:|:---:|---|\n`;

    for (const fk of foreignKeys) {
      md += `| \`${fk.source_table}\` | \`${fk.source_column}\` | \`${fk.target_table}\` | \`${fk.target_column}\` | ${fk.delete_rule} | ${fk.update_rule} | \`${fk.constraint_name}\` |\n`;
    }

    // Save output
    const outputPath = path.resolve(__dirname, "../docs/DATABASE_SCHEMA.md");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, md, "utf-8");
    console.log(`Successfully generated schema documentation at: ${outputPath}`);

    // Also write to Artifact Directory if desired
    const brainDir = "C:\\Users\\Dell\\.gemini\\antigravity\\brain\\49da071a-8691-45a9-8692-c3ece5cf5798";
    if (fs.existsSync(brainDir)) {
      const artifactPath = path.join(brainDir, "DATABASE_SCHEMA.md");
      fs.writeFileSync(artifactPath, md, "utf-8");
      console.log(`Also saved to artifact directory: ${artifactPath}`);
    }

  } catch (err) {
    console.error("Failed to generate schema documentation:", err);
  } finally {
    await client.end();
  }
}

generateSchemaDocs();

