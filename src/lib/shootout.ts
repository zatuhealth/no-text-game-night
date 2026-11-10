export type Kick = { shooter: 1 | 2; shot: number; dive: number; goal: boolean };

/** Kick index 0,2,4.. are taken by player 1; 1,3,5.. by player 2. */
export const shooterFor = (kickIndex: number): 1 | 2 => (kickIndex % 2 === 0 ? 1 : 2);

export function tally(kicks: Kick[]) {
  const a = kicks.filter((k) => k.shooter === 1 && k.goal).length;
  const b = kicks.filter((k) => k.shooter === 2 && k.goal).length;
  const ka = kicks.filter((k) => k.shooter === 1).length;
  const kb = kicks.filter((k) => k.shooter === 2).length;
  return { a, b, ka, kb };
}

/** Returns winning slot (1|2) or null if the shootout continues. Best of 5, then sudden death. */
export function winnerOf(kicks: Kick[]): 1 | 2 | null {
  const { a, b, ka, kb } = tally(kicks);
  if (ka <= 5 && kb <= 5 && !(ka === 5 && kb === 5)) {
    const ra = 5 - ka, rb = 5 - kb;
    if (a + ra < b) return 2;
    if (b + rb < a) return 1;
    return null;
  }
  if (ka === kb && a !== b) return a > b ? 1 : 2;
  return null;
}
