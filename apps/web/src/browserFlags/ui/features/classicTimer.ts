import type { FeatureDef } from "../../createFlagCatalog";

export const classicTimerFeature = {
  id: "classicTimer",
  meta: {
    label: "Classic timer",
    description:
      "Shows the plain clock instead of the timer dial with its countdown arc and cycle dots.",
  },
} as const satisfies FeatureDef<"classicTimer">;
