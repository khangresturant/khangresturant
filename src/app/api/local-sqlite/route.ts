import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// =============================================================================
// LOCAL SQLITE DATABASE PERMANENTLY DISABLED
// ONLY NEON POSTGRESQL IS ACTIVE VIA /api/neon-query
// =============================================================================

export async function GET(request: NextRequest) {
  return NextResponse.json({
    engine: "neon-postgres",
    sqlite_active: false,
    message: "SQLite database connection is closed. Only Neon DB is active."
  });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    error: "SQLite writes are disabled. All database operations must target Neon PostgreSQL via /api/neon-query."
  }, { status: 400 });
}
