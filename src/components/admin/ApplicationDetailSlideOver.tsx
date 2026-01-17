import { useState } from "react";
import { Globe, Instagram, Mail, Phone, MapPin, ChevronLeft, ChevronRight, Store, FileText, Check, X, Pause, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ButtonPrimary, ButtonSecondary, FormTextarea, StatusBadge, InfoCard } from "@/components/neesh";
import { ConfirmationModal } from "./ConfirmationModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

export interface ApplicationNote {
  id: string;
  content: string;
  created_at: string;
  created_by?: string;
}

export interface ApplicationData {
  id: string;
  type: 'publisher' | 'retailer';
  status: 'pending' | 'approved' | 'rejected' | 'on_hold' | 'waitlisted';
  name: string;
  email: string;
  phone?: string;
  website?: string;
  instagram?: string;
  location?: string;
  submitted_at: string;
  reviewed_at?: string | null;
  notes: ApplicationNote[];
  data: Record<string, any>;
}

interface ApplicationDetailSlideOverProps {
  application: ApplicationData | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string, type: 'publisher' | 'retailer') => Promise<boolean>;
  onReject: (id: string, type: 'publisher' | 'retailer', reason: string) => Promise<boolean>;
  onHold?: (id: string, type: 'publisher' | 'retailer') => Promise<boolean>;
  onAddNote?: (id: string, note: string) => Promise<boolean>;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const ApplicationDetailSlideOver = ({
  application,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onHold,
  onAddNote,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}: ApplicationDetailSlideOverProps) => {
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!application) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    const success = await onApprove(application.id, application.type);
    setIsProcessing(false);
    if (success) {
      toast.success("Application approved");
      setShowApproveModal(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    const success = await onReject(application.id, application.type, rejectReason);
    setIsProcessing(false);
    if (success) {
      toast.success("Application rejected");
      setShowRejectModal(false);
      setRejectReason("");
    }
  };

  const handleHold = async () => {
    if (!onHold) return;
    setIsProcessing(true);
    const success = await onHold(application.id, application.type);
    setIsProcessing(false);
    if (success) {
      toast.success("Application placed on hold");
      setShowHoldModal(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !onAddNote) return;
    setIsAddingNote(true);
    const success = await onAddNote(application.id, newNote.trim());
    setIsAddingNote(false);
    if (success) {
      toast.success("Note added");
      setNewNote("");
    }
  };

  const getStatusBadgeStatus = (status: string): 'pending' | 'received' | 'unfulfilled' | 'new-order' => {
    switch (status) {
      case 'approved': return 'received';
      case 'rejected': return 'unfulfilled';
      case 'on_hold': return 'new-order';
      case 'waitlisted': return 'new-order';
      default: return 'pending';
    }
  };

  const formatRelativeDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Extract publisher-specific or retailer-specific data
  const appData = application.data || {};

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
          {/* Header with navigation */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              {application.type === 'publisher' ? (
                <FileText className="w-5 h-5 text-accent" />
              ) : (
                <Store className="w-5 h-5 text-muted-foreground" />
              )}
              <SheetHeader className="space-y-0 text-left">
                <SheetTitle className="text-heading">{application.name}</SheetTitle>
                <SheetDescription className="text-caption">
                  {application.type === 'publisher' ? 'Publisher' : 'Retailer'} Application
                </SheetDescription>
              </SheetHeader>
            </div>
            
            {/* Navigation arrows */}
            {onNavigate && (hasPrev || hasNext) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onNavigate('prev')}
                  disabled={!hasPrev}
                  className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous application"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onNavigate('next')}
                  disabled={!hasNext}
                  className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next application"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <StatusBadge status={getStatusBadgeStatus(application.status)} />
                <span className="text-caption text-muted-foreground">
                  Submitted {formatRelativeDate(application.submitted_at)}
                </span>
              </div>

              {/* Contact Information */}
              <InfoCard title="Contact Information">
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
                      @{application.instagram.replace('@', '')}
                    </div>
                  )}
                  {application.location && (
                    <div className="flex items-center gap-2 text-body text-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {application.location}
                    </div>
                  )}
                </div>
              </InfoCard>

              {/* Publisher-specific details */}
              {application.type === 'publisher' && (
                <InfoCard title="Publication Details">
                  <div className="grid grid-cols-2 gap-3">
                    {appData.magazine_title && (
                      <div>
                        <p className="text-caption text-muted-foreground">Title</p>
                        <p className="text-body font-medium">{appData.magazine_title}</p>
                      </div>
                    )}
                    {appData.issue_frequency && (
                      <div>
                        <p className="text-caption text-muted-foreground">Frequency</p>
                        <p className="text-body font-medium">{appData.issue_frequency}</p>
                      </div>
                    )}
                    {appData.print_run && (
                      <div>
                        <p className="text-caption text-muted-foreground">Print Run</p>
                        <p className="text-body font-medium">{appData.print_run.toLocaleString()}</p>
                      </div>
                    )}
                    {appData.wholesale_price && (
                      <div>
                        <p className="text-caption text-muted-foreground">Wholesale Price</p>
                        <p className="text-body font-medium">${appData.wholesale_price}</p>
                      </div>
                    )}
                  </div>
                  {appData.description && (
                    <div className="mt-3">
                      <p className="text-caption text-muted-foreground mb-1">Description</p>
                      <p className="text-body">{appData.description}</p>
                    </div>
                  )}
                  {appData.category_tags && appData.category_tags.length > 0 && (
                    <div className="mt-3">
                      <p className="text-caption text-muted-foreground mb-1">Categories</p>
                      <div className="flex flex-wrap gap-1">
                        {appData.category_tags.map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-secondary rounded text-caption">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </InfoCard>
              )}

              {/* Retailer-specific details */}
              {application.type === 'retailer' && (
                <InfoCard title="Store Details">
                  <div className="grid grid-cols-2 gap-3">
                    {appData.shop_name && (
                      <div>
                        <p className="text-caption text-muted-foreground">Store Name</p>
                        <p className="text-body font-medium">{appData.shop_name}</p>
                      </div>
                    )}
                    {appData.shop_url && (
                      <div>
                        <p className="text-caption text-muted-foreground">Website</p>
                        <a href={appData.shop_url} target="_blank" rel="noopener noreferrer" className="text-body text-accent hover:underline">
                          {appData.shop_url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {appData.estimated_monthly_orders && (
                      <div>
                        <p className="text-caption text-muted-foreground">Est. Monthly Orders</p>
                        <p className="text-body font-medium">{appData.estimated_monthly_orders}</p>
                      </div>
                    )}
                  </div>
                  {appData.interested_categories && appData.interested_categories.length > 0 && (
                    <div className="mt-3">
                      <p className="text-caption text-muted-foreground mb-1">Interested Categories</p>
                      <div className="flex flex-wrap gap-1">
                        {appData.interested_categories.map((cat: string) => (
                          <span key={cat} className="px-2 py-0.5 bg-secondary rounded text-caption">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {appData.additional_notes && (
                    <div className="mt-3">
                      <p className="text-caption text-muted-foreground mb-1">Additional Notes</p>
                      <p className="text-body">{appData.additional_notes}</p>
                    </div>
                  )}
                </InfoCard>
              )}

              {/* Cover image if available */}
              {appData.cover_image_url && (
                <InfoCard title="Cover Image">
                  <img 
                    src={appData.cover_image_url} 
                    alt="Magazine cover"
                    className="w-full max-w-[200px] aspect-[3/4] object-cover rounded-lg"
                  />
                </InfoCard>
              )}

              {/* Internal Notes Section */}
              <div className="card-neesh">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-body text-foreground">Internal Notes</h3>
                  <span className="text-caption text-muted-foreground">Only visible to admins</span>
                </div>

                {/* Existing notes */}
                {application.notes.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {application.notes.map((note) => (
                      <div key={note.id} className="p-2.5 bg-secondary rounded-lg">
                        <p className="text-body text-foreground">{note.content}</p>
                        <p className="text-caption text-muted-foreground mt-1">
                          {note.created_by && `${note.created_by} • `}{formatRelativeDate(note.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-caption text-muted-foreground mb-3">No notes yet</p>
                )}

                {/* Add new note */}
                {onAddNote && (
                  <div className="flex gap-2">
                    <FormTextarea
                      placeholder="Add a note..."
                      value={newNote}
                      onChange={setNewNote}
                      className="flex-1 min-h-[60px]"
                    />
                    <ButtonSecondary 
                      onClick={handleAddNote} 
                      className="self-end"
                      disabled={!newNote.trim() || isAddingNote}
                    >
                      {isAddingNote ? 'Saving...' : 'Add'}
                    </ButtonSecondary>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Action Footer */}
          {application.status === 'pending' && (
            <div className="p-4 border-t border-border bg-background">
              <div className="flex gap-2 flex-wrap">
                <ButtonPrimary 
                  onClick={() => setShowApproveModal(true)} 
                  className="flex-1 gap-1.5 bg-status-success hover:bg-status-success/90"
                  disabled={isProcessing}
                >
                  <Check className="w-4 h-4" />
                  Approve
                </ButtonPrimary>
                <ButtonSecondary 
                  onClick={() => setShowRejectModal(true)} 
                  className="flex-1 gap-1.5 text-status-error-text"
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4" />
                  Decline
                </ButtonSecondary>
                {onHold && (
                  <ButtonSecondary 
                    onClick={() => setShowHoldModal(true)} 
                    className="gap-1.5"
                    disabled={isProcessing}
                  >
                    <Pause className="w-4 h-4" />
                    Hold
                  </ButtonSecondary>
                )}
              </div>
            </div>
          )}

          {/* Show status if not pending */}
          {application.status !== 'pending' && (
            <div className={`p-4 border-t ${
              application.status === 'approved' 
                ? 'bg-status-success/10 border-status-success' 
                : application.status === 'rejected'
                  ? 'bg-status-error/10 border-status-error'
                  : 'bg-status-pending/10 border-status-pending'
            }`}>
              <div className="flex items-center gap-2">
                {application.status === 'approved' && <Check className="w-4 h-4 text-status-success" />}
                {application.status === 'rejected' && <X className="w-4 h-4 text-status-error-text" />}
                {(application.status === 'on_hold' || application.status === 'waitlisted') && <Clock className="w-4 h-4 text-status-pending-text" />}
                <span className="text-body font-medium capitalize">
                  {application.status.replace('_', ' ')}
                  {application.reviewed_at && ` on ${formatDate(application.reviewed_at)}`}
                </span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleApprove}
        title="Approve Application"
        message={`Are you sure you want to approve ${application.name}? This will create their account and send an approval email.`}
        confirmLabel="Approve"
      />

      <ConfirmationModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
        title="Decline Application"
        message="Please provide a reason for declining this application:"
        confirmLabel="Decline"
        confirmVariant="destructive"
      />

      <ConfirmationModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        onConfirm={handleHold}
        title="Place On Hold"
        message={`Place ${application.name}'s application on hold? You can review it again later.`}
        confirmLabel="Place On Hold"
      />
    </>
  );
};
