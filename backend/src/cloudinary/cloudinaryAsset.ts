import { CLOUDINARY_ROOT_FOLDER } from "./cloudinaryConfig.ts";

/** The Cloudinary public id of an asset we own, or `undefined` for a foreign URL. */
export function ownedPublicIdFor(
  imageUrl: string | undefined
): string | undefined {
  if (!imageUrl) return undefined;

  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return undefined;
  }

  if (
    url.hostname !== "res.cloudinary.com" &&
    !url.hostname.endsWith(".cloudinary.com")
  ) {
    return undefined;
  }

  const rootPath = `/${CLOUDINARY_ROOT_FOLDER}/`;
  const rootIndex = url.pathname.indexOf(rootPath);
  if (rootIndex === -1) return undefined;

  return url.pathname
    .slice(rootIndex + 1)
    .replace(/\.[^/.]+$/, "");
}

/** Whether a URL points at an asset Project Imperium owns and may delete. */
export function isCloudinaryAssetUrl(
  imageUrl: string | undefined
): boolean {
  return Boolean(ownedPublicIdFor(imageUrl));
}
