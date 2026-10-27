-- Keep the school stage enum in sync with the application.
ALTER TYPE public.school_stage
ADD VALUE IF NOT EXISTS 'kindergarten';
