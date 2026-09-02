export type FeatureMeta = {
  label: string;
  description?: string;
};

export type FeatureDef<Id extends string = string> = {
  id: Id;
  meta: FeatureMeta;
};

/** Runtime enabled-map for a catalog of feature ids. */
export type FlagMap<Id extends string> = {
  [K in Id]?: boolean;
};

type CatalogFeatures = readonly FeatureDef[];

/** Build ids, meta, and lookup helpers from a browser feature list. */
export function createFlagCatalog<const Features extends CatalogFeatures>(
  features: Features,
) {
  type FeatureId = Features[number]["id"];

  const ids = features.map((feature) => feature.id) as FeatureId[];

  const meta = Object.fromEntries(
    features.map((feature) => [feature.id, feature.meta]),
  ) as Record<FeatureId, Features[number]["meta"]>;

  function isEnabled(
    flags: FlagMap<FeatureId> | undefined,
    featureId: FeatureId,
  ): boolean {
    return Boolean(flags?.[featureId]);
  }

  function getFeature(featureId: FeatureId): Features[number] {
    const feature = features.find((entry) => entry.id === featureId);
    if (!feature) {
      throw new Error(`Unknown feature: ${featureId}`);
    }
    return feature;
  }

  return {
    features,
    ids,
    meta,
    isEnabled,
    getFeature,
  };
}
