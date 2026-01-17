import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Instagram, Globe, ExternalLink, Lock } from "lucide-react";
import { MagazineCard, ButtonPrimary, ButtonSecondary, Modal } from "@/components/neesh";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Mock data - expanded for public profile
const mockPublisher = {
  slug: "kinfolk-publishing",
  avatar: "/placeholder.svg",
  name: "Kinfolk Publishing",
  tagline: "Celebrating the simple things and the artful pursuit of beautiful things.",
  bio: "Kinfolk is a slow lifestyle magazine founded in 2011. We celebrate the simple things and the artful pursuit of beautiful things. Our content spans across art, design, food, and culture with a focus on mindful living.",
  location: "Portland, Oregon",
  website: "kinfolk.com",
  socialLinks: {
    instagram: "kinfolk",
    twitter: "kinfolk",
    tiktok: "kinfolk",
  },
  memberSince: "2024",
  shippingLocation: "Portland, OR",
};

const mockTitles = [
  {
    id: "1",
    coverImage: "/placeholder.svg",
    title: "Kinfolk Issue 45",
    issueNumber: "Issue 45",
    price: 18.00,
  },
  {
    id: "2",
    coverImage: "/placeholder.svg",
    title: "Kinfolk Issue 44",
    issueNumber: "Issue 44",
    price: 18.00,
  },
  {
    id: "3",
    coverImage: "/placeholder.svg",
    title: "Kinfolk Issue 43",
    issueNumber: "Issue 43",
    price: 16.50,
  },
  {
    id: "4",
    coverImage: "/placeholder.svg",
    title: "Kinfolk Issue 42",
    issueNumber: "Issue 42",
    price: 16.50,
  },
  {
    id: "5",
    coverImage: "/placeholder.svg",
    title: "Kinfolk Issue 41",
    issueNumber: "Issue 41",
    price: 15.00,
  },
  {
    id: "6",
    coverImage: "/placeholder.svg",
    title: "Kinfolk Issue 40",
    issueNumber: "Issue 40",
    price: 15.00,
  },
  {
    id: "7",
    coverImage: "/placeholder.svg",
    title: "The Travel Issue",
    issueNumber: "Special Edition",
    price: 22.00,
  },
  {
    id: "8",
    coverImage: "/placeholder.svg",
    title: "Kinfolk Home",
    issueNumber: "Annual",
    price: 24.00,
  },
];

