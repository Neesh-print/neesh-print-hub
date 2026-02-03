import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, AlertCircle } from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { BackNavigation, DataTable, StatusBadge, ButtonSecondary, FormInput, EmptyState, ButtonPrimary } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { supabase } from "@/integrations/supabase/client";

import { Tables } from "@/integrations/supabase/types";

interface Retailer {
  id: string;
  storeName: string;
  email: string;
  location: string;
  storeType: string;
  totalOrders: number;
  totalSpent: number;
  joinDate: string;
  status: 'received' | 'pending' | 'unfulfilled';
}

export const AdminRetailers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRetailers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('retailers')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to match the table format
      const transformed: Retailer[] = (data || []).map((ret: Tables<"retailers">) => ({
        id: ret.id,
        storeName: ret.shop_name || 'Unknown Store',
        email: ret.contact_email || (ret.shop_name ? `contact@${ret.shop_name.toLowerCase().replace(/\s+/g, '')}.com` : 'N/A'),
        location: [ret.city, ret.state].filter(Boolean).join(', ') || 'N/A',
        storeType: (ret.store_types && ret.store_types.length > 0) ? ret.store_types[0] : 'Independent Store',
        totalOrders: ret.total_orders || 0,
        totalSpent: Number(ret.total_spent) || 0,
        joinDate: ret.created_at ? new Date(ret.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown',
        status: ret.verified ? 'received' : 'pending',
      }));

      setRetailers(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch retailers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRetailers();
  }, []);

  const filteredRetailers = retailers.filter((ret) =>
    ret.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRetailers = retailers.length;
  const activeThisMonth = retailers.filter(r => r.status === 'received').length;
  const totalOrders = retailers.reduce((sum, r) => sum + r.totalOrders, 0);

  const columns = [
    { key: "storeName", header: "Store Name", sortable: true },
    { key: "email", header: "Contact Email" },
    { key: "location", header: "Location" },
    { 
      key: "storeType", 
      header: "Store Type",
      render: (value: unknown) => (
        <span className="px-2 py-0.5 bg-secondary rounded text-caption">
          {value as string}
        </span>
      )
    },
    { key: "totalOrders", header: "Orders", align: "center" as const },
    { 
      key: "totalSpent", 
      header: "Total Spent", 
      align: "right" as const,
      render: (value: unknown) => `$${(value as number).toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
    },
    { key: "joinDate", header: "Join Date", sortable: true },
    { 
      key: "status", 
      header: "Status",
      render: (value: unknown) => {
        const statusLabels: Record<string, string> = {
          received: 'Active',
          pending: 'Inactive',
          unfulfilled: 'Suspended',
        };
        return <StatusBadge status={value as 'received' | 'pending' | 'unfulfilled'} label={statusLabels[value as string]} />;
      }
    },
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (_: unknown, row: Retailer) => (
        <ButtonSecondary 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/retailers/${row.id}`);
          }}
          className="text-caption py-1 px-3"
        >
          View
        </ButtonSecondary>
      ),
    },
  ];

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingScreen message="Loading retailers..." />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="p-6">
          <EmptyState
            icon={<AlertCircle className="w-12 h-12" />}
            title="Something went wrong"
            description={error}
            action={<ButtonPrimary onClick={fetchRetailers}>Try Again</ButtonPrimary>}
          />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <BackNavigation title="Retailers" onBack={() => navigate("/admin")} />

      {/* Stats Row */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Retailers" value={totalRetailers} />
          <StatCard label="Active This Month" value={activeThisMonth} />
          <StatCard label="Total Orders" value={totalOrders} />
        </div>
      </div>

      {/* View Controls */}
      <div className="px-4 md:px-6 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <FormInput
              placeholder="Search retailers..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="pl-10"
            />
          </div>
          <ButtonSecondary className="gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </ButtonSecondary>
        </div>
      </div>

      {/* Data Table */}
      <div className="px-4 md:px-6 pb-8">
        <div className="card-neesh">
          {filteredRetailers.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="w-12 h-12" />}
              title="No retailers found"
              description="There are no retailers matching your search."
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredRetailers}
              onRowClick={(row) => navigate(`/admin/retailers/${row.id}`)}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRetailers;
