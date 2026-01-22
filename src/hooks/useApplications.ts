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
    const table = type === 'publisher' ? 'publisher_applications' : 'retailer_applications';

    try {
      // Get application data first
      const { data: applicationData, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Use any type for flexible access to application fields
      const application = applicationData as any;
      const email = application.email || application.buyer_email;

      if (!email) {
        throw new Error('No email found in application');
      }

      // Step 1: Create auth user if they don't have one already
      let userId = application.user_id;

      if (!userId) {
        // Generate a random password (they'll use magic link to sign in)
        const randomPassword = crypto.randomUUID();

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email,
          password: randomPassword,
          email_confirm: true, // Auto-confirm so they can sign in with magic link
          user_metadata: {
            role: type,
            first_name: application.first_name || application.buyer_name?.split(' ')[0],
            last_name: application.last_name || application.buyer_name?.split(' ')[1],
          },
        });

        if (authError) {
          console.error('Error creating auth user:', authError);
          throw new Error(`Failed to create account: ${authError.message}`);
        }

        if (!authData.user) {
          throw new Error('Failed to create user account');
        }

        userId = authData.user.id;

        // Step 2: Create user record in users table
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: email,
            username: email.split('@')[0],
            role: type,
            password_hash: 'managed_by_supabase_auth',
          });

        if (userError && userError.code !== '23505') {
          console.error('Error creating user record:', userError);
        }

        // Step 3: Create profile record
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            full_name: application.first_name && application.last_name
              ? `${application.first_name} ${application.last_name}`
              : application.buyer_name || email.split('@')[0],
          });

        if (profileError && profileError.code !== '23505') {
          console.error('Error creating profile:', profileError);
        }

        // Step 4: Send magic link for sign in
        try {
          const { error: magicLinkError } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
              shouldCreateUser: false, // User already exists
              emailRedirectTo: `${window.location.origin}/${type}`,
            },
          });

          if (magicLinkError) {
            console.error('Error sending magic link:', magicLinkError);
            // Don't fail the approval if email sending fails
          }
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Continue with approval even if email fails
        }
      }

      // Step 5: Create/update role-specific record
      if (type === 'publisher') {
        // Update existing publisher record or create new one
        const { error: updatePublisherError } = await supabase
          .from('publishers')
          .update({
            application_status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id,
            company_name: application.business_name || application.magazine_title,
            description: application.description,
            website_url: application.social_website_link,
            instagram_handle: application.instagram_handle?.replace('@', ''),
          })
          .eq('user_id', userId);

        if (updatePublisherError) {
          // If publisher record doesn't exist, create it
          if (updatePublisherError.code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from('publishers')
              .insert({
                user_id: userId,
                company_name: application.business_name || application.magazine_title,
                description: application.description,
                website_url: application.social_website_link,
                instagram_handle: application.instagram_handle?.replace('@', ''),
                application_status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: user?.id,
              });

            if (insertError && insertError.code !== '23505') {
              console.error('Error creating publisher:', insertError);
            }
          } else {
            console.error('Error updating publisher status:', updatePublisherError);
          }
        }
      } else if (type === 'retailer') {
        // For retailers: Create or update retailer record
        const { error: upsertError } = await supabase
          .from('retailers')
          .upsert({
            user_id: userId,
            shop_name: application.shop_name,
            shop_url: application.shop_url,
            address: application.shop_address,
            city: application.city,
            state: application.state,
            postal_code: application.postal_code,
            country: application.country,
            phone: application.phone,
            instagram_handle: application.instagram_handle,
          }, {
            onConflict: 'user_id',
          });

        if (upsertError) {
          console.error('Error creating/updating retailer:', upsertError);
        }
      }

      // Step 6: Update application status in the applications table
      const { error: updateError } = await supabase
        .from(table)
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          user_id: userId, // Link the application to the created user
        })
        .eq('id', id);

      if (updateError) throw updateError;

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
