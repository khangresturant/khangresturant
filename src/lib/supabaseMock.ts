// Mock Supabase Client for offline testing, local SQLite, and sandbox environments

import { isLocalSqliteEnabled } from "./config";
import {
  persistLocalAuthCookie,
  clearLocalAuthCookie,
} from "./local-sqlite/local-auth";
import {
  FLAME9_LOCAL_LOGINS,
  FLAME9_LOCAL_SHOP_ID,
  FLAME9_LOCAL_USER_ID,
  FLAME9_STAFF_USER_ID,
  getFlame9SeedData,
} from "./local-sqlite/seed-data";

const useFlame9 = process.env.NEXT_PUBLIC_BRAND === "flame9";
const shopId =
  useFlame9 || isLocalSqliteEnabled() ? FLAME9_LOCAL_SHOP_ID : "mock-shop-id";
const defaultUserId =
  useFlame9 || isLocalSqliteEnabled() ? FLAME9_LOCAL_USER_ID : "mock-user-id";
const MOCK_SESSION_KEY = "mock_auth_session";

/** Browser uses relative URL; server API routes hit the local Next app. */
function localSqliteFetchPrefix(): string {
  if (typeof window !== "undefined") return "";
  return (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}

async function fetchLocalSqliteTable(tableName: string): Promise<any[] | null> {
  const prefix = localSqliteFetchPrefix();
  const res = await fetch(
    `${prefix}/api/local-sqlite?table=${encodeURIComponent(tableName)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = await res.json();
  return Array.isArray(json.rows) ? json.rows : null;
}

async function postLocalSqliteTable(tableName: string, rows: any[]): Promise<void> {
  const prefix = localSqliteFetchPrefix();
  await fetch(`${prefix}/api/local-sqlite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: tableName, rows }),
  });
}

async function loadTable(tableName: string): Promise<any[]> {
  if (isLocalSqliteEnabled()) {
    try {
      const rows = await fetchLocalSqliteTable(tableName);
      if (rows) return rows;
    } catch (e) {
      console.warn("[mock] SQLite API fetch failed for", tableName, e);
    }
    const seed = getSeedData(tableName);
    if (seed.length) {
      await saveTable(tableName, seed);
      return seed;
    }
    return [];
  }
  if (typeof window === "undefined") {
    return getSeedData(tableName);
  }
  const data = localStorage.getItem(`mock_db_${tableName}`);
  if (data) return JSON.parse(data);
  const seed = getSeedData(tableName);
  await saveTable(tableName, seed);
  return seed;
}

async function saveTable(tableName: string, rows: any[]) {
  if (isLocalSqliteEnabled()) {
    await postLocalSqliteTable(tableName, rows);
    return;
  }
  if (typeof window === "undefined") return;
  localStorage.setItem(`mock_db_${tableName}`, JSON.stringify(rows));
}

function getSessionUser(): { id: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MOCK_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  if (useFlame9 || isLocalSqliteEnabled()) {
    return null;
  }
  return {
    id: defaultUserId,
    email: "admin@local.cafe",
  };
}

