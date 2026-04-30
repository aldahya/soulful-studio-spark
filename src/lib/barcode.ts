import JsBarcode from 'jsbarcode';

// CODE128 يدعم ASCII فقط — ننظّف أي حروف غير لاتينية (عربية مثلاً)
export function sanitizeBarcode(code: string): string {
  const cleaned = (code || '').replace(/[^\x20-\x7E]/g, '').trim();
  return cleaned || 'ALD-UNKNOWN';
}

export function renderBarcodeSvgString(code: string, opts?: { width?: number; height?: number }): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg as unknown as SVGSVGElement, sanitizeBarcode(code), {
    format: 'CODE128',
    width: opts?.width ?? 2,
    height: opts?.height ?? 70,
    fontSize: 14,
    margin: 6,
  });
  return new XMLSerializer().serializeToString(svg);
}

export function downloadBarcodeSVG(code: string, filename = `${code}.svg`) {
  const svg = renderBarcodeSvgString(code);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PrintItem { name: string; number: string; barcode: string; class_name?: string | null }

export function printBarcodes(items: PrintItem[], schoolName = 'مدارس الضاحية') {
  const cards = items.map((it) => {
    const svg = renderBarcodeSvgString(it.barcode, { width: 1.8, height: 60 });
    return `
      <div class="card">
        <div class="school">${schoolName}</div>
        <div class="name">${it.name}</div>
        <div class="meta">رقم: ${it.number}${it.class_name ? ' • ' + it.class_name : ''}</div>
        <div class="bc">${svg}</div>
      </div>`;
  }).join('');
  const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>طباعة باركود</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body{font-family:Cairo,Tahoma,sans-serif;margin:0;padding:0;background:#fff}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:10px}
      .card{border:1.5px dashed #94a3b8;border-radius:14px;padding:12px;text-align:center;page-break-inside:avoid}
      .school{font-size:11px;color:#64748b;margin-bottom:4px}
      .name{font-size:18px;font-weight:800}
      .meta{font-size:11px;color:#475569;margin:4px 0 6px}
      .bc svg{max-width:100%;height:auto}
    </style></head><body>
    <div class="grid">${cards}</div>
    <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
