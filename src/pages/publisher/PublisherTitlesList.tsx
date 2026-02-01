import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, MagazineCard, EmptyState, ButtonPrimary } from "@/components/neesh";
import { Plus, BookOpen, Loader2 } from "lucide-react";
import { useMagazines } from "@/hooks/useMagazines";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";

export const PublisherTitlesList = () => {
  const navigate = useNavigate();
  const { publisher, isLoading: publisherLoading } = usePublisherProfile();
  const { magazines: titles, isLoading: magazinesLoading } = useMagazines({ 
    publisherId: publisher?.id,
    enabled: !!publisher?.id
  });



  const isLoading = publisherLoading || (publisher && magazinesLoading);

  const handleBack = () => {
    navigate("/publisher");
  };

  const handleAddTitle = () => {
    navigate("/publisher/titles/new");
  };

  const handleEditTitle = (titleId: string) => {
    navigate(`/publisher/titles/${titleId}/edit`);
  };

  // Helper to determine status based on inventory
  const getStatus = (inventory: number) => {
    if (inventory === 0) return "out-of-stock";
    if (inventory < 25) return "low-stock";
    return "active";
  };

  const getStatusBadge = (inventory: number) => {
    const status = getStatus(inventory);
    
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

  if (isLoading) {
    return (
      <PublisherLayout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PublisherLayout>
    );
  }

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
            title="Your catalogue is empty"
            description="Add magazines to make them available to retailers"
            action={
              <ButtonPrimary onClick={handleAddTitle}>
                <Plus className="w-4 h-4 mr-2" />
                Add Title
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
                {getStatusBadge(title.inventory_count || 0)}
                
                {/* Edit overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                  <span className="text-white font-medium bg-black/60 px-4 py-2 rounded-lg">
                    Edit Title
                  </span>
                </div>
                
                <MagazineCard
                  title={title.title}
                  coverImage={title.cover_image_url}
                  price={title.wholesale_price}
                  publisher={title.issue_number || ""}
                  inventoryCount={title.inventory_count}
                  onClick={() => handleEditTitle(title.id)}
                />
                
                {/* Stock info */}
                <div className="mt-2 text-sm text-muted-foreground">
                  {title.inventory_count || 0} in stock • WSP ${title.wholesale_price.toFixed(2)}
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
