export type SignalType = "pink" | "white" | "sine" | "sweep";

export interface SignalOptions {
  type: SignalType;
  outputLevelDb: number;
  frequency?: number;
  sweepStartHz?: number;
  sweepEndHz?: number;
  sweepDurationSeconds?: number;
}

export class SignalGenerator {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioScheduledSourceNode | null = null;
  private sourceGain: GainNode | null = null;
  private currentOptions: SignalOptions | null = null;
  private timer: number | null = null;
  onStop?: () => void;

  get playing() {
    return this.source !== null;
  }

  private buildNoiseBuffer(context: AudioContext, pink: boolean) {
    const length = context.sampleRate * 3;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (!pink) {
        data[index] = white * 0.45;
        continue;
      }
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[index] =
        (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  private clearTimer() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleStop(durationSeconds: number) {
    this.clearTimer();
    this.timer = window.setTimeout(() => {
      void this.stop();
    }, durationSeconds * 1000 + 120);
  }

  private holdParameter(parameter: AudioParam, time: number) {
    if (typeof parameter.cancelAndHoldAtTime === "function") {
      parameter.cancelAndHoldAtTime(time);
      return;
    }
    const currentValue = parameter.value;
    parameter.cancelScheduledValues(time);
    parameter.setValueAtTime(currentValue, time);
  }

  private configureOscillator(
    oscillator: OscillatorNode,
    options: SignalOptions,
    time: number,
  ) {
    if (options.type === "sine") {
      oscillator.frequency.setValueAtTime(
        Math.min(20000, Math.max(20, options.frequency ?? 1000)),
        time,
      );
      this.clearTimer();
      return;
    }

    const start = Math.max(20, options.sweepStartHz ?? 20);
    const end = Math.min(20000, options.sweepEndHz ?? 20000);
    const duration = Math.max(2, options.sweepDurationSeconds ?? 8);
    oscillator.frequency.setValueAtTime(start, time);
    oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
    this.scheduleStop(duration);
  }

  private createSource(options: SignalOptions, sourceGain: GainNode) {
    if (!this.context) throw new Error("Audio output is not ready.");
    const now = this.context.currentTime;

    if (options.type === "sine" || options.type === "sweep") {
      const oscillator = this.context.createOscillator();
      oscillator.type = "sine";
      this.configureOscillator(oscillator, options, now);
      oscillator.connect(sourceGain);
      oscillator.start(now);
      return oscillator;
    }

    this.clearTimer();
    const noise = this.context.createBufferSource();
    noise.buffer = this.buildNoiseBuffer(
      this.context,
      options.type === "pink",
    );
    noise.loop = true;
    noise.connect(sourceGain);
    noise.start(now);
    return noise;
  }

  async start(options: SignalOptions) {
    await this.stop();
    this.context = new AudioContext();
    await this.context.resume();
    const now = this.context.currentTime;
    this.gain = this.context.createGain();
    const targetGain = 10 ** (options.outputLevelDb / 20);
    this.gain.gain.setValueAtTime(0.0001, now);
    this.gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, targetGain),
      now + 0.08,
    );
    this.gain.connect(this.context.destination);
    this.sourceGain = this.context.createGain();
    this.sourceGain.gain.setValueAtTime(1, now);
    this.sourceGain.connect(this.gain);
    this.source = this.createSource(options, this.sourceGain);
    this.currentOptions = { ...options };
  }

  async update(options: SignalOptions) {
    if (
      !this.context ||
      !this.gain ||
      !this.source ||
      !this.sourceGain ||
      !this.currentOptions
    ) {
      return;
    }

    const context = this.context;
    const now = context.currentTime;
    const targetGain = Math.max(0.0001, 10 ** (options.outputLevelDb / 20));
    this.holdParameter(this.gain.gain, now);
    this.gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.045);

    if (options.type !== this.currentOptions.type) {
      const previousSource = this.source;
      const previousSourceGain = this.sourceGain;
      const nextSourceGain = context.createGain();
      nextSourceGain.gain.setValueAtTime(0.0001, now);
      nextSourceGain.connect(this.gain);
      const nextSource = this.createSource(options, nextSourceGain);

      nextSourceGain.gain.exponentialRampToValueAtTime(1, now + 0.06);
      this.holdParameter(previousSourceGain.gain, now);
      previousSourceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      this.source = nextSource;
      this.sourceGain = nextSourceGain;
      this.currentOptions = { ...options };

      await new Promise((resolve) => window.setTimeout(resolve, 75));
      try {
        previousSource.stop();
      } catch {
        // The previous source may already have completed.
      }
      previousSource.disconnect();
      previousSourceGain.disconnect();
      return;
    }

    if (options.type === "sine" && this.source instanceof OscillatorNode) {
      const nextFrequency = Math.min(
        20000,
        Math.max(20, options.frequency ?? 1000),
      );
      if (nextFrequency !== (this.currentOptions.frequency ?? 1000)) {
        this.holdParameter(this.source.frequency, now);
        this.source.frequency.setTargetAtTime(nextFrequency, now, 0.025);
      }
    }

    if (options.type === "sweep" && this.source instanceof OscillatorNode) {
      const sweepChanged =
        options.sweepStartHz !== this.currentOptions.sweepStartHz ||
        options.sweepEndHz !== this.currentOptions.sweepEndHz ||
        options.sweepDurationSeconds !==
          this.currentOptions.sweepDurationSeconds;
      if (sweepChanged) {
        const start = Math.max(20, options.sweepStartHz ?? 20);
        const end = Math.min(20000, options.sweepEndHz ?? 20000);
        const duration = Math.max(2, options.sweepDurationSeconds ?? 8);
        this.holdParameter(this.source.frequency, now);
        this.source.frequency.exponentialRampToValueAtTime(start, now + 0.08);
        this.source.frequency.exponentialRampToValueAtTime(
          end,
          now + 0.08 + duration,
        );
        this.scheduleStop(duration + 0.08);
      }
    }

    this.currentOptions = { ...options };
  }

  async stop() {
    this.clearTimer();
    if (!this.context || !this.gain || !this.source || !this.sourceGain) {
      this.source = null;
      this.sourceGain = null;
      this.currentOptions = null;
      return;
    }
    const context = this.context;
    const source = this.source;
    const now = context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(Math.max(0.0001, this.gain.gain.value), now);
    this.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    await new Promise((resolve) => window.setTimeout(resolve, 75));
    try {
      source.stop();
    } catch {
      // The source may already have stopped after a scheduled sweep.
    }
    source.disconnect();
    this.sourceGain.disconnect();
    this.gain.disconnect();
    if (context.state !== "closed") await context.close();
    this.source = null;
    this.sourceGain = null;
    this.gain = null;
    this.context = null;
    this.currentOptions = null;
    this.onStop?.();
  }
}
