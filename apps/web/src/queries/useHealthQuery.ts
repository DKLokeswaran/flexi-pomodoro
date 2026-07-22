import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../api";

export const healthQueryKey = ["health"] as const;

export function useHealthQuery() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: fetchHealth,
    staleTime: Infinity,
    retry: 1,
  });
}
