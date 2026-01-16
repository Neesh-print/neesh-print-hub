import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, Instagram, Mail, Phone, MapPin } from "lucide-react";
import { AdminLayout, ConfirmationModal } from "@/components/admin";
import { BackNavigation, InfoCard, ButtonPrimary, ButtonSecondary, FormTextarea } from "@/components/neesh";

// Mock application data
const mockApplication = {
  id: "1",
  name: "Kinfolk Magazine",
  type: "Publisher" as const,
  email: "hello@kinfolk.com",
  phone: "+1 (503) 555-0123",
  website: "https://kinfolk.com",
  instagram: "@kinlokmag",
  submittedDate: "January 15, 2026",
  status: "pending" as const,
  location: "Portland, OR",
  bio: "Kinfolk is an independent slow lifestyle magazine that explores ways to simplify life, nurture creativity, and build community. Founded in 2011, we've grown from a small gathering magazine to a globally recognized publication with a community of over 500,000 readers.",
  // Publisher specific
  magazineName: "Kinfolk Magazine",
  frequency: "Quarterly",
  printRun: "50,000 copies",
  genres: ["Lifestyle", "Design", "Culture"],
  distributionChannels: ["Direct subscriptions", "Select retailers", "International distributors"],
  whyJoinNeesh: "We're looking to expand our retail presence in independent bookstores and design-forward retail spaces across North America. Neesh's curated network of retailers aligns perfectly with our brand values.",
  sampleImages: ["/placeholder.svg", "/placeholder.svg", "/placeholder.svg"],
  adminNotes: [
    { id: "1", note: "Verified Instagram following and engagement.", admin: "Sarah M.", date: "Jan 14, 2026" },
    { id: "2", note: "Contacted for additional samples.", admin: "Mike R.", date: "Jan 13, 2026" },
  ],
};

export const AdminApplicationDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [newNote, setNewNote] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  const application = mockApplication;

  const getStatusBanner = () => {
    if (application.status === 'pending') {
      return (
        <div className="bg-status-pending/20 border border-status-pending text-status-pending-text px-4 py-3 rounded-lg">
          This application is awaiting review
        </div>
      );
    }
    // For approved/other statuses - using if statements to avoid type comparison issues
    return (
      <div className="bg-status-success/20 border border-status-success text-status-success-text px-4 py-3 rounded-lg">
        Approved on January 16, 2026 by Sarah M.
      </div>
        );
    }
  };

  const handleApprove = () => {
    console.log("Approving application:", id);
    setShowApproveModal(false);
    navigate("/admin/applications");
  };

  const handleReject = () => {
    console.log("Rejecting application:", id, "Reason:", rejectReason);
    setShowRejectModal(false);
    navigate("/admin/applications");
  };

  const handleRequestInfo = () => {
    console.log("Requesting info:", requestMessage);
    setShowRequestInfoModal(false);
    setRequestMessage("");
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      console.log("Adding note:", newNote);
      setNewNote("");
    }
  };

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
                    application.type === 'Publisher' ? 'bg-accent/10 text-accent' : 'bg-secondary text-foreground'
                  }`}>
                    {application.type}
                  </span>
                </div>

                <div className="space-y-2">
                  <a href={`mailto:${application.email}`} className="flex items-center gap-2 text-body text-foreground hover:text-accent">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {application.email}
                  </a>
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

            <InfoCard title="About">
              <div className="space-y-3">
                <p className="text-body text-foreground leading-relaxed">{application.bio}</p>
                <div className="flex items-center gap-2 text-body text-foreground">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {application.location}
                </div>
              </div>
            </InfoCard>
          </div>

          {/* Right Column - Application Details */}
          <div className="space-y-6">
            <InfoCard title="Publication Info">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-caption text-muted-foreground">Magazine Name</p>
                  <p className="text-body font-medium text-foreground">{application.magazineName}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Frequency</p>
                  <p className="text-body font-medium text-foreground">{application.frequency}</p>
                </div>
                <div>
                  <p className="text-caption text-muted-foreground">Print Run</p>
                  <p className="text-body font-medium text-foreground">{application.printRun}</p>
                </div>
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
              </div>
            </InfoCard>

            <InfoCard title="Distribution">
              <div className="space-y-4">
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
                <div>
                  <p className="text-caption text-muted-foreground mb-2">Why They Want to Join Neesh</p>
                  <p className="text-body text-foreground">{application.whyJoinNeesh}</p>
                </div>
              </div>
            </InfoCard>

            <InfoCard title="Sample Work">
              <div className="grid grid-cols-3 gap-3">
                {application.sampleImages.map((img, idx) => (
                  <img 
                    key={idx}
                    src={img} 
                    alt={`Sample ${idx + 1}`}
                    className="aspect-[3/4] object-cover rounded-lg bg-secondary"
                  />
                ))}
              </div>
            </InfoCard>
          </div>
        </div>

        {/* Admin Notes Section */}
        <div className="mt-6">
          <div className="card-neesh">
            <h3 className="font-display font-semibold text-heading text-foreground mb-4">Admin Notes</h3>
            
            {/* Existing notes */}
            <div className="space-y-3 mb-4">
              {application.adminNotes.map((note) => (
                <div key={note.id} className="p-3 bg-secondary rounded-lg">
                  <p className="text-body text-foreground">{note.note}</p>
                  <p className="text-caption text-muted-foreground mt-1">
                    {note.admin} • {note.date}
                  </p>
                </div>
              ))}
            </div>

            {/* Add new note */}
            <div className="flex gap-3">
              <FormTextarea
                placeholder="Add a note..."
                value={newNote}
                onChange={setNewNote}
                className="flex-1"
              />
              <ButtonSecondary onClick={handleAddNote} className="self-end">
                Add Note
              </ButtonSecondary>
            </div>
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
            <ButtonSecondary onClick={() => setShowRequestInfoModal(true)}>
              Request More Info
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
        message="Please provide a reason for rejection:"
        confirmLabel="Reject"
        confirmVariant="destructive"
      />

      {/* Request Info Modal */}
      <ConfirmationModal
        isOpen={showRequestInfoModal}
        onClose={() => setShowRequestInfoModal(false)}
        onConfirm={handleRequestInfo}
        title="Request More Information"
        message="Enter the message to send to the applicant:"
        confirmLabel="Send Request"
      />
    </AdminLayout>
  );
};

export default AdminApplicationDetail;
