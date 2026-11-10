CREATE TABLE public.rooms (
  code text PRIMARY KEY,
  p1_name text NOT NULL,
  p2_name text,
  status text NOT NULL DEFAULT 'waiting',
  kicks jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;

CREATE TABLE public.room_players (
  code text NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  slot int NOT NULL,
  token text NOT NULL,
  PRIMARY KEY (code, slot)
);
GRANT ALL ON public.room_players TO service_role;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.room_picks (
  code text NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  kick int NOT NULL,
  slot int NOT NULL,
  zone int NOT NULL,
  PRIMARY KEY (code, kick, slot)
);
GRANT ALL ON public.room_picks TO service_role;
ALTER TABLE public.room_picks ENABLE ROW LEVEL SECURITY;