import { ZodError } from "zod";
import {
  SettingsError,
  toSettingsError,
} from "../services/settings.service.js";
import { SessionError } from "../services/session.service.js";

/** HTTP status for session errors: conflict, forbidden, or generic bad request. */
function sessionErrorStatus(code: string): number {
  if (code === "NO_SESSION" || code === "SESSION_ACTIVE") return 409;
  if (code === "FORBIDDEN" || code === "PARAMS_LOCKED") return 403;
  return 400;
}

/** Map known domain errors to an HTTP status and JSON body. Unknown errors rethrow. */
export function errorReply(error: unknown): {
  statusCode: number;
  body: object;
} {
  if (error instanceof ZodError) {
    return errorReply(toSettingsError(error));
  }
  if (error instanceof SettingsError) {
    return {
      statusCode: 400,
      body: { error: error.message, code: error.code },
    };
  }
  if (error instanceof SessionError) {
    return {
      statusCode: sessionErrorStatus(error.code),
      body: { error: error.message, code: error.code },
    };
  }
  throw error;
}
