import pg from "pg";

const pool = new pg.Pool({
  connectionString: "postgresql://postgres.your-tenant-id:f25d3abd0eb0c3f2a31e45745cda5bd2@31.97.215.18:54322/postgres",
  ssl: false,
});

async function main() {
  const res = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expenses'"
  );
  console.log("expenses columns:", res.rows.map(r => `${r.column_name} (${r.data_type})`));

  // Check if edit_history column exists
  const hasEditHistory = res.rows.some((r) => r.column_name === "edit_history");
  if (!hasEditHistory) {
    console.log("Adding edit_history column to expenses...");
    await pool.query("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;");
    console.log("Added edit_history column to expenses successfully!");
  } else {
    console.log("edit_history column already exists on expenses.");
  }

  await pool.end();
}

main().catch(console.error);
