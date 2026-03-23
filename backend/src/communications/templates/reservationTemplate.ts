import { Types } from "mongoose";

export interface ReservationTemplateInput {
  reservationId: Types.ObjectId | string;
  status: string;
  reservationStart: Date;
  guestCount: number;
  description?: string;
}

const buildReservationTemplate = (params: ReservationTemplateInput): string => {
  const ref =
    typeof params.reservationId === "string"
      ? params.reservationId
      : params.reservationId.toString();

  const when = params.reservationStart
    ? new Date(params.reservationStart).toLocaleString()
    : "N/A";

  const desc = params.description ? `\nReason: ${params.description}` : "";

  return `Reservation – Ref ${ref}\nStatus: ${params.status}\nWhen: ${when}\nGuests: ${params.guestCount}${desc}`;
};

export default buildReservationTemplate;

