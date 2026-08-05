"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioInputSession } from "../../lib/audio-input";
import {
  aggregateFrequencyBands,
  detectResponseIssues,
  normaliseResponse,
} from "../../lib/spectrum";
import type { FrequencyPoint } from "../../lib/types";
import { FrequencyGraph } from "./FrequencyGraph";

const blendResponses = (
  previous: FrequencyPoint[],
  current: FrequencyPoint[],
  amount: number,
) =>
  current.map((point, index) => ({
    frequency: point.frequency,
    db:
      previous[index] === undefined
        ? point.db
        : previous[index].db * amount + point.db * (1 - amount),
  }));

export function LiveSpectrum({
  initialSmoothing,
  guestLimited = false,
}: {
  initialSmoothing: number;
  guestLimited?: boolean;
}) {
  const inputRef = useRef<AudioInputSession | null>(null);
  const frameRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);
  const [current, setCurrent] = useState<FrequencyPoint[]>([]);
  const [peak, setPeak] = useState<FrequencyPoint[]>([]);
  const [average, setAverage] = useState<FrequencyPoint[]>([]);
  const [level, setLevel] = useState(-100);
  const [smoothing, setSmoothing] = useState(initialSmoothing);
  const [error, setError] = useState("");
  const [deviceNote, setDeviceNote] = useState("");
  const [guestSecondsRemaining, setGuestSecondsRemaining] = useState(60);
  const guestSecondsRef = useRef(60);
  const [guestExpired, setGuestExpired] = useState(false);

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  const stop = useCallback(async () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    await inputRef.current?.stop();
    inputRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!guestLimited || !running || guestExpired) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, guestSecondsRef.current - 1);
      guestSecondsRef.current = remaining;
      setGuestSecondsRemaining(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        setGuestExpired(true);
        setError("Your guest preview is complete. Create a free account for unlimited Live Spectrum use.");
        void stop();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [guestExpired, guestLimited, running, stop]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      void inputRef.current?.stop();
    },
    [],
  );

  const start = async () => {
    if (guestLimited && guestExpired) return;
    setError("");
    const input = new AudioInputSession();
    inputRef.current = input;
    try {
      const status = await input.start(smoothing);
      setDeviceNote(
        [status.label, ...status.processingLimitations].filter(Boolean).join(" · "),
      );
      setRunning(true);

      const draw = () => {
        const spectrum = input.readSpectrum(160);
        const inputLevel = input.readLevel();
        setLevel(inputLevel.rmsDb);
        if (!frozenRef.current) {
          setCurrent(spectrum);
          setPeak((previous) =>
            spectrum.map((point, index) => ({
              frequency: point.frequency,
              db: Math.max(point.db, previous[index]?.db ?? -100),
            })),
          );
          setAverage((previous) => blendResponses(previous, spectrum, 0.92));
        }
        frameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "The microphone could not be started.",
      );
      inputRef.current = null;
    }
  };

  const reset = () => {
    setCurrent([]);
    setPeak([]);
    setAverage([]);
  };

  const elevated = useMemo(() => {
    if (!current.length) return [];
    return detectResponseIssues(
      aggregateFrequencyBands(normaliseResponse(current), "flat"),
      4.5,
      -99,
    ).filter((issue) => issue.type === "peak");
  }, [current]);

  const graphSeries = useMemo(
    () => [
      {
        label: "Current",
        color: "#d7ff57",
        points: current,
        width: 2.3,
      },
      ...(!guestLimited ? [{
        label: "Peak hold",
        color: "#f57d44",
        points: peak,
        width: 1.2,
      }] : []),
      ...(!guestLimited ? [{
        label: "Average",
        color: "#76a9ff",
        points: average,
        dashed: true,
        width: 1.5,
      }] : []),
    ],
    [average, current, guestLimited, peak],
  );

  return (
    <div className="feature-stack">
      {guestLimited && (
        <div className="guest-preview-note" role="status">
          <div>
            <span className="eyebrow">Guest preview</span>
            <strong>
              {guestExpired ? "Preview complete" : `${guestSecondsRemaining} seconds available`}
            </strong>
          </div>
          <p>
            Create a free account for unlimited Live Spectrum use, averaging,
            peak hold and the Signal Generator.
          </p>
          <a className="button secondary" href="/sign-up?next=/%23spectrum">
            Create free account
          </a>
        </div>
      )}
      <div className="permission-note">
        <span className="eyebrow">Microphone privacy</span>
        <p>
          Audio stays on this device and is never uploaded. Permission is requested
          only when you choose <strong>Start listening</strong>.
        </p>
      </div>

      <div className="control-bar">
        <div className="button-row">
          {!running ? (
            <button
              className="button primary"
              disabled={guestExpired}
              onClick={() => void start()}
            >
              Start listening
            </button>
          ) : (
            <button className="button danger" onClick={() => void stop()}>
              Stop
            </button>
          )}
          <button
            className="button secondary"
            disabled={!running || guestLimited}
            aria-pressed={frozen}
            onClick={() => setFrozen((value) => !value)}
          >
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button className="button ghost" disabled={guestLimited} onClick={reset}>
            Reset hold
          </button>
        </div>
        <label className="range-control compact">
          <span>Smoothing {Math.round(smoothing * 100)}%</span>
          <input
            type="range"
            min="0"
            max="0.95"
            step="0.05"
            value={smoothing}
            onChange={(event) => {
              const value = Number(event.target.value);
              setSmoothing(value);
              inputRef.current?.setSmoothing(value);
            }}
          />
        </label>
      </div>

      <div className="level-row" aria-label={`Input level ${level.toFixed(0)} dBFS`}>
        <span>Input</span>
        <div className="meter">
          <i
            style={{
              width: `${Math.max(0, Math.min(100, ((level + 80) / 70) * 100))}%`,
            }}
          />
        </div>
        <strong>{level <= -99 ? "—" : `${level.toFixed(0)} dBFS`}</strong>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {deviceNote && <p className="microcopy">{deviceNote}</p>}
      {elevated.length > 0 && (
        <div className="alert amber" role="status">
          Broad elevated energy is visible around{" "}
          {Math.round(elevated[0].centerHz)} Hz. Treat this as a live clue, not an
          EQ recommendation.
        </div>
      )}

      <FrequencyGraph
        title="Live logarithmic frequency spectrum"
        summary={
          current.length
            ? `Live spectrum from 20 hertz to 20 kilohertz. ${elevated.length} broad elevated regions detected.`
            : "The spectrum is idle. Start listening to display microphone input."
        }
        series={graphSeries}
        issues={elevated}
        yMin={-100}
        yMax={-10}
      />
    </div>
  );
}
