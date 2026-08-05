import type {
  FrequencyPoint,
  TargetCurveType,
} from "./types.ts";

export const STANDARD_FREQUENCIES = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
  10000, 12500, 16000, 20000,
];

const interpolate = (
  frequency: number,
  anchors: Array<[number, number]>,
): number => {
  if (frequency <= anchors[0][0]) return anchors[0][1];
  if (frequency >= anchors[anchors.length - 1][0]) {
    return anchors[anchors.length - 1][1];
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const [rightFrequency, rightDb] = anchors[index];
    const [leftFrequency, leftDb] = anchors[index - 1];
    if (frequency <= rightFrequency) {
      const position =
        (Math.log10(frequency) - Math.log10(leftFrequency)) /
        (Math.log10(rightFrequency) - Math.log10(leftFrequency));
      return leftDb + (rightDb - leftDb) * position;
    }
  }

  return 0;
};

const curves: Record<TargetCurveType, Array<[number, number]>> = {
  flat: [
    [20, 0],
    [20000, 0],
  ],
  speech: [
    [20, -8],
    [80, -3],
    [200, 0],
    [1000, 0.8],
    [2500, 2],
    [5000, 0],
    [12000, -4],
    [20000, -7],
  ],
  "live-music": [
    [20, 1.5],
    [80, 1],
    [500, 0],
    [2500, 0.8],
    [8000, -0.5],
    [20000, -2],
  ],
  "recorded-music": [
    [20, 2],
    [80, 1.2],
    [500, 0],
    [4000, 0],
    [10000, -1],
    [20000, -2.5],
  ],
  "home-listening": [
    [20, 3],
    [50, 2.2],
    [100, 1.4],
    [500, 0.4],
    [1000, 0],
    [4000, -0.4],
    [10000, -1.3],
    [20000, -2.5],
  ],
};

export const getTargetDb = (
  target: TargetCurveType,
  frequency: number,
): number => interpolate(frequency, curves[target]);

export const buildTargetResponse = (
  target: TargetCurveType,
  frequencies: number[] = STANDARD_FREQUENCIES,
): FrequencyPoint[] =>
  frequencies.map((frequency) => ({
    frequency,
    db: Number(getTargetDb(target, frequency).toFixed(2)),
  }));

export const compareResponseToTarget = (
  response: FrequencyPoint[],
  target: TargetCurveType,
): FrequencyPoint[] =>
  response.map((point) => ({
    frequency: point.frequency,
    db: Number((point.db - getTargetDb(target, point.frequency)).toFixed(2)),
  }));
