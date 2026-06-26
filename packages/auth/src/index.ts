export type WorkspaceAppId = "command-center" | "office" | "distribution";
export type WorkspaceAccessStatus = "allowed" | "locked";
export type AuthRoleId = "administrator" | "operator" | "office" | "distribution" | "viewer";
export type PreviewUserStatus = "active" | "review";

export type AuthMetadata = Readonly<Record<string, unknown>>;

export interface WorkspaceAccess {
  readonly workspaceId: WorkspaceAppId;
  readonly status: WorkspaceAccessStatus;
  readonly reason: string | null;
}

export interface AuthSession {
  readonly userId: string;
  readonly workspaceId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly roleLabel: string;
  readonly roleId: AuthRoleId;
  readonly access: readonly WorkspaceAccess[];
}

export interface AuthRuntime {
  readonly session: AuthSession;
}

export interface PreviewPermissionUser {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly initials: string;
  readonly roleLabel: string;
  readonly roleId: AuthRoleId;
  readonly status: PreviewUserStatus;
  readonly session: AuthSession;
}

export interface WorkspaceAccessInput {
  readonly workspaceId: WorkspaceAppId;
  readonly allowed: boolean;
  readonly reason: string | null;
}

export interface AuthSessionInput {
  readonly userId: string;
  readonly workspaceId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly roleLabel: string;
  readonly roleId: AuthRoleId;
  readonly access: readonly WorkspaceAccessInput[];
}

export interface AuthIdentityInput {
  readonly userId: string;
  readonly email: string | null;
  readonly appMetadata: AuthMetadata;
  readonly userMetadata: AuthMetadata;
}

export interface AuthRoleProfile {
  readonly roleId: AuthRoleId;
  readonly roleLabel: string;
  readonly allowedWorkspaces: readonly WorkspaceAppId[];
}

export function createWorkspaceAccess(input: WorkspaceAccessInput): WorkspaceAccess {
  return {
    workspaceId: input.workspaceId,
    status: input.allowed ? "allowed" : "locked",
    reason: input.allowed ? null : input.reason
  };
}

export function createAuthSession(input: AuthSessionInput): AuthSession {
  return {
    userId: input.userId,
    workspaceId: input.workspaceId,
    displayName: input.displayName,
    initials: input.initials,
    roleLabel: input.roleLabel,
    roleId: input.roleId,
    access: input.access.map(createWorkspaceAccess)
  };
}

export function createAuthRuntime(): AuthRuntime {
  return {
    session: createPreviewAuthSession("administrator")
  };
}

export function createPreviewAuthSession(roleId: AuthRoleId): AuthSession {
  const profile = getAuthRoleProfile(roleId);
  const previewUser = getPreviewUserForRole(roleId);

  return createRoleSession({
    userId: previewUser.userId,
    workspaceId: "eeee-mu",
    displayName: previewUser.displayName,
    initials: previewUser.initials,
    roleId: profile.roleId,
    roleLabel: profile.roleLabel,
    allowedWorkspaces: profile.allowedWorkspaces
  });
}

export function getPreviewRoleForEmail(email: string): AuthRoleId {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail.startsWith("david@")) {
    return "administrator";
  }

  if (normalizedEmail.startsWith("office@")) {
    return "office";
  }

  if (normalizedEmail.startsWith("distribution@")) {
    return "distribution";
  }

  return "operator";
}

export function createPreviewAuthSessionForEmail(email: string): AuthSession {
  return createPreviewAuthSession(getPreviewRoleForEmail(email));
}

export function createAuthSessionFromIdentity(input: AuthIdentityInput): AuthSession {
  const roleId = getAuthRoleFromMetadata(input.appMetadata, input.userMetadata);
  const profile = getAuthRoleProfile(roleId);
  const displayName = displayNameFromIdentity(input.email, input.userMetadata);
  const workspaceId = workspaceIdFromMetadata(input.appMetadata, input.userMetadata);

  return createRoleSession({
    userId: input.userId,
    workspaceId,
    displayName,
    initials: initialsFromDisplayName(displayName, input.email),
    roleId: profile.roleId,
    roleLabel: profile.roleLabel,
    allowedWorkspaces: profile.allowedWorkspaces
  });
}

export function getAuthRoleFromMetadata(appMetadata: AuthMetadata, userMetadata: AuthMetadata): AuthRoleId {
  return normalizeAuthRoleId(
    stringFromMetadata(appMetadata, "role") ??
      stringFromMetadata(userMetadata, "role") ??
      stringFromMetadata(appMetadata, "ehq_role") ??
      stringFromMetadata(userMetadata, "ehq_role")
  );
}

export function normalizeAuthRoleId(role: string | null): AuthRoleId {
  const normalizedRole = role?.trim().toLowerCase() ?? "";

  if (normalizedRole === "administrator" || normalizedRole === "admin") {
    return "administrator";
  }

  if (normalizedRole === "operator") {
    return "operator";
  }

  if (normalizedRole === "office") {
    return "office";
  }

  if (normalizedRole === "distribution") {
    return "distribution";
  }

  return "viewer";
}

export function getAuthRoleProfile(roleId: AuthRoleId): AuthRoleProfile {
  if (roleId === "administrator") {
    return {
      roleId,
      roleLabel: "administrator",
      allowedWorkspaces: ["command-center", "office", "distribution"]
    };
  }

  if (roleId === "office") {
    return {
      roleId,
      roleLabel: "office",
      allowedWorkspaces: ["office"]
    };
  }

  if (roleId === "distribution") {
    return {
      roleId,
      roleLabel: "distribution",
      allowedWorkspaces: ["distribution"]
    };
  }

  if (roleId === "operator") {
    return {
      roleId,
      roleLabel: "operator",
      allowedWorkspaces: ["office", "distribution"]
    };
  }

  return {
    roleId,
    roleLabel: "viewer",
    allowedWorkspaces: []
  };
}

