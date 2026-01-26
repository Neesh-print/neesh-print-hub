import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shippingAddressSchema, type ShippingAddressSchemaType } from '@/lib/schemas/shipping-address';
import { US_STATES, COUNTRIES } from '@/lib/geography';
import type { ShippingAddress } from '@/types/shipping';

import {
  Form,
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ShippingAddressFormProps {
  initialData?: ShippingAddress | null;
  onSubmit: (data: ShippingAddressSchemaType) => Promise<void>;
  onCancel: () => void;
  isFirstAddress?: boolean;
  isSubmitting?: boolean;
}

export function ShippingAddressForm({
  initialData,
  onSubmit,
  onCancel,
  isFirstAddress = false,
  isSubmitting = false,
}: ShippingAddressFormProps) {
  const form = useForm<ShippingAddressSchemaType>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: {
      label: initialData?.label || '',
      recipient_name: initialData?.recipient_name || '',
      company_name: initialData?.company_name || '',
      address_line_1: initialData?.address_line_1 || '',
      address_line_2: initialData?.address_line_2 || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postal_code: initialData?.postal_code || '',
      country: initialData?.country || 'US',
      phone: initialData?.phone || '',
      delivery_instructions: initialData?.delivery_instructions || '',
      is_default: initialData?.is_default ?? true,
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Address Label */}
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address Label (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Main Store" {...field} />
              </FormControl>
              <FormDescription>
                Give this address a nickname (e.g., "Main Store", "Warehouse")
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recipient Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recipient Information
          </h3>

          <FormField
            control={form.control}
            name="recipient_name"
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
            name="company_name"
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
            name="phone"
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
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Street Address
          </h3>

          <FormField
            control={form.control}
            name="address_line_1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1 *</FormLabel>
                <FormControl>
                  <Input placeholder="1005 W Burnside St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address_line_2"
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
              name="city"
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
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
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
              name="postal_code"
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
              name="country"
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
          name="delivery_instructions"
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

        {/* Default Address Checkbox - hide if first address */}
        {!isFirstAddress && (
          <FormField
            control={form.control}
            name="is_default"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">
                  Set as my default shipping address
                </FormLabel>
              </FormItem>
            )}
          />
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Address'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
