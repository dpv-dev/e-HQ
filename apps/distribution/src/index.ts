export type DistributionAppSlug = "distribution";

export interface DistributionAppStub {
  readonly slug: DistributionAppSlug;
  readonly productArea: "music-business-engine";
}

export const distributionAppStub: DistributionAppStub = {
  slug: "distribution",
  productArea: "music-business-engine"
};
