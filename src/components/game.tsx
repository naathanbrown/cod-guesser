"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHOICE_ROUND_MS,
  DAILY_ROUNDS,
  ROUND_OPTIONS,
  buildDailyRounds,
  buildRemakeRounds,
  buildRounds,
  choiceLabel,
  dealRemakeRound,
  dealRound,
  formatDailyShare,
  formatDateLabel,
  games,
  guessMatches,
  localDateKey,
  maps,
  nextDailyStreak,
  presets,
  rankFor,
  remakePool,
  roundDuration,
  sameGameSet,
  scoreRound,
  versionLabel,
  type AnswerMode,
  type CoverBox,
  type GameId,
  type MapCard,
  type Picture,
  type PlayKind,
  type Round,
  type RoundLength,
} from "@/lib/game";
import { playCue } from "@/lib/sound";
import { cn } from "@/lib/utils";

type Roster = "launch" | "all";

type Answer = {
  mapId: string;
  correct: boolean;
  pickedId: string | null;
  guess: string | null;
  timedOut: boolean;
  points: number;
};

type Guess = { mapId?: string | null; text?: string | null };

type Run = {
  kind: PlayKind;
  dateKey?: string;
  mode: AnswerMode;
  picture: Picture;
  unlimited: boolean;
  pool: MapCard[];
  dealt: string[];
  rounds: Round[];
  index: number;
  score: number;
  streak: number;
  bestStreak: number;
  answers: Answer[];
  intel: boolean;
  eliminatedId: string | null;
  remaining: number;
  roundMs: number;
  days?: number;
  phase: "question" | "reveal";
  pickedId: string | null;
  guess: string | null;
  timedOut: boolean;
  points: number;
};

type DailyRecord = {
  date: string;
  score: number;
  correct: number;
  rounds: number;
  bestStreak: number;
  answers: Answer[];
  days: number;
};

type Best = { score: number; correct: number; rounds: number };

const BEST_KEY = "callout-best";
const MUTE_KEY = "callout-muted";
const DAILY_KEY = "callout-daily";
const KOFI_URL = "https://ko-fi.com/naathanbrown";

function formatScore(value: number) {
  return value.toLocaleString("en-US");
}

let cachedBestRaw: string | null | undefined;
let cachedBest: Best | null = null;

function readBest(): Best | null {
  const raw = window.localStorage.getItem(BEST_KEY);
  if (raw === cachedBestRaw) return cachedBest;
  cachedBestRaw = raw;
  if (!raw) {
    cachedBest = null;
    return null;
  }
  try {
    cachedBest = JSON.parse(raw) as Best;
  } catch {
    cachedBest = null;
  }
  return cachedBest;
}

function writeBest(value: Best) {
  const raw = JSON.stringify(value);
  window.localStorage.setItem(BEST_KEY, raw);
  cachedBestRaw = raw;
  cachedBest = value;
}

function subscribeBrowserStore() {
  return () => {};
}

let cachedDailyRaw: string | null | undefined;
let cachedDaily: DailyRecord | null = null;

function readDaily(): DailyRecord | null {
  const raw = window.localStorage.getItem(DAILY_KEY);
  if (raw === cachedDailyRaw) return cachedDaily;
  cachedDailyRaw = raw;
  if (!raw) {
    cachedDaily = null;
    return null;
  }
  try {
    cachedDaily = JSON.parse(raw) as DailyRecord;
  } catch {
    cachedDaily = null;
  }
  return cachedDaily;
}

function writeDaily(value: DailyRecord) {
  const raw = JSON.stringify(value);
  window.localStorage.setItem(DAILY_KEY, raw);
  cachedDailyRaw = raw;
  cachedDaily = value;
}

function runFromDaily(record: DailyRecord): Run {
  const byId = new Map(maps.map((map) => [map.id, map]));
  const rounds = record.answers
    .map((answer) => byId.get(answer.mapId))
    .filter((map): map is MapCard => Boolean(map))
    .map((map) => ({ answer: map, choices: [] }));
  return {
    kind: "daily",
    dateKey: record.date,
    mode: "choice",
    picture: "loading",
    unlimited: false,
    pool: maps.filter((map) => map.standard),
    dealt: record.answers.map((answer) => answer.mapId),
    rounds,
    index: Math.max(0, rounds.length - 1),
    score: record.score,
    streak: 0,
    bestStreak: record.bestStreak,
    answers: record.answers,
    intel: false,
    eliminatedId: null,
    remaining: 0,
    roundMs: CHOICE_ROUND_MS,
    days: record.days ?? 1,
    phase: "reveal",
    pickedId: null,
    guess: null,
    timedOut: false,
    points: 0,
  };
}

