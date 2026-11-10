import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import stadium from "@/assets/stadium.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mobile Football — Penalty Shootout Online" },
      { name: "description", content: "Pick a corner 1–9 and beat the keeper. Free online penalty shootout game." },
      { property: "og:title", content: "Mobile Football — Penalty Shootout Online" },
      { property: "og:description", content: "Pick a corner 1–9 and beat the keeper." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});

// Goal box position inside the stadium image (percent)
const GOAL = { left: 34, top: 40, width: 31.6, height: 17 };
const COOLDOWN = 2500;
type Score = { name: string; points: number };

function zonePos(z: number) {
  const col = (z - 1) % 3, row = Math.floor((z - 1) / 3);
  return {
    x: GOAL.left + (GOAL.width * (col + 0.5)) / 3,
    y: GOAL.top + (GOAL.height * (row + 0.5)) / 3,
  };
}

function Game() {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [goals, setGoals] = useState(0);
  const [shots, setShots] = useState(0);
  const [board, setBoard] = useState<Score[]>([]);
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [keeper, setKeeper] = useState<number>(5);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBoard(JSON.parse(localStorage.getItem("pk-board") || "[]"));
    const n = localStorage.getItem("pk-name");
    if (n) { setName(n); setDraft(n); }
  }, []);

  function saveScore(n: string, pts: number) {
    const next = [...board.filter((s) => s.name !== n), { name: n, points: Math.max(pts, board.find((s) => s.name === n)?.points ?? 0) }]
      .sort((a, b) => b.points - a.points).slice(0, 5);
    setBoard(next);
    localStorage.setItem("pk-board", JSON.stringify(next));
  }

  function shoot(z: number) {
    if (busy || !name) return;
    setBusy(true);
    const k = Math.ceil(Math.random() * 9);
    setKeeper(k);
    setBall(zonePos(z));
    // keeper saves if same zone, or adjacent in the same row with 30% chance
    const sameRow = Math.floor((k - 1) / 3) === Math.floor((z - 1) / 3);
    const saved = k === z || (sameRow && Math.abs(k - z) === 1 && Math.random() < 0.3);
    setTimeout(() => {
      setShots((s) => s + 1);
      if (saved) setMsg("SAVED!");
      else {
        setMsg("GOOOOOL!");
        setGoals((g) => { saveScore(name, g + 1); return g + 1; });
      }
    }, 500);
    setTimeout(() => { setBall(null); setKeeper(5); setMsg(null); setBusy(false); }, COOLDOWN);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 9) shoot(n); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const kp = zonePos(keeper);
  const spot = { x: 50, y: 78 };
  const b = ball ?? spot;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center p-3 gap-4">
      <h1 className="font-display text-3xl md:text-5xl tracking-wide text-primary">Mobile Football</h1>

      <div className="relative w-full max-w-6xl aspect-[1600/912] overflow-hidden rounded-xl shadow-2xl border-4 border-card select-none">
        <img src={stadium} alt="Stadium" width={1600} height={912} className="absolute inset-0 w-full h-full object-cover" />

        <div className="absolute top-[3%] left-[2%] scoreboard px-3 py-1 text-center">
          <div className="text-2xl md:text-4xl font-display text-accent">{goals}</div>
          <div className="text-xs md:text-sm">Goals · {shots} shots</div>
        </div>

        <div className="absolute top-[3%] right-[2%] scoreboard p-2 md:p-3 w-[38%] md:w-[24%] text-xs md:text-sm">
          <div className="text-center font-display text-accent mb-1">TOP LIST</div>
          {board.length === 0 && <div className="text-center opacity-70">No scores yet</div>}
          {board.map((s, i) => (
            <div key={s.name} className="flex justify-between"><span>{i + 1}. {s.name}</span><span>{s.points}</span></div>
          ))}
        </div>

        {/* Zones */}
        <div className="absolute grid grid-cols-3 grid-rows-3"
          style={{ left: `${GOAL.left}%`, top: `${GOAL.top}%`, width: `${GOAL.width}%`, height: `${GOAL.height}%` }}>
          {Array.from({ length: 9 }, (_, i) => (
            <button key={i} onClick={() => shoot(i + 1)} disabled={busy || !name}
              className="zone font-display text-lg md:text-3xl">{i + 1}</button>
          ))}
        </div>

        {/* Keeper */}
        <div className="absolute transition-all duration-500 ease-out pointer-events-none"
          style={{ left: `${kp.x}%`, top: `${kp.y}%`, transform: `translate(-50%,-50%) rotate(${keeper % 3 === 1 ? -60 : keeper % 3 === 0 ? 60 : 0}deg)` }}>
          <svg viewBox="0 0 40 60" className="w-[4vw] max-w-14 min-w-6">
            <circle cx="20" cy="8" r="6" className="fill-keeper-skin" />
            <rect x="12" y="15" width="16" height="22" rx="4" className="fill-keeper" />
            <rect x="2" y="15" width="10" height="5" rx="2" className="fill-keeper" />
            <rect x="28" y="15" width="10" height="5" rx="2" className="fill-keeper" />
            <rect x="13" y="37" width="6" height="20" rx="2" className="fill-keeper-dark" />
            <rect x="21" y="37" width="6" height="20" rx="2" className="fill-keeper-dark" />
          </svg>
        </div>

        {/* Ball */}
        <div className="absolute transition-all duration-500 ease-in pointer-events-none text-[3vw]"
          style={{ left: `${b.x}%`, top: `${b.y}%`, transform: `translate(-50%,-50%) scale(${ball ? 0.5 : 1})` }}>⚽</div>

        {msg && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`font-display text-5xl md:text-8xl animate-in zoom-in ${msg === "SAVED!" ? "text-destructive" : "text-accent"} drop-shadow-lg`}>{msg}</span>
          </div>
        )}

        {!name && (
          <form onSubmit={(e) => { e.preventDefault(); const n = draft.trim().toUpperCase().slice(0, 12); if (!n) return; setName(n); localStorage.setItem("pk-name", n); }}
            className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-3 p-4">
            <p className="font-display text-xl md:text-3xl">Enter your nickname to play</p>
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. KADENGE"
                className="px-3 py-2 rounded-md bg-card text-card-foreground border border-border" />
              <button className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-bold">Play</button>
            </div>
          </form>
        )}

        {name && (
          <div className="absolute bottom-[3%] left-0 right-0 text-center font-display text-sm md:text-2xl text-shadow">
            {name} — tap a number 1–9 (or press the key) to shoot!
          </div>
        )}
      </div>

      {name && (
        <div className="flex gap-3 text-sm">
          <button className="underline text-muted-foreground" onClick={() => { setGoals(0); setShots(0); }}>New game</button>
          <button className="underline text-muted-foreground" onClick={() => { setName(""); setGoals(0); setShots(0); localStorage.removeItem("pk-name"); }}>Change player</button>
          <Link to="/online" search={{ room: undefined }} className="font-bold text-primary underline">Play online 1v1 →</Link>
        </div>
      )}
    </main>
  );
}
