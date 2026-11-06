import { CLOUDINARY_ROOT_FOLDER } from "./cloudinaryConfig.ts";

/** The Cloudinary public id of an asset we own, or `undefined` for a foreign URL. */
export function ownedPublicIdFor(
  imageUrl: string | undefined
): string | undefined {
  return imageUrl?.match(new RegExp(`${CLOUDINARY_ROOT_FOLDER}/[^.]+`))?.[0];
}

/** Whether a URL points at an asset Project Imperium owns and may delete. */
export function isCloudinaryAssetUrl(
  imageUrl: string | undefined
): boolean {
  return Boolean(ownedPublicIdFor(imageUrl));
}