export function Game() {
  const [screen, setScreen] = useState<"menu" | "play" | "results">("menu");
  const [selected, setSelected] = useState<GameId[]>(games.map((game) => game.id));
  const [roster, setRoster] = useState<Roster>("launch");
  const [roundLength, setRoundLength] = useState<RoundLength>(10);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("choice");
  const [picture, setPicture] = useState<Picture>("loading");
  const [playKind, setPlayKind] = useState<PlayKind>("daily");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mutedOverride, setMutedOverride] = useState<boolean | undefined>(undefined);
  const [bestOverride, setBestOverride] = useState<Best | null | undefined>(undefined);
  const [dailyOverride, setDailyOverride] = useState<DailyRecord | null | undefined>(undefined);
  const [newBest, setNewBest] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const storedBest = useSyncExternalStore(subscribeBrowserStore, readBest, () => null);
  const storedMuted = useSyncExternalStore(
    subscribeBrowserStore,
    () => window.localStorage.getItem(MUTE_KEY) === "1",
    () => false,
  );
  const storedDaily = useSyncExternalStore(subscribeBrowserStore, readDaily, () => null);
  const today = useSyncExternalStore(subscribeBrowserStore, localDateKey, () => "");
  const best = bestOverride === undefined ? storedBest : bestOverride;
  const muted = mutedOverride === undefined ? storedMuted : mutedOverride;
  const dailyRecord = dailyOverride === undefined ? storedDaily : dailyOverride;
  const dailyToday = dailyRecord && today && dailyRecord.date === today ? dailyRecord : null;
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const customPool = useMemo(
    () =>
      maps.filter(
        (map) =>
          selected.includes(map.gameId) &&
          (roster === "all" || map.standard) &&
          (picture === "loading" || Boolean(map.minimap)),
      ),
    [picture, roster, selected],
  );
  const remakes = useMemo(() => remakePool(picture), [picture]);
  const pool = playKind === "remake" ? remakes : playKind === "daily" ? maps.filter((map) => map.standard) : customPool;
  const minimumMaps = playKind === "remake" ? 1 : playKind === "daily" ? DAILY_ROUNDS : answerMode === "choice" ? 4 : 1;
  const ready = playKind === "daily" ? pool.length >= DAILY_ROUNDS : pool.length >= minimumMaps;
  const plannedRounds =
    playKind === "daily" ? DAILY_ROUNDS : roundLength === "unlimited" ? null : Math.min(roundLength, pool.length);

  function toggleMute() {
    const next = !muted;
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    setMutedOverride(next);
  }

  function toggleGame(id: GameId) {
    setSelected((current) =>
      current.includes(id) ? current.filter((gameId) => gameId !== id) : [...current, id],
    );
  }

  function applyPreset(ids: GameId[]) {
    setSelected(ids);
  }

  function start() {
    if (playKind === "daily" && dailyToday) {
      setNewBest(false);
      setImageFailed(false);
      setRun(runFromDaily(dailyToday));
      setScreen("results");
      return;
    }
    if (!ready) return;
    const unlimited = playKind !== "daily" && roundLength === "unlimited";
    const dateKey = localDateKey();
    const count = unlimited || roundLength === "unlimited" ? 1 : roundLength;
    const mode = playKind === "remake" || playKind === "daily" ? "choice" : answerMode;
    const roundMs = roundDuration(mode);
    const rounds =
      playKind === "daily"
        ? buildDailyRounds(dateKey)
        : playKind === "remake"
          ? buildRemakeRounds(pool, count, picture)
          : buildRounds(pool, count, mode);
    setNewBest(false);
    setImageFailed(false);
    setLeaveOpen(false);
    setRun({
      kind: playKind,
      dateKey: playKind === "daily" ? dateKey : undefined,
      mode,
      picture: playKind === "daily" ? "loading" : picture,
      unlimited,
      pool,
      dealt: rounds.map((round) => round.answer.id),
      rounds,
      index: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      intel: false,
      eliminatedId: null,
      remaining: roundMs,
      roundMs,
      phase: "question",
      pickedId: null,
      guess: null,
      timedOut: false,
      points: 0,
    });
    setScreen("play");
  }

  const submit = useCallback((guess: Guess) => {
    setRun((current) => {
      if (!current || current.phase !== "question") return current;
      const round = current.rounds[current.index];
      const typed = current.mode === "typed";
      const text = guess.text ?? null;
      const pickedId = typed ? null : (guess.mapId ?? null);
      const timedOut = typed ? text === null : pickedId === null;
      const correct = typed ? text !== null && guessMatches(text, round.answer) : pickedId === round.answer.id;
      const streak = correct ? current.streak + 1 : 0;
      const points = scoreRound({
        correct,
        remainingMs: current.remaining,
        streak,
        intel: current.intel,
      });
      return {
        ...current,
        phase: "reveal",
        pickedId,
        guess: typed ? text : null,
        timedOut,
        points,
        streak,
        bestStreak: Math.max(current.bestStreak, streak),
        score: current.score + points,
        answers: [
          ...current.answers,
          {
            mapId: round.answer.id,
            correct,
            pickedId,
            guess: typed ? text : null,
            timedOut,
            points,
          },
        ],
      };
    });
  }, []);

  function finish(current: Run) {
    const correct = current.answers.filter((answer) => answer.correct).length;
    const next = { score: current.score, correct, rounds: current.answers.length };
    if (current.kind === "daily" && current.dateKey) {
      const days = nextDailyStreak(dailyRecord, current.dateKey);
      const record: DailyRecord = {
        date: current.dateKey,
        score: current.score,
        correct,
        rounds: current.answers.length,
        bestStreak: current.bestStreak,
        answers: current.answers,
        days,
      };
      writeDaily(record);
      setDailyOverride(record);
      setRun({ ...current, days });
      setNewBest(false);
      setScreen("results");
      return;
    }
    if (!best || next.score > best.score) {
      writeBest(next);
      setBestOverride(next);
      setNewBest(true);
    } else {
      setNewBest(false);
    }
    setScreen("results");
  }

  function endMatch() {
    if (!run || run.answers.length === 0) {
      setScreen("menu");
      return;
    }
    finish(run);
  }

  function nextRound() {
    if (!run) return;
    const hasAnother = run.index + 1 < run.rounds.length;
    if (!hasAnother && !run.unlimited) {
      finish(run);
      return;
    }
    setImageFailed(false);
    if (hasAnother) {
      setRun({
        ...run,
        index: run.index + 1,
        phase: "question",
        intel: false,
        eliminatedId: null,
        remaining: run.roundMs,
        pickedId: null,
        guess: null,
        timedOut: false,
        points: 0,
      });
      return;
    }
    const dealt =
      run.kind === "remake" ? dealRemakeRound(run.pool, run.dealt, run.picture) : dealRound(run.pool, run.dealt, run.mode);
    setRun({
      ...run,
      dealt: dealt.dealt,
      rounds: [...run.rounds, dealt.round],
      index: run.index + 1,
      phase: "question",
      intel: false,
      eliminatedId: null,
      remaining: run.roundMs,
      pickedId: null,
      guess: null,
      timedOut: false,
      points: 0,
    });
  }

  const roundIndex = run?.index;
  const roundPhase = run?.phase;
  const activeRoundMs = run?.roundMs ?? CHOICE_ROUND_MS;

  useEffect(() => {
    if (screen !== "play" || roundIndex === undefined || roundPhase !== "question") return;
    const deadline = performance.now() + activeRoundMs;
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline - performance.now());
      setRun((current) => {
        if (!current || current.phase !== "question") return current;
        return { ...current, remaining: left };
      });
      if (left <= 0) {
        window.clearInterval(id);
        playCue("timeout", mutedRef.current);
        submit({});
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [activeRoundMs, roundIndex, roundPhase, screen, submit]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      const target = event.target;
      const onLiveButton = target instanceof HTMLButtonElement && !target.disabled;
      const inField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (screen === "play" && run?.phase === "reveal" && event.key === "Enter" && !onLiveButton) {
        event.preventDefault();
        nextRound();
        return;
      }
      if (onLiveButton || inField || target instanceof HTMLButtonElement) return;
      if (screen === "menu" && event.key === "Enter" && ready) {
        event.preventDefault();
        start();
        return;
      }
      if (screen === "results" && event.key === "Enter") {
        event.preventDefault();
        start();
        return;
      }
      if (screen !== "play" || !run) return;
      if (run.phase === "question" && run.mode === "choice") {
        const visible = run.rounds[run.index].choices.filter((map) => map.id !== run.eliminatedId);
        const choice = Number(event.key) - 1;
        if (choice >= 0 && choice < visible.length) {
          event.preventDefault();
          const picked = visible[choice];
          playCue(picked.id === run.rounds[run.index].answer.id ? "correct" : "wrong", muted);
          submit({ mapId: picked.id });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const round = run?.rounds[run.index];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (screen === "play" ? setLeaveOpen(true) : setScreen("menu"))}
          className="text-left"
          title={screen === "play" ? "Leave this match" : "Back to the lobby"}
        >
          <p className="font-display text-xs tracking-[0.35em] text-primary">Multiplayer</p>
          <p className="font-display text-2xl leading-none text-foreground">Callout</p>
        </button>
        <Button type="button" variant="outline" size="icon" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </header>

      {leaveOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm border border-border bg-card p-5">
            <p className="font-display text-2xl text-foreground">Leave this match?</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">This run will not be saved.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>
                Stay
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setLeaveOpen(false);
                  setRun(null);
                  setScreen("menu");
                }}
              >
                Leave
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {screen === "menu" ? (
        <Menu
          answerMode={answerMode}
          picture={picture}
          best={best}
          dailyRecord={dailyRecord}
          dailyToday={dailyToday}
          minimumMaps={minimumMaps}
          plannedRounds={plannedRounds}
          playKind={playKind}
          poolSize={pool.length}
          ready={ready}
          roster={roster}
          roundLength={roundLength}
          selected={selected}
          today={today}
          onAnswerMode={setAnswerMode}
          onPicture={setPicture}
          onPlayKind={setPlayKind}
          onRoster={setRoster}
          onRoundLength={setRoundLength}
          onStart={start}
          onPreset={applyPreset}
          onToggleGame={toggleGame}
        />
      ) : null}

      {screen === "play" && run && round ? (
        <Question
          imageFailed={imageFailed}
          run={run}
          onFail={() => setImageFailed(true)}
          onIntel={() =>
            setRun((current) => {
              if (!current || current.phase !== "question" || current.intel) return current;
              let eliminatedId = current.eliminatedId;
              if (current.mode === "choice") {
                const active = current.rounds[current.index];
                const wrong = active.choices.filter((map) => map.id !== active.answer.id);
                if (wrong.length > 0) {
                  eliminatedId = wrong[Math.floor(Math.random() * wrong.length)].id;
                }
              }
              return { ...current, intel: true, eliminatedId };
            })
          }
          onEnd={endMatch}
          onGuess={(text) => {
            playCue(guessMatches(text, round.answer) ? "correct" : "wrong", muted);
            submit({ text });
          }}
          onNext={nextRound}
          onPick={(map) => {
            playCue(map.id === round.answer.id ? "correct" : "wrong", muted);
            submit({ mapId: map.id });
          }}
        />
      ) : null}

      {screen === "results" && run ? (
        <Results best={best} newBest={newBest} run={run} onAgain={start} onMenu={() => setScreen("menu")} />
      ) : null}

      <footer className="mt-auto pt-8 text-xs leading-5 text-muted-foreground">
        Loading screens and minimaps from the mainline games, via the Call of Duty Wiki.
        Fan-made quiz. Not affiliated with Activision.{" "}
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          Support this on Ko-fi
        </a>{" "}
        if you want.
      </footer>
    </div>
  );
}

