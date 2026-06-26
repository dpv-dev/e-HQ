export type HqAppSlug = "hq";

export interface HqAppStub {
  readonly slug: HqAppSlug;
  readonly productArea: "front-door";
}

export const hqAppStub: HqAppStub = {
  slug: "hq",
  productArea: "front-door"
};
