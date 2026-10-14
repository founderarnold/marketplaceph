/** Seller calculators: product costing and break-even. Pure functions (unit-tested). Amounts are pesos. */

export type CostLine = { label: string; amount: number };

export type CostingInput = {
  materials: CostLine[]; // ingredients / raw materials for ONE batch
  labor: number; // labor cost for one batch
  overhead: number; // share of rent, power, gas, water for one batch
  packaging: number; // packaging for the whole batch
  yieldUnits: number; // sellable units the batch makes
  markupPct: number; // markup on cost, e.g. 50 = +50%
};

export type CostingResult = {
  batchCost: number;
  unitCost: number;
  price: number; // suggested selling price per unit
  profitPerUnit: number;
  marginPct: number; // profit as a share of the price
  wholesalePrice: number; // half the markup, for bulk buyers / resellers
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function costing(i: CostingInput): CostingResult | null {
  const units = Math.floor(pos(i.yieldUnits));
  if (!units) return null;
  const batchCost = i.materials.reduce((s, m) => s + pos(m.amount), 0) + pos(i.labor) + pos(i.overhead) + pos(i.packaging);
  const unitCost = batchCost / units;
  const markup = pos(i.markupPct) / 100;
  const price = unitCost * (1 + markup);
  const profitPerUnit = price - unitCost;
  return {
    batchCost: round2(batchCost),
    unitCost: round2(unitCost),
    price: round2(price),
    profitPerUnit: round2(profitPerUnit),
    marginPct: price > 0 ? round2((profitPerUnit / price) * 100) : 0,
    wholesalePrice: round2(unitCost * (1 + markup / 2)),
  };
}

export type BreakEvenInput = {
  fixedCosts: CostLine[]; // monthly: rent, salaries, utilities, loan payments…
  price: number; // selling price per unit
  variableCost: number; // cost per unit (materials, packaging, delivery per piece)
  workDays: number; // selling days per month
  targetProfit: number; // monthly profit goal
};

export type BreakEvenResult = {
  fixedTotal: number;
  contribution: number; // what each sale contributes to fixed costs
  units: number; // units per month to break even
  revenue: number; // sales per month to break even
  unitsPerDay: number;
  targetUnits: number; // units per month to reach the profit goal
  targetRevenue: number;
};

/** null when each sale loses money (price ≤ variable cost): there is no break-even point. */
export function breakEven(i: BreakEvenInput): BreakEvenResult | null {
  const fixedTotal = i.fixedCosts.reduce((s, f) => s + pos(f.amount), 0);
  const contribution = pos(i.price) - pos(i.variableCost);
  if (contribution <= 0) return null;
  const units = Math.ceil(fixedTotal / contribution);
  const targetUnits = Math.ceil((fixedTotal + pos(i.targetProfit)) / contribution);
  const days = Math.max(1, Math.floor(pos(i.workDays)) || 26);
  return {
    fixedTotal: round2(fixedTotal),
    contribution: round2(contribution),
    units,
    revenue: round2(units * pos(i.price)),
    unitsPerDay: Math.ceil(units / days),
    targetUnits,
    targetRevenue: round2(targetUnits * pos(i.price)),
  };
}
