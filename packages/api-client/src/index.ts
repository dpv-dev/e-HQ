import { createCommandCenterApiClient, type CommandCenterApiClient } from "./command-center.js";
import { createDistributionApiClient, type DistributionApiClient } from "./distribution.js";
import { createOfficeApiClient, type OfficeApiClient } from "./office.js";
import type { ApiClientConfig } from "./types.js";

export interface EhqApiClient {
  readonly commandCenter: CommandCenterApiClient;
  readonly office: OfficeApiClient;
  readonly distribution: DistributionApiClient;
}

export function createApiClient(config: ApiClientConfig): EhqApiClient {
  return {
    commandCenter: createCommandCenterApiClient(config),
    office: createOfficeApiClient(config),
    distribution: createDistributionApiClient(config)
  };
}

export * from "./command-center.js";
export * from "./distribution.js";
export * from "./errors.js";
export * from "./office.js";
export * from "./state.js";
export * from "./transport.js";
export * from "./types.js";
