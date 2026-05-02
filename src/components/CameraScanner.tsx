import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Loader2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  onDetected: (text: string) => void;
}

const SCANNER_ID = 'lovable-html5qr-region';
const DEBOUNCE_MS = 2000;

// أنواع الباركود المدعومة فقط — لتسريع الفحص
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
];

export default function CameraScanner({ onDetected }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const startingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turbo, setTurbo] = useState(true);
  const [searching, setSearching] = useState(false);

  const handleResult = useCallback((decodedText: string) => {
    const text = decodedText.trim();
    if (!text) return;
    const now = Date.now();
    // Debounce: نفس الكود خلال 2 ثانية يُتجاهل
    if (lastRef.current.text === text && now - lastRef.current.at < DEBOUNCE_MS) return;
    lastRef.current = { text, at: now };
    setSearching(false);
    onDetected(text);
    // إعادة المؤشر للبحث بعد لحظة (continuous mode)
    setTimeout(() => setSearching(true), 250);
  }, [onDetected]);

  const start = useCallback(async () => {
    if (startingRef.current || scannerRef.current) return;
    startingRef.current = true;
    setError(null);
    setStarting(true);
    try {
      const html5Qr = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
        useBarCodeDetectorIfSupported: true, // أسرع عبر BarcodeDetector الأصلي إن وُجد
      });
      scannerRef.current = html5Qr;

      const config: Html5QrcodeCameraScanConfig = {
        fps: turbo ? 25 : 20,
        qrbox: { width: 250, height: 120 },
        aspectRatio: 4 / 3,
        disableFlip: false,
        videoConstraints: {
          facingMode: { ideal: 'environment' as const },
          width: { ideal: 640 },
          height: { ideal: 480 },
          // focusMode غير معرّف في TS lib لكن مدعوم على بعض الأجهزة
          ...({ focusMode: 'continuous', advanced: [{ focusMode: 'continuous' }] } as object),
        } as MediaTrackConstraints,
      };

      await html5Qr.start(
        { facingMode: { ideal: 'environment' } },
        config,
        handleResult,
        () => { /* تجاهل أخطاء الإطارات الفردية لتفادي تهنيج */ }
      );
      setActive(true);
      setSearching(true);
    } catch (e) {
      const msg = (e as Error).message || 'تعذّر تشغيل الكاميرا';
      setError(msg);
      setActive(false);
      setSearching(false);
      try { await scannerRef.current?.stop(); } catch {}
      try { scannerRef.current?.clear(); } catch {}
      scannerRef.current = null;
    } finally {
      setStarting(false);
      startingRef.current = false;
    }
  }, [handleResult, turbo]);

  const stop = useCallback(async () => {
    setSearching(false);
    setActive(false);
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (!inst) return;
    try { if (inst.isScanning) await inst.stop(); } catch {}
    try { inst.clear(); } catch {}
  }, []);

  // تنظيف تلقائي عند إخفاء الصفحة لمنع تجمد الكاميرا في الجلسات الطويلة
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && scannerRef.current?.isScanning) {
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stop]);

  // تنظيف نهائي عند الخروج من الصفحة
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-black/90 aspect-video">
        <div id={SCANNER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

        {!active && !starting && (
          <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">
            اضغط "تشغيل الكاميرا" للمسح السريع
          </div>
        )}

        {starting && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 text-white text-sm gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>جارٍ تشغيل الكاميرا...</span>
          </div>
        )}

        {active && (
          <>
            {/* إطار qrbox */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative" style={{ width: 250, height: 120 }}>
                <div className="absolute inset-0 rounded-md border-2 border-primary/80 shadow-[0_0_24px_hsl(var(--primary)/0.6)]" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-primary animate-pulse" />
                {/* زوايا */}
                <span className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-primary" />
                <span className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-primary" />
                <span className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-primary" />
                <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-primary" />
              </div>
            </div>

            {searching && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                جارٍ البحث عن الباركود...
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!active ? (
          <Button onClick={start} disabled={starting} className="bg-gradient-primary gap-2">
            <Camera className="h-4 w-4" /> تشغيل الكاميرا
          </Button>
        ) : (
          <Button onClick={stop} variant="outline" className="gap-2">
            <CameraOff className="h-4 w-4" /> إيقاف
          </Button>
        )}

        <label className="flex items-center gap-2 text-xs cursor-pointer rounded-lg border bg-muted/30 px-3 py-2">
          <input
            type="checkbox"
            checked={turbo}
            onChange={async (e) => {
              setTurbo(e.target.checked);
              if (active) { await stop(); setTimeout(() => start(), 150); }
            }}
          />
          <Zap className="h-3.5 w-3.5 text-warning" />
          <span className="font-semibold">Turbo Scan</span>
        </label>

        {active && (
          <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success text-[11px]">
            CODE_128 · CODE_39 · QR · EAN_13
          </Badge>
        )}
      </div>
    </div>
  );
}
