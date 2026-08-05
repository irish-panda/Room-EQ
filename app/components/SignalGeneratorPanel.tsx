"use client";

import { useEffect, useRef, useState } from "react";
import {
  SignalGenerator,
  type SignalType,
} from "../../lib/signal-generator";

const signalLabels: Record<SignalType, string> = {
  pink: "Pink noise",
  white: "White noise",
  sine: "Sine tone",
  sweep: "Log sine sweep",
};

export function SignalGeneratorPanel() {
  const generatorRef = useRef<SignalGenerator | null>(null);
  const [type, setType] = useState<SignalType>("pink");
  const [playing, setPlaying] = useState(false);
  const [outputLevelDb, setOutputLevelDb] = useState(-32);
  const [frequency, setFrequency] = useState(1000);
  const [sweepStartHz, setSweepStartHz] = useState(20);
  const [sweepEndHz, setSweepEndHz] = useState(20000);
  const [duration, setDuration] = useState(8);
  const [error, setError] = useState("");

  useEffect(() => {
    const generator = new SignalGenerator();
    generator.onStop = () => setPlaying(false);
    generatorRef.current = generator;
    return () => {
      generator.onStop = undefined;
      void generator.stop();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    void generatorRef.current
      ?.update({
        type,
        outputLevelDb,
        frequency,
        sweepStartHz,
        sweepEndHz,
        sweepDurationSeconds: duration,
      })
      .catch(() => {
        setError("That change could not be applied to the active signal.");
      });
  }, [duration, frequency, outputLevelDb, playing, sweepEndHz, sweepStartHz, type]);

  const stop = async () => {
    await generatorRef.current?.stop();
    setPlaying(false);
  };

  const start = async () => {
    setError("");
    try {
      await generatorRef.current?.start({
        type,
        outputLevelDb,
        frequency,
        sweepStartHz,
        sweepEndHz,
        sweepDurationSeconds: duration,
      });
      setPlaying(true);
    } catch {
      setError(
        "Audio output could not start. Check the browser’s media permissions and output volume.",
      );
    }
  };

  return (
    <div className="feature-stack">
      {playing && (
        <button
          className="emergency-stop"
          onClick={() => void stop()}
          aria-label="Stop generated audio immediately"
        >
          <span />
          Stop audio
        </button>
      )}

      <div className="safety-card">
        <span className="safety-mark">!</span>
        <div>
          <span className="eyebrow">Before any signal plays</span>
          <h3>Start quiet. Protect ears, speakers and amplifiers.</h3>
          <p>
            Turn the physical playback volume down first. Test signals can be
            uncomfortable and may damage equipment at high levels. Keep the red
            stop control within reach while listening.
          </p>
        </div>
      </div>

      <div className="generator-layout">
        <section className="panel">
          <span className="eyebrow">Signal</span>
          <div className="signal-grid">
            {(Object.keys(signalLabels) as SignalType[]).map((signalType) => (
              <button
                key={signalType}
                className={`select-card ${type === signalType ? "selected" : ""}`}
                aria-pressed={type === signalType}
                onClick={() => setType(signalType)}
              >
                <span className={`wave-symbol ${signalType}`} aria-hidden="true" />
                <strong>{signalLabels[signalType]}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="panel controls-panel">
          <div className="generator-control-heading">
            <span className="eyebrow">Output controls</span>
            {playing && (
              <span className="live-update-status" role="status">
                <i /> Live updates on
              </span>
            )}
          </div>
          <label className="range-control">
            <span>
              Output level <strong>{outputLevelDb} dBFS</strong>
            </span>
            <input
              type="range"
              min="-45"
              max="-6"
              step="1"
              value={outputLevelDb}
              onChange={(event) => setOutputLevelDb(Number(event.target.value))}
            />
            <small>Low</small>
            <small>Higher risk</small>
          </label>

          {type === "sine" && (
            <label className="field">
              <span>Frequency</span>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="20"
                  max="20000"
                  value={frequency}
                  onChange={(event) => setFrequency(Number(event.target.value))}
                />
                <i>Hz</i>
              </div>
            </label>
          )}

          {type === "sweep" && (
            <div className="field-grid">
              <label className="field">
                <span>Start frequency</span>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="20"
                    max="1000"
                    value={sweepStartHz}
                    onChange={(event) =>
                      setSweepStartHz(Number(event.target.value))
                    }
                  />
                  <i>Hz</i>
                </div>
              </label>
              <label className="field">
                <span>End frequency</span>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="1000"
                    max="20000"
                    value={sweepEndHz}
                    onChange={(event) =>
                      setSweepEndHz(Number(event.target.value))
                    }
                  />
                  <i>Hz</i>
                </div>
              </label>
              <label className="field">
                <span>Sweep duration</span>
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                  />
                  <i>sec</i>
                </div>
              </label>
            </div>
          )}

          <div className="generator-actions">
            {!playing ? (
              <button
                className="button primary large"
                onClick={() => void start()}
              >
                Start {signalLabels[type]}
              </button>
            ) : (
              <button
                className="button danger large"
                onClick={() => void stop()}
              >
                Stop now
              </button>
            )}
            <p>
              {playing
                ? "Changes apply immediately with short smoothing or crossfades."
                : "No signal starts automatically. Fades prevent clicks."}
            </p>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
