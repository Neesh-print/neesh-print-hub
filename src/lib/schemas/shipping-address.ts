import { z } from 'zod';

export const shippingAddressSchema = z.object({
  label: z
    .string()
    .max(100, 'Label must be under 100 characters')
    .optional()
    .or(z.literal('')),
  
  recipient_name: z
    .string()
    .min(2, 'Recipient name is required')
    .max(200, 'Name must be under 200 characters'),
  
  company_name: z
    .string()
    .max(200, 'Company name must be under 200 characters')
    .optional()
    .or(z.literal('')),
  
  address_line_1: z
    .string()
    .min(5, 'Street address is required')
    .max(255, 'Address must be under 255 characters'),
  
  address_line_2: z
    .string()
    .max(255, 'Must be under 255 characters')
    .optional()
    .or(z.literal('')),
  
  city: z
    .string()
    .min(2, 'City is required')
    .max(100, 'City must be under 100 characters'),
  
  state: z
    .string()
    .min(2, 'State is required'),
  
  postal_code: z
    .string()
    .min(5, 'ZIP code is required')
    .max(20, 'ZIP code must be under 20 characters')
    .regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code (e.g., 12345 or 12345-6789)'),
  
  country: z
    .string()
    .default('US'),
  
  phone: z
    .string()
    .regex(/^[\d\s\-\(\)\+]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  
  delivery_instructions: z
    .string()
    .max(500, 'Instructions must be under 500 characters')
    .optional()
    .or(z.literal('')),
  
  is_default: z
    .boolean()
    .default(true),
});

export type ShippingAddressSchemaType = z.infer<typeof shippingAddressSchema>;
