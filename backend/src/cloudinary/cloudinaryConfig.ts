import { v2 as cloudinary } from "cloudinary";

/** Cloudinary upload preset applied to every upload. */
export const CLOUDINARY_UPLOAD_PRESET = "pos";

/** Top-level Cloudinary folder that every asset is nested under. */
export const CLOUDINARY_ROOT_FOLDER = "pos";

let configured = false;

/**
 * Configure Cloudinary using env vars.
 *
 * Call inside helpers so it runs after env vars are loaded, but dedupe so we
 * only configure once per process.
 */
const configureCloudinary = (): void => {
  if (configured) return;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Missing Cloudinary env vars. Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  configured = true;
}

export default configureCloudinary;