// Email templates for Neesh notifications.
// The HTML lives with the edge functions so the in-app previews and the
// emails the server sends share one layout.

export {
  EMAIL_SUBJECTS,
  generateApplicationReceivedEmail,
  generateApprovalEmail,
  generateRejectionEmail,
} from "../../supabase/functions/_shared/application-emails";
