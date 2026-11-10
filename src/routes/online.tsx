import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createRoom, joinRoom, mySlot, submitPick } from "@/lib/rooms.functions";
import { shooterFor, tally, type Kick } from "@/lib/shootout";
import stadium from "@/assets/stadium.jpg";

export const Route = createFileRoute("/online")({
  validateSearch: (s: Record<string, unknown>) => ({ room: typeof s.room === "string" ? s.room : undefined }),
  head: () => ({
    meta: [
      { title: "Online 1v1 Penalty Shootout — Mobile Football" },
      { name: "description", content: "Challenge a friend online: best-of-5 penalty shootout where you take turns as striker and goalkeeper." },
      { property: "og:title", content: "Online 1v1 Penalty Shootout — Mobile Football" },
      { property: "og:description", content: "Share a room code and battle a friend in a best-of-5 shootout." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Online,
});

type Room = { code: string; p1_name: string; p2_name: string | null; status: string; kicks: Kick[]; winner: number | null };
const GOAL = { left: 34, top: 40, width: 31.6, height: 17 };
const zonePos = (z: number) => ({
  x: GOAL.left + (GOAL.width * (((z - 1) % 3) + 0.5)) / 3,
  y: GOAL.top + (GOAL.height * (Math.floor((z - 1) / 3) + 0.5)) / 3,
});

function getToken() {
  let t = localStorage.getItem("pk-token");
  if (!t) { t = crypto.randomUUID(); localStorage.setItem("pk-token", t); }
  return t;
}

function Online() {
  const { room: roomCode } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [slot, setSlot] = useState<1 | 2 | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [anim, setAnim] = useState<Kick | null>(null);
  const lastLen = useRef(0);

  useEffect(() => { setName(localStorage.getItem("pk-name") ?? ""); }, []);

  // Load room + subscribe
  useEffect(() => {
    if (!roomCode) { setRoom(null); return; }
    const token = getToken();
    let active = true;
    supabase.from("rooms").select("*").eq("code", roomCode).maybeSingle().then(({ data }) => {
      if (!active) return;
      if (!data) { setErr("Room not found"); return; }
      lastLen.current = (data.kicks as Kick[]).length;
      setRoom(data as unknown as Room);
    });
    mySlot({ data: { token, code: roomCode } }).then((r) => active && setSlot(r.slot as 1 | 2 | null));
    const ch = supabase.channel(`room-${roomCode}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${roomCode}` },
        (p) => setRoom(p.new as unknown as Room))
      .subscribe();
    // Backup sync in case a live update is missed
    const poll = setInterval(async () => {
      const { data } = await supabase.from("rooms").select("*").eq("code", roomCode).maybeSingle();
      if (active && data) setRoom((prev) => (prev && JSON.stringify(prev) === JSON.stringify(data) ? prev : (data as unknown as Room)));
    }, 2000);
    return () => { active = false; clearInterval(poll); supabase.removeChannel(ch); };
  }, [roomCode]);

  // Animate newly resolved kicks
  useEffect(() => {
    if (!room) return;
    if (room.kicks.length > lastLen.current) {
      setAnim(room.kicks[room.kicks.length - 1]);
      setPicked(null);
      lastLen.current = room.kicks.length;
      setTimeout(() => setAnim(null), 2200);
    }
  }, [room]);

  function saveName() {
    const n = name.trim().toUpperCase().slice(0, 12);
    if (!n) { setErr("Enter a nickname first"); return null; }
    localStorage.setItem("pk-name", n);
    return n;
  }

  async function create() {
    setErr(null); const n = saveName(); if (!n) return;
    try {
      const r = await createRoom({ data: { name: n, token: getToken() } });
      navigate({ search: { room: r.code } });
    } catch (e) { setErr((e as Error).message); }
  }
  async function join(c: string) {
    setErr(null); const n = saveName(); if (!n) return;
    try {
      const r = await joinRoom({ data: { name: n, token: getToken(), code: c.trim().toUpperCase() } });
      setSlot(r.slot as 1 | 2);
      navigate({ search: { room: c.trim().toUpperCase() } });
    } catch (e) { setErr((e as Error).message); }
  }
  async function pick(z: number) {
    if (!room || picked || anim) return;
    setPicked(z);
    try { await submitPick({ data: { token: getToken(), code: room.code, zone: z } }); }
    catch (e) { setErr((e as Error).message); setPicked(null); }
  }

  const score = useMemo(() => (room ? tally(room.kicks) : null), [room]);

  // ---------- Lobby ----------
  if (!roomCode) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 gap-6">
        <h1 className="font-display text-4xl md:text-6xl text-primary text-center">Online 1v1 Shootout</h1>
        <p className="text-muted-foreground text-center max-w-md">Best of 5 penalties. You take turns: shoot, then dive as goalkeeper. Tied after 5? Sudden death!</p>
        <div className="w-full max-w-sm flex flex-col gap-3 bg-card text-card-foreground p-5 rounded-xl border border-border">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your nickname" maxLength={12}
            className="px-3 py-2 rounded-md bg-background border border-border" />
          <button onClick={create} className="py-2 rounded-md bg-primary text-primary-foreground font-bold">Create match</button>
          <div className="text-center text-xs text-muted-foreground">or join a friend</div>
          <div className="flex gap-2">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Room code"
              className="flex-1 px-3 py-2 rounded-md bg-background border border-border uppercase" />
            <button onClick={() => join(joinCode)} className="px-4 py-2 rounded-md bg-accent text-accent-foreground font-bold">Join</button>
          </div>
          {err && <p className="text-destructive text-sm">{err}</p>}
        </div>
        <Link to="/" className="underline text-muted-foreground text-sm">Practice vs computer</Link>
      </main>
    );
  }

  if (!room) return <main className="min-h-screen bg-background text-foreground flex items-center justify-center">{err ?? "Loading match…"}</main>;

  const kickIdx = room.kicks.length;
  const shooter = shooterFor(kickIdx);
  const iShoot = slot === shooter;
  const names = { 1: room.p1_name, 2: room.p2_name ?? "…" };
  const spectator = slot === null;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/online?room=${room.code}` : "";

  const ball = anim ? zonePos(anim.shot) : { x: 50, y: 78 };
  const keeperZone = anim ? anim.dive : 5;
  const kp = zonePos(keeperZone);

  const dots = (p: 1 | 2) => {
    const mine = room.kicks.filter((k) => k.shooter === p);
    const n = Math.max(5, mine.length);
    return Array.from({ length: n }, (_, i) => (
      <span key={i} className={`inline-block w-3 h-3 md:w-4 md:h-4 rounded-full border border-border ${i < mine.length ? (mine[i].goal ? "bg-accent" : "bg-destructive") : "bg-muted"}`} />
    ));
  };

  let status = "";
  if (room.status === "waiting") status = "Waiting for opponent to join…";
  else if (room.status === "done") status = room.winner === slot ? "🏆 YOU WIN!" : spectator ? `${names[room.winner as 1 | 2]} wins!` : "You lost — good game!";
  else if (anim) status = anim.goal ? "GOOOOOL!" : "SAVED!";
  else if (spectator) status = `${names[shooter]} to shoot`;
  else if (picked) status = "Locked in — waiting for opponent…";
  else status = iShoot ? "You're the STRIKER — pick where to shoot" : "You're the KEEPER — pick where to dive";

  // Join prompt for 2nd player arriving via link
  const canJoin = spectator && room.status === "waiting";

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-3 gap-3">
      <div className="w-full max-w-6xl flex items-center justify-between gap-2 flex-wrap">
        <Link to="/online" search={{ room: undefined }} className="underline text-muted-foreground text-sm">← Lobby</Link>
        <span className="font-display text-primary text-xl">Room {room.code}</span>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-card text-card-foreground rounded-xl p-3 border border-border">
        <div className="flex flex-col gap-1">
          <span className="font-display text-lg md:text-2xl">{names[1]}{slot === 1 && " (you)"}</span>
          <div className="flex gap-1 flex-wrap">{dots(1)}</div>
        </div>
        <div className="font-display text-3xl md:text-5xl text-accent">{score?.a} – {score?.b}</div>
        <div className="flex flex-col gap-1 items-end">
          <span className="font-display text-lg md:text-2xl">{names[2]}{slot === 2 && " (you)"}</span>
          <div className="flex gap-1 flex-wrap justify-end">{dots(2)}</div>
        </div>
      </div>

      <div className="relative w-full max-w-6xl aspect-[1600/912] overflow-hidden rounded-xl shadow-2xl border-4 border-card select-none">
        <img src={stadium} alt="Stadium" width={1600} height={912} className="absolute inset-0 w-full h-full object-cover" />

        <div className="absolute grid grid-cols-3 grid-rows-3"
          style={{ left: `${GOAL.left}%`, top: `${GOAL.top}%`, width: `${GOAL.width}%`, height: `${GOAL.height}%` }}>
          {Array.from({ length: 9 }, (_, i) => (
            <button key={i} onClick={() => pick(i + 1)}
              disabled={spectator || room.status !== "playing" || !!picked || !!anim}
              className={`zone font-display text-lg md:text-3xl ${picked === i + 1 ? "ring-4 ring-accent" : ""}`}>{i + 1}</button>
          ))}
        </div>

        <div className="absolute transition-all duration-500 ease-out pointer-events-none"
          style={{ left: `${kp.x}%`, top: `${kp.y}%`, transform: `translate(-50%,-50%) rotate(${keeperZone % 3 === 1 ? -60 : keeperZone % 3 === 0 ? 60 : 0}deg)` }}>
          <svg viewBox="0 0 40 60" className="w-[4vw] max-w-14 min-w-6">
            <circle cx="20" cy="8" r="6" className="fill-keeper-skin" />
            <rect x="12" y="15" width="16" height="22" rx="4" className="fill-keeper" />
            <rect x="2" y="15" width="10" height="5" rx="2" className="fill-keeper" />
            <rect x="28" y="15" width="10" height="5" rx="2" className="fill-keeper" />
            <rect x="13" y="37" width="6" height="20" rx="2" className="fill-keeper-dark" />
            <rect x="21" y="37" width="6" height="20" rx="2" className="fill-keeper-dark" />
          </svg>
        </div>
        <div className="absolute transition-all duration-500 ease-in pointer-events-none text-[3vw]"
          style={{ left: `${ball.x}%`, top: `${ball.y}%`, transform: `translate(-50%,-50%) scale(${anim ? 0.5 : 1})` }}>⚽</div>

        <div className="absolute bottom-[3%] left-0 right-0 text-center font-display text-base md:text-3xl text-shadow px-2">{status}</div>

        {room.status === "waiting" && (
          <div className="absolute inset-0 bg-background/75 flex flex-col items-center justify-center gap-3 p-4 text-center">
            {canJoin ? (
              <>
                <p className="font-display text-xl md:text-3xl">{room.p1_name} challenges you!</p>
                <div className="flex gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your nickname" maxLength={12}
                    className="px-3 py-2 rounded-md bg-card text-card-foreground border border-border" />
                  <button onClick={() => join(room.code)} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold">Join match</button>
                </div>
              </>
            ) : (
              <>
                <p className="font-display text-xl md:text-3xl">Share this code with your opponent</p>
                <p className="font-display text-5xl md:text-7xl text-accent tracking-widest">{room.code}</p>
                <button onClick={() => navigator.clipboard?.writeText(shareUrl)} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold">Copy invite link</button>
              </>
            )}
            {err && <p className="text-destructive text-sm">{err}</p>}
          </div>
        )}

        {room.status === "done" && !anim && (
          <div className="absolute inset-0 bg-background/75 flex flex-col items-center justify-center gap-3">
            <p className="font-display text-4xl md:text-7xl text-accent">{status}</p>
            <p className="font-display text-2xl">{score?.a} – {score?.b}</p>
            <Link to="/online" search={{ room: undefined }} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold">New match</Link>
          </div>
        )}
      </div>
    </main>
  );
}
