export interface HttpErrorShape {
  statusCode: number;
  message: string;
}

export function toHttpError(err: unknown): HttpErrorShape {
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { statusCode?: unknown; message?: unknown };
    const statusCode =
      typeof anyErr.statusCode === "number" ? anyErr.statusCode : 500;
    const message =
      typeof anyErr.message === "string" && anyErr.message.length
        ? anyErr.message
        : "Internal Server Error";
    return { statusCode, message };
  }
  return { statusCode: 500, message: "Internal Server Error" };
}

export function badRequest(message: string): HttpErrorShape {
  return { statusCode: 400, message };
}

export function unauthorized(message = "Unauthorized"): HttpErrorShape {
  return { statusCode: 401, message };
}

export function forbidden(message = "Forbidden"): HttpErrorShape {
  return { statusCode: 403, message };
}

export function notFound(message = "Not Found"): HttpErrorShape {
  return { statusCode: 404, message };
}

