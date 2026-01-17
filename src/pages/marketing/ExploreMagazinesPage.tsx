import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, MapPin, Star } from 'lucide-react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { ButtonPrimary } from '@/components/neesh/ButtonPrimary';
import { ButtonSecondary } from '@/components/neesh/ButtonSecondary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// TODO: Replace hardcoded FEATURED_MAGAZINES with data from Supabase
// TODO: Add `is_public` flag to products table for controlling visibility
// TODO: Connect to real product images from Supabase storage

interface Magazine {
  id: number;
  title: string;
  issue: string;
  publisher: string;
  location: string;
  description: string;
  themes: string[];
  coverImage: string;
  featured?: boolean;
}

const FEATURED_MAGAZINES: Magazine[] = [
  {
    id: 1,
    title: "Wax Poetics",
    issue: "Issue 75",
    publisher: "Wax Poetics",
    location: "Brooklyn, NY",
    description: "The diggers' bible. Insightful music journalism on classic and contemporary trailblazers.",
    themes: ["Music", "Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1757968055495.png?v=1766810137",
    featured: true,
  },
  {
    id: 2,
    title: "The Drift",
    issue: "Issue 16",
    publisher: "The Drift Magazine Foundation",
    location: "New York, NY",
    description: "Essays, interviews, fiction, and poetry on power, backlash, belief, and the long fallout of recent history.",
    themes: ["Literature", "Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/theDriftissue15.png?v=1766809826",
    featured: true,
  },
  {
    id: 3,
    title: "Mushroom People",
    issue: "Volume 2",
    publisher: "Broccoli Publishing",
    location: "Portland, OR",
    description: "Stories illuminating the ways mushrooms subvert and expand our understanding of the world.",
    themes: ["Nature", "Art & Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_f42a6f9b-ddb3-4e6e-a873-3a21a6fd5897.png?v=1763955714",
    featured: true,
  },
  {
    id: 4,
    title: "Pitch",
    issue: "Issue 14",
    publisher: "Pitch Stories Of Modern Sport",
    location: "UK",
    description: "Quarterly sports magazine focusing on events, teams, and sporting icons.",
    themes: ["Sports", "Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_3e9d3517-a535-4e25-9c81-231bd5576e09.png?v=1766810920",
  },
  {
    id: 5,
    title: "photoED",
    issue: "Issue 75",
    publisher: "photoED Magazine",
    location: "Toronto, Canada",
    description: "The magazine for people who love photography with purpose.",
    themes: ["Photography", "Art & Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_6faf9f3f-cd91-4d1e-bdcd-efa50da8545b.png?v=1766809049",
  },
  {
    id: 6,
    title: "Mildew",
    issue: "Issue 4",
    publisher: "Broccoli Publishing",
    location: "Portland, OR",
    description: "An annual print magazine about secondhand fashion and creative reuse.",
    themes: ["Fashion", "Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_e5278750-e63b-4f64-b37e-3c1b372e6c98.png?v=1763955681",
  },
  {
    id: 7,
    title: "Wyrd Science",
    issue: "Issue 7",
    publisher: "Wyrd Science",
    location: "UK",
    description: "Award-winning magazine focused on tabletop games and how they influence the world.",
    themes: ["Gaming", "Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1760444283132.jpg?v=1763953176",
  },
  {
    id: 8,
    title: "We Are Makers",
    issue: "Edition 16",
    publisher: "We Are Makers",
    location: "Glasgow, Scotland",
    description: "Connecting the world with exceptional makers, craftspeople, and artists.",
    themes: ["Art & Culture", "Craft"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_de322079-2693-42c1-b8a1-cb9db2b1e21d.png?v=1766811531",
  },
  {
    id: 9,
    title: "Fausto",
    issue: "Issue 005",
    publisher: "Fausto",
    location: "Wenham, MA",
    description: "A cycling, travel, food, and culture magazine celebrating the joy of riding.",
    themes: ["Sports", "Food & Travel"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_0a003dc4-4660-4dfa-9cb1-5a5e675587e9.png?v=1766807962",
  },
  {
    id: 10,
    title: "Somesuch Stories",
    issue: "Issue 8",
    publisher: "Somesuch Editions",
    location: "UK",
    description: "Annual journal packed with insight into contemporary experiences of culture, society, sex and nature.",
    themes: ["Literature", "Photography"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_71c56a2c-dd1b-49fa-b818-9ec6ff404774.png?v=1766812175",
  },
  {
    id: 11,
    title: "BSKT",
    issue: "Issue 6",
    publisher: "BSKT",
    location: "Montreal, Canada",
    description: "Global basketball culture magazine distributed across major cities.",
    themes: ["Sports", "Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_e714e1d8-7221-40ab-a2ef-db8dc2c60b1d.png?v=1766812508",
  },
  {
    id: 12,
    title: "Catnip",
    issue: "Volume 1",
    publisher: "Broccoli Publishing",
    location: "Portland, OR",
    description: "Independent art and culture magazine celebrating cats.",
    themes: ["Art & Culture", "Animals"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_4581c634-a7e0-4dfe-aa06-4e424602f30f.png?v=1763955598",
  },
  {
    id: 13,
    title: "Heartbeat",
    issue: "Volume 1",
    publisher: "Broccoli Publishing",
    location: "Portland, OR",
    description: "Music, sound, and emotion explored through thoughtful editorial.",
    themes: ["Music", "Culture"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_e87a4a25-9d20-47ca-871a-cb91694481de.png?v=1763955632",
  },
  {
    id: 14,
    title: "Stash Annual",
    issue: "2026",
    publisher: "Stash Media",
    location: "New York, NY",
    description: "Annual publication showcasing the best in design and motion graphics.",
    themes: ["Art & Culture", "Design"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_71e68a65-043a-4b19-aa7b-2eb7a8c9a2a0.png?v=1766812707",
  },
  {
    id: 15,
    title: "No One",
    issue: "Issue 02: Ho Chi Minh City & Hanoi",
    publisher: "No One Magazine",
    location: "Amsterdam, Netherlands",
    description: "Vietnam's queer nightlife captured through 15 stories of club culture, drag, and community.",
    themes: ["Culture", "Nightlife"],
    coverImage: "https://cdn.shopify.com/s/files/1/0985/0326/2389/files/1_f4575f5c-df00-4d83-9a39-9ccd381db8a3.png?v=1766806943",
  },
];

const FILTER_OPTIONS = [
  'All',
  'Art & Culture',
  'Music',
  'Sports',
  'Photography',
  'Fashion',
  'Gaming',
  'Food & Travel',
  'Nature',
  'Literature',
];

export const ExploreMagazinesPage = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedMagazine, setSelectedMagazine] = useState<Magazine | null>(null);

  const filteredMagazines = activeFilter === 'All'
    ? FEATURED_MAGAZINES
    : FEATURED_MAGAZINES.filter(mag => 
        mag.themes.some(theme => 
          theme.toLowerCase().includes(activeFilter.toLowerCase()) ||
          activeFilter.toLowerCase().includes(theme.toLowerCase())
        )
      );

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
              {FILTER_OPTIONS.map((filter) => (
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredMagazines.map((magazine) => (
              <div
                key={magazine.id}
                onClick={() => setSelectedMagazine(magazine)}
                className="group cursor-pointer"
              >
                {/* Cover Image */}
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-secondary mb-3">
                  <img
                    src={magazine.coverImage}
                    alt={`${magazine.title} - ${magazine.issue}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  {magazine.featured && (
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
                    {magazine.publisher}
                  </p>
                  <div className="flex items-center gap-1 text-caption text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{magazine.location}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {magazine.themes.slice(0, 2).map((theme) => (
                      <span
                        key={theme}
                        className="text-[10px] md:text-caption px-2 py-0.5 bg-secondary rounded-full text-muted-foreground"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredMagazines.length === 0 && (
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
                <img
                  src={selectedMagazine.coverImage}
                  alt={`${selectedMagazine.title} - ${selectedMagazine.issue}`}
                  className="w-full h-full object-cover"
                />
                {selectedMagazine.featured && (
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
                    {selectedMagazine.issue} • {selectedMagazine.publisher}
                  </p>
                </DialogHeader>

                <div className="flex items-center gap-1 text-caption text-muted-foreground mb-3">
                  <MapPin className="w-3 h-3" />
                  <span>{selectedMagazine.location}</span>
                </div>

                <p className="text-body text-muted-foreground mb-4">
                  {selectedMagazine.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedMagazine.themes.map((theme) => (
                    <span
                      key={theme}
                      className="text-caption px-3 py-1 bg-secondary rounded-full text-foreground"
                    >
                      {theme}
                    </span>
                  ))}
                </div>

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
