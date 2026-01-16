import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Instagram, Globe, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { RetailerLayout } from "@/components/retailer";
import { BackNavigation, ButtonSecondary, InfoCard } from "@/components/neesh";

const mockProfile = {
  avatar: "/placeholder.svg",
  storeName: "Powell's City of Books",
  website: "https://powells.com",
  contactPerson: "Emily Richardson",
  description: "Powell's City of Books is the largest independent new and used bookstore in the world. Founded in 1971, we occupy an entire city block in Portland, Oregon, and house more than a million books. Our curated magazine section features the finest independent publications from around the globe.",
  location: "Portland, OR",
  storeTypes: ["Independent Bookstore", "Magazine Retailer"],
  stats: {
    totalOrders: 47,
    pendingOrders: 3,
    thisMonth: 8,
  },
  favoritePublishers: [
    { id: "1", name: "Weird Walk" },
    { id: "2", name: "Apartamento" },
    { id: "3", name: "MacGuffin" },
    { id: "4", name: "Kinfolk" },
  ],
  bookmarkedTitles: [
    { id: "1", title: "Weird Walk Issue 8", coverImage: "/placeholder.svg" },
    { id: "2", title: "Apartamento #32", coverImage: "/placeholder.svg" },
    { id: "3", title: "Kinfolk Issue 48", coverImage: "/placeholder.svg" },
    { id: "4", title: "Cabana Issue 21", coverImage: "/placeholder.svg" },
    { id: "5", title: "Monocle Issue 172", coverImage: "/placeholder.svg" },
  ],
};

export const RetailerProfile = () => {
  const navigate = useNavigate();
  const [publishersExpanded, setPublishersExpanded] = useState(true);
  const [bookmarksExpanded, setBookmarksExpanded] = useState(true);

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
                <div className="w-24 h-24 rounded-full bg-secondary flex-shrink-0 overflow-hidden">
                  <img
                    src={mockProfile.avatar}
                    alt={mockProfile.storeName}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 className="font-display font-bold text-2xl text-foreground mb-2">
                    {mockProfile.storeName}
                  </h1>

                  <a
                    href={mockProfile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline mb-2"
                  >
                    <Globe className="w-4 h-4" />
                    {mockProfile.website.replace('https://', '')}
                  </a>

                  <p className="text-muted-foreground mb-2">
                    Contact: {mockProfile.contactPerson}
                  </p>

                  <p className="text-muted-foreground mb-4">
                    {mockProfile.description}
                  </p>

                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <MapPin className="w-4 h-4" />
                    <span>{mockProfile.location}</span>
                  </div>

                  {/* Store Type Tags */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {mockProfile.storeTypes.map((type) => (
                      <span
                        key={type}
                        className="px-3 py-1 bg-secondary text-foreground text-sm rounded-full"
                      >
                        {type}
                      </span>
                    ))}
                  </div>

                  {/* Social Icons */}
                  <div className="flex gap-3 mb-6">
                    <button className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors">
                      <Instagram className="w-5 h-5" />
                    </button>
                    <button className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors">
                      <Globe className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <ButtonSecondary>Edit Profile</ButtonSecondary>
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
                  <span className="font-medium">{mockProfile.stats.totalOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium">{mockProfile.stats.pendingOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">This Month</span>
                  <span className="font-medium">{mockProfile.stats.thisMonth}</span>
                </div>
              </div>
            </InfoCard>

            {/* Favorite Publishers */}
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
                <div className="mt-4 flex flex-wrap gap-2">
                  {mockProfile.favoritePublishers.map((pub) => (
                    <span
                      key={pub.id}
                      className="px-3 py-1 bg-secondary text-foreground text-sm rounded-full cursor-pointer hover:bg-secondary/80"
                    >
                      {pub.name}
                    </span>
                  ))}
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
                  Bookmarked Titles
                </h3>
                {bookmarksExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              
              {bookmarksExpanded && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {mockProfile.bookmarkedTitles.map((title) => (
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
            </div>
          </div>
        </div>
      </div>
    </RetailerLayout>
  );
};
