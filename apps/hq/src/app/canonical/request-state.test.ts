import { describe, expect, it } from "vitest";

import {
  createErrorState,
  createIdleState,
  createLoadingState,
  createSuccessState
} from "@ehq/api-client";
import {
  apiRequestStateLabel,
  apiRequestStateLabelFr,
  isApiRequestLoading
} from "./request-state.js";

describe("canonical request-state helpers", () => {
  it("treats idle and loading as loading states", () => {
    const idleState = createIdleState<unknown>();
    const loadingState = createLoadingState<unknown>();
    const successState = createSuccessState<unknown>({});
    const errorState = createErrorState<unknown>(new Error("boom"));

    expect(isApiRequestLoading(idleState)).toBe(true);
    expect(isApiRequestLoading(loadingState)).toBe(true);
    expect(isApiRequestLoading(successState)).toBe(false);
    expect(isApiRequestLoading(errorState)).toBe(false);
  });

  it("returns consistent English state labels", () => {
    const idleState = createIdleState<unknown>();
    const loadingState = createLoadingState<unknown>();
    const successState = createSuccessState<unknown>({});
    const errorState = createErrorState<unknown>(new Error("boom"));

    expect(apiRequestStateLabel(idleState)).toBe("loading");
    expect(apiRequestStateLabel(loadingState)).toBe("loading");
    expect(apiRequestStateLabel(successState)).toBe("loaded");
    expect(apiRequestStateLabel(errorState)).toBe("error");
  });

  it("returns consistent French state labels", () => {
    const idleState = createIdleState<unknown>();
    const loadingState = createLoadingState<unknown>();
    const successState = createSuccessState<unknown>({});
    const errorState = createErrorState<unknown>(new Error("boom"));

    expect(apiRequestStateLabelFr(idleState)).toBe("chargement");
    expect(apiRequestStateLabelFr(loadingState)).toBe("chargement");
    expect(apiRequestStateLabelFr(successState)).toBe("chargé");
    expect(apiRequestStateLabelFr(errorState)).toBe("erreur");
  });
});
