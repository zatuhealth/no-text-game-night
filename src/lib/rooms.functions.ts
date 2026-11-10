import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { shooterFor, winnerOf, type Kick } from "./shootout";

const name = z.string().trim().min(1).max(12);
const token = z.string().min(10).max(80);
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/);

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function slotFor(db: Awaited<ReturnType<typeof admin>>, c: string, t: string) {
  const { data } = await db.from("room_players").select("slot").eq("code", c).eq("token", t).maybeSingle();
  return data?.slot as 1 | 2 | undefined;
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name, token }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    for (let i = 0; i < 5; i++) {
      const c = Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, "X");
      const { error } = await db.from("rooms").insert({ code: c, p1_name: data.name.toUpperCase() });
      if (error) continue;
      await db.from("room_players").insert({ code: c, slot: 1, token: data.token });
      return { code: c };
    }
    throw new Error("Could not create room, try again");
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ name, token, code }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const existing = await slotFor(db, data.code, data.token);
    if (existing) return { slot: existing };
    const { data: room } = await db.from("rooms").select("*").eq("code", data.code).maybeSingle();
    if (!room) throw new Error("Room not found");
    if (room.status !== "waiting") throw new Error("Room is full");
    const { error } = await db.from("room_players").insert({ code: data.code, slot: 2, token: data.token });
    if (error) throw new Error("Room is full");
    await db.from("rooms").update({ p2_name: data.name.toUpperCase(), status: "playing", updated_at: new Date().toISOString() }).eq("code", data.code);
    return { slot: 2 as const };
  });

export const mySlot = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, code }).parse(d))
  .handler(async ({ data }) => ({ slot: (await slotFor(await admin(), data.code, data.token)) ?? null }));

export const submitPick = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token, code, zone: z.number().int().min(1).max(9) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const slot = await slotFor(db, data.code, data.token);
    if (!slot) throw new Error("You are not in this room");
    const { data: room } = await db.from("rooms").select("*").eq("code", data.code).single();
    if (room.status !== "playing") throw new Error("Match not in progress");
    const kicks = room.kicks as Kick[];
    const kick = kicks.length;
    await db.from("room_picks").upsert({ code: data.code, kick, slot, zone: data.zone }, { onConflict: "code,kick,slot", ignoreDuplicates: true });
    const { data: picks } = await db.from("room_picks").select("slot,zone").eq("code", data.code).eq("kick", kick);
    if (!picks || picks.length < 2) return { waiting: true };
    const shooter = shooterFor(kick);
    const shot = picks.find((p) => p.slot === shooter)!.zone;
    const dive = picks.find((p) => p.slot !== shooter)!.zone;
    const next = [...kicks, { shooter, shot, dive, goal: shot !== dive }];
    const w = winnerOf(next);
    // Guard against double resolution: only update if kick count unchanged
    await db.from("rooms")
      .update({ kicks: next, status: w ? "done" : "playing", winner: w, updated_at: new Date().toISOString() })
      .eq("code", data.code).eq("updated_at", room.updated_at);
    return { waiting: false };
  });
