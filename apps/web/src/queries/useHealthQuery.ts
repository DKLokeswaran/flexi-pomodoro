import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "./health.api";

export const healthQueryKey = ["health"] as const;

/** One-shot API health probe for the About tab. */
export function useHealthQuery() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: fetchHealth,
    staleTime: Infinity,
    retry: 1,
  });
}
