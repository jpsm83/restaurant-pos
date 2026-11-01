/**
 * Membership document uploads.
 *
 * The multipart transport caps a request at ten files; a membership may hold
 * ten documents in total, so only an update with existing documents can exceed
 * the cap. Uploads are all-or-nothing: a Cloudinary response that is not a list
 * of HTTPS URLs becomes a `400` Problem Details response.
 */
import { badRequest } from "../errors/appError.ts";
import uploadFilesCloudinary from "../cloudinary/uploadFilesCloudinary.ts";
import type { MultipartFile } from "../schemas/multipart.ts";

/** Total documents an employee may hold. */
export const MAX_MEMBERSHIP_DOCUMENTS = 10;

async function uploadDocuments(
  folder: string,
  files: MultipartFile[],
  onlyImages: boolean,
): Promise<string[]> {
  const response = await uploadFilesCloudinary({
    folder,
    filesArr: files.map((file) => ({
      buffer: file.buffer,
      mimeType: file.mimetype,
    })),
    onlyImages,
  });

  if (
    typeof response === "string" ||
    response.length === 0 ||
    !response.every((str) => str.includes("https://"))
  ) {
    throw badRequest(
      `Error uploading ${onlyImages ? "image" : "files"}: ${response}`,
    );
  }

  return response;
}

/** Upload documents into the membership's own Cloudinary folder. */
export function uploadMembershipDocuments(params: {
  businessId: string;
  employeeId: string;
  files: MultipartFile[];
  onlyImages: boolean;
}): Promise<string[]> {
  const folder = `/business/${params.businessId}/employees/${params.employeeId}`;
  return uploadDocuments(folder, params.files, params.onlyImages);
}

/** Refuse an update whose new files would exceed the membership document cap. */
export function assertDocumentCount(existingCount: number, newCount: number): void {
  if (existingCount + newCount > MAX_MEMBERSHIP_DOCUMENTS) {
    throw badRequest(`Max file quantity is ${MAX_MEMBERSHIP_DOCUMENTS}!`);
  }
}
