import { STANDARD_FREQUENCIES } from "./target-curves.ts";
import type { FrequencyPoint } from "./types.ts";

const bell = (
  frequency: number,
  center: number,
  widthOctaves: number,
  gain: number,
) => {
  const distance = Math.log2(frequency / center);
  return gain * Math.exp(-(distance ** 2) / (2 * widthOctaves ** 2));
};

const seededNoise = (seed: number, index: number) => {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * 2;
};

export const generateSyntheticResponse = (
  seed = 1,
  improvement = 0,
): FrequencyPoint[] =>
  STANDARD_FREQUENCIES.map((frequency, index) => {
    const room =
      bell(frequency, 118, 0.5, 6.4 - improvement * 2.4) +
      bell(frequency, 72, 0.22, -9.8 + improvement * 1.2) +
      bell(frequency, 420, 0.65, 2.8 - improvement) +
      bell(frequency, 2850, 0.5, 3.7 - improvement * 1.6) +
      bell(frequency, 9000, 0.7, -2.2);
    const tilt = -0.55 * Math.log2(frequency / 1000);
    const noise = seededNoise(seed, index) * 0.7;
    return {
      frequency,
      db: Number((room + tilt + noise).toFixed(2)),
    };
  });

export const generateSyntheticRuns = (
  count = 2,
  comparisonIndex = 0,
): FrequencyPoint[][] =>
  Array.from({ length: count }, (_, index) =>
    generateSyntheticResponse(
      17 + index * 11 + comparisonIndex * 31,
      comparisonIndex > 0 ? 1 : 0,
    ),
  );
