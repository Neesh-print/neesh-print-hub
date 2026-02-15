import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateApprovalEmail, generateRejectionEmail, EMAIL_SUBJECTS } from "@/lib/emailTemplates";

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

export interface EmailPreviewData {
  to: string;
  subject: string;
  html: string;
  recipientName: string;
  businessName: string;
}

export interface UseApplicationsReturn {
  applications: Application[];
  isLoading: boolean;
  error: string | null;
  approveApplication: (id: string, type: 'publisher' | 'retailer') => Promise<boolean>;
  rejectApplication: (id: string, type: 'publisher' | 'retailer', reason: string) => Promise<boolean>;
  getApprovalEmailPreview: (id: string, type: 'publisher' | 'retailer') => Promise<EmailPreviewData | null>;
  getRejectionEmailPreview: (id: string, type: 'publisher' | 'retailer', reason: string) => Promise<EmailPreviewData | null>;
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
    try {
      // Call Edge Function to approve application
      // This handles user creation securely with the service role key
      const { data, error } = await supabase.functions.invoke('approve-application', {
        body: {
          applicationId: id,
          type: type,
          redirectUrl: 'https://neesh.art',
        },
      });

      if (error) {
        console.error('Error approving application:', error);
        throw new Error(error.message || 'Failed to approve application');
      }

      if (!data.success) {
        throw new Error(data.error || 'Application approval failed');
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
      // Get application data first to get user_id
      const { data: applicationData, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const application = applicationData as any;

      // For publishers with existing user_id: Update the publishers table application_status to 'rejected'
      if (type === 'publisher' && application.user_id) {
        const { error: updatePublisherError } = await supabase
          .from('publishers')
          .update({
            application_status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id,
            rejection_reason: reason,
          })
          .eq('user_id', application.user_id);

        if (updatePublisherError) {
          console.error('Error updating publisher rejection status:', updatePublisherError);
        }
      }

      // Update application status in the applications table
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

      // Optionally send rejection email
      const email = application.email || application.buyer_email;
      if (email) {
        try {
          // TODO: Implement rejection email notification
          // This could be done via a Supabase Edge Function or external email service
          console.log(`Should send rejection email to ${email} with reason: ${reason}`);
        } catch (emailError) {
          console.error('Error sending rejection email:', emailError);
          // Don't fail the rejection if email fails
        }
      }

      await fetchApplications();
      return true;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject application');
      return false;
    }
  };

  const getApprovalEmailPreview = async (id: string, type: 'publisher' | 'retailer'): Promise<EmailPreviewData | null> => {
    const table = type === 'publisher' ? 'publisher_applications' : 'retailer_applications';

    try {
      const { data: applicationData, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const application = applicationData as any;
      const email = application.email || application.buyer_email;
      const firstName = application.first_name || application.buyer_name?.split(' ')[0] || 'there';
      const businessName = type === 'publisher'
        ? (application.business_name || application.magazine_title || 'Your Business')
        : (application.shop_name || 'Your Shop');

      // Generate a placeholder magic link URL (actual link will be generated when sending)
      const magicLinkUrl = `${window.location.origin}/${type}`;

      const html = generateApprovalEmail({
        firstName,
        businessName,
        role: type,
        magicLinkUrl,
      });

      return {
        to: email,
        subject: EMAIL_SUBJECTS.approval(businessName),
        html,
        recipientName: firstName,
        businessName,
      };
    } catch (err) {
      console.error('Error generating approval email preview:', err);
      return null;
    }
  };

  const getRejectionEmailPreview = async (id: string, type: 'publisher' | 'retailer', reason: string): Promise<EmailPreviewData | null> => {
    const table = type === 'publisher' ? 'publisher_applications' : 'retailer_applications';

    try {
      const { data: applicationData, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const application = applicationData as any;
      const email = application.email || application.buyer_email;
      const firstName = application.first_name || application.buyer_name?.split(' ')[0] || 'there';
      const businessName = type === 'publisher'
        ? (application.business_name || application.magazine_title || 'Your Business')
        : (application.shop_name || 'Your Shop');

      const html = generateRejectionEmail({
        firstName,
        businessName,
        role: type,
        reason,
      });

      return {
        to: email,
        subject: EMAIL_SUBJECTS.rejection(businessName),
        html,
        recipientName: firstName,
        businessName,
      };
    } catch (err) {
      console.error('Error generating rejection email preview:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  return {
    applications,
    isLoading,
    error,
    approveApplication,
    rejectApplication,
    getApprovalEmailPreview,
    getRejectionEmailPreview,
    refetch: fetchApplications
  };
};
