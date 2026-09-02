import type { FeatureDef } from "../../createFlagCatalog";
import { shortDurationsServerFeature } from "@flexi-pomodoro/shared";

export const shortDurationsFeature = {
  id: shortDurationsServerFeature.id,
  meta: {
    label: "Short durations",
    description: "Allow work/rest/decision lengths of 1 second or more",
  },
} as const satisfies FeatureDef<typeof shortDurationsServerFeature.id>;
