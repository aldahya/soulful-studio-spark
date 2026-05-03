// صوت ومؤشرات بصرية بعد المسح
let audioCtx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

export function beepSuccess() {
  try {
    const c = ctx();
    const t = c.currentTime;
    [880, 1320].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.18);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.2);
    });
  } catch {}
}

export function beepError() {
  try {
    const c = ctx();
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = 220;
    o.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.start(t); o.stop(t + 0.42);
  } catch {}
}

// نغمة مختلفة للمسح المتكرر — تنبيه ودود
export function beepDuplicate() {
  try {
    const c = ctx();
    const t = c.currentTime;
    [660, 660].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, t + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.1 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.12);
      o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.14);
    });
  } catch {}
}

// حد التأخر — قابل للتخصيص (افتراضي 7:30)
export function autoStatusByTime(
  now: Date = new Date(),
  lateAfter: string = '07:30:00',
): 'present' | 'late' {
  const [h = 7, m = 30] = lateAfter.split(':').map(Number);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes > h * 60 + m ? 'late' : 'present';
}

export function nowTimeLabel(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
