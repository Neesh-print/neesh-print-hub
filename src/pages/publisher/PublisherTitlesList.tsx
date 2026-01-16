import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, MagazineCard, EmptyState, ButtonPrimary } from "@/components/neesh";
import { Plus, BookOpen } from "lucide-react";

// Mock data for publisher's titles
const mockTitles = [
  {
    id: "1",
    title: "Kinfolk",
    issue: "Issue 42",
    coverImage: "/placeholder.svg",
    wholesalePrice: 12.00,
    retailPrice: 18.00,
    stock: 156,
    status: "active" as const,
  },
  {
    id: "2",
    title: "Cereal",
    issue: "Volume 21",
    coverImage: "/placeholder.svg",
    wholesalePrice: 15.00,
    retailPrice: 22.00,
    stock: 89,
    status: "active" as const,
  },
  {
    id: "3",
    title: "Monocle",
    issue: "Issue 167",
    coverImage: "/placeholder.svg",
    wholesalePrice: 14.00,
    retailPrice: 20.00,
    stock: 23,
    status: "low-stock" as const,
  },
  {
    id: "4",
    title: "Apartamento",
    issue: "Issue 31",
    coverImage: "/placeholder.svg",
    wholesalePrice: 16.00,
    retailPrice: 24.00,
    stock: 0,
    status: "out-of-stock" as const,
  },
];

export const PublisherTitlesList = () => {
  const navigate = useNavigate();
  const [titles] = useState(mockTitles);

  const handleBack = () => {
    navigate("/publisher");
  };

  const handleAddTitle = () => {
    navigate("/publisher/titles/new");
  };

  const handleEditTitle = (titleId: string) => {
    navigate(`/publisher/titles/${titleId}/edit`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return null;
      case "low-stock":
        return (
          <span className="absolute top-2 right-2 bg-status-warning text-status-warning-text text-xs px-2 py-1 rounded-full font-medium">
            Low Stock
          </span>
        );
      case "out-of-stock":
        return (
          <span className="absolute top-2 right-2 bg-status-error text-status-error-text text-xs px-2 py-1 rounded-full font-medium">
            Out of Stock
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <PublisherLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <BackNavigation
          title="My Titles"
          onBack={handleBack}
          rightContent={
            <ButtonPrimary onClick={handleAddTitle}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Title
            </ButtonPrimary>
          }
        />

        {titles.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-12 h-12" />}
            title="No titles yet"
            description="Start by adding your first magazine title to the marketplace."
            action={
              <ButtonPrimary onClick={handleAddTitle}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Title
              </ButtonPrimary>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {titles.map((title) => (
              <div
                key={title.id}
                className="relative cursor-pointer group"
              >
                {/* Status badge */}
                {getStatusBadge(title.status)}
                
                {/* Edit overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                  <span className="text-white font-medium bg-black/60 px-4 py-2 rounded-lg">
                    Edit Title
                  </span>
                </div>
                
                <MagazineCard
                  title={title.title}
                  coverImage={title.coverImage}
                  price={title.wholesalePrice}
                  publisher={title.issue}
                  onClick={() => handleEditTitle(title.id)}
                />
                
                {/* Stock info */}
                <div className="mt-2 text-sm text-muted-foreground">
                  {title.stock} in stock • WSP ${title.wholesalePrice.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PublisherLayout>
  );
};

export default PublisherTitlesList;
