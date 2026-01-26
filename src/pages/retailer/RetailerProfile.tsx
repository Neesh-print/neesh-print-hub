import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Instagram, Globe, ChevronDown, ChevronUp, ExternalLink, AlertCircle } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { useWishlistContext } from "@/components/retailer/WishlistContext";
import { BackNavigation, ButtonSecondary, InfoCard } from "@/components/neesh";
import { useMagazines } from "@/hooks/useMagazines";
import { useRetailerProfile } from "@/hooks/useRetailerProfile";
import { useOrders } from "@/hooks/useOrders";
import { getStoreTypeLabels } from "@/lib/store-types";
import { isProfileComplete } from "@/lib/profile-completion";
import { MagazineCoverImage } from "@/components/neesh/MagazineCoverImage";
import { Skeleton } from "@/components/ui/skeleton";

export const RetailerProfile = () => {
  const navigate = useNavigate();
  const [publishersExpanded, setPublishersExpanded] = useState(true);
  const [bookmarksExpanded, setBookmarksExpanded] = useState(true);
  
  // Fetch real retailer data
  const { retailer, isLoading: profileLoading } = useRetailerProfile();
  const { orders } = useOrders();
  
  // Connect to real wishlist
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

  // Calculate order stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
  const thisMonthOrders = orders.filter(o => {
    const orderDate = new Date(o.created_at);
    const now = new Date();
    return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
  }).length;

  // Profile completion check
  const profileData = retailer ? {
    shop_name: retailer.shop_name,
    contact_name: (retailer as any).contact_name || null,
    contact_email: (retailer as any).contact_email || null,
    city: retailer.city,
    state: retailer.state,
    shop_description: retailer.shop_description,
    store_types: (retailer as any).store_types || [],
    shop_url: retailer.shop_url,
    instagram_handle: retailer.instagram_handle,
    profile_image_url: (retailer as any).profile_image_url,
    profile_completed_at: (retailer as any).profile_completed_at,
  } : null;

  const profileComplete = profileData ? isProfileComplete(profileData) : false;

  // Get store type labels
  const storeTypeLabels = profileData?.store_types 
    ? getStoreTypeLabels(profileData.store_types) 
    : [];

  // Format location
  const location = [retailer?.city, retailer?.state].filter(Boolean).join(', ');

  // Loading state
  if (profileLoading) {
    return (
      <RetailerLayout>
        <BackNavigation
          title="My Profile"
          onBack={() => navigate("/retailer")}
        />
        <div className="px-4 md:px-6 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="card-neesh">
                <div className="flex flex-col md:flex-row gap-6">
                  <Skeleton className="w-24 h-24 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
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
        {/* Incomplete Profile Banner */}
        {!profileComplete && (
          <div className="flex items-start gap-3 p-4 bg-accent/10 border border-accent/30 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-foreground">
                Complete your profile
              </p>
              <p className="text-sm text-muted-foreground">
                Publishers use your profile to learn about your store. A complete profile helps you stand out.
              </p>
            </div>
            <ButtonSecondary
              onClick={() => navigate('/retailer/profile/edit', { state: { firstTime: true } })}
              className="flex-shrink-0"
            >
              Complete Profile
            </ButtonSecondary>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-2">
            <div className="card-neesh">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                  {profileData?.profile_image_url ? (
                    <img
                      src={profileData.profile_image_url}
                      alt={retailer?.shop_name || 'Store'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl font-display">
                      {retailer?.shop_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 className="font-display font-bold text-2xl text-foreground mb-2">
                    {retailer?.shop_name || 'Your Store'}
                  </h1>

                  {retailer?.shop_url && (
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

                  {profileData?.contact_name && (
                    <p className="text-muted-foreground mb-2">
                      Contact: {profileData.contact_name}
                    </p>
                  )}

                  {retailer?.shop_description ? (
                    <p className="text-muted-foreground mb-4">
                      {retailer.shop_description}
                    </p>
                  ) : (
                    <p className="text-muted-foreground mb-4 italic">
                      No description yet.{' '}
                      <button 
                        onClick={() => navigate('/retailer/profile/edit')}
                        className="text-accent hover:underline"
                      >
                        Add one
                      </button>
                    </p>
                  )}

                  {location && (
                    <div className="flex items-center gap-2 text-muted-foreground mb-4">
                      <MapPin className="w-4 h-4" />
                      <span>{location}</span>
                    </div>
                  )}

                  {/* Store Type Tags */}
                  {storeTypeLabels.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {storeTypeLabels.map((type) => (
                        <span
                          key={type}
                          className="px-3 py-1 bg-secondary text-foreground text-sm rounded-full"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-6 italic">
                      No store types selected.{' '}
                      <button 
                        onClick={() => navigate('/retailer/profile/edit')}
                        className="text-accent hover:underline"
                      >
                        Add them
                      </button>
                    </p>
                  )}

                  {/* Social Icons */}
                  <div className="flex gap-3 mb-6">
                    {retailer?.instagram_handle && (
                      <a
                        href={`https://instagram.com/${retailer.instagram_handle.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {retailer?.shop_url && (
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
                    <ButtonSecondary onClick={() => navigate('/retailer/profile/edit')}>
                      Edit Profile
                    </ButtonSecondary>
                    <ButtonSecondary icon={<ExternalLink className="w-4 h-4" />} iconPosition="right">
                      Share Profile
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
                  <span className="font-medium">{totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium">{pendingOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-medium">{thisMonthOrders}</span>
                </div>
              </div>
            </InfoCard>

            {/* Favorite Publishers - placeholder for now */}
            <div className="card-neesh">
              <button
                onClick={() => setPublishersExpanded(!publishersExpanded)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-display font-semibold text-foreground">
                  Favorite Publishers
                </h3>
                {publishersExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              
              {publishersExpanded && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground italic">
                    No favorite publishers yet. Browse the catalogue to discover publishers.
                  </p>
                </div>
              )}
            </div>

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
                          <MagazineCoverImage
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
