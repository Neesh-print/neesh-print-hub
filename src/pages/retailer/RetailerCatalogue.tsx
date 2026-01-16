import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, List, Search, ArrowUpDown, SlidersHorizontal, Bookmark } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, MagazineCard } from "@/components/neesh";

const mockFeaturedMagazines = [
  { id: "1", coverImage: "/placeholder.svg", title: "Weird Walk Issue 8", publisher: "Weird Walk", region: "UK", price: 8.81, isBookmarked: true },
  { id: "2", coverImage: "/placeholder.svg", title: "Apartamento #32", publisher: "Apartamento", region: "Barcelona", price: 18.00, isBookmarked: false },
  { id: "3", coverImage: "/placeholder.svg", title: "MacGuffin No. 15", publisher: "MacGuffin", region: "Amsterdam", price: 22.50, isBookmarked: false },
  { id: "4", coverImage: "/placeholder.svg", title: "Kinfolk Issue 48", publisher: "Kinfolk", region: "Portland OR", price: 24.00, isBookmarked: true },
  { id: "5", coverImage: "/placeholder.svg", title: "Cabana Issue 21", publisher: "Cabana", region: "London", price: 45.00, isBookmarked: false },
  { id: "6", coverImage: "/placeholder.svg", title: "Monocle Issue 172", publisher: "Monocle", region: "London", price: 15.00, isBookmarked: false },
];

const mockCatalogueMagazines = [
  { id: "1", coverImage: "/placeholder.svg", title: "Weird Walk Issue 8", publisher: "Weird Walk", region: "UK", price: 8.81 },
  { id: "2", coverImage: "/placeholder.svg", title: "Apartamento #32", publisher: "Apartamento", region: "Barcelona", price: 18.00 },
  { id: "3", coverImage: "/placeholder.svg", title: "MacGuffin No. 15", publisher: "MacGuffin", region: "Amsterdam", price: 22.50 },
  { id: "4", coverImage: "/placeholder.svg", title: "Kinfolk Issue 48", publisher: "Kinfolk", region: "Portland OR", price: 24.00 },
  { id: "5", coverImage: "/placeholder.svg", title: "Cabana Issue 21", publisher: "Cabana", region: "London", price: 45.00 },
  { id: "6", coverImage: "/placeholder.svg", title: "Monocle Issue 172", publisher: "Monocle", region: "London", price: 15.00 },
  { id: "7", coverImage: "/placeholder.svg", title: "The Gourmand #18", publisher: "The Gourmand", region: "London", price: 20.00 },
  { id: "8", coverImage: "/placeholder.svg", title: "Offscreen Issue 25", publisher: "Offscreen", region: "Australia", price: 19.00 },
  { id: "9", coverImage: "/placeholder.svg", title: "Eye on Design #6", publisher: "AIGA", region: "New York", price: 16.00 },
  { id: "10", coverImage: "/placeholder.svg", title: "Drift Vol. 14", publisher: "Drift", region: "Los Angeles CA", price: 12.00 },
  { id: "11", coverImage: "/placeholder.svg", title: "Lodestars Anthology", publisher: "Lodestars", region: "Ireland", price: 28.00 },
  { id: "12", coverImage: "/placeholder.svg", title: "Cereal Vol. 22", publisher: "Cereal", region: "UK", price: 18.00 },
  { id: "13", coverImage: "/placeholder.svg", title: "Weapons of Reason #7", publisher: "Human After All", region: "UK", price: 14.00 },
  { id: "14", coverImage: "/placeholder.svg", title: "Works That Work #9", publisher: "Works That Work", region: "Netherlands", price: 17.00 },
  { id: "15", coverImage: "/placeholder.svg", title: "Beside Magazine #10", publisher: "Beside", region: "Montreal", price: 22.00 },
  { id: "16", coverImage: "/placeholder.svg", title: "Disegno #32", publisher: "Disegno", region: "London", price: 16.00 },
  { id: "17", coverImage: "/placeholder.svg", title: "Migrant Journal #6", publisher: "Migrant", region: "London", price: 25.00 },
  { id: "18", coverImage: "/placeholder.svg", title: "Real Review #12", publisher: "Real Review", region: "London", price: 20.00 },
];

export const RetailerCatalogue = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(["1", "4"]);

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredMagazines = mockCatalogueMagazines.filter(mag =>
    mag.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mag.publisher.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <RetailerLayout>
      <BackNavigation
        title="Neesh Favs"
        onBack={() => navigate("/")}
      />

      {/* Hero Carousel Section */}
      <section className="px-4 md:px-6 py-8 overflow-hidden">
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
          {mockFeaturedMagazines.map((mag, index) => (
            <div
              key={mag.id}
              className={`
                relative flex-shrink-0 w-48 md:w-56 snap-center
                ${index % 2 === 0 ? 'rotate-[-2deg]' : 'rotate-[2deg]'}
                ${index > 0 ? '-ml-8' : ''}
              `}
              style={{ zIndex: mockFeaturedMagazines.length - index }}
            >
              <div 
                className="relative aspect-[3/4] rounded-lg overflow-hidden bg-secondary shadow-neesh-md cursor-pointer group"
                onClick={() => navigate(`/retailer/catalogue/${mag.id}`)}
              >
                <img
                  src={mag.coverImage}
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
          {filteredMagazines.map((mag) => (
            <MagazineCard
              key={mag.id}
              coverImage={mag.coverImage}
              title={mag.title}
              publisher={mag.publisher}
              region={mag.region}
              price={mag.price}
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
