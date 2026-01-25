import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Copy, MessageCircle, AlertCircle, Minus, Plus } from "lucide-react";
import { RetailerLayout, QuantitySelector, useCart, useWishlistContext } from "@/components/retailer";
import { BackNavigation, MagazineCard, ButtonSecondary, ButtonPrimary, EmptyState } from "@/components/neesh";
import { LoadingScreen } from "@/components/shared";
import { PriceDisplay } from "@/components/ui/price-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useMagazine } from "@/hooks/useMagazine";
import { useMagazines } from "@/hooks/useMagazines";
import { ImagePlaceholder } from "@/components/shared/ImagePlaceholder";

export const RetailerTitleDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlistContext();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const isSaved = id ? isInWishlist(id) : false;

  const handleToggleSave = () => {
    if (!id) return;
    const wasSaved = isInWishlist(id);
    toggleWishlist(id);
    toast.success(wasSaved ? "Removed from wishlist" : "Saved to wishlist");
  };

  const { magazine, isLoading, error } = useMagazine(id || '');
  const { magazines: similarMagazines } = useMagazines({ limit: 4, status: 'active' });

  // Quantity handlers with stock validation
  const maxQuantity = magazine?.inventory_count || 999;

  const handleQuantityChange = useCallback((value: string) => {
    const parsed = parseInt(value, 10);
    if (value === '') {
      // Allow empty during typing
      setQuantity(0);
      return;
    }
    if (isNaN(parsed) || parsed < 1) {
      setQuantity(1);
      return;
    }
    if (parsed > maxQuantity) {
      setQuantity(maxQuantity);
      toast.info(`Only ${maxQuantity} copies available`);
      return;
    }
    setQuantity(parsed);
  }, [maxQuantity]);

  const handleQuantityBlur = useCallback(() => {
    if (quantity < 1) {
      setQuantity(1);
    }
  }, [quantity]);

  const incrementQuantity = useCallback(() => {
    if (quantity < maxQuantity) {
      setQuantity(q => q + 1);
    } else {
      toast.info(`Only ${maxQuantity} copies available`);
    }
  }, [quantity, maxQuantity]);

  const decrementQuantity = useCallback(() => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  }, [quantity]);

  if (isLoading) {
    return (
      <RetailerLayout>
        <LoadingScreen message="Loading magazine details..." />
      </RetailerLayout>
    );
  }

  if (error || !magazine) {
    return (
      <RetailerLayout>
        <div className="p-6">
          <EmptyState
            icon={<AlertCircle className="w-12 h-12 text-destructive" />}
            title="Magazine not found"
            description={error || "This magazine doesn't exist or has been removed"}
            action={<ButtonPrimary onClick={() => navigate("/retailer")}>Back to Catalogue</ButtonPrimary>}
          />
        </div>
      </RetailerLayout>
    );
  }

  // Build images array from available URLs
  const images = [
    magazine.cover_image_url || "/placeholder.svg",
  ].filter(Boolean);

  const wspPrice = magazine.wholesale_price || magazine.price;
  const msrpPrice = magazine.suggested_retail_price || null;

  const handleAddToCart = () => {
    addToCart({
      magazineId: magazine.id,
      title: magazine.title,
      coverImage: magazine.cover_image_url || "/placeholder.svg",
      publisher: magazine.publisher?.company_name || "Unknown Publisher",
      issue: magazine.issue_number || "",
      price: wspPrice,
      quantity,
    });
    toast.success(`${quantity}x ${magazine.title} added to your cart`);
  };

  const handleCopyInfo = () => {
    navigator.clipboard.writeText(`${magazine.title} - WSP: $${wspPrice.toFixed(2)}`);
    toast.success("Copied to clipboard");
  };

  // Filter out current magazine from similar titles
  const filteredSimilar = similarMagazines.filter(m => m.id !== magazine.id).slice(0, 4);

  return (
    <RetailerLayout>
      <BackNavigation
        title="Title"
        onBack={() => navigate("/retailer")}
      />

      <div className="px-4 md:px-6 pb-12">
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Left Column - Images */}
          <div>
            {/* Main Image */}
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-secondary mb-4">
              {!images[selectedImageIndex] || images[selectedImageIndex] === "/placeholder.svg" ? (
                 <div className="absolute inset-0">
                    <ImagePlaceholder />
                 </div>
              ) : (
                <img
                  src={images[selectedImageIndex]}
                  alt={magazine.title}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImageIndex(prev => Math.max(0, prev - 1))}
                    disabled={selectedImageIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedImageIndex(prev => Math.min(images.length - 1, prev + 1))}
                    disabled={selectedImageIndex === images.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Row */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`
                      flex-shrink-0 w-16 h-20 rounded-md overflow-hidden border-2 transition-all
                      ${selectedImageIndex === index ? 'border-accent' : 'border-transparent'}
                    `}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <ButtonSecondary 
                icon={<Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />}
                onClick={handleToggleSave}
              >
                {isSaved ? 'Saved' : 'Save'}
              </ButtonSecondary>
              <ButtonSecondary icon={<Copy className="w-4 h-4" />} onClick={handleCopyInfo}>
                Copy info
              </ButtonSecondary>
              <ButtonSecondary icon={<MessageCircle className="w-4 h-4" />}>
                Contact Publisher
              </ButtonSecondary>
            </div>
          </div>

          {/* Right Column - Details */}
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground mb-2">
              {magazine.title}
            </h1>
            <p className="text-muted-foreground mb-6">
              {magazine.publisher?.company_name || "Unknown Publisher"} · {magazine.issue_number || ""}
            </p>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {magazine.issue_frequency && (
                <div>
                  <span className="text-caption text-muted-foreground">Frequency</span>
                  <p className="font-medium">{magazine.issue_frequency}</p>
                </div>
              )}
              {magazine.specs && (
                <div>
                  <span className="text-caption text-muted-foreground">Specs</span>
                  <p className="font-medium">{magazine.specs}</p>
                </div>
              )}
              {magazine.issue_number && (
                <div>
                  <span className="text-caption text-muted-foreground">Issue</span>
                  <p className="font-medium">{magazine.issue_number}</p>
                </div>
              )}
              {magazine.category && (
                <div>
                  <span className="text-caption text-muted-foreground">Category</span>
                  <p className="font-medium">{magazine.category}</p>
                </div>
              )}
              {magazine.publication_type && (
                <div>
                  <span className="text-caption text-muted-foreground">Type</span>
                  <p className="font-medium">{magazine.publication_type}</p>
                </div>
              )}
              <div>
                <span className="text-caption text-muted-foreground">In Stock</span>
                <p className="font-medium">{magazine.inventory_count || 0} copies</p>
              </div>
            </div>

            {/* Description */}
            {magazine.description && (
              <div className="mb-8">
                {magazine.description.split('\n\n').map((para, index) => (
                  <p key={index} className="text-muted-foreground mb-4 last:mb-0">
                    {para}
                  </p>
                ))}
              </div>
            )}

            {/* Price Section with Quantity */}
            <div className="card-neesh mb-6 space-y-4">
              <p className="text-caption text-muted-foreground">Pricing</p>
              
              <PriceDisplay
                wholesalePrice={wspPrice}
                retailPrice={msrpPrice}
                quantity={quantity}
                showMargin={true}
                showTotal={true}
                layout="stacked"
                size="lg"
              />

              {/* Quantity Controls */}
              <div className="pt-4 border-t border-border">
                <label className="text-caption text-muted-foreground block mb-2">Quantity</label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  
                  <Input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity === 0 ? '' : quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    onBlur={handleQuantityBlur}
                    className="w-20 text-center"
                    aria-label="Quantity"
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={incrementQuantity}
                    disabled={quantity >= maxQuantity}
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Add to Cart */}
            <ButtonPrimary fullWidth onClick={handleAddToCart}>
              Add To Cart
            </ButtonPrimary>
          </div>
        </div>

        {/* Similar Titles */}
        {filteredSimilar.length > 0 && (
          <section>
            <h2 className="font-display font-semibold text-xl text-foreground mb-6">
              Explore similar titles
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {filteredSimilar.map((mag) => (
                <MagazineCard
                  key={mag.id}
                  coverImage={mag.cover_image_url || "/placeholder.svg"}
                  title={mag.title}
                  publisher={mag.publisher?.company_name || "Unknown"}
                  region=""
                  price={mag.wholesale_price || mag.price}
                  retailPrice={mag.suggested_retail_price}
                  onClick={() => navigate(`/retailer/catalogue/${mag.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </RetailerLayout>
  );
};
