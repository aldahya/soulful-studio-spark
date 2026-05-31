// صفحة عرض QR Code الخاص بكل مدرسة — باركود الاستئذان + باركود الاستلام السريع
import { useEffect, useRef } from 'react';
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

interface QRCardProps {
  title: string;
  description: string;
  url: string;
  color: string;
  schoolName: string;
  schoolSubtitle: string;
  filename: string;
}

function QRCard({ title, description, url, color, schoolName, schoolSubtitle, filename }: QRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && url) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: { dark: color, light: '#ffffff' },
      });
    }
  }, [url, color]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${filename}.png`;
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
      <meta charset="utf-8"><title>${title} — ${schoolName}</title>
      <style>
        body{font-family:'Cairo',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a}
        .card{border:3px solid ${color}30;border-radius:24px;padding:40px;text-align:center;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08)}
        img{width:240px;height:240px;border-radius:12px;margin:16px 0;display:block}
        h1{color:${color};font-size:22px;margin:0 0 4px}
        h2{font-weight:400;font-size:14px;color:#64748b;margin:0 0 8px}
        .badge{display:inline-block;background:${color}15;color:${color};border:1px solid ${color}40;border-radius:9999px;padding:4px 14px;font-size:13px;font-weight:700;margin-bottom:8px}
        p{font-size:12px;color:#94a3b8;margin:8px 0 0}
      </style></head><body>
      <div class="card">
        <h1>${schoolName}</h1>
        <h2>${schoolSubtitle}</h2>
        <div class="badge">${title}</div><br/>
        <img id="qrimg" src="${img}" alt="QR Code" />
        <p>${description}</p>
      </div>
      <script>
        var img = document.getElementById('qrimg');
        if (img.complete) { window.print(); }
        else { img.onload = function() { window.print(); }; }
      <\/script></body></html>`);
    w.document.close();
  }

  return (
    <Card className="p-6 shadow-soft flex flex-col items-center gap-4">
      <div className="text-center">
        <span
          className="inline-block rounded-full px-4 py-1 text-sm font-bold mb-1"
          style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}
        >
          {title}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-inner" style={{ border: `2px solid ${color}20` }}>
        <canvas ref={canvasRef} width={240} height={240} className="rounded-xl" />
      </div>

      <p className="text-xs text-center text-muted-foreground max-w-xs break-all bg-muted/50 rounded px-3 py-2 font-mono">
        {url || '…'}
      </p>

      <div className="flex gap-2 w-full">
        <Button onClick={download} className="flex-1 text-sm text-white" style={{ background: color }}>
          <Download className="h-4 w-4 ml-1" />
          تحميل PNG
        </Button>
        <Button onClick={print} variant="outline" className="flex-1 text-sm">
          <Printer className="h-4 w-4 ml-1" />
          طباعة
        </Button>
      </div>
    </Card>
  );
}

export default function SchoolQRCode() {
  const { school } = useAuth();
  const schoolSlug = school?.slug ?? localStorage.getItem('school_slug') ?? 'dahya-boys';
  const meta = SCHOOL_META[schoolSlug] ?? SCHOOL_META['dahya-boys'];

  // base يُحدَّد فوراً — لا حاجة لـ useEffect لضمان ظهور كلا الباركودين عند التحميل
  const base = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    document.title = 'QR Code المدرسة | نظام الضاحية';
  }, []);

  const permissionUrl = `${base}/parent-request?school=${schoolSlug}`;
  const pickupUrl     = `${base}/parent-request?school=${schoolSlug}&type=pickup`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      <header>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <QrCode className="h-7 w-7 text-primary" />
          QR Code المدرسة
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اطبع هذين الرمزين وضعهما عند البوابة — يمسحهما ولي الأمر بهاتفه مباشرة
        </p>
      </header>

      {/* الباركودان جنباً إلى جنب دائماً */}
      <div className="grid grid-cols-2 gap-6">
        <QRCard
          title="باركود الاستئذان"
          description="يمسحه ولي الأمر لتقديم طلب خروج مبكر للطالب"
          url={permissionUrl}
          color={meta.color}
          schoolName={meta.name}
          schoolSubtitle={meta.subtitle}
          filename={`qr-permission-${schoolSlug}`}
        />
        <QRCard
          title="باركود الاستلام السريع"
          description="يمسحه ولي الأمر عند البوابة لاستلام الطالب بشكل فوري"
          url={pickupUrl}
          color={meta.color}
          schoolName={meta.name}
          schoolSubtitle={meta.subtitle}
          filename={`qr-pickup-${schoolSlug}`}
        />
      </div>
    </div>
  );
}
