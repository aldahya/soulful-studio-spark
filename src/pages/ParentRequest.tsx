// صفحة نموذج طلب الاستئذان / الاستلام السريع — تُفتح من QR Code
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, School, ClipboardList, Phone, Search, Zap, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { SCHOOL_LOGOS } from '@/lib/school';
import { withActiveStudentFilter } from '@/lib/student-archive';
import { normalizeSaudiPhoneInput, phoneLookupCandidates } from '@/lib/i18n';

const REASONS = [
  'مراجعة طبية',
  'ظرف عائلي طارئ',
  'مهمة رسمية',
  'استلام من ولي الأمر',
  'موعد محدد مسبقاً',
  'سبب آخر',
];

const PICKUP_REASONS = ['خروج في الموعد'];

const RELATIONSHIPS = [
  'والد',
  'والدة',
  'أخ',
  'أخت',
  'عم',
  'عمة',
  'خال',
  'خالة',
  'جد',
  'جدة',
  'محرم آخر',
];

function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 1776 ? 1776 : 1632));
  });
}

// ربط slug بـ school_id الفعلي في قاعدة البيانات
const SCHOOL_IDS: Record<string, string> = {
  'dahya-boys':  'e3eda848-75bd-4ffb-a5e4-a0dbbb28ee9d',
  'dahya-girls': 'f77d26a0-77a7-4608-b0e8-b754ef757d5f',
  'ajyal':       'fd44d3bd-2b8c-4ac7-be14-9fbdc6a561a9',
  'qanadeel':    'b7bb429d-7c37-4e86-8021-3775d86a6601',
};

