import { REQUEST_FAILED } from "../constants/labels";

export async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `${REQUEST_FAILED} (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}
