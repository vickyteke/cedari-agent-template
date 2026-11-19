export type Product = {
  id: string;
  store_key: string;
  shopify_product_id: string;
  shopify_variant_id: string;
  handle: string;
  title: string;
  description: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[];
  price: number;
  compare_at_price: number | null;
  currency: string;
  available: boolean;
  inventory_quantity: number | null;
  image_url: string | null;
  product_url: string;
  variant_title: string | null;
  updated_at: string;
  listing_id?: string;
  variant_id?: string;
  merchant_name?: string;
  variant_options?: Record<string, string>;
  variant_count?: number;
};

export type ProductSearch = {
  excludeProductIds?: string[];
  query?: string;
  store?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  limit?: number;
};
