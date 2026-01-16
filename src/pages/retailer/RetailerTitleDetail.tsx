import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Bookmark, Copy, MessageCircle } from "lucide-react";
import { RetailerLayout, QuantitySelector, useCart } from "@/components/retailer";
import { BackNavigation, MagazineCard, ButtonSecondary, ButtonPrimary } from "@/components/neesh";
import { toast } from "@/hooks/use-toast";

const mockMagazine = {
  id: "1",
  title: "Weird Walk Issue 8",
  publisher: "Weird Walk",
  issue: "Issue 8",
  year: "2024",
  pages: "48",
  dimensions: "148mm x 210mm",
  sku: "WW-008",
  coverType: "Soft Cover",
  genre: "Folklore, Horror",
  description: `Weird Walk is a zine about walking, the ritual landscape, folklore and folk horror. Each issue explores the strange and ancient places of the British Isles, from standing stones to holy wells, from sacred groves to haunted lanes.

This issue features articles on the prehistoric landscape of the Marlborough Downs, the folklore of the Sussex Weald, and a walking guide to the ancient trackways of Dartmoor. We also delve into the world of folk horror cinema and music, with reviews and interviews.

Whether you're a seasoned walker or an armchair traveler, Weird Walk invites you to explore the weird and wonderful landscape of these islands.`,
  wspPrice: 8.81,
  msrpPrice: 20.00,
  images: [
    "/placeholder.svg",
    "/placeholder.svg",
    "/placeholder.svg",
    "/placeholder.svg",
    "/placeholder.svg",
  ],
};

const mockSimilarTitles = [
  { id: "10", coverImage: "/placeholder.svg", title: "Folklore Journal #5", publisher: "Folklore Press", region: "UK", price: 12.00 },
  { id: "11", coverImage: "/placeholder.svg", title: "Haunted Lands", publisher: "Ghost Stories", region: "Ireland", price: 15.00 },
  { id: "12", coverImage: "/placeholder.svg", title: "Sacred Stones", publisher: "Ancient Ways", region: "Wales", price: 18.00 },
  { id: "13", coverImage: "/placeholder.svg", title: "Walking Britain", publisher: "Trail Press", region: "UK", price: 14.00 },
];

export const RetailerTitleDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addToCart } = useCart();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const margin = mockMagazine.msrpPrice - mockMagazine.wspPrice;

  const handleAddToCart = () => {
    addToCart({
      magazineId: mockMagazine.id,
      title: mockMagazine.title,
      coverImage: mockMagazine.images[0],
      publisher: mockMagazine.publisher,
      issue: mockMagazine.issue,
      price: mockMagazine.wspPrice,
      quantity,
    });
    toast({
      title: "Added to cart",
      description: `${quantity}x ${mockMagazine.title} added to your cart`,
    });
  };

  const handleCopyInfo = () => {
    navigator.clipboard.writeText(`${mockMagazine.title} - ${mockMagazine.publisher} - WSP: $${mockMagazine.wspPrice}`);
    toast({ title: "Copied to clipboard" });
  };

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
              <img
                src={mockMagazine.images[selectedImageIndex]}
                alt={mockMagazine.title}
                className="w-full h-full object-cover"
              />
              
              {/* Navigation Arrows */}
              <button
                onClick={() => setSelectedImageIndex(prev => Math.max(0, prev - 1))}
                disabled={selectedImageIndex === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSelectedImageIndex(prev => Math.min(mockMagazine.images.length - 1, prev + 1))}
                disabled={selectedImageIndex === mockMagazine.images.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Thumbnail Row */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {mockMagazine.images.map((img, index) => (
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

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <ButtonSecondary icon={<Bookmark className="w-4 h-4" />}>
                Bookmark
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
              {mockMagazine.title}
            </h1>
            <p className="text-muted-foreground mb-6">
              {mockMagazine.publisher} · {mockMagazine.issue}
            </p>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <span className="text-caption text-muted-foreground">Year</span>
                <p className="font-medium">{mockMagazine.year}</p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">Pages</span>
                <p className="font-medium">{mockMagazine.pages}</p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">Dimensions</span>
                <p className="font-medium">{mockMagazine.dimensions}</p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">SKU</span>
                <p className="font-medium">{mockMagazine.sku}</p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">Cover type</span>
                <p className="font-medium">{mockMagazine.coverType}</p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">Genre</span>
                <p className="font-medium">{mockMagazine.genre}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              {mockMagazine.description.split('\n\n').map((para, index) => (
                <p key={index} className="text-muted-foreground mb-4 last:mb-0">
                  {para}
                </p>
              ))}
            </div>

            {/* Price Section */}
            <div className="card-neesh mb-6">
              <p className="text-caption text-muted-foreground mb-2">Price</p>
              <div className="space-y-1">
                <p className="font-display font-bold text-2xl text-accent">
                  ${mockMagazine.wspPrice.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">WSP</span>
                </p>
                <p className="text-muted-foreground">
                  ${mockMagazine.msrpPrice.toFixed(2)} <span className="text-sm">MSRP</span>
                </p>
                <p className="text-green-600 font-medium">
                  ${margin.toFixed(2)} <span className="text-sm font-normal">MY MARGIN</span>
                </p>
              </div>
            </div>

            {/* Add to Cart */}
            <div className="flex items-center gap-4">
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={100}
              />
              <ButtonPrimary fullWidth onClick={handleAddToCart}>
                Add To Cart
              </ButtonPrimary>
            </div>
          </div>
        </div>

        {/* Similar Titles */}
        <section>
          <h2 className="font-display font-semibold text-xl text-foreground mb-6">
            Explore similar titles
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {mockSimilarTitles.map((mag) => (
              <MagazineCard
                key={mag.id}
                coverImage={mag.coverImage}
                title={mag.title}
                publisher={mag.publisher}
                region={mag.region}
                price={mag.price}
                onClick={() => navigate(`/retailer/catalogue/${mag.id}`)}
              />
            ))}
          </div>
        </section>
      </div>
    </RetailerLayout>
  );
};
