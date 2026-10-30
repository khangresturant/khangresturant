import pg from "pg";

const pool = new pg.Pool({
  connectionString: "postgresql://postgres.your-tenant-id:f25d3abd0eb0c3f2a31e45745cda5bd2@31.97.215.18:54322/postgres",
  ssl: false,
});

async function main() {
  const res = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fixed_assets'"
  );
  console.log("fixed_assets columns:", res.rows);

  // Check if edit_history column exists
  const hasEditHistory = res.rows.some((r) => r.column_name === "edit_history");
  if (!hasEditHistory) {
    console.log("Adding edit_history column to fixed_assets...");
    await pool.query("ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;");
    console.log("Added edit_history column successfully!");
  }

  await pool.end();
}

main().catch(console.error);
