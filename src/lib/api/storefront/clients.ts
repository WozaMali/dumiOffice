/**
 * Storefront shopper profile (`public.store_clients`).
 * @see docs/client_data_schema.sql
 */
import { storefrontApi } from "../storefront";

export type { StoreClient, StoreClientAddressRow } from "../storefront";

/** Ensures a row exists for the current session and returns it (upserts from auth). */
export function ensureStoreClient() {
  return storefrontApi.getOrCreateClientFromSession();
}