function getSeedData(tableName: string) {
  if (useFlame9 || isLocalSqliteEnabled()) {
    return getFlame9SeedData(tableName) as any[];
  }
  if (typeof window === "undefined") return [];
  switch (tableName) {
    case 'shops':
      return [{ id: shopId, name: 'The Accounts Kiryana Store', industry_type: 'karyana', subscription_tier: 'advanced', allow_negative_stock: false }];
    case 'user_profiles':
      return [{ 
        id: defaultUserId, 
        shop_id: shopId, 
        name: 'Usman (Admin)', 
        role: 'superadmin',
        permissions: {
          panels: {
            dashboard: true, pos: true, sales: true, registers: true,
            purchase: true, products: true, categories: true, brands: true,
            units: true, khata: true, returns: true, expenses: true,
            accounts: true, staff: true, backup: true
          },
          actions: { edit_bill: true, delete_bill: true, edit_account: true, delete_account: true }
        }
      }];
    case 'categories':
      return [
        { id: 'cat-1', shop_id: shopId, name: 'Beverages' },
        { id: 'cat-2', shop_id: shopId, name: 'Snacks' },
        { id: 'cat-3', shop_id: shopId, name: 'Personal Care' }
      ];
    case 'brands':
      return [
        { id: 'brand-1', shop_id: shopId, name: 'Unilever' },
        { id: 'brand-2', shop_id: shopId, name: 'Coca Cola Company' }
      ];
    case 'units':
      return [
        { id: 'unit-1', shop_id: shopId, name: 'Kilogram', code: 'kg', conversion_factor: 1 },
        { id: 'unit-2', shop_id: shopId, name: 'Gram', code: 'g', parent_unit_id: 'unit-1', conversion_factor: 1000 },
        { id: 'unit-3', shop_id: shopId, name: 'Piece', code: 'pcs', conversion_factor: 1 }
      ];
    case 'cash_accounts':
      return [
        { id: 'acc-1', shop_id: shopId, name: 'Cash in Hand', current_balance: 15000 },
        { id: 'acc-2', shop_id: shopId, name: 'Bank Account', current_balance: 50000 }
      ];
    case 'parties':
      return [
        { id: 'walkin', shop_id: shopId, name: 'Walk-in Customer', phone: null, current_balance: 0, type: 'customer' },
        { id: 'party-1', shop_id: shopId, name: 'Ahmed Ali', phone: '03001234567', current_balance: 2500, type: 'customer' }
      ];
    case 'products':
      return [
        {
          id: 'prod-1',
          shop_id: shopId,
          name: 'Sunsilk Shampoo 360ml',
          code: '8901234567890',
          unit: 'pcs',
          purchase_price_single: 300,
          sale_price_single: 350,
          current_stock: 45,
          min_stock_level: 5,
          category_id: 'cat-3',
          brand_id: 'brand-1'
        },
        {
          id: 'prod-2',
          shop_id: shopId,
          name: 'Coca Cola 1.5L',
          code: '5449000000996',
          unit: 'pcs',
          purchase_price_single: 120,
          sale_price_single: 140,
          current_stock: 60,
          min_stock_level: 10,
          category_id: 'cat-1',
          brand_id: 'brand-2'
        }
      ];
    case 'product_variants':
      return [
        {
          id: 'var-1',
          product_id: 'prod-1',
          shop_id: shopId,
          packing_name: 'Sunsilk Shampoo 360ml (Bottle)',
          purchase_price: 300,
          sale_price: 350,
          stock_quantity: 45
        }
      ];
    case 'product_barcodes':
      return [
        {
          id: 'barc-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          shop_id: shopId,
          barcode: '8901234567890',
          pack_type: 'single'
        }
      ];
    case 'register_sessions':
      return [
        {
          id: 'session-1',
          shop_id: shopId,
          user_id: defaultUserId,
          opening_balance: 5000,
          status: 'open',
          opened_at: new Date().toISOString()
        }
      ];
    case 'invoices':
      return [];
    default:
      return [];
  }
}

