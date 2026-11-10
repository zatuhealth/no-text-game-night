import { describe, it, expect } from "vitest";
import { winnerOf, type Kick } from "@/lib/shootout";

const k = (shooter: 1 | 2, goal: boolean): Kick => ({ shooter, goal, shot: 1, dive: 2 });

describe("shootout rules", () => {
  it("ends early when one side cannot catch up (3-0 after 3 rounds)", () => {
    const kicks = [k(1, true), k(2, false), k(1, true), k(2, false), k(1, true), k(2, false)];
    expect(winnerOf(kicks)).toBe(1);
  });
  it("continues when tied after 5 each, then sudden death decides", () => {
    const five = Array.from({ length: 10 }, (_, i) => k(i % 2 === 0 ? 1 : 2, true));
    expect(winnerOf(five)).toBeNull();
    expect(winnerOf([...five, k(1, false), k(2, true)])).toBe(2);
  });
  it("sudden death waits for both players to kick", () => {
    const five = Array.from({ length: 10 }, (_, i) => k(i % 2 === 0 ? 1 : 2, true));
    expect(winnerOf([...five, k(1, true)])).toBeNull();
  });
});
