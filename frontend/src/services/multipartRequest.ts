/**
 * Shared multipart request config.
 *
 * Axios defaults set `Content-Type: application/json`; multipart needs the
 * runtime to choose its boundary, so these requests strip that header.
 */
import { AxiosHeaders, type AxiosRequestConfig } from "axios";

export const multipartFormDataConfig: AxiosRequestConfig = {
  transformRequest: [
    (data, headers) => {
      if (headers instanceof AxiosHeaders) {
        headers.delete("Content-Type");
      } else if (headers && typeof headers === "object") {
        delete (headers as Record<string, unknown>)["Content-Type"];
      }
      return data;
    },
  ],
};