const SCHOOL_META: Record<string, { name: string; subtitle: string; color: string; logo: string }> = {
  'dahya-boys':  { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنين',        color: '#0d9488', logo: SCHOOL_LOGOS['dahya-boys'] },
  'dahya-girls': { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنات',        color: '#2563eb', logo: SCHOOL_LOGOS['dahya-girls'] },
  'ajyal':       { name: 'مدارس أجيال المعالي',   subtitle: 'للبنين والبنات', color: '#d97706', logo: SCHOOL_LOGOS.ajyal },
  'qanadeel':    { name: 'مدارس قناديل الشرق',    subtitle: 'للبنين والبنات', color: '#7c3aed', logo: SCHOOL_LOGOS.qanadeel },
};

interface StudentOption {
  student_number: string;
  full_name: string;
  parent_phone: string;
  school_slug?: string;
}

export default function ParentRequest() {
  const [params, setParams] = useSearchParams();
  const schoolSlug = params.get('school') ?? 'dahya-boys';
  const requestType = params.get('type');
  const hasRequestType = requestType === 'permission' || requestType === 'pickup';
  const isPickup   = requestType === 'pickup';
  const school     = SCHOOL_META[schoolSlug] ?? SCHOOL_META['dahya-boys'];

  // --- بيانات الطالب ---
  const [parentPhone, setParentPhone]               = useState('');
  const [foundStudents, setFoundStudents]           = useState<StudentOption[]>([]);
  const [selectedStudentNums, setSelectedStudentNums] = useState<Set<string>>(new Set());
  const [studentName, setStudentName]               = useState('');
  const [searchingPhone, setSearchingPhone]         = useState(false);
  const [phoneLookupDone, setPhoneLookupDone]       = useState(false);
  const [submittedStudents, setSubmittedStudents]   = useState<StudentOption[]>([]);
  const [submittedExitTime, setSubmittedExitTime]   = useState('');

  // رقم الطالب المباشر (اختياري — بحث بديل)
  const [lookupDone, setLookupDone]   = useState(false);

  // --- بيانات المستلم ---
  const [receiverRelationship, setReceiverRelationship] = useState('');
  const [receiverIdNumber, setReceiverIdNumber] = useState('');

  // --- بيانات الطلب ---
  const [reason, setReason]     = useState(isPickup ? PICKUP_REASONS[0] : REASONS[0]);
  const [exitTime, setExitTime] = useState('');
  const [notes, setNotes]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = !hasRequestType
      ? `خدمات أولياء الأمور — ${school.name}`
      : isPickup
        ? `استلام سريع — ${school.name}`
        : `طلب استئذان — ${school.name}`;
  }, [school.name, isPickup, hasRequestType]);

  // ─── بحث بجوال ولي الأمر + المدرسة ───────────────────────────────────────
  async function lookupByPhone(phone: string) {
    const clean = normalizeDigits(phone).replace(/\D/g, '');
    const candidates = phoneLookupCandidates(phone);
    if (clean.length < 9) {
      setFoundStudents([]);
      setPhoneLookupDone(false);
      return;
    }
    const schoolId = SCHOOL_IDS[schoolSlug];
    if (!schoolId) {
      setFoundStudents([]);
      setPhoneLookupDone(true);
      setSearchingPhone(false);
      toast.error('رابط المدرسة غير صالح؛ اطلب رمز QR الصحيح من المدرسة');
      return;
    }
    setSearchingPhone(true);
    try {
      // نبحث بـ school_id لأن school_slug في جدول الطلاب قد يكون فارغاً
      const { data, error } = await withActiveStudentFilter((filterArchived) => {
        let query = (supabase as any)
          .from('students')
          .select('student_number, full_name, parent_phone')
          .in('parent_phone', candidates)
          .eq('school_id', schoolId);
        if (filterArchived) query = query.is('archived_at', null);
        return query.order('full_name', { ascending: true });
      });

      if (error) console.error('lookupByPhone error:', error);

      if (data && data.length > 0) {
        setFoundStudents(data as StudentOption[]);
        setPhoneLookupDone(true);
        if (data.length === 1) {
          // طالب واحد → اختره تلقائياً
          applyStudent(data[0] as StudentOption);
        } else {
          // أكثر من طالب → حدّد الكل تلقائياً، يمكن للمستخدم إلغاء بعضهم
          setSelectedStudentNums(new Set((data as StudentOption[]).map((s) => s.student_number)));
          setLookupDone(true);
        }
      } else {
        setFoundStudents([]);
        setPhoneLookupDone(false);
      }
    } catch {
      setFoundStudents([]);
      setPhoneLookupDone(false);
    } finally {
      setSearchingPhone(false);
    }
  }

  function handlePhoneChange(val: string) {
    const localPhone = normalizeSaudiPhoneInput(val);
    setParentPhone(localPhone);
    setPhoneLookupDone(false);
    setFoundStudents([]);
    clearStudentSelection();
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => lookupByPhone(localPhone), 800);
  }

  function applyStudent(s: StudentOption) {
    setSelectedStudentNums(new Set([s.student_number]));
    setStudentName(s.full_name);
    setLookupDone(true);
  }

  function toggleStudentSelection(s: StudentOption) {
    setSelectedStudentNums((prev) => {
      const next = new Set(prev);
      if (next.has(s.student_number)) next.delete(s.student_number);
      else next.add(s.student_number);
      return next;
    });
  }

  function clearStudentSelection() {
    setSelectedStudentNums(new Set());
    setStudentName('');
    setLookupDone(false);
  }

  // ─── إرسال الطلب ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const usingPhoneLookup = foundStudents.length > 0;
    const selectedList     = foundStudents.filter((s) => selectedStudentNums.has(s.student_number));

    if (isPickup && (!phoneLookupDone || !usingPhoneLookup || selectedList.length === 0)) {
      toast.error('أدخل رقم جوال ولي الأمر واختر طالبًا واحدًا على الأقل من الطلاب المرتبطين به');
      return;
    }
    if (usingPhoneLookup && selectedList.length === 0) {
      toast.error('يرجى تحديد طالب واحد على الأقل');
      return;
    }
    if (!isPickup && !usingPhoneLookup && !studentName.trim()) {
      toast.error('يرجى إدخال اسم الطالب أو البحث برقم جوال ولي الأمر');
      return;
    }
    if (!parentPhone.trim() || (!isPickup && !exitTime)) {
      toast.error(isPickup ? 'يرجى إدخال رقم جوال ولي الأمر' : 'يرجى تعبئة رقم الجوال ووقت الخروج');
      return;
    }
    if (!receiverRelationship) {
      toast.error('يرجى تحديد صلة قرابة المستلم بالطالب');
      return;
    }
    const normalizedReceiverId = normalizeDigits(receiverIdNumber).replace(/\D/g, '');
    if (!isPickup && !/^\d{10}$/.test(normalizedReceiverId)) {
      toast.error('يرجى إدخال رقم هوية المستلم المكوّن من 10 أرقام');
      return;
    }
    setSubmitting(true);
    try {
      const requestExitTime = isPickup
        ? new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Riyadh',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(new Date())
        : exitTime;
      const commonFields = {
        school_slug:           schoolSlug,
        parent_phone:          parentPhone.trim(),
        reason:                isPickup ? PICKUP_REASONS[0] : reason,
        requested_exit_time:   requestExitTime,
        notes:                 notes.trim() || null,
        status:                'pending',
        request_type:          isPickup ? 'pickup' : 'permission',
        ...(isPickup ? { pickup_location: 'بوابة المدرسة الرئيسية' } : {}),
        receiver_relationship: receiverRelationship,
        ...(!isPickup ? { receiver_id_number: normalizedReceiverId } : {}),
      };

      if (usingPhoneLookup) {
        const rows = selectedList.map((s) => ({
          ...commonFields,
          student_name:   s.full_name,
          student_number: s.student_number,
        }));
        const { error } = await (supabase as any).from('parent_requests').insert(rows);
        if (error) { toast.error('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى'); return; }
        setSubmittedStudents(selectedList);
      } else {
        const { error } = await (supabase as any).from('parent_requests').insert({
          ...commonFields,
          student_name:   studentName.trim(),
          student_number: '—',
        });
        if (error) { toast.error('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى'); return; }
        setSubmittedStudents([{ student_number: '—', full_name: studentName.trim(), parent_phone: parentPhone.trim() }]);
      }
      setSubmittedExitTime(requestExitTime);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    setParentPhone(''); setFoundStudents([]); setPhoneLookupDone(false);
    setStudentName(''); setSelectedStudentNums(new Set());
    setSubmittedStudents([]); setSubmittedExitTime('');
    setLookupDone(false);
    setReceiverRelationship('');
    setReceiverIdNumber('');
    setReason(isPickup ? PICKUP_REASONS[0] : REASONS[0]);
    setExitTime(''); setNotes('');
    setSubmitted(false);
  }

  function chooseRequestType(type: 'permission' | 'pickup') {
    resetForm();
    setReason(type === 'pickup' ? PICKUP_REASONS[0] : REASONS[0]);
    const next = new URLSearchParams(params);
    next.set('type', type);
    setParams(next, { replace: true });
  }

  function returnToServiceChoice() {
    resetForm();
    const next = new URLSearchParams(params);
    next.delete('type');
    setParams(next, { replace: true });
  }

  const accentBg = lookupDone ? 'border-emerald-400 bg-emerald-50/60' : '';

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: `linear-gradient(160deg, ${school.color}18, ${school.color}08, #f8fafc)` }}
    >
      {/* شعار المدرسة */}
      <div className="flex flex-col items-center mb-6">
        <div
          className="w-20 h-20 rounded-2xl shadow-lg flex items-center justify-center mb-3 bg-white overflow-hidden"
          style={{ border: `2px solid ${school.color}30` }}
        >
          <img
            src={school.logo}
            alt={school.name}
            className="w-16 h-16 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <h1 className="text-xl font-extrabold text-center" style={{ color: school.color }}>{school.name}</h1>
        <p className="text-sm text-gray-500">{school.subtitle}</p>
      </div>

      {!hasRequestType ? (
        <Card className="w-full max-w-md shadow-xl border-0 overflow-hidden">
          <div className="px-6 py-5 text-white" style={{ background: school.color }}>
            <h2 className="text-xl font-bold">مرحبًا بكم في خدمات أولياء الأمور</h2>
            <p className="text-white/80 text-sm mt-2">اختر الخدمة التي تريدها للطالب</p>
          </div>
          <div className="p-6 space-y-3">
            <Button
              type="button"
              onClick={() => chooseRequestType('permission')}
              className="w-full h-auto justify-between py-4 text-white"
              style={{ background: school.color }}
            >
              <span className="flex items-center gap-3 text-right">
                <ClipboardList className="h-5 w-5" />
                <span>
                  <span className="block font-bold">طلب استئذان</span>
                  <span className="block text-xs font-normal opacity-80">طلب خروج مبكر بموافقة الإدارة</span>
                </span>
              </span>
              <span aria-hidden="true">←</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseRequestType('pickup')}
              className="w-full h-auto justify-between py-4"
              style={{ color: school.color, borderColor: `${school.color}55` }}
            >
              <span className="flex items-center gap-3 text-right">
                <Zap className="h-5 w-5" />
                <span>
                  <span className="block font-bold">استلام سريع من الموقع</span>
                  <span className="block text-xs font-normal text-muted-foreground">إبلاغ المدرسة بوصول ولي الأمر للبوابة</span>
                </span>
              </span>
              <span aria-hidden="true">←</span>
            </Button>
          </div>
        </Card>
      ) : (
      <Card className="w-full max-w-md shadow-xl border-0 overflow-hidden">
        {/* رأس البطاقة */}
        <div className="px-6 py-4" style={{ background: school.color }}>
          <div className="flex items-center gap-2 text-white">
            {isPickup
              ? <><Zap className="h-5 w-5" /><h2 className="text-lg font-bold">نموذج الاستلام السريع</h2></>
              : <><ClipboardList className="h-5 w-5" /><h2 className="text-lg font-bold">نموذج طلب استئذان</h2></>}
          </div>
          <p className="text-white/80 text-xs mt-1">
            {isPickup
              ? 'أدخل رقم جوال ولي الأمر لاستلام الطالب من البوابة'
              : 'يُرجى تعبئة البيانات بدقة لمعالجة طلبكم وإرسال إشعار واتساب'}
          </p>
        </div>
        <div className="px-6 pt-3">
          <button
            type="button"
            onClick={returnToServiceChoice}
            className="text-xs font-medium underline underline-offset-2"
            style={{ color: school.color }}
          >
            العودة لاختيار الخدمة
          </button>
        </div>

        {submitted ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: `${school.color}15` }}
            >
              <CheckCircle2 className="h-10 w-10" style={{ color: school.color }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">تم إرسال الطلب بنجاح ✓</h3>
              <p className="text-sm text-gray-500 mt-2">
                {isPickup
                  ? 'سيتم إخطار المعلم فوراً لإخراج الطالب إلى البوابة.'
                  : 'سيتم مراجعة طلبكم من قِبل الإدارة وستصلكم رسالة واتساب فور الموافقة.'}
              </p>
            </div>
            <div className="w-full bg-gray-50 rounded-xl p-4 text-sm text-right space-y-2">
              {submittedStudents.length > 1 ? (
                <div className="space-y-1">
                  <span className="text-gray-500">الطلاب ({submittedStudents.length})</span>
                  {submittedStudents.map((s) => (
                    <div key={s.student_number} className="flex justify-between pr-2">
                      <span className="font-bold">{s.full_name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">الطالب/ة</span><span className="font-bold">{submittedStudents[0]?.full_name ?? studentName}</span></div>
                </>
              )}
              <div className="flex justify-between"><span className="text-gray-500">المستلم</span><span>{receiverRelationship}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">السبب</span><span>{isPickup ? PICKUP_REASONS[0] : reason}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">وقت الخروج</span><span>{submittedExitTime || exitTime}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">الجوال</span><span className="font-mono">{parentPhone}</span></div>
            </div>
            <Button
              onClick={resetForm}
              variant="outline"
              className="w-full"
              style={{ borderColor: school.color, color: school.color }}
            >
              إرسال طلب جديد
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* ══════════════════════════════════════ */}
            {/* القسم 1: تحديد الطالب */}
            {/* ══════════════════════════════════════ */}
            <div className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">① بيانات الطالب</p>

              {/* رقم جوال ولي الأمر — يُشغّل البحث */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">
                  <Phone className="inline h-3.5 w-3.5 ml-1" />
                  رقم جوال ولي الأمر (واتساب) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    value={parentPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    className={`pl-10 ${phoneLookupDone ? 'border-emerald-400 bg-emerald-50/60' : ''}`}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {searchingPhone
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Phone className="h-4 w-4" />}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">يبدأ الرقم المحلي بـ0، مثل 05XXXXXXXX. يمكن لصق رقم بصيغة +966 أيضًا.</p>
                {phoneLookupDone && foundStudents.length > 0 && (
                  <p className="text-xs font-medium text-emerald-600">
                    ✓ تم العثور على {foundStudents.length > 1 ? `${foundStudents.length} طلاب` : 'طالب'} مرتبط بهذا الرقم في المدرسة
                  </p>
                )}
                {!phoneLookupDone && parentPhone.length >= 9 && !searchingPhone && (
                  <p className="text-xs text-amber-600">لم يُعثر على طلاب مرتبطين بهذا الرقم في {school.name}</p>
                )}
                <p className="text-xs text-gray-400">سيصلك إشعار واتساب عند الموافقة على الطلب</p>
              </div>

              {/* قائمة الطلاب المرتبطين برقم الجوال */}
              {foundStudents.length > 0 && (isPickup || foundStudents.length > 1) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                      {isPickup ? 'الطلاب المرتبطون بهذا الرقم' : 'اختر الطلاب'} <span className="text-red-500">*</span>
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-emerald-600 underline"
                      onClick={() =>
                        setSelectedStudentNums(
                          selectedStudentNums.size === foundStudents.length
                            ? new Set()
                            : new Set(foundStudents.map((s) => s.student_number))
                        )
                      }
                    >
                      {selectedStudentNums.size === foundStudents.length ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {foundStudents.map((s) => {
                      const checked = selectedStudentNums.has(s.student_number);
                      return (
                        <button
                          key={s.student_number}
                          type="button"
                          onClick={() => toggleStudentSelection(s)}
                          className={`w-full text-right px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center gap-3 ${
                            checked
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <span
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                            }`}
                          >
                            {checked && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="flex-1">
                            <span className="font-bold">{s.full_name}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedStudentNums.size > 1 && (
                    <p className="text-xs text-emerald-600 font-medium">
                      ✓ سيتم إرسال {selectedStudentNums.size} طلبات ({selectedStudentNums.size} طلاب)
                    </p>
                  )}
                </div>
              )}

              {/* اسم الطالب — يُملأ تلقائياً أو يدوياً */}
              {!isPickup && (
              <div className="space-y-1">
                <Label className="text-sm font-semibold">
                  اسم الطالب / الطالبة <span className="text-red-500">*</span>
                  {lookupDone && <span className="mr-2 text-xs font-normal text-emerald-600">(تلقائي)</span>}
                </Label>
                <Input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="الاسم الكامل كما في السجلات"
                  required
                  className={accentBg}
                />
              </div>
              )}
            </div>

            {/* ══════════════════════════════════════ */}
            {/* القسم 2: بيانات المستلم */}
            {/* ══════════════════════════════════════ */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">② بيانات المستلم</p>

              {/* صلة القرابة */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">
                  <UserCheck className="inline h-3.5 w-3.5 ml-1" />
                  صلة القرابة بالطالب <span className="text-red-500">*</span>
                </Label>
                <Select value={receiverRelationship} onValueChange={setReceiverRelationship} required>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر صلة القرابة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isPickup && (
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">
                    رقم هوية المستلم <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={receiverIdNumber}
                    onChange={(e) => setReceiverIdNumber(normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 10))}
                    placeholder="أدخل 10 أرقام"
                    dir="ltr"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    required
                  />
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════ */}
            {/* القسم 3: تفاصيل الطلب */}
            {/* ══════════════════════════════════════ */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">③ تفاصيل الطلب</p>

              {isPickup ? (
                <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: `${school.color}40`, background: `${school.color}0b`, color: school.color }}>
                  سيُسجّل النظام وقت إرسال طلب الاستلام تلقائيًا.
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">
                      سبب الاستئذان <span className="text-red-500">*</span>
                    </Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">
                      وقت الخروج المطلوب <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="time"
                      value={exitTime}
                      onChange={(e) => setExitTime(e.target.value)}
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">ملاحظات إضافية (اختياري)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أي معلومات إضافية..."
                      rows={2}
                    />
                  </div>
                </>
              )}

            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full text-white font-bold py-3 text-base rounded-xl shadow"
              style={{ background: school.color }}
            >
              {submitting
                ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جارٍ الإرسال...</>
                : isPickup
                  ? <><Zap className="ml-2 h-4 w-4" />إرسال طلب الاستلام السريع</>
                  : 'إرسال طلب الاستئذان'}
            </Button>

            <p className="text-xs text-center text-gray-400">
              <School className="inline h-3 w-3 ml-1" />
              مجموعة المالكي التعليمية — نظام الاستئذان الذكي
            </p>
          </form>
        )}
      </Card>
      )}
    </div>
  );
}