export const PublisherPublicProfile = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const { user } = useAuth();
  
  // Use wishlist hook directly (works with localStorage for non-authenticated users)
  const { isInWishlist, toggleWishlist, wishlistCount } = useWishlist();

  // In real app, fetch publisher by slug
  const publisher = mockPublisher;
  const titles = mockTitles;

  const handleTitleClick = () => {
    setShowSignUpModal(true);
  };

  const handleBookmark = (id: string) => {
    const wasInWishlist = isInWishlist(id);
    toggleWishlist(id);
    toast.success(wasInWishlist ? "Removed from wishlist" : "Saved to wishlist");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - minimal branding */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-display font-bold text-xl text-foreground">neesh</span>
          <div className="flex items-center gap-3">
            <ButtonSecondary onClick={() => navigate("/login")}>
              Sign In
            </ButtonSecondary>
            <ButtonPrimary onClick={() => navigate("/apply")}>
              Join Neesh
            </ButtonPrimary>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="grid lg:grid-cols-[320px,1fr] gap-8 lg:gap-12">
          {/* Left Sidebar - Publisher Info (sticky on desktop) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col items-center lg:items-start">
              {/* Avatar */}
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-secondary overflow-hidden mb-6">
                <img
                  src={publisher.avatar}
                  alt={publisher.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Name & Tagline */}
              <h1 className="font-display font-bold text-display-sm md:text-display text-foreground text-center lg:text-left mb-2">
                {publisher.name}
              </h1>
              <p className="text-body text-muted-foreground text-center lg:text-left mb-4 max-w-sm">
                {publisher.tagline}
              </p>

              {/* Location */}
              <div className="flex items-center gap-2 text-muted-foreground mb-4">
                <MapPin className="w-4 h-4" />
                <span className="text-body">{publisher.location}</span>
              </div>

              {/* Website */}
              <a
                href={`https://${publisher.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-accent hover:underline mb-6"
              >
                <Globe className="w-4 h-4" />
                <span className="text-body">{publisher.website}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* Social Links */}
              <div className="flex items-center gap-3 mb-6">
                {publisher.socialLinks.instagram && (
                  <a
                    href={`https://instagram.com/${publisher.socialLinks.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-5 h-5 text-foreground" />
                  </a>
                )}
                {publisher.socialLinks.twitter && (
                  <a
                    href={`https://x.com/${publisher.socialLinks.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                    aria-label="X/Twitter"
                  >
                    <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                )}
                {publisher.socialLinks.tiktok && (
                  <a
                    href={`https://tiktok.com/@${publisher.socialLinks.tiktok}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                    aria-label="TikTok"
                  >
                    <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                    </svg>
                  </a>
                )}
              </div>

              {/* Stats - subtle */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-caption text-muted-foreground mb-6">
                <span>{titles.length} titles available</span>
                <span>•</span>
                <span>Ships from {publisher.shippingLocation}</span>
                <span>•</span>
                <span>On Neesh since {publisher.memberSince}</span>
              </div>

              {/* Bio - desktop only */}
              <p className="hidden lg:block text-body text-foreground/80 leading-relaxed">
                {publisher.bio}
              </p>
            </div>
          </aside>

          {/* Right Content - Titles Grid */}
          <div className="space-y-8">
            {/* Bio - mobile only */}
            <p className="lg:hidden text-body text-foreground/80 leading-relaxed text-center">
              {publisher.bio}
            </p>

            {/* Titles Section */}
            <section>
              <h2 className="font-display font-semibold text-heading text-foreground mb-6">
                Available Titles
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {titles.map((title) => (
                  <MagazineCard
                    key={title.id}
                    coverImage={title.coverImage}
                    title={title.title}
                    publisher={title.issueNumber}
                    price={title.price}
                    onClick={handleTitleClick}
                    onBookmark={() => handleBookmark(title.id)}
                    isBookmarked={isInWishlist(title.id)}
                  />
                ))}
              </div>
              
              {wishlistCount > 0 && (
                <p className="mt-4 text-sm text-muted-foreground text-center">
                  {wishlistCount} {wishlistCount === 1 ? 'title' : 'titles'} saved • {user ? (
                    <button onClick={() => navigate("/retailer/wishlist")} className="text-accent hover:underline">
                      View wishlist
                    </button>
                  ) : (
                    <button onClick={() => navigate("/login")} className="text-accent hover:underline">
                      Sign in to access your wishlist
                    </button>
                  )}
                </p>
              )}
            </section>

            {/* CTA Section */}
            <section className="bg-secondary/50 rounded-xl p-6 md:p-8 text-center">
              <h3 className="font-display font-bold text-xl md:text-2xl text-foreground mb-2">
                Stock {publisher.name} at your store
              </h3>
              <p className="text-body text-muted-foreground mb-6 max-w-md mx-auto">
                Join Neesh to place wholesale orders and get access to our full catalogue of independent publishers.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <ButtonPrimary onClick={() => navigate("/apply")}>
                  Apply as a Retailer
                </ButtonPrimary>
                <ButtonSecondary onClick={() => navigate("/login")}>
                  Sign In
                </ButtonSecondary>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-caption">Powered by</span>
            <span className="font-display font-bold text-foreground">neesh</span>
          </div>
          <a
            href="/apply"
            className="text-caption text-accent hover:underline"
          >
            Are you a publisher? Join Neesh →
          </a>
        </div>
      </footer>

      {/* Sign Up Modal */}
      <Modal
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        title="Sign in to order"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-body text-foreground mb-2">
            Join Neesh to place wholesale orders
          </p>
          <p className="text-caption text-muted-foreground mb-6">
            Create a retailer account to access pricing, place orders, and connect with publishers.
          </p>
          <div className="flex flex-col gap-3">
            <ButtonPrimary fullWidth onClick={() => navigate("/apply")}>
              Apply as a Retailer
            </ButtonPrimary>
            <ButtonSecondary fullWidth onClick={() => navigate("/login")}>
              Sign In
            </ButtonSecondary>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PublisherPublicProfile;
