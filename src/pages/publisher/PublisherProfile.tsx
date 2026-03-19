import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronDown, ChevronUp, Share2, Camera, Loader2, AlertCircle } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, WalletDisplay, ButtonSecondary, ShareProfileModal } from "@/components/neesh";
import { SocialLinks } from "@/components/ui/social-links";
import { useFileUpload } from "@/hooks/useFileUpload";
import { usePublisherProfile } from "@/hooks/usePublisherProfile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { slugify } from "@/lib/slugify";
import { useMagazines } from "@/hooks/useMagazines";

export const PublisherProfile = () => {
  const navigate = useNavigate();
  const [titlesExpanded, setTitlesExpanded] = useState(true);
  const [retailersExpanded, setRetailersExpanded] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { publisher, isLoading: profileLoading } = usePublisherProfile();
  const { magazines, isLoading: magazinesLoading } = useMagazines({
    publisherId: publisher?.id,
  });

  // FIX: avatar lives in `profiles`, not `publishers`.
  // Load it directly from the correct table on mount.
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      });
  }, [user?.id]);

  const publisherSlug = slugify(publisher?.company_name || "");

  const avatarUpload = useFileUpload({
    bucket: "magazine-assets",
    folder: "avatars",
    maxSizeMB: 5,
    onUploadComplete: async (url) => {
      setAvatarUrl(url);
      if (user?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("user_id", user.id);
        if (error) console.error("Failed to save avatar URL:", error);
      }
      toast.success("Profile photo updated successfully");
    },
    onError: (error) => toast.error(error),
  });

  const handleTransfer = () => navigate("/publisher/transfers");
  const triggerAvatarUpload = () => fileInputRef.current?.click();
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) avatarUpload.upload(file);
    e.target.value = "";
  };

  // Sort: in-stock with cover image first, then in-stock no image, then out-of-stock
  const sortedMagazines = [...magazines].sort((a, b) => {
    const score = (m: typeof magazines[0]) =>
      (m.cover_image_url ? 2 : 0) + ((m.inventory_count ?? 0) > 0 ? 1 : 0);
    return score(b) - score(a);
  });

  // Profile completeness check
  const missingFields: string[] = [];
  if (!avatarUrl) missingFields.push("profile photo");
  if (!publisher?.description) missingFields.push("description");
  if (!publisher?.instagram_handle) missingFields.push("Instagram handle");
  const profileIncomplete = missingFields.length > 0;

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
      <BackNavigation title="My Profile" onBack={() => navigate("/publisher")} />

      <div className="px-4 md:px-6 pb-8">

        {/* Profile completeness nudge */}
        {profileIncomplete && (
          <div className="flex items-start gap-3 mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Your profile is incomplete</p>
              <p className="text-sm mt-0.5">
                Add your {missingFields.join(", ")} so retailers can learn about you.{" "}
                <button
                  className="underline font-medium"
                  onClick={() => navigate("/publisher/settings")}
                >
                  Edit profile
                </button>
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="flex flex-col items-center md:items-start">
              {/* Avatar */}
              <div
                className="relative group cursor-pointer mb-4"
                onClick={triggerAvatarUpload}
              >
                <div className="w-32 h-32 rounded-full bg-secondary overflow-hidden">
                  {avatarUpload.isUploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={publisher?.company_name || "Profile"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
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
                
                  href={publisher.website_url.startsWith("http") ? publisher.website_url : `https://${publisher.website_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body text-accent hover:underline mb-1"
                >
                  {publisher.website_url.replace(/^https?:\/\//, "")}
                </a>
              )}

              <p className="text-body text-foreground text-center md:text-left mb-4 max-w-md whitespace-pre-wrap">
                {publisher?.description || (
                  <span className="text-muted-foreground italic">No description added yet.</span>
                )}
              </p>

              <div className="flex items-center gap-2 text-muted-foreground mb-6">
                <MapPin className="w-4 h-4" />
                <span className="text-body">Global</span>
              </div>

              <SocialLinks
                instagramHandle={publisher?.instagram_handle || ""}
                websiteUrl={publisher?.website_url || ""}
                layout="inline"
                showLabels={true}
                size="md"
                className="mb-6"
              />

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
                <h3 className="font-display font-semibold text-heading text-foreground">
                  My Titles
                  {sortedMagazines.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({sortedMagazines.length})
                    </span>
                  )}
                </h3>
                {titlesExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {titlesExpanded && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {sortedMagazines.length === 0 ? (
                    <p className="text-muted-foreground text-sm p-2">No titles added yet.</p>
                  ) : (
                    sortedMagazines.map((title) => {
                      const outOfStock = (title.inventory_count ?? 0) === 0;
                      const hasImage = !!title.cover_image_url;
                      return (
                        <div
                          key={title.id}
                          onClick={() => navigate(`/publisher/titles/${title.id}/edit`)}
                          className="flex-shrink-0 w-20 cursor-pointer group relative"
                        >
                          <div className="aspect-[3/4] rounded bg-secondary overflow-hidden mb-1 relative">
                            {hasImage ? (
                              <img
                                src={title.cover_image_url!}
                                alt={title.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-secondary">
                                <Camera className="w-5 h-5 text-muted-foreground/40" />
                              </div>
                            )}
                            {outOfStock && (
                              <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-1">
                                <span className="text-white text-[9px] font-medium leading-tight px-1 text-center">
                                  Out of stock
                                </span>
                              </div>
                            )}
                          </div>
                          <p className="text-caption text-muted-foreground truncate">{title.title}</p>
                          {!hasImage && (
                            <p className="text-[9px] text-amber-600 truncate">Add cover</p>
                          )}
                        </div>
                      );
                    })
                  )}
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
                <p className="text-muted-foreground text-sm">Retailer list coming soon</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherProfile;