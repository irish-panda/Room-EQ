"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioInputSession } from "../lib/audio-input";
import { calculateConfidence } from "../lib/confidence";
import {
  buildNonEqRecommendations,
  generateRecommendations,
} from "../lib/recommendations";
import { SignalGenerator } from "../lib/signal-generator";
import { generateSyntheticRuns } from "../lib/simulation";
import {
  aggregateFrequencyBands,
  averageResponses,
  detectResponseIssues,
  normaliseResponse,
  responseRmse,
} from "../lib/spectrum";
import {
  clearLocalData,
  deleteRoom,
  getRooms,
  getSettings,
  saveRoom,
  saveSettings,
} from "../lib/storage";
import { captureSweepRun, measureAmbientNoise } from "../lib/sweep-measurement";
import { buildTargetResponse } from "../lib/target-curves";
import {
  DEFAULT_SETTINGS,
  MICROPHONE_LABELS,
  TARGET_LABELS,
  type AmbientNoiseResult,
  type AppSettings,
  type Measurement,
  type MicrophoneType,
  type RoomProfile,
  type Screen,
  type TargetCurveType,
} from "../lib/types";
import { FrequencyGraph } from "./components/FrequencyGraph";
import { AccountControls } from "./components/AccountControls";
import { useAccount } from "./components/AuthProvider";
import { useBilling } from "./components/BillingProvider";
import { LiveSpectrum } from "./components/LiveSpectrum";
import { SignalGeneratorPanel } from "./components/SignalGeneratorPanel";

const navigation: Array<{
  id: Screen;
  label: string;
  short: string;
  index: string;
}> = [
  { id: "home", label: "Home", short: "Home", index: "01" },
  { id: "analyse", label: "Analyse room", short: "Analyse", index: "02" },
  { id: "spectrum", label: "Live spectrum", short: "Live", index: "03" },
  { id: "generator", label: "Signal generator", short: "Signal", index: "04" },
  { id: "results", label: "Results", short: "Results", index: "05" },
  { id: "rooms", label: "Saved rooms", short: "Rooms", index: "06" },
  { id: "pricing", label: "Plans & pricing", short: "Pricing", index: "07" },
  { id: "settings", label: "Settings", short: "Settings", index: "08" },
];

const paidScreens = new Set<Screen>(["analyse", "results", "rooms"]);
const accountScreens = new Set<Screen>(["generator", "settings"]);
const mobilePrimaryScreens = new Set<Screen>(["home", "analyse", "spectrum"]);

const titles: Record<Screen, { eyebrow: string; title: string; intro: string }> = {
  home: {
    eyebrow: "Room EQ Assistant",
    title: "Hear the room, not the guesswork.",
    intro:
      "Generate a safe test signal, listen through the microphone you already have, and turn broad repeatable problems into conservative next steps.",
  },
  analyse: {
    eyebrow: "Guided measurement",
    title: "Analyse a room",
    intro:
      "Two repeated sweeps help separate a consistent room response from a one-off reading.",
  },
  spectrum: {
    eyebrow: "Realtime input",
    title: "Live spectrum",
    intro:
      "Inspect current, averaged and peak-held energy from approximately 20 Hz to 20 kHz.",
  },
  generator: {
    eyebrow: "Controlled output",
    title: "Signal generator",
    intro:
      "Pink noise, white noise, sine tones and log sweeps with safe starts and immediate stop.",
  },
  results: {
    eyebrow: "Analysis report",
    title: "Results",
    intro:
      "Prioritise repeatable broad peaks, treat dips cautiously, and compare changes against the same target.",
  },
  rooms: {
    eyebrow: "On this device",
    title: "Saved rooms",
    intro:
      "Profiles and measurements are stored locally in this browser. Nothing is uploaded.",
  },
  pricing: {
    eyebrow: "Simple company billing",
    title: "Plans that grow with the crew.",
    intro:
      "Start free, then choose one named user or give every worker their own owner-managed seat.",
  },
  settings: {
    eyebrow: "Defaults & guardrails",
    title: "Settings",
    intro:
      "Tune recommendation limits and analyser behaviour without changing saved measurements.",
  },
};

const roomTypes = [
  "Listening room",
  "Home studio",
  "Living room",
  "Practice room",
  "Meeting room",
  "Other",
];

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));

function ConfidenceBadge({ level }: { level: Measurement["confidence"] }) {
  return <span className={`confidence ${level.toLowerCase()}`}>{level}</span>;
}

function EmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-orbit" aria-hidden="true">
        <i />
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

function HomeScreen({
  rooms,
  onNavigate,
  onStartAnalysis,
}: {
  rooms: RoomProfile[];
  onNavigate: (screen: Screen) => void;
  onStartAnalysis: () => void;
}) {
  const measurementCount = rooms.reduce(
    (total, room) => total + room.measurements.length,
    0,
  );
  const latest = [...rooms].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];

  return (
    <div className="home-grid">
      <section className="hero-card">
        <div className="hero-visual" aria-hidden="true">
          <span className="room-outline">
            <i className="speaker left" />
            <i className="speaker right" />
            <b className="listener" />
            {Array.from({ length: 6 }, (_, index) => (
              <em key={index} style={{ "--ring": index } as React.CSSProperties} />
            ))}
          </span>
        </div>
        <div className="hero-copy">
          <span className="status-chip">
            <i />
            Local-first audio lab
          </span>
          <h2>Start with the room you can hear.</h2>
          <p>
            Room EQ Assistant runs two sweeps, checks consistency and limits its
            advice to changes the measurement can actually support.
          </p>
          <div className="button-row">
            <button
              className="button primary large"
              data-testid="start-analysis"
              onClick={onStartAnalysis}
            >
              Start room analysis
            </button>
            <button
              className="button secondary large"
              onClick={() => onNavigate("spectrum")}
            >
              Open live spectrum
            </button>
          </div>
        </div>
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        <button onClick={() => onNavigate("generator")}>
          <span className="action-index">A</span>
          <strong>Generate a signal</strong>
          <small>Noise, sine or sweep</small>
          <i aria-hidden="true">↗</i>
        </button>
        <button onClick={() => onNavigate("rooms")}>
          <span className="action-index">B</span>
          <strong>View saved rooms</strong>
          <small>{rooms.length} profiles on this device</small>
          <i aria-hidden="true">↗</i>
        </button>
        <button onClick={() => onNavigate("pricing")}>
          <span className="action-index">C</span>
          <strong>View plans</strong>
          <small>AUD pricing, GST included</small>
          <i aria-hidden="true">↗</i>
        </button>
      </section>

      <section className="readiness-card">
        <div>
          <span className="eyebrow">Measurement readiness</span>
          <h3>Three things matter more than precision theatre.</h3>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Quiet the room</strong>
              <p>Background noise can hide the quieter parts of a sweep.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Repeat the test</strong>
              <p>Broad problems that repeat are more trustworthy.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Prefer placement</strong>
              <p>Deep nulls and reflections are rarely fixed by more gain.</p>
            </div>
          </li>
        </ol>
      </section>

      <aside className="local-summary">
        <span className="eyebrow">Your local workspace</span>
        <div className="summary-number">
          <strong>{String(measurementCount).padStart(2, "0")}</strong>
          <span>saved measurements</span>
        </div>
        {latest ? (
          <button onClick={() => onNavigate("rooms")}>
            <span>Most recent</span>
            <strong>{latest.name}</strong>
            <small>Updated {formatDate(latest.updatedAt)}</small>
          </button>
        ) : (
          <p>Your first room profile will appear here after you save a result.</p>
        )}
      </aside>
    </div>
  );
}

