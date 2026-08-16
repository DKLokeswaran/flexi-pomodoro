import { REQUEST_FAILED } from "../constants/labels";

/** Prefer an Error's message; otherwise a fallback string. */
export function errorMessage(
  error: unknown,
  fallback = REQUEST_FAILED,
): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
