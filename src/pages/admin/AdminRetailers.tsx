import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { AdminLayout, StatCard } from "@/components/admin";
import { BackNavigation, DataTable, StatusBadge, ButtonSecondary, FormInput } from "@/components/neesh";

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
  [key: string]: unknown;
}

const mockRetailers: Retailer[] = [
  { id: "1", storeName: "Powell's Books", email: "magazines@powells.com", location: "Portland, OR", storeType: "Independent Bookstore", totalOrders: 45, totalSpent: 4520.00, joinDate: "Mar 2024", status: "received" },
  { id: "2", storeName: "McNally Jackson", email: "buyers@mcnallyjackson.com", location: "New York, NY", storeType: "Independent Bookstore", totalOrders: 38, totalSpent: 3850.00, joinDate: "Apr 2024", status: "received" },
  { id: "3", storeName: "City Lights Books", email: "books@citylights.com", location: "San Francisco, CA", storeType: "Independent Bookstore", totalOrders: 32, totalSpent: 2980.00, joinDate: "May 2024", status: "received" },
  { id: "4", storeName: "Skylight Books", email: "info@skylightbooks.com", location: "Los Angeles, CA", storeType: "Independent Bookstore", totalOrders: 28, totalSpent: 2450.00, joinDate: "Jun 2024", status: "received" },
  { id: "5", storeName: "The Strand", email: "buyers@strandbooks.com", location: "New York, NY", storeType: "Independent Bookstore", totalOrders: 52, totalSpent: 5200.00, joinDate: "Jul 2024", status: "received" },
  { id: "6", storeName: "Rare Device", email: "shop@raredevice.net", location: "San Francisco, CA", storeType: "Boutique", totalOrders: 18, totalSpent: 1680.00, joinDate: "Aug 2024", status: "received" },
  { id: "7", storeName: "Assembly Coffee", email: "orders@assemblycoffee.com", location: "Brooklyn, NY", storeType: "Coffee Shop", totalOrders: 22, totalSpent: 1890.00, joinDate: "Sep 2024", status: "received" },
  { id: "8", storeName: "Wolfman", email: "hi@wolfmannyc.com", location: "New York, NY", storeType: "Boutique", totalOrders: 15, totalSpent: 1340.00, joinDate: "Oct 2024", status: "received" },
  { id: "9", storeName: "Amoeba Music", email: "merch@amoeba.com", location: "Los Angeles, CA", storeType: "Record Store", totalOrders: 24, totalSpent: 2150.00, joinDate: "Nov 2024", status: "received" },
  { id: "10", storeName: "Dusty Groove", email: "orders@dustygroove.com", location: "Chicago, IL", storeType: "Record Store", totalOrders: 19, totalSpent: 1720.00, joinDate: "Dec 2024", status: "received" },
  { id: "11", storeName: "Chapters Books", email: "orders@chapters.com", location: "Seattle, WA", storeType: "Independent Bookstore", totalOrders: 8, totalSpent: 680.00, joinDate: "Jan 2025", status: "pending" },
  { id: "12", storeName: "Café Integral", email: "shop@cafeintegral.com", location: "New York, NY", storeType: "Coffee Shop", totalOrders: 0, totalSpent: 0, joinDate: "Jan 2025", status: "unfulfilled" },
];

export const AdminRetailers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRetailers = mockRetailers.filter((ret) =>
    ret.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ret.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRetailers = mockRetailers.length;
  const activeThisMonth = mockRetailers.filter(r => r.status === 'received').length;
  const totalOrders = mockRetailers.reduce((sum, r) => sum + r.totalOrders, 0);

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
          <DataTable
            columns={columns}
            data={filteredRetailers}
            onRowClick={(row) => navigate(`/admin/retailers/${row.id}`)}
          />
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRetailers;
