import { REQUEST_FAILED } from "../constants/labels";

/** Read a JSON body, or throw using the server `error` field / a generic status. */
export async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ??
        `${REQUEST_FAILED} (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}
