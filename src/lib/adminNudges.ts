import { money, type OverviewOrder } from "@/lib/adminOverview";

/**
 * Ready-to-send admin messages. A nudge opens the Inbox's new-message dialog
 * addressed to the publisher with this text filled in; the admin can edit it
 * before sending, so it lands in the publisher's Neesh inbox like any message.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A publisher's order has waited in To ship (or Packed with no scan) for `days` days. */
export function lateOrderNudge(order: OverviewOrder, days: number, packed = false): string {
  const item = `${order.title} × ${order.quantity} for ${order.spaceName} (order ${order.ref})`;
  return packed
    ? `Hi from Neesh! ${item} was packed ${plural(days, "day")} ago, but the carrier hasn't scanned it yet. Has it gone out? If the tracking number changed, you can update it on the order page.`
    : `Hi from Neesh! ${item} came in ${plural(days, "day")} ago and hasn't shipped yet. Could you add tracking when it goes out, or let us know if anything is holding it up?`;
}

/** What to ask for each missing setup step (names from missingSetup). */
const SETUP_ASK: Record<string, string> = {
  "Stripe payouts": "set up Stripe payouts",
  "Ships-from address": "add your ships-from address",
  "A live title": "list a title",
};

const joinAnd = (parts: string[]) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/** A publisher can't be paid, or can't be quoted for shipping, until they finish setup. */
export function setupNudge(missing: string[], owed: number, orderCount: number): string {
  const asks = missing.map((m) => SETUP_ASK[m] ?? m.toLowerCase());
  const waiting = owed > 0 ? `You have ${money(owed)} waiting from ${plural(orderCount, "order")}. ` : "";
  const why = missing.some((m) => m !== "A live title")
    ? "so we can pay you as soon as orders ship"
    : "so spaces can start ordering from you";
  const ask = asks.length ? `Could you ${joinAnd(asks)} on Neesh ${why}?` : "";
  return `Hi from Neesh! ${waiting}${ask}`.trim();
}
