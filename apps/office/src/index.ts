export type OfficeAppSlug = "office";

export interface OfficeAppStub {
  readonly slug: OfficeAppSlug;
  readonly productArea: "finance-cockpit";
}

export const officeAppStub: OfficeAppStub = {
  slug: "office",
  productArea: "finance-cockpit"
};
