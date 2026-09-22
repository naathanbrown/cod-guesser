import mapsJson from "@/data/maps.json";

export type GameId =
  | "cod1"
  | "uo"
  | "cod2"
  | "cod3"
  | "cod4"
  | "waw"
  | "mw2"
  | "bo1"
  | "mw3"
  | "bo2"
  | "ghosts"
  | "aw"
  | "bo3"
  | "iw"
  | "wwii"
  | "bo4"
  | "mw2019"
  | "cw"
  | "vg"
  | "mwii"
  | "mwiii"
  | "bo6"
  | "bo7";

export type CoverBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

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
  minimap: string | null;
  cover?: CoverBox[];
  minimapCover?: CoverBox[];
  source: string;
};

export type Round = {
  answer: MapCard;
  choices: MapCard[];
};

export const maps = mapsJson as MapCard[];

export const games: { id: GameId; short: string; year: number }[] = [
  { id: "cod1", short: "CoD", year: 2003 },
  { id: "uo", short: "United Offensive", year: 2004 },
  { id: "cod2", short: "CoD2", year: 2005 },
  { id: "cod3", short: "CoD3", year: 2006 },
  { id: "cod4", short: "CoD4", year: 2007 },
  { id: "waw", short: "World at War", year: 2008 },
  { id: "mw2", short: "MW2", year: 2009 },
  { id: "bo1", short: "Black Ops", year: 2010 },
  { id: "mw3", short: "MW3", year: 2011 },
  { id: "bo2", short: "Black Ops II", year: 2012 },
  { id: "ghosts", short: "Ghosts", year: 2013 },
  { id: "aw", short: "AW", year: 2014 },
  { id: "bo3", short: "Black Ops III", year: 2015 },
  { id: "iw", short: "IW", year: 2016 },
  { id: "wwii", short: "WWII", year: 2017 },
  { id: "bo4", short: "Black Ops 4", year: 2018 },
  { id: "mw2019", short: "MW", year: 2019 },
  { id: "cw", short: "Cold War", year: 2020 },
  { id: "vg", short: "Vanguard", year: 2021 },
  { id: "mwii", short: "MWII", year: 2022 },
  { id: "mwiii", short: "MWIII", year: 2023 },
  { id: "bo6", short: "Black Ops 6", year: 2024 },
  { id: "bo7", short: "Black Ops 7", year: 2025 },
];

export type GamePreset = {
  id: string;
  label: string;
  games: GameId[];
};

export const presets: GamePreset[] = [
  { id: "pre-mw", label: "Pre-MW", games: ["cod1", "uo", "cod2", "cod3"] },
  { id: "golden", label: "Golden era", games: ["cod4", "waw", "mw2", "bo1", "mw3", "bo2"] },
  { id: "treyarch", label: "Treyarch", games: ["cod3", "waw", "bo1", "bo2", "bo3", "bo4", "cw", "bo6", "bo7"] },
  {
    id: "infinity-ward",
    label: "Infinity Ward",
    games: ["cod1", "cod2", "cod4", "mw2", "mw3", "ghosts", "iw", "mw2019", "mwii"],
  },
  { id: "sledgehammer", label: "Sledgehammer", games: ["aw", "wwii", "vg", "mwiii"] },
  { id: "black-ops", label: "Black Ops", games: ["bo1", "bo2", "bo3", "bo4", "cw", "bo6", "bo7"] },
  { id: "modern-warfare", label: "Modern Warfare", games: ["cod4", "mw2", "mw3", "mw2019", "mwii", "mwiii"] },
  { id: "jetpacks", label: "Jetpacks", games: ["aw", "bo3", "iw"] },
  { id: "all", label: "All", games: games.map((game) => game.id) },
];

export function sameGameSet(left: readonly GameId[], right: readonly GameId[]): boolean {
  if (left.length !== right.length) return false;
  const have = new Set(left);
  return right.every((id) => have.has(id));
}

export const CHOICE_ROUND_MS = 20_000;
export const TYPED_ROUND_MS = 30_000;
export const ROUND_MS = CHOICE_ROUND_MS;
export const ROUND_OPTIONS = [5, 10, 15] as const;
export type RoundLength = (typeof ROUND_OPTIONS)[number] | "unlimited";
export type AnswerMode = "choice" | "typed";

export function roundDuration(mode: AnswerMode): number {
  return mode === "typed" ? TYPED_ROUND_MS : CHOICE_ROUND_MS;
}
export type Picture = "loading" | "minimap";
export type PlayKind = "custom" | "daily" | "remake";
export const DAILY_ROUNDS = 10;
export const DAILY_SEED_PREFIX = "callout-daily-v1";

const SEASONAL_NAME = /\b(holiday|halloween|christmas|shipmas)\b/;

const REMAKE_FAMILIES: { key: string; names: string[] }[] = [
  { key: "nuketown", names: ["nuketown", "nuketown 2025", "nuk3town", "nuketown 84"] },
  { key: "shipment", names: ["shipment", "shipment 1944", "arena shipment", "sunny shipment"] },
];

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function previousDateKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

