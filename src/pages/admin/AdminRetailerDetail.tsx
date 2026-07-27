import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, Mail, MapPin, MessageSquare, Edit, Phone, AlertCircle, Loader2, Store } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, DataTable, StatusBadge, ButtonSecondary } from "@/components/neesh";
import { supabase } from "@/integrations/supabase/client";
import { useOrders } from "@/hooks/useOrders";
import { format } from "date-fns";

interface RetailerData {
  id: string;
  user_id: string;
  shop_name: string | null;
  shop_description: string | null;
  shop_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  instagram_handle: string | null;
  verified: boolean | null;
  total_orders: number | null;
  total_spent: number | null;
  created_at: string | null;
}

export const AdminRetailerDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [retailer, setRetailer] = useState<RetailerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  // Net-terms / credit controls
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [netTermsDays, setNetTermsDays] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);
  const [termsStatus, setTermsStatus] = useState<'none' | 'pending' | 'approved' | 'suspended'>('none');
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsMessage, setTermsMessage] = useState<string | null>(null);

  const fetchRetailer = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('retailers')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Retailer not found');

      setRetailer(data);
      const row = data as unknown as Record<string, unknown>;
      setTermsEnabled(Boolean(row.payment_terms_enabled));
      setNetTermsDays(Number(row.net_terms_days ?? 0));
      setCreditLimit(Number(row.credit_limit ?? 0));
      setTermsStatus(((row.terms_status as string) ?? 'none') as 'none' | 'pending' | 'approved' | 'suspended');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch retailer');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRetailer();
  }, [fetchRetailer]);

  // Fetch recent orders for this retailer
  const { orders: recentOrders } = useOrders({ retailerId: retailer?.user_id, limit: 5 });

  const handleSaveTerms = async () => {
    if (!retailer) return;
    setSavingTerms(true);
    setTermsMessage(null);
    try {
      const { error: fnError } = await supabase.functions.invoke('set-retailer-terms', {
        body: {
          retailer_user_id: retailer.user_id,
          payment_terms_enabled: termsEnabled,
          net_terms_days: netTermsDays,
          credit_limit: creditLimit,
          terms_status: termsStatus,
        },
      });
      if (fnError) throw fnError;
      setTermsMessage('Saved.');
      fetchRetailer();
    } catch (err) {
      setTermsMessage(err instanceof Error ? err.message : 'Failed to save terms');
    } finally {
      setSavingTerms(false);
    }
  };

  const handleSuspend = async () => {
    if (!retailer) return;
    try {
      await supabase
        .from('retailers')
        .update({ verified: false })
        .eq('id', retailer.id);
      setShowSuspendModal(false);
      fetchRetailer();
    } catch (err) {
      console.error('Failed to suspend retailer:', err);
    }
  };

  const orderColumns = [
    { key: "orderNumber", header: "Order #" },
    { key: "total", header: "Total", render: (value: unknown) => `$${(value as number).toFixed(2)}` },
    { key: "date", header: "Date" },
    { key: "status", header: "Status", render: (value: unknown) => <StatusBadge status={value as 'pending' | 'received'} /> },
  ];

  const transformedOrders = recentOrders.map(order => ({
    id: order.id,
    orderNumber: order.order_number,
    total: order.total_amount,
    date: order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : '',
    status: (order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered' ? 'received' : 'pending') as 'pending' | 'received',
  }));

  if (isLoading) {
    return (
      <AdminLayout>
        <BackNavigation title="Retailer Details" onBack={() => navigate("/admin/retailers")} />
        <div className="px-4 md:px-6 pb-8 flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-body text-muted-foreground">Loading retailer...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !retailer) {
    return (
      <AdminLayout>
        <BackNavigation title="Retailer Details" onBack={() => navigate("/admin/retailers")} />
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-status-error-text mb-3" />
            <h3 className="font-display font-semibold text-heading text-foreground mb-1">Retailer not found</h3>
            <p className="text-body text-muted-foreground mb-4">{error || 'This retailer could not be loaded.'}</p>
            <ButtonSecondary onClick={() => navigate("/admin/retailers")}>Back to Retailers</ButtonSecondary>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const statusLabels: Record<string, string> = {
    received: 'Active',
    pending: 'Inactive',
    unfulfilled: 'Suspended',
  };
  const retailerStatus = retailer.verified ? 'received' as const : 'pending' as const;
  const location = [retailer.city, retailer.state].filter(Boolean).join(', ');
  const fullAddress = [retailer.address, retailer.city, retailer.state, retailer.postal_code].filter(Boolean).join(', ');

  return (
    <AdminLayout>
      <BackNavigation title={retailer.shop_name || 'Retailer'} onBack={() => navigate("/admin/retailers")} />

      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="card-neesh">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center">
                  <Store className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display font-bold text-heading text-foreground">{retailer.shop_name || 'Unknown Store'}</h2>
                  {location && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-body text-muted-foreground">{location}</span>
                    </div>
                  )}
                </div>
              </div>

              {retailer.shop_description && (
                <p className="text-body text-foreground mb-4">{retailer.shop_description}</p>
              )}

              <div className="space-y-2">
                {retailer.shop_url && (
                  <a href={retailer.shop_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-body text-accent hover:underline">
                    <Globe className="w-4 h-4" />
                    {retailer.shop_url}
                  </a>
                )}
                {retailer.phone && (
                  <div className="flex items-center gap-2 text-body text-foreground">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {retailer.phone}
                  </div>
                )}
                {retailer.instagram_handle && (
                  <div className="flex items-center gap-2 text-body text-foreground">
                    <span className="w-4 h-4 text-muted-foreground text-xs font-bold">IG</span>
                    @{retailer.instagram_handle}
                  </div>
                )}
                {fullAddress && (
                  <div className="flex items-center gap-2 text-body text-foreground">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {fullAddress}
                  </div>
                )}
              </div>
            </div>

            {/* Account Status */}
            <InfoCard title="Account Status">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Status</span>
                  <StatusBadge status={retailerStatus} label={statusLabels[retailerStatus]} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Member Since</span>
                  <span className="text-body text-foreground">
                    {retailer.created_at ? format(new Date(retailer.created_at), "MMMM d, yyyy") : 'Unknown'}
                  </span>
                </div>
                <ButtonSecondary
                  onClick={() => setShowSuspendModal(true)}
                  className="w-full mt-2 text-status-error-text"
                >
                  {retailer.verified ? 'Suspend Account' : 'Reactivate Account'}
                </ButtonSecondary>
              </div>
            </InfoCard>

            {/* Payment Terms / Credit */}
            <InfoCard title="Payment Terms (Net 14 / Net 30)">
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-body text-foreground">Enable payment terms</span>
                  <input
                    type="checkbox"
                    checked={termsEnabled}
                    onChange={(e) => setTermsEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>

                <div>
                  <label className="text-caption text-muted-foreground block mb-1">Max term</label>
                  <select
                    value={netTermsDays}
                    onChange={(e) => setNetTermsDays(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-body"
                  >
                    <option value={0}>None</option>
                    <option value={14}>Net 14</option>
                    <option value={30}>Net 30</option>
                  </select>
                </div>

                <div>
                  <label className="text-caption text-muted-foreground block mb-1">Credit limit (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-body"
                  />
                </div>

                <div>
                  <label className="text-caption text-muted-foreground block mb-1">Terms status</label>
                  <select
                    value={termsStatus}
                    onChange={(e) => setTermsStatus(e.target.value as 'none' | 'pending' | 'approved' | 'suspended')}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-body"
                  >
                    <option value="none">None</option>
                    <option value="pending">Pending review</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <p className="text-caption text-muted-foreground mt-1">
                    Terms are only offered at checkout when enabled AND status is “Approved”.
                  </p>
                </div>

                <ButtonSecondary onClick={handleSaveTerms} disabled={savingTerms} className="w-full">
                  {savingTerms ? 'Saving…' : 'Save terms'}
                </ButtonSecondary>
                {termsMessage && (
                  <p className="text-caption text-muted-foreground text-center">{termsMessage}</p>
                )}
              </div>
            </InfoCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Order History Stats */}
            <InfoCard title="Order History">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-caption text-muted-foreground">Total Orders</p>
                  <p className="font-display font-bold text-display-sm text-foreground">{retailer.total_orders || 0}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Total Spent</p>
                  <p className="font-display font-bold text-display-sm text-foreground">${(retailer.total_spent || 0).toLocaleString()}</p>
                </div>
              </div>
            </InfoCard>

            {/* Recent Orders */}
            <div className="card-neesh">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-heading text-foreground">Recent Orders</h3>
                <button
                  onClick={() => navigate("/admin/orders")}
                  className="text-caption text-accent hover:underline"
                >
                  View all
                </button>
              </div>
              {transformedOrders.length > 0 ? (
                <DataTable
                  columns={orderColumns}
                  data={transformedOrders as unknown as Record<string, unknown>[]}
                  onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
                />
              ) : (
                <div className="text-center py-6">
                  <p className="text-caption text-muted-foreground">No orders yet</p>
                </div>
              )}
            </div>

            {/* Admin Actions */}
            <div className="card-neesh">
              <h3 className="font-display font-semibold text-heading text-foreground mb-4">Admin Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <ButtonSecondary className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </ButtonSecondary>
                <ButtonSecondary onClick={() => navigate("/admin/orders")} className="gap-2">
                  View Full Order History
                </ButtonSecondary>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suspend Modal */}
      <ConfirmationModal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        onConfirm={handleSuspend}
        title={retailer.verified ? "Suspend Retailer" : "Reactivate Retailer"}
        message={retailer.verified
          ? `Are you sure you want to suspend ${retailer.shop_name}? They will no longer be able to place orders or access their account.`
          : `Are you sure you want to reactivate ${retailer.shop_name}?`
        }
        confirmLabel={retailer.verified ? "Suspend" : "Reactivate"}
        confirmVariant={retailer.verified ? "destructive" : undefined}
      />
    </AdminLayout>
  );
};

export default AdminRetailerDetail;
