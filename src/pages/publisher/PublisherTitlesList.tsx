import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, MagazineCard, EmptyState, ButtonPrimary, ButtonSecondary } from "@/components/neesh";
import { Plus, BookOpen, Loader2, Upload, Archive, RotateCcw } from "lucide-react";
import { useMagazines } from "@/hooks/useMagazines";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const PublisherTitlesList = () => {
  const navigate = useNavigate();
  const { publisher, isLoading: publisherLoading } = usePublisherProfile();
  const [viewStatus, setViewStatus] = useState<'active' | 'archived'>('active');

  const { magazines: titles, isLoading: magazinesLoading, refetch } = useMagazines({ 
    publisherId: publisher?.id,
    status: viewStatus,
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

  const handleArchiveTitle = async (titleId: string, titleName: string) => {
    try {
      const { error } = await supabase
        .from('magazines')
        .update({ is_active: false })
        .eq('id', titleId);

      if (error) throw error;
      
      toast.success(`${titleName} has been archived`);
      refetch();
    } catch (err) {
      console.error('Error archiving title:', err);
      toast.error('Failed to archive title');
    }
  };

  const handleRestoreTitle = async (titleId: string, titleName: string) => {
    try {
      const { error } = await supabase
        .from('magazines')
        .update({ is_active: true })
        .eq('id', titleId);

      if (error) throw error;
      
      toast.success(`${titleName} has been restored`);
      refetch();
    } catch (err) {
      console.error('Error restoring title:', err);
      toast.error('Failed to restore title');
    }
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
            <div className="flex items-center gap-2">
              <ButtonSecondary onClick={() => navigate('/publisher/titles/import')}>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </ButtonSecondary>
              <ButtonPrimary onClick={handleAddTitle}>
                <Plus className="w-4 h-4 mr-2" />
                Add New Title
              </ButtonPrimary>
            </div>
          }
        />

        <div className="mb-6">
          <Tabs value={viewStatus} onValueChange={(v) => setViewStatus(v as 'active' | 'archived')}>
            <TabsList>
              <TabsTrigger value="active">Active Titles</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {titles.length === 0 ? (
          <EmptyState
            icon={viewStatus === 'active' ? <BookOpen className="w-12 h-12" /> : <Archive className="w-12 h-12" />}
            title={viewStatus === 'active' ? "Your catalogue is empty" : "No archived titles"}
            description={viewStatus === 'active' 
              ? "Add magazines to make them available to retailers" 
              : "Archived magazines will appear here"}
            action={viewStatus === 'active' ? (
              <ButtonPrimary onClick={handleAddTitle}>
                <Plus className="w-4 h-4 mr-2" />
                Add Title
              </ButtonPrimary>
            ) : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {titles.map((title) => (
              <div
                key={title.id}
                className="relative cursor-pointer group"
              >
                {/* Status badge - Only show for active items */}
                {viewStatus === 'active' && getStatusBadge(title.inventory_count || 0)}
                
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
                  showActionOnData={true}
                  actionIcon={viewStatus === 'active' ? Archive : RotateCcw}
                  onAction={(e) => {
                    e.stopPropagation();
                    if (viewStatus === 'active') {
                      handleArchiveTitle(title.id, title.title);
                    } else {
                      handleRestoreTitle(title.id, title.title);
                    }
                  }}
                  actionLabel={viewStatus === 'active' ? "Archive" : "Restore"}
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
