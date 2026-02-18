import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Instagram, Globe, ExternalLink, Lock, Loader2 } from "lucide-react";
import { ButtonPrimary, ButtonSecondary, Modal, Logo } from "@/components/neesh";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PublicRetailer {
  id: string;
  name: string;
  bio: string | null;
  location: string;
  website: string | null;
  avatar: string | null;
  memberSince: string;
  socialLinks: {
    instagram: string | null;
  };
}

export const RetailerPublicProfile = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [retailer, setRetailer] = useState<PublicRetailer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRetailerData = async () => {
      if (!slug) return;

      setIsLoading(true);
      try {
        let retData, retError;

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

        if (isUuid) {
          const result = await supabase
            .from('retailers')
            .select('*, users!inner(created_at, profiles(avatar_url, bio))')
            .eq('id', slug)
            .maybeSingle();
          retData = result.data;
          retError = result.error;
        } else {
          const fuzzyName = slug.replace(/-/g, ' ');
          const result = await supabase
            .from('retailers')
            .select('*, users!inner(created_at, profiles(avatar_url, bio))')
            .ilike('shop_name', fuzzyName)
            .maybeSingle();
          retData = result.data;
          retError = result.error;
        }

        if (retError) throw retError;
        if (!retData) throw new Error("Retailer not found");

        const profile = retData.users?.profiles?.[0] || retData.users?.profiles;

        setRetailer({
          id: retData.id,
          name: retData.shop_name || "Untitled Store",
          bio: profile?.bio || null,
          location: [retData.city, retData.state].filter(Boolean).join(", ") || "United States",
          website: retData.shop_url ? retData.shop_url.replace(/^https?:\/\//, '') : null,
          avatar: profile?.avatar_url || null,
          memberSince: new Date(retData.created_at || new Date()).getFullYear().toString(),
          socialLinks: {
            instagram: retData.instagram_handle,
          }
        });

      } catch (error) {
        console.error("Error fetching retailer:", error);
        toast.error("Could not load store profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRetailerData();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!retailer) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-bold mb-2">Store Not Found</h1>
        <ButtonPrimary onClick={() => navigate("/")}>Go Home</ButtonPrimary>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo size="lg" />
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

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-secondary overflow-hidden mb-6">
            {retailer.avatar ? (
              <img
                src={retailer.avatar}
                alt={retailer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground">
                {retailer.name.charAt(0)}
              </div>
            )}
          </div>

          {/* Name */}
          <h1 className="font-display font-bold text-display-sm md:text-display text-foreground text-center mb-4">
            {retailer.name}
          </h1>

          {/* Location */}
          <div className="flex items-center gap-2 text-muted-foreground mb-4">
            <MapPin className="w-4 h-4" />
            <span className="text-body">{retailer.location}</span>
          </div>

          {/* Website */}
          {retailer.website && (
            <a
              href={retailer.website.startsWith('http') ? retailer.website : `https://${retailer.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-accent hover:underline mb-6"
            >
              <Globe className="w-4 h-4" />
              <span className="text-body">{retailer.website}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Social Links */}
          <div className="flex items-center gap-3 mb-6">
            {retailer.socialLinks.instagram && (
              <a
                href={`https://instagram.com/${retailer.socialLinks.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5 text-foreground" />
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-caption text-muted-foreground mb-6">
            <span>On Neesh since {retailer.memberSince}</span>
          </div>

          {/* Bio */}
          {retailer.bio && (
            <p className="text-body text-foreground/80 leading-relaxed text-center max-w-lg">
              {retailer.bio}
            </p>
          )}

          {/* CTA Section */}
          <section className="mt-12 bg-secondary/50 rounded-xl p-6 md:p-8 text-center w-full max-w-lg">
            <h3 className="font-display font-bold text-xl md:text-2xl text-foreground mb-2">
              Join the Neesh community
            </h3>
            <p className="text-body text-muted-foreground mb-6">
              Discover and stock independent magazines from publishers around the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <ButtonPrimary onClick={() => navigate("/apply")}>
                Apply Now
              </ButtonPrimary>
              <ButtonSecondary onClick={() => navigate("/login")}>
                Sign In
              </ButtonSecondary>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-caption">Powered by</span>
            <Logo size="sm" />
          </div>
          <a
            href="/apply"
            className="text-caption text-accent hover:underline"
          >
            Are you a publisher? Join Neesh →
          </a>
        </div>
      </footer>
    </div>
  );
};

export default RetailerPublicProfile;
