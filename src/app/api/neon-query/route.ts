import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";

function getConnectionString(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.DIRECT_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    null
  );
}

let primaryPool: Pool | null = null;
let directPool: Pool | null = null;

function createPool(forceDirect = false): Pool | null {
  const rawUrl = getConnectionString();
  if (!rawUrl) return null;

  const url = forceDirect ? rawUrl.replace("-pooler.", ".") : rawUrl;

  const p = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  p.on("error", (err) => {
    console.error("[neon-query] Unexpected pool error:", err);
  });

  return p;
}

async function querySql(text: string, params: any[] = []): Promise<any[]> {
  if (!primaryPool) {
    primaryPool = createPool(false);
  }
  if (!primaryPool) {
    throw new Error("DATABASE_URL is not configured on server.");
  }

  try {
    const result = await primaryPool.query(text, params);
    return result.rows;
  } catch (err: any) {
    const isConnErr =
      err.code === "ECONNRESET" ||
      err.code === "ETIMEDOUT" ||
      err.message?.includes("Connection terminated") ||
      err.message?.includes("timeout");

    const connStr = getConnectionString();
    if (isConnErr && connStr && connStr.includes("-pooler.")) {
      console.warn("[neon-query] Pooler error, retrying directly via unpooled host...");
      if (!directPool) {
        directPool = createPool(true);
      }
      if (directPool) {
        const directRes = await directPool.query(text, params);
        return directRes.rows;
      }
    }
    throw err;
  }
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation } = body;
    const hasConfig = Boolean(getConnectionString());

    if (!hasConfig) {
      return NextResponse.json({
        data: null,
        error: { message: "Database connection string (DATABASE_URL) is not configured on server." }
      }, { status: 500 });
    }

    const sql = { query: querySql };

    // =========================================================================
    // 1. AUTH OPERATIONS (auth.users)
    // =========================================================================
    if (operation === "auth_signup") {
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";
      if (!email) {
        return NextResponse.json({ data: { user: null }, error: { message: "Email is required" } }, { status: 400 });
      }

      // Check if user already exists
      const existing = await sql.query("SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1", [email]);
      if (existing.length > 0) {
        return NextResponse.json({
          data: { user: existing[0] },
          error: null
        });
      }

      const userId = crypto.randomUUID();
      const encPassword = hashPassword(password);
      const now = new Date().toISOString();

      await sql.query(`
        INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at, aud, role)
        VALUES ($1, $2, $3, $4, $4, 'authenticated', 'authenticated')
      `, [userId, email, encPassword, now]);

      const user = { id: userId, email };
      return NextResponse.json({ data: { user }, error: null });
    }

    if (operation === "auth_signin") {
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";
      if (!email) {
        return NextResponse.json({ data: { user: null }, error: { message: "Email is required" } }, { status: 400 });
      }

      const rows = await sql.query("SELECT id, email, encrypted_password FROM auth.users WHERE email = $1 LIMIT 1", [email]);
      if (rows.length === 0) {
        return NextResponse.json({ data: { user: null }, error: { message: "Invalid login credentials" } }, { status: 401 });
      }

      const userRow = rows[0];
      if (userRow.encrypted_password && userRow.encrypted_password !== hashPassword(password)) {
        return NextResponse.json({ data: { user: null }, error: { message: "Invalid login credentials" } }, { status: 401 });
      }

      const user = { id: userRow.id, email: userRow.email };
      return NextResponse.json({ data: { user }, error: null });
    }

    // =========================================================================
    // 2. TABLE DATA OPERATIONS (public schema)
    // =========================================================================
    const { table, schema = "public", payload, filters = [], order, limit, offset, onConflict } = body;

    if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
      return NextResponse.json({ data: null, error: { message: `Invalid table name: ${table}` } }, { status: 400 });
    }
    if (!schema || !/^[a-zA-Z0-9_]+$/.test(schema)) {
      return NextResponse.json({ data: null, error: { message: `Invalid schema name: ${schema}` } }, { status: 400 });
    }

    const fullTable = `"${schema}"."${table}"`;

    // Build WHERE clause
    const whereParts: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const f of filters) {
      if (!f || !f.column || !/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
      const col = `"${f.column}"`;
      const op = f.op;
      const val = f.value;

      if (op === "eq") {
        whereParts.push(`${col} = $${pIdx++}`);
        params.push(val);
      } else if (op === "neq") {
        whereParts.push(`${col} != $${pIdx++}`);
        params.push(val);
      } else if (op === "gt") {
        whereParts.push(`${col} > $${pIdx++}`);
        params.push(val);
      } else if (op === "gte") {
        whereParts.push(`${col} >= $${pIdx++}`);
        params.push(val);
      } else if (op === "lt") {
        whereParts.push(`${col} < $${pIdx++}`);
        params.push(val);
      } else if (op === "lte") {
        whereParts.push(`${col} <= $${pIdx++}`);
        params.push(val);
      } else if (op === "in") {
        whereParts.push(`${col} = ANY($${pIdx++})`);
        params.push(val);
      } else if (op === "is") {
        if (val === null) {
          whereParts.push(`${col} IS NULL`);
        } else {
          whereParts.push(`${col} = $${pIdx++}`);
          params.push(val);
        }
      } else if (op === "not_is") {
        if (val === null) {
          whereParts.push(`${col} IS NOT NULL`);
        } else {
          whereParts.push(`${col} != $${pIdx++}`);
          params.push(val);
        }
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    // ── SELECT ─────────────────────────────────────────────────────────────
    if (operation === "select") {
      let orderClause = "";
      if (order && order.column && /^[a-zA-Z0-9_]+$/.test(order.column)) {
        orderClause = `ORDER BY "${order.column}" ${order.ascending ? "ASC" : "DESC"}`;
      }
      let limitClause = "";
      if (typeof limit === "number" && limit > 0) {
        limitClause = `LIMIT ${limit}`;
      }
      let offsetClause = "";
      if (typeof offset === "number" && offset > 0) {
        offsetClause = `OFFSET ${offset}`;
      }

      if (body.countOnly) {
        const query = `SELECT count(*)::int as count FROM ${fullTable} ${whereClause};`;
        const countRows = await sql.query(query, params);
        return NextResponse.json({ data: null, count: countRows[0]?.count || 0, error: null });
      }

      const query = `SELECT * FROM ${fullTable} ${whereClause} ${orderClause} ${limitClause} ${offsetClause};`;
      const rows = await sql.query(query, params);

      if (body.single) {
        return NextResponse.json({
          data: rows[0] || null,
          error: rows[0] ? null : { message: "Row not found" }
        });
      }
      if (body.maybeSingle) {
        return NextResponse.json({ data: rows[0] || null, error: null });
      }

      return NextResponse.json({ data: rows, error: null });
    }

    // ── INSERT ─────────────────────────────────────────────────────────────
    if (operation === "insert") {
      const items = Array.isArray(payload) ? payload : [payload];
      if (items.length === 0) return NextResponse.json({ data: [], error: null });

      const first = items[0];
      const cols = Object.keys(first).filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
      const colList = cols.map((c) => `"${c}"`).join(", ");

      const valueRows: string[] = [];
      const insertParams: any[] = [];
      let insertPIdx = 1;

      for (const item of items) {
        const rowPlaceholders: string[] = [];
        for (const col of cols) {
          rowPlaceholders.push(`$${insertPIdx++}`);
          insertParams.push(item[col] !== undefined ? item[col] : null);
        }
        valueRows.push(`(${rowPlaceholders.join(", ")})`);
      }

      const query = `INSERT INTO ${fullTable} (${colList}) VALUES ${valueRows.join(", ")} RETURNING *;`;
      const rows = await sql.query(query, insertParams);

      if (body.single) {
        return NextResponse.json({
          data: rows[0] || null,
          error: rows[0] ? null : { message: "Row not found" }
        });
      }
      return NextResponse.json({ data: Array.isArray(payload) ? rows : (rows[0] || null), error: null });
    }

    // ── UPSERT ─────────────────────────────────────────────────────────────
    if (operation === "upsert") {
      const items = Array.isArray(payload) ? payload : [payload];
      if (items.length === 0) return NextResponse.json({ data: [], error: null });

      const first = items[0];
      const cols = Object.keys(first).filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
      const colList = cols.map((c) => `"${c}"`).join(", ");

      const conflictCols = (onConflict || "id")
        .split(",")
        .map((s: string) => s.trim())
        .filter((c: string) => /^[a-zA-Z0-9_]+$/.test(c));
      const conflictTarget = conflictCols.map((c: string) => `"${c}"`).join(", ");

      const updateCols = cols.filter((c) => !conflictCols.includes(c));
      let updateSet = "";
      if (updateCols.length > 0) {
        updateSet = "DO UPDATE SET " + updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
      } else {
        updateSet = "DO NOTHING";
      }

      const valueRows: string[] = [];
      const upsertParams: any[] = [];
      let upsertPIdx = 1;

      for (const item of items) {
        const rowPlaceholders: string[] = [];
        for (const col of cols) {
          rowPlaceholders.push(`$${upsertPIdx++}`);
          upsertParams.push(item[col] !== undefined ? item[col] : null);
        }
        valueRows.push(`(${rowPlaceholders.join(", ")})`);
      }

      const query = `INSERT INTO ${fullTable} (${colList}) VALUES ${valueRows.join(", ")} ON CONFLICT (${conflictTarget}) ${updateSet} RETURNING *;`;
      const rows = await sql.query(query, upsertParams);

      if (body.single) {
        return NextResponse.json({
          data: rows[0] || null,
          error: rows[0] ? null : { message: "Row not found" }
        });
      }
      return NextResponse.json({ data: Array.isArray(payload) ? rows : (rows[0] || null), error: null });
    }

    // ── UPDATE ─────────────────────────────────────────────────────────────
    if (operation === "update") {
      const cols = Object.keys(payload || {}).filter((c) => /^[a-zA-Z0-9_]+$/.test(c));
      if (cols.length === 0) return NextResponse.json({ data: [], error: null });

      const updateParts: string[] = [];
      const updateParams: any[] = [];
      let updPIdx = 1;

      for (const col of cols) {
        updateParts.push(`"${col}" = $${updPIdx++}`);
        updateParams.push(payload[col] !== undefined ? payload[col] : null);
      }

      const updateWhereParts: string[] = [];
      for (const f of filters) {
        if (!f || !f.column || !/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
        const col = `"${f.column}"`;
        if (f.op === "eq") {
          updateWhereParts.push(`${col} = $${updPIdx++}`);
          updateParams.push(f.value);
        }
      }

      const updateWhere = updateWhereParts.length > 0 ? `WHERE ${updateWhereParts.join(" AND ")}` : "";
      const query = `UPDATE ${fullTable} SET ${updateParts.join(", ")} ${updateWhere} RETURNING *;`;
      const rows = await sql.query(query, updateParams);
      return NextResponse.json({ data: rows, error: null });
    }

    // ── DELETE ─────────────────────────────────────────────────────────────
    if (operation === "delete") {
      const query = `DELETE FROM ${fullTable} ${whereClause} RETURNING *;`;
      const rows = await sql.query(query, params);
      return NextResponse.json({ data: rows, error: null });
    }

    // ── RPC (Custom DB procedures) ─────────────────────────────────────────
    if (operation === "rpc") {
      const { fn, args = {} } = body;
      if (fn === "decrement_product_stock") {
        const pId = String(args.p_id ?? "");
        const qty = Number(args.qty ?? 0);
        await sql.query(
          `UPDATE public.products SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - $1) WHERE id = $2`,
          [qty, pId]
        );
        return NextResponse.json({ data: null, error: null });
      }
      if (fn === "increment_product_stock") {
        const pId = String(args.p_id ?? "");
        const qty = Number(args.qty ?? 0);
        await sql.query(
          `UPDATE public.products SET current_stock = COALESCE(current_stock, 0) + $1 WHERE id = $2`,
          [qty, pId]
        );
        return NextResponse.json({ data: null, error: null });
      }
      if (fn === "increment_party_balance") {
        const pId = String(args.p_id ?? "");
        const amount = Number(args.amount ?? 0);
        await sql.query(
          `UPDATE public.parties SET current_balance = COALESCE(current_balance, 0) + $1 WHERE id = $2`,
          [amount, pId]
        );
        return NextResponse.json({ data: null, error: null });
      }

      return NextResponse.json({ data: null, error: null });
    }

    return NextResponse.json({ data: null, error: { message: `Unsupported operation: ${operation}` } }, { status: 400 });
  } catch (err: any) {
    console.error("[neon-query] Error executing SQL query:", err);
    return NextResponse.json({
      data: null,
      error: {
        message: err.message || "Database query failed",
        code: err.code,
        detail: err.detail
      }
    }, { status: 500 });
  }
}

