CREATE TABLE public.drive_failure_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  req_id text,
  folder_id text,
  url text,
  status text,
  total_ms integer,
  attempts integer,
  reason text,
  suggestion text,
  actor_id uuid
);

ALTER TABLE public.drive_failure_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drive_fail_admin_read"
  ON public.drive_failure_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "drive_fail_auth_insert"
  ON public.drive_failure_logs
  FOR INSERT
  WITH CHECK (public.is_authenticated());

CREATE POLICY "drive_fail_admin_delete"
  ON public.drive_failure_logs
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_drive_failure_logs_created ON public.drive_failure_logs (created_at DESC);

CREATE OR REPLACE FUNCTION public.trim_drive_failure_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.drive_failure_logs
  WHERE id IN (
    SELECT id FROM public.drive_failure_logs
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_trim_drive_failure_logs
AFTER INSERT ON public.drive_failure_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.trim_drive_failure_logs();