/**
 * Short-lived, single-use tickets for the live WebSocket upgrade.
 *
 * A browser cannot set an `Authorization` header on a WebSocket, so the socket
 * must carry its credential in the URL. To keep the long-lived access JWT out
 * of request logs, proxies, and browser tooling, the client exchanges it over
 * authenticated HTTP for a random ticket that expires in one minute and is
 * consumed on first use. The ticket is session state, not a domain document.
 */
import crypto from "node:crypto";

export interface LiveTicketRecord {
  sessionId: string;
  accountId: string;
  accountType: "user";
}

interface StoredLiveTicket extends LiveTicketRecord {
  expiresAt: number;
}

export const LIVE_TICKET_TTL_MS = 60_000;
export const MAX_ACTIVE_LIVE_TICKETS = 10_000;

const tickets = new Map<string, StoredLiveTicket>();

function pruneExpired(now: number): void {
  for (const [ticket, record] of tickets) {
    if (record.expiresAt <= now) {
      tickets.delete(ticket);
    }
  }
}

export interface IssuedLiveTicket {
  ticket: string;
  expiresAt: Date;
}

export function issueLiveTicket(input: LiveTicketRecord): IssuedLiveTicket {
  const now = Date.now();
  pruneExpired(now);

  // A flood of tickets must not grow the process without bound; drop the
  // oldest entry because the newest tabs are the ones still connecting.
  if (tickets.size >= MAX_ACTIVE_LIVE_TICKETS) {
    const oldest = tickets.keys().next().value;
    if (oldest !== undefined) {
      tickets.delete(oldest);
    }
  }

  const ticket = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + LIVE_TICKET_TTL_MS;
  tickets.set(ticket, { ...input, expiresAt });
  return { ticket, expiresAt: new Date(expiresAt) };
}

/** Consume a ticket once. An unknown, used, or expired ticket returns `null`. */
export function consumeLiveTicket(
  ticket: string | null | undefined,
): LiveTicketRecord | null {
  if (!ticket) return null;

  const now = Date.now();
  pruneExpired(now);

  const record = tickets.get(ticket);
  if (!record) return null;

  tickets.delete(ticket);

  if (record.expiresAt <= now) return null;

  return {
    sessionId: record.sessionId,
    accountId: record.accountId,
    accountType: record.accountType,
  };
}

export function resetLiveTicketStoreForTests(): void {
  tickets.clear();
}
