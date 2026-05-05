import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const REFRESH_THRESHOLD_SEC = 60;
const LOG_PREFIX = "[useAuthedServerFn]";

async function getFreshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    console.warn(`${LOG_PREFIX} no active session`);
    return null;
  }

  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = expiresAt - nowSec;
  const needsRefresh = ttl <= REFRESH_THRESHOLD_SEC;

  console.debug(`${LOG_PREFIX} session ttl=${ttl}s needsRefresh=${needsRefresh}`);

  if (needsRefresh) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) {
      console.error(`${LOG_PREFIX} token refresh failed`, error);
      return null;
    }
    console.debug(`${LOG_PREFIX} token refreshed`);
    return refreshed.session.access_token;
  }
  return session.access_token;
}

function fnName(fn: unknown): string {
  return (fn as { name?: string })?.name || "anonymous";
}

/**
 * Wraps useServerFn so every call:
 *  1. Preflights and refreshes the Supabase access token if near expiry.
 *  2. Attaches it as a Bearer Authorization header automatically.
 *  3. Emits detailed client-side logs (auth presence, timing, status,
 *     response body shape) for diagnosing server function failures.
 */
export function useAuthedServerFn<TFn extends (...args: any[]) => any>(fn: TFn): TFn {
  const base = useServerFn(fn as any);
  const name = fnName(fn);

  return useCallback(
    (async (opts: any = {}) => {
      const reqId = Math.random().toString(36).slice(2, 8);
      const start = performance.now();
      const log = (lvl: "debug" | "info" | "warn" | "error", ...args: unknown[]) =>
        console[lvl](`${LOG_PREFIX}[${name}#${reqId}]`, ...args);

      const token = await getFreshAccessToken();
      const hasAuth = !!token;
      log("info", "→ calling", {
        hasAuthHeader: hasAuth,
        tokenPreview: token ? `${token.slice(0, 8)}…(${token.length})` : null,
        extraHeaders: Object.keys(opts?.headers ?? {}),
        hasData: opts?.data !== undefined,
      });
      if (!token) {
        log("error", "✗ aborting: UNAUTHENTICATED (no Supabase session)");
        throw new Error("UNAUTHENTICATED");
      }

      try {
        const result = await base({
          ...opts,
          headers: {
            ...(opts?.headers ?? {}),
            Authorization: `Bearer ${token}`,
          },
        });
        const durMs = Math.round(performance.now() - start);
        const isObj = result && typeof result === "object";
        log("info", "✓ ok", {
          durMs,
          status: 200,
          resultType: Array.isArray(result) ? "array" : typeof result,
          resultKeys: isObj && !Array.isArray(result) ? Object.keys(result) : undefined,
          resultLength: Array.isArray(result) ? result.length : undefined,
        });
        return result;
      } catch (err) {
        const durMs = Math.round(performance.now() - start);
        const e = err as {
          message?: string;
          status?: number;
          response?: Response;
          body?: unknown;
        };
        let bodyText: string | undefined;
        if (e?.response && typeof e.response.text === "function") {
          try {
            bodyText = await e.response.clone().text();
          } catch {
            // ignore
          }
        }
        log("error", "✗ failed", {
          durMs,
          status: e?.status ?? e?.response?.status,
          message: e?.message,
          body: bodyText ?? e?.body,
          error: err,
        });
        throw err;
      }
    }) as unknown as TFn,
    [base, name]
  );
}
