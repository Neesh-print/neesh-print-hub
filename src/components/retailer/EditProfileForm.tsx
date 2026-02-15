import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2, MapPin, Globe } from "lucide-react";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ButtonSecondary } from "@/components/neesh";

import { StoreTypeSelector } from "./StoreTypeSelector";
import { ProfileImageUpload } from "./ProfileImageUpload";
import { ProfileProgress } from "./ProfileProgress";
import { ShippingAddressSection } from "./ShippingAddressSection";

import { US_STATES } from "@/lib/us-states";
import { COUNTRY_LIST } from "@/lib/countries";
import { checkProfileCompletion } from "@/lib/profile-completion";
import { normalizeInstagramHandle, normalizeWebsiteUrl } from "@/lib/social-links";
import { useRetailerProfile } from "@/hooks/useRetailerProfile";
import { useShippingAddress, useSaveShippingAddress } from "@/hooks/useShippingAddress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Form validation schema - now includes shipping address fields
const profileFormSchema = z.object({
  shop_name: z
    .string()
    .min(2, 'Store name must be at least 2 characters')
    .max(200, 'Store name must be under 200 characters'),
  
  contact_name: z
    .string()
    .min(2, 'Contact name must be at least 2 characters')
    .max(200, 'Contact name must be under 200 characters'),
  
  contact_email: z
    .string()
    .email('Enter a valid email address'),
  
  city: z
    .string()
    .min(2, 'City is required'),
  
  state: z
    .string()
    .min(1, 'State is required'),
  
  country: z
    .string()
    .default('US'),
  
  shop_description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(2000, 'Description must be under 2000 characters'),
  
  store_types: z
    .array(z.string())
    .min(1, 'Select at least one store type'),
  
  shop_url: z.preprocess(
    (val) => {
      if (!val || typeof val !== 'string' || val.trim() === '') return '';
      const trimmed = val.trim();
      if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
      return trimmed;
    },
    z.string().url('Enter a valid website (e.g. yourstore.com)').optional().or(z.literal(''))
  ),
  
  instagram_handle: z
    .string()
    .regex(/^[a-zA-Z0-9_.]*$/, 'Enter a valid Instagram handle (letters, numbers, underscores, periods only)')
    .max(30)
    .optional()
    .or(z.literal('')),
  
  profile_image_url: z
    .string()
    .optional()
    .nullable(),

  // Shipping address fields
  shipping_recipient_name: z
    .string()
    .min(2, 'Recipient name is required')
    .max(200, 'Name must be under 200 characters'),
  
  shipping_company_name: z
    .string()
    .max(200, 'Company name must be under 200 characters')
    .optional()
    .or(z.literal('')),
  
  shipping_address_line_1: z
    .string()
    .min(5, 'Street address is required')
    .max(255, 'Address must be under 255 characters'),
  
  shipping_address_line_2: z
    .string()
    .max(255, 'Must be under 255 characters')
    .optional()
    .or(z.literal('')),
  
  shipping_city: z
    .string()
    .min(2, 'City is required'),
  
  shipping_state: z
    .string()
    .min(2, 'State is required'),
  
  shipping_postal_code: z
    .string()
    .min(5, 'ZIP code is required')
    .max(20, 'ZIP code must be under 20 characters')
    .regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code (e.g., 12345 or 12345-6789)'),
  
  shipping_country: z
    .string()
    .default('US'),
  
  shipping_phone: z
    .string()
    .regex(/^[\d\s\-\(\)\+]*$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  
  shipping_delivery_instructions: z
    .string()
    .max(500, 'Instructions must be under 500 characters')
    .optional()
    .or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

interface EditProfileFormProps {
  isFirstTime?: boolean;
}

export function EditProfileForm({ isFirstTime = false }: EditProfileFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { retailer, isLoading: profileLoading, refetch } = useRetailerProfile();
  const { address: shippingAddress, isLoading: addressLoading } = useShippingAddress();
  const saveShippingAddress = useSaveShippingAddress();
  const [isSaving, setIsSaving] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      shop_name: '',
      contact_name: '',
      contact_email: '',
      city: '',
      state: '',
      country: 'US',
      shop_description: '',
      store_types: [],
      shop_url: '',
      instagram_handle: '',
      profile_image_url: null,
      // Shipping defaults
      shipping_recipient_name: '',
      shipping_company_name: '',
      shipping_address_line_1: '',
      shipping_address_line_2: '',
      shipping_city: '',
      shipping_state: '',
      shipping_postal_code: '',
      shipping_country: 'US',
      shipping_phone: '',
      shipping_delivery_instructions: '',
    },
  });

  // Pre-populate form when retailer data loads
  useEffect(() => {
    if (retailer) {
      const existingImageUrl = (retailer as any).profile_image_url || null;
      form.reset({
        shop_name: retailer.shop_name || '',
        contact_name: (retailer as any).contact_name || '',
        contact_email: (retailer as any).contact_email || user?.email || '',
        city: retailer.city || '',
        state: retailer.state || '',
        country: retailer.country || 'US',
        shop_description: retailer.shop_description || '',
        store_types: (retailer as any).store_types || [],
        shop_url: retailer.shop_url || '',
        instagram_handle: retailer.instagram_handle?.replace('@', '') || '',
        profile_image_url: existingImageUrl,
        // Shipping address - use existing or prefill from contact
        shipping_recipient_name: shippingAddress?.recipient_name || (retailer as any).contact_name || '',
        shipping_company_name: shippingAddress?.company_name || retailer.shop_name || '',
        shipping_address_line_1: shippingAddress?.address_line_1 || '',
        shipping_address_line_2: shippingAddress?.address_line_2 || '',
        shipping_city: shippingAddress?.city || '',
        shipping_state: shippingAddress?.state || '',
        shipping_postal_code: shippingAddress?.postal_code || '',
        shipping_country: shippingAddress?.country || 'US',
        shipping_phone: shippingAddress?.phone || '',
        shipping_delivery_instructions: shippingAddress?.delivery_instructions || '',
      });
      setProfileImageUrl(existingImageUrl);
    }
  }, [retailer, shippingAddress, user, form]);

  // Watch form values for progress indicator
  const watchedValues = form.watch();
  const profileData = {
    shop_name: watchedValues.shop_name,
    contact_name: watchedValues.contact_name,
    contact_email: watchedValues.contact_email,
    city: watchedValues.city,
    state: watchedValues.state,
    shop_description: watchedValues.shop_description,
    store_types: watchedValues.store_types,
    shop_url: watchedValues.shop_url,
    instagram_handle: watchedValues.instagram_handle,
    profile_image_url: profileImageUrl,
  };

  const handleImageUpload = (url: string) => {
    setProfileImageUrl(url);
    form.setValue('profile_image_url', url);
  };

  const handleImageRemove = () => {
    setProfileImageUrl(null);
    form.setValue('profile_image_url', null);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user?.id) {
      toast({ title: "Not logged in", description: "Please log in and try again.", variant: "destructive" });
      return;
    }
    if (!retailer?.id) {
      toast({ title: "Profile not loaded", description: "Your profile couldn't be loaded. Please refresh the page.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      // Normalize social links
      const normalizedData = {
        shop_name: data.shop_name,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        city: data.city,
        state: data.state,
        country: data.country || 'US',
        shop_description: data.shop_description,
        store_types: data.store_types,
        shop_url: data.shop_url ? normalizeWebsiteUrl(data.shop_url) : null,
        instagram_handle: data.instagram_handle ? normalizeInstagramHandle(data.instagram_handle) : null,
        profile_image_url: profileImageUrl,
      };

      // Check if profile is now complete
      const completion = checkProfileCompletion(normalizedData);

      // Update retailer record
      const { error } = await supabase
        .from('retailers')
        .update({
          ...normalizedData,
          profile_completed_at: completion.isComplete ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', retailer.id);

      if (error) throw error;

      // Save shipping address
      await saveShippingAddress.mutateAsync({
        id: shippingAddress?.id,
        recipient_name: data.shipping_recipient_name,
        company_name: data.shipping_company_name || '',
        address_line_1: data.shipping_address_line_1,
        address_line_2: data.shipping_address_line_2 || '',
        city: data.shipping_city,
        state: data.shipping_state,
        postal_code: data.shipping_postal_code,
        country: data.shipping_country || 'US',
        phone: data.shipping_phone || '',
        delivery_instructions: data.shipping_delivery_instructions || '',
        label: '',
        is_default: true,
      });

      // Refetch profile data
      await refetch();

      toast({
        title: completion.isComplete ? "Profile complete!" : "Profile saved",
        description: completion.isComplete
          ? "Your profile is now complete! Publishers can find your store."
          : "Your changes have been saved.",
      });

      // Navigate back to dashboard
      window.scrollTo(0, 0);
      navigate('/retailer');

    } catch (error) {
      console.error('Failed to save profile:', error);
      toast({
        title: "Save failed",
        description: "Please try again.",
        variant: "destructive",
      });
      window.scrollTo(0, 0);
    } finally {
      setIsSaving(false);
    }
  };

  if (profileLoading || addressLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome message for first-time users */}
      {isFirstTime && (
        <div className="p-4 bg-cream border border-border rounded-lg">
          <h3 className="font-display font-semibold text-foreground mb-2">
            Welcome! Let's set up your store profile.
          </h3>
          <p className="text-sm text-muted-foreground">
            We've pre-filled some information from your application. Add a description 
            and select your store types to help publishers understand your business.
          </p>
        </div>
      )}

      {/* Progress indicator */}
      <ProfileProgress profile={profileData} />

      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Information Section */}
            <div className="card-neesh space-y-6">
              <h2 className="font-display font-semibold text-lg text-foreground border-b border-border pb-3">
                Basic Information
              </h2>

              {/* Profile Image */}
              <div className="flex justify-center py-4">
                <ProfileImageUpload
                  currentImageUrl={profileImageUrl}
                  userId={user?.id || ''}
                  onUpload={handleImageUpload}
                  onRemove={handleImageRemove}
                />
              </div>

              <FormField
                control={form.control}
                name="shop_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Powell's City of Books" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Emily Richardson" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="emily@powells.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Location Section */}
            <div className="card-neesh space-y-6">
              <h2 className="font-display font-semibold text-lg text-foreground border-b border-border pb-3">
                Store Location
              </h2>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State / Province *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COUNTRY_LIST.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name}
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

            {/* About Your Store Section */}
            <div className="card-neesh space-y-6">
              <h2 className="font-display font-semibold text-lg text-foreground border-b border-border pb-3">
                About Your Store
              </h2>

              <FormField
                control={form.control}
                name="shop_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell publishers what makes your store unique..."
                        className="min-h-[120px] resize-y"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 50 characters. What makes your store special? Who are your customers?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="store_types"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Store Types * (select all that apply)</FormLabel>
                    <FormControl>
                      <StoreTypeSelector
                        value={field.value}
                        onChange={field.onChange}
                        error={form.formState.errors.store_types?.message}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Shipping Address Section */}
            <div className="card-neesh space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-display font-semibold text-lg text-foreground">
                  Shipping Address
                </h2>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                Where should publishers send your orders?
              </p>

              <ShippingAddressSection />
            </div>

            {/* Online Presence Section */}
            <div className="card-neesh space-y-6">
              <h2 className="font-display font-semibold text-lg text-foreground border-b border-border pb-3">
                Online Presence
              </h2>

              <FormField
                control={form.control}
                name="shop_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Globe className="w-4 h-4" />
                        </span>
                        <Input
                          placeholder="yourstore.com"
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instagram_handle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          @
                        </span>
                        <Input 
                          placeholder="yourstorehandle" 
                          className="pl-10"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-4">
              <ButtonSecondary
                type="button"
                onClick={() => navigate('/retailer/profile')}
                disabled={isSaving}
              >
                Cancel
              </ButtonSecondary>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </FormProvider>
    </div>
  );
}
