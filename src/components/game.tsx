"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ROUND_MS,
  ROUND_OPTIONS,
  buildRounds,
  choiceLabel,
  games,
  maps,
  rankFor,
  scoreRound,
  type GameId,
  type MapCard,
  type Round,
} from "@/lib/game";
import { playCue } from "@/lib/sound";
import { cn } from "@/lib/utils";

type Roster = "launch" | "all";

type Answer = {
  mapId: string;
  correct: boolean;
  pickedId: string | null;
  timedOut: boolean;
  points: number;
};

type Run = {
  rounds: Round[];
  index: number;
  score: number;
  streak: number;
  bestStreak: number;
  answers: Answer[];
  intel: boolean;
  remaining: number;
  phase: "question" | "reveal";
  pickedId: string | null;
  timedOut: boolean;
  points: number;
};

type Best = { score: number; correct: number; rounds: number };

const BEST_KEY = "callout-best";
const MUTE_KEY = "callout-muted";

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

export function Game() {
  const [screen, setScreen] = useState<"menu" | "play" | "results">("menu");
  const [selected, setSelected] = useState<GameId[]>(games.map((game) => game.id));
  const [roster, setRoster] = useState<Roster>("launch");
  const [roundCount, setRoundCount] = useState<(typeof ROUND_OPTIONS)[number]>(10);
  const [mutedOverride, setMutedOverride] = useState<boolean | undefined>(undefined);
  const [bestOverride, setBestOverride] = useState<Best | null | undefined>(undefined);
  const [newBest, setNewBest] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const storedBest = useSyncExternalStore(subscribeBrowserStore, readBest, () => null);
  const storedMuted = useSyncExternalStore(
    subscribeBrowserStore,
    () => window.localStorage.getItem(MUTE_KEY) === "1",
    () => false,
  );
  const best = bestOverride === undefined ? storedBest : bestOverride;
  const muted = mutedOverride === undefined ? storedMuted : mutedOverride;
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const pool = useMemo(
    () =>
      maps.filter(
        (map) => selected.includes(map.gameId) && (roster === "all" || map.standard),
      ),
    [roster, selected],
  );

  const plannedRounds = Math.min(roundCount, pool.length);

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

  function start() {
    if (pool.length < 4) return;
    setNewBest(false);
    setImageFailed(false);
    setRun({
      rounds: buildRounds(pool, roundCount),
      index: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      answers: [],
      intel: false,
      remaining: ROUND_MS,
      phase: "question",
      pickedId: null,
      timedOut: false,
      points: 0,
    });
    setScreen("play");
  }

  const submit = useCallback((pickedId: string | null) => {
    setRun((current) => {
      if (!current || current.phase !== "question") return current;
      const round = current.rounds[current.index];
      const correct = pickedId === round.answer.id;
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
        timedOut: pickedId === null,
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
            timedOut: pickedId === null,
            points,
          },
        ],
      };
    });
  }, []);

  function finish(current: Run) {
    const correct = current.answers.filter((answer) => answer.correct).length;
    const next = { score: current.score, correct, rounds: current.rounds.length };
    if (!best || next.score > best.score) {
      writeBest(next);
      setBestOverride(next);
      setNewBest(true);
    } else {
      setNewBest(false);
    }
    setScreen("results");
  }

  function nextRound() {
    if (!run) return;
    if (run.index + 1 >= run.rounds.length) {
      finish(run);
      return;
    }
    setImageFailed(false);
    setRun({
      ...run,
      index: run.index + 1,
      phase: "question",
      intel: false,
      remaining: ROUND_MS,
      pickedId: null,
      timedOut: false,
      points: 0,
    });
  }

  const roundIndex = run?.index;
  const roundPhase = run?.phase;

  useEffect(() => {
    if (screen !== "play" || roundIndex === undefined || roundPhase !== "question") return;
    const deadline = performance.now() + ROUND_MS;
    const id = window.setInterval(() => {
      const left = Math.max(0, deadline - performance.now());
      setRun((current) => {
        if (!current || current.phase !== "question") return current;
        return { ...current, remaining: left };
      });
      if (left <= 0) {
        window.clearInterval(id);
        playCue("timeout", mutedRef.current);
        submit(null);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [roundIndex, roundPhase, screen, submit]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.target instanceof HTMLButtonElement) return;
      if (screen === "menu" && event.key === "Enter" && pool.length >= 4) {
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
      if (run.phase === "question") {
        const choice = Number(event.key) - 1;
        if (choice >= 0 && choice < run.rounds[run.index].choices.length) {
          event.preventDefault();
          const picked = run.rounds[run.index].choices[choice];
          playCue(picked.id === run.rounds[run.index].answer.id ? "correct" : "wrong", muted);
          submit(picked.id);
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        nextRound();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const round = run?.rounds[run.index];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setScreen("menu")} className="text-left" title="Back to the lobby">
          <p className="font-display text-xs tracking-[0.35em] text-primary">Multiplayer</p>
          <p className="font-display text-2xl leading-none text-foreground">Callout</p>
        </button>
        <Button type="button" variant="outline" size="icon" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </header>

      {screen === "menu" ? (
        <Menu
          best={best}
          plannedRounds={plannedRounds}
          poolSize={pool.length}
          roster={roster}
          roundCount={roundCount}
          selected={selected}
          onRoster={setRoster}
          onRoundCount={setRoundCount}
          onStart={start}
          onToggleGame={toggleGame}
        />
      ) : null}

      {screen === "play" && run && round ? (
        <Question
          imageFailed={imageFailed}
          run={run}
          onFail={() => setImageFailed(true)}
          onIntel={() =>
            setRun((current) => (current && current.phase === "question" ? { ...current, intel: true } : current))
          }
          onNext={nextRound}
          onPick={(map) => {
            playCue(map.id === round.answer.id ? "correct" : "wrong", muted);
            submit(map.id);
          }}
        />
      ) : null}

      {screen === "results" && run ? (
        <Results best={best} newBest={newBest} run={run} onAgain={start} onMenu={() => setScreen("menu")} />
      ) : null}

      <footer className="mt-auto pt-8 text-xs leading-5 text-muted-foreground">
        Loading screens from Call of Duty 4: Modern Warfare through Black Ops II, via the Call of Duty Wiki.
        Fan-made quiz. Not affiliated with Activision.
      </footer>
    </div>
  );
}

function Menu({
  best,
  plannedRounds,
  poolSize,
  roster,
  roundCount,
  selected,
  onRoster,
  onRoundCount,
  onStart,
  onToggleGame,
}: {
  best: Best | null;
  plannedRounds: number;
  poolSize: number;
  roster: Roster;
  roundCount: number;
  selected: GameId[];
  onRoster: (roster: Roster) => void;
  onRoundCount: (count: (typeof ROUND_OPTIONS)[number]) => void;
  onStart: () => void;
  onToggleGame: (id: GameId) => void;
}) {
  const ready = poolSize >= 4;
  return (
    <main className="flex flex-1 flex-col gap-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-5xl leading-[0.9] text-foreground sm:text-7xl">
          Name the map
          <span className="block text-primary">before you spawn.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          A loading screen comes up. Four names sit under it. You have twenty seconds. The run covers Call of Duty 4
          through Black Ops II, World at War and Modern Warfare 3 included.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-5">
          <div>
            <p className="mb-2 font-display text-xs tracking-[0.22em] text-muted-foreground">Games</p>
            <div className="flex flex-wrap gap-2">
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
                    The maps that shipped with each game, plus Nuketown 2025.
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
                    Launch maps and the DLC packs from that same stretch.
                  </span>
                </span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 border border-border bg-card p-4">
          <div>
            <p className="font-display text-xs tracking-[0.22em] text-muted-foreground">Match</p>
            <p className="mt-2 font-display text-4xl text-foreground">{poolSize}</p>
            <p className="text-sm text-muted-foreground">maps in this pool</p>
            <div className="mt-4 flex gap-2">
              {ROUND_OPTIONS.map((count) => (
                <Button
                  key={count}
                  type="button"
                  size="sm"
                  variant={roundCount === count ? "default" : "outline"}
                  aria-pressed={roundCount === count}
                  onClick={() => onRoundCount(count)}
                >
                  {count} rounds
                </Button>
              ))}
            </div>
            {best ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Best score <span className="font-display text-base text-foreground">{formatScore(best.score)}</span>
                <span className="text-muted-foreground"> · {best.correct}/{best.rounds}</span>
              </p>
            ) : null}
          </div>
          <Button type="button" size="lg" disabled={!ready} onClick={onStart} className="h-12 font-display text-lg tracking-[0.18em]">
            {ready ? `Drop in · ${plannedRounds}` : "Pick at least 4 maps"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function Question({
  run,
  imageFailed,
  onPick,
  onIntel,
  onNext,
  onFail,
}: {
  run: Run;
  imageFailed: boolean;
  onPick: (map: MapCard) => void;
  onIntel: () => void;
  onNext: () => void;
  onFail: () => void;
}) {
  const round = run.rounds[run.index];
  const revealed = run.phase === "reveal";
  const seconds = Math.ceil(run.remaining / 1000);

  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="flex items-end justify-between gap-3 font-display tracking-wide">
        <p className="text-sm text-muted-foreground">
          {String(run.index + 1).padStart(2, "0")}
          <span className="text-foreground/40"> / {String(run.rounds.length).padStart(2, "0")}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Streak <span className="text-foreground">{run.streak}</span>
        </p>
        <p className="text-lg text-foreground tabular-nums">{formatScore(run.score)}</p>
      </div>

      <figure className="overflow-hidden border border-border bg-black">
        <div className="relative aspect-video">
          {imageFailed ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              This loading screen failed to load. You can still guess, or wait and the round will expire.
            </div>
          ) : (
            <Image
              key={round.answer.id}
              src={round.answer.image}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 960px"
              className="object-contain"
              onError={onFail}
            />
          )}
        </div>
        <div className="h-1.5 bg-black" aria-hidden>
          <div
            className={cn("h-full", seconds <= 5 && !revealed ? "bg-destructive" : "bg-primary")}
            style={{ width: `${(run.remaining / ROUND_MS) * 100}%` }}
          />
        </div>
        <figcaption className="sr-only">Loading screen. Choose the map name.</figcaption>
      </figure>

      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm tracking-[0.18em] text-muted-foreground tabular-nums" aria-live="polite">
          {revealed ? "Locked" : `${seconds}s`}
        </p>
        {run.intel ? (
          <p className="font-display text-sm tracking-[0.16em] text-primary">
            {round.answer.short} · {round.answer.year}
          </p>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={revealed} onClick={onIntel}>
            Intel · halves the round
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Map choices">
        {round.choices.map((map, index) => {
          const label = choiceLabel(map, round.choices);
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

      {revealed ? (
        <div className="border border-border bg-card p-4" aria-live="polite">
          <p className={cn("font-display text-sm tracking-[0.2em]", run.answers.at(-1)?.correct ? "text-emerald-400" : "text-destructive")}>
            {run.timedOut ? "Time" : run.answers.at(-1)?.correct ? "Confirmed" : "Negative"}
          </p>
          <h2 className="mt-1 font-display text-4xl leading-none text-foreground">{round.answer.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {round.answer.game} · {round.answer.year}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/90">{round.answer.blurb}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-2xl text-primary tabular-nums">
              {run.points > 0 ? `+${formatScore(run.points)}` : "0"}
            </p>
            <Button type="button" onClick={onNext} className="font-display tracking-[0.16em]">
              {run.index + 1 >= run.rounds.length ? "See the match" : "Next map"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Keys 1 to 4 answer. Intel shows the game and cuts the round in half.</p>
      )}
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
  const accuracy = run.rounds.length === 0 ? 0 : correct / run.rounds.length;
  const rank = rankFor(accuracy);
  const byId = new Map(maps.map((map) => [map.id, map]));

  return (
    <main className="flex flex-1 flex-col gap-6">
      <div>
        <p className="font-display text-xs tracking-[0.28em] text-primary">Match complete</p>
        <h1 className="font-display text-6xl leading-none text-foreground sm:text-7xl">{rank.title}</h1>
        <p className="mt-2 text-muted-foreground">{rank.line}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 border border-border bg-card p-4">
        <Stat label="Score" value={formatScore(run.score)} />
        <Stat label="Maps" value={`${correct}/${run.rounds.length}`} />
        <Stat label="Best streak" value={String(run.bestStreak)} />
      </div>
      {newBest ? <p className="font-display tracking-[0.16em] text-primary">New best score</p> : null}
      {best && !newBest ? (
        <p className="text-sm text-muted-foreground">Best score stays {formatScore(best.score)}.</p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {run.answers.map((answer) => {
          const map = byId.get(answer.mapId);
          const picked = answer.pickedId ? byId.get(answer.pickedId) : undefined;
          if (!map) return null;
          return (
            <figure key={`${answer.mapId}-${map.id}`} className="overflow-hidden border border-border bg-black">
              <div className="relative aspect-video">
                <Image src={map.image} alt="" fill sizes="180px" className="object-cover" />
              </div>
              <figcaption className="space-y-1 p-2">
                <p className={cn("font-display text-sm leading-tight tracking-wide", answer.correct ? "text-emerald-400" : "text-destructive")}>
                  {answer.correct ? "Hit" : "Miss"} · {map.name}
                </p>
                <p className="text-[11px] text-muted-foreground">{map.short}</p>
                {!answer.correct ? (
                  <p className="text-[11px] text-muted-foreground">
                    {answer.timedOut ? "Time ran out" : `You said ${picked?.name ?? "another map"}`}
                  </p>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onAgain} className="font-display tracking-[0.16em]">
          Run it back
        </Button>
        <Button type="button" variant="outline" onClick={onMenu}>
          Change the roster
        </Button>
      </div>
    </main>
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
