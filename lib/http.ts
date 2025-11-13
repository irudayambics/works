export type ApiSuccess<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type ApiError = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  return { ok: true, data, meta };
}

export function err(code: string, message: string, details?: unknown): ApiError {
  return { ok: false, error: { code, message, details } };
}

export function isApiError<T>(result: ApiResult<T>): result is ApiError {
  return !result.ok;
}
