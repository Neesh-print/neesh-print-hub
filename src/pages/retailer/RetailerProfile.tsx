import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Instagram, Globe, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { useWishlistContext } from "@/components/retailer/WishlistContext";
import { BackNavigation, ButtonSecondary, InfoCard } from "@/components/neesh";
import { useMagazines } from "@/hooks/useMagazines";
import { useRetailerProfile } from "@/hooks/useRetailerProfile";
import { LoadingScreen } from "@/components/shared";

export const RetailerProfile = () => {
  const navigate = useNavigate();
  const [bookmarksExpanded, setBookmarksExpanded] = useState(true);
  
  // Connect to real data
  const { retailer, isLoading } = useRetailerProfile();
  const { wishlistIds, wishlistCount } = useWishlistContext();
  const { magazines } = useMagazines({ status: 'active' });
  
  // Get actual bookmarked magazines from wishlist
  const bookmarkedTitles = magazines
    .filter((mag) => wishlistIds.includes(mag.id))
    .map((mag) => ({
      id: mag.id,
      title: mag.title,
      coverImage: mag.cover_image_url || "/placeholder.svg",
    }));

  if (isLoading) {
    return (
      <RetailerLayout>
        <LoadingScreen message="Loading profile..." />
      </RetailerLayout>
    );
  }

  if (!retailer) {
    return (
      <RetailerLayout>
        <div className="p-6">
          <InfoCard title="Profile Not Found">
            <p className="text-muted-foreground mb-4">
              We couldn't load your retailer profile. Please ensure you have completed the onboarding.
            </p>
            <ButtonSecondary onClick={() => navigate("/retailer/settings")}>
              Go to Settings
            </ButtonSecondary>
          </InfoCard>
        </div>
      </RetailerLayout>
    );
  }

  return (
    <RetailerLayout>
      <BackNavigation
        title="My Profile"
        onBack={() => navigate("/retailer")}
      />

      <div className="px-4 md:px-6 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-2">
            <div className="card-neesh">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center">
                   {/* Placeholder avatar since we don't have one in DB yet */}
                   <span className="font-display font-bold text-3xl text-muted-foreground">
                    {retailer.shop_name?.charAt(0) || "R"}
                   </span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 className="font-display font-bold text-2xl text-foreground mb-2">
                    {retailer.shop_name || "Untitled Shop"}
                  </h1>

                  {retailer.shop_url && (
                    <a
                      href={retailer.shop_url.startsWith('http') ? retailer.shop_url : `https://${retailer.shop_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-accent hover:underline mb-2"
                    >
                      <Globe className="w-4 h-4" />
                      {retailer.shop_url.replace(/^https?:\/\//, '')}
                    </a>
                  )}

                  {/* Contact person not in DB currently, omitting */}

                  {retailer.shop_description && (
                    <p className="text-muted-foreground mb-4">
                      {retailer.shop_description}
                    </p>
                  )}

                  {(retailer.city || retailer.state) && (
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {[retailer.city, retailer.state].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Social Icons */}
                  <div className="flex gap-3 mb-6">
                    {retailer.instagram_handle && (
                      <a 
                        href={`https://instagram.com/${retailer.instagram_handle.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {retailer.shop_url && (
                      <a 
                         href={retailer.shop_url.startsWith('http') ? retailer.shop_url : `https://${retailer.shop_url}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
                      >
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <ButtonSecondary onClick={() => navigate("/retailer/settings")}>
                      Edit Profile
                    </ButtonSecondary>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-1 space-y-4">
            {/* Order Stats */}
            <InfoCard title="My Orders">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Orders</span>
                  <span className="font-medium">{retailer.total_orders || 0}</span>
                </div>
                {/* Total spent could be added here if desired */}
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Spent</span>
                    <span className="font-medium">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(retailer.total_spent || 0)}
                    </span>
                </div>
              </div>
            </InfoCard>

            {/* Bookmarked Titles */}
            <div className="card-neesh">
              <button
                onClick={() => setBookmarksExpanded(!bookmarksExpanded)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-display font-semibold text-foreground">
                  Bookmarked Titles ({wishlistCount})
                </h3>
                {bookmarksExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              
              {bookmarksExpanded && (
                <div className="mt-4">
                  {bookmarkedTitles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No saved titles yet.{" "}
                      <button 
                        onClick={() => navigate("/retailer")}
                        className="text-accent hover:underline"
                      >
                        Browse catalogue
                      </button>
                    </p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {bookmarkedTitles.map((title) => (
                        <div
                          key={title.id}
                          className="w-16 h-20 rounded overflow-hidden bg-secondary flex-shrink-0 cursor-pointer"
                          onClick={() => navigate(`/retailer/catalogue/${title.id}`)}
                        >
                          <img
                            src={title.coverImage}
                            alt={title.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {bookmarkedTitles.length > 0 && (
                    <button 
                      onClick={() => navigate("/retailer/wishlist")}
                      className="mt-2 text-sm text-accent hover:underline"
                    >
                      View all →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RetailerLayout>
  );
};
