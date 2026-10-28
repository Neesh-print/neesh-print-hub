import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { MessageableUser, UserType } from "@/types/messaging";

export interface NudgeTarget {
  /** The recipient's login (users.id). */
  userId: string | null;
  /** publishers.id or retailers.id. */
  id: string | null;
  name: string;
  type: Extract<UserType, "publisher" | "retailer">;
}

/**
 * Opens the admin Inbox's new-message dialog addressed to `to`, with `draft`
 * filled in. Nothing is sent until the admin presses Send there.
 */
export function useNudge() {
  const navigate = useNavigate();
  return (to: NudgeTarget, draft = "") => {
    if (!to.userId) {
      toast.error(`${to.name} has no login to message yet`);
      return;
    }
    const recipient: MessageableUser = {
      id: to.id ?? to.userId,
      user_id: to.userId,
      user_type: to.type,
      display_name: to.name,
      avatar_url: null,
      city: null,
      state: null,
    };
    navigate("/admin/messages", { state: { newMessage: true, recipient, draft } });
  };
}
