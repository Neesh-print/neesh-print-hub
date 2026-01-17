import { Copy, ExternalLink, Check } from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import { ButtonSecondary, ButtonPrimary } from "./index";
import { toast } from "sonner";

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  publisherName: string;
  slug: string;
}

export const ShareProfileModal = ({
  isOpen,
  onClose,
  publisherName,
  slug,
}: ShareProfileModalProps) => {
  const [copied, setCopied] = useState(false);
  
  // TODO: Use actual domain from environment
  const publicUrl = `neesh.art/p/${slug}`;
  const fullUrl = `/p/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${publicUrl}`);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handlePreview = () => {
    window.open(fullUrl, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Your Profile"
      size="md"
    >
      <div className="space-y-4">
        <p className="text-body text-muted-foreground">
          Share this link with retailers to let them discover and stock your titles.
        </p>

        {/* URL Display with Copy */}
        <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
          <span className="flex-1 text-body text-foreground font-mono text-sm truncate">
            {publicUrl}
          </span>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-background rounded-lg transition-colors flex-shrink-0"
            aria-label="Copy link"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <Copy className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <ButtonPrimary fullWidth onClick={handleCopy}>
            {copied ? "Copied!" : "Copy Link"}
          </ButtonPrimary>
          <ButtonSecondary 
            fullWidth 
            onClick={handlePreview}
            icon={<ExternalLink className="w-4 h-4" />}
          >
            Preview Profile
          </ButtonSecondary>
        </div>
      </div>
    </Modal>
  );
};
