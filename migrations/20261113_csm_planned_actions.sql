-- 2026-11-13: independent scheduling of CSM work.
-- Work history remains in csm_contacts, feature adoption in csm_camp_features,
-- discovery in csm_camp_profile_values. No history is deleted or rewritten.
CREATE TABLE IF NOT EXISTS public.csm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.csm_camps(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL CHECK (length(btrim(title)) > 0 AND length(title) <= 220),
  due_date date NOT NULL,
  due_time time,
  trigger_type text NOT NULL DEFAULT 'agreement'
    CHECK (trigger_type IN ('agreement','stale','profile','blocker','renewal','launch','manual')),
  note text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','done','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS csm_tasks_assignee_due_idx
  ON public.csm_tasks(assigned_to,due_date) WHERE status='open';
CREATE INDEX IF NOT EXISTS csm_tasks_camp_idx ON public.csm_tasks(camp_id);
ALTER TABLE public.csm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY csm_tasks_select ON public.csm_tasks FOR SELECT TO authenticated
USING (csm_is_manager() OR (csm_is_active_user() AND assigned_to=(SELECT auth.uid()) AND csm_can_access_camp(camp_id)));
CREATE POLICY csm_tasks_insert ON public.csm_tasks FOR INSERT TO authenticated
WITH CHECK (csm_is_manager() OR (csm_is_active_user() AND assigned_to=(SELECT auth.uid()) AND created_by=(SELECT auth.uid()) AND csm_can_access_camp(camp_id)));
CREATE POLICY csm_tasks_update ON public.csm_tasks FOR UPDATE TO authenticated
USING (csm_is_manager() OR (csm_is_active_user() AND assigned_to=(SELECT auth.uid()) AND csm_can_access_camp(camp_id)))
WITH CHECK (csm_is_manager() OR (csm_is_active_user() AND assigned_to=(SELECT auth.uid()) AND csm_can_access_camp(camp_id)));
CREATE POLICY csm_tasks_delete ON public.csm_tasks FOR DELETE TO authenticated
USING (csm_is_manager() OR (csm_is_active_user() AND assigned_to=(SELECT auth.uid()) AND csm_can_access_camp(camp_id)));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.csm_tasks TO authenticated;
