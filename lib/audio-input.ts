import type { FrequencyPoint } from "./types.ts";

export interface AudioInputStatus {
  processingLimitations: string[];
  label: string;
}

export class AudioInputSession {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private frequencyData: Float32Array<ArrayBuffer> | null = null;
  private timeData: Float32Array<ArrayBuffer> | null = null;

  async start(smoothing = 0.72): Promise<AudioInputStatus> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Microphone capture is not supported here. Use simulation mode or a modern browser over HTTPS.",
      );
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new Error(
          "Microphone access was denied. Allow access in your browser settings, then try again—or use simulation mode.",
        );
      }
      if (name === "NotFoundError") {
        throw new Error(
          "No microphone was found. Connect an input device or use simulation mode.",
        );
      }
      throw new Error(
        "The microphone could not be started. Check that another app is not using it, or use simulation mode.",
      );
    }

    this.context = new AudioContext();
    await this.context.resume();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.minDecibels = -100;
    this.analyser.maxDecibels = -10;
    this.analyser.smoothingTimeConstant = smoothing;
    this.source.connect(this.analyser);
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.timeData = new Float32Array(this.analyser.fftSize);

    const track = this.stream.getAudioTracks()[0];
    const settings = track.getSettings();
    const limitations: string[] = [];
    if (settings.echoCancellation !== false) {
      limitations.push("The browser may still be applying echo cancellation.");
    }
    if (settings.noiseSuppression !== false) {
      limitations.push("The browser may still be applying noise suppression.");
    }
    if (settings.autoGainControl !== false) {
      limitations.push("The browser may still be applying automatic gain control.");
    }

    return {
      label: track.label || "Available microphone",
      processingLimitations: limitations,
    };
  }

  setSmoothing(value: number) {
    if (this.analyser) this.analyser.smoothingTimeConstant = value;
  }

  readSpectrum(pointCount = 160): FrequencyPoint[] {
    if (!this.analyser || !this.context || !this.frequencyData) return [];
    this.analyser.getFloatFrequencyData(this.frequencyData);
    const nyquist = this.context.sampleRate / 2;
    const minimum = 20;
    const maximum = Math.min(20000, nyquist);

    return Array.from({ length: pointCount }, (_, index) => {
      const position = index / (pointCount - 1);
      const frequency = minimum * (maximum / minimum) ** position;
      const bin = Math.min(
        this.frequencyData!.length - 1,
        Math.round((frequency / nyquist) * this.frequencyData!.length),
      );
      return {
        frequency,
        db: Number.isFinite(this.frequencyData![bin])
          ? this.frequencyData![bin]
          : -100,
      };
    });
  }

  readLevel(): { rmsDb: number; clipping: boolean } {
    if (!this.analyser || !this.timeData) {
      return { rmsDb: -100, clipping: false };
    }
    this.analyser.getFloatTimeDomainData(this.timeData);
    let squareTotal = 0;
    let peak = 0;
    for (const value of this.timeData) {
      squareTotal += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    const rms = Math.sqrt(squareTotal / this.timeData.length);
    return {
      rmsDb: rms > 0 ? 20 * Math.log10(rms) : -100,
      clipping: peak >= 0.985,
    };
  }

  async stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    this.analyser?.disconnect();
    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }
    this.context = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.frequencyData = null;
    this.timeData = null;
  }
}