interface AnalysisWorkflowProps {
  rooms: RoomProfile[];
  settings: AppSettings;
  initialRoom?: RoomProfile;
  comparisonBase?: Measurement;
  onComplete: (measurement: Measurement, room: RoomProfile) => void;
}

function AnalysisWorkflow({
  rooms,
  settings,
  initialRoom,
  comparisonBase,
  onComplete,
}: AnalysisWorkflowProps) {
  const inputRef = useRef<AudioInputSession | null>(null);
  const [step, setStep] = useState(comparisonBase ? 2 : 1);
  const [selectedRoomId, setSelectedRoomId] = useState(
    initialRoom?.id ?? "new",
  );
  const [roomName, setRoomName] = useState(initialRoom?.name ?? "");
  const [roomType, setRoomType] = useState(
    initialRoom?.roomType ?? "Listening room",
  );
  const [notes, setNotes] = useState(initialRoom?.notes ?? "");
  const [microphoneType, setMicrophoneType] = useState<MicrophoneType>(
    initialRoom?.microphoneType ?? settings.defaultMicrophoneType,
  );
  const [targetCurve, setTargetCurve] = useState<TargetCurveType>(
    initialRoom?.targetCurve ?? settings.defaultTargetCurve,
  );
  const [mode, setMode] = useState<"real" | "simulation">("real");
  const [safeLevel, setSafeLevel] = useState(-32);
  const [ambient, setAmbient] = useState<AmbientNoiseResult | null>(null);
  const [ambientBusy, setAmbientBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      void inputRef.current?.stop();
    },
    [],
  );

  const selectExistingRoom = (id: string) => {
    setSelectedRoomId(id);
    if (id === "new") return;
    const room = rooms.find((candidate) => candidate.id === id);
    if (!room) return;
    setRoomName(room.name);
    setRoomType(room.roomType);
    setNotes(room.notes ?? "");
    setMicrophoneType(room.microphoneType);
    setTargetCurve(room.targetCurve);
  };

  const runAmbientCheck = async () => {
    setAmbientBusy(true);
    setError("");
    if (mode === "simulation") {
      await new Promise((resolve) => window.setTimeout(resolve, 600));
      setAmbient({
        dbFs: -55.2,
        rating: "quiet",
        note: "Simulated quiet-room noise floor.",
      });
      setAmbientBusy(false);
      return;
    }
    try {
      if (!inputRef.current) {
        const input = new AudioInputSession();
        await input.start(settings.spectrumSmoothing);
        inputRef.current = input;
      }
      setAmbient(await measureAmbientNoise(inputRef.current));
    } catch (ambientError) {
      setError(
        ambientError instanceof Error
          ? ambientError.message
          : "The ambient-noise check could not start.",
      );
    } finally {
      setAmbientBusy(false);
    }
  };

  const completeMeasurement = async () => {
    if (!ambient) return;
    setRunning(true);
    setError("");
    setProgress(4);
    setStatus("Preparing the first sweep.");
    try {
      const runResponses = [];
      const runLevels: number[] = [];
      let clipping = false;

      if (mode === "simulation") {
        const runs = generateSyntheticRuns(2, comparisonBase ? 1 : 0);
        for (let index = 0; index < runs.length; index += 1) {
          setStatus(`Running simulated sweep ${index + 1} of 2.`);
          setProgress(index === 0 ? 28 : 67);
          await new Promise((resolve) => window.setTimeout(resolve, 750));
          runResponses.push(normaliseResponse(runs[index]));
          runLevels.push(-22.5 + index * 0.4);
        }
      } else {
        if (!inputRef.current) {
          throw new Error(
            "Run the ambient-noise check first so the microphone is ready.",
          );
        }
        const generator = new SignalGenerator();
        for (let index = 0; index < 2; index += 1) {
          setStatus(`Playing and recording sweep ${index + 1} of 2.`);
          setProgress(index === 0 ? 18 : 58);
          const run = await captureSweepRun(inputRef.current, generator, {
            outputLevelDb: safeLevel,
            startHz: 20,
            endHz: 20000,
            durationSeconds: 6,
          });
          runResponses.push(normaliseResponse(run.response));
          runLevels.push(run.signalStrengthDb);
          clipping ||= run.clipping;
          if (index === 0) {
            setStatus("First sweep captured. Allowing the room to settle.");
            await new Promise((resolve) => window.setTimeout(resolve, 700));
          }
        }
      }

      setStatus("Comparing repeats and building recommendations.");
      setProgress(86);
      const consistencyRmse = responseRmse(runResponses[0], runResponses[1]);
      const response = averageResponses(runResponses);
      const signalStrengthDb =
        runLevels.reduce((total, value) => total + value, 0) / runLevels.length;
      const confidence = calculateConfidence({
        microphoneType,
        ambientRating: ambient.rating,
        clipping,
        signalStrengthDb,
        consistencyRmse,
        successfulMeasurements: runResponses.length,
      });
      if (consistencyRmse > 4.5) {
        confidence.reasons.push(
          "The repeated sweeps were substantially inconsistent; repeat the test before acting on EQ.",
        );
      }
      const bands = aggregateFrequencyBands(response, targetCurve);
      const issues = detectResponseIssues(bands);
      const recommendations = generateRecommendations(
        issues,
        microphoneType,
        confidence.level,
        settings,
      );
      const now = new Date().toISOString();
      const measurement: Measurement = {
        id: newId(),
        timestamp: now,
        response,
        targetResponse: buildTargetResponse(targetCurve),
        confidence: confidence.level,
        confidenceScore: confidence.score,
        confidenceReasons: confidence.reasons,
        detectedIssues: issues,
        recommendations,
        nonEqRecommendations: buildNonEqRecommendations(
          issues,
          confidence.level,
        ),
        settings: {
          targetCurve,
          microphoneType,
          outputLevelDb: safeLevel,
          sweepStartHz: 20,
          sweepEndHz: 20000,
          sweepDurationSeconds: mode === "simulation" ? 6 : 6,
          runCount: runResponses.length,
        },
        ambientNoise: ambient,
        clipping,
        signalStrengthDb,
        consistencyRmse,
        simulated: mode === "simulation",
        runResponses,
      };
      const existing = rooms.find((room) => room.id === selectedRoomId);
      const room: RoomProfile = {
        id: existing?.id ?? initialRoom?.id ?? newId(),
        name: roomName.trim() || initialRoom?.name || "Untitled room",
        roomType,
        targetCurve,
        microphoneType,
        notes: notes.trim(),
        createdAt: existing?.createdAt ?? initialRoom?.createdAt ?? now,
        updatedAt: now,
        measurements: existing?.measurements ?? initialRoom?.measurements ?? [],
      };
      setProgress(100);
      setStatus("Analysis complete.");
      await inputRef.current?.stop();
      inputRef.current = null;
      onComplete(measurement, room);
    } catch (measurementError) {
      setError(
        measurementError instanceof Error
          ? measurementError.message
          : "The measurement could not be completed.",
      );
    } finally {
      setRunning(false);
    }
  };

  const stepLabels = ["Setup", "Prepare", "Room check", "Measure"];

  return (
    <div className="analysis-shell">
      {comparisonBase && (
        <div className="comparison-banner">
          <span className="eyebrow">Comparison measurement</span>
          <p>
            Using the saved result from {formatDate(comparisonBase.timestamp)} as
            the baseline. Keep the microphone position and playback level the same.
          </p>
        </div>
      )}

      <div className="stepper" aria-label="Analysis progress">
        {stepLabels.map((label, index) => (
          <button
            key={label}
            className={
              index + 1 === step
                ? "active"
                : index + 1 < step
                  ? "complete"
                  : ""
            }
            aria-current={index + 1 === step ? "step" : undefined}
            disabled={index + 1 > step || running}
            onClick={() => index + 1 < step && setStep(index + 1)}
          >
            <i>{index + 1 < step ? "✓" : String(index + 1).padStart(2, "0")}</i>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <section className="workflow-card">
        {step === 1 && (
          <div className="workflow-content">
            <span className="eyebrow">Step 1 of 4 · Setup</span>
            <h2>Set up the room and listening target</h2>
            <p className="lead">
              Keep the essentials together on one screen: room, microphone and
              the response you want to measure against.
            </p>
            {rooms.length > 0 && (
              <label className="field">
                <span>Use a saved room</span>
                <select
                  value={selectedRoomId}
                  onChange={(event) => selectExistingRoom(event.target.value)}
                >
                  <option value="new">Create a new room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="field-grid">
              <label className="field">
                <span>Room name</span>
                <input
                  data-testid="room-name"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="e.g. Main listening room"
                />
              </label>
              <label className="field">
                <span>Room type</span>
                <select
                  value={roomType}
                  onChange={(event) => setRoomType(event.target.value)}
                >
                  {roomTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Notes <small>optional</small></span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Speaker setup, listening position or anything you want to remember"
              />
            </label>
            <div className="workflow-section">
              <div>
                <span className="eyebrow">Microphone</span>
                <h3>What input are you using?</h3>
              </div>
              <div className="choice-stack compact-choices">
                {(Object.keys(MICROPHONE_LABELS) as MicrophoneType[]).map(
                  (type) => (
                    <label
                      key={type}
                      className={`radio-card ${
                        microphoneType === type ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="microphone"
                        checked={microphoneType === type}
                        onChange={() => setMicrophoneType(type)}
                      />
                      <span className="radio-dot" />
                      <span>
                        <strong>{MICROPHONE_LABELS[type]}</strong>
                        <small>
                          {type === "built-in"
                            ? "Broad guidance only; response and processing are unknown."
                            : type === "external"
                              ? "More repeatable, but not frequency-calibrated."
                              : "Supports more precise, higher-confidence guidance."}
                        </small>
                      </span>
                      <i>
                        {type === "calibrated"
                          ? "BEST"
                          : type === "external"
                            ? "BETTER"
                            : "BASIC"}
                      </i>
                    </label>
                  ),
                )}
              </div>
            </div>
            <div className="workflow-section">
              <div>
                <span className="eyebrow">Target curve</span>
                <h3>Choose a listening target</h3>
              </div>
              <div className="target-grid compact-targets">
                {(Object.keys(TARGET_LABELS) as TargetCurveType[]).map(
                  (target) => (
                    <button
                      key={target}
                      className={`target-card ${
                        targetCurve === target ? "selected" : ""
                      }`}
                      aria-pressed={targetCurve === target}
                      onClick={() => setTargetCurve(target)}
                    >
                      <span
                        className={`curve-preview ${target}`}
                        aria-hidden="true"
                      >
                        <i />
                      </span>
                      <strong>{TARGET_LABELS[target]}</strong>
                      <small>
                        {target === "flat"
                          ? "Neutral reference"
                          : target === "speech"
                            ? "Vocal clarity"
                            : target === "live-music"
                              ? "Impact and presence"
                              : target === "recorded-music"
                                ? "Controlled low end"
                                : "Relaxed in-room tilt"}
                      </small>
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="workflow-actions">
              <span />
              <button
                className="button primary"
                data-testid="analysis-next"
                disabled={!roomName.trim()}
                onClick={() => setStep(2)}
              >
                Continue to room preparation
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="workflow-content placement-step">
            <span className="eyebrow">Step 2 of 4 · Prepare</span>
            <h2>Prepare the microphone and playback level</h2>
            <p className="lead">
              Position the microphone once, then begin quietly. Nothing plays
              until the final measurement stage.
            </p>
            <div className="placement-layout">
              <div className="placement-diagram" aria-hidden="true">
                <span className="mini-room">
                  <i className="mini-speaker left" />
                  <i className="mini-speaker right" />
                  <b className="mini-mic">MIC</b>
                  <em />
                  <em />
                  <em />
                </span>
              </div>
              <ol className="instruction-list">
                <li>
                  <span>01</span>
                  <p>
                    Put the microphone at seated ear height in the main listening
                    position.
                  </p>
                </li>
                <li>
                  <span>02</span>
                  <p>
                    Keep it clear of your body, the chair back and hard nearby
                    surfaces.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <p>
                    Point a measurement microphone as its manufacturer recommends;
                    otherwise keep device orientation unchanged.
                  </p>
                </li>
                <li>
                  <span>04</span>
                  <p>
                    For comparisons, mark the position and do not move the
                    microphone between runs.
                  </p>
                </li>
              </ol>
            </div>
            <div className="workflow-section level-section">
              <div>
                <span className="eyebrow">Safe test output</span>
                <h3>Begin at a conservative level</h3>
              </div>
              <div className="level-setting">
                <div>
                  <span>Test output</span>
                  <strong>{safeLevel} dBFS</strong>
                  <small>Recommended start: −32 dBFS</small>
                </div>
                <input
                  type="range"
                  min="-42"
                  max="-12"
                  step="1"
                  value={safeLevel}
                  aria-label="Test output level"
                  onChange={(event) => setSafeLevel(Number(event.target.value))}
                />
                <div className="range-labels">
                  <span>Quieter</span>
                  <span>Use caution</span>
                </div>
              </div>
              <div className="alert amber safety-reminder" role="note">
                <strong>Loud sweeps can damage hearing or equipment.</strong> Turn
                the physical playback level down first and keep an immediate mute
                within reach.
              </div>
            </div>
            <div className="workflow-actions">
              <button className="button ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="button primary" onClick={() => setStep(3)}>
                Continue to room check
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="workflow-content">
            <span className="eyebrow">Step 3 of 4 · Room check</span>
            <h2>Check the room before the sweep</h2>
            <p className="lead">
              Choose real capture or clearly labelled simulation. Microphone
              permission is requested only when you run the real check.
            </p>
            <div className="mode-switch" role="group" aria-label="Input mode">
              <button
                className={mode === "real" ? "active" : ""}
                aria-pressed={mode === "real"}
                onClick={() => {
                  setMode("real");
                  setAmbient(null);
                }}
              >
                Real microphone
              </button>
              <button
                data-testid="simulation-mode"
                className={mode === "simulation" ? "active" : ""}
                aria-pressed={mode === "simulation"}
                onClick={() => {
                  setMode("simulation");
                  setAmbient(null);
                  void inputRef.current?.stop();
                  inputRef.current = null;
                }}
              >
                Development simulation
              </button>
            </div>
            {mode === "simulation" ? (
              <div className="simulation-card">
                <span>SIM</span>
                <div>
                  <strong>Synthetic room and microphone data</strong>
                  <p>
                    Useful for testing the complete app when microphone access is
                    unavailable. The result will be permanently marked simulated.
                  </p>
                </div>
              </div>
            ) : (
              <div className="permission-note">
                <span className="eyebrow">Before permission is requested</span>
                <p>
                  The browser will ask for one microphone. Captured samples are
                  analysed in memory and are not saved or uploaded. Only response
                  data is kept if you save the result.
                </p>
              </div>
            )}
            <button
              className="button primary"
              data-testid="ambient-check"
              disabled={ambientBusy}
              onClick={() => void runAmbientCheck()}
            >
              {ambientBusy
                ? "Listening…"
                : mode === "simulation"
                  ? "Run simulated noise check"
                  : "Request microphone & check noise"}
            </button>
            {ambient && (
              <div
                className={`ambient-result ${ambient.rating}`}
                data-testid="ambient-result"
                role="status"
              >
                <span>{ambient.dbFs.toFixed(1)} dBFS</span>
                <div>
                  <strong>{ambient.rating} noise floor</strong>
                  <p>{ambient.note}</p>
                </div>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <div className="workflow-actions">
              <button className="button ghost" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="button primary"
                disabled={!ambient}
                onClick={() => setStep(4)}
              >
                Continue to measurement
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="workflow-content measurement-step">
            <span className="eyebrow">Step 4 of 4 · Measure</span>
            <h2>Run two repeat measurements</h2>
            <p className="lead">
              Stay clear of the speakers and keep the room still. The app will
              compare the runs before it offers any guidance.
            </p>
            <div className="measurement-summary">
              <div>
                <span>Room</span>
                <strong>{roomName}</strong>
              </div>
              <div>
                <span>Input</span>
                <strong>
                  {mode === "simulation"
                    ? "Simulation"
                    : MICROPHONE_LABELS[microphoneType]}
                </strong>
              </div>
              <div>
                <span>Target</span>
                <strong>{TARGET_LABELS[targetCurve]}</strong>
              </div>
              <div>
                <span>Level</span>
                <strong>{safeLevel} dBFS</strong>
              </div>
            </div>
            {running ? (
              <div className="measurement-progress" aria-live="polite">
                <div className="progress-orbit" aria-hidden="true">
                  <i />
                  <b>{progress}%</b>
                </div>
                <div>
                  <strong>{status}</strong>
                  <div className="progress-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <p>Keep the microphone and room unchanged.</p>
                </div>
              </div>
            ) : (
              <div className="measurement-ready">
                <span className="ready-pulse" aria-hidden="true" />
                <div>
                  <strong>Ready for two {mode === "simulation" ? "simulated " : ""}sweeps</strong>
                  <p>
                    Approximate duration: {mode === "simulation" ? "3 seconds" : "15 seconds"}.
                  </p>
                </div>
                <button
                  className="button primary large"
                  data-testid="run-measurement"
                  onClick={() => void completeMeasurement()}
                >
                  Begin measurement
                </button>
              </div>
            )}
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {!running && (
              <div className="workflow-actions">
                <button className="button ghost" onClick={() => setStep(3)}>
                  Back
                </button>
                <span />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultsScreen({
  measurement,
  room,
  comparisonBase,
  saved,
  onSave,
  onStartComparison,
  onNavigate,
}: {
  measurement?: Measurement;
  room?: RoomProfile;
  comparisonBase?: Measurement;
  saved: boolean;
  onSave: () => void;
  onStartComparison: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  const comparison = useMemo(() => {
    if (!measurement || !comparisonBase) return null;
    const length = Math.min(
      measurement.response.length,
      comparisonBase.response.length,
      measurement.targetResponse.length,
    );
    let improved = 0;
    let worsened = 0;
    for (let index = 0; index < length; index += 1) {
      const target = measurement.targetResponse[index].db;
      const before = Math.abs(comparisonBase.response[index].db - target);
      const after = Math.abs(measurement.response[index].db - target);
      if (after < before - 0.5) improved += 1;
      if (after > before + 0.5) worsened += 1;
    }
    return { improved, worsened, unchanged: length - improved - worsened };
  }, [comparisonBase, measurement]);

  if (!measurement || !room) {
    return (
      <EmptyState
        title="No analysis result yet"
        copy="Complete two sweeps or open a saved room measurement to see a report."
        action={
          <button className="button primary" onClick={() => onNavigate("analyse")}>
            Start an analysis
          </button>
        }
      />
    );
  }

  const cuts = measurement.recommendations.filter(
    (item) => item.action === "cut",
  ).length;
  const inconsistent = measurement.consistencyRmse > 4.5;

  return (
    <div className="results-stack" data-testid="results-screen">
      {measurement.simulated && (
        <div className="simulation-ribbon" role="status">
          <strong>SIMULATED RESULT</strong>
          <span>
            Generated development data—not a measurement of your room or device.
          </span>
        </div>
      )}

      <section className="result-summary-card">
        <div>
          <span className="eyebrow">{room.name}</span>
          <h2>
            {inconsistent
              ? "The repeats need another pass."
              : cuts
                ? `${cuts} broad ${cuts === 1 ? "region" : "regions"} worth reviewing.`
                : "No strong cut recommendation was found."}
          </h2>
          <p>
            {inconsistent
              ? "The two readings changed enough that EQ advice should wait. Quiet the room, keep the microphone fixed and repeat."
              : `The result favours broad, conservative changes against the ${TARGET_LABELS[
                  measurement.settings.targetCurve
                ].toLowerCase()} target.`}
          </p>
        </div>
        <div className="score-block">
          <span>Measurement confidence</span>
          <strong>{measurement.confidenceScore}</strong>
          <ConfidenceBadge level={measurement.confidence} />
        </div>
        <div className="result-actions">
          <button
            className="button primary"
            data-testid="save-measurement"
            disabled={saved}
            onClick={onSave}
          >
            {saved ? "Saved to room" : "Save measurement"}
          </button>
          <button className="button secondary" onClick={onStartComparison}>
            Start comparison measurement
          </button>
        </div>
      </section>

      {comparison && comparisonBase && (
        <section className="comparison-overview">
          <div>
            <span className="eyebrow">Before & after</span>
            <h3>
              {comparison.improved > comparison.worsened
                ? "The updated response moved closer overall."
                : comparison.worsened > comparison.improved
                  ? "The updated response needs review."
                  : "The overall response changed only slightly."}
            </h3>
          </div>
          <dl>
            <div className="improved">
              <dt>Improved bands</dt>
              <dd>{comparison.improved}</dd>
            </div>
            <div className="worsened">
              <dt>Worsened bands</dt>
              <dd>{comparison.worsened}</dd>
            </div>
            <div>
              <dt>Similar bands</dt>
              <dd>{comparison.unchanged}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="panel result-graph-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Frequency response</span>
            <h3>Measured against target</h3>
          </div>
          <p>Shaded regions mark broad peaks and dips detected by the rules.</p>
        </div>
        <FrequencyGraph
          title="Measured room response"
          summary={`${measurement.detectedIssues.length} broad response issues found. Confidence ${measurement.confidence}.`}
          issues={measurement.detectedIssues}
          series={[
            ...(comparisonBase
              ? [
                  {
                    label: "Original",
                    color: "#7d8b86",
                    points: comparisonBase.response,
                    dashed: true,
                    width: 1.5,
                  },
                ]
              : []),
            {
              label: comparisonBase ? "Updated" : "Measured",
              color: "#d7ff57",
              points: measurement.response,
              width: 2.5,
            },
            {
              label: TARGET_LABELS[measurement.settings.targetCurve],
              color: "#76a9ff",
              points: measurement.targetResponse,
              dashed: true,
              width: 1.6,
            },
          ]}
        />
      </section>

      <div className="results-columns">
        <section className="panel recommendations-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EQ guidance</span>
              <h3>Conservative corrections</h3>
            </div>
            <span className="count-chip">
              {measurement.recommendations.length}
            </span>
          </div>
          {measurement.recommendations.length ? (
            <div className="recommendation-list">
              {measurement.recommendations.map((item, index) => (
                <article
                  key={item.id}
                  className={`recommendation ${item.action}`}
                >
                  <span className="recommendation-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="recommendation-heading">
                      <span>{item.frequencyLabel}</span>
                      <ConfidenceBadge level={item.confidence} />
                    </div>
                    <h4>
                      {item.action === "cut"
                        ? `Reduce by approximately ${Math.abs(item.gainDb ?? 0)} dB`
                        : item.action === "boost"
                          ? `Cautious boost up to ${item.gainDb} dB`
                          : item.action === "avoid-boost"
                            ? "Do not boost this dip"
                            : "Investigate placement first"}
                      {item.q ? ` · Q ${item.q}` : ""}
                    </h4>
                    <p>{item.explanation}</p>
                    {item.alternative && (
                      <small>
                        <strong>Try instead:</strong> {item.alternative}
                      </small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="panel-empty">
              No correction passed the current confidence and safety rules.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Beyond EQ</span>
              <h3>Room-first actions</h3>
            </div>
          </div>
          <div className="non-eq-list">
            {measurement.nonEqRecommendations.map((item) => (
              <article key={item.id}>
                <span>{item.action === "placement" ? "MOVE" : "TREAT"}</span>
                <div>
                  <strong>{item.frequencyLabel}</strong>
                  <p>{item.explanation}</p>
                  <small>{item.alternative}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="limitations-grid">
        <div>
          <span className="eyebrow">Why this confidence?</span>
          <ul>
            {measurement.confidenceReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <span className="eyebrow">Measurement limitations</span>
          <ul>
            <li>
              Browsers and built-in microphones may apply gain control, noise
              reduction or unknown frequency shaping.
            </li>
            <li>
              Wireless playback adds delay and compression; use a wired signal path
              when possible.
            </li>
            <li>
              One microphone position cannot describe the whole room, and EQ cannot
              remove reverberation or reflections.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function SavedRoomsScreen({
  rooms,
  onView,
  onCompare,
  onDelete,
  onStart,
}: {
  rooms: RoomProfile[];
  onView: (room: RoomProfile, measurement: Measurement) => void;
  onCompare: (
    room: RoomProfile,
    original: Measurement,
    updated: Measurement,
  ) => void;
  onDelete: (room: RoomProfile) => void;
  onStart: () => void;
}) {
  if (!rooms.length) {
    return (
      <EmptyState
        title="No saved rooms yet"
        copy="Create a room, complete two sweeps and save the result. It will remain available after reload on this device."
        action={
          <button className="button primary" onClick={onStart}>
            Create your first room
          </button>
        }
      />
    );
  }

  return (
    <div className="rooms-grid" data-testid="saved-rooms">
      {rooms
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((room) => {
          const latest = room.measurements[room.measurements.length - 1];
          const previous = room.measurements[room.measurements.length - 2];
          return (
            <article className="room-card" key={room.id}>
              <div className="room-card-top">
                <span className="room-monogram">
                  {room.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <span className="eyebrow">{room.roomType}</span>
                  <h3>{room.name}</h3>
                  <p>{room.notes || "No room notes"}</p>
                </div>
                <button
                  className="text-button danger-text"
                  onClick={() => onDelete(room)}
                >
                  Delete
                </button>
              </div>
              <dl className="room-meta">
                <div>
                  <dt>Target</dt>
                  <dd>{TARGET_LABELS[room.targetCurve]}</dd>
                </div>
                <div>
                  <dt>Microphone</dt>
                  <dd>{MICROPHONE_LABELS[room.microphoneType]}</dd>
                </div>
                <div>
                  <dt>Measurements</dt>
                  <dd>{room.measurements.length}</dd>
                </div>
              </dl>
              {latest ? (
                <div className="latest-measurement">
                  <div>
                    <span>Latest · {formatDate(latest.timestamp)}</span>
                    <strong>
                      <ConfidenceBadge level={latest.confidence} />{" "}
                      {latest.simulated ? "Simulated" : "Recorded"} result
                    </strong>
                  </div>
                  <div className="button-row">
                    <button
                      className="button secondary"
                      onClick={() => onView(room, latest)}
                    >
                      View result
                    </button>
                    {previous && (
                      <button
                        className="button ghost"
                        onClick={() => onCompare(room, previous, latest)}
                      >
                        Compare latest
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="panel-empty">This profile has no saved measurements.</p>
              )}
            </article>
          );
        })}
    </div>
  );
}

function SettingsScreen({
  settings,
  onChange,
  onClear,
}: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClear: () => void;
}) {
  const update = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Measurement defaults</span>
            <h3>Starting choices</h3>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Default microphone type</span>
            <select
              value={settings.defaultMicrophoneType}
              onChange={(event) =>
                update(
                  "defaultMicrophoneType",
                  event.target.value as MicrophoneType,
                )
              }
            >
              {(Object.keys(MICROPHONE_LABELS) as MicrophoneType[]).map((type) => (
                <option key={type} value={type}>
                  {MICROPHONE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Default target curve</span>
            <select
              value={settings.defaultTargetCurve}
              onChange={(event) =>
                update("defaultTargetCurve", event.target.value as TargetCurveType)
              }
            >
              {(Object.keys(TARGET_LABELS) as TargetCurveType[]).map((target) => (
                <option key={target} value={target}>
                  {TARGET_LABELS[target]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Recommendation guardrails</span>
            <h3>Keep advice conservative</h3>
          </div>
        </div>
        <label className="range-control">
          <span>
            Maximum suggested boost <strong>{settings.maxBoostDb} dB</strong>
          </span>
          <input
            type="range"
            min="0"
            max="6"
            step="0.5"
            value={settings.maxBoostDb}
            onChange={(event) => update("maxBoostDb", Number(event.target.value))}
          />
        </label>
        <label className="range-control">
          <span>
            Maximum suggested cut <strong>{settings.maxCutDb} dB</strong>
          </span>
          <input
            type="range"
            min="1"
            max="12"
            step="0.5"
            value={settings.maxCutDb}
            onChange={(event) => update("maxCutDb", Number(event.target.value))}
          />
        </label>
        <label className="range-control">
          <span>
            Maximum corrections <strong>{settings.maxCorrections}</strong>
          </span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={settings.maxCorrections}
            onChange={(event) =>
              update("maxCorrections", Number(event.target.value))
            }
          />
        </label>
      </section>

      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Spectrum display</span>
            <h3>Live analyser</h3>
          </div>
        </div>
        <label className="range-control">
          <span>
            Default smoothing{" "}
            <strong>{Math.round(settings.spectrumSmoothing * 100)}%</strong>
          </span>
          <input
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={settings.spectrumSmoothing}
            onChange={(event) =>
              update("spectrumSmoothing", Number(event.target.value))
            }
          />
        </label>
        <label className="toggle-row">
          <span>
            <strong>Advanced mode</strong>
            <small>Show Q values when confidence supports them.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.advancedMode}
            onChange={(event) => update("advancedMode", event.target.checked)}
          />
        </label>
      </section>

      <section className="panel info-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">About this tool</span>
            <h3>Guidance, not calibration</h3>
          </div>
        </div>
        <ul className="info-list">
          <li>Built-in microphones may apply unknown processing and tonal shaping.</li>
          <li>Repeat measurements; trust broad consistent problems over narrow dips.</li>
          <li>EQ cannot necessarily correct reverberation, reflections or cancellation.</li>
          <li>High test levels can damage hearing and equipment. You remain responsible.</li>
          <li>
            Browser output-device selection and disabling audio processing are not
            consistently available; the app reports detected limits where possible.
          </li>
        </ul>
      </section>

      <section className="danger-zone">
        <div>
          <span className="eyebrow">Local data</span>
          <h3>Clear all rooms and settings</h3>
          <p>This permanently removes IndexedDB data stored by this browser.</p>
        </div>
        <button className="button danger" onClick={onClear}>
          Clear local data
        </button>
      </section>
    </div>
  );
}

type BillingCycle = "monthly" | "annual";

const pricingPlans = [
  {
    id: "free",
    name: "Free",
    audience: "For quick checks",
    monthlyPrice: 0,
    annualPrice: 0,
    includedUsers: "Free account",
    additionalUser: null,
    featured: false,
    features: [
      "Full Live Spectrum",
      "Signal Generator",
    ],
  },
  {
    id: "solo",
    name: "Solo",
    audience: "For independent technicians",
    monthlyPrice: 19,
    annualPrice: 190,
    includedUsers: "1 user",
    additionalUser: null,
    featured: false,
    features: [
      "Everything in Free",
      "Full room analysis",
      "Unlimited measurements",
      "One named user · one active session",
    ],
  },
  {
    id: "team",
    name: "Team",
    audience: "For small crews",
    monthlyPrice: 59,
    annualPrice: 590,
    includedUsers: "5 users included",
    additionalUser: {
      monthly: "A$9 per additional user / month",
      annual: "A$90 per additional user / year",
    },
    featured: true,
    features: [
      "Everything in Solo",
      "Owner-managed invitations",
      "Individual login for every worker",
    ],
  },
  {
    id: "business",
    name: "Business",
    audience: "For larger operations",
    monthlyPrice: 149,
    annualPrice: 1490,
    includedUsers: "20 users included",
    additionalUser: {
      monthly: "A$7 per additional user / month",
      annual: "A$70 per additional user / year",
    },
    featured: false,
    features: [
      "Everything in Team",
      "Owner, admin and worker roles",
      "Priority onboarding support",
    ],
  },
] as const;

const activeBillingStatuses = new Set(["active", "trialing", "past_due"]);

function PricingScreen({
  onOpenGuestSpectrum,
  onOpenFreeTools,
  liveBillingEnabled,
}: {
  onOpenGuestSpectrum: () => void;
  onOpenFreeTools: () => void;
  liveBillingEnabled: boolean;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [billingMessage, setBillingMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const {
    isLoaded,
    isSignedIn,
    activeOrganizationId: orgId,
    isAdmin,
    isPlatformOwner,
  } = useAccount();
  const { billing, organizationMemberCount, refresh } = useBilling();
  const hasActiveBilling = Boolean(
    billing && activeBillingStatuses.has(billing.status),
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) return;

    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get("checkout");
    const checkoutSessionId = params.get("session_id");
    if (checkoutState !== "success" && checkoutState !== "cancelled") return;
    let ignore = false;

    const finishCheckout = async () => {
      if (checkoutState === "success" && checkoutSessionId) {
        const response = await fetch(
          `/api/stripe/confirm?session_id=${encodeURIComponent(checkoutSessionId)}`,
          { headers: { "x-room-eq-organization-id": orgId } },
        );
        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Subscription confirmation failed.");
        }
      }
      await refresh();
      if (!ignore) {
        if (checkoutState === "success") {
          setBillingMessage("Your 14-day trial is active.");
        } else {
          setBillingMessage("Checkout was cancelled. No plan change was made.");
        }
        window.history.replaceState({}, "", `${window.location.pathname}#pricing`);
      }
    };

    void finishCheckout().catch((error) => {
      if (!ignore) {
        setBillingMessage(
          error instanceof Error ? error.message : "Billing could not be loaded.",
        );
      }
    });

    return () => {
      ignore = true;
    };
  }, [isLoaded, isSignedIn, orgId, refresh]);

  const startCheckout = async (plan: "solo" | "team" | "business") => {
    setPendingAction(plan);
    setBillingMessage("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-room-eq-organization-id": orgId ?? "",
        },
        body: JSON.stringify({ plan, cycle }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout could not be opened.");
      }
      window.location.assign(data.url);
    } catch (error) {
      setBillingMessage(
        error instanceof Error ? error.message : "Checkout could not be opened.",
      );
      setPendingAction("");
    }
  };

  const openBillingPortal = async () => {
    setPendingAction("portal");
    setBillingMessage("");
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "x-room-eq-organization-id": orgId ?? "" },
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Billing management could not be opened.");
      }
      window.location.assign(data.url);
    } catch (error) {
      setBillingMessage(
        error instanceof Error
          ? error.message
          : "Billing management could not be opened.",
      );
      setPendingAction("");
    }
  };

  return (
    <div className="pricing-stack">
      <section className="pricing-intro-card">
        <div>
          <span className="eyebrow">Clear Australian pricing</span>
          <h2>Every price includes GST.</h2>
          <p>
            Paid plans include a 14-day full trial. Choose monthly flexibility or
            save two months with annual billing.
          </p>
        </div>
        <div
          className="billing-toggle"
          role="group"
          aria-label="Choose billing cycle"
        >
          <button
            className={cycle === "monthly" ? "active" : ""}
            aria-pressed={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
          >
            Monthly
          </button>
          <button
            className={cycle === "annual" ? "active" : ""}
            aria-pressed={cycle === "annual"}
            onClick={() => setCycle("annual")}
          >
            Annual · 2 months free
          </button>
        </div>
      </section>

      {!liveBillingEnabled && (
        <p className="pricing-launch-note" role="status">
          Subscriptions are not open yet. No payment will be taken while live Stripe billing is being prepared.
        </p>
      )}

      <section className="pricing-grid" aria-label="Subscription plans">
        {pricingPlans.map((plan) => {
          const price = cycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
          const currentPlanId = !isSignedIn
            ? null
            : isPlatformOwner
              ? "business"
              : hasActiveBilling && billing?.plan
                ? billing.plan
                : "free";
          const isCurrentPlan = plan.id === currentPlanId;
          return (
            <article
              className={`pricing-card${plan.featured ? " featured" : ""}`}
              key={plan.name}
            >
              <div className="plan-flags">
                {isCurrentPlan && (
                  <span className="current-plan-flag">
                    Current plan
                  </span>
                )}
                {plan.featured && <span className="plan-badge">Best for most teams</span>}
              </div>
              <span className="eyebrow">{plan.audience}</span>
              <h3>{plan.name}</h3>
              <div className="plan-price">
                <strong>A${price}</strong>
                <span>
                  {price === 0
                    ? "forever"
                    : cycle === "monthly"
                      ? "per month"
                      : "per year"}
                </span>
              </div>
              <p className="plan-users">{plan.includedUsers}</p>
              {plan.additionalUser && (
                <p className="additional-user">
                  {plan.additionalUser[cycle]}, GST included
                </p>
              )}
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan.id === "free" ? (
                <button
                  className="button secondary plan-action"
                  onClick={isSignedIn ? onOpenFreeTools : onOpenGuestSpectrum}
                >
                  {isSignedIn ? "Open free tools" : "Try Live Spectrum"}
                </button>
              ) : !isLoaded ? (
                <button className="button secondary plan-action" disabled>
                  Loading account…
                </button>
              ) : !isSignedIn ? (
                liveBillingEnabled ? (
                  <a
                    href="/sign-up?next=/%23pricing"
                    className={`button plan-action ${plan.featured ? "primary" : "secondary"}`}
                  >
                    Start 14-day trial
                  </a>
                ) : (
                  <button className="button secondary plan-action" disabled>
                    Subscriptions opening soon
                  </button>
                )
              ) : billing?.isPlatformOwner ? (
                <button className="button secondary plan-action" disabled>
                  {plan.id === "business"
                    ? "Your unrestricted plan"
                    : "Included in your owner access"}
                </button>
              ) : !liveBillingEnabled ? (
                <button className="button secondary plan-action" disabled>
                  Subscriptions opening soon
                </button>
              ) : !orgId ? (
                <button className="button secondary plan-action" disabled>
                  Create or choose a business
                </button>
              ) : !isAdmin ? (
                <button className="button secondary plan-action" disabled>
                  Admin manages this plan
                </button>
              ) : plan.id === "solo" && organizationMemberCount > 1 ? (
                <button className="button secondary plan-action" disabled>
                  Team required for {organizationMemberCount} users
                </button>
              ) : billing?.plan === plan.id && activeBillingStatuses.has(billing.status) ? (
                <button
                  className="button secondary plan-action"
                  disabled={pendingAction === "portal"}
                  onClick={() => void openBillingPortal()}
                >
                  {pendingAction === "portal" ? "Opening billing…" : "Manage current plan"}
                </button>
              ) : hasActiveBilling ? (
                <button className="button secondary plan-action" disabled>
                  Current plan: {billing?.plan ?? "paid"}
                </button>
              ) : (
                <button
                  className={`button plan-action ${plan.featured ? "primary" : "secondary"}`}
                  disabled={Boolean(pendingAction)}
                  onClick={() => void startCheckout(plan.id)}
                >
                  {pendingAction === plan.id ? "Opening checkout…" : "Start 14-day trial"}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="account-model-card">
        <div>
          <span className="eyebrow">Fair access for every crew</span>
          <h3>Personal means one person.</h3>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Solo is a named-user plan</strong>
              <p>One login keeps one active session. Shared use requires Team.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Team gives each worker a seat</strong>
              <p>The owner invites up to five included users, then adds seats as needed.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Business adds delegated control</strong>
              <p>Owners can assign administrators while workers keep individual access.</p>
            </div>
          </li>
        </ol>
      </section>

      {billingMessage && (
        <p className="pricing-message" role="status">
          {billingMessage}
        </p>
      )}
    </div>
  );
}

export function RoomEqAssistant({ liveBillingEnabled }: { liveBillingEnabled: boolean }) {
  const {
    isLoaded: authLoaded,
    isSignedIn,
    activeOrganizationId: orgId,
    isPlatformOwner,
  } = useAccount();
  const {
    billing,
    isLoading: billingLoading,
    error: billingError,
  } = useBilling();
  const [screen, setScreen] = useState<Screen>("home");
  const [rooms, setRooms] = useState<RoomProfile[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [activeMeasurement, setActiveMeasurement] = useState<
    Measurement | undefined
  >();
  const [activeRoom, setActiveRoom] = useState<RoomProfile | undefined>();
  const [comparisonBase, setComparisonBase] = useState<
    Measurement | undefined
  >();
  const [analysisSession, setAnalysisSession] = useState(0);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const reloadRooms = useCallback(async () => {
    try {
      setRooms(await getRooms());
    } catch {
      setRooms([]);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        reloadRooms(),
        getSettings()
          .then(setSettingsState)
          .catch(() => setSettingsState(DEFAULT_SETTINGS)),
      ]);
      setLoaded(true);
    };
    void load();
  }, [reloadRooms]);

  useEffect(() => {
    const fromHash = () => {
      const value = window.location.hash.replace("#", "") as Screen;
      if (navigation.some((item) => item.id === value)) setScreen(value);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const navigate = (next: Screen) => {
    setMobileMenuOpen(false);
    setScreen(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startFreshAnalysis = () => {
    setComparisonBase(undefined);
    setActiveRoom(undefined);
    setActiveMeasurement(undefined);
    setSaved(false);
    setAnalysisSession((value) => value + 1);
    navigate("analyse");
  };

  const handleMeasurementComplete = (
    measurement: Measurement,
    room: RoomProfile,
  ) => {
    setActiveMeasurement(measurement);
    setActiveRoom(room);
    setSaved(false);
    navigate("results");
  };

  const handleSaveMeasurement = async () => {
    if (!activeRoom || !activeMeasurement) return;
    const existing = rooms.find((room) => room.id === activeRoom.id);
    const measurements = [
      ...(existing?.measurements ?? activeRoom.measurements),
    ];
    if (!measurements.some((item) => item.id === activeMeasurement.id)) {
      measurements.push(activeMeasurement);
    }
    const updated: RoomProfile = {
      ...activeRoom,
      measurements,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveRoom(updated);
      setActiveRoom(updated);
      setSaved(true);
      setToast("Measurement saved on this device.");
      await reloadRooms();
    } catch {
      setToast("The measurement could not be saved in this browser.");
    }
  };

  const startComparison = () => {
    if (!activeRoom || !activeMeasurement) return;
    setComparisonBase(activeMeasurement);
    setAnalysisSession((value) => value + 1);
    navigate("analyse");
  };

  const updateSettings = async (next: AppSettings) => {
    setSettingsState(next);
    try {
      await saveSettings(next);
      setToast("Settings saved.");
    } catch {
      setToast("Settings could not be saved.");
    }
  };

  const clearData = async () => {
    if (
      !window.confirm(
        "Clear every saved room, measurement and setting from this browser?",
      )
    ) {
      return;
    }
    await clearLocalData();
    setRooms([]);
    setSettingsState(DEFAULT_SETTINGS);
    setActiveMeasurement(undefined);
    setActiveRoom(undefined);
    setComparisonBase(undefined);
    setToast("Local data cleared.");
  };

  const removeRoom = async (room: RoomProfile) => {
    if (!window.confirm(`Delete “${room.name}” and all of its measurements?`)) {
      return;
    }
    await deleteRoom(room.id);
    await reloadRooms();
    setToast(`${room.name} was deleted.`);
  };

  const renderScreen = () => {
    const requiresPaidAccess = paidScreens.has(screen);
    const requiresAccount = requiresPaidAccess || accountScreens.has(screen);
    if (
      requiresAccount &&
      (!authLoaded ||
        (requiresPaidAccess &&
          isSignedIn &&
          !isPlatformOwner &&
          orgId &&
          billingLoading))
    ) {
      return (
        <section className="account-required-card" aria-busy="true">
          <span className="eyebrow">Checking access</span>
          <h2>Opening your account…</h2>
          <p>Confirming the access available to this login.</p>
        </section>
      );
    }

    if (
      requiresAccount &&
      !isSignedIn &&
      authLoaded
    ) {
      const freeAccountFeature = accountScreens.has(screen);
      return (
        <section className="account-required-card">
          <span className="eyebrow">
            {freeAccountFeature ? "Free account required" : "Individual access"}
          </span>
          <h2>
            {freeAccountFeature
              ? `Create an account to use ${titles[screen].title.toLowerCase()}.`
              : "Log in before using room analysis."}
          </h2>
          <p>
            {freeAccountFeature
              ? "There is no charge. Use Google or your own email and password."
              : "Use Google or your own email and password. Team access gives each worker their own invited login."}
          </p>
          <div className="button-row">
            <a
              className="button primary large"
              href={`/sign-in?next=/%23${screen}`}
            >
              Log in
            </a>
            <a
              className="button secondary large"
              href={`/sign-up?next=/%23${screen}`}
            >
              Create account
            </a>
            {!freeAccountFeature && (
              <button className="button ghost large" onClick={() => navigate("pricing")}>
                View plans
              </button>
            )}
          </div>
        </section>
      );
    }

    if (requiresPaidAccess && isSignedIn && !orgId && !isPlatformOwner) {
      return (
        <section className="account-required-card">
          <span className="eyebrow">Business workspace required</span>
          <h2>Create or choose your business.</h2>
          <p>
            Paid access belongs to a business workspace so owners can invite and
            remove workers without sharing credentials.
          </p>
          <button className="button primary large" onClick={() => navigate("pricing")}>
            Go to plans and account setup
          </button>
        </section>
      );
    }

    if (requiresPaidAccess && isSignedIn && !billing?.hasAccess) {
      return (
        <section className="account-required-card">
          <span className="eyebrow">Paid room analysis</span>
          <h2>
            {billing?.seatLimitExceeded
              ? "This Solo workspace has more than one member."
              : "Start a trial to unlock room analysis."}
          </h2>
          <p>
            {billing?.seatLimitExceeded
              ? "Remove the additional member or move the business to Team."
              : billingError ||
                "Choose Solo, Team or Business. Every paid plan includes a 14-day trial."}
          </p>
          <button className="button primary large" onClick={() => navigate("pricing")}>
            View plans
          </button>
        </section>
      );
    }

    switch (screen) {
      case "home":
        return (
          <HomeScreen
            rooms={rooms}
            onNavigate={navigate}
            onStartAnalysis={startFreshAnalysis}
          />
        );
      case "analyse":
        return (
          <AnalysisWorkflow
            key={analysisSession}
            rooms={rooms}
            settings={settings}
            initialRoom={activeRoom}
            comparisonBase={comparisonBase}
            onComplete={handleMeasurementComplete}
          />
        );
      case "spectrum":
        return (
          <LiveSpectrum
            initialSmoothing={settings.spectrumSmoothing}
            guestLimited={!isSignedIn}
          />
        );
      case "generator":
        return <SignalGeneratorPanel />;
      case "results":
        return (
          <ResultsScreen
            measurement={activeMeasurement}
            room={activeRoom}
            comparisonBase={comparisonBase}
            saved={saved}
            onSave={() => void handleSaveMeasurement()}
            onStartComparison={startComparison}
            onNavigate={navigate}
          />
        );
      case "rooms":
        return (
          <SavedRoomsScreen
            rooms={rooms}
            onStart={startFreshAnalysis}
            onDelete={(room) => void removeRoom(room)}
            onView={(room, measurement) => {
              setActiveRoom(room);
              setActiveMeasurement(measurement);
              setComparisonBase(undefined);
              setSaved(true);
              navigate("results");
            }}
            onCompare={(room, original, updated) => {
              setActiveRoom(room);
              setActiveMeasurement(updated);
              setComparisonBase(original);
              setSaved(true);
              navigate("results");
            }}
          />
        );
      case "pricing":
        return (
          <PricingScreen
            onOpenGuestSpectrum={() => navigate("spectrum")}
            onOpenFreeTools={() => navigate("generator")}
            liveBillingEnabled={liveBillingEnabled}
          />
        );
      case "settings":
        return (
          <SettingsScreen
            settings={settings}
            onChange={(next) => void updateSettings(next)}
            onClear={() => void clearData()}
          />
        );
    }
  };

  const current = titles[screen];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>ROOM EQ</strong>
            <small>ASSISTANT</small>
          </span>
        </button>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={screen === item.id ? "active" : ""}
              aria-current={screen === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <span>{item.index}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            <i className={loaded ? "ready" : ""} />
            {loaded ? "Local storage ready" : "Opening local storage"}
          </span>
          <small>Audio stays on this device</small>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => navigate("home")}>
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <strong>ROOM EQ</strong>
          </button>
          <div className="topbar-actions">
            <div className="topbar-status">
              <span>Browser audio</span>
              <i />
              <strong>Local only</strong>
            </div>
            <AccountControls />
            <button
              className="settings-shortcut"
              onClick={() => navigate("settings")}
              aria-label="Open settings"
            >
              <span aria-hidden="true">•••</span>
            </button>
          </div>
        </header>

        <main id="main-content">
          <header className="page-heading">
            <div>
              <span className="eyebrow">{current.eyebrow}</span>
              <h1>{current.title}</h1>
            </div>
            <p>{current.intro}</p>
          </header>
          {renderScreen()}
        </main>

        <footer className="app-footer">
          <div>
            <span>Room EQ Assistant · An Irish Panda product</span>
            <span>Guidance only · Protect your hearing and equipment</span>
          </div>
          <nav aria-label="Legal and support">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/refunds">Cancellation &amp; refunds</a>
            <a href="/support">Support</a>
          </nav>
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation
          .filter((item) => mobilePrimaryScreens.has(item.id))
          .map((item) => (
            <button
              key={item.id}
              className={screen === item.id ? "active" : ""}
              aria-current={screen === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <i>{item.index}</i>
              <span>{item.short}</span>
            </button>
          ))}
        <button
          className={
            !mobilePrimaryScreens.has(screen) || mobileMenuOpen ? "active" : ""
          }
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setMobileMenuOpen(true)}
        >
          <i aria-hidden="true">•••</i>
          <span>More</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div
          className="mobile-menu-backdrop"
          role="presentation"
          onMouseDown={() => setMobileMenuOpen(false)}
        >
          <section
            className="mobile-menu-sheet"
            id="mobile-more-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-menu-handle" aria-hidden="true" />
            <header>
              <div>
                <span className="eyebrow">Room EQ Assistant</span>
                <h2 id="mobile-menu-title">More</h2>
              </div>
              <button
                className="mobile-menu-close"
                aria-label="Close menu"
                autoFocus
                onClick={() => setMobileMenuOpen(false)}
              >
                ×
              </button>
            </header>
            <nav aria-label="All app sections">
              {navigation
                .filter((item) => !mobilePrimaryScreens.has(item.id))
                .map((item) => (
                  <button
                    key={item.id}
                    className={screen === item.id ? "active" : ""}
                    aria-current={screen === item.id ? "page" : undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <i>{item.index}</i>
                    <span>
                      <strong>{item.label}</strong>
                      <small>
                        {item.id === "generator"
                          ? "Create pink noise, tones and sweeps"
                          : item.id === "results"
                            ? "Open the latest room report"
                            : item.id === "rooms"
                              ? "Measurements saved on this device"
                              : item.id === "pricing"
                                ? "Plans, access and billing"
                                : "Audio defaults and local data"}
                      </small>
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                ))}
            </nav>
            <p>Audio analysis stays on this device.</p>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <i />
          {toast}
        </div>
      )}
    </div>
  );
}
