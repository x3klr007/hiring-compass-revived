import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wraps useServerFn so every call automatically includes the current
 * Supabase access token as a Bearer Authorization header. Throws if the
 * user has no active session.
 */
export function useAuthedServerFn<TFn extends (...args: any[]) => any>(fn: TFn): TFn {
  const base = useServerFn(fn as any);

  return useCallback(
    (async (opts: any = {}) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("UNAUTHENTICATED");
      }
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
