import type {
  ConfidenceInputs,
  ConfidenceResult,
} from "./types.ts";

export const calculateConfidence = (
  inputs: ConfidenceInputs,
): ConfidenceResult => {
  let score = 0;
  const reasons: string[] = [];

  const microphoneScore = {
    "built-in": 10,
    external: 22,
    calibrated: 35,
  }[inputs.microphoneType];
  score += microphoneScore;
  reasons.push(
    inputs.microphoneType === "calibrated"
      ? "A calibrated measurement microphone supports more precise interpretation."
      : inputs.microphoneType === "external"
        ? "An external microphone improves repeatability, but its frequency response is unknown."
        : "Built-in microphone processing and frequency response are unknown.",
  );

  if (inputs.ambientRating === "quiet") {
    score += 20;
    reasons.push("Ambient noise was low.");
  } else if (inputs.ambientRating === "acceptable") {
    score += 12;
    reasons.push("Ambient noise was acceptable.");
  } else {
    score += 2;
    reasons.push("Ambient noise may have masked parts of the sweep.");
  }

  if (!inputs.clipping) {
    score += 15;
  } else {
    reasons.push("Input clipping was detected.");
  }

  if (inputs.signalStrengthDb >= -32 && inputs.signalStrengthDb <= -8) {
    score += 15;
    reasons.push("Recorded signal strength was usable.");
  } else if (inputs.signalStrengthDb >= -42) {
    score += 8;
    reasons.push("Recorded signal strength was marginal.");
  } else {
    reasons.push("Recorded signal was weak.");
  }

  if (inputs.consistencyRmse <= 2) {
    score += 15;
    reasons.push("Repeated measurements were closely matched.");
  } else if (inputs.consistencyRmse <= 4.5) {
    score += 8;
    reasons.push("Repeated measurements had moderate variation.");
  } else {
    reasons.push("Repeated measurements were substantially inconsistent.");
  }

  if (inputs.successfulMeasurements >= 3) score += 15;
  else if (inputs.successfulMeasurements >= 2) score += 10;
  else reasons.push("Only one successful measurement was available.");

  score = Math.min(100, Math.max(0, score));
  let level: ConfidenceResult["level"] =
    score >= 72 ? "High" : score >= 43 ? "Moderate" : "Low";
  if (inputs.microphoneType === "built-in" && level === "High") {
    level = "Moderate";
    reasons.push(
      "Built-in microphones are capped at Moderate confidence because their processing and frequency response are unknown.",
    );
  }
  return { score, level, reasons };
};
