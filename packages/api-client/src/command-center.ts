import { createRestTransport, encodePathSegment } from "./transport.js";
import type {
  ApiClientConfig,
  CommandCenterOverviewResponse,
  ApiMutationReceipt,
  CommandCenterNotificationsResponse,
  CommandCenterIntegrationToggleRequest,
  CommandCenterSettingUpdateRequest,
  CommandCenterUserPermissionUpdateRequest,
  CommandCenterWorkspaceQuery
} from "./types.js";

export interface CommandCenterApiClient {
  readonly getOverview: (query: CommandCenterWorkspaceQuery) => Promise<CommandCenterOverviewResponse>;
  readonly updateSetting: (
    request: CommandCenterSettingUpdateRequest,
    options: { readonly idempotencyKey: string }
  ) => Promise<ApiMutationReceipt>;
  readonly toggleIntegration: (
    request: CommandCenterIntegrationToggleRequest,
    options: { readonly idempotencyKey: string }
  ) => Promise<ApiMutationReceipt>;
  readonly updateUserPermission: (
    request: CommandCenterUserPermissionUpdateRequest,
    options: { readonly idempotencyKey: string }
  ) => Promise<ApiMutationReceipt>;
  readonly getStatus: (query: CommandCenterWorkspaceQuery) => Promise<{ readonly writesEnabled: boolean }>;
  readonly listNotifications: (query: CommandCenterWorkspaceQuery) => Promise<CommandCenterNotificationsResponse>;
}

export function createCommandCenterApiClient(config: ApiClientConfig): CommandCenterApiClient {
  const transport = createRestTransport(config, "cc/v1");

  return {
    getOverview: (query: CommandCenterWorkspaceQuery): Promise<CommandCenterOverviewResponse> =>
      transport.get<CommandCenterOverviewResponse>("overview", {
        workspaceId: query.workspaceId
      }),
    updateSetting: (
      request: CommandCenterSettingUpdateRequest,
      options: { readonly idempotencyKey: string }
    ): Promise<ApiMutationReceipt> => transport.post<ApiMutationReceipt>("settings", request, options.idempotencyKey),
    toggleIntegration: (
      request: CommandCenterIntegrationToggleRequest,
      options: { readonly idempotencyKey: string }
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `integrations/${encodePathSegment(request.integrationId)}/toggle`,
        request,
        options.idempotencyKey
      ),
    updateUserPermission: (
      request: CommandCenterUserPermissionUpdateRequest,
      options: { readonly idempotencyKey: string }
    ): Promise<ApiMutationReceipt> =>
      transport.post<ApiMutationReceipt>(
        `users/${encodePathSegment(request.userId)}/permissions`,
        request,
        options.idempotencyKey
      ),
    getStatus: (query: CommandCenterWorkspaceQuery): Promise<{ readonly writesEnabled: boolean }> =>
      transport.get<{ readonly writesEnabled: boolean }>("status", {
        workspaceId: query.workspaceId
      }),
    listNotifications: (query: CommandCenterWorkspaceQuery): Promise<CommandCenterNotificationsResponse> =>
      transport.get<CommandCenterNotificationsResponse>("notifications", {
        workspaceId: query.workspaceId
      })
  };
}
