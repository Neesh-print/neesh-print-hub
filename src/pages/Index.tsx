import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Package, 
  BookOpen, 
  Plus,
  ArrowUpRight,
  TrendingUp,
  LogIn,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  HeaderBar,
  BackNavigation,
  TabNavigation,
  StatusBadge,
  WalletDisplay,
  ProgressBar,
  EmptyState,
  DataTable,
  InfoCard,
  MagazineCard,
  FormInput,
  FormTextarea,
  FormSelect,
  FileUploadZone,
  ButtonPrimary,
  ButtonSecondary,
  Modal,
} from "@/components/neesh";

const Index = () => {
  const navigate = useNavigate();
  const { user, userRole, signOut, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("orders");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");

  const tabs = [
    { id: "orders", label: "Orders" },
    { id: "returns", label: "Returns" },
    { id: "inventory", label: "Inventory" },
  ];

  const tableColumns = [
    { key: "orderId", header: "Order ID", sortable: true },
    { key: "retailer", header: "Retailer", sortable: true },
    { key: "date", header: "Date", sortable: true },
    { key: "total", header: "Total", align: "right" as const, sortable: true },
    { 
      key: "status", 
      header: "Status", 
      align: "right" as const,
      render: (value: string) => <StatusBadge status={value as 'received' | 'pending' | 'unfulfilled' | 'new-order'} />
    },
  ];

  const tableData = [
    { id: "1", orderId: "#0001", retailer: "Printed Matter", date: "Jan 15, 2025", total: "$234.00", status: "received" },
    { id: "2", orderId: "#0002", retailer: "Dashwood Books", date: "Jan 14, 2025", total: "$156.00", status: "pending" },
    { id: "3", orderId: "#0003", retailer: "McNally Jackson", date: "Jan 13, 2025", total: "$412.00", status: "unfulfilled" },
    { id: "4", orderId: "#0004", retailer: "Skylight Books", date: "Jan 12, 2025", total: "$89.00", status: "new-order" },
  ];

  const sampleMagazines = [
    { id: "1", coverImage: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop", title: "Kinfolk", publisher: "Kinfolk Magazine", region: "Copenhagen", price: 24.00 },
    { id: "2", coverImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop", title: "Cereal", publisher: "Cereal Magazine", region: "UK", price: 28.00 },
    { id: "3", coverImage: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop", title: "The Gourmand", publisher: "The Gourmand", region: "London", price: 22.00 },
    { id: "4", coverImage: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop", title: "Apartamento", publisher: "Apartamento", region: "Barcelona", price: 26.00 },
  ];

  const categoryOptions = [
    { value: "art", label: "Art & Photography" },
    { value: "design", label: "Design & Architecture" },
    { value: "culture", label: "Culture & Society" },
    { value: "lifestyle", label: "Lifestyle" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <HeaderBar
        userRole={userRole || "retailer"}
        onMenuClick={() => console.log("Menu clicked")}
        onLogoClick={() => navigate("/")}
      />

      {/* Main content with header offset */}
      <main className="pt-16">
        {/* Auth Status Banner */}
        <div className="px-4 md:px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            {user ? (
              <>
                <div className="text-body">
                  <span className="text-muted-foreground">Signed in as </span>
                  <span className="font-medium text-foreground">{user.email}</span>
                  {userRole && (
                    <span className="ml-2 text-xs bg-secondary px-2 py-1 rounded-full uppercase text-muted-foreground">
                      {userRole}
                    </span>
                  )}
                </div>
                <ButtonSecondary
                  icon={<LogOut className="w-4 h-4" />}
                  onClick={() => signOut()}
                >
                  Sign Out
                </ButtonSecondary>
              </>
            ) : (
              <>
                <div className="text-body text-muted-foreground">
                  Welcome to Neesh — Sign in to access your dashboard
                </div>
                <ButtonPrimary
                  icon={<LogIn className="w-4 h-4" />}
                  onClick={() => navigate("/login")}
                >
                  Sign In
                </ButtonPrimary>
              </>
            )}
          </div>
        </div>

        {/* Back Navigation with Wallet */}
        <BackNavigation
          title="Dashboard"
          onBack={() => console.log("Back clicked")}
          rightContent={
            <WalletDisplay
              label="Account Balance"
              amount={4523.87}
              actionLabel="Transfer"
              onAction={() => console.log("Transfer clicked")}
            />
          }
        />

        <div className="px-4 md:px-6 pb-8 space-y-8">
          {/* Hero Metrics */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard className="bg-secondary">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-caption text-muted-foreground mb-1">Total Sales</p>
                  <p className="font-display font-bold text-display-lg text-foreground">$12,847</p>
                  <div className="flex items-center gap-1 mt-2 text-chart-green">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-caption font-medium">+12.5% from last month</span>
                  </div>
                </div>
                <div className="p-3 bg-background rounded-lg">
                  <ArrowUpRight className="w-5 h-5 text-accent" />
                </div>
              </div>
            </InfoCard>

            <InfoCard className="bg-secondary">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-caption text-muted-foreground mb-1">Active Titles</p>
                  <p className="font-display font-bold text-display-lg text-foreground">24</p>
                  <p className="text-caption text-muted-foreground mt-2">Across 6 retailers</p>
                </div>
                <div className="p-3 bg-background rounded-lg">
                  <BookOpen className="w-5 h-5 text-accent" />
                </div>
              </div>
            </InfoCard>
          </section>

          {/* Status Badges Demo */}
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-heading">Status Badges</h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="pending" />
              <StatusBadge status="received" />
              <StatusBadge status="unfulfilled" />
              <StatusBadge status="returned" />
              <StatusBadge status="new-order" />
              <StatusBadge status="payment-sent" />
              <StatusBadge status="payment-pending" />
              <StatusBadge status="payment-received" />
            </div>
          </section>

          {/* Progress Bar Demo */}
          <section className="space-y-3">
            <h2 className="font-display font-semibold text-heading">Inventory Progress</h2>
            <InfoCard>
              <div className="flex items-center justify-between mb-3">
                <span className="text-body text-foreground">Kinfolk Issue 42</span>
                <span className="text-caption text-muted-foreground">85/100 units</span>
              </div>
              <ProgressBar current={85} total={100} color="purple" />
            </InfoCard>
            <InfoCard>
              <div className="flex items-center justify-between mb-3">
                <span className="text-body text-foreground">Cereal Vol. 21</span>
                <span className="text-caption text-muted-foreground">23/50 units</span>
              </div>
              <ProgressBar current={23} total={50} color="green" showLabel />
            </InfoCard>
          </section>

          {/* Tab Navigation */}
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Data Table */}
          <section>
            <div className="card-neesh p-0 overflow-hidden">
              <DataTable
                columns={tableColumns}
                data={tableData}
                selectable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={(col, dir) => {
                  setSortColumn(col);
                  setSortDirection(dir);
                }}
                onRowClick={(row) => console.log("Row clicked:", row)}
              />
            </div>
          </section>

          {/* Magazine Cards */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-heading">Featured Titles</h2>
              <ButtonSecondary icon={<Plus className="w-4 h-4" />}>
                Add Title
              </ButtonSecondary>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {sampleMagazines.map((mag) => (
                <MagazineCard
                  key={mag.id}
                  coverImage={mag.coverImage}
                  title={mag.title}
                  publisher={mag.publisher}
                  region={mag.region}
                  price={mag.price}
                  onClick={() => console.log("Magazine clicked:", mag.title)}
                  onBookmark={() => console.log("Bookmark:", mag.title)}
                  isBookmarked={mag.id === "2"}
                />
              ))}
            </div>
          </section>

          {/* Form Components Demo */}
          <section className="space-y-4">
            <h2 className="font-display font-semibold text-heading">Add New Title</h2>
            <InfoCard>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Title Name"
                  placeholder="Enter magazine title"
                  value={formName}
                  onChange={setFormName}
                  required
                />
                <FormSelect
                  label="Category"
                  placeholder="Select a category"
                  options={categoryOptions}
                  value={formCategory}
                  onChange={setFormCategory}
                  required
                />
                <div className="md:col-span-2">
                  <FormTextarea
                    label="Description"
                    placeholder="Describe your publication..."
                    value={formDescription}
                    onChange={setFormDescription}
                    maxLength={500}
                    helperText="Brief description for retailers"
                  />
                </div>
                <div className="md:col-span-2">
                  <FileUploadZone
                    title="Upload Cover Image"
                    subtitle="High-resolution cover (300 DPI, JPG or PNG)"
                    accept="image/*"
                    onFilesSelected={(files) => console.log("Files:", files)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <ButtonSecondary onClick={() => setIsModalOpen(true)}>
                  Preview
                </ButtonSecondary>
                <ButtonPrimary variant="purple" icon={<Plus className="w-4 h-4" />}>
                  Add Title
                </ButtonPrimary>
              </div>
            </InfoCard>
          </section>

          {/* Empty State Demo */}
          <section>
            <InfoCard>
              <EmptyState
                icon={<Package className="w-12 h-12" />}
                title="No returns yet"
                description="When retailers return issues, they'll appear here for processing."
                action={
                  <ButtonPrimary variant="purple">
                    View Return Policy
                  </ButtonPrimary>
                }
              />
            </InfoCard>
          </section>

          {/* Buttons Demo */}
          <section className="space-y-4">
            <h2 className="font-display font-semibold text-heading">Buttons</h2>
            <div className="flex flex-wrap gap-3">
              <ButtonPrimary>Primary Black</ButtonPrimary>
              <ButtonPrimary variant="purple">Primary Purple</ButtonPrimary>
              <ButtonPrimary loading>Loading</ButtonPrimary>
              <ButtonPrimary disabled>Disabled</ButtonPrimary>
              <ButtonSecondary>Secondary</ButtonSecondary>
              <ButtonSecondary destructive>Destructive</ButtonSecondary>
            </div>
          </section>
        </div>
      </main>

      {/* Modal Demo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Preview Title"
        footer={
          <>
            <ButtonSecondary onClick={() => setIsModalOpen(false)}>
              Cancel
            </ButtonSecondary>
            <ButtonPrimary variant="purple" onClick={() => setIsModalOpen(false)}>
              Confirm
            </ButtonPrimary>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body text-muted-foreground">
            This is a preview of how your new title will appear to retailers in the Neesh catalogue.
          </p>
          <InfoCard className="bg-secondary">
            <p className="font-display font-semibold text-body">
              {formName || "Untitled Magazine"}
            </p>
            <p className="text-caption text-muted-foreground mt-1">
              {formDescription || "No description provided"}
            </p>
          </InfoCard>
        </div>
      </Modal>
    </div>
  );
};

export default Index;
