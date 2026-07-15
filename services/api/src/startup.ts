export type ApiStartupPhaseName = "office" | "distribution";
export type ApiStartupStatus = "starting" | "ready" | "failed";

export interface ApiStartupPhaseSnapshot {
  readonly status: ApiStartupStatus;
  readonly startedAt: string;
  readonly readyAt: string | null;
  readonly durationMs: number | null;
}

export interface ApiStartupSnapshot {
  readonly status: ApiStartupStatus;
  readonly startedAt: string;
  readonly readyAt: string | null;
  readonly durationMs: number | null;
  readonly phases: Readonly<Record<ApiStartupPhaseName, ApiStartupPhaseSnapshot>>;
}

export interface ApiStartupReadiness {
  readonly waitForPath: (path: string) => Promise<void>;
  readonly waitUntilReady: () => Promise<void>;
  readonly snapshot: () => ApiStartupSnapshot;
}

interface MutablePhaseState {
  status: ApiStartupStatus;
  readonly startedAtMs: number;
  readyAtMs: number | null;
}

interface ApiStartupReadinessInput {
  readonly office: Promise<void>;
  readonly distribution: Promise<void>;
  readonly nowMs?: () => number;
}

export function createApiStartupReadiness(input: ApiStartupReadinessInput): ApiStartupReadiness {
  const nowMs = input.nowMs ?? Date.now;
  const startedAtMs = nowMs();
  const phaseState: Record<ApiStartupPhaseName, MutablePhaseState> = {
    office: createStartingPhase(startedAtMs),
    distribution: createStartingPhase(startedAtMs)
  };
  const phasePromises: Record<ApiStartupPhaseName, Promise<void>> = {
    office: trackPhase("office", input.office, phaseState, nowMs),
    distribution: trackPhase("distribution", input.distribution, phaseState, nowMs)
  };
  const allReady = Promise.all([phasePromises.office, phasePromises.distribution]).then(() => undefined);

  return {
    waitForPath: async (path: string): Promise<void> => {
      const requiredPhases = requiredStartupPhases(path);
      await Promise.all(requiredPhases.map((phase) => phasePromises[phase]));
    },
    waitUntilReady: async (): Promise<void> => allReady,
    snapshot: (): ApiStartupSnapshot => startupSnapshot(startedAtMs, phaseState, nowMs())
  };
}

export function requiredStartupPhases(path: string): readonly ApiStartupPhaseName[] {
  if (path.startsWith("/erh/v1/") || path.startsWith("/cc/v1/")) {
    return ["office", "distribution"];
  }

  if (!path.startsWith("/eof/v1/")) {
    return [];
  }

  if (
    path.startsWith("/eof/v1/advances")
    || /^\/eof\/v1\/partners\/[^/]+\/payee-link(?:\/|$)/u.test(path)
  ) {
    return ["office", "distribution"];
  }

  return ["office"];
}

function createStartingPhase(startedAtMs: number): MutablePhaseState {
  return {
    status: "starting",
    startedAtMs,
    readyAtMs: null
  };
}

function trackPhase(
  phase: ApiStartupPhaseName,
  promise: Promise<void>,
  state: Record<ApiStartupPhaseName, MutablePhaseState>,
  nowMs: () => number
): Promise<void> {
  return promise.then(
    (): void => {
      state[phase].status = "ready";
      state[phase].readyAtMs = nowMs();
    },
    (error: unknown): never => {
      state[phase].status = "failed";
      state[phase].readyAtMs = nowMs();
      throw error;
    }
  );
}

function startupSnapshot(
  startedAtMs: number,
  state: Record<ApiStartupPhaseName, MutablePhaseState>,
  observedAtMs: number
): ApiStartupSnapshot {
  const office = phaseSnapshot(state.office);
  const distribution = phaseSnapshot(state.distribution);
  const status = office.status === "failed" || distribution.status === "failed"
    ? "failed"
    : office.status === "ready" && distribution.status === "ready"
      ? "ready"
      : "starting";
  const readyAtMs = status === "starting"
    ? null
    : Math.max(state.office.readyAtMs ?? observedAtMs, state.distribution.readyAtMs ?? observedAtMs);

  return {
    status,
    startedAt: new Date(startedAtMs).toISOString(),
    readyAt: readyAtMs === null ? null : new Date(readyAtMs).toISOString(),
    durationMs: readyAtMs === null ? null : readyAtMs - startedAtMs,
    phases: { office, distribution }
  };
}

function phaseSnapshot(state: MutablePhaseState): ApiStartupPhaseSnapshot {
  const completedAtMs = state.readyAtMs;
  return {
    status: state.status,
    startedAt: new Date(state.startedAtMs).toISOString(),
    readyAt: completedAtMs === null ? null : new Date(completedAtMs).toISOString(),
    durationMs: completedAtMs === null ? null : completedAtMs - state.startedAtMs
  };
}
