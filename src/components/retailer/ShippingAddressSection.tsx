import { useFormContext, useWatch } from 'react-hook-form';
import { useMemo, useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
 *
 * By default, shipping address is the same as the store address.
 * A checkbox allows retailers to specify a different shipping/receiving address.
 */
export function ShippingAddressSection() {
  const form = useFormContext();

  const selectedCountry = useWatch({ control: form.control, name: 'shipping_country' });
  const storeCity = useWatch({ control: form.control, name: 'city' });
  const storeState = useWatch({ control: form.control, name: 'state' });
  const storeCountry = useWatch({ control: form.control, name: 'country' });

  const regions = useMemo(() => getRegionsForCountry(selectedCountry || 'US'), [selectedCountry]);
  const regionLabel = getRegionLabel(selectedCountry || 'US');

  // Default: shipping address is the same as store address (fields hidden).
  // When true → different address → show the shipping form.
  const [isDifferentAddress, setIsDifferentAddress] = useState(false);

  // On mount, check if there's already saved shipping data that differs from store
  useEffect(() => {
    const shippingCity = form.getValues('shipping_city');
    const shippingState = form.getValues('shipping_state');
    const shippingCountry = form.getValues('shipping_country');
    const shippingAddr = form.getValues('shipping_address_line_1');

    // If there's existing shipping data that differs from store, pre-expand the form
    if (shippingAddr || (shippingCity && shippingCity !== storeCity) ||
        (shippingState && shippingState !== storeState) ||
        (shippingCountry && shippingCountry !== storeCountry)) {
      setIsDifferentAddress(true);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When "different address" is toggled OFF, sync shipping fields from store
  useEffect(() => {
    if (!isDifferentAddress) {
      if (storeCity) form.setValue('shipping_city', storeCity);
      if (storeState) form.setValue('shipping_state', storeState);
      if (storeCountry) form.setValue('shipping_country', storeCountry || 'US');
    }
  }, [isDifferentAddress, storeCity, storeState, storeCountry, form]);

  // Clear state when country changes (if current state is not valid for new country)
  useEffect(() => {
    const currentState = form.getValues('shipping_state');
    if (currentState && !regions.some(r => r.value === currentState)) {
      form.setValue('shipping_state', '');
    }
  }, [selectedCountry, regions, form]);

  return (
    <div className="space-y-6">
      {/* Different address checkbox */}
      <div className="flex items-center space-x-3 py-2">
        <Checkbox
          id="different-shipping-address"
          checked={isDifferentAddress}
          onCheckedChange={(checked) => setIsDifferentAddress(checked === true)}
        />
        <label
          htmlFor="different-shipping-address"
          className="text-sm font-medium leading-none cursor-pointer select-none"
        >
          My shipping/receiving address is different from my store address
        </label>
      </div>

      {/* Shipping form fields — only visible when "different address" is checked */}
      {isDifferentAddress && (
        <>
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
        </>
      )}
    </div>
  );
}
