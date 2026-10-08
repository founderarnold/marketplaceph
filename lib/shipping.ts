/**
 * Rule-based shipping suggestion (Phase 3). No external rate APIs: it looks at where the goods are going,
 * how big the order is and how urgent it is, and ranks the KINDS of shipping that usually fit.
 * The UI then highlights the seller's / buyer's own configured methods of those kinds.
 */
export type ShippingKind = "courier" | "on_demand" | "trucking" | "bus" | "van_jeep" | "pickup" | "other";

export const SHIPPING_KINDS: ShippingKind[] = ["on_demand", "courier", "trucking", "bus", "van_jeep", "pickup", "other"];

export type Place = { region?: string | null; province?: string | null; city?: string | null };

export type Recommendation = { kind: ShippingKind; reason: string /* i18n key suffix under "ship.why." */ };

const LUZON = new Set(["NCR", "CAR", "R1", "R2", "R3", "R4A", "R4B", "R5"]);
const VISAYAS = new Set(["R6", "R7", "R8"]);
const MINDANAO = new Set(["R9", "R10", "R11", "R12", "R13", "BARMM"]);

export function islandGroup(region?: string | null): "luzon" | "visayas" | "mindanao" | null {
  if (!region) return null;
  if (LUZON.has(region)) return "luzon";
  if (VISAYAS.has(region)) return "visayas";
  if (MINDANAO.has(region)) return "mindanao";
  return null;
}

export type Distance = "same_city" | "same_province" | "same_island" | "cross_island" | "unknown";

export function distanceBetween(a: Place, b: Place): Distance {
  if (!a.region || !b.region) return "unknown";
  if (a.city && a.city === b.city) return "same_city";
  if (a.region === "NCR" && b.region === "NCR") return "same_city"; // Metro Manila behaves as one delivery zone
  if (a.province && a.province === b.province) return "same_province";
  const ga = islandGroup(a.region);
  const gb = islandGroup(b.region);
  if (!ga || !gb) return "unknown";
  return ga === gb ? "same_island" : "cross_island";
}

/** Rough size class from weight (kg) when known, otherwise from the number of units. */
export function sizeClass(totalWeightKg: number | null, totalQty: number): "small" | "medium" | "heavy" {
  if (totalWeightKg != null) return totalWeightKg <= 5 ? "small" : totalWeightKg <= 40 ? "medium" : "heavy";
  return totalQty <= 20 ? "small" : totalQty <= 300 ? "medium" : "heavy";
}

export function recommendShipping(input: { seller: Place; buyer: Place; totalWeightKg: number | null; totalQty: number; urgent: boolean }): Recommendation[] {
  const dist = distanceBetween(input.seller, input.buyer);
  const size = sizeClass(input.totalWeightKg, input.totalQty);
  const out: Recommendation[] = [];
  const add = (kind: ShippingKind, reason: string) => {
    if (!out.some((r) => r.kind === kind)) out.push({ kind, reason });
  };

  switch (dist) {
    case "same_city":
      if (input.urgent || size !== "heavy") add("on_demand", input.urgent ? "same_day" : "local_on_demand");
      if (size === "heavy") add("trucking", "heavy_local");
      add("pickup", "pickup_local");
      add("courier", "courier_fallback");
      break;
    case "same_province":
      if (size === "small") add(input.urgent ? "on_demand" : "courier", input.urgent ? "same_day" : "courier_small");
      if (size !== "small") add("van_jeep", "van_nearby");
      if (size === "heavy") add("trucking", "heavy_local");
      add("courier", "courier_small");
      add("bus", "bus_cargo");
      add("pickup", "pickup_local");
      break;
    case "same_island":
      if (size === "small") add("courier", input.urgent ? "courier_express" : "courier_small");
      if (size === "medium") {
        add(input.urgent ? "courier" : "bus", input.urgent ? "courier_express" : "bus_cargo");
        add("courier", "courier_small");
      }
      if (size === "heavy") add("trucking", "heavy_long");
      add("bus", "bus_cargo");
      add("courier", "courier_small");
      break;
    case "cross_island":
      // No buses or vans across the sea: couriers with sea/air freight, or trucking with RORO for bulk.
      if (size === "heavy") add("trucking", "heavy_sea");
      add("courier", input.urgent ? "courier_express" : "courier_sea");
      if (size !== "small") add("trucking", "heavy_sea");
      break;
    default:
      add("courier", "courier_small");
      if (size === "heavy") add("trucking", "heavy_long");
      add("pickup", "pickup_local");
  }
  return out;
}

/** The price a buyer sees for `qty` units: the best wholesale tier that applies, else the base price (fixed-price listings only). */
export function unitPriceFor(
  listing: { price_type: string; price_min: number | null },
  tiers: { min_qty: number; unit_price: number }[],
  qty: number,
): number | null {
  if (listing.price_type !== "fixed") return null; // range / message-for-price: the seller quotes it
  const tier = [...tiers].sort((a, b) => b.min_qty - a.min_qty).find((t) => t.min_qty <= qty);
  return tier ? tier.unit_price : listing.price_min;
}
