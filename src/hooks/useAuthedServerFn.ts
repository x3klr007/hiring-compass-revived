import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Refresh the token if it expires within this window (seconds).
const REFRESH_THRESHOLD_SEC = 60;

async function getFreshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0; // unix seconds
  const nowSec = Math.floor(Date.now() / 1000);
  const needsRefresh = expiresAt - nowSec <= REFRESH_THRESHOLD_SEC;

  if (needsRefresh) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) return null;
    return refreshed.session.access_token;
  }
  return session.access_token;
}

/**
 * Wraps useServerFn so every call:
 *  1. Performs a preflight: re-acquires (and refreshes if near expiry) the
 *     Supabase access token.
 *  2. Attaches it as a Bearer Authorization header automatically.
 * Throws "UNAUTHENTICATED" if no valid session can be obtained.
 */
export function useAuthedServerFn<TFn extends (...args: any[]) => any>(fn: TFn): TFn {
  const base = useServerFn(fn as any);

  return useCallback(
    (async (opts: any = {}) => {
      const token = await getFreshAccessToken();
      if (!token) throw new Error("UNAUTHENTICATED");
      return base({
        ...opts,
        headers: {
          ...(opts?.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      });
    }) as unknown as TFn,
    [base]
  );
}
