import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, List, Search, SlidersHorizontal, Bookmark, BookOpen, AlertCircle } from "lucide-react";
import { RetailerLayout, useWishlistContext } from "@/components/retailer";
import { MagazineCard, EmptyState, ButtonPrimary } from "@/components/neesh";
import { LoadingScreen, OnboardingChecklist } from "@/components/shared";
import { useMagazines } from "@/hooks/useMagazines";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useRetailerProfile } from "@/hooks/useRetailerProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/useDebounce";
import {
  DesktopFilterBar,
  MobileFilterSheet,
  ActiveFilterTags,
  type CatalogueFilters,
  type SortOption,
} from "@/components/retailer/CatalogueFilters";
import { toast } from "sonner";

const DEFAULT_FILTERS: CatalogueFilters = {
  priceRange: [0, 100],
  categories: [],
  publishers: [],
  inStock: false,
};

export const RetailerCatalogue = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<CatalogueFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  
  // Debounce search query to prevent frequent reloads
  const debouncedQuery = useDebounce(searchQuery, 500);
  
  const { isInWishlist, toggleWishlist, wishlistCount } = useWishlistContext();

  const { magazines, isLoading, error, refetch } = useMagazines({ 
    status: 'active',
    searchQuery: debouncedQuery || undefined,
  });

  const { retailer } = useRetailerProfile();

  // Onboarding progress for retailers
  const onboarding = useOnboardingProgress('retailer', {
    hasProfile: !!retailer?.shop_name,
    hasProfileWebsite: !!retailer?.shop_url,
    hasProfileInstagram: !!retailer?.instagram_handle,
    hasShippingAddress: !!retailer?.address,
    orderCount: retailer?.total_orders || 0,
    wishlistCount: wishlistCount,
    storeName: retailer?.shop_name || undefined,
  });

  // Extract unique categories and publishers from magazines
  const { availableCategories, availablePublishers, maxPrice } = useMemo(() => {
    const categories = new Set<string>();
    const publisherMap = new Map<string, string>();
    let max = 100;

    magazines.forEach((mag) => {
      if (mag.category) categories.add(mag.category);
      if (mag.publisher?.id && mag.publisher?.company_name) {
        publisherMap.set(mag.publisher.id, mag.publisher.company_name);
      }
      if (mag.wholesale_price > max) max = Math.ceil(mag.wholesale_price);
    });

    return {
      availableCategories: Array.from(categories).sort(),
      availablePublishers: Array.from(publisherMap.entries()).map(([id, name]) => ({ id, name })),
      maxPrice: max,
    };
  }, [magazines]);

  // Update default price range when maxPrice changes
  useMemo(() => {
    if (filters.priceRange[1] === 100 && maxPrice > 100) {
      setFilters((f) => ({ ...f, priceRange: [f.priceRange[0], maxPrice] }));
    }
  }, [maxPrice, filters.priceRange]);

  // Filter and sort magazines
  const filteredMagazines = useMemo(() => {
    let result = [...magazines];

    // Price filter
    result = result.filter(
      (mag) =>
        mag.wholesale_price >= filters.priceRange[0] &&
        mag.wholesale_price <= filters.priceRange[1]
    );

    // Category filter
    if (filters.categories.length > 0) {
      result = result.filter(
        (mag) => mag.category && filters.categories.includes(mag.category)
      );
    }

    // Publisher filter
    if (filters.publishers.length > 0) {
      result = result.filter(
        (mag) => mag.publisher?.id && filters.publishers.includes(mag.publisher.id)
      );
    }

    // In stock filter
    if (filters.inStock) {
      result = result.filter((mag) => mag.inventory_count > 0);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "price-asc":
        result.sort((a, b) => a.wholesale_price - b.wholesale_price);
        break;
      case "price-desc":
        result.sort((a, b) => b.wholesale_price - a.wholesale_price);
        break;
      case "title-asc":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "title-desc":
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return result;
  }, [magazines, filters, sortBy]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) count++;
    count += filters.categories.length;
    count += filters.publishers.length;
    if (filters.inStock) count++;
    return count;
  }, [filters, maxPrice]);

  const handleToggleBookmark = (id: string) => {
    const wasInWishlist = isInWishlist(id);
    toggleWishlist(id);
    toast.success(wasInWishlist ? "Removed from wishlist" : "Saved to wishlist");
  };

  // Get featured magazines (first 6 for the carousel)
  const featuredMagazines = magazines.slice(0, 6);

  if (isLoading) {
    return (
      <RetailerLayout>
        <LoadingScreen message="Loading catalogue..." />
      </RetailerLayout>
    );
  }

  if (error) {
    return (
      <RetailerLayout>
        <div className="p-6">
          <EmptyState
            icon={<AlertCircle className="w-12 h-12" />}
            title="Something went wrong"
            description={error}
            action={<ButtonPrimary onClick={refetch}>Try Again</ButtonPrimary>}
          />
        </div>
      </RetailerLayout>
    );
  }

  if (magazines.length === 0) {
    return (
      <RetailerLayout>
        <div className="px-4 md:px-6 pt-4 pb-2">
          <h1 className="text-display-sm md:text-display-md font-display font-bold">Browse Titles</h1>
          <p className="text-body text-muted-foreground mt-1">Wholesale pricing on independent magazines</p>
        </div>
        <div className="p-6">
          <EmptyState
            icon={<BookOpen className="w-12 h-12" />}
            title="New titles coming soon"
            description="Check back shortly for our curated magazine selection"
          />
        </div>
      </RetailerLayout>
    );
  }

  return (
    <RetailerLayout>
      {/* Header Section */}
      <div className="px-4 md:px-6 pt-4 pb-2">
        <h1 className="text-display-sm md:text-display-md font-display font-bold">Browse Titles</h1>
        <p className="text-body text-muted-foreground mt-1">Wholesale pricing on independent magazines</p>
      </div>

      {/* Onboarding Checklist for new retailers */}
      {!onboarding.dismissed && !onboarding.allComplete && (
        <div className="px-4 md:px-6">
          <OnboardingChecklist
            items={onboarding.items}
            welcomeTitle="Welcome to Neesh!"
            welcomeSubtitle="You now have access to our curated catalog. Here's how to get started."
            onDismiss={onboarding.markDismissed}
            onItemClick={onboarding.markItemViewed}
          />
        </div>
      )}

      {/* Hero Carousel Section */}
      {featuredMagazines.length > 0 && (
        <section className="px-4 md:px-6 py-8 overflow-hidden">
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
            {featuredMagazines.map((mag, index) => (
              <div
                key={mag.id}
                className={`
                  relative flex-shrink-0 w-48 md:w-56 snap-center
                  ${index % 2 === 0 ? 'rotate-[-2deg]' : 'rotate-[2deg]'}
                  ${index > 0 ? '-ml-8' : ''}
                `}
                style={{ zIndex: featuredMagazines.length - index }}
              >
                <div 
                  className="relative aspect-[3/4] rounded-lg overflow-hidden bg-secondary shadow-neesh-md cursor-pointer group"
                  onClick={() => navigate(`/retailer/catalogue/${mag.id}`)}
                >
                  <img
                    src={mag.cover_image_url || "/placeholder.svg"}
                    alt={mag.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBookmark(mag.id);
                    }}
                    className={`
                      absolute top-2 right-2 p-2 rounded-full backdrop-blur-sm transition-all
                      ${isInWishlist(mag.id)
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-background/80 text-foreground hover:bg-background'
                      }
                    `}
                  >
                    <Bookmark className={`w-4 h-4 ${isInWishlist(mag.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full Catalogue Section */}
      <section className="px-4 md:px-6 pb-12">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-xl text-foreground">
            Full Catalogue
            <span className="text-muted-foreground font-normal text-base ml-2">
              ({filteredMagazines.length})
            </span>
          </h2>
          
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-secondary" : "hover:bg-secondary/50"}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-secondary" : "hover:bg-secondary/50"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm w-48"
              />
            </div>

            {/* Mobile Filter Button */}
            {isMobile && (
              <MobileFilterSheet
                filters={filters}
                onFiltersChange={setFilters}
                sortBy={sortBy}
                onSortChange={setSortBy}
                availableCategories={availableCategories}
                availablePublishers={availablePublishers}
                maxPrice={maxPrice}
                activeFilterCount={activeFilterCount}
                trigger={
                  <button className="p-2 border border-border rounded-lg hover:bg-secondary transition-colors relative">
                    <SlidersHorizontal className="w-4 h-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                }
              />
            )}
          </div>
        </div>

        {/* Mobile Search */}
        {isMobile && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search magazines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm"
            />
          </div>
        )}

        {/* Desktop Filters */}
        {!isMobile && (
          <div className="mb-6">
            <DesktopFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              sortBy={sortBy}
              onSortChange={setSortBy}
              availableCategories={availableCategories}
              availablePublishers={availablePublishers}
              maxPrice={maxPrice}
              activeFilterCount={activeFilterCount}
            />
          </div>
        )}

        {/* Active Filter Tags */}
        {activeFilterCount > 0 && (
          <div className="mb-4">
            <ActiveFilterTags
              filters={filters}
              onFiltersChange={setFilters}
              maxPrice={maxPrice}
              publishers={availablePublishers}
            />
          </div>
        )}

        {/* No Results */}
        {filteredMagazines.length === 0 && (
          <EmptyState
            icon={<Search className="w-12 h-12" />}
            title="No matching magazines"
            description="Try adjusting your filters or search query"
            action={
              <ButtonPrimary
                onClick={() => {
                  setFilters({ ...DEFAULT_FILTERS, priceRange: [0, maxPrice] });
                  setSearchQuery("");
                }}
              >
                Clear Filters
              </ButtonPrimary>
            }
          />
        )}

        {/* Magazine Grid */}
        {filteredMagazines.length > 0 && (
          <div className={`
            grid gap-6
            ${viewMode === "grid" 
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
              : "grid-cols-1"
            }
          `}>
            {filteredMagazines.map((mag) => (
              <MagazineCard
                key={mag.id}
                coverImage={mag.cover_image_url || "/placeholder.svg"}
                title={mag.title}
                publisher={mag.publisher?.company_name || "Unknown Publisher"}
                region={mag.category || undefined}
                price={mag.wholesale_price}
                retailPrice={mag.suggested_retail_price}
                inventoryCount={mag.inventory_count}
                showStockIndicator={true}
                onClick={() => navigate(`/retailer/catalogue/${mag.id}`)}
                onBookmark={() => handleToggleBookmark(mag.id)}
                isBookmarked={isInWishlist(mag.id)}
              />
            ))}
          </div>
        )}
      </section>
    </RetailerLayout>
  );
};
