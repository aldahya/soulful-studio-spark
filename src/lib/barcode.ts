import JsBarcode from 'jsbarcode';

// CODE128 يدعم ASCII فقط — ننظّف أي حروف غير لاتينية (عربية مثلاً)
export function sanitizeBarcode(code: string): string {
  const cleaned = (code || '').replace(/[^\x20-\x7E]/g, '').trim();
  return cleaned || 'ALD-UNKNOWN';
}

export function renderBarcodeSvgString(code: string, opts?: { width?: number; height?: number; displayValue?: boolean }): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg as unknown as SVGSVGElement, sanitizeBarcode(code), {
    format: 'CODE128',
    width: opts?.width ?? 2,
    height: opts?.height ?? 70,
    fontSize: 14,
    margin: 6,
    displayValue: opts?.displayValue ?? true,
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

export interface PrintItem {
  name: string;
  number: string;
  barcode: string;
  class_name?: string | null;
  stage_label?: string | null;
  parent_phone?: string | null;
}

const STAGE_AR: Record<string, string> = { primary: 'ابتدائي', intermediate: 'متوسط', secondary: 'ثانوي' };

export function stageLabel(stage?: string | null): string {
  if (!stage) return '';
  return STAGE_AR[stage] ?? stage;
}

export function printBarcodes(items: PrintItem[], schoolName = 'مدارس الضاحية', subtitle = '') {
  const cards = items.map((it) => {
    const svg = renderBarcodeSvgString(it.barcode, { width: 1.8, height: 55 });
    const meta: string[] = [];
    if (it.stage_label) meta.push(it.stage_label);
    if (it.class_name) meta.push(it.class_name);
    return `
      <div class="card">
        <div class="head">
          <div class="school">${schoolName}</div>
          ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
        </div>
        <div class="name">${it.name}</div>
        <div class="row"><span class="lbl">رقم الطالب:</span> <span class="val mono">${it.number}</span></div>
        ${meta.length ? `<div class="row"><span class="lbl">المرحلة/الفصل:</span> <span class="val">${meta.join(' • ')}</span></div>` : ''}
        ${it.parent_phone ? `<div class="row"><span class="lbl">ولي الأمر:</span> <span class="val mono" dir="ltr">${it.parent_phone}</span></div>` : ''}
        <div class="bc">${svg}</div>
        <div class="code mono">${it.barcode}</div>
      </div>`;
  }).join('');
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>طباعة باركود</title>
    <style>
      @page { size: A4; margin: 8mm; }
      *{box-sizing:border-box}
      body{font-family:Cairo,Tahoma,Arial,sans-serif;margin:0;padding:0;background:#fff;color:#0f172a}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:6px}
      .card{border:1.5px dashed #80c6bb;border-radius:14px;padding:10px 12px;text-align:center;page-break-inside:avoid;background:linear-gradient(180deg,#f0fbf8,#fff)}
      .head{border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px}
      .school{font-size:12px;font-weight:800;color:#0f766e}
      .sub{font-size:10px;color:#64748b}
      .name{font-size:17px;font-weight:800;margin:4px 0}
      .row{font-size:11px;color:#334155;margin:2px 0;display:flex;justify-content:center;gap:6px}
      .lbl{color:#64748b}
      .val{font-weight:600}
      .mono{font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr;display:inline-block}
      .bc{margin-top:6px}
      .bc svg{max-width:100%;height:auto}
      .code{font-size:10px;color:#475569;margin-top:-4px}
    </style></head><body>
    <div class="grid">${cards}</div>
    <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
