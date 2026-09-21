import mapsJson from "@/data/maps.json";

export type GameId = "cod4" | "waw" | "mw2" | "bo1" | "mw3" | "bo2";

export type MapCard = {
  id: string;
  name: string;
  gameId: GameId;
  game: string;
  short: string;
  year: number;
  standard: boolean;
  blurb: string;
  image: string;
  source: string;
};

export type Round = {
  answer: MapCard;
  choices: MapCard[];
};

export const maps = mapsJson as MapCard[];

export const games: { id: GameId; short: string; year: number }[] = [
  { id: "cod4", short: "CoD4", year: 2007 },
  { id: "waw", short: "World at War", year: 2008 },
  { id: "mw2", short: "MW2", year: 2009 },
  { id: "bo1", short: "Black Ops", year: 2010 },
  { id: "mw3", short: "MW3", year: 2011 },
  { id: "bo2", short: "Black Ops II", year: 2012 },
];

export const ROUND_MS = 20_000;
export const ROUND_OPTIONS = [5, 10, 15] as const;

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function choiceLabel(map: MapCard, choices: readonly MapCard[]): string {
  const shared = choices.some((other) => other.id !== map.id && other.name === map.name);
  return shared ? `${map.name} · ${map.short}` : map.name;
}

function take<T>(items: readonly T[], count: number, rng: () => number): T[] {
  return shuffle(items, rng).slice(0, count);
}

export function buildChoices(answer: MapCard, pool: readonly MapCard[], rng: () => number = Math.random): MapCard[] {
  const picks: MapCard[] = [];
  const used = new Set<string>([answer.id]);

  const add = (candidate: MapCard | undefined) => {
    if (!candidate || used.has(candidate.id) || picks.length >= 3) return;
    used.add(candidate.id);
    picks.push(candidate);
  };

  const twins = pool.filter((map) => map.name === answer.name && map.id !== answer.id);
  if (twins.length > 0 && rng() < 0.7) add(twins[Math.floor(rng() * twins.length)]);

  const sameGame = pool.filter(
    (map) => map.gameId === answer.gameId && map.id !== answer.id && map.name !== answer.name,
  );
  const others = pool.filter((map) => map.gameId !== answer.gameId && map.name !== answer.name);

  for (const map of [...take(sameGame, 3, rng), ...take(others, 6, rng)]) add(map);

  if (picks.length < 3) {
    for (const map of shuffle(pool, rng)) add(map);
  }

  return shuffle([answer, ...picks], rng);
}

export function buildRounds(pool: readonly MapCard[], count: number, rng: () => number = Math.random): Round[] {
  return shuffle(pool, rng)
    .slice(0, Math.min(count, pool.length))
    .map((answer) => ({ answer, choices: buildChoices(answer, pool, rng) }));
}

export function scoreRound(input: {
  correct: boolean;
  remainingMs: number;
  streak: number;
  intel: boolean;
}): number {
  if (!input.correct) return 0;
  const timeBonus = Math.round((input.remainingMs / 1000) * 50);
  const raw = 1000 + timeBonus + input.streak * 100;
  return input.intel ? Math.round(raw / 2) : raw;
}

export function rankFor(accuracy: number): { title: string; line: string } {
  if (accuracy === 1) return { title: "Flawless", line: "Every map. No misses." };
  if (accuracy >= 0.9) return { title: "Legend", line: "Almost a perfect lobby." };
  if (accuracy >= 0.75) return { title: "Ghost", line: "You know these loading screens." };
  if (accuracy >= 0.6) return { title: "Operator", line: "A solid read on the roster." };
  if (accuracy >= 0.4) return { title: "Sergeant", line: "The famous ones are sticking." };
  if (accuracy >= 0.2) return { title: "Private", line: "A few maps are coming back." };
  return { title: "Recruit", line: "The roster is still new." };
}
