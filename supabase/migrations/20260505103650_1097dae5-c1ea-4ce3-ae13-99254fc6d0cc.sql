
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter', 'hiring_manager', 'interviewer');
CREATE TYPE public.lang_code AS ENUM ('ar', 'en');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  preferred_language public.lang_code NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN LANGUAGE SQL STABLE SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','recruiter')
  )
$$;

-- Profile auto-create + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'recruiter');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles_self_or_admin_read" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- ============ BRANCHES ============
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  region TEXT NOT NULL,
  is_hq BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_auth_read" ON public.branches FOR SELECT USING (public.is_authenticated());
CREATE POLICY "branches_admin_write" ON public.branches FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.branches (code, name_en, name_ar, region, is_hq, display_order) VALUES
 ('RUH','Riyadh HQ','الرياض (المقر الرئيسي)','Central',true,1),
 ('JED','Jeddah','جدة','Western',false,2),
 ('DMM','Dammam','الدمام','Eastern',false,3),
 ('AHB','Abha','أبها','Southern',false,4),
 ('AHS','Al Ahsa','الأحساء','Eastern',false,5),
 ('MED','Madinah','المدينة المنورة','Western',false,6),
 ('MEC','Makkah','مكة المكرمة','Western',false,7),
 ('TAB','Tabuk','تبوك','Northern',false,8),
 ('HAI','Hail','حائل','Northern',false,9),
 ('NAJ','Najran','نجران','Southern',false,10);

-- ============ COMMITTEES ============
CREATE TABLE public.committees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm_auth_read" ON public.committees FOR SELECT USING (public.is_authenticated());
CREATE POLICY "comm_admin_write" ON public.committees FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.committees (name_ar, name_en) VALUES
 ('الشبانات','Al Shabanat Committee'),
 ('الخزمري','Al Khazmari Committee'),
 ('اللجنة المركزية','Central Committee');

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  region TEXT NOT NULL,
  branch TEXT NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  headcount INT NOT NULL DEFAULT 1,
  hired_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Open',
  priority TEXT NOT NULL DEFAULT 'Normal',
  description TEXT,
  hiring_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  target_fill_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_auth_read" ON public.jobs FOR SELECT USING (public.is_authenticated());
