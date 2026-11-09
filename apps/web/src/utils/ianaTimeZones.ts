/** Browser-supported IANA zones for the settings timezone combobox. */
export const ianaTimeZones: readonly string[] =
  typeof Intl !== "undefined" &&
  "supportedValuesOf" in Intl &&
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC"];
