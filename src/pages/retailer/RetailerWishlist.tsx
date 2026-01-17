import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Trash2, ShoppingCart, AlertCircle } from "lucide-react";
import { RetailerLayout, useCart } from "@/components/retailer";
import { useWishlistContext } from "@/components/retailer/WishlistContext";
import { BackNavigation, MagazineCard, EmptyState, ButtonPrimary, ButtonSecondary, Modal } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { useMagazines } from "@/hooks/useMagazines";
import { toast } from "sonner";

export const RetailerWishlist = () => {
  const navigate = useNavigate();
  const { wishlistIds, removeFromWishlist, clearWishlist, wishlistCount } = useWishlistContext();
  const { addToCart } = useCart();
  const [showClearModal, setShowClearModal] = useState(false);

  // Fetch all magazines to get details for wishlist items
  const { magazines, isLoading } = useMagazines({ status: 'active' });

  // Filter magazines to only include wishlist items
  const wishlistMagazines = magazines.filter((mag) => wishlistIds.includes(mag.id));

  const handleRemoveFromWishlist = (id: string) => {
    removeFromWishlist(id);
    toast.success("Removed from wishlist");
  };

  const handleAddAllToCart = () => {
    wishlistMagazines.forEach((mag) => {
      addToCart({
        magazineId: mag.id,
        title: mag.title,
        coverImage: mag.cover_image_url || "/placeholder.svg",
        publisher: mag.publisher?.company_name || "Unknown Publisher",
        issue: mag.issue_number || "",
        price: mag.wholesale_price || mag.price,
        quantity: 1,
      });
    });
    toast.success(`Added ${wishlistMagazines.length} items to cart`);
  };

  const handleClearAll = () => {
    clearWishlist();
    setShowClearModal(false);
    toast.success("Wishlist cleared");
  };

  if (isLoading) {
    return (
      <RetailerLayout>
        <LoadingScreen message="Loading saved titles..." />
      </RetailerLayout>
    );
  }

  return (
    <RetailerLayout>
      <BackNavigation
        title="Saved Titles"
        onBack={() => navigate("/retailer")}
      />

      <div className="px-4 md:px-6 pb-24 md:pb-12">
        {wishlistCount === 0 ? (
          <EmptyState
            icon={<Heart className="w-12 h-12" />}
            title="No saved titles yet"
            description="Tap the bookmark icon on any magazine to save it for later"
            action={
              <ButtonPrimary onClick={() => navigate("/retailer")}>
                Browse Catalogue
              </ButtonPrimary>
            }
          />
        ) : (
          <>
            {/* Bulk Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <p className="text-body text-muted-foreground">
                <span className="font-semibold text-foreground">{wishlistCount}</span> saved {wishlistCount === 1 ? 'title' : 'titles'}
              </p>
              
              <div className="flex items-center gap-3">
                <ButtonSecondary 
                  icon={<ShoppingCart className="w-4 h-4" />}
                  onClick={handleAddAllToCart}
                >
                  Add All to Cart
                </ButtonSecondary>
                <button
                  onClick={() => setShowClearModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </button>
              </div>
            </div>

            {/* Wishlist Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {wishlistMagazines.map((mag) => (
                <MagazineCard
                  key={mag.id}
                  coverImage={mag.cover_image_url || "/placeholder.svg"}
                  title={mag.title}
                  publisher={mag.publisher?.company_name || "Unknown Publisher"}
                  region={mag.category || undefined}
                  price={mag.wholesale_price || mag.price}
                  onClick={() => navigate(`/retailer/catalogue/${mag.id}`)}
                  onBookmark={() => handleRemoveFromWishlist(mag.id)}
                  isBookmarked={true}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Wishlist"
        footer={
          <>
            <ButtonSecondary onClick={() => setShowClearModal(false)}>
              Cancel
            </ButtonSecondary>
            <ButtonPrimary onClick={handleClearAll}>
              Clear All
            </ButtonPrimary>
          </>
        }
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-destructive/10">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="text-body text-foreground mb-1">
              Are you sure you want to clear your wishlist?
            </p>
            <p className="text-caption text-muted-foreground">
              This will remove all {wishlistCount} saved titles. This action cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </RetailerLayout>
  );
};

export default RetailerWishlist;
