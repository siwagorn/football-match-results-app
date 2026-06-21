-- ----------------------------------------------------
-- SUPABASE DATABASE SCHEMA SETUP
-- Copy and paste this script into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ----------------------------------------------------

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    matches JSONB NOT NULL DEFAULT '[]'::JSONB,
    team_players JSONB NOT NULL DEFAULT '{}'::JSONB,
    match_mode TEXT NOT NULL DEFAULT 'fixed',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Row Level Security (RLS) Configuration
-- For a simple local group, we will allow anyone to read and write, 
-- and we protect writes on the UI level via an Admin Passcode.
-- To allow this, run the following to enable public access:

ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions DISABLE ROW LEVEL SECURITY;

-- OPTIONAL: If you want to enable RLS and allow public anonymous reads & writes:
-- ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read" ON public.teams FOR SELECT USING (true);
-- CREATE POLICY "Allow public write" ON public.teams FOR ALL USING (true);
-- CREATE POLICY "Allow public read" ON public.sessions FOR SELECT USING (true);
-- CREATE POLICY "Allow public write" ON public.sessions FOR ALL USING (true);

-- 4. Insert Default Teams (so the database is not empty at start)
INSERT INTO public.teams (id, name, color) VALUES
('team-1', 'ทีมสีน้ำเงิน', '#3b82f6'),
('team-2', 'ทีมสีแดง', '#ef4444'),
('team-3', 'ทีมสีเขียว', '#10b981'),
('team-4', 'ทีมสีเหลือง', '#f59e0b')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, color = EXCLUDED.color;
