import * as XLSX from 'xlsx';

export interface ParentRequestExportRow {
  student_name: string;
  student_number: string | null;
  parent_phone: string | null;
  reason: string;
  requested_exit_time: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  approver_name: string | null;
  created_at: string;
  request_type: 'permission' | 'pickup' | null;
  pickup_location: string | null;
  receiver_id_number: string | null;
  receiver_relationship: string | null;
  notes: string | null;
}

const statusLabels: Record<ParentRequestExportRow['status'], string> = {
  pending: 'قيد المراجعة',
  approved: 'مؤكد',
  rejected: 'مرفوض',
};

const requestTypeLabels: Record<'permission' | 'pickup', string> = {
  permission: 'استئذان',
  pickup: 'استلام سريع',
};

function formatSaudiDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '—').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] as string);
}

function rowCells(request: ParentRequestExportRow): string[] {
  return [
    formatSaudiDateTime(request.created_at),
    requestTypeLabels[request.request_type ?? 'permission'],
    statusLabels[request.status],
    request.student_name,
    request.student_number || '—',
    request.parent_phone || '—',
    request.reason || '—',
    request.requested_exit_time || '—',
    request.receiver_id_number || '—',
    request.receiver_relationship || '—',
    request.pickup_location || '—',
    request.notes || '—',
    request.approver_name || '—',
    formatSaudiDateTime(request.approved_at),
  ];
}

export function exportParentRequestsExcel(
  requests: ParentRequestExportRow[],
  schoolName: string,
  filterSummary: string,
  fileName: string,
): void {
  const rows = requests.map((request) => ({
    'المدرسة': schoolName,
    'تاريخ الطلب': formatSaudiDateTime(request.created_at),
    'نوع الطلب': requestTypeLabels[request.request_type ?? 'permission'],
    'الحالة': statusLabels[request.status],
    'اسم الطالب': request.student_name,
    'رقم الطالب': request.student_number || '—',
    'جوال ولي الأمر': request.parent_phone || '—',
    'السبب': request.reason || '—',
    'وقت الخروج': request.requested_exit_time || '—',
    'هوية المستلم': request.receiver_id_number || '—',
    'صلة القرابة': request.receiver_relationship || '—',
    'مكان الخروج': request.pickup_location || '—',
    'ملاحظات': request.notes || '—',
    'اعتمد بواسطة': request.approver_name || '—',
    'وقت الاعتماد': formatSaudiDateTime(request.approved_at),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 24 },
    { wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 22 }, { wch: 32 }, { wch: 20 }, { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ['المدرسة', schoolName],
    ['الفلاتر المطبقة', filterSummary],
    ['عدد النتائج', requests.length],
    ['تاريخ التصدير', formatSaudiDateTime(new Date().toISOString())],
  ]);
  summary['!cols'] = [{ wch: 24 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, summary, 'ملخص التصفية');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'طلبات أولياء الأمور');
  workbook.Props = {
    Title: `طلبات أولياء الأمور - ${schoolName}`,
    Subject: filterSummary,
    Author: schoolName,
  };
  XLSX.writeFile(workbook, fileName);
}

export function openParentRequestsPdf(
  requests: ParentRequestExportRow[],
  schoolName: string,
  filterSummary: string,
): boolean {
  const printableWindow = window.open('', '_blank');
  if (!printableWindow) return false;
  printableWindow.opener = null;

  const headings = [
    'تاريخ الطلب', 'النوع', 'الحالة', 'اسم الطالب', 'رقم الطالب',
    'جوال ولي الأمر', 'السبب', 'وقت الخروج', 'هوية المستلم',
    'صلة القرابة', 'مكان الخروج', 'ملاحظات', 'اعتمد بواسطة', 'وقت الاعتماد',
  ];
  const bodyRows = requests.map((request) => (
    `<tr>${rowCells(request).map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`
  )).join('');
  const generatedAt = formatSaudiDateTime(new Date().toISOString());
  const html = `<!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>طلبات أولياء الأمور - ${escapeHtml(schoolName)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #102d2f; font-family: Tahoma, Arial, sans-serif; }
          header { border-bottom: 3px solid #58b4a8; padding: 0 0 12px; margin-bottom: 14px; }
          h1 { margin: 0 0 4px; color: #0f766e; font-size: 20px; }
          h2 { margin: 8px 0 4px; font-size: 16px; }
          p { margin: 4px 0; color: #475569; font-size: 11px; }
          .summary { display: flex; justify-content: space-between; gap: 12px; }
          .count { color: #0f766e; font-weight: 700; white-space: nowrap; }
          table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; }
          th { padding: 5px 4px; background: #0f766e; color: white; text-align: right; }
          td { padding: 4px; border: 1px solid #dbe5e6; vertical-align: top; overflow-wrap: anywhere; }
          tbody tr:nth-child(even) { background: #f3f8f7; }
          .footer { margin-top: 10px; text-align: left; color: #64748b; font-size: 9px; }
          .toolbar { position: fixed; top: 8px; left: 8px; }
          .toolbar button { border: 0; border-radius: 7px; padding: 8px 12px; background: #0f766e; color: #fff; font: inherit; cursor: pointer; }
          @media print { .toolbar { display: none; } }
        </style>
      </head>
      <body>
        <div class="toolbar"><button onclick="window.print()">طباعة / حفظ PDF</button></div>
        <header>
          <h1>${escapeHtml(schoolName)}</h1>
          <h2>طلبات أولياء الأمور</h2>
          <div class="summary">
            <p>${escapeHtml(filterSummary)}</p>
            <p class="count">عدد الطلبات: ${requests.length}</p>
          </div>
        </header>
        <table>
          <thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
        <div class="footer">تاريخ الإصدار: ${escapeHtml(generatedAt)}</div>
        <script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));</script>
      </body>
    </html>`;

  printableWindow.document.open();
  printableWindow.document.write(html);
  printableWindow.document.close();
  return true;
}

export function isWithinSaudiRequestDateRange(
  createdAt: string,
  fromDate: string,
  toDate: string,
): boolean {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return false;

  const dayStart = (value: string) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return Date.UTC(year, month - 1, day) - 3 * 60 * 60 * 1000;
  };

  const start = dayStart(fromDate);
  const endStart = dayStart(toDate);
  if (start !== null && timestamp < start) return false;
  if (endStart !== null && timestamp >= endStart + 24 * 60 * 60 * 1000) return false;
  return true;
}
