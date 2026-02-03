import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, Instagram, Mail, MapPin, MessageSquare, Edit, DollarSign, AlertCircle, Loader2, BookOpen } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, DataTable, StatusBadge, ButtonSecondary } from "@/components/neesh";
import { supabase } from "@/integrations/supabase/client";
import { useOrders } from "@/hooks/useOrders";
import { format } from "date-fns";

interface PublisherData {
  id: string;
  user_id: string;
  company_name: string | null;
  description: string | null;
  website_url: string | null;
  instagram_handle: string | null;
  verified: boolean | null;
  total_magazines: number | null;
  total_sales: number | null;
  created_at: string | null;
}

interface Magazine {
  id: string;
  title: string;
  cover_image_url: string | null;
  price: number;
}

export const AdminPublisherDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [publisher, setPublisher] = useState<PublisherData | null>(null);
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);

  const fetchPublisher = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('publishers')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error('Publisher not found');

      setPublisher(data);

      // Fetch magazines for this publisher
      const { data: magData } = await supabase
        .from('magazines')
        .select('id, title, cover_image_url, price')
        .eq('publisher_id', data.id)
        .order('created_at', { ascending: false });

      setMagazines(magData || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch publisher');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPublisher();
  }, [fetchPublisher]);

  // Fetch recent orders for this publisher's magazines
  const { orders: recentOrders } = useOrders({ publisherId: publisher?.id, limit: 5 });

  const handleSuspend = async () => {
    if (!publisher) return;
    try {
      await supabase
        .from('publishers')
        .update({ verified: false })
        .eq('id', publisher.id);
      setShowSuspendModal(false);
      fetchPublisher();
    } catch (err) {
      console.error('Failed to suspend publisher:', err);
    }
  };

  const orderColumns = [
    { key: "orderNumber", header: "Order #" },
    { key: "retailer", header: "Retailer" },
    { key: "total", header: "Total", render: (value: unknown) => `$${(value as number).toFixed(2)}` },
    { key: "date", header: "Date" },
    { key: "status", header: "Status", render: (value: unknown) => <StatusBadge status={value as 'pending' | 'received'} /> },
  ];

  const transformedOrders = recentOrders.map(order => ({
    id: order.id,
    orderNumber: order.order_number,
    retailer: order.retailer?.shop_name || 'Unknown',
    total: order.total_amount,
    date: order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : '',
    status: (order.fulfillment_status === 'shipped' || order.fulfillment_status === 'delivered' ? 'received' : 'pending') as 'pending' | 'received',
  }));

  if (isLoading) {
    return (
      <AdminLayout>
        <BackNavigation title="Publisher Details" onBack={() => navigate("/admin/publishers")} />
        <div className="px-4 md:px-6 pb-8 flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-body text-muted-foreground">Loading publisher...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !publisher) {
    return (
      <AdminLayout>
        <BackNavigation title="Publisher Details" onBack={() => navigate("/admin/publishers")} />
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-status-error-text mb-3" />
            <h3 className="font-display font-semibold text-heading text-foreground mb-1">Publisher not found</h3>
            <p className="text-body text-muted-foreground mb-4">{error || 'This publisher could not be loaded.'}</p>
            <ButtonSecondary onClick={() => navigate("/admin/publishers")}>Back to Publishers</ButtonSecondary>
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
  const publisherStatus = publisher.verified ? 'received' as const : 'pending' as const;

  return (
    <AdminLayout>
      <BackNavigation title={publisher.company_name || 'Publisher'} onBack={() => navigate("/admin/publishers")} />

      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="card-neesh">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display font-bold text-heading text-foreground">{publisher.company_name || 'Unknown Publisher'}</h2>
                </div>
              </div>

              {publisher.description && (
                <p className="text-body text-foreground mb-4">{publisher.description}</p>
              )}

              <div className="space-y-2">
                {publisher.website_url && (
                  <a href={publisher.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-body text-accent hover:underline">
                    <Globe className="w-4 h-4" />
                    {publisher.website_url}
                  </a>
                )}
                {publisher.instagram_handle && (
                  <div className="flex items-center gap-2 text-body text-foreground">
                    <Instagram className="w-4 h-4 text-muted-foreground" />
                    @{publisher.instagram_handle}
                  </div>
                )}
              </div>
            </div>

            {/* Account Status */}
            <InfoCard title="Account Status">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Status</span>
                  <StatusBadge status={publisherStatus} label={statusLabels[publisherStatus]} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-body text-muted-foreground">Member Since</span>
                  <span className="text-body text-foreground">
                    {publisher.created_at ? format(new Date(publisher.created_at), "MMMM d, yyyy") : 'Unknown'}
                  </span>
                </div>
                <ButtonSecondary
                  onClick={() => setShowSuspendModal(true)}
                  className="w-full mt-2 text-status-error-text"
                >
                  {publisher.verified ? 'Suspend Account' : 'Reactivate Account'}
                </ButtonSecondary>
              </div>
            </InfoCard>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Performance */}
            <InfoCard title="Performance">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-caption text-muted-foreground">Total Sales</p>
                  <p className="font-display font-bold text-display-sm text-foreground">
                    ${(publisher.total_sales || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Total Magazines</p>
                  <p className="font-display font-bold text-display-sm text-foreground">
                    {publisher.total_magazines || magazines.length}
                  </p>
                </div>
              </div>
            </InfoCard>

            {/* Magazines */}
            <div className="card-neesh">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-heading text-foreground">Magazines ({magazines.length})</h3>
              </div>
              {magazines.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {magazines.slice(0, 8).map((mag) => (
                    <div key={mag.id} className="cursor-pointer">
                      <img
                        src={mag.cover_image_url || "/placeholder.svg"}
                        alt={mag.title}
                        className="aspect-[3/4] object-cover rounded bg-secondary"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-caption text-muted-foreground">No magazines listed yet</p>
                </div>
              )}
            </div>

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
                  View All Orders
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
        title={publisher.verified ? "Suspend Publisher" : "Reactivate Publisher"}
        message={publisher.verified
          ? `Are you sure you want to suspend ${publisher.company_name}? They will no longer be able to receive orders or access their account.`
          : `Are you sure you want to reactivate ${publisher.company_name}?`
        }
        confirmLabel={publisher.verified ? "Suspend" : "Reactivate"}
        confirmVariant={publisher.verified ? "destructive" : undefined}
      />
    </AdminLayout>
  );
};

export default AdminPublisherDetail;
