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
import { CheckCircle2, Loader2, School, ClipboardList, Phone, Search, Zap, UserCheck, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const REASONS = [
  'مراجعة طبية',
  'ظرف عائلي طارئ',
  'مهمة رسمية',
  'استلام من ولي الأمر',
  'موعد محدد مسبقاً',
  'سبب آخر',
];

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

// ربط slug بـ school_id الفعلي في قاعدة البيانات
const SCHOOL_IDS: Record<string, string> = {
  'dahya-boys':  'e3eda848-75bd-4ffb-a5e4-a0dbbb28ee9d',
  'dahya-girls': 'f77d26a0-77a7-4608-b0e8-b754ef757d5f',
  'ajyal':       'fd44d3bd-2b8c-4ac7-be14-9fbdc6a561a9',
  'qanadeel':    'b7bb429d-7c37-4e86-8021-3775d86a6601',
};

const SCHOOL_META: Record<string, { name: string; subtitle: string; color: string; logo: string }> = {
  'dahya-boys':  { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنين',        color: '#0d9488', logo: '/logos/dahya-boys.png'  },
  'dahya-girls': { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنات',        color: '#2563eb', logo: '/logos/dahya-girls.png' },
  'ajyal':       { name: 'مدارس أجيال المعالي',   subtitle: 'للبنين والبنات', color: '#d97706', logo: '/logos/ajyal.png'       },
  'qanadeel':    { name: 'مدارس قناديل الشرق',    subtitle: 'للبنين والبنات', color: '#7c3aed', logo: '/logos/qanadeel.png'    },
};

interface StudentOption {
  student_number: string;
  full_name: string;
  parent_phone: string;
  school_slug?: string;
}

export default function ParentRequest() {
  const [params] = useSearchParams();
  const schoolSlug = params.get('school') ?? 'dahya-boys';
  const isPickup   = params.get('type') === 'pickup';
  const school     = SCHOOL_META[schoolSlug] ?? SCHOOL_META['dahya-boys'];

  // --- بيانات الطالب ---
  const [parentPhone, setParentPhone]         = useState('');
  const [foundStudents, setFoundStudents]     = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [studentNumber, setStudentNumber]     = useState('');
  const [studentName, setStudentName]         = useState('');
  const [searchingPhone, setSearchingPhone]   = useState(false);
  const [phoneLookupDone, setPhoneLookupDone] = useState(false);

  // رقم الطالب المباشر (اختياري — بحث بديل)
  const [lookingUp, setLookingUp]     = useState(false);
  const [lookupDone, setLookupDone]   = useState(false);
  const numberTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- بيانات المستلم ---
  const [receiverIdNumber, setReceiverIdNumber]       = useState('');
  const [receiverRelationship, setReceiverRelationship] = useState('');

  // --- بيانات الطلب ---
  const [reason, setReason]     = useState(isPickup ? 'استلام من ولي الأمر' : REASONS[0]);
  const [exitTime, setExitTime] = useState('');
  const [notes, setNotes]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.title = isPickup ? `استلام سريع — ${school.name}` : `طلب استئذان — ${school.name}`;
  }, [school.name, isPickup]);

  // ─── بحث بجوال ولي الأمر + المدرسة ───────────────────────────────────────
  async function lookupByPhone(phone: string) {
    const clean = phone.replace(/\s/g, '');
    if (clean.length < 9) {
      setFoundStudents([]);
      setPhoneLookupDone(false);
      return;
    }
    setSearchingPhone(true);
    try {
      const schoolId = SCHOOL_IDS[schoolSlug];
      // نبحث بـ school_id لأن school_slug في جدول الطلاب قد يكون فارغاً
      let query = supabase
        .from('students')
        .select('student_number, full_name, parent_phone')
        .eq('parent_phone', clean);

      if (schoolId) {
        query = query.eq('school_id', schoolId);
      }

      const { data, error } = await query;

      if (error) console.error('lookupByPhone error:', error);

      if (data && data.length > 0) {
        setFoundStudents(data as StudentOption[]);
        setPhoneLookupDone(true);
        // إذا طالب واحد فقط → اختره تلقائياً
        if (data.length === 1) applyStudent(data[0] as StudentOption);
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
    setParentPhone(val);
    setPhoneLookupDone(false);
    setFoundStudents([]);
    clearStudentSelection();
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => lookupByPhone(val), 800);
  }

  function applyStudent(s: StudentOption) {
    setSelectedStudent(s);
    setStudentName(s.full_name);
    setStudentNumber(s.student_number);
    setLookupDone(true);
  }

  function clearStudentSelection() {
    setSelectedStudent(null);
    setStudentName('');
    setStudentNumber('');
    setLookupDone(false);
  }

  // ─── بحث برقم الطالب مباشرةً (بديل) ──────────────────────────────────────
  async function lookupByNumber(num: string) {
    if (!num.trim() || num.length < 2) { setLookupDone(false); return; }
    setLookingUp(true);
    try {
      const schoolId = SCHOOL_IDS[schoolSlug];
      let query = supabase
        .from('students')
        .select('student_number, full_name, parent_phone')
        .eq('student_number', num.trim());
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data } = await query.maybeSingle();
      if (data) {
        applyStudent(data as StudentOption);
        if (data.parent_phone && !parentPhone) setParentPhone(data.parent_phone);
      } else {
        setLookupDone(false);
      }
    } catch {
      setLookupDone(false);
    } finally {
      setLookingUp(false);
    }
  }

  function handleNumberChange(val: string) {
    setStudentNumber(val);
    setLookupDone(false);
    setSelectedStudent(null);
    if (numberTimer.current) clearTimeout(numberTimer.current);
    numberTimer.current = setTimeout(() => lookupByNumber(val), 700);
  }

  // ─── إرسال الطلب ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentName.trim()) {
      toast.error('يرجى تحديد اسم الطالب — أدخل رقم الجوال أو رقم الطالب للبحث');
      return;
    }
    if (!parentPhone.trim() || !exitTime) {
      toast.error('يرجى تعبئة: رقم الجوال ووقت الخروج');
      return;
    }
    if (!receiverIdNumber.trim()) {
      toast.error('يرجى إدخال رقم هوية المستلم');
      return;
    }
    if (!receiverRelationship) {
      toast.error('يرجى تحديد صلة قرابة المستلم بالطالب');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('parent_requests').insert({
        school_slug:           schoolSlug,
        student_name:          studentName.trim(),
        student_number:        studentNumber.trim() || '—',
        parent_phone:          parentPhone.trim(),
        reason,
        requested_exit_time:   exitTime,
        notes:                 notes.trim() || null,
        status:                'pending',
        request_type:          isPickup ? 'pickup' : 'permission',
        receiver_id_number:    receiverIdNumber.trim(),
        receiver_relationship: receiverRelationship,
      });
      if (error) { toast.error('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى'); return; }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setParentPhone(''); setFoundStudents([]); setPhoneLookupDone(false);
    setStudentNumber(''); setStudentName(''); setSelectedStudent(null);
    setLookupDone(false);
    setReceiverIdNumber(''); setReceiverRelationship('');
    setReason(isPickup ? 'استلام من ولي الأمر' : REASONS[0]);
    setExitTime(''); setNotes('');
    setSubmitted(false);
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
              <div className="flex justify-between"><span className="text-gray-500">الطالب/ة</span><span className="font-bold">{studentName}</span></div>
              {studentNumber && studentNumber !== '—' && (
                <div className="flex justify-between"><span className="text-gray-500">الرقم</span><span className="font-mono">{studentNumber}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">المستلم</span><span>{receiverRelationship} — {receiverIdNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">السبب</span><span>{reason}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">وقت الخروج</span><span>{exitTime}</span></div>
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
                    inputMode="tel"
                    required
                    className={`pl-10 ${phoneLookupDone ? 'border-emerald-400 bg-emerald-50/60' : ''}`}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {searchingPhone
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Phone className="h-4 w-4" />}
                  </div>
                </div>
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
              {foundStudents.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">اختر الطالب <span className="text-red-500">*</span></Label>
                  <div className="space-y-2">
                    {foundStudents.map((s) => (
                      <button
                        key={s.student_number}
                        type="button"
                        onClick={() => applyStudent(s)}
                        className={`w-full text-right px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          selectedStudent?.student_number === s.student_number
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="font-bold">{s.full_name}</span>
                        <span className="text-gray-400 text-xs mr-2">#{s.student_number}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* رقم الطالب — بحث بديل إذا لم يُعثر عبر الجوال */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">
                  رقم الطالب / الطالبة
                  <span className="mr-2 text-xs font-normal text-gray-400">
                    (اختياري — بحث بديل)
                  </span>
                </Label>
                <div className="relative">
                  <Input
                    value={studentNumber}
                    onChange={(e) => handleNumberChange(e.target.value)}
                    placeholder="مثال: 1234"
                    dir="ltr"
                    className="pl-10"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {lookingUp
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Search className="h-4 w-4" />}
                  </div>
                </div>
              </div>

              {/* اسم الطالب — يُملأ تلقائياً أو يدوياً */}
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
            </div>

            {/* ══════════════════════════════════════ */}
            {/* القسم 2: بيانات المستلم */}
            {/* ══════════════════════════════════════ */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">② بيانات المستلم</p>

              {/* رقم هوية المستلم */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">
                  <CreditCard className="inline h-3.5 w-3.5 ml-1" />
                  رقم هوية المستلم <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={receiverIdNumber}
                  onChange={(e) => setReceiverIdNumber(e.target.value)}
                  placeholder="10 أرقام"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={10}
                  required
                />
              </div>

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
            </div>

            {/* ══════════════════════════════════════ */}
            {/* القسم 3: تفاصيل الطلب */}
            {/* ══════════════════════════════════════ */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">③ تفاصيل الطلب</p>

              {/* سبب الاستئذان */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">
                  سبب {isPickup ? 'الاستلام' : 'الاستئذان'} <span className="text-red-500">*</span>
                </Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* وقت الخروج */}
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

              {/* ملاحظات */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold">ملاحظات إضافية (اختياري)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي معلومات إضافية..."
                  rows={2}
                />
              </div>
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
    </div>
  );
}