CREATE POLICY "jobs_staff_write" ON public.jobs FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE SEQUENCE IF NOT EXISTS public.job_code_seq START 1;
CREATE OR REPLACE FUNCTION public.set_job_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.job_code IS NULL OR NEW.job_code = '' THEN
    NEW.job_code := 'JOB-' || LPAD(nextval('public.job_code_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_job_code BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_job_code();

-- ============ PIPELINE STAGES ============
CREATE TABLE public.pipeline_stages (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  name_ar TEXT,
  display_order INT NOT NULL,
  sla_days INT NOT NULL DEFAULT 5,
  color TEXT DEFAULT '#6366f1',
  is_terminal BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stages_auth_read" ON public.pipeline_stages FOR SELECT USING (public.is_authenticated());
CREATE POLICY "stages_admin_write" ON public.pipeline_stages FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.pipeline_stages (name, name_ar, display_order, sla_days, color, is_terminal) VALUES
  ('Applied',     'تم التقديم',  1, 3, '#94a3b8', false),
  ('Screening',   'الفرز',       2, 4, '#3b82f6', false),
  ('Interview',   'المقابلة',    3, 7, '#8b5cf6', false),
  ('Offer',       'العرض',       4, 5, '#f59e0b', false),
  ('Hired',       'تم التعيين',  5, 0, '#10b981', true),
  ('Rejected',    'مرفوض',       6, 0, '#ef4444', true);

-- ============ CANDIDATES ============
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  gender TEXT,
  source TEXT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'Applied',
  status TEXT NOT NULL DEFAULT 'Active',
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stage_entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hired_date DATE,
  score INT NOT NULL DEFAULT 0,
  recommendation TEXT,
  screening_result TEXT,
  cv_url TEXT,
  cv_text TEXT,
  vision_used BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email)
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cand_auth_read" ON public.candidates FOR SELECT USING (public.is_authenticated());
CREATE POLICY "cand_staff_write" ON public.candidates FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE SEQUENCE IF NOT EXISTS public.candidate_code_seq START 1;
CREATE OR REPLACE FUNCTION public.set_candidate_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.candidate_code IS NULL OR NEW.candidate_code = '' THEN
    NEW.candidate_code := 'CAN-' || LPAD(nextval('public.candidate_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_candidate_code BEFORE INSERT ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_candidate_code();

CREATE OR REPLACE FUNCTION public.handle_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_entry_date := CURRENT_DATE;
    IF NEW.stage = 'Hired' AND OLD.stage <> 'Hired' THEN
      NEW.hired_date := CURRENT_DATE;
      IF NEW.job_id IS NOT NULL THEN
        UPDATE public.jobs SET hired_count = hired_count + 1 WHERE id = NEW.job_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_handle_stage_change BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.handle_stage_change();

CREATE OR REPLACE FUNCTION public.apply_tiering()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.score >= 80 THEN
    NEW.screening_result := 'Tier 1 – Fast Track';
    IF NEW.stage = 'Applied' THEN NEW.stage := 'Screening'; END IF;
  ELSIF NEW.score >= 60 THEN
    NEW.screening_result := 'Tier 2 – Review';
  ELSIF NEW.score > 0 THEN
    NEW.screening_result := 'Tier 3 – Below Threshold';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_tiering BEFORE INSERT OR UPDATE OF score ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.apply_tiering();

-- ============ SCORECARDS ============
CREATE TABLE public.scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  evaluator_name TEXT,
  evaluator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tech_30 INT NOT NULL DEFAULT 0,
  pers_25 INT NOT NULL DEFAULT 0,
  exp_20 INT NOT NULL DEFAULT 0,
  learn_15 INT NOT NULL DEFAULT 0,
  comm_10 INT NOT NULL DEFAULT 0,
  total INT GENERATED ALWAYS AS (tech_30 + pers_25 + exp_20 + learn_15 + comm_10) STORED,
  comments TEXT,
  rationale_ar TEXT,
  rationale_en TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_auth_read" ON public.scorecards FOR SELECT USING (public.is_authenticated());
CREATE POLICY "sc_staff_write" ON public.scorecards FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ INTERVIEW SCHEDULE ============
CREATE TABLE public.interview_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  committee_id UUID REFERENCES public.committees(id) ON DELETE SET NULL,
  committee_name TEXT NOT NULL,
  region TEXT NOT NULL,
  interviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_minutes INT NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  result TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iv_auth_read" ON public.interview_schedule FOR SELECT USING (public.is_authenticated());
CREATE POLICY "iv_staff_write" ON public.interview_schedule FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ OFFERS ============
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  salary NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'SAR',
  expected_start_date DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "off_auth_read" ON public.offers FOR SELECT USING (public.is_authenticated());
CREATE POLICY "off_staff_write" ON public.offers FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ MESSAGE TEMPLATES ============
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject_en TEXT,
  subject_ar TEXT,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmpl_auth_read" ON public.message_templates FOR SELECT USING (public.is_authenticated());
CREATE POLICY "tmpl_admin_write" ON public.message_templates FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.message_templates (template_key, name, subject_en, subject_ar, body_en, body_ar) VALUES
('application_received','Application Received','Application Received','تم استلام طلبك',
 E'Dear {{candidate_name}},\n\nThank you for applying for the {{job_title}} position. We have received your application and will review it shortly.\n\nBest regards,\nRecruitment Team',
 E'عزيزي {{candidate_name}}،\n\nشكراً لتقديمك لوظيفة {{job_title}}. لقد استلمنا طلبك وسنقوم بمراجعته قريباً.\n\nمع أطيب التحيات،\nفريق التوظيف'),
('interview_invitation','Interview Invitation','Interview Invitation','دعوة للمقابلة',
 E'Dear {{candidate_name}},\n\nYou are invited for an interview on {{interview_date}} at {{interview_time}}. Location: {{location}}.\n\nBest regards,\nRecruitment Team',
 E'عزيزي {{candidate_name}}،\n\nتمت دعوتك للمقابلة بتاريخ {{interview_date}} الساعة {{interview_time}}. الموقع: {{location}}.\n\nمع أطيب التحيات،\nفريق التوظيف'),
('job_offer','Job Offer','Job Offer','عرض عمل',
 E'Dear {{candidate_name}},\n\nCongratulations! We are pleased to offer you the {{job_title}} position. Please review the attached offer letter.\n\nBest regards,\nRecruitment Team',
 E'عزيزي {{candidate_name}}،\n\nمبروك! يسعدنا أن نقدم لك وظيفة {{job_title}}. الرجاء مراجعة خطاب العرض المرفق.\n\nمع أطيب التحيات،\nفريق التوظيف'),
('rejection','Rejection','Application Update','تحديث بشأن طلبك',
 E'Dear {{candidate_name}},\n\nThank you for your interest in the {{job_title}} position. After careful consideration, we have decided to move forward with other candidates.\n\nBest regards,\nRecruitment Team',
 E'عزيزي {{candidate_name}}،\n\nشكراً لاهتمامك بوظيفة {{job_title}}. بعد دراسة متأنية، قررنا المضي قدماً مع مرشحين آخرين.\n\nمع أطيب التحيات،\nفريق التوظيف');

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_log FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit_auth_insert" ON public.audit_log FOR INSERT WITH CHECK (public.is_authenticated());

CREATE OR REPLACE FUNCTION public.audit_candidate_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'stage_change', 'candidate', NEW.id::text,
            jsonb_build_object('from', OLD.stage, 'to', NEW.stage, 'candidate', NEW.full_name));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_audit_candidate_stage AFTER UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.audit_candidate_stage();

-- ============ STORAGE BUCKET FOR CVs ============
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "cvs_staff_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'cvs' AND public.is_authenticated());
CREATE POLICY "cvs_staff_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cvs' AND public.is_staff(auth.uid()));
CREATE POLICY "cvs_staff_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'cvs' AND public.is_staff(auth.uid()));
CREATE POLICY "cvs_staff_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'cvs' AND public.is_staff(auth.uid()));
