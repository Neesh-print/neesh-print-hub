/**
 * Browser entry point for the shared shipping and pricing rules.
 * The single source of truth lives with the edge functions so that the cart,
 * the title page and create-checkout run the same code.
 */
export * from "../../supabase/functions/_shared/shipping.ts";
