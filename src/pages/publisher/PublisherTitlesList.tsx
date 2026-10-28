import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, MagazineCard, EmptyState, ButtonPrimary, ButtonSecondary, StatusBadge } from "@/components/neesh";
import { Plus, BookOpen, Loader2, Upload, Archive, RotateCcw } from "lucide-react";
import { useMagazines } from "@/hooks/useMagazines";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useShippingV2 } from "@/hooks/useShippingV2";
import { useReferenceShipping } from "@/hooks/useReferenceShipping";
import { REFERENCE_ORDER_COPIES, landedMargin, suggestHealthyRetail, type LandedMargin } from "@/lib/shipping";
import { MARGIN_BADGE_STATUS, marginBandLabel, money, percent, signedMoney } from "@/lib/shippingCopy";

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

  // --- shipping_v2: what a New York space earns on 10 copies (T13, decision 6) ---
  const { enabled: shippingV2 } = useShippingV2();
  const priced = viewStatus === "active"
    ? titles.filter((t) => t.wholesale_price > 0 && t.suggested_retail_price > 0 && (t.weight_grams ?? 0) > 0)
    : [];
  const reference = useReferenceShipping({
    publisherId: publisher?.id,
    enabled: shippingV2 && priced.length > 0,
    lines: priced.map((t) => ({
      key: t.id,
      copies: REFERENCE_ORDER_COPIES,
      weight_grams: t.weight_grams!,
      wsp: t.wholesale_price,
      width_mm: t.width_mm,
      height_mm: t.height_mm,
    })),
  });
  const marginFor = (titleId: string): { m: LandedMargin; suggestion: number | null } | null => {
    const t = priced.find((x) => x.id === titleId);
    const ship = reference.byKey.get(titleId);
    if (!t || ship === null || ship === undefined) return null;
    const input = { wsp: t.wholesale_price, srp: t.suggested_retail_price, quantity: REFERENCE_ORDER_COPIES, shippingUsd: ship };
    return { m: landedMargin(input), suggestion: suggestHealthyRetail(input) };
  };
  const notHealthy = priced
    .map((t) => ({ t, r: marginFor(t.id) }))
    .filter((x): x is { t: typeof priced[number]; r: NonNullable<ReturnType<typeof marginFor>> } => !!x.r && x.r.m.band !== "healthy");
  const anyLoss = notHealthy.some((x) => x.r.m.band === "loss");
  const label = (t: typeof priced[number]) => t.issue_number || t.title;

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
      // Only an archived title (false) can be restored here. A title Neesh
      // suspended (null) stays hidden until an admin makes it live.
      const { data, error } = await supabase
        .from('magazines')
        .update({ is_active: true })
        .eq('id', titleId)
        .eq('is_active', false)
        .select('id');

      if (error) throw error;
      if (!data?.length) {
        toast.error(`${titleName} is suspended by Neesh. Message us to bring it back.`);
        return;
      }
      
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

        {shippingV2 && notHealthy.length > 0 && (
          <div className="mb-6 p-4 rounded-lg bg-accent/5 border border-accent/30 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground">
                {anyLoss ? "US spaces lose money on " : "Margins are thin for US spaces on "}
                {notHealthy.length === 1 ? notHealthy[0].t.title : `${notHealthy.length} of your titles`}.
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {"Retail of "}
                {notHealthy
                  .filter((x) => x.r.suggestion !== null)
                  .map((x) => `${money(x.r.suggestion!)} (${label(x.t)})`)
                  .join(" or ")}
                {` makes ${REFERENCE_ORDER_COPIES} copies Healthy.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleEditTitle(notHealthy[0].t.id)}
              className="font-semibold text-accent whitespace-nowrap hover:underline"
            >
              Edit prices
            </button>
          </div>
        )}

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

                {/* Space margin on a 10-copy New York order (shipping_v2) */}
                {shippingV2 && viewStatus === "active" && (() => {
                  if (!((title.weight_grams ?? 0) > 0)) {
                    return <div className="mt-2 text-caption text-status-pending-text">Add a weight to see shipping</div>;
                  }
                  const r = marginFor(title.id);
                  if (!r) return null;
                  return (
                    <div className="flex gap-1.5 items-center mt-2 flex-wrap">
                      <StatusBadge status={MARGIN_BADGE_STATUS[r.m.band]} label={marginBandLabel(r.m.band)} />
                      <span className="text-caption text-muted-foreground">
                        {signedMoney(r.m.margin)} ({percent(r.m.marginPct)}) · {REFERENCE_ORDER_COPIES} to NYC
                      </span>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </PublisherLayout>
  );
};

export default PublisherTitlesList;
