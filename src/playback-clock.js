import { FPS, FRAME_COUNT, DURATION_SECONDS, SEQUENCE_SECONDS, clamp } from './config.js';

export function frameAtTime(seconds) {
  const t = clamp(seconds, 0, DURATION_SECONDS);
  if (t >= DURATION_SECONDS) return FRAME_COUNT - 1;
  const sequence = Math.min(9, Math.floor((t + 1e-9) / SEQUENCE_SECONDS));
  const local = t - sequence * SEQUENCE_SECONDS;
  return sequence * 240 + Math.min(239, Math.max(0, Math.floor(local * FPS + 1e-8)));
}

// The only animation clock. RAF timestamps select prepared frames at 30 FPS.
// Pauses, loading, visibility changes and rendering stalls never accrue tour time.
export class PlaybackClock {
  constructor() {
    this.state = { currentTimeSeconds: 0, durationSeconds: DURATION_SECONDS,
      isPlaying: false, currentSequence: 0, targetFrameIndex: 0,
      actualDrawnFrameIndex: -1, playbackProgress: 0, userInterrupted: false,
      isBuffering: false, status: 'loading' };
    this.lastTimestamp = null;
    this.metrics = { bufferingMilliseconds: 0, stallMilliseconds: 0, activeMilliseconds: 0 };
  }
  seek(seconds) {
    const s = this.state;
    s.currentTimeSeconds = clamp(seconds, 0, DURATION_SECONDS);
    s.targetFrameIndex = frameAtTime(s.currentTimeSeconds);
    s.currentSequence = Math.min(9, Math.floor((s.currentTimeSeconds + 1e-9) / 8));
    s.playbackProgress = s.currentTimeSeconds / DURATION_SECONDS;
    this.lastTimestamp = null;
  }
  play() {
    if (this.state.currentTimeSeconds >= DURATION_SECONDS) return;
    this.state.isPlaying = true;
    this.state.userInterrupted = false;
    this.state.status = 'playing';
    this.lastTimestamp = null;
  }
  pause(interrupted = true, reason = 'paused') {
    this.state.isPlaying = false;
    this.state.isBuffering = false;
    this.state.userInterrupted ||= interrupted;
    this.state.status = reason;
    this.lastTimestamp = null;
  }
  tick(timestamp, ready = () => true) {
    const s = this.state;
    if (!s.isPlaying) { this.lastTimestamp = null; return false; }
    if (this.lastTimestamp === null) { this.lastTimestamp = timestamp; return false; }
    const delta = Math.max(0, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    const proposed = Math.min(DURATION_SECONDS, s.currentTimeSeconds + delta);
    // Never jump over prepared images after a blocked main thread. Explicitly
    // account for that excluded stall time, then resume on the next RAF.
    const nextFrame = frameAtTime(proposed);
    const end = nextFrame > s.targetFrameIndex + 1
      ? Math.min(proposed, (s.targetFrameIndex + 1) / FPS)
      : proposed;
    const target = frameAtTime(end);
    if (!ready(s.targetFrameIndex, target)) {
      s.isBuffering = true;
      s.status = 'buffering';
      this.metrics.bufferingMilliseconds += delta * 1000;
      return false;
    }
    const accepted = end - s.currentTimeSeconds;
    this.metrics.stallMilliseconds += Math.max(0, delta - accepted) * 1000;
    this.metrics.activeMilliseconds += accepted * 1000;
    const changed = target !== s.targetFrameIndex;
    s.isBuffering = false;
    s.status = 'playing';
    s.currentTimeSeconds = end;
    s.targetFrameIndex = target;
    s.currentSequence = Math.min(9, Math.floor((end + 1e-9) / 8));
    s.playbackProgress = end / DURATION_SECONDS;
    if (end >= DURATION_SECONDS) this.pause(false, 'complete');
    return changed;
  }
}
