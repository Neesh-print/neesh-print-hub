import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, AlertCircle } from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { BackNavigation, DataTable, StatusBadge, ButtonSecondary, FormInput, EmptyState, ButtonPrimary } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { supabase } from "@/integrations/supabase/client";

import { Tables } from "@/integrations/supabase/types";
import { isSale } from "@/lib/orderStatus";

interface Publisher {
  id: string;
  name: string;
  email: string;
  magazinesListed: number;
  totalSales: number;
  joinDate: string;
  status: 'received' | 'pending' | 'unfulfilled';
}

export const AdminPublishers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPublishers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [publishersRes, magazinesRes, ordersRes, applicationsRes] = await Promise.all([
        supabase.from('publishers').select('*').order('created_at', { ascending: false }),
        supabase.from('magazines').select('id, publisher_id'),
        supabase.from('orders').select('magazine_id, total_price, status'),
        supabase.from('publisher_applications').select('user_id, business_name, email'),
      ]);

      if (publishersRes.error) throw publishersRes.error;
      if (magazinesRes.error) throw magazinesRes.error;
      if (ordersRes.error) throw ordersRes.error;

      // Test accounts are hidden from lists and counts (is_test, see the
      // 20261027170000 migration); nothing is deleted.
      const data = (publishersRes.data || []).filter((pub) => !(pub as { is_test?: boolean }).is_test);

      const userIds = data.map((pub) => pub.user_id).filter(Boolean) as string[];
      const { data: users } = userIds.length
        ? await supabase.from('users').select('id, email').in('id', userIds)
        : { data: [] as { id: string; email: string }[] };
      const emailByUser = new Map((users || []).map((u) => [u.id, u.email]));
      const applicationByUser = new Map(
        (applicationsRes.data || []).filter((a) => a.user_id).map((a) => [a.user_id as string, a]),
      );

      // Magazines and sales are computed from the source tables; the
      // publishers.total_sales / total_magazines columns aren't maintained.
      const publisherByMagazine = new Map((magazinesRes.data || []).map((m) => [m.id, m.publisher_id]));
      const magazineCount = new Map<string, number>();
      (magazinesRes.data || []).forEach((m) => {
        if (m.publisher_id) magazineCount.set(m.publisher_id, (magazineCount.get(m.publisher_id) || 0) + 1);
      });
      const salesByPublisher = new Map<string, number>();
      (ordersRes.data || []).forEach((o) => {
        const publisherId = o.magazine_id ? publisherByMagazine.get(o.magazine_id) : undefined;
        if (!publisherId || !isSale(o.status)) return;
        salesByPublisher.set(publisherId, (salesByPublisher.get(publisherId) || 0) + (Number(o.total_price) || 0));
      });

      // Transform data to match the table format
      const transformed: Publisher[] = data.map((pub: Tables<"publishers">) => {
        const application = pub.user_id ? applicationByUser.get(pub.user_id) : undefined;
        return {
        id: pub.id,
        // Fall back to the application's business name when the profile has none
        name: pub.company_name || application?.business_name || 'Unknown Publisher',
        email: (pub.user_id && emailByUser.get(pub.user_id)) || application?.email || '',
        magazinesListed: magazineCount.get(pub.id) || 0,
        totalSales: Math.round((salesByPublisher.get(pub.id) || 0) * 100) / 100,
        joinDate: pub.created_at ? new Date(pub.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown',
        status: pub.verified ? 'received' : 'pending',
        };
      });

      setPublishers(transformed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch publishers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPublishers();
  }, []);

  const filteredPublishers = publishers.filter((pub) =>
    pub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pub.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPublishers = publishers.length;
  const activeThisMonth = publishers.filter(p => p.status === 'received').length;
  const totalMagazines = publishers.reduce((sum, p) => sum + p.magazinesListed, 0);

  const columns = [
    { key: "name", header: "Publisher Name", sortable: true },
    {
      key: "email",
      header: "Contact Email",
      render: (value: unknown) => (value as string) || <span className="text-muted-foreground">No email on file</span>,
    },
    { key: "magazinesListed", header: "Magazines", align: "center" as const },
    { 
      key: "totalSales", 
      header: "Total Sales", 
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
      render: (_: unknown, row: Publisher) => (
        <ButtonSecondary 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/publishers/${row.id}`);
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
        <LoadingScreen message="Loading publishers..." />
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
            action={<ButtonPrimary onClick={fetchPublishers}>Try Again</ButtonPrimary>}
          />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <BackNavigation title="Publishers" onBack={() => navigate("/admin")} />

      {/* Stats Row */}
      <div className="px-4 md:px-6 pb-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Publishers" value={totalPublishers} />
          <StatCard label="Active This Month" value={activeThisMonth} />
          <StatCard label="Total Magazines" value={totalMagazines} />
        </div>
      </div>

      {/* View Controls */}
      <div className="px-4 md:px-6 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <FormInput
              placeholder="Search publishers..."
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
          {filteredPublishers.length === 0 ? (
            <EmptyState
              icon={<AlertCircle className="w-12 h-12" />}
              title="No publishers found"
              description="There are no publishers matching your search."
            />
          ) : (
            <DataTable
              columns={columns}
              data={filteredPublishers}
              onRowClick={(row) => navigate(`/admin/publishers/${row.id}`)}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPublishers;
