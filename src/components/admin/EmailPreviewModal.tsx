import { useState } from "react";
import { X, Send, Eye, Edit3, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ButtonPrimary, ButtonSecondary, FormInput, FormTextarea } from "@/components/neesh";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface EmailPreviewData {
  to: string
  subject: string
  html: string
  recipientName: string
  businessName: string
}

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  emailData: EmailPreviewData | null
  onSend: () => void
}

export const EmailPreviewModal = ({
  isOpen,
  onClose,
  emailData,
  onSend,
}: EmailPreviewModalProps) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Update local state when emailData changes
  useState(() => {
    if (emailData) {
      setSubject(emailData.subject);
      setHtmlContent(emailData.html);
    }
  });

  const handleSendEmail = async () => {
    if (!emailData) return;

    setIsSending(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to send email
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emailData.to,
            subject: subject,
            html: htmlContent,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      toast.success(`Email sent to ${emailData.recipientName}`);
      onSend();
      onClose();

    } catch (err) {
      console.error('Error sending email:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const handleResetToDefault = () => {
    if (emailData) {
      setSubject(emailData.subject);
      setHtmlContent(emailData.html);
      toast.success('Reset to default template');
    }
  };

  if (!emailData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Send className="w-5 h-5 text-accent" />
            Review Email Before Sending
          </DialogTitle>
          <DialogDescription>
            Sending to <strong>{emailData.recipientName}</strong> ({emailData.to})
          </DialogDescription>
        </DialogHeader>

        {/* Tabs for Preview/Edit */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'edit')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-2">
              <Edit3 className="w-4 h-4" />
              Edit
            </TabsTrigger>
          </TabsList>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              {/* Subject Line */}
              <div className="card-neesh">
                <div className="text-caption text-muted-foreground mb-1">Subject</div>
                <div className="font-medium text-foreground">{subject}</div>
              </div>

              {/* Email Preview */}
              <div className="card-neesh overflow-hidden">
                <div className="text-caption text-muted-foreground mb-3">Email Preview</div>
                <div className="border border-border rounded-lg overflow-hidden bg-white">
                  <iframe
                    srcDoc={htmlContent}
                    className="w-full h-[500px] border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Edit Tab */}
          <TabsContent value="edit" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              {/* Edit Subject */}
              <div>
                <FormInput
                  label="Email Subject"
                  value={subject}
                  onChange={setSubject}
                  placeholder="Email subject line"
                />
              </div>

              {/* Edit HTML */}
              <div>
                <FormTextarea
                  label="HTML Content"
                  value={htmlContent}
                  onChange={setHtmlContent}
                  rows={15}
                  className="font-mono text-sm"
                  helperText="Customize the email HTML. Be careful with formatting."
                />
              </div>

              {/* Reset Button */}
              <ButtonSecondary onClick={handleResetToDefault} className="w-full">
                Reset to Default Template
              </ButtonSecondary>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
          <ButtonSecondary onClick={onClose} disabled={isSending}>
            Cancel
          </ButtonSecondary>

          <div className="flex items-center gap-2">
            {activeTab === 'edit' && (
              <ButtonSecondary
                onClick={() => setActiveTab('preview')}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                Preview Changes
              </ButtonSecondary>
            )}

            <ButtonPrimary
              onClick={handleSendEmail}
              disabled={isSending}
              className="gap-2 bg-status-success hover:bg-status-success/90"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Email
                </>
              )}
            </ButtonPrimary>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
