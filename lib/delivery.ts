/** Delivery riders and bookings. Labels live in messages/*.json as dl.vehicle.<key>, dl.status.<key>, dl.doc.<key>. */

/** Vehicles a rider can register, smallest first, with a rough load limit to guide the person booking. */
export const VEHICLES = [
  { key: "motorcycle", maxKg: 20 },
  { key: "sedan", maxKg: 200 },
  { key: "mpv_suv", maxKg: 300 },
  { key: "pickup", maxKg: 1000 },
  { key: "l300_h100", maxKg: 1000 },
  { key: "closed_van", maxKg: 2000 },
  { key: "truck", maxKg: 7000 },
] as const;
export type VehicleKey = (typeof VEHICLES)[number]["key"];
export const VEHICLE_KEYS = VEHICLES.map((v) => v.key) as [VehicleKey, ...VehicleKey[]];

/** Smallest vehicle that can usually carry this weight (used to warn, never to block). */
export function suggestVehicle(totalKg: number): VehicleKey {
  return (VEHICLES.find((v) => totalKg <= v.maxKg) ?? VEHICLES[VEHICLES.length - 1]).key;
}

export const DELIVERY_STATUSES = ["open", "assigned", "picked_up", "delivered", "completed", "cancelled"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const RIDER_STATUSES = ["pending", "approved", "needs_more", "rejected", "suspended"] as const;

/** Photos a rider must attach, then the optional extra. */
export const RIDER_DOCS = ["license_front", "license_back", "or_cr", "plate_front", "plate_back"] as const;
export const RIDER_DOC_TYPES = [...RIDER_DOCS, "other"] as const;

/** "0917 123 4567", "+63 917-123-4567" → "09171234567" / "+639171234567". */
export function cleanPhone(v: unknown): string {
  return typeof v === "string" ? v.replace(/[\s().-]/g, "") : "";
}
export const PHONE_RE = /^\+?[0-9]{7,13}$/;

/** Link that opens the phone's dialer. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
