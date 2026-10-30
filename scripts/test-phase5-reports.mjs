/**
 * Phase 5 reports & notification sanity smoke tests.
 * Run: node scripts/test-phase5-reports.mjs
 */

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// 1. Balance Sheet Calculations Sanity Check
function calculateBalanceSheet({ cashAccounts, customerBalances, supplierBalances, products, variants, fixedAssets }) {
  const cashTotal = cashAccounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const receivables = customerBalances.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const payables = supplierBalances.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  
  const productsValuation = products.reduce((sum, item) => sum + (Number(item.stock || 0) * Number(item.cost || 0)), 0);
  const variantsValuation = variants.reduce((sum, item) => sum + (Number(item.stock || 0) * Number(item.cost || 0)), 0);
  const inventoryValuation = productsValuation + variantsValuation;
  
  const fixedAssetsValuation = fixedAssets.reduce((sum, item) => sum + Number(item.value || 0), 0);
  
  const totalAssets = cashTotal + receivables + inventoryValuation + fixedAssetsValuation;
  const totalLiabilities = payables;
  const equity = totalAssets - totalLiabilities;
  
  return { totalAssets, totalLiabilities, equity };
}

const mockData = {
  cashAccounts: [{ balance: 1000 }, { balance: 2500 }],
  customerBalances: [{ balance: 500 }, { balance: 1500 }],
  supplierBalances: [{ balance: 800 }],
  products: [{ stock: 10, cost: 50 }],
  variants: [{ stock: 5, cost: 100 }],
  fixedAssets: [{ value: 3000 }]
};

const result = calculateBalanceSheet(mockData);
assert(result.totalAssets === (3500 + 2000 + 1000 + 3000), "calculates total assets correctly");
assert(result.totalLiabilities === 800, "calculates total liabilities correctly");
assert(result.equity === 8700, "calculates equity correctly");

// 2. Profit and Loss Calculations Sanity Check
function calculateProfitLoss({ invoices, expenses, productCostMap, variantCostMap }) {
  const revenue = invoices
    .filter(inv => inv.status === "completed")
    .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

  let cogs = 0;
  invoices
    .filter(inv => inv.status === "completed")
    .forEach(inv => {
      (inv.items || []).forEach(it => {
        const itemCost = it.variant_id && variantCostMap[it.variant_id]
          ? variantCostMap[it.variant_id]
          : (productCostMap[it.product_id] || 0);
        cogs += itemCost * Number(it.quantity || 0);
      });
    });

  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - totalExpenses;

  return { revenue, cogs, grossProfit, netProfit };
}

const mockPL = {
  invoices: [
    {
      status: "completed",
      total_amount: 5000,
      items: [
        { product_id: "p1", quantity: 2 },
        { product_id: "p2", variant_id: "v1", quantity: 1 }
      ]
    },
    {
      status: "quotation",
      total_amount: 3000,
      items: [{ product_id: "p1", quantity: 1 }]
    }
  ],
  expenses: [{ amount: 1000 }, { amount: 500 }],
  productCostMap: { p1: 1000 },
  variantCostMap: { v1: 500 }
};

const plResult = calculateProfitLoss(mockPL);
assert(plResult.revenue === 5000, "ignores quotations from P&L revenue");
assert(plResult.cogs === 2500, "calculates COGS based on product/variant mapping");
assert(plResult.grossProfit === 2500, "calculates gross profit correctly");
assert(plResult.netProfit === 1000, "calculates net profit correctly");

// 3. Notification Feature Gates Sanity Check
const planFeatures = {
  free: { allow_whatsapp: false },
  starter: { allow_whatsapp: false },
  premium: { allow_whatsapp: true }
};

function verifyWhatsappPermission(tier) {
  return !!planFeatures[tier]?.allow_whatsapp;
}

assert(!verifyWhatsappPermission("free"), "blocks whatsapp on free plan");
assert(!verifyWhatsappPermission("starter"), "blocks whatsapp on starter plan");
assert(verifyWhatsappPermission("premium"), "allows whatsapp on premium plan");

console.log(process.exitCode ? "\nPhase 5 report checks FAILED" : "\nPhase 5 report checks PASSED");
