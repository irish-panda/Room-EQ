import type {
  AppSettings,
  ConfidenceLevel,
  DetectedIssue,
  MicrophoneType,
  Recommendation,
} from "./types.ts";

const frequencyText = (issue: DetectedIssue) => {
  const format = (value: number) =>
    value >= 1000
      ? `${Number((value / 1000).toFixed(value >= 10000 ? 0 : 1))} kHz`
      : `${Math.round(value)} Hz`;
  return issue.endHz / issue.startHz > 1.35
    ? `${format(issue.startHz)}–${format(issue.endHz)}`
    : `around ${format(issue.centerHz)}`;
};

const confidenceRank: Record<ConfidenceLevel, number> = {
  Low: 0,
  Moderate: 1,
  High: 2,
};

export const generateRecommendations = (
  issues: DetectedIssue[],
  microphoneType: MicrophoneType,
  confidence: ConfidenceLevel,
  settings: Pick<
    AppSettings,
    "maxBoostDb" | "maxCutDb" | "maxCorrections"
  >,
): Recommendation[] => {
  const candidates: Recommendation[] = [];
  const preciseEnough =
    microphoneType === "calibrated" &&
    confidenceRank[confidence] >= confidenceRank.Moderate;

  for (const issue of issues) {
    const range = frequencyText(issue);
    const isUnreliableBuiltInHigh =
      microphoneType === "built-in" && issue.centerHz > 6000;

    if (issue.type === "peak") {
      if (isUnreliableBuiltInHigh || (!issue.broad && !preciseEnough)) continue;
      const gain = -Math.min(
        settings.maxCutDb,
        Math.max(1, Math.abs(issue.deviationDb) * 0.65),
      );
      candidates.push({
        id: `cut-${issue.id}`,
        frequencyLabel: range,
        action: "cut",
        gainDb: Number(gain.toFixed(1)),
        q: preciseEnough
          ? Number(
              Math.min(
                4,
                Math.max(0.5, issue.centerHz / (issue.endHz - issue.startHz)),
              ).toFixed(1),
            )
          : undefined,
        confidence,
        explanation: `A broad elevated region appeared across the repeated measurements. A cautious reduction is more reliable than trying to fill every dip.`,
        alternative:
          issue.centerHz < 300
            ? "Try moving the speakers or listening position away from nearby walls first."
            : "Check nearby reflective surfaces and speaker toe-in before applying EQ.",
      });
      continue;
    }

    const deepNull = issue.deviationDb <= -7 || !issue.broad;
    if (deepNull) {
      candidates.push({
        id: `reject-${issue.id}`,
        frequencyLabel: range,
        action: "avoid-boost",
        confidence,
        explanation:
          "Do not boost this dip. It may be caused by cancellation or speaker placement, and added gain could consume headroom without correcting it.",
        alternative:
          "Move the speakers or listening position in small increments and measure again.",
      });
      continue;
    }

    if (
      isUnreliableBuiltInHigh ||
      microphoneType === "built-in" ||
      confidenceRank[confidence] < confidenceRank.Moderate
    ) {
      candidates.push({
        id: `placement-${issue.id}`,
        frequencyLabel: range,
        action: "placement",
        confidence,
        explanation:
          "The dip is visible, but the current measurement does not support a safe boost recommendation.",
        alternative:
          "Review placement and repeat the measurement from a slightly different position.",
      });
      continue;
    }

    const gain = Math.min(
      settings.maxBoostDb,
      Math.max(0.5, Math.abs(issue.deviationDb) * 0.35),
    );
    candidates.push({
      id: `boost-${issue.id}`,
      frequencyLabel: range,
      action: "boost",
      gainDb: Number(gain.toFixed(1)),
      q: preciseEnough
        ? Number(
            Math.min(
              2,
              Math.max(0.5, issue.centerHz / (issue.endHz - issue.startHz)),
            ).toFixed(1),
          )
        : undefined,
      confidence,
      explanation:
        "A shallow, broad reduction appeared consistently. If placement changes do not help, a small boost may be reasonable.",
      alternative: "Measure again after a small listening-position change.",
    });
  }

  return candidates
    .sort((a, b) => {
      const priority = {
        cut: 0,
        "avoid-boost": 1,
        placement: 2,
        boost: 3,
        acoustic: 4,
      };
      return priority[a.action] - priority[b.action];
    })
    .slice(0, settings.maxCorrections);
};

export const buildNonEqRecommendations = (
  issues: DetectedIssue[],
  confidence: ConfidenceLevel,
): Recommendation[] => {
  const items: Recommendation[] = [
    {
      id: "reflection-guidance",
      frequencyLabel: "Across the room",
      action: "acoustic",
      confidence,
      explanation:
        "EQ cannot remove reverberation, flutter echo, or strong early reflections.",
      alternative:
        "Use placement, soft furnishings, or purpose-designed acoustic treatment where appropriate.",
    },
  ];

  if (issues.some((issue) => issue.type === "dip" && issue.centerHz < 300)) {
    items.unshift({
      id: "low-frequency-placement",
      frequencyLabel: "Low frequencies",
      action: "placement",
      confidence,
      explanation:
        "Low-frequency dips often change dramatically with speaker and listener position.",
      alternative:
        "Move one element at a time by 10–20 cm, then run a comparison measurement.",
    });
  }
  return items;
};
