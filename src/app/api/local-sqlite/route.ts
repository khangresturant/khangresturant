import { NextRequest, NextResponse } from "next/server";
import { getSqlitePath, writeTableRows } from "@/lib/local-sqlite/database";
import { ensureTableSeeded, resetFlame9Database } from "@/lib/local-sqlite/seed";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const info = request.nextUrl.searchParams.get("info");
  if (info === "1") {
    return NextResponse.json({
      engine: "sqlite",
      path: getSqlitePath(),
      useLocal: process.env.NEXT_PUBLIC_USE_LOCAL_SQLITE !== "false",
    });
  }

  const table = request.nextUrl.searchParams.get("table");
  if (!table) {
    return NextResponse.json({ error: "table query param required" }, { status: 400 });
  }
  try {
    const rows = ensureTableSeeded(table);
    return NextResponse.json({ table, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "SQLite read failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action as string | undefined;

    if (action === "reset") {
      if (process.env.FLAME9_ALLOW_DB_RESET !== "true") {
        return NextResponse.json({ error: "Database reset is disabled for this install." }, { status: 403 });
      }
      resetFlame9Database();
      return NextResponse.json({ ok: true, message: "Flame 9 SQLite database reset." });
    }

    const table = body?.table as string | undefined;
    const rows = body?.rows as unknown[] | undefined;
    if (!table || !Array.isArray(rows)) {
      return NextResponse.json({ error: "table and rows[] required" }, { status: 400 });
    }
    writeTableRows(table, rows);
    return NextResponse.json({ ok: true, table, count: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "SQLite write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
