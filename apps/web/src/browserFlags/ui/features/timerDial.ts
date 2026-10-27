import type { FeatureDef } from "../../createFlagCatalog";

export const timerDialFeature = {
  id: "timerDial",
  meta: {
    label: "Timer dial (preview)",
    description:
      "Shows the timer as a dial with a countdown arc and cycle dots instead of the plain clock.",
  },
} as const satisfies FeatureDef<"timerDial">;
