import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff } from 'lucide-react';

interface Props {
  onDetected: (text: string) => void;
}

export default function CameraScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  async function start() {
    setError(null);
    try {
      const reader = new BrowserMultiFormatReader();
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
      if (!back) throw new Error('لا توجد كاميرا متاحة');
      const controls = await reader.decodeFromVideoDevice(back.deviceId, videoRef.current!, (result) => {
        if (!result) return;
        const text = result.getText();
        const now = Date.now();
        if (text === lastRef.current.text && now - lastRef.current.at < 1500) return;
        lastRef.current = { text, at: now };
        onDetected(text);
      });
      controlsRef.current = controls;
      setActive(true);
    } catch (e) {
      setError((e as Error).message || 'تعذّر تشغيل الكاميرا');
      setActive(false);
    }
  }
  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  }
  useEffect(() => () => stop(), []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-black/90 aspect-video">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!active && (
          <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">
            اضغط "تشغيل الكاميرا" للمسح
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-1 bg-primary/70 shadow-[0_0_18px_hsl(var(--primary))] animate-pulse" />
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-center">
        {!active ? (
          <Button onClick={start} className="bg-gradient-primary gap-2"><Camera className="h-4 w-4" /> تشغيل الكاميرا</Button>
        ) : (
          <Button onClick={stop} variant="outline" className="gap-2"><CameraOff className="h-4 w-4" /> إيقاف</Button>
        )}
      </div>
    </div>
  );
}
