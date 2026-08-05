import type { AudioInputSession } from "./audio-input.ts";
import type { SignalGenerator } from "./signal-generator.ts";
import { STANDARD_FREQUENCIES } from "./target-curves.ts";
import { averageResponses } from "./spectrum.ts";
import type { AmbientNoiseResult, FrequencyPoint } from "./types.ts";

const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export const measureAmbientNoise = async (
  input: AudioInputSession,
  durationMs = 1400,
): Promise<AmbientNoiseResult> => {
  const values: number[] = [];
  const started = Date.now();
  while (Date.now() - started < durationMs) {
    values.push(input.readLevel().rmsDb);
    await wait(80);
  }
  const dbFs =
    values.reduce((total, value) => total + value, 0) /
    Math.max(1, values.length);
  const rating = dbFs < -52 ? "quiet" : dbFs < -38 ? "acceptable" : "high";
  return {
    dbFs: Number(dbFs.toFixed(1)),
    rating,
    note:
      rating === "quiet"
        ? "The room is quiet enough for a useful sweep."
        : rating === "acceptable"
          ? "Usable, though quieter conditions would improve confidence."
          : "Background sound is high. Pause appliances and external noise if possible.",
  };
};

const resampleToStandardBands = (
  snapshots: FrequencyPoint[][],
): FrequencyPoint[] => {
  if (!snapshots.length) return [];
  const averaged = averageResponses(snapshots);
  return STANDARD_FREQUENCIES.map((frequency) => {
    const nearest = averaged.reduce((best, point) =>
      Math.abs(point.frequency - frequency) <
      Math.abs(best.frequency - frequency)
        ? point
        : best,
    );
    return { frequency, db: nearest.db };
  });
};

export interface SweepRunResult {
  response: FrequencyPoint[];
  clipping: boolean;
  signalStrengthDb: number;
}

export const captureSweepRun = async (
  input: AudioInputSession,
  generator: SignalGenerator,
  options: {
    outputLevelDb: number;
    startHz: number;
    endHz: number;
    durationSeconds: number;
  },
): Promise<SweepRunResult> => {
  const snapshots: FrequencyPoint[][] = [];
  const levels: number[] = [];
  let clipping = false;
  await generator.start({
    type: "sweep",
    outputLevelDb: options.outputLevelDb,
    sweepStartHz: options.startHz,
    sweepEndHz: options.endHz,
    sweepDurationSeconds: options.durationSeconds,
  });
  const started = Date.now();
  while (Date.now() - started < options.durationSeconds * 1000) {
    snapshots.push(input.readSpectrum());
    const level = input.readLevel();
    levels.push(level.rmsDb);
    clipping ||= level.clipping;
    await wait(90);
  }
  await generator.stop();
  return {
    response: resampleToStandardBands(snapshots),
    clipping,
    signalStrengthDb:
      levels.reduce((total, value) => total + value, 0) /
      Math.max(1, levels.length),
  };
};
