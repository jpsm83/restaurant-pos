import { Types } from "mongoose";

export function buildReservationMessage(params: {
  reservationId: Types.ObjectId | string;
  status: string;
  reservationStart: Date;
  guestCount: number;
  description?: string;
}): string {
  const ref = typeof params.reservationId === "string" ? params.reservationId : params.reservationId.toString();
  const when = params.reservationStart ? new Date(params.reservationStart).toLocaleString() : "N/A";
  const desc = params.description ? `\nReason: ${params.description}` : "";

  return `Reservation – Ref ${ref}\nStatus: ${params.status}\nWhen: ${when}\nGuests: ${params.guestCount}${desc}`;
}

