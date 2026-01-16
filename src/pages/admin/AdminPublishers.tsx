import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal, AlertCircle } from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { BackNavigation, DataTable, StatusBadge, ButtonSecondary, FormInput, EmptyState, ButtonPrimary } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { supabase } from "@/integrations/supabase/client";

interface Publisher {
  id: string;
  name: string;
  email: string;
  magazinesListed: number;
  totalSales: number;
  joinDate: string;
  status: 'received' | 'pending' | 'unfulfilled';
  [key: string]: unknown;
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
      const { data, error: fetchError } = await supabase
        .from('publishers')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to match the table format
      const transformed: Publisher[] = (data || []).map((pub: any) => ({
        id: pub.id,
        name: pub.company_name || 'Unknown Publisher',
        email: pub.description ? `contact@${pub.company_name?.toLowerCase().replace(/\s+/g, '')}.com` : 'N/A',
        magazinesListed: pub.total_magazines || 0,
        totalSales: Number(pub.total_sales) || 0,
        joinDate: new Date(pub.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        status: pub.verified ? 'received' : 'pending',
      }));

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
    { key: "email", header: "Contact Email" },
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
