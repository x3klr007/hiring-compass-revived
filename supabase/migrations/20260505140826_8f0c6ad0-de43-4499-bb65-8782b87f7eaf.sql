-- ===== app_settings =====
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_admin_all" ON public.app_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "settings_auth_read" ON public.app_settings
  FOR SELECT USING (public.is_authenticated());

INSERT INTO public.app_settings (key, value)
VALUES
  ('secondary_admin_email', '"kh.alshabanat@tuwaiq.edu.sa"'::jsonb),
  ('cc_admin_on_messages', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ===== message_log =====
CREATE TABLE public.message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  candidate_id uuid,
  template_key text,
  channel text NOT NULL DEFAULT 'email',
  recipient text NOT NULL,
  cc text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'sent',
  provider_message_id text,
  error text,
  sent_by uuid
);
ALTER TABLE public.message_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msglog_auth_read" ON public.message_log
  FOR SELECT USING (public.is_authenticated());
CREATE POLICY "msglog_staff_insert" ON public.message_log
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_message_log_candidate ON public.message_log(candidate_id, created_at DESC);

-- ===== seed templates =====
INSERT INTO public.message_templates (template_key, name, channel, subject_en, subject_ar, body_en, body_ar)
VALUES
  ('application_confirmation','Application Confirmation','email',
    'Thank You for Applying','شكراً لتقديمك',
    'Dear [Name],\n\nThank you for applying for the [Position] role. Your application has been received and will be reviewed shortly.\n\nBest regards,\nTuwaiq Recruitment Team',
    'عزيزي/عزيزتي [Name]،\n\nشكراً لتقديمك على وظيفة [Position]. تم استلام طلبك وسيتم مراجعته قريباً.\n\nمع التحية،\nفريق التوظيف – طويق'),
  ('interview_invitation','Interview Invitation','email',
    'Personal Interview Invitation','دعوة لمقابلة شخصية',
    'Dear [Name],\n\nWe are pleased to invite you for an in-person interview on [Date] at [Time] in [Location] for the [Position] role.\n\nBest regards,\nTuwaiq Recruitment Team',
    'عزيزي/عزيزتي [Name]،\n\nيسعدنا دعوتك لإجراء مقابلة شخصية بتاريخ [Date] في تمام الساعة [Time] بمقر [Location] لوظيفة [Position].\n\nمع التحية،\nفريق التوظيف – طويق'),
  ('interview_reminder','Interview Reminder','email',
    'Reminder: Your Interview is Tomorrow','تذكير: مقابلتك غداً',
    'Dear [Name],\n\nThis is a reminder about your interview tomorrow [Date] at [Time]. We look forward to seeing you.\n\nBest regards,\nTuwaiq Recruitment Team',
    'عزيزي/عزيزتي [Name]،\n\nهذا تذكير بمقابلتك غداً بتاريخ [Date] في تمام الساعة [Time]. نتطلع للقائك.\n\nمع التحية،\nفريق التوظيف – طويق'),
  ('final_acceptance','Final Acceptance','email',
    'Congratulations! You Are Accepted','تهانينا! تم قبولك',
    'Dear [Name],\n\nWe are pleased to inform you of your acceptance for the [Position] role. Please contact us to complete the appointment procedures.\n\nBest regards,\nTuwaiq Recruitment Team',
    'عزيزي/عزيزتي [Name]،\n\nيسعدنا إبلاغك بقبولك لوظيفة [Position]. نرجو التواصل معنا لاستكمال إجراءات التعيين.\n\nمع التحية،\nفريق التوظيف – طويق'),
  ('rejection','Rejection','email',
    'Thank You for Your Interest','شكراً لاهتمامك',
    'Dear [Name],\n\nThank you for your interest in joining our team. Unfortunately, another candidate has been selected for the [Position] role at this time.\n\nBest regards,\nTuwaiq Recruitment Team',
    'عزيزي/عزيزتي [Name]،\n\nشكراً لاهتمامك بالانضمام إلى فريقنا. للأسف، تم اختيار مرشح آخر لوظيفة [Position] في هذه المرة.\n\nمع التحية،\nفريق التوظيف – طويق'),
  ('documents_request','Documents Request','email',
    'Required Documents for Appointment','المستندات المطلوبة للتعيين',
    'Dear [Name],\n\nPlease prepare the following documents for the appointment process: CV, National ID, Academic Certificates.\n\nBest regards,\nTuwaiq Recruitment Team',
    'عزيزي/عزيزتي [Name]،\n\nنرجو تجهيز المستندات التالية لإجراءات التعيين: السيرة الذاتية، الهوية الوطنية، الشهادات العلمية.\n\nمع التحية،\nفريق التوظيف – طويق')
ON CONFLICT (template_key) DO UPDATE
SET name = EXCLUDED.name,
    subject_en = EXCLUDED.subject_en,
    subject_ar = EXCLUDED.subject_ar,
    body_en = EXCLUDED.body_en,
    body_ar = EXCLUDED.body_ar;