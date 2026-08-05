import { STANDARD_FREQUENCIES, getTargetDb } from "./target-curves.ts";
import type {
  DetectedIssue,
  FrequencyBand,
  FrequencyPoint,
  TargetCurveType,
} from "./types.ts";

const geometricMidpoint = (a: number, b: number) => Math.sqrt(a * b);

export const aggregateFrequencyBands = (
  points: FrequencyPoint[],
  target: TargetCurveType,
  centers: number[] = STANDARD_FREQUENCIES,
): FrequencyBand[] =>
  centers
    .map((centerHz, index) => {
      const startHz =
        index === 0
          ? 20
          : geometricMidpoint(centers[index - 1], centerHz);
      const endHz =
        index === centers.length - 1
          ? 20000
          : geometricMidpoint(centerHz, centers[index + 1]);
      const samples = points.filter(
        (point) => point.frequency >= startHz && point.frequency < endHz,
      );
      if (!samples.length) return null;
      const db =
        samples.reduce((total, sample) => total + sample.db, 0) /
        samples.length;
      const targetDb = getTargetDb(target, centerHz);
      return {
        centerHz,
        startHz,
        endHz,
        db,
        targetDb,
        deviationDb: db - targetDb,
        sampleCount: samples.length,
      };
    })
    .filter((band): band is FrequencyBand => band !== null);

const makeIssue = (
  bands: FrequencyBand[],
  type: DetectedIssue["type"],
): DetectedIssue => {
  const startHz = bands[0].startHz;
  const endHz = bands[bands.length - 1].endHz;
  const weightedDeviation =
    bands.reduce((total, band) => total + band.deviationDb, 0) / bands.length;
  const centerHz = Math.sqrt(startHz * endHz);
  const magnitude = Math.abs(weightedDeviation);

  return {
    id: `${type}-${Math.round(centerHz)}`,
    type,
    startHz,
    endHz,
    centerHz,
    deviationDb: weightedDeviation,
    severity:
      magnitude >= 8 ? "severe" : magnitude >= 4.5 ? "notable" : "mild",
    broad: endHz / startHz >= 1.45,
  };
};

export const detectResponseIssues = (
  bands: FrequencyBand[],
  peakThresholdDb = 2.5,
  dipThresholdDb = -3.5,
): DetectedIssue[] => {
  const issues: DetectedIssue[] = [];
  let active: FrequencyBand[] = [];
  let activeType: DetectedIssue["type"] | null = null;

  const flush = () => {
    if (activeType && active.length) {
      const issue = makeIssue(active, activeType);
      if (issue.broad || Math.abs(issue.deviationDb) >= 7) issues.push(issue);
    }
    active = [];
    activeType = null;
  };

  for (const band of bands) {
    const nextType =
      band.deviationDb >= peakThresholdDb
        ? "peak"
        : band.deviationDb <= dipThresholdDb
          ? "dip"
          : null;
    if (nextType !== activeType) flush();
    if (nextType) {
      activeType = nextType;
      active.push(band);
    }
  }
  flush();

  return issues.sort(
    (a, b) => Math.abs(b.deviationDb) - Math.abs(a.deviationDb),
  );
};

export const averageResponses = (
  responses: FrequencyPoint[][],
): FrequencyPoint[] => {
  if (!responses.length) return [];
  const shortest = Math.min(...responses.map((response) => response.length));
  return Array.from({ length: shortest }, (_, index) => ({
    frequency: responses[0][index].frequency,
    db:
      responses.reduce((total, response) => total + response[index].db, 0) /
      responses.length,
  }));
};

export const responseRmse = (
  first: FrequencyPoint[],
  second: FrequencyPoint[],
): number => {
  const length = Math.min(first.length, second.length);
  if (!length) return 99;
  const meanSquare =
    Array.from(
      { length },
      (_, index) => (first[index].db - second[index].db) ** 2,
    ).reduce((total, value) => total + value, 0) / length;
  return Math.sqrt(meanSquare);
};

export const normaliseResponse = (
  response: FrequencyPoint[],
  referenceStartHz = 400,
  referenceEndHz = 2000,
): FrequencyPoint[] => {
  const reference = response.filter(
    (point) =>
      point.frequency >= referenceStartHz &&
      point.frequency <= referenceEndHz,
  );
  const offset = reference.length
    ? reference.reduce((total, point) => total + point.db, 0) /
      reference.length
    : 0;
  return response.map((point) => ({
    frequency: point.frequency,
    db: point.db - offset,
  }));
};