export function createPreviewPermissionUsers(): readonly PreviewPermissionUser[] {
  return [
    createPreviewPermissionUser({
      email: "david@eeee.mu",
      status: "active",
      session: createPreviewAuthSession("administrator")
    }),
    createPreviewPermissionUser({
      email: "office@eeee.mu",
      status: "active",
      session: createPreviewAuthSession("office")
    }),
    createPreviewPermissionUser({
      email: "distribution@eeee.mu",
      status: "active",
      session: createPreviewAuthSession("distribution")
    }),
    createPreviewPermissionUser({
      email: "operator@eeee.mu",
      status: "review",
      session: createPreviewAuthSession("operator")
    })
  ];
}

export function getWorkspaceAccess(session: AuthSession, workspaceId: WorkspaceAppId): WorkspaceAccess {
  const access = session.access.find((item: WorkspaceAccess): boolean => item.workspaceId === workspaceId);

  if (access === undefined) {
    return {
      workspaceId,
      status: "locked",
      reason: "Permission missing"
    };
  }

  return access;
}

export function canAccessWorkspace(session: AuthSession, workspaceId: WorkspaceAppId): boolean {
  return getWorkspaceAccess(session, workspaceId).status === "allowed";
}

interface RoleSessionInput {
  readonly userId: string;
  readonly workspaceId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly roleId: AuthRoleId;
  readonly roleLabel: string;
  readonly allowedWorkspaces: readonly WorkspaceAppId[];
}

export const allWorkspaces: readonly WorkspaceAppId[] = ["command-center", "office", "distribution"];

interface PreviewPermissionUserInput {
  readonly email: string;
  readonly status: PreviewUserStatus;
  readonly session: AuthSession;
}

interface PreviewUser {
  readonly userId: string;
  readonly displayName: string;
  readonly initials: string;
}

function createPreviewPermissionUser(input: PreviewPermissionUserInput): PreviewPermissionUser {
  return {
    userId: input.session.userId,
    email: input.email,
    displayName: input.session.displayName,
    initials: input.session.initials,
    roleLabel: input.session.roleLabel,
    roleId: input.session.roleId,
    status: input.status,
    session: input.session
  };
}

function createRoleSession(input: RoleSessionInput): AuthSession {
  return createAuthSession({
    userId: input.userId,
    workspaceId: input.workspaceId,
    displayName: input.displayName,
    initials: input.initials,
    roleLabel: input.roleLabel,
    roleId: input.roleId,
    access: allWorkspaces.map((workspaceId: WorkspaceAppId): WorkspaceAccessInput => ({
      workspaceId,
      allowed: input.allowedWorkspaces.includes(workspaceId),
      reason: input.allowedWorkspaces.includes(workspaceId) ? null : "Access requires elevated privileges"
    }))
  });
}

function getPreviewUserForRole(roleId: AuthRoleId): PreviewUser {
  if (roleId === "administrator") {
    return {
      userId: "user_david_preview",
      displayName: "David",
      initials: "DV"
    };
  }

  if (roleId === "office") {
    return {
      userId: "user_office_preview",
      displayName: "Office user",
      initials: "OF"
    };
  }

  if (roleId === "distribution") {
    return {
      userId: "user_distribution_preview",
      displayName: "Distribution user",
      initials: "DI"
    };
  }

  if (roleId === "operator") {
    return {
      userId: "user_operator_preview",
      displayName: "Operator",
      initials: "OP"
    };
  }

  return {
    userId: "user_viewer_preview",
    displayName: "Viewer",
    initials: "VI"
  };
}

function stringFromMetadata(metadata: AuthMetadata, key: string): string | null {
  const value = metadata[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? null : trimmedValue;
}

function displayNameFromIdentity(email: string | null, userMetadata: AuthMetadata): string {
  const metadataName =
    stringFromMetadata(userMetadata, "display_name") ??
    stringFromMetadata(userMetadata, "full_name") ??
    stringFromMetadata(userMetadata, "name");

  if (metadataName !== null) {
    return metadataName;
  }

  if (email !== null && email.trim().length > 0) {
    const localPart = email.trim().split("@")[0] ?? "";
    if (localPart.length > 0) {
      return localPart;
    }
  }

  return "E user";
}

function workspaceIdFromMetadata(appMetadata: AuthMetadata, userMetadata: AuthMetadata): string {
  return (
    stringFromMetadata(appMetadata, "workspace_id") ??
    stringFromMetadata(appMetadata, "workspaceId") ??
    stringFromMetadata(userMetadata, "workspace_id") ??
    stringFromMetadata(userMetadata, "workspaceId") ??
    "eeee-mu"
  );
}

function initialsFromDisplayName(displayName: string, email: string | null): string {
  const words = displayName
    .trim()
    .split(/\s+/u)
    .filter((word: string): boolean => word.length > 0);

  if (words.length >= 2) {
    return `${words[0]?.charAt(0) ?? ""}${words[1]?.charAt(0) ?? ""}`.toUpperCase();
  }

  const firstWord = words[0] ?? "";
  if (firstWord.length >= 2) {
    return firstWord.slice(0, 2).toUpperCase();
  }

  if (email !== null && email.trim().length >= 2) {
    return email.trim().slice(0, 2).toUpperCase();
  }

  return "EU";
}
