/**
 * Minimal Buffer-like type used by Cloudinary upload helpers.
 * Your code only relies on `buffer.toString("base64")`.
 */
export type CloudinaryUploadBuffer = {
  toString: (encoding: string) => string;
};

export interface UploadInputFile {
  buffer: Buffer;
  mimeType: string;
}

export interface UploadFilesCloudinaryParams {
  folder: string;
  filesArr: UploadInputFile[];
  onlyImages?: boolean;
}

export type UploadFilesCloudinaryResult = string | string[];

export type DeleteFilesCloudinaryParams = {
  imageUrl: string | undefined;
};

export type DeleteFilesCloudinaryResult = boolean | string;

export type DeleteFolderCloudinaryParams = {
  folderPath: string;
};

export type MoveFilesBetweenFoldersParams = {
  oldFolder: string;
  newFolder: string;
};

export type MoveFilesBetweenFoldersResult = string | string[];

