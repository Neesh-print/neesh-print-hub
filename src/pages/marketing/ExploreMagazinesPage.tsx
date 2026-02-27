import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Star, BookOpen } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { ButtonSecondary } from '@/components/neesh/ButtonSecondary';
import { EmptyState } from '@/components/neesh/EmptyState';
import { MagazineCoverImage } from '@/components/neesh/MagazineCoverImage';
import { LoadingScreen } from '@/components/shared/LoadingScreen';
import { useMagazines, type Magazine } from '@/hooks/useMagazines';
import { MagazineCardSkeleton } from '@/components/skeletons/MagazineCardSkeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Categories are now derived dynamically from the database

export const ExploreMagazinesPage = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedMagazine, setSelectedMagazine] = useState<Magazine | null>(null);

  // Fetch live magazines from Supabase
  const { magazines, isLoading, error } = useMagazines({ 
    status: 'active',
  });

  // Only show magazines with cover images
  const magazinesWithImages = useMemo(() => magazines.filter(mag => mag.cover_image_url), [magazines]);

  // Unique categories from the data
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    magazinesWithImages.forEach((mag) => {
      if (mag.category) categories.add(mag.category);
    });
    return ['All', ...Array.from(categories).sort()];
  }, [magazinesWithImages]);

  // Filter magazines based on active filter
  const filteredMagazines = useMemo(() => {
    if (activeFilter === 'All') return magazinesWithImages;
    
    return magazinesWithImages.filter(mag => 
      mag.category?.toLowerCase().includes(activeFilter.toLowerCase()) ||
      activeFilter.toLowerCase().includes(mag.category?.toLowerCase() || '')
    );
  }, [magazinesWithImages, activeFilter]);

  // Featured magazines (first 3 active ones with images)
  const featuredMagazines = magazinesWithImages.slice(0, 3);

  return (
    <MarketingLayout>
      {/* Header Section */}
      <section className="py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-8">
            <h1 className="text-display-lg md:text-[3rem] lg:text-[3.5rem] font-display font-bold mb-4">
              Explore the Catalog
            </h1>
            <p className="text-body-lg text-muted-foreground">
              A curated selection of independent magazines available through Neesh. Apply as a retailer to browse the full catalog and place orders.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            <div className="flex gap-2 min-w-max md:flex-wrap md:justify-center">
              {availableCategories.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-full text-body font-medium transition-all whitespace-nowrap ${
                    activeFilter === filter
                      ? 'bg-foreground text-background'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Magazine Grid */}
      <section className="pb-16 md:pb-20">
        <div className="container mx-auto px-4 md:px-6">
          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <MagazineCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <EmptyState
              icon={<BookOpen className="w-12 h-12" />}
              title="Unable to load magazines"
              description="Please try again later"
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && magazinesWithImages.length === 0 && (
            <EmptyState
              icon={<BookOpen className="w-12 h-12" />}
              title="New titles coming soon"
              description="Check back shortly for our curated magazine selection"
            />
          )}

          {/* Magazine Grid */}
          {!isLoading && !error && filteredMagazines.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredMagazines.map((magazine, index) => (
                <div
                  key={magazine.id}
                  onClick={() => setSelectedMagazine(magazine)}
                  className="group cursor-pointer"
                >
                  {/* Cover Image */}
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-secondary mb-3 shadow-neesh transition-shadow duration-300 group-hover:shadow-neesh-md">
                    <MagazineCoverImage
                      src={magazine.cover_image_url}
                      alt={`${magazine.title} - ${magazine.issue_number || ''}`}
                      className="transition-transform duration-300 group-hover:scale-[1.02]"
                      priority={index < 4}
                    />
                    {index < 3 && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-accent text-accent-foreground text-caption px-2 py-1 rounded-full">
                        <Star className="w-3 h-3 fill-current" />
                        <span>Featured</span>
                      </div>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-300" />
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <h3 className="text-body font-semibold line-clamp-1 group-hover:text-accent transition-colors">
                      {magazine.title}
                    </h3>
                    <p className="text-caption text-muted-foreground line-clamp-1">
                      {magazine.publisher?.company_name || 'Independent Publisher'}
                    </p>
                    {magazine.category && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-[10px] md:text-caption px-2 py-0.5 bg-secondary rounded-full text-muted-foreground">
                          {magazine.category}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No filter results */}
          {!isLoading && !error && magazinesWithImages.length > 0 && filteredMagazines.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-body-lg">
                No magazines found for this filter. Try another category.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="bg-secondary py-16 md:py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
            {/* For Retailers */}
            <div className="text-center md:text-left">
              <h2 className="text-display-sm md:text-display-md font-display font-bold mb-4">
                Ready to stock these titles?
              </h2>
              <p className="text-body-lg text-muted-foreground mb-6">
                Apply for a retailer account to access wholesale pricing, place orders, and browse the full catalog.
              </p>
              <Link to="/apply/retailer">
                <ButtonPrimary variant="black">
                  Apply as a Retailer
                </ButtonPrimary>
              </Link>
            </div>

            {/* For Publishers */}
            <div className="text-center md:text-left">
              <h2 className="text-display-sm md:text-display-md font-display font-bold mb-4">
                Want your magazine here?
              </h2>
              <p className="text-body-lg text-muted-foreground mb-6">
                Join the publishers already reaching new retailers through Neesh.
              </p>
              <Link to="/apply/publisher">
                <ButtonSecondary>
                  Apply as a Publisher
                </ButtonSecondary>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Magazine Detail Modal */}
      <Dialog open={!!selectedMagazine} onOpenChange={() => setSelectedMagazine(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {selectedMagazine && (
            <>
              {/* Cover Image */}
              <div className="relative aspect-[3/4] max-h-[50vh] overflow-hidden bg-secondary">
                <MagazineCoverImage
                  src={selectedMagazine.cover_image_url}
                  alt={`${selectedMagazine.title} - ${selectedMagazine.issue_number || ''}`}
                  priority
                />
                {featuredMagazines.some(m => m.id === selectedMagazine.id) && (
                  <div className="absolute top-4 left-4 flex items-center gap-1 bg-accent text-accent-foreground text-caption px-2 py-1 rounded-full">
                    <Star className="w-3 h-3 fill-current" />
                    <span>Featured</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-display-sm font-display font-bold">
                    {selectedMagazine.title}
                  </DialogTitle>
                  <p className="text-body text-muted-foreground">
                    {selectedMagazine.issue_number && `${selectedMagazine.issue_number} • `}
                    {selectedMagazine.publisher?.company_name || 'Independent Publisher'}
                  </p>
                </DialogHeader>

                {selectedMagazine.category && (
                  <div className="flex items-center gap-1 text-caption text-muted-foreground mb-3">
                    <span className="px-2 py-0.5 bg-secondary rounded-full">
                      {selectedMagazine.category}
                    </span>
                  </div>
                )}

                {selectedMagazine.description && (
                  <p className="text-body text-muted-foreground mb-4">
                    {selectedMagazine.description}
                  </p>
                )}

                <div className="border-t border-border pt-6">
                  <h3 className="text-heading font-semibold mb-2">
                    Want to stock this title?
                  </h3>
                  <p className="text-body text-muted-foreground mb-4">
                    Apply as a retailer to access wholesale pricing, place orders, and browse our full catalog.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Link to="/apply/retailer" className="w-full">
                      <ButtonPrimary variant="black" className="w-full">
                        Apply as a Retailer
                      </ButtonPrimary>
                    </Link>
                    <Link
                      to="/apply/publisher"
                      className="text-center text-body text-muted-foreground hover:text-foreground transition-colors"
                    >
                      I'm a publisher →
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MarketingLayout>
  );
};
