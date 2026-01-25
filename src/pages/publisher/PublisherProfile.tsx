import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronDown, ChevronUp, Instagram, Globe, Share2, Camera, Loader2 } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, ButtonSecondary, ShareProfileModal } from "@/components/neesh";
import { useFileUpload } from "@/hooks/useFileUpload";
import { toast } from "sonner";
import { slugify } from "@/lib/slugify";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { useMagazines } from "@/hooks/useMagazines";



export const PublisherProfile = () => {
  const navigate = useNavigate();
  const [titlesExpanded, setTitlesExpanded] = useState(true);
  const [retailersExpanded, setRetailersExpanded] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { publisher, isLoading: profileLoading } = usePublisherProfile();
  const { magazines, isLoading: magazinesLoading } = useMagazines({ 
    publisherId: publisher?.id 
  });

  // Generate slug from publisher name
  const publisherSlug = publisher?.company_name ? slugify(publisher.company_name) : "";

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

  const displayAvatar = avatarUrl || "/placeholder.svg";
  const isLoading = profileLoading || (publisher && magazinesLoading);

  if (isLoading) {
    return (
      <PublisherLayout>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PublisherLayout>
    );
  }

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
                      alt={publisher?.company_name || "Profile"}
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
                {publisher?.company_name || "New Publisher"}
              </h1>

              {publisher?.website_url && (
                <a
                  href={publisher.website_url.startsWith('http') ? publisher.website_url : `https://${publisher.website_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body text-accent hover:underline mb-1"
                >
                  {publisher.website_url.replace(/^https?:\/\//, '')}
                </a>
              )}

              <p className="text-body text-muted-foreground mb-4">
                {/* Contact Person not in DB schema yet */}
              </p>

              <p className="text-body text-foreground text-center md:text-left mb-4 max-w-md whitespace-pre-wrap">
                {publisher?.description || "No description added yet."}
              </p>

              <div className="flex items-center gap-2 text-muted-foreground mb-6">
                <MapPin className="w-4 h-4" />
                <span className="text-body">Global</span>
              </div>

              {/* Social Icons */}
              {publisher?.instagram_handle && (
                <div className="flex items-center gap-4 mb-6">
                  <a 
                    href={`https://instagram.com/${publisher.instagram_handle.replace('@', '')}`} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <Instagram className="w-5 h-5 text-foreground" />
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 w-full max-w-sm">
                <ButtonSecondary fullWidth onClick={() => navigate("/publisher/settings")}>
                  Edit Profile
                </ButtonSecondary>
                <ButtonSecondary 
                  fullWidth 
                  icon={<Share2 className="w-4 h-4" />}
                  onClick={() => setShowShareModal(true)}
                  disabled={!publisher?.company_name}
                >
                  Share Profile
                </ButtonSecondary>
              </div>

              {/* Share Modal */}
              <ShareProfileModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                publisherName={publisher?.company_name || ""}
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
                amount={publisher?.total_sales || 0}
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
                  {magazines.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-2">No titles added yet.</p>
                  ) : (
                    magazines.map((title) => (
                      <div
                        key={title.id}
                        onClick={() => navigate(`/publisher/titles/${title.id}/edit`)}
                        className="flex-shrink-0 w-20 cursor-pointer group"
                      >
                        <div className="aspect-[3/4] rounded bg-secondary overflow-hidden mb-1">
                          <img
                            src={title.cover_image_url || "/placeholder.svg"}
                            alt={title.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <p className="text-caption text-muted-foreground truncate">{title.title}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* My Retailers - Placeholder for future implementation */}
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
                 <p className="text-muted-foreground text-sm">
                   Retailer list coming soon
                 </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherProfile;
