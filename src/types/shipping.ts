/**
 * Shipping address types for retailer order fulfillment.
 */

export interface ShippingAddress {
  id: string;
  retailer_id: string;
  
  label: string | null;
  recipient_name: string;
  company_name: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  
  phone: string | null;
  delivery_instructions: string | null;
  
  is_default: boolean;
  is_verified: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface ShippingAddressFormData {
  label: string;
  recipient_name: string;
  company_name: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  delivery_instructions: string;
  is_default: boolean;
}
