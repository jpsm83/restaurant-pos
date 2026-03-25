import type { IBusiness } from "../../../packages/interfaces/IBusiness.ts";

function toTimeNumber(date: Date): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return hours * 60 + minutes;
}

function parseTimeToMinutes(time: string): number | null {
  const parts = time.split(":");
  if (parts.length !== 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  )
    return null;
  return hours * 60 + minutes;
}

export function isBusinessOpenNow(
  business: IBusiness,
  now: Date = new Date(),
): boolean {
  const openingHours = business.businessOpeningHours;
  if (!openingHours || openingHours.length === 0) return true;

  const dayOfWeek = now.getDay();
  const nowMinutes = toTimeNumber(now);

  return openingHours.some((entry) => {
    if (entry.dayOfWeek !== dayOfWeek) return false;
    const open = parseTimeToMinutes(entry.openTime);
    const close = parseTimeToMinutes(entry.closeTime);
    if (open === null || close === null) return false;
    return nowMinutes >= open && nowMinutes < close;
  });
}

export function isDeliveryOpenNow(
  business: IBusiness,
  now: Date = new Date(),
): boolean {
  if (!business.acceptsDelivery) return false;

  const windows = business.deliveryOpeningWindows;
  if (!windows || windows.length === 0) return false;

  const dayOfWeek = now.getDay();
  const nowMinutes = toTimeNumber(now);

  return windows.some((entry) => {
    if (entry.dayOfWeek !== dayOfWeek) return false;
    if (!entry.windows || entry.windows.length === 0) return false;
    return entry.windows.some((win) => {
      const open = parseTimeToMinutes(win.openTime);
      const close = parseTimeToMinutes(win.closeTime);
      if (open === null || close === null) return false;
      return nowMinutes >= open && nowMinutes < close;
    });
  });
}
