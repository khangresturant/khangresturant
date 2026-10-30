// Mock Supabase Client for offline testing and sandbox environments

const shopId = 'mock-shop-id';
const userId = 'mock-user-id';

function getSeedData(tableName: string) {
  if (typeof window === 'undefined') return [];
  switch (tableName) {
    case 'shops':
      return [{ id: shopId, name: 'Hisab X Kiryana Store', industry_type: 'karyana', subscription_tier: 'advanced', allow_negative_stock: false }];
    case 'user_profiles':
      return [{ 
        id: userId, 
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
          user_id: userId,
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
  isSingle = false;
  isMaybeSingle = false;
  isInsert = false;
  isUpdate = false;
  isDelete = false;
  payload: any = null;
  sortField: string | null = null;
  sortAscending = true;
  limitCount: number | null = null;

  constructor(tableName: string) {
    this.tableName = tableName;
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(`mock_db_${tableName}`);
      if (data) {
        this.rows = JSON.parse(data);
      } else {
        this.rows = getSeedData(tableName);
        localStorage.setItem(`mock_db_${tableName}`, JSON.stringify(this.rows));
      }
    }
  }

  select(columns?: string) {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push(row => row[column] === value);
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

  insert(payload: any) {
    this.isInsert = true;
    this.payload = payload;
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
    try {
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
        
        // Load latest state from localStorage before push
        const currentData = JSON.parse(localStorage.getItem(`mock_db_${this.tableName}`) || '[]');
        currentData.push(...newItems);
        this.rows = currentData;
        localStorage.setItem(`mock_db_${this.tableName}`, JSON.stringify(this.rows));
        
        resultData = newItems;
      } else if (this.isUpdate) {
        const currentData = JSON.parse(localStorage.getItem(`mock_db_${this.tableName}`) || '[]');
        const matchingIds = new Set(resultData.map((r: any) => r.id));
        
        this.rows = currentData.map((row: any) => {
          if (matchingIds.has(row.id)) {
            return { ...row, ...this.payload, updated_at: new Date().toISOString() };
          }
          return row;
        });
        localStorage.setItem(`mock_db_${this.tableName}`, JSON.stringify(this.rows));
        resultData = resultData.map((row: any) => ({ ...row, ...this.payload }));
      } else if (this.isDelete) {
        const currentData = JSON.parse(localStorage.getItem(`mock_db_${this.tableName}`) || '[]');
        const matchingIds = new Set(resultData.map((r: any) => r.id));
        
        this.rows = currentData.filter((row: any) => !matchingIds.has(row.id));
        localStorage.setItem(`mock_db_${this.tableName}`, JSON.stringify(this.rows));
        resultData = [];
      } else {
        // SELECT - handle joins
        if (this.tableName === 'products') {
          const allVariants = JSON.parse(localStorage.getItem('mock_db_product_variants') || '[]');
          const allCategories = JSON.parse(localStorage.getItem('mock_db_categories') || '[]');
          const allBrands = JSON.parse(localStorage.getItem('mock_db_brands') || '[]');
          const allBarcodes = JSON.parse(localStorage.getItem('mock_db_product_barcodes') || '[]');
          
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
          const allBarcodes = JSON.parse(localStorage.getItem('mock_db_product_barcodes') || '[]');
          resultData = resultData.map((v: any) => {
            const barcodes = allBarcodes.filter((b: any) => b.variant_id === v.id);
            return { ...v, product_barcodes: barcodes };
          });
        }

        if (this.tableName === 'product_barcodes') {
          const allProducts = JSON.parse(localStorage.getItem('mock_db_products') || '[]');
          const allVariants = JSON.parse(localStorage.getItem('mock_db_product_variants') || '[]');
          resultData = resultData.map((b: any) => {
            return {
              ...b,
              products: allProducts.find((p: any) => p.id === b.product_id) || null,
              product_variants: allVariants.find((v: any) => v.id === b.variant_id) || null
            };
          });
        }

        if (this.tableName === 'invoices') {
          const allParties = JSON.parse(localStorage.getItem('mock_db_parties') || '[]');
          resultData = resultData.map((inv: any) => {
            return {
              ...inv,
              parties: allParties.find((p: any) => p.id === inv.party_id) || null
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
      return { data: { user: { id: userId, email: 'superadmin@hisabx.com' } }, error: null };
    },
    signInWithPassword: async ({ email }: { email: string }) => {
      return { data: { user: { id: userId, email } }, error: null };
    },
    signUp: async ({ email }: { email: string }) => {
      return { data: { user: { id: userId, email } }, error: null };
    },
    signOut: async () => {
      return { error: null };
    }
  },
  from: (tableName: string) => {
    return new MockQueryBuilder(tableName);
  },
  channel: () => {
    return {
      on: function() { return this; },
      subscribe: () => {}
    };
  },
  removeChannel: () => {}
};
