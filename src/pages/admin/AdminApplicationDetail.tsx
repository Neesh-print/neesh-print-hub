import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, Instagram, Mail, Phone, MapPin, AlertCircle, Loader2 } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, ButtonPrimary, ButtonSecondary, FormTextarea } from "@/components/neesh";
import { supabase } from "@/integrations/supabase/client";
import { useApplications } from "@/hooks/useApplications";
import { format } from "date-fns";

interface ApplicationData {
  id: string;
  type: 'publisher' | 'retailer';
  name: string;
  email: string;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  submittedDate: string;
  status: string;
  location: string | null;
  bio: string | null;
  // Publisher specific
  magazineName: string | null;
  frequency: string | null;
  printRun: number | null;
  genres: string[];
  distributionChannels: string[];
  whyJoinNeesh: string | null;
  coverImageUrl: string | null;
  // Retailer specific
  shopName: string | null;
  shopUrl: string | null;
  shopAddress: string | null;
  interestedCategories: string[];
  estimatedMonthlyOrders: number | null;
  additionalNotes: string | null;
}

export const AdminApplicationDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { approveApplication, rejectApplication } = useApplications();

  const fetchApplication = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      // Try publisher applications first
      const { data: pubData, error: pubError } = await supabase
        .from('publisher_applications')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (pubData) {
        const location = [pubData.shipping_city, pubData.shipping_state].filter(Boolean).join(', ');
        setApplication({
          id: pubData.id,
          type: 'publisher',
          name: pubData.business_name || pubData.magazine_title || 'Unknown',
          email: pubData.email || '',
          phone: null,
          website: pubData.social_website_link,
          instagram: null,
          submittedDate: pubData.created_at ? format(new Date(pubData.created_at), "MMMM d, yyyy") : 'Unknown',
          status: pubData.status,
          location: location || null,
          bio: pubData.description || pubData.descriptive_blurb,
          magazineName: pubData.magazine_title,
          frequency: pubData.issue_frequency,
          printRun: pubData.print_run,
          genres: pubData.category_tags || [],
          distributionChannels: pubData.distribution_channels || [],
          whyJoinNeesh: pubData.audience_positioning,
          coverImageUrl: pubData.cover_image_url,
          shopName: null,
          shopUrl: null,
          shopAddress: null,
          interestedCategories: [],
          estimatedMonthlyOrders: null,
          additionalNotes: null,
        });
        return;
      }

      // Try retailer applications
      const { data: retData, error: retError } = await supabase
        .from('retailer_applications')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (retData) {
        const location = [retData.city, retData.state].filter(Boolean).join(', ');
        setApplication({
          id: retData.id,
          type: 'retailer',
          name: retData.shop_name || 'Unknown',
          email: retData.buyer_email || '',
          phone: retData.phone,
          website: retData.shop_url,
          instagram: retData.instagram_handle,
          submittedDate: retData.submitted_at
            ? format(new Date(retData.submitted_at), "MMMM d, yyyy")
            : retData.created_at
              ? format(new Date(retData.created_at), "MMMM d, yyyy")
              : 'Unknown',
          status: retData.status || 'pending',
          location: location || null,
          bio: retData.additional_notes,
          magazineName: null,
          frequency: null,
          printRun: null,
          genres: [],
          distributionChannels: [],
          whyJoinNeesh: null,
          coverImageUrl: null,
          shopName: retData.shop_name,
          shopUrl: retData.shop_url,
          shopAddress: retData.shop_address,
          interestedCategories: retData.interested_categories || [],
          estimatedMonthlyOrders: retData.estimated_monthly_orders,
          additionalNotes: retData.additional_notes,
        });
        return;
      }

      throw new Error('Application not found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch application');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const getStatusBanner = () => {
    if (!application) return null;
    if (application.status === 'pending') {
      return (
        <div className="bg-status-pending/20 border border-status-pending text-status-pending-text px-4 py-3 rounded-lg">
          This application is awaiting review
        </div>
      );
    }
    if (application.status === 'approved') {
      return (
        <div className="bg-status-success/20 border border-status-success text-status-success-text px-4 py-3 rounded-lg">
          This application has been approved
        </div>
      );
    }
    return (
      <div className="bg-status-error/20 border border-status-error text-status-error-text px-4 py-3 rounded-lg">
        This application has been rejected
      </div>
    );
  };

  const handleApprove = async () => {
    if (!application) return;
    const success = await approveApplication(application.id, application.type);
    setShowApproveModal(false);
    if (success) {
      navigate("/admin/applications");
    }
  };

  const handleReject = async () => {
    if (!application) return;
    const success = await rejectApplication(application.id, application.type, rejectReason);
    setShowRejectModal(false);
    if (success) {
      navigate("/admin/applications");
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <BackNavigation title="Application Review" onBack={() => navigate("/admin/applications")} />
        <div className="px-4 md:px-6 pb-8 flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-body text-muted-foreground">Loading application...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !application) {
    return (
      <AdminLayout>
        <BackNavigation title="Application Review" onBack={() => navigate("/admin/applications")} />
        <div className="px-4 md:px-6 pb-8">
          <div className="card-neesh flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-10 h-10 text-status-error-text mb-3" />
            <h3 className="font-display font-semibold text-heading text-foreground mb-1">Application not found</h3>
            <p className="text-body text-muted-foreground mb-4">{error || 'This application could not be loaded.'}</p>
            <ButtonSecondary onClick={() => navigate("/admin/applications")}>Back to Applications</ButtonSecondary>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <BackNavigation title="Application Review" onBack={() => navigate("/admin/applications")} />

      {/* Status Banner */}
      <div className="px-4 md:px-6 pb-6">
        {getStatusBanner()}
      </div>

      {/* Main Content */}
      <div className="px-4 md:px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Applicant Info */}
          <div className="space-y-6">
            <InfoCard title="Applicant Information">
              <div className="space-y-4">
                <div>
                  <h4 className="font-display font-bold text-heading text-foreground">{application.name}</h4>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-caption font-medium ${
                    application.type === 'publisher' ? 'bg-accent/10 text-accent' : 'bg-secondary text-foreground'
                  }`}>
                    {application.type === 'publisher' ? 'Publisher' : 'Retailer'}
                  </span>
                </div>

                <div className="space-y-2">
                  {application.email && (
                    <a href={`mailto:${application.email}`} className="flex items-center gap-2 text-body text-foreground hover:text-accent">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {application.email}
                    </a>
                  )}
                  {application.phone && (
                    <div className="flex items-center gap-2 text-body text-foreground">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      {application.phone}
                    </div>
                  )}
                  {application.website && (
                    <a href={application.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-body text-accent hover:underline">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      {application.website}
                    </a>
                  )}
                  {application.instagram && (
                    <div className="flex items-center gap-2 text-body text-foreground">
                      <Instagram className="w-4 h-4 text-muted-foreground" />
                      {application.instagram}
                    </div>
                  )}
                </div>

                <p className="text-caption text-muted-foreground">
                  Submitted: {application.submittedDate}
                </p>
              </div>
            </InfoCard>

            {application.bio && (
              <InfoCard title="About">
                <div className="space-y-3">
                  <p className="text-body text-foreground leading-relaxed">{application.bio}</p>
                  {application.location && (
                    <div className="flex items-center gap-2 text-body text-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {application.location}
                    </div>
                  )}
                </div>
              </InfoCard>
            )}
          </div>

          {/* Right Column - Application Details */}
          <div className="space-y-6">
            {application.type === 'publisher' && (
              <>
                <InfoCard title="Publication Info">
                  <div className="grid grid-cols-2 gap-4">
                    {application.magazineName && (
                      <div>
                        <p className="text-caption text-muted-foreground">Magazine Name</p>
                        <p className="text-body font-medium text-foreground">{application.magazineName}</p>
                      </div>
                    )}
                    {application.frequency && (
                      <div>
                        <p className="text-caption text-muted-foreground">Frequency</p>
                        <p className="text-body font-medium text-foreground">{application.frequency}</p>
                      </div>
                    )}
                    {application.printRun && (
                      <div>
                        <p className="text-caption text-muted-foreground">Print Run</p>
                        <p className="text-body font-medium text-foreground">{application.printRun.toLocaleString()} copies</p>
                      </div>
                    )}
                    {application.genres.length > 0 && (
                      <div>
                        <p className="text-caption text-muted-foreground">Genres</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {application.genres.map((genre) => (
                            <span key={genre} className="px-2 py-0.5 bg-secondary rounded text-caption">
                              {genre}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </InfoCard>

                {(application.distributionChannels.length > 0 || application.whyJoinNeesh) && (
                  <InfoCard title="Distribution">
                    <div className="space-y-4">
                      {application.distributionChannels.length > 0 && (
                        <div>
                          <p className="text-caption text-muted-foreground mb-2">Current Channels</p>
                          <div className="flex flex-wrap gap-1">
                            {application.distributionChannels.map((channel) => (
                              <span key={channel} className="px-2 py-0.5 bg-secondary rounded text-caption">
                                {channel}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {application.whyJoinNeesh && (
                        <div>
                          <p className="text-caption text-muted-foreground mb-2">Audience Positioning</p>
                          <p className="text-body text-foreground">{application.whyJoinNeesh}</p>
                        </div>
                      )}
                    </div>
                  </InfoCard>
                )}

                {application.coverImageUrl && (
                  <InfoCard title="Cover Image">
                    <img
                      src={application.coverImageUrl}
                      alt="Magazine Cover"
                      className="aspect-[3/4] max-w-[200px] object-cover rounded-lg bg-secondary"
                    />
                  </InfoCard>
                )}
              </>
            )}

            {application.type === 'retailer' && (
              <>
                <InfoCard title="Store Info">
                  <div className="space-y-3">
                    {application.shopName && (
                      <div>
                        <p className="text-caption text-muted-foreground">Shop Name</p>
                        <p className="text-body font-medium text-foreground">{application.shopName}</p>
                      </div>
                    )}
                    {application.shopAddress && (
                      <div>
                        <p className="text-caption text-muted-foreground">Address</p>
                        <p className="text-body text-foreground">{application.shopAddress}</p>
                      </div>
                    )}
                    {application.shopUrl && (
                      <div>
                        <p className="text-caption text-muted-foreground">Website</p>
                        <a href={application.shopUrl} target="_blank" rel="noopener noreferrer" className="text-body text-accent hover:underline">
                          {application.shopUrl}
                        </a>
                      </div>
                    )}
                    {application.estimatedMonthlyOrders && (
                      <div>
                        <p className="text-caption text-muted-foreground">Estimated Monthly Orders</p>
                        <p className="text-body font-medium text-foreground">{application.estimatedMonthlyOrders}</p>
                      </div>
                    )}
                  </div>
                </InfoCard>

                {application.interestedCategories.length > 0 && (
                  <InfoCard title="Interested Categories">
                    <div className="flex flex-wrap gap-1">
                      {application.interestedCategories.map((cat) => (
                        <span key={cat} className="px-2 py-0.5 bg-secondary rounded text-caption">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </InfoCard>
                )}

                {application.additionalNotes && (
                  <InfoCard title="Additional Notes">
                    <p className="text-body text-foreground">{application.additionalNotes}</p>
                  </InfoCard>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {application.status === 'pending' && (
          <div className="mt-6 flex gap-4 flex-wrap">
            <ButtonPrimary onClick={() => setShowApproveModal(true)} className="bg-status-success hover:bg-status-success/90">
              Approve Application
            </ButtonPrimary>
            <ButtonSecondary onClick={() => setShowRejectModal(true)} className="text-status-error-text">
              Reject Application
            </ButtonSecondary>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      <ConfirmationModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        title="Approve Application"
        message={`Are you sure you want to approve ${application.name}? This will create their account and send an approval email.`}
        confirmLabel="Approve"
      />

      {/* Reject Modal */}
      <ConfirmationModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Reject Application"
        message="Are you sure you want to reject this application?"
        confirmLabel="Reject"
        confirmVariant="destructive"
      />
    </AdminLayout>
  );
};

export default AdminApplicationDetail;
