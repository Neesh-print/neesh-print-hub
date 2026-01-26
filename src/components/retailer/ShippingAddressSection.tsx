import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo, useEffect } from 'react';
import { COUNTRIES, getRegionsForCountry, getRegionLabel } from '@/lib/geography';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Shipping address fields to embed in the profile edit form.
 * Uses the parent form context - field names are prefixed with 'shipping_'.
 */
export function ShippingAddressSection() {
  const form = useFormContext();
  
  const selectedCountry = useWatch({ control: form.control, name: 'shipping_country' });
  const regions = useMemo(() => getRegionsForCountry(selectedCountry || 'US'), [selectedCountry]);
  const regionLabel = getRegionLabel(selectedCountry || 'US');

  // Clear state when country changes (if current state is not valid for new country)
  useEffect(() => {
    const currentState = form.getValues('shipping_state');
    if (currentState && !regions.some(r => r.value === currentState)) {
      form.setValue('shipping_state', '');
    }
  }, [selectedCountry, regions, form]);

  return (
    <div className="space-y-6">
      {/* Recipient Section */}
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="shipping_recipient_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient Name *</FormLabel>
              <FormControl>
                <Input placeholder="Emily Richardson" {...field} />
              </FormControl>
              <FormDescription>
                Name of person receiving packages
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shipping_company_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company / Store Name</FormLabel>
              <FormControl>
                <Input placeholder="Powell's City of Books" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shipping_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="(503) 555-0123" {...field} />
              </FormControl>
              <FormDescription>
                For delivery issues or questions
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Address Section */}
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="shipping_address_line_1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address *</FormLabel>
              <FormControl>
                <Input placeholder="1005 W Burnside St" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shipping_address_line_2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address Line 2</FormLabel>
              <FormControl>
                <Input placeholder="Apartment, suite, unit, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="shipping_city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City *</FormLabel>
                <FormControl>
                  <Input placeholder="Portland" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shipping_state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{regionLabel} *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} key={selectedCountry}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${regionLabel.toLowerCase()}`} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-background">
                    {regions.map((region) => (
                      <SelectItem key={region.value} value={region.value}>
                        {region.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="shipping_postal_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP Code *</FormLabel>
                <FormControl>
                  <Input placeholder="97209" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shipping_country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-background">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* Delivery Instructions */}
      <FormField
        control={form.control}
        name="shipping_delivery_instructions"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Delivery Instructions (optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Ring buzzer at side entrance..."
                className="resize-none"
                rows={3}
                {...field}
              />
            </FormControl>
            <FormDescription>
              Special instructions for delivery drivers
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
