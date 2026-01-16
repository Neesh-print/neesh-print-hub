import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, List, Search, ArrowUpDown, SlidersHorizontal, Bookmark, BookOpen, AlertCircle } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, MagazineCard, EmptyState, ButtonPrimary } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { useMagazines } from "@/hooks/useMagazines";

export const RetailerCatalogue = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  const { magazines, isLoading, error, refetch } = useMagazines({ 
    status: 'active',
    searchQuery: searchQuery || undefined,
  });

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
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
        <BackNavigation
          title="Catalogue"
          onBack={() => navigate("/")}
        />
        <div className="p-6">
          <EmptyState
            icon={<BookOpen className="w-12 h-12" />}
            title="No magazines yet"
            description="Check back soon for new titles"
          />
        </div>
      </RetailerLayout>
    );
  }

  return (
    <RetailerLayout>
      <BackNavigation
        title="Neesh Favs"
        onBack={() => navigate("/")}
      />

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
                      toggleBookmark(mag.id);
                    }}
                    className={`
                      absolute top-2 right-2 p-2 rounded-full backdrop-blur-sm transition-all
                      ${bookmarkedIds.includes(mag.id)
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-background/80 text-foreground hover:bg-background'
                      }
                    `}
                  >
                    <Bookmark className={`w-4 h-4 ${bookmarkedIds.includes(mag.id) ? 'fill-current' : ''}`} />
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-xl text-foreground">Full Catalogue</h2>
          
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm w-48"
              />
            </div>

            {/* Sort */}
            <button className="p-2 border border-border rounded-lg hover:bg-secondary transition-colors">
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Filter */}
            <button className="p-2 border border-border rounded-lg hover:bg-secondary transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Magazine Grid */}
        <div className={`
          grid gap-6
          ${viewMode === "grid" 
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
            : "grid-cols-1"
          }
        `}>
          {magazines.map((mag) => (
            <MagazineCard
              key={mag.id}
              coverImage={mag.cover_image_url || "/placeholder.svg"}
              title={mag.title}
              publisher={mag.publisher?.company_name || "Unknown Publisher"}
              region={mag.category || undefined}
              price={mag.wholesale_price}
              onClick={() => navigate(`/retailer/catalogue/${mag.id}`)}
              onBookmark={() => toggleBookmark(mag.id)}
              isBookmarked={bookmarkedIds.includes(mag.id)}
            />
          ))}
        </div>
      </section>
    </RetailerLayout>
  );
};
