export const SELLER_TYPES = [
  "manufacturer",
  "direct_importer",
  "distributor",
  "reseller",
  "retailer",
  "service_provider",
] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

export const STOCK_STATUSES = ["in_stock", "made_to_order", "pre_order", "out_of_stock"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const PRICE_TYPES = ["fixed", "range", "message"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const REPORT_REASONS = ["scam", "fake_item", "prohibited_item", "harassment", "spam", "wrong_info", "other"] as const;

export type ListingCardData = {
  id: string;
  title: string;
  price_type: PriceType;
  price_min: number | null;
  price_max: number | null;
  unit: string;
  moq: number;
  stock_status: StockStatus;
  condition: "new" | "used" | "refurbished" | "surplus";
  quantity_on_hand: number | null;
  created_at: string;
  stores: {
    id: string;
    slug: string;
    name: string;
    seller_type: SellerType;
    verification_level: number;
  };
  listing_images: { path: string; position: number }[];
  psgc_cities: { name: string } | null;
};

export const LISTING_CARD_SELECT = `
  id, title, price_type, price_min, price_max, unit, moq, stock_status, condition, quantity_on_hand, created_at,
  stores!inner ( id, slug, name, seller_type, verification_level ),
  listing_images ( path, position ),
  psgc_cities ( name )
` as const;
