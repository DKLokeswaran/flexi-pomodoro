import type { FeatureDef } from "../../createFlagCatalog";

export const hideContinueButtonFeature = {
  id: "hideContinueButton",
  meta: {
    label: 'Hide "Continue working" button',
    description:
      "Work auto-extends if you ignore the timer. Hiding removes the explicit shortcut.",
  },
} as const satisfies FeatureDef<"hideContinueButton">;
