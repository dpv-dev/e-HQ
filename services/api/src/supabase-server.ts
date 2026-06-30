import { Hono } from "hono";
import { withSupabase } from "@supabase/server/adapters/hono";
import type { SupabaseContext } from "@supabase/server";

// Hono bindings for routes that use the official @supabase/server SDK.
// The middleware attaches `supabaseContext` (RLS-scoped client, admin client,
// and verified JWT claims) to the Hono context.
export interface SupabaseBindings {
  Variables: {
    supabaseContext: SupabaseContext;
  };
}

// Builds an isolated router wired to @supabase/server. It reads its configuration
// from the environment of the running process:
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_JWKS_URL
// The secret key must only ever be provided as a runtime env var, never committed.
export function createSupabaseRouter(): Hono<SupabaseBindings> {
  const router = new Hono<SupabaseBindings>();

  // Validate the inbound user JWT and create the request-scoped clients.
  // `auth: "user"` rejects requests without a valid Supabase user token.
  router.use("*", withSupabase({ auth: "user" }));

  // Reference endpoint: returns the authenticated user's identity, proving the
  // SDK is wired. Build real RLS-scoped data routes from `supabaseContext.supabase`.
  router.get("/me", (context) => {
    const { userClaims, authMode } = context.var.supabaseContext;
    return context.json({ user: userClaims, authMode });
  });

  return router;
}
