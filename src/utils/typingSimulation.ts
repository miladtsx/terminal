export function createTypeSfx() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  // a tiny click using noise + fast envelope
  function tick() {
    if (ctx.state === "suspended") ctx.resume();

    const duration = 0.012;

    // noise buffer
    const buffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * duration),
      ctx.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * 0.6;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);

    src.start();
    src.stop(ctx.currentTime + duration);
  }

  return { tick, ctx };
}

/**
 * General delay function to mimic human typing style
 * @param prev
 * @param ch
 * @returns
 */
export function humanDelay(prev: string, ch: string) {
  const base = 85; // average human pace

  // small gaussian-like jitter
  const jitter = (Math.random() + Math.random() - 1) * 18;

  // pauses humans make
  let pause = 0;
  if (ch === " ") pause += 120;
  if (ch === "." || ch === "," || ch === ":") pause += 160;
  if (ch === "/" || ch === "-" || ch === "_") pause += 80;

  // hesitation before commands / flags
  if (prev.endsWith(" ") && ch === "-") pause += 140;

  return Math.max(30, base + jitter + pause);
}