class MockQueryBuilder {
  tableName: string;
  rows: any[] = [];
  filters: ((row: any) => boolean)[] = [];
  rawFilters: { column: string; op: string; value: any }[] = [];
  isSingle = false;
  isMaybeSingle = false;
  isInsert = false;
  isUpsert = false;
  upsertConflict: string | null = null;
  isUpdate = false;
  isDelete = false;
  payload: any = null;
  sortField: string | null = null;
  sortAscending = true;
  limitCount: number | null = null;
  rangeFrom: number | null = null;
  rangeTo: number | null = null;
  headCount = false;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.rows = [];
  }

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count === "exact" && options?.head) {
      this.headCount = true;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.rawFilters.push({ column, op: "eq", value });
    this.filters.push(row => row[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.rawFilters.push({ column, op: "neq", value });
    this.filters.push(row => row[column] !== value);
    return this;
  }

  gt(column: string, value: any) {
    this.rawFilters.push({ column, op: "gt", value });
    this.filters.push(row => row[column] > value);
    return this;
  }

  gte(column: string, value: any) {
    this.rawFilters.push({ column, op: "gte", value });
    this.filters.push(row => row[column] >= value);
    return this;
  }

  lt(column: string, value: any) {
    this.rawFilters.push({ column, op: "lt", value });
    this.filters.push(row => row[column] < value);
    return this;
  }

  lte(column: string, value: any) {
    this.rawFilters.push({ column, op: "lte", value });
    this.filters.push(row => row[column] <= value);
    return this;
  }

  is(column: string, value: any) {
    this.rawFilters.push({ column, op: "is", value });
    if (value === null) {
      this.filters.push(row => row[column] === null || row[column] === undefined);
    } else {
      this.filters.push(row => row[column] === value);
    }
    return this;
  }

  in(column: string, values: any[]) {
    this.rawFilters.push({ column, op: "in", value: values });
    if (!values?.length) {
      this.filters.push(() => false);
    } else {
      const set = new Set(values);
      this.filters.push((row) => set.has(row[column]));
    }
    return this;
  }

  not(column: string, op: string, value: any) {
    if (op === "is") {
      this.rawFilters.push({ column, op: "not_is", value });
      if (value === null) {
        this.filters.push((row) => row[column] !== null && row[column] !== undefined);
      } else {
        this.filters.push((row) => row[column] !== value);
      }
    } else if (op === "eq") {
      this.rawFilters.push({ column, op: "neq", value });
      this.filters.push((row) => row[column] !== value);
    }
    return this;
  }

  order(column: string, { ascending = true } = {}) {
    this.sortField = column;
    this.sortAscending = ascending;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  insert(payload: any) {
    this.isInsert = true;
    this.payload = payload;
    return this;
  }

  upsert(payload: any, options?: { onConflict?: string }) {
    this.isUpsert = true;
    this.payload = payload;
    this.upsertConflict = options?.onConflict || null;
    return this;
  }

  update(payload: any) {
    this.isUpdate = true;
    this.payload = payload;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then(resolve: any, reject: any) {
    // 1. Try querying Neon Database directly via /api/neon-query
    if (typeof window !== "undefined") {
      try {
        const operation = this.isInsert
          ? "insert"
          : this.isUpsert
          ? "upsert"
          : this.isUpdate
          ? "update"
          : this.isDelete
          ? "delete"
          : "select";

        const res = await fetch("/api/neon-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: this.tableName,
            operation,
            payload: this.payload,
            onConflict: this.upsertConflict,
            filters: this.rawFilters,
            order: this.sortField ? { column: this.sortField, ascending: this.sortAscending } : null,
            limit: this.limitCount,
            single: this.isSingle,
            maybeSingle: this.isMaybeSingle,
            countOnly: this.headCount,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json && !json.error) {
            resolve(json);
            return;
          }
        }
      } catch (neonErr) {
        // Fallback to local memory/sqlite if network fails
      }
    }

    try {
      this.rows = await loadTable(this.tableName);
      let resultData: any = [...this.rows];

      // Apply filters
      for (const filter of this.filters) {
        resultData = resultData.filter(filter);
      }

      // Handle operations
      if (this.isInsert) {
        const itemsToInsert = Array.isArray(this.payload) ? this.payload : [this.payload];
        const newItems = itemsToInsert.map(item => ({
          id: item.id || Math.random().toString(36).substring(2, 11),
          created_at: new Date().toISOString(),
          ...item
        }));
        
        const currentData = await loadTable(this.tableName);
        currentData.push(...newItems);
        this.rows = currentData;
        await saveTable(this.tableName, this.rows);
        
        resultData = newItems;
      } else if (this.isUpsert) {
        const itemsToUpsert = Array.isArray(this.payload) ? this.payload : [this.payload];
        const currentData = await loadTable(this.tableName);
        const conflictFields = (this.upsertConflict || "id").split(",").map((s: string) => s.trim());

        const nextData = [...currentData];
        const returnedItems: any[] = [];

        for (const item of itemsToUpsert) {
          const matchIdx = nextData.findIndex((row: any) =>
            conflictFields.every((field: string) => row[field] !== undefined && String(row[field]) === String(item[field]))
          );

          if (matchIdx >= 0) {
            nextData[matchIdx] = {
              ...nextData[matchIdx],
              ...item,
              updated_at: new Date().toISOString()
            };
            returnedItems.push(nextData[matchIdx]);
          } else {
            const newItem = {
              id: item.id || Math.random().toString(36).substring(2, 11),
              created_at: new Date().toISOString(),
              ...item
            };
            nextData.push(newItem);
            returnedItems.push(newItem);
          }
        }

        this.rows = nextData;
        await saveTable(this.tableName, this.rows);
        resultData = returnedItems;
      } else if (this.isUpdate) {
        const currentData = await loadTable(this.tableName);
        const matchingIds = new Set(resultData.map((r: any) => r.id));
        
        this.rows = currentData.map((row: any) => {
          if (matchingIds.has(row.id)) {
            return { ...row, ...this.payload, updated_at: new Date().toISOString() };
          }
          return row;
        });
        await saveTable(this.tableName, this.rows);
        resultData = resultData.map((row: any) => ({ ...row, ...this.payload }));
      } else if (this.isDelete) {
        const currentData = await loadTable(this.tableName);
        const matchingIds = new Set(resultData.map((r: any) => r.id).filter(Boolean));
        if (matchingIds.size > 0) {
          this.rows = currentData.filter((row: any) => !matchingIds.has(row.id));
        } else {
          const matchFiltered = (row: any) => {
            for (const filter of this.filters) {
              if (!filter(row)) return false;
            }
            return true;
          };
          this.rows = currentData.filter((row: any) => !matchFiltered(row));
        }
        await saveTable(this.tableName, this.rows);
        resultData = [];
      } else {
        // SELECT - handle joins
        if (this.tableName === 'products') {
          const allVariants = await loadTable('product_variants');
          const allCategories = await loadTable('categories');
          const allBrands = await loadTable('brands');
          const allBarcodes = await loadTable('product_barcodes');
          
          resultData = resultData.map((p: any) => {
            const vars = allVariants.filter((v: any) => v.product_id === p.id);
            const mappedVars = vars.map((v: any) => {
              const barcodes = allBarcodes.filter((b: any) => b.variant_id === v.id);
              return { ...v, product_barcodes: barcodes };
            });
            const baseBarcodes = allBarcodes.filter((b: any) => b.product_id === p.id && !b.variant_id);
            return {
              ...p,
              product_barcodes: baseBarcodes,
              product_variants: mappedVars,
              categories: allCategories.find((c: any) => c.id === p.category_id) || null,
              brands: allBrands.find((b: any) => b.id === p.brand_id) || null
            };
          });
        }
        
        if (this.tableName === 'product_variants') {
          const allBarcodes = await loadTable('product_barcodes');
          resultData = resultData.map((v: any) => {
            const barcodes = allBarcodes.filter((b: any) => b.variant_id === v.id);
            return { ...v, product_barcodes: barcodes };
          });
        }

        if (this.tableName === 'product_barcodes') {
          const allProducts = await loadTable('products');
          const allVariants = await loadTable('product_variants');
          resultData = resultData.map((b: any) => {
            return {
              ...b,
              products: allProducts.find((p: any) => p.id === b.product_id) || null,
              product_variants: allVariants.find((v: any) => v.id === b.variant_id) || null
            };
          });
        }

        if (this.tableName === 'invoices') {
          const allParties = await loadTable('parties');
          const allItems = await loadTable('invoice_items');
          const allProducts = await loadTable('products');
          resultData = resultData.map((inv: any) => {
            return {
              ...inv,
              parties: allParties.find((p: any) => p.id === inv.party_id) || null,
              invoice_items: allItems
                .filter((i: any) => i.invoice_id === inv.id)
                .map((i: any) => ({
                  ...i,
                  products: allProducts.find((p: any) => p.id === i.product_id) || null,
                })),
            };
          });
        }

        if (this.tableName === "invoice_items") {
          const allProducts = await loadTable("products");
          resultData = resultData.map((i: any) => ({
            ...i,
            products: allProducts.find((p: any) => p.id === i.product_id) || null,
          }));
        }

        if (this.tableName === "kitchen_orders") {
          const tables = await loadTable("restaurant_tables");
          const items = await loadTable("kitchen_order_items");
          const products = await loadTable("products");
          resultData = resultData.map((ko: any) => ({
            ...ko,
            restaurant_tables:
              tables.find((t: any) => t.id === ko.table_id) || null,
            kitchen_order_items: items
              .filter((i: any) => i.kitchen_order_id === ko.id)
              .map((i: any) => ({
                ...i,
                products:
                  products.find((p: any) => p.id === i.product_id) || null,
              })),
          }));
        }

        if (this.tableName === "kitchen_order_items") {
          const products = await loadTable("products");
          resultData = resultData.map((i: any) => ({
            ...i,
            products: products.find((p: any) => p.id === i.product_id) || null,
          }));
        }

        if (this.tableName === "restaurant_reservations") {
          const tables = await loadTable("restaurant_tables");
          resultData = resultData.map((r: any) => ({
            ...r,
            restaurant_tables:
              tables.find((t: any) => t.id === r.table_id) || null,
          }));
        }

        if (this.tableName === "product_recipes") {
          const products = await loadTable("products");
          resultData = resultData.map((r: any) => {
            const ing = products.find((p: any) => p.id === r.ingredient_product_id) || null;
            return {
              ...r,
              ingredients: ing,
            };
          });
        }

        // Apply sorting
        if (this.sortField) {
          const field = this.sortField;
          const asc = this.sortAscending;
          resultData.sort((a: any, b: any) => {
            if (a[field] < b[field]) return asc ? -1 : 1;
            if (a[field] > b[field]) return asc ? 1 : -1;
            return 0;
          });
        }

        // Apply limit
        if (this.limitCount !== null) {
          resultData = resultData.slice(0, this.limitCount);
        }

        if (this.rangeFrom !== null && this.rangeTo !== null) {
          resultData = resultData.slice(this.rangeFrom, this.rangeTo + 1);
        }
      }

      if (this.headCount) {
        resolve({ data: null, count: resultData.length, error: null });
        return;
      }

      if (this.isSingle) {
        resolve({ data: resultData[0] || null, error: resultData[0] ? null : { message: 'Row not found' } });
      } else if (this.isMaybeSingle) {
        resolve({ data: resultData[0] || null, error: null });
      } else {
        resolve({ data: resultData, error: null });
      }
    } catch (e: any) {
      resolve({ data: null, error: e });
    }
  }
}

export const mockSupabase = {
  auth: {
    getUser: async () => {
      const user = getSessionUser();
      return { data: { user }, error: null };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const normalized = email.trim().toLowerCase();
      if (typeof window !== "undefined") {
        try {
          const res = await fetch("/api/neon-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation: "auth_signin", email: normalized, password }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data?.user) {
              sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(json.data.user));
              persistLocalAuthCookie(json.data.user);
              return json;
            }
            if (json.error) return json;
          }
        } catch (e) {}
      }
      if (useFlame9 || isLocalSqliteEnabled()) {
        const accounts = [FLAME9_LOCAL_LOGINS.admin, FLAME9_LOCAL_LOGINS.staff];
        const match = accounts.find((a) => a.email === normalized && a.password === password);
        if (!match) {
          return { data: { user: null }, error: { message: "Invalid login credentials" } };
        }
        const id = match.role === "superadmin" ? FLAME9_LOCAL_USER_ID : FLAME9_STAFF_USER_ID;
        const user = { id, email: match.email };
        if (typeof window !== "undefined") {
          sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
          persistLocalAuthCookie(user);
        }
        return { data: { user }, error: null };
      }
      const user = { id: defaultUserId, email: normalized };
      if (typeof window !== "undefined") {
        sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
      }
      return { data: { user }, error: null };
    },
    signUp: async ({ email, password }: { email: string; password?: string }) => {
      const normalized = email.trim().toLowerCase();
      if (typeof window !== "undefined") {
        try {
          const res = await fetch("/api/neon-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operation: "auth_signup",
              email: normalized,
              password: password || "Password123!",
            }),
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data?.user) {
              sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(json.data.user));
              persistLocalAuthCookie(json.data.user);
              return json;
            }
            if (json.error) return json;
          }
        } catch (e) {}
      }
      return { data: { user: { id: defaultUserId, email: normalized } }, error: null };
    },
    signOut: async () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(MOCK_SESSION_KEY);
        clearLocalAuthCookie();
      }
      return { error: null };
    },
  },
  from: (tableName: string) => {
    return new MockQueryBuilder(tableName);
  },
  rpc: async (fn: string, args: Record<string, unknown> = {}) => {
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/neon-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "rpc", fn, args }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json && !json.error) return json;
        }
      } catch (e) {}
    }
    try {
      if (fn === "decrement_product_stock") {
        const pId = String(args.p_id ?? "");
        const qty = Number(args.qty ?? 0);
        const products = await loadTable("products");
        const next = products.map((p: any) => {
          if (p.id !== pId) return p;
          const current = Number(p.current_stock ?? 0);
          return { ...p, current_stock: Math.max(0, current - qty) };
        });
        await saveTable("products", next);
        return { data: null, error: null };
      }
      if (fn === "increment_product_stock") {
        const pId = String(args.p_id ?? "");
        const qty = Number(args.qty ?? 0);
        const products = await loadTable("products");
        const next = products.map((p: any) => {
          if (p.id !== pId) return p;
          const current = Number(p.current_stock ?? 0);
          return { ...p, current_stock: current + qty };
        });
        await saveTable("products", next);
        return { data: null, error: null };
      }
      if (fn === "increment_party_balance") {
        const pId = String(args.p_id ?? "");
        const amount = Number(args.amount ?? 0);
        const parties = await loadTable("parties");
        const next = parties.map((p: any) => {
          if (p.id !== pId) return p;
          return { ...p, current_balance: Number(p.current_balance ?? 0) + amount };
        });
        await saveTable("parties", next);
        return { data: null, error: null };
      }
      return { data: null, error: { message: `Unknown RPC: ${fn}` } };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "RPC failed";
      return { data: null, error: { message } };
    }
  },
  channel: () => {
    return {
      on: function() { return this; },
      subscribe: () => {}
    };
  },
  removeChannel: () => {}
};
