import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Application {
  id: string;
  type: 'publisher' | 'retailer';
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  data: Record<string, any>;
}

export interface UseApplicationsOptions {
  type?: 'publisher' | 'retailer' | 'all';
  status?: 'pending' | 'approved' | 'rejected' | 'all';
}

export interface UseApplicationsReturn {
  applications: Application[];
  isLoading: boolean;
  error: string | null;
  approveApplication: (id: string, type: 'publisher' | 'retailer') => Promise<boolean>;
  rejectApplication: (id: string, type: 'publisher' | 'retailer', reason: string) => Promise<boolean>;
  refetch: () => void;
}

export const useApplications = (options: UseApplicationsOptions = {}): UseApplicationsReturn => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const allApplications: Application[] = [];

      // Fetch publisher applications if not filtered to retailers only
      if (options.type !== 'retailer') {
        let publisherQuery = supabase
          .from('publisher_applications')
          .select('*')
          .order('created_at', { ascending: false });

        if (options.status && options.status !== 'all') {
          publisherQuery = publisherQuery.eq('status', options.status);
        }

        const { data: publisherData, error: publisherError } = await publisherQuery;

        if (publisherError) throw publisherError;

        const publisherApps: Application[] = (publisherData || []).map((item: any) => ({
          id: item.id,
          type: 'publisher' as const,
          name: item.business_name || item.magazine_title || 'Unknown',
          email: item.email || '',
          status: item.status as 'pending' | 'approved' | 'rejected',
          submitted_at: item.created_at,
          reviewed_at: item.reviewed_at,
          data: item,
        }));

        allApplications.push(...publisherApps);
      }

      // Fetch retailer applications if not filtered to publishers only
      if (options.type !== 'publisher') {
        let retailerQuery = supabase
          .from('retailer_applications')
          .select('*')
          .order('created_at', { ascending: false });

        if (options.status && options.status !== 'all') {
          retailerQuery = retailerQuery.eq('status', options.status);
        }

        const { data: retailerData, error: retailerError } = await retailerQuery;

        if (retailerError) throw retailerError;

        const retailerApps: Application[] = (retailerData || []).map((item: any) => ({
          id: item.id,
          type: 'retailer' as const,
          name: item.shop_name || 'Unknown',
          email: item.buyer_email || '',
          status: item.status as 'pending' | 'approved' | 'rejected',
          submitted_at: item.submitted_at || item.created_at,
          reviewed_at: item.reviewed_at,
          data: item,
        }));

        allApplications.push(...retailerApps);
      }

      // Sort all applications by date
      allApplications.sort((a, b) => 
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );

      setApplications(allApplications);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch applications');
    } finally {
      setIsLoading(false);
    }
  }, [options.type, options.status]);

  const approveApplication = async (id: string, type: 'publisher' | 'retailer'): Promise<boolean> => {
    const table = type === 'publisher' ? 'publisher_applications' : 'retailer_applications';

    try {
      // Update application status
      const { error: updateError } = await supabase
        .from(table)
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Get application data
      const { data: applicationData, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Use any type for flexible access to application fields
      const application = applicationData as any;

      // Create publisher or retailer record based on application
      if (type === 'publisher' && application) {
        const { error: insertError } = await supabase
          .from('publishers')
          .insert({
            user_id: application.user_id,
            company_name: application.business_name || application.magazine_title,
            description: application.description,
            website_url: application.social_website_link,
          });

        if (insertError && insertError.code !== '23505') { // Ignore duplicate key errors
          console.error('Error creating publisher:', insertError);
        }
      } else if (type === 'retailer' && application) {
        const { error: insertError } = await supabase
          .from('retailers')
          .insert({
            user_id: application.user_id || application.id, // Fallback to app id if no user_id
            shop_name: application.shop_name,
            shop_url: application.shop_url,
            address: application.shop_address,
            city: application.city,
            state: application.state,
            postal_code: application.postal_code,
            country: application.country,
            phone: application.phone,
            instagram_handle: application.instagram_handle,
          });

        if (insertError && insertError.code !== '23505') {
          console.error('Error creating retailer:', insertError);
        }
      }

      await fetchApplications();
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve application');
      return false;
    }
  };

  const rejectApplication = async (id: string, type: 'publisher' | 'retailer', reason: string): Promise<boolean> => {
    const table = type === 'publisher' ? 'publisher_applications' : 'retailer_applications';
    const reasonField = type === 'publisher' ? 'reviewer_notes' : 'denial_reason';

    try {
      const { error: updateError } = await supabase
        .from(table)
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          [reasonField]: reason,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchApplications();
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject application');
      return false;
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return { applications, isLoading, error, approveApplication, rejectApplication, refetch: fetchApplications };
};
