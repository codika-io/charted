/**
 * Synthesized UI hover click — low, tactile, non-tonal.
 * More mechanical switch than musical beep.
 *
 * Uses the Web Audio API so no audio file is needed.
 */

let ctx: AudioContext | null = null;
let lastPlayTime = 0;

const COOLDOWN_MS = 50;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playHoverTick() {
  const now = performance.now();
  if (now - lastPlayTime < COOLDOWN_MS) return;
  lastPlayTime = now;

  const ac = getContext();
  if (ac.state === 'suspended') ac.resume();

  const t = ac.currentTime;

  // --- Layer 1: sub-bass thump (fast pitch drop, no sustain) ---
  const sub = ac.createOscillator();
  const subGain = ac.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(150, t);
  sub.frequency.exponentialRampToValueAtTime(40, t + 0.04);
  subGain.gain.setValueAtTime(0.07, t);
  subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  sub.connect(subGain).connect(ac.destination);
  sub.start(t);
  sub.stop(t + 0.06);

  // --- Layer 2: short noise transient (the "click" texture) ---
  const bufLen = Math.floor(ac.sampleRate * 0.006); // 6 ms — very short
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const noise = ac.createBufferSource();
  noise.buffer = buf;

  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2000;
  lp.Q.value = 0.7;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.05, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.008);

  noise.connect(lp).connect(noiseGain).connect(ac.destination);
  noise.start(t);
  noise.stop(t + 0.01);
}
