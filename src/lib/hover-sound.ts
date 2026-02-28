/**
 * Synthesized UI hover tick — short, satisfying click sound
 * inspired by video game menu navigation.
 *
 * Uses the Web Audio API so no audio file is needed.
 */

let ctx: AudioContext | null = null;
let lastPlayTime = 0;

const COOLDOWN_MS = 40; // prevent rapid-fire overlapping ticks

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

  // --- Layer 1: pitched tick (triangle wave, ~1.6-1.9 kHz) ---
  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1600 + Math.random() * 300, t);
  oscGain.gain.setValueAtTime(0, t);
  oscGain.gain.linearRampToValueAtTime(0.12, t + 0.002);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  osc.connect(oscGain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.04);

  // --- Layer 2: noise click (filtered white noise burst) ---
  const bufLen = Math.floor(ac.sampleRate * 0.015); // 15 ms
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

  const noise = ac.createBufferSource();
  noise.buffer = buf;

  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 4000;
  bp.Q.value = 1.2;

  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0, t);
  noiseGain.gain.linearRampToValueAtTime(0.06, t + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);

  noise.connect(bp).connect(noiseGain).connect(ac.destination);
  noise.start(t);
  noise.stop(t + 0.02);
}
