let context: AudioContext | null = null;

function tone(frequency: number, duration: number, type: OscillatorType, gainValue: number, delay = 0) {
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playCue(kind: "correct" | "wrong" | "timeout", muted: boolean) {
  if (muted || typeof window === "undefined") return;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  if (kind === "correct") {
    tone(520, 0.08, "triangle", 0.04);
    tone(780, 0.12, "triangle", 0.04, 0.09);
    return;
  }
  if (kind === "wrong") {
    tone(180, 0.16, "sawtooth", 0.03);
    return;
  }
  tone(140, 0.2, "square", 0.02);
}
