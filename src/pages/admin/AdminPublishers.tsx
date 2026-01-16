import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { BackNavigation, DataTable, StatusBadge, ButtonSecondary, FormInput } from "@/components/neesh";

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

const mockPublishers: Publisher[] = [
  { id: "1", name: "Kinfolk Magazine", email: "hello@kinfolk.com", magazinesListed: 8, totalSales: 4520.00, joinDate: "Mar 2024", status: "received" },
  { id: "2", name: "Cereal Magazine", email: "hello@readcereal.com", magazinesListed: 6, totalSales: 3280.00, joinDate: "Apr 2024", status: "received" },
  { id: "3", name: "The Gourmand", email: "info@thegourmand.co.uk", magazinesListed: 4, totalSales: 2150.00, joinDate: "May 2024", status: "received" },
  { id: "4", name: "Apartamento", email: "contact@apartamentomagazine.com", magazinesListed: 5, totalSales: 1890.00, joinDate: "Jun 2024", status: "received" },
  { id: "5", name: "Drift Magazine", email: "hello@driftmag.com", magazinesListed: 3, totalSales: 980.00, joinDate: "Jul 2024", status: "received" },
  { id: "6", name: "MacGuffin Magazine", email: "hello@macguffin.nl", magazinesListed: 4, totalSales: 1450.00, joinDate: "Aug 2024", status: "received" },
  { id: "7", name: "Monocle", email: "retail@monocle.com", magazinesListed: 7, totalSales: 5200.00, joinDate: "Sep 2024", status: "received" },
  { id: "8", name: "Offscreen Magazine", email: "kai@offscreenmag.com", magazinesListed: 2, totalSales: 680.00, joinDate: "Oct 2024", status: "pending" },
  { id: "9", name: "Perdiz Magazine", email: "info@perdiz.com", magazinesListed: 3, totalSales: 920.00, joinDate: "Nov 2024", status: "received" },
  { id: "10", name: "Works That Work", email: "hello@worksthatwork.com", magazinesListed: 1, totalSales: 340.00, joinDate: "Dec 2024", status: "received" },
  { id: "11", name: "Weapons of Reason", email: "info@weaponsofreason.com", magazinesListed: 2, totalSales: 560.00, joinDate: "Jan 2025", status: "received" },
  { id: "12", name: "Delayed Gratification", email: "hello@slow-journalism.com", magazinesListed: 2, totalSales: 780.00, joinDate: "Jan 2025", status: "unfulfilled" },
];

export const AdminPublishers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPublishers = mockPublishers.filter((pub) =>
    pub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pub.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPublishers = mockPublishers.length;
  const activeThisMonth = mockPublishers.filter(p => p.status === 'received').length;
  const totalMagazines = mockPublishers.reduce((sum, p) => sum + p.magazinesListed, 0);

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
          <DataTable
            columns={columns}
            data={filteredPublishers}
            onRowClick={(row) => navigate(`/admin/publishers/${row.id}`)}
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPublishers;
