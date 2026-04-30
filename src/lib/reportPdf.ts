// Generate a printable HTML report and trigger print/save-as-PDF.
// Uses native browser print to avoid Arabic font issues with jsPDF.

import { STAGE_LABELS, STATUS_LABELS, formatDate, type AttendanceStatus, type Stage } from '@/lib/i18n';

export interface ReportRow {
  date: string;
  student_name: string;
  student_number: string;
  stage: Stage;
  class_name: string | null;
  status: AttendanceStatus | 'permission';
  reason?: string | null;
}

export interface ReportSchool {
  school_name: string;
  subtitle?: string | null;
  address?: string | null;
  phone?: string | null;
}

export interface ReportMeta {
  title: string;
  range?: string;
  studentName?: string;
  filtersText?: string;
}

const ENTRY: Record<string, string> = { ...STATUS_LABELS, permission: 'استذان' };

export function openReportPdf(rows: ReportRow[], school: ReportSchool, meta: ReportMeta) {
  const stats = { present: 0, late: 0, absent: 0, permission: 0 };
  rows.forEach((r) => { (stats as any)[r.status]++; });
  const total = stats.present + stats.late + stats.absent;
  const rate = total ? Math.round((stats.present / total) * 100) : 0;

  const tableRows = rows.map((r) => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td>${r.student_name}</td>
      <td class="mono">${r.student_number}</td>
      <td>${STAGE_LABELS[r.stage] ?? '—'}</td>
      <td>${r.class_name ?? '—'}</td>
      <td><span class="badge b-${r.status}">${ENTRY[r.status]}</span></td>
      <td>${r.reason ?? '—'}</td>
    </tr>`).join('');

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <title>${meta.title}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    *{box-sizing:border-box}
    body{font-family:Cairo,Tahoma,Arial,sans-serif;margin:0;color:#0f172a;background:#fff}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #80c6bb;padding-bottom:10px;margin-bottom:14px}
    .school h1{margin:0;font-size:20px;color:#0f766e}
    .school p{margin:2px 0;font-size:11px;color:#475569}
    .doc h2{margin:0;font-size:16px;color:#0f172a;text-align:left}
    .doc p{margin:2px 0;font-size:11px;color:#64748b;text-align:left}
    .summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0 14px}
    .stat{border:1px solid #e2e8f0;border-radius:10px;padding:8px;text-align:center;background:#f8fafc}
    .stat .v{font-size:18px;font-weight:800;color:#0f766e}
    .stat .l{font-size:11px;color:#64748b;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    thead th{background:#80c6bb;color:#fff;padding:6px;text-align:right;border:1px solid #5fb0a4}
    tbody td{border:1px solid #e2e8f0;padding:5px 6px}
    tbody tr:nth-child(even) td{background:#f8fafc}
    .mono{font-family:ui-monospace,Menlo,Consolas,monospace;direction:ltr}
    .badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:10px;font-weight:700;border:1px solid}
    .b-present{background:#ecfdf5;color:#047857;border-color:#a7f3d0}
    .b-late{background:#fffbeb;color:#b45309;border-color:#fcd34d}
    .b-absent{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
    .b-permission{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
    .footer{margin-top:14px;font-size:10px;color:#64748b;display:flex;justify-content:space-between}
    @media print { .noprint{display:none} }
    .toolbar{position:fixed;top:8px;left:8px;display:flex;gap:8px}
    .toolbar button{background:#0f766e;color:#fff;border:0;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:inherit}
  </style></head><body>
  <div class="toolbar noprint">
    <button onclick="window.print()">طباعة / حفظ PDF</button>
    <button onclick="window.close()" style="background:#64748b">إغلاق</button>
  </div>
  <div class="header">
    <div class="school">
      <h1>${school.school_name}</h1>
      ${school.subtitle ? `<p>${school.subtitle}</p>` : ''}
      ${school.address ? `<p>${school.address}</p>` : ''}
      ${school.phone ? `<p dir="ltr">${school.phone}</p>` : ''}
    </div>
    <div class="doc">
      <h2>${meta.title}</h2>
      ${meta.studentName ? `<p>الطالب: <b>${meta.studentName}</b></p>` : ''}
      ${meta.range ? `<p>الفترة: ${meta.range}</p>` : ''}
      ${meta.filtersText ? `<p>${meta.filtersText}</p>` : ''}
      <p>تاريخ الإصدار: ${formatDate(new Date())}</p>
    </div>
  </div>
  <div class="summary">
    <div class="stat"><div class="v">${rows.length}</div><div class="l">إجمالي السجلات</div></div>
    <div class="stat"><div class="v" style="color:#047857">${stats.present}</div><div class="l">حاضر</div></div>
    <div class="stat"><div class="v" style="color:#b45309">${stats.late}</div><div class="l">متأخر</div></div>
    <div class="stat"><div class="v" style="color:#b91c1c">${stats.absent}</div><div class="l">غائب</div></div>
    <div class="stat"><div class="v" style="color:#1d4ed8">${stats.permission}</div><div class="l">استذان</div></div>
  </div>
  ${total ? `<p style="font-size:12px;color:#0f766e;font-weight:700">نسبة الحضور: ${rate}%</p>` : ''}
  <table>
    <thead><tr>
      <th>التاريخ</th><th>الطالب</th><th>الرقم</th><th>المرحلة</th><th>الفصل</th><th>الحالة</th><th>تفاصيل</th>
    </tr></thead>
    <tbody>${tableRows || `<tr><td colspan="7" style="text-align:center;padding:24px;color:#64748b">لا توجد بيانات</td></tr>`}</tbody>
  </table>
  <div class="footer">
    <span>${school.school_name}</span>
    <span>صفحة <span class="pageNum"></span></span>
  </div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
