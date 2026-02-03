import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, ButtonSecondary, ButtonPrimary } from "@/components/neesh";
import { toast } from "sonner";
import { Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StripeAccountManagement } from "@/components/stripe/StripeAccountManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const PublisherPayoutSettings = () => {
  const navigate = useNavigate();
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);
  const [hasStripeAccount, setHasStripeAccount] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkStripeStatus();
    
    // Check if returning from Stripe onboarding
    const params = new URLSearchParams(window.location.search);
    if (params.get('onboarding') === 'complete') {
      toast.success("Stripe account connected successfully! You can now receive payouts.");
      // Remove the query param
      window.history.replaceState({}, '', '/publisher/settings/payout');
      // Recheck stripe status
      checkStripeStatus();
    }
  }, []);

  const checkStripeStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('publishers')
        .select('stripe_account_id')
        .eq('id', user.id)
        .maybeSingle(); // Use maybeSingle() to handle 0 or 1 rows gracefully

      // Only log errors that aren't "no rows found"
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking stripe status:', error);
        return;
      }

      // If no publisher record found, show the "not connected" state
      if (!data) {
        console.log('No publisher record found for user:', user.id);
        setHasStripeAccount(false);
        setIsLoading(false);
        return;
      }

      if (data.stripe_account_id) {
          setHasStripeAccount(true);
      } else {
          // Attempt sync
          console.log('No local Stripe ID, attempting sync...');
          try {
              const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-stripe-account');
              if (syncData?.found && syncData?.stripe_account_id) {
                  console.log('Synced Stripe ID:', syncData.stripe_account_id);
                  setHasStripeAccount(true);
                  if (syncData.restored) {
                      toast.success("Payment account restored!");
                  }
              } else {
                  setHasStripeAccount(false);
              }
          } catch (e) {
              console.error("Sync failed", e);
              setHasStripeAccount(false);
          }
      }

    } catch (error) {
      console.error('Error checking stripe status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback to open Stripe Dashboard directly
  const handleOpenDashboard = async () => {
    try {
      setIsOpeningDashboard(true);
      const { data, error } = await supabase.functions.invoke('create-connect-login-link');
      
      if (error) {
        if (error instanceof Error && error.message.includes('404')) {
           toast.error("Stripe account not found. Please contact support.");
           setHasStripeAccount(false);
           return;
        }
        throw error;
      }
      
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        toast.error("Could not generate dashboard link");
      }
    } catch (error) {
      console.error('Error opening dashboard:', error);
      toast.error("Failed to open Stripe Dashboard");
    } finally {
      setIsOpeningDashboard(false);
    }
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title="Payout Settings"
        onBack={() => navigate("/publisher/settings")}
      />

      <div className="px-4 md:px-6 pb-12 max-w-4xl mx-auto">
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !hasStripeAccount ? (
            <div className="card-neesh">
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <AlertCircle className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-foreground">Set Up Your Payout Method</h3>
                    <p className="text-muted-foreground mt-1">
                      Connect your bank account with Stripe to receive payments from retailers. This secure process only takes a few minutes.
                    </p>
                  </div>
                </div>

                <ButtonPrimary 
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      const { data, error } = await supabase.functions.invoke('create-stripe-account');
                      
                      console.log('create-stripe-account response:', { data, error });
                      
                      if (error) {
                        console.error('Error creating Stripe account:', error);
                        // Try to get the actual error message from the response
                        let errorMessage = "Failed to create Stripe account";
                        
                        if (data?.error) {
                          errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                        } else if (error.message) {
                          errorMessage = error.message;
                        }
                        
                        console.error('Displaying error:', errorMessage);
                        toast.error(errorMessage);
                        return;
                      }
                      
                      if (data?.url) {
                        // Redirect to Stripe onboarding
                        console.log('Redirecting to Stripe onboarding:', data.url);
                        window.location.href = data.url;
                      } else {
                        console.error('No URL in response:', data);
                        toast.error("Could not generate onboarding link");
                      }
                    } catch (error) {
                      console.error('Error setting up payouts:', error);
                      toast.error("Failed to set up payouts");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Set Up Payouts with Stripe'
                  )}
                </ButtonPrimary>

                <p className="text-sm text-muted-foreground">
                  Powered by <strong>Stripe Connect</strong> • Secure and trusted by millions of businesses
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Embedded Stripe Components */}
              <div className="card-neesh">
                <Tabs defaultValue="account" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="account">Account Details</TabsTrigger>
                    <TabsTrigger value="payouts">Payouts</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="account" className="mt-0">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-display font-semibold text-lg text-foreground">
                          Account Management
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Update your bank account details, business information, and tax forms.
                        </p>
                      </div>
                      <StripeAccountManagement component="account_management" />
                    </div>
                  </TabsContent>

                  <TabsContent value="payouts" className="mt-0">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-display font-semibold text-lg text-foreground">
                          Payout History
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          View your payout history, upcoming payouts, and manage your payout schedule.
                        </p>
                      </div>
                      <StripeAccountManagement component="payouts" />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Fallback option */}
              <div className="card-neesh">
                <h3 className="font-display font-semibold text-lg text-foreground mb-3">
                  Need More Options?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  For advanced settings, tax forms, or if you're having issues with the embedded view, 
                  you can open the full Stripe Dashboard.
                </p>
                <ButtonSecondary 
                  onClick={handleOpenDashboard}
                  disabled={isOpeningDashboard}
                >
                  {isOpeningDashboard ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    <>
                      Open Full Stripe Dashboard
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </>
                  )}
                </ButtonSecondary>
              </div>
            </>
          )}
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherPayoutSettings;

