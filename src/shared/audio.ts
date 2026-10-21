/**
 * LifeSolver Focus Guard - Offline Synthesizer Audio
 *
 * Uses the Web Audio API to synthesize a pleasant harmonic focus chime
 * without loading external media files or violating CSP policies.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

/**
 * Plays an elegant completion harmonic chime (523.25 Hz C5 -> 659.25 Hz E5 -> 783.99 Hz G5).
 */
export function playCompletionChime(volume = 0.5): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5]; // C Major chord triad + octave

    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      // Volume envelope: quick attack, smooth exponential decay
      const noteStart = now + idx * 0.08;
      const noteEnd = noteStart + 1.2;

      gain.gain.setValueAtTime(0.001, noteStart);
      gain.gain.exponentialRampToValueAtTime(Math.min(1, Math.max(0, volume * 0.25)), noteStart + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteEnd);
    });
  } catch (err) {
    console.debug('Focus chime playback bypassed:', err);
  }
}

/**
 * Plays a subtle low-frequency reminder tick/tone.
 */
export function playWarningTick(volume = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.2);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume * 0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    console.debug('Warning chime playback bypassed:', err);
  }
}