export function nextDailyStreak(previous: { date: string; days?: number } | null, today: string): number {
  if (!previous) return 1;
  if (previous.date === today) return previous.days ?? 1;
  if (previous.date === previousDateKey(today)) return (previous.days ?? 1) + 1;
  return 1;
}

export function rngFromSeed(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyPool(): MapCard[] {
  return maps.filter((map) => map.standard);
}

export function buildDailyRounds(dateKey: string): Round[] {
  return buildRounds(dailyPool(), DAILY_ROUNDS, "choice", rngFromSeed(`${DAILY_SEED_PREFIX}-${dateKey}`));
}

export function formatDailyShare(input: {
  date: string;
  correct: number;
  rounds: number;
  score: number;
  days?: number;
}): string {
  const rank = rankFor(input.rounds === 0 ? 0 : input.correct / input.rounds);
  const streak = input.days && input.days > 0 ? `\n${input.days} day streak` : "";
  return `Callout Daily — ${formatDateLabel(input.date)}\n${input.correct}/${input.rounds} · ${rank.title}\n${input.score.toLocaleString("en-US")}${streak}`;
}

export function remakeFamilyKey(map: MapCard): string | null {
  const name = normalizeGuess(map.name);
  if (SEASONAL_NAME.test(name)) return null;
  for (const family of REMAKE_FAMILIES) {
    if (family.names.includes(name)) return family.key;
  }
  return name;
}

export function remakeGroups(pool: readonly MapCard[] = maps): MapCard[][] {
  const buckets = new Map<string, MapCard[]>();
  for (const map of pool) {
    const key = remakeFamilyKey(map);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(map);
    buckets.set(key, list);
  }
  return [...buckets.values()].filter((group) => new Set(group.map((map) => map.gameId)).size >= 2);
}

export function remakePool(picture: Picture): MapCard[] {
  const source = maps.filter((map) => picture === "loading" || Boolean(map.minimap));
  return remakeGroups(source).flat();
}

export function versionLabel(map: MapCard): string {
  return `${map.short} · ${map.year}`;
}

export function buildRemakeRound(
  answer: MapCard,
  picture: Picture,
  rng: () => number = Math.random,
): Round {
  const key = remakeFamilyKey(answer);
  const group =
    remakeGroups(maps.filter((map) => picture === "loading" || Boolean(map.minimap))).find(
      (mapsInGroup) => remakeFamilyKey(mapsInGroup[0]) === key,
    ) ?? [answer];
  return { answer, choices: shuffle(group, rng) };
}

export function buildRemakeRounds(
  pool: readonly MapCard[],
  count: number,
  picture: Picture,
  rng: () => number = Math.random,
): Round[] {
  return shuffle(pool, rng)
    .slice(0, Math.min(count, pool.length))
    .map((answer) => buildRemakeRound(answer, picture, rng));
}

export function dealRemakeRound(
  pool: readonly MapCard[],
  dealt: readonly string[],
  picture: Picture,
  rng: () => number = Math.random,
): { round: Round; dealt: string[] } {
  let remaining = pool.filter((map) => !dealt.includes(map.id));
  let nextDealt = [...dealt];
  if (remaining.length === 0) {
    const lastId = dealt.at(-1);
    remaining = pool.filter((map) => map.id !== lastId);
    if (remaining.length === 0) remaining = [...pool];
    nextDealt = [];
  }
  const answer = remaining[Math.floor(rng() * remaining.length)];
  return {
    round: buildRemakeRound(answer, picture, rng),
    dealt: [...nextDealt, answer.id],
  };
}

export function normalizeGuess(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function guessMatches(guess: string, map: MapCard): boolean {
  const normalized = normalizeGuess(guess);
  return normalized.length > 0 && normalized === normalizeGuess(map.name);
}

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

export function createRound(
  answer: MapCard,
  pool: readonly MapCard[],
  mode: AnswerMode,
  rng: () => number = Math.random,
): Round {
  return {
    answer,
    choices: mode === "choice" ? buildChoices(answer, pool, rng) : [],
  };
}

export function buildRounds(
  pool: readonly MapCard[],
  count: number,
  mode: AnswerMode = "choice",
  rng: () => number = Math.random,
): Round[] {
  return shuffle(pool, rng)
    .slice(0, Math.min(count, pool.length))
    .map((answer) => createRound(answer, pool, mode, rng));
}

export function dealRound(
  pool: readonly MapCard[],
  dealt: readonly string[],
  mode: AnswerMode,
  rng: () => number = Math.random,
): { round: Round; dealt: string[] } {
  let remaining = pool.filter((map) => !dealt.includes(map.id));
  let nextDealt = [...dealt];
  if (remaining.length === 0) {
    const lastId = dealt.at(-1);
    remaining = pool.filter((map) => map.id !== lastId);
    if (remaining.length === 0) remaining = [...pool];
    nextDealt = [];
  }
  const answer = remaining[Math.floor(rng() * remaining.length)];
  return {
    round: createRound(answer, pool, mode, rng),
    dealt: [...nextDealt, answer.id],
  };
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
