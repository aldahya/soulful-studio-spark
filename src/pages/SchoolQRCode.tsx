// صفحة عرض QR Code الخاص بكل مدرسة — للإدارة فقط
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, QrCode, Printer } from 'lucide-react';
import QRCode from 'qrcode';

const SCHOOL_META: Record<string, { name: string; subtitle: string; color: string }> = {
  'dahya-boys':  { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنين',        color: '#0d9488' },
  'dahya-girls': { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنات',        color: '#2563eb' },
  'ajyal':       { name: 'مدارس أجيال المعالي',   subtitle: 'للبنين والبنات', color: '#d97706' },
  'qanadeel':    { name: 'مدارس قناديل الشرق',    subtitle: 'للبنين والبنات', color: '#7c3aed' },
};

export default function SchoolQRCode() {
  const { school } = useAuth();
  const schoolSlug = school?.slug ?? localStorage.getItem('school_slug') ?? 'dahya-boys';
  const meta = SCHOOL_META[schoolSlug] ?? SCHOOL_META['dahya-boys'];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    document.title = 'QR Code المدرسة | نظام الضاحية';
    const base = window.location.origin;
    const requestUrl = `${base}/parent-request?school=${schoolSlug}`;
    setUrl(requestUrl);

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, requestUrl, {
        width: 280,
        margin: 2,
        color: { dark: meta.color, light: '#ffffff' },
      });
    }
  }, [schoolSlug, meta.color]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-${schoolSlug}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function print() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = canvas.toDataURL('image/png');
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head>
      <meta charset="utf-8"><title>QR Code — ${meta.name}</title>
      <style>
        body{font-family:'Cairo',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a}
        .card{border:3px solid ${meta.color}30;border-radius:24px;padding:40px;text-align:center;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08)}
        img{width:280px;height:280px;border-radius:12px;margin:16px 0}
        h1{color:${meta.color};font-size:22px;margin:0 0 4px}
        h2{font-weight:400;font-size:14px;color:#64748b;margin:0 0 8px}
        p{font-size:12px;color:#94a3b8;margin:8px 0 0}
      </style></head><body>
      <div class="card">
        <h1>${meta.name}</h1>
        <h2>${meta.subtitle} — نظام الاستئذان الذكي</h2>
        <img src="${img}" alt="QR Code" />
        <p>امسح الرمز لتقديم طلب استئذان</p>
      </div>
      <script>window.print();</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto" dir="rtl">
      <header>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <QrCode className="h-7 w-7 text-primary" />
          QR Code المدرسة
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اطبع هذا الرمز وضعه عند البوابة — يمسحه ولي الأمر لتقديم طلب الاستئذان
        </p>
      </header>

      <Card className="p-8 shadow-soft flex flex-col items-center gap-6">
        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: meta.color }}>{meta.name}</h2>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-inner" style={{ border: `2px solid ${meta.color}20` }}>
          <canvas ref={canvasRef} className="rounded-xl" />
        </div>

        <p className="text-xs text-center text-muted-foreground max-w-xs break-all bg-muted/50 rounded px-3 py-2 font-mono">
          {url}
        </p>

        <div className="flex gap-3 w-full">
          <Button onClick={download} className="flex-1" style={{ background: meta.color }}>
            <Download className="h-4 w-4 ml-2" />
            تحميل PNG
          </Button>
          <Button onClick={print} variant="outline" className="flex-1">
            <Printer className="h-4 w-4 ml-2" />
            طباعة
          </Button>
        </div>
      </Card>
    </div>
  );
}
