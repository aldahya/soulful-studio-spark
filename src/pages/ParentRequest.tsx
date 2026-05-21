// صفحة نموذج الاستئذان لولي الأمر — تُفتح من QR Code خاص بالمدرسة
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, School, ClipboardList, Phone } from 'lucide-react';
import { toast } from 'sonner';

const REASONS = [
  'مراجعة طبية',
  'ظرف عائلي طارئ',
  'مهمة رسمية',
  'استلام من ولي الأمر',
  'موعد محدد مسبقاً',
  'سبب آخر',
];

const SCHOOL_META: Record<string, { name: string; subtitle: string; color: string; logo: string }> = {
  'dahya-boys':  { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنين',        color: '#0d9488', logo: '/logos/dahya-boys.png'  },
  'dahya-girls': { name: 'مدارس الضاحية الأهلية', subtitle: 'للبنات',        color: '#2563eb', logo: '/logos/dahya-girls.png' },
  'ajyal':       { name: 'مدارس أجيال المعالي',   subtitle: 'للبنين والبنات', color: '#d97706', logo: '/logos/ajyal.png'       },
  'qanadeel':    { name: 'مدارس قناديل الشرق',    subtitle: 'للبنين والبنات', color: '#7c3aed', logo: '/logos/qanadeel.png'    },
};

export default function ParentRequest() {
  const [params] = useSearchParams();
  const schoolSlug = params.get('school') ?? 'dahya-boys';
  const school = SCHOOL_META[schoolSlug] ?? SCHOOL_META['dahya-boys'];

  const [studentName, setStudentName]     = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [parentPhone, setParentPhone]     = useState('');
  const [reason, setReason]               = useState(REASONS[0]);
  const [exitTime, setExitTime]           = useState('');
  const [notes, setNotes]                 = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);

  useEffect(() => {
    document.title = `طلب استئذان — ${school.name}`;
  }, [school.name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentName.trim() || !studentNumber.trim() || !exitTime || !parentPhone.trim()) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('parent_requests').insert({
        school_slug:           schoolSlug,
        student_name:          studentName.trim(),
        student_number:        studentNumber.trim(),
        parent_phone:          parentPhone.trim(),
        reason,
        requested_exit_time:   exitTime,
        notes:                 notes.trim() || null,
        status:                'pending',
      });
      if (error) {
        toast.error('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى');
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setStudentName(''); setStudentNumber(''); setParentPhone('');
    setReason(REASONS[0]); setExitTime(''); setNotes('');
    setSubmitted(false);
  }

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
          <img src={school.logo} alt={school.name} className="w-16 h-16 object-contain" />
        </div>
        <h1 className="text-xl font-extrabold text-center" style={{ color: school.color }}>{school.name}</h1>
        <p className="text-sm text-gray-500">{school.subtitle}</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-0 overflow-hidden">
        {/* رأس البطاقة */}
        <div className="px-6 py-4" style={{ background: school.color }}>
          <div className="flex items-center gap-2 text-white">
            <ClipboardList className="h-5 w-5" />
            <h2 className="text-lg font-bold">نموذج طلب استئذان</h2>
          </div>
          <p className="text-white/80 text-xs mt-1">يُرجى تعبئة البيانات بدقة لمعالجة طلبكم وإرسال إشعار واتساب</p>
        </div>

        {submitted ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `${school.color}15` }}>
              <CheckCircle2 className="h-10 w-10" style={{ color: school.color }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">تم إرسال الطلب بنجاح ✓</h3>
              <p className="text-sm text-gray-500 mt-2">
                سيتم مراجعة طلبكم من قِبل الإدارة وستصلكم رسالة واتساب فور الموافقة.
              </p>
            </div>
            <div className="w-full bg-gray-50 rounded-xl p-4 text-sm text-right space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">الطالب/ة</span><span className="font-bold">{studentName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">الرقم</span><span className="font-mono">{studentNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">السبب</span><span>{reason}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">وقت الخروج</span><span>{exitTime}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">الجوال</span><span className="font-mono">{parentPhone}</span></div>
            </div>
            <Button onClick={resetForm} variant="outline" className="w-full" style={{ borderColor: school.color, color: school.color }}>
              إرسال طلب جديد
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">اسم الطالب / الطالبة <span className="text-red-500">*</span></Label>
              <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="الاسم الكامل كما في السجلات" required />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">رقم الطالب / الطالبة <span className="text-red-500">*</span></Label>
              <Input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="مثال: 1234" dir="ltr" required />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">
                <Phone className="inline h-3.5 w-3.5 ml-1" />
                رقم جوال ولي الأمر (واتساب) <span className="text-red-500">*</span>
              </Label>
              <Input
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
                type="tel"
                inputMode="tel"
                required
              />
              <p className="text-xs text-gray-400">سيصلك إشعار واتساب عند الموافقة على الطلب</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">سبب الاستئذان <span className="text-red-500">*</span></Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">وقت الخروج المطلوب <span className="text-red-500">*</span></Label>
              <Input type="time" value={exitTime} onChange={(e) => setExitTime(e.target.value)} dir="ltr" required />
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">ملاحظات إضافية (اختياري)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="أي معلومات إضافية..." rows={2} />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full text-white font-bold py-3 text-base rounded-xl shadow"
              style={{ background: school.color }}
            >
              {submitting
                ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جارٍ الإرسال...</>
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