function Menu({
  answerMode,
  best,
  dailyRecord,
  dailyToday,
  minimumMaps,
  picture,
  plannedRounds,
  playKind,
  poolSize,
  ready,
  roster,
  roundLength,
  selected,
  today,
  onAnswerMode,
  onPicture,
  onPlayKind,
  onRoster,
  onRoundLength,
  onStart,
  onPreset,
  onToggleGame,
}: {
  answerMode: AnswerMode;
  best: Best | null;
  dailyRecord: DailyRecord | null;
  dailyToday: DailyRecord | null;
  minimumMaps: number;
  picture: Picture;
  plannedRounds: number | null;
  playKind: PlayKind;
  poolSize: number;
  ready: boolean;
  roster: Roster;
  roundLength: RoundLength;
  selected: GameId[];
  today: string;
  onAnswerMode: (mode: AnswerMode) => void;
  onPicture: (picture: Picture) => void;
  onPlayKind: (kind: PlayKind) => void;
  onRoster: (roster: Roster) => void;
  onRoundLength: (length: RoundLength) => void;
  onStart: () => void;
  onPreset: (ids: GameId[]) => void;
  onToggleGame: (id: GameId) => void;
}) {
  const [tuneGames, setTuneGames] = useState(false);

  return (
    <main className="flex flex-1 flex-col gap-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-5xl leading-[0.9] text-foreground sm:text-7xl">
          Name the map
          <span className="block text-primary">before you spawn.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          {playKind === "daily"
            ? "Ten launch maps, same set for everyone today. Play once, then send the score."
            : playKind === "remake"
              ? "A map that came back. You already know the name. Pick which game this version is from."
              : "A loading screen or a minimap comes up. Pick the name, or type it. Twenty seconds for four choices. Thirty if you type it."}
        </p>
      </div>

      <div>
        <p className="mb-2 font-display text-xs tracking-[0.22em] text-muted-foreground">Match</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["daily", "Daily"],
              ["remake", "Remakes"],
              ["custom", "Custom"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={playKind === id ? "default" : "outline"}
              aria-pressed={playKind === id}
              onClick={() => onPlayKind(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {playKind === "daily" ? (
        <section className="max-w-xl border border-border bg-card p-5">
          <p className="font-display text-xs tracking-[0.22em] text-muted-foreground">Today</p>
          <p className="mt-2 font-display text-4xl text-foreground">{today ? formatDateLabel(today) : "Today"}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ten launch maps from the whole mainline roster. Same ten for everyone on this date.
          </p>
          {dailyToday ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Today you went {dailyToday.correct}/{dailyToday.rounds} for{" "}
              <span className="font-display text-foreground">{formatScore(dailyToday.score)}</span>
              {dailyToday.days ? (
                <>
                  {" "}
                  · <span className="font-display text-foreground">{dailyToday.days} day streak</span>
                </>
              ) : null}
              .
            </p>
          ) : dailyRecord?.days && dailyRecord.date !== today ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Last streak was {dailyRecord.days} {dailyRecord.days === 1 ? "day" : "days"}.
            </p>
          ) : null}
          <Button type="button" size="lg" disabled={!ready && !dailyToday} onClick={onStart} className="mt-6 h-12 w-full font-display text-lg tracking-[0.18em] sm:w-auto">
            {dailyToday ? "See today's result" : "Play today's ten"}
          </Button>
        </section>
      ) : (
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-5">

          {playKind === "custom" ? (
          <>
          <div>
            <p className="mb-2 font-display text-xs tracking-[0.22em] text-muted-foreground">Presets</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => {
                const on = sameGameSet(selected, preset.games);
                return (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() => onPreset(preset.games)}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <Button
              type="button"
              size="sm"
              variant={tuneGames ? "default" : "outline"}
              aria-expanded={tuneGames}
              onClick={() => setTuneGames((open) => !open)}
            >
              Fine-tune games
            </Button>
            {tuneGames ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {games.map((game) => {
                  const on = selected.includes(game.id);
                  return (
                    <Button
                      key={game.id}
                      type="button"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      onClick={() => onToggleGame(game.id)}
                      className="h-auto flex-col items-start px-3 py-2"
                    >
                      <span className="font-display text-base tracking-wide">{game.short}</span>
                      <span className={cn("text-[11px]", on ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {game.year}
                      </span>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{selected.length} games selected.</p>
            )}
          </div>

          <div>
            <p className="mb-2 font-display text-xs tracking-[0.22em] text-muted-foreground">Roster</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={roster === "launch" ? "default" : "outline"}
                aria-pressed={roster === "launch"}
                onClick={() => onRoster("launch")}
                className="h-auto items-start justify-start px-3 py-3 text-left whitespace-normal"
              >
                <span>
                  <span className="font-display block text-base tracking-wide">Launch maps</span>
                  <span className={cn("mt-1 block text-xs font-normal normal-case tracking-normal", roster === "launch" ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    The maps that shipped with each game.
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant={roster === "all" ? "default" : "outline"}
                aria-pressed={roster === "all"}
                onClick={() => onRoster("all")}
                className="h-auto items-start justify-start px-3 py-3 text-left whitespace-normal"
              >
                <span>
                  <span className="font-display block text-base tracking-wide">Full locker</span>
                  <span className={cn("mt-1 block text-xs font-normal normal-case tracking-normal", roster === "all" ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    Launch maps plus the later packs for every selected game.
                  </span>
                </span>
              </Button>
            </div>
          </div>
          </>
          ) : (
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Choices are the games that shipped this map. Seasonal reskins stay out.
            </p>
          )}
        </div>

        <div className="flex flex-col justify-between gap-4 border border-border bg-card p-4">
          <div>
            <p className="font-display text-xs tracking-[0.22em] text-muted-foreground">Match</p>
            <p className="mt-2 font-display text-4xl text-foreground">{poolSize}</p>
            <p className="text-sm text-muted-foreground">
              {playKind === "remake" ? "remake versions" : "maps in this pool"}
            </p>
            <p className="mt-4 mb-2 font-display text-xs tracking-[0.22em] text-muted-foreground">Picture</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={picture === "loading" ? "default" : "outline"}
                aria-pressed={picture === "loading"}
                onClick={() => onPicture("loading")}
              >
                Loading screen
              </Button>
              <Button
                type="button"
                size="sm"
                variant={picture === "minimap" ? "default" : "outline"}
                aria-pressed={picture === "minimap"}
                onClick={() => onPicture("minimap")}
              >
                Minimap
              </Button>
            </div>
            {playKind === "custom" ? (
              <>
            <p className="mt-4 mb-2 font-display text-xs tracking-[0.22em] text-muted-foreground">Answer</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={answerMode === "choice" ? "default" : "outline"}
                aria-pressed={answerMode === "choice"}
                onClick={() => onAnswerMode("choice")}
              >
                Four choices
              </Button>
              <Button
                type="button"
                size="sm"
                variant={answerMode === "typed" ? "default" : "outline"}
                aria-pressed={answerMode === "typed"}
                onClick={() => onAnswerMode("typed")}
              >
                Type the name
              </Button>
            </div>
              </>
            ) : null}
            <p className="mt-4 mb-2 font-display text-xs tracking-[0.22em] text-muted-foreground">Length</p>
            <div className="flex flex-wrap gap-2">
              {ROUND_OPTIONS.map((count) => (
                <Button
                  key={count}
                  type="button"
                  size="sm"
                  variant={roundLength === count ? "default" : "outline"}
                  aria-pressed={roundLength === count}
                  onClick={() => onRoundLength(count)}
                >
                  {count}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={roundLength === "unlimited" ? "default" : "outline"}
                aria-pressed={roundLength === "unlimited"}
                onClick={() => onRoundLength("unlimited")}
              >
                Unlimited
              </Button>
            </div>
            {best && playKind === "custom" ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Best score <span className="font-display text-base text-foreground">{formatScore(best.score)}</span>
                <span className="text-muted-foreground"> · {best.correct}/{best.rounds}</span>
              </p>
            ) : null}
          </div>
          <Button type="button" size="lg" disabled={!ready} onClick={onStart} className="h-12 font-display text-lg tracking-[0.18em]">
            {ready
              ? plannedRounds === null
                ? "Drop in"
                : `Drop in · ${plannedRounds}`
              : `Pick at least ${minimumMaps} ${minimumMaps === 1 ? "map" : "maps"}`}
          </Button>
        </div>
      </section>
      )}
    </main>
  );
}

function Plate({
  map,
  picture,
  sizes,
  priority,
  onFail,
  framed = false,
}: {
  map: MapCard;
  picture: Picture;
  sizes: string;
  priority?: boolean;
  onFail?: () => void;
  framed?: boolean;
}) {
  const src = picture === "minimap" && map.minimap ? map.minimap : map.image;
  const cover = picture === "minimap" ? map.minimapCover : map.cover;
  return (
    <>
      {framed ? (
        <Image
          src={src}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          className={picture === "minimap" ? "object-contain" : "object-cover"}
          onError={onFail}
        />
      ) : (
        <Image
          src={src}
          alt=""
          width={1600}
          height={900}
          priority={priority}
          sizes={sizes}
          className="h-auto w-full"
          onError={onFail}
        />
      )}
      {cover?.map((box, index) => (
        <Cover key={`${map.id}-${index}`} box={box} />
      ))}
    </>
  );
}

function Cover({ box }: { box: CoverBox }) {
  return (
    <span
      aria-hidden
      className="absolute bg-[#080c09]/90"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
      }}
    />
  );
}

function Question({
  run,
  imageFailed,
  onPick,
  onGuess,
  onIntel,
  onNext,
  onEnd,
  onFail,
}: {
  run: Run;
  imageFailed: boolean;
  onPick: (map: MapCard) => void;
  onGuess: (text: string) => void;
  onIntel: () => void;
  onNext: () => void;
  onEnd: () => void;
  onFail: () => void;
}) {
  const round = run.rounds[run.index];
  const revealed = run.phase === "reveal";
  const seconds = Math.ceil(run.remaining / 1000);
  const correct = run.answers.at(-1)?.correct ?? false;
  const continueLabel = run.unlimited || run.index + 1 < run.rounds.length ? "Next map" : "See the match";

  return (
    <main className={cn("flex flex-1 flex-col gap-4", revealed && "pb-28")}>
      <div className="flex items-end justify-between gap-3 font-display tracking-wide">
        <p className="text-sm text-muted-foreground">
          {String(run.index + 1).padStart(2, "0")}
          {run.unlimited ? null : (
            <span className="text-foreground/40"> / {String(run.rounds.length).padStart(2, "0")}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Streak <span className="text-foreground">{run.streak}</span>
        </p>
        <p className="text-lg text-foreground tabular-nums">{formatScore(run.score)}</p>
      </div>

      <figure className={cn("overflow-hidden border border-border bg-black", run.picture === "minimap" && "mx-auto w-full max-w-xl")}>
        <div className="relative">
          {imageFailed ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              This picture failed to load. You can still guess, or wait and the round will expire.
            </div>
          ) : (
            <Plate
              key={`${run.picture}-${round.answer.id}`}
              map={round.answer}
              picture={run.picture}
              priority
              sizes="(max-width: 768px) 100vw, 960px"
              onFail={onFail}
            />
          )}
        </div>
        <div className="h-1.5 bg-black" aria-hidden>
          <div
            className={cn("h-full", seconds <= 5 && !revealed ? "bg-destructive" : "bg-primary")}
            style={{ width: `${(run.remaining / run.roundMs) * 100}%` }}
          />
        </div>
        <figcaption className="sr-only">Loading screen. Choose the map name.</figcaption>
      </figure>

      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm tracking-[0.18em] text-muted-foreground tabular-nums" aria-live="polite">
          {revealed ? "Locked" : `${seconds}s`}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {run.unlimited && !revealed ? (
            <Button type="button" variant="ghost" size="sm" onClick={onEnd}>
              End match
            </Button>
          ) : null}
          {run.kind === "remake" ? (
            <p className="font-display text-sm tracking-[0.16em] text-primary">{round.answer.name}</p>
          ) : run.intel ? (
            <p className="font-display text-sm tracking-[0.16em] text-primary">
              {run.mode === "choice"
                ? "One map is off the board"
                : `${round.answer.short} · ${round.answer.year}`}
            </p>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={revealed} onClick={onIntel}>
              Intel · halves the round
            </Button>
          )}
        </div>
      </div>

      {run.mode === "typed" ? (
        <TypedAnswer
          key={`${run.index}-${round.answer.id}`}
          fieldKey={`${run.index}-${round.answer.id}`}
          guess={run.guess}
          revealed={revealed}
          onGuess={onGuess}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Map choices">
          {round.choices.filter((map) => map.id !== run.eliminatedId).map((map, index) => {
            const label = run.kind === "remake" ? versionLabel(map) : choiceLabel(map, round.choices);
            const isAnswer = revealed && map.id === round.answer.id;
            const isWrong = revealed && map.id === run.pickedId && map.id !== round.answer.id;
            return (
              <Button
                key={map.id}
                type="button"
                variant="outline"
                disabled={revealed}
                onClick={() => onPick(map)}
                className={cn(
                  "h-auto min-h-16 justify-start gap-3 px-3 py-3 text-left whitespace-normal disabled:opacity-100",
                  isAnswer && "border-primary bg-primary/20 text-foreground ring-2 ring-primary",
                  isWrong && "border-destructive bg-destructive/15 text-foreground",
                )}
              >
                <span className="font-display w-5 text-primary tabular-nums">{index + 1}</span>
                <span className="font-display text-lg leading-tight tracking-wide">{label}</span>
              </Button>
            );
          })}
        </div>
      )}

      {revealed ? null : (
        <p className="text-xs text-muted-foreground">
          {run.kind === "remake"
            ? "The map name is on the table. Keys pick the game this version is from."
            : run.mode === "typed"
              ? "Type the map. Capitalization does not matter. Intel shows the game and cuts the round in half."
              : "Keys 1 to 4 answer. Intel takes one wrong map off the board and cuts the round in half."}
        </p>
      )}

      {revealed ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0" aria-live="polite">
              <p className={cn("font-display text-xs tracking-[0.2em]", correct ? "text-success" : "text-destructive")}>
                {run.timedOut ? "Time" : correct ? "Confirmed" : "Negative"}
                <span className="text-primary"> · {run.points > 0 ? `+${formatScore(run.points)}` : "0"}</span>
              </p>
              <p className="truncate font-display text-2xl leading-none text-foreground">{round.answer.name}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {round.answer.game} · {round.answer.year}
                {round.answer.blurb ? ` · ${round.answer.blurb}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {run.unlimited ? (
                <Button type="button" variant="outline" onClick={onEnd} className="h-12">
                  End match
                </Button>
              ) : null}
              <Button type="button" onClick={onNext} className="h-12 flex-1 font-display tracking-[0.16em] sm:min-w-40 sm:flex-none">
                {continueLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Results({
  run,
  best,
  newBest,
  onAgain,
  onMenu,
}: {
  run: Run;
  best: Best | null;
  newBest: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const correct = run.answers.filter((answer) => answer.correct).length;
  const total = run.answers.length;
  const accuracy = total === 0 ? 0 : correct / total;
  const rank = rankFor(accuracy);
  const byId = new Map(maps.map((map) => [map.id, map]));

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <p className="font-display text-xs tracking-[0.28em] text-primary">
          {run.kind === "daily" && run.dateKey
            ? `Daily · ${formatDateLabel(run.dateKey)}`
            : run.kind === "remake"
              ? "Remakes"
              : "Match complete"}
        </p>
        <h1 className="font-display text-6xl leading-none text-foreground sm:text-7xl">{rank.title}</h1>
        <p className="mt-2 text-muted-foreground">{rank.line}</p>
        {run.kind === "daily" && run.days ? (
          <p className="mt-3 font-display tracking-[0.16em] text-primary">
            {run.days} day streak
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 border border-border bg-card p-4">
        <Stat label="Score" value={formatScore(run.score)} />
        <Stat label="Maps" value={`${correct}/${total}`} />
        <Stat label={run.kind === "daily" ? "Days" : "Best streak"} value={run.kind === "daily" ? String(run.days ?? 1) : String(run.bestStreak)} />
      </div>
      {newBest ? <p className="font-display tracking-[0.16em] text-primary">New best score</p> : null}
      {best && !newBest ? (
        <p className="text-sm text-muted-foreground">Best score stays {formatScore(best.score)}.</p>
      ) : null}

      <div className="flex max-h-[36rem] flex-col gap-2 overflow-y-auto sm:grid sm:grid-cols-5">
        {run.answers.map((answer) => {
          const map = byId.get(answer.mapId);
          const picked = answer.pickedId ? byId.get(answer.pickedId) : undefined;
          if (!map) return null;
          const said =
            answer.guess?.trim() ||
            (picked ? (run.kind === "remake" ? versionLabel(picked) : picked.name) : undefined);
          return (
            <figure
              key={`${answer.mapId}-${map.id}`}
              className="flex overflow-hidden border border-border bg-black sm:flex-col"
            >
              <div className="relative aspect-video w-28 shrink-0 sm:w-auto">
                <Plate framed map={map} picture={run.picture} sizes="(max-width: 640px) 112px, 180px" />
              </div>
              <figcaption className="min-w-0 flex-1 space-y-1 p-2.5 sm:p-2">
                <p className={cn("font-display text-base leading-tight tracking-wide sm:text-sm", answer.correct ? "text-success" : "text-destructive")}>
                  {answer.correct ? "Hit" : "Miss"} · {run.kind === "remake" ? versionLabel(map) : map.name}
                </p>
                <p className="text-xs text-muted-foreground sm:text-[11px]">
                  {run.kind === "remake" ? map.name : map.short}
                </p>
                <p className="text-xs text-muted-foreground sm:text-[11px]">
                  {answer.correct
                    ? `You said ${said || (run.kind === "remake" ? versionLabel(map) : map.name)}`
                    : answer.timedOut
                      ? "Time ran out"
                      : `You said ${said || "another map"}`}
                </p>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {run.kind === "daily" && run.dateKey ? <ShareDaily run={run} /> : null}
        {run.kind === "daily" ? null : (
          <Button type="button" onClick={onAgain} className="font-display tracking-[0.16em]">
            Run it back
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onMenu}>
          {run.kind === "daily" ? "Back to the lobby" : "Change the roster"}
        </Button>
      </div>
    </main>
  );
}

function TypedAnswer({
  fieldKey,
  revealed,
  guess,
  onGuess,
}: {
  fieldKey: string;
  revealed: boolean;
  guess: string | null;
  onGuess: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const fieldId = `map-guess-${fieldKey}`;

  return (
    <form
      autoComplete="off"
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        const text = draft.trim();
        if (!text || revealed) return;
        onGuess(text);
      }}
    >
      <label className="sr-only" htmlFor={fieldId}>
        Map name
      </label>
      <Input
        id={fieldId}
        name={fieldId}
        value={revealed ? (guess ?? "") : draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={revealed}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        placeholder="Type the map name"
        className="h-12 px-3 font-display text-lg tracking-wide uppercase"
      />
      <Button type="submit" disabled={revealed || draft.trim().length === 0} className="h-12 font-display tracking-[0.16em]">
        Lock in
      </Button>
    </form>
  );
}

function ShareDaily({ run }: { run: Run }) {
  const [copied, setCopied] = useState(false);
  if (!run.dateKey) return null;
  const text = formatDailyShare({
    date: run.dateKey,
    correct: run.answers.filter((answer) => answer.correct).length,
    rounds: run.answers.length,
    score: run.score,
    days: run.days,
  });

  return (
    <Button
      type="button"
      className="font-display tracking-[0.16em]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copy this score", text);
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Copied" : "Copy today's score"}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-2xl text-foreground tabular-nums sm:text-3xl">{value}</p>
    </div>
  );
}
