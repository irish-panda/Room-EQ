export type Screen =
  | "home"
  | "analyse"
  | "spectrum"
  | "generator"
  | "results"
  | "rooms"
  | "pricing"
  | "settings";

export type MicrophoneType = "built-in" | "external" | "calibrated";
export type TargetCurveType =
  | "flat"
  | "speech"
  | "live-music"
  | "recorded-music"
  | "home-listening";
export type ConfidenceLevel = "Low" | "Moderate" | "High";

export interface FrequencyPoint {
  frequency: number;
  db: number;
}

export interface FrequencyBand {
  centerHz: number;
  startHz: number;
  endHz: number;
  db: number;
  targetDb: number;
  deviationDb: number;
  sampleCount: number;
}

export interface DetectedIssue {
  id: string;
  type: "peak" | "dip";
  startHz: number;
  endHz: number;
  centerHz: number;
  deviationDb: number;
  severity: "mild" | "notable" | "severe";
  broad: boolean;
}

export interface Recommendation {
  id: string;
  frequencyLabel: string;
  action: "cut" | "boost" | "avoid-boost" | "placement" | "acoustic";
  gainDb?: number;
  q?: number;
  confidence: ConfidenceLevel;
  explanation: string;
  alternative?: string;
}

export interface AmbientNoiseResult {
  dbFs: number;
  rating: "quiet" | "acceptable" | "high";
  note: string;
}

export interface ConfidenceInputs {
  microphoneType: MicrophoneType;
  ambientRating: AmbientNoiseResult["rating"];
  clipping: boolean;
  signalStrengthDb: number;
  consistencyRmse: number;
  successfulMeasurements: number;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  score: number;
  reasons: string[];
}

export interface MeasurementSettings {
  targetCurve: TargetCurveType;
  microphoneType: MicrophoneType;
  outputLevelDb: number;
  sweepStartHz: number;
  sweepEndHz: number;
  sweepDurationSeconds: number;
  runCount: number;
}

export interface Measurement {
  id: string;
  timestamp: string;
  response: FrequencyPoint[];
  targetResponse: FrequencyPoint[];
  confidence: ConfidenceLevel;
  confidenceScore: number;
  confidenceReasons: string[];
  detectedIssues: DetectedIssue[];
  recommendations: Recommendation[];
  nonEqRecommendations: Recommendation[];
  settings: MeasurementSettings;
  ambientNoise: AmbientNoiseResult;
  clipping: boolean;
  signalStrengthDb: number;
  consistencyRmse: number;
  simulated: boolean;
  runResponses: FrequencyPoint[][];
}

export interface RoomProfile {
  id: string;
  name: string;
  roomType: string;
  targetCurve: TargetCurveType;
  microphoneType: MicrophoneType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  measurements: Measurement[];
}

export interface AppSettings {
  defaultMicrophoneType: MicrophoneType;
  defaultTargetCurve: TargetCurveType;
  maxBoostDb: number;
  maxCutDb: number;
  maxCorrections: number;
  spectrumSmoothing: number;
  advancedMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultMicrophoneType: "built-in",
  defaultTargetCurve: "home-listening",
  maxBoostDb: 3,
  maxCutDb: 6,
  maxCorrections: 5,
  spectrumSmoothing: 0.72,
  advancedMode: false,
};

export const MICROPHONE_LABELS: Record<MicrophoneType, string> = {
  "built-in": "Built-in device microphone",
  external: "External uncalibrated microphone",
  calibrated: "Calibrated measurement microphone",
};

export const TARGET_LABELS: Record<TargetCurveType, string> = {
  flat: "Flat",
  speech: "Speech",
  "live-music": "Live music",
  "recorded-music": "Recorded music",
  "home-listening": "Home listening",
};
