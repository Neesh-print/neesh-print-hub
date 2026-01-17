import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronDown, ChevronUp, Instagram, Globe, Share2, Camera, Loader2 } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, ButtonSecondary, ShareProfileModal } from "@/components/neesh";
import { useFileUpload } from "@/hooks/useFileUpload";
import { toast } from "sonner";
import { slugify } from "@/lib/slugify";

const mockProfile = {
  avatar: "/placeholder.svg",
  publicationName: "Kinfolk Publishing",
  websiteUrl: "kinfolk.com",
  contactPerson: "Sarah Mitchell",
  bio: "Kinfolk is a slow lifestyle magazine founded in 2011. We celebrate the simple things and the artful pursuit of beautiful things. Our content spans across art, design, food, and culture with a focus on mindful living.",
  region: "Portland, Oregon",
  socialLinks: {
    instagram: "kinfolk",
    twitter: "kinfolk",
    tiktok: "kinfolk",
    medium: "kinfolk",
    substack: "kinfolk"
  }
};

const mockTitles = [
  { id: "1", title: "Issue 45", image: "/placeholder.svg" },
  { id: "2", title: "Issue 44", image: "/placeholder.svg" },
  { id: "3", title: "Issue 43", image: "/placeholder.svg" },
  { id: "4", title: "Issue 42", image: "/placeholder.svg" },
];

const mockRetailers = [
  { id: "1", name: "Brooklyn Books" },
  { id: "2", name: "Powell's Books" },
  { id: "3", name: "The Last Bookstore" },
  { id: "4", name: "Strand Bookstore" },
  { id: "5", name: "City Lights" },
];

export const PublisherProfile = () => {
  const navigate = useNavigate();
  const [titlesExpanded, setTitlesExpanded] = useState(true);
  const [retailersExpanded, setRetailersExpanded] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate slug from publisher name
  const publisherSlug = slugify(mockProfile.publicationName);

  const avatarUpload = useFileUpload({
    bucket: 'magazine-assets',
    folder: 'avatars',
    maxSizeMB: 5,
    onUploadComplete: (url) => {
      setAvatarUrl(url);
      toast.success("Profile photo updated successfully");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleTransfer = () => {
    navigate("/publisher/transfers");
  };

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      avatarUpload.upload(file);
    }
    // Reset input to allow re-selecting the same file
    e.target.value = '';
  };

  const displayAvatar = avatarUrl || mockProfile.avatar;

  return (
    <PublisherLayout>
      <BackNavigation
        title="My Profile"
        onBack={() => navigate("/publisher")}
      />

      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Profile Info */}
          <div className="space-y-6">
            {/* Avatar and Basic Info */}
            <div className="flex flex-col items-center md:items-start">
              {/* Clickable Avatar */}
              <div 
                className="relative group cursor-pointer mb-4"
                onClick={triggerAvatarUpload}
              >
                <div className="w-32 h-32 rounded-full bg-secondary overflow-hidden">
                  {avatarUpload.isUploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={displayAvatar}
                      alt={mockProfile.publicationName}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              <p className="text-xs text-muted-foreground mb-2">Click to change photo</p>

              <h1 className="font-display font-bold text-display-sm text-foreground mb-2">
                {mockProfile.publicationName}
              </h1>

              <a
                href={`https://${mockProfile.websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-accent hover:underline mb-1"
              >
                {mockProfile.websiteUrl}
              </a>

              <p className="text-body text-muted-foreground mb-4">
                {mockProfile.contactPerson}
              </p>

              <p className="text-body text-foreground text-center md:text-left mb-4 max-w-md">
                {mockProfile.bio}
              </p>

              <div className="flex items-center gap-2 text-muted-foreground mb-6">
                <MapPin className="w-4 h-4" />
                <span className="text-body">{mockProfile.region}</span>
              </div>

              {/* Social Icons */}
              <div className="flex items-center gap-4 mb-6">
                <a href="#" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <Instagram className="w-5 h-5 text-foreground" />
                </a>
                <a href="#" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a href="#" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                </a>
                <a href="#" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <Globe className="w-5 h-5 text-foreground" />
                </a>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full max-w-sm">
                <ButtonSecondary fullWidth onClick={() => navigate("/publisher/profile/edit")}>
                  Edit Profile
                </ButtonSecondary>
                <ButtonSecondary 
                  fullWidth 
                  icon={<Share2 className="w-4 h-4" />}
                  onClick={() => setShowShareModal(true)}
                >
                  Share Profile
                </ButtonSecondary>
              </div>

              {/* Share Modal */}
              <ShareProfileModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                publisherName={mockProfile.publicationName}
                slug={publisherSlug}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Account Balance */}
            <div className="card-neesh">
              <WalletDisplay
                label="Account Balance"
                amount={2720.00}
                actionLabel="Transfer"
                onAction={handleTransfer}
              />
            </div>

            {/* My Titles */}
            <div className="card-neesh">
              <button
                onClick={() => setTitlesExpanded(!titlesExpanded)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="font-display font-semibold text-heading text-foreground">My Titles</h3>
                {titlesExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {titlesExpanded && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {mockTitles.map((title) => (
                    <div
                      key={title.id}
                      onClick={() => navigate(`/publisher/titles/${title.id}/edit`)}
                      className="flex-shrink-0 w-20 cursor-pointer group"
                    >
                      <div className="aspect-[3/4] rounded bg-secondary overflow-hidden mb-1">
                        <img
                          src={title.image}
                          alt={title.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <p className="text-caption text-muted-foreground truncate">{title.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Retailers */}
            <div className="card-neesh">
              <button
                onClick={() => setRetailersExpanded(!retailersExpanded)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="font-display font-semibold text-heading text-foreground">My Retailers</h3>
                {retailersExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {retailersExpanded && (
                <div className="flex flex-wrap gap-2">
                  {mockRetailers.map((retailer) => (
                    <span
                      key={retailer.id}
                      className="px-3 py-1.5 bg-secondary rounded-full text-caption text-foreground"
                    >
                      {retailer.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherProfile;
