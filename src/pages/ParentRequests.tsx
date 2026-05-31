// لوحة إدارة طلبات الاستئذان والاستلام السريع — تبويبان منفصلان
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/lib/school';
import { toWhatsAppNumber } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell, CheckCircle2, XCircle, Volume2, Loader2, RefreshCw,
  Clock, User, ClipboardList, Search, VolumeX, MessageCircle, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { announceStudent, isTTSSupported } from '@/lib/tts';

interface ParentRequest {
  id: string;
  school_slug: string;
  student_name: string;
  student_number: string;
  parent_phone: string | null;
  reason: string;
  requested_exit_time: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  approver_name: string | null;
  announced: boolean;
  announced_at: string | null;
  whatsapp_sent: boolean | null;
  created_at: string;
  request_type: 'permission' | 'pickup' | null;
}

const STATUS_MAP = {
  pending:  { label: 'قيد المراجعة', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'مؤكد',         cls: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'مرفوض',        cls: 'bg-red-100   text-red-800   border-red-200'   },
} as const;

function buildWhatsAppMessage(opts: {
  schoolName: string; studentName: string; reason: string; exitTime: string; approvedAt: string;
}): string {
  const { schoolName, studentName, reason, exitTime, approvedAt } = opts;
  const time = new Date(approvedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const date = new Date(approvedAt).toLocaleDateString('ar-SA-u-ca-gregory', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  return [
    `🏫 ${schoolName}`, '━━━━━━━━━━━━━━━━━━',
    'السلام عليكم ورحمة الله وبركاته،', '',
    '✅ *تمت الموافقة على الطلب*', '',
    `👤 الطالب/ة: *${studentName}*`,
    `📝 السبب: ${reason}`,
    `🕐 وقت الخروج المطلوب: ${exitTime}`, '',
    `📅 التاريخ: ${date}`,
    `⏰ وقت الموافقة: ${time}`,
    '━━━━━━━━━━━━━━━━━━',
    'يُرجى التوجه إلى بوابة المدرسة لاستلام الطالب/ة 🚗', '',
    'شكراً لتعاونكم 🤝',
  ].join('\n');
}

function openWhatsApp(phone: string, message: string): boolean {
  const wa = toWhatsAppNumber(phone);
  if (!wa) return false;
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  return true;
}

function RequestCard({
  req, schoolName, ttsSupported,
  onApprove, onReject, onAnnounce, onWhatsApp,
  approving, announcing,
}: {
  req: ParentRequest; schoolName: string; ttsSupported: boolean;
  onApprove:  (r: ParentRequest) => void;
  onReject:   (r: ParentRequest) => void;
  onAnnounce: (r: ParentRequest) => void;
  onWhatsApp: (r: ParentRequest) => void;
  approving: string | null; announcing: string | null;
}) {
  return (
    <Card
      className={`p-4 shadow-soft border-r-4 transition-all ${
        req.status === 'pending'  ? 'border-r-amber-400 bg-amber-50/30' :
        req.status === 'approved' ? 'border-r-green-400 bg-green-50/20' :
        'border-r-red-400 bg-red-50/20'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-bold text-base">
              <User className="h-4 w-4 text-primary shrink-0" />
              {req.student_name}
            </span>
            {req.student_number && req.student_number !== '—' && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                #{req.student_number}
              </span>
            )}
            <Badge variant="outline" className={STATUS_MAP[req.status].cls}>
              {STATUS_MAP[req.status].label}
            </Badge>
            {req.announced && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                <Volume2 className="h-3 w-3 ml-1" /> نودي عليه
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" />{req.reason}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              وقت الخروج: <strong className="text-foreground">{req.requested_exit_time}</strong>
            </span>
            {req.parent_phone && (
              <span className="flex items-center gap-1 font-mono text-xs">
                <MessageCircle className="h-3.5 w-3.5 text-green-600" />{req.parent_phone}
              </span>
            )}
            <span className="text-xs">
              {new Date(req.created_at).toLocaleString('ar-SA', {
                hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
              })}
            </span>
          </div>

          {req.notes && (
            <p className="text-xs bg-muted/60 rounded px-3 py-1.5 text-muted-foreground">{req.notes}</p>
          )}
          {req.status === 'approved' && req.approver_name && (
            <p className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              وافق: {req.approver_name} —{' '}
              {req.approved_at ? new Date(req.approved_at).toLocaleTimeString('ar-SA') : ''}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 items-stretch min-w-[140px]">
          {req.status === 'pending' && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
                onClick={() => onApprove(req)}
                disabled={approving === req.id || announcing === req.id}
              >
                {approving === req.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <CheckCircle2 className="h-3 w-3" />}
                موافقة + واتساب + نداء
              </Button>
              <Button
                size="sm" variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs gap-1"
                onClick={() => onReject(req)}
                disabled={approving === req.id}
              >
                <XCircle className="h-3 w-3" />رفض
              </Button>
            </>
          )}
          {req.status === 'approved' && (
            <>
              {req.parent_phone && (
                <Button
                  size="sm" variant="outline"
                  className="text-green-600 border-green-200 hover:bg-green-50 text-xs gap-1"
                  onClick={() => onWhatsApp(req)}
                >
                  <MessageCircle className="h-3 w-3" />إعادة إرسال واتساب
                </Button>
              )}
              <Button
                size="sm" variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs gap-1"
                onClick={() => onAnnounce(req)}
                disabled={announcing === req.id}
              >
                {announcing === req.id
                  ? <><Loader2 className="h-3 w-3 animate-spin" />جارٍ النداء...</>
                  : <><Volume2 className="h-3 w-3" />نداء مجدد</>}
              </Button>
            </>
          )}
          {!ttsSupported && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <VolumeX className="h-3 w-3" />النداء غير مدعوم
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ParentRequests() {
  const { user, school } = useAuth();
  const settings   = useSchoolSettings();
  const schoolSlug = school?.slug ?? localStorage.getItem('school_slug') ?? 'dahya-boys';
  const schoolName = settings?.school_name ?? 'مدارس الضاحية الأهلية';

  const [rows, setRows]             = useState<ParentRequest[]>([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [announcing, setAnnouncing] = useState<string | null>(null);
  const [approving, setApproving]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [typeTab, setTypeTab]       = useState<'permission' | 'pickup' | 'all'>('permission');
  const ttsSupported = isTTSSupported();
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('parent_requests')
      .select('*')
      .eq('school_slug', schoolSlug)
      .order('created_at', { ascending: false })
      .limit(300);
    setRows((data ?? []) as ParentRequest[]);
    setLoading(false);
  }, [schoolSlug]);

  useEffect(() => {
    document.title = 'طلبات أولياء الأمور | نظام الضاحية';
    load();

    const ch = (supabase as any)
      .channel('parent_requests_rt')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'parent_requests',
        filter: `school_slug=eq.${schoolSlug}`,
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const newReq = payload.new as ParentRequest;
          setRows((prev) => [newReq, ...prev]);
          const isPickup = newReq.request_type === 'pickup';
          toast.info(`🔔 ${isPickup ? '⚡ استلام سريع' : 'استئذان'}: ${newReq.student_name}`, { duration: 6000 });
          try {
            const ctx  = new AudioContext();
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = isPickup ? 1100 : 880;
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(); osc.stop(ctx.currentTime + 0.5);
          } catch {}
        } else if (payload.eventType === 'UPDATE') {
          setRows((prev) => prev.map((r) => r.id === payload.new.id ? payload.new as ParentRequest : r));
        }
      })
      .subscribe();
    channelRef.current = ch;
    return () => { ch.unsubscribe(); };
  }, [load, schoolSlug]);

  async function approve(req: ParentRequest) {
    if (!user) return;
    setApproving(req.id);
    try {
      const approvedAt   = new Date().toISOString();
      const approverName = user.email ?? 'موظف';
      const { error } = await (supabase as any)
        .from('parent_requests')
        .update({ status: 'approved', approved_by: user.id, approved_at: approvedAt, approver_name: approverName })
        .eq('id', req.id);
      if (error) { toast.error(error.message); return; }
      if (req.parent_phone) {
        const msg  = buildWhatsAppMessage({ schoolName, studentName: req.student_name, reason: req.reason, exitTime: req.requested_exit_time, approvedAt });
        const sent = openWhatsApp(req.parent_phone, msg);
        toast.success(sent ? '✅ تمت الموافقة — فُتح واتساب' : '✅ تمت الموافقة', { duration: 5000 });
      } else {
        toast.success(`✅ تمت الموافقة على: ${req.student_name}`);
      }
      await announceReq(req);
    } finally { setApproving(null); }
  }

  async function reject(req: ParentRequest) {
    const { error } = await (supabase as any).from('parent_requests').update({ status: 'rejected' }).eq('id', req.id);
    if (error) { toast.error(error.message); return; }
    toast.info('تم رفض الطلب');
  }

  function sendWhatsApp(req: ParentRequest) {
    if (!req.parent_phone) { toast.error('لا يوجد رقم جوال لولي الأمر'); return; }
    const msg  = buildWhatsAppMessage({ schoolName, studentName: req.student_name, reason: req.reason, exitTime: req.requested_exit_time, approvedAt: req.approved_at ?? new Date().toISOString() });
    const sent = openWhatsApp(req.parent_phone, msg);
    if (sent) toast.success('تم فتح واتساب — يرجى إرسال الرسالة');
    else toast.error('رقم الجوال غير صالح');
  }

  async function announceReq(req: ParentRequest) {
    if (!ttsSupported) { toast.error('المتصفح لا يدعم النداء الصوتي'); return; }
    setAnnouncing(req.id);
    try {
      await announceStudent({ name: req.student_name, times: 3 });
      await (supabase as any).from('parent_requests').update({ announced: true, announced_at: new Date().toISOString() }).eq('id', req.id);
      toast.success('📢 تم النداء 3 مرات');
    } catch (err: any) {
      toast.error(err.message ?? 'خطأ في النداء');
    } finally { setAnnouncing(null); }
  }

  const filtered = rows.filter((r) => {
    const matchType =
      typeTab === 'all' ||
      (typeTab === 'permission' && (r.request_type === 'permission' || r.request_type == null)) ||
      (typeTab === 'pickup'     && r.request_type === 'pickup');
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || r.student_name.includes(q) || (r.student_number ?? '').includes(q);
    return matchType && matchStatus && matchSearch;
  });

  const pendingPermission = rows.filter((r) => r.status === 'pending' && (r.request_type === 'permission' || r.request_type == null)).length;
  const pendingPickup     = rows.filter((r) => r.status === 'pending' && r.request_type === 'pickup').length;

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" />
            طلبات أولياء الأمور
            {(pendingPermission + pendingPickup) > 0 && (
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-red-500 text-white text-xs font-bold px-1.5 animate-pulse">
                {pendingPermission + pendingPickup}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">طلبات QR Code — تحديث فوري + إشعار واتساب + نداء صوتي</p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
          تحديث
        </Button>
      </header>

      {/* تبويبا النوع */}
      <div className="flex gap-1 border-b border-border pb-0">
        {([
          { key: 'permission', label: 'طلبات الاستئذان',   icon: ClipboardList, count: pendingPermission, active: 'border-primary text-primary bg-primary/5' },
          { key: 'pickup',     label: 'الاستلام السريع',   icon: Zap,           count: pendingPickup,     active: 'border-teal-500 text-teal-600 bg-teal-50' },
          { key: 'all',        label: 'الكل',               icon: null,          count: 0,                 active: 'border-slate-400 text-slate-700 bg-slate-50' },
        ] as const).map(({ key, label, icon: Icon, count, active }) => (
          <button
            key={key}
            onClick={() => setTypeTab(key as typeof typeTab)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 rounded-t-lg ${
              typeTab === key ? active : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
            {count > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* فلاتر الحالة والبحث */}
      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex gap-2 flex-wrap">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
              <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} onClick={() => setStatusFilter(f)}>
                {f === 'pending' ? 'قيد المراجعة' : f === 'approved' ? 'مؤكدة' : f === 'rejected' ? 'مرفوضة' : 'الكل'}
                {f === 'pending' && (pendingPermission + pendingPickup) > 0 && (
                  <span className="mr-1.5 text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                    {pendingPermission + pendingPickup}
                  </span>
                )}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم..." className="pr-9" />
          </div>
        </div>
      </Card>

      {/* قائمة الطلبات */}
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground shadow-soft">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد طلبات في هذا القسم</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              schoolName={schoolName}
              ttsSupported={ttsSupported}
              onApprove={approve}
              onReject={reject}
              onAnnounce={announceReq}
              onWhatsApp={sendWhatsApp}
              approving={approving}
              announcing={announcing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
