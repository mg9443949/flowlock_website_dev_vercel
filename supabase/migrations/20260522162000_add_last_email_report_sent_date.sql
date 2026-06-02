-- Add last_email_report_sent_date to user_preferences to track daily report dispatch
ALTER TABLE public.user_preferences ADD COLUMN last_email_report_sent_date DATE;
