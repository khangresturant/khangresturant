/**
 * PR-0.5 — Helper to regenerate src/lib/database.types.ts via Supabase CLI.
 * Usage: npm run types:gen
 * Requires: SUPABASE_PROJECT_ID  or  DATABASE_URL / SUPABASE_DB_URL
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outFile = resolve(process.cwd(), "src/lib/database.types.ts");
const projectId = process.env.SUPABASE_PROJECT_ID;
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

function run(args) {
  const result = spawnSync("npx", ["supabase", ...args], {
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

if (!projectId && !dbUrl) {
  console.error(`
Missing credentials.

Set one of:
  SUPABASE_PROJECT_ID=your_project_ref
  DATABASE_URL=postgresql://...
  SUPABASE_DB_URL=postgresql://...

Then re-run: npm run types:gen

See scripts/regen-database-types.md for details.
`);
  process.exit(1);
}

console.log("Generating TypeScript types from database…");
const args = projectId
  ? ["gen", "types", "typescript", "--project-id", projectId]
  : ["gen", "types", "typescript", "--db-url", dbUrl];

const types = run(args);
writeFileSync(outFile, types, "utf8");
console.log(`Wrote ${outFile} (${types.length} bytes)`);
