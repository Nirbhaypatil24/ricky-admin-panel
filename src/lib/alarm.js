// SOS alarm tone. Browsers only allow sound after the operator has clicked or typed once,
// so the audio context is created on the first interaction.
let ctx = null;

function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
}

if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
}

export const soundAvailable = () => !!ctx && ctx.state === 'running';

/** Two-tone siren burst, about 1.2 s */
export function playAlarm() {
  if (!ctx || ctx.state !== 'running') return false;
  const t0 = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.03);
  gain.gain.setValueAtTime(0.25, t0 + 1.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.25);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  for (let i = 0; i < 4; i++) {
    osc.frequency.setValueAtTime(i % 2 ? 660 : 960, t0 + i * 0.3);
  }
  osc.connect(gain);
  osc.start(t0);
  osc.stop(t0 + 1.3);
  return true;
}
