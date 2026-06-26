export type CommandCenterAppSlug = "command-center";

export interface CommandCenterAppStub {
  readonly slug: CommandCenterAppSlug;
  readonly productArea: "admin-control-tower";
}

export const commandCenterAppStub: CommandCenterAppStub = {
  slug: "command-center",
  productArea: "admin-control-tower"
};
