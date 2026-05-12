import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const GREEN_API_INSTANCE = Deno.env.get('GREEN_API_INSTANCE')!;
  const GREEN_API_TOKEN = Deno.env.get('GREEN_API_TOKEN')!;
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

  // تحويل رقم هاتف سعودي → تنسيق Green API
  function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('966')) return `${digits}@c.us`;
    if (digits.startsWith('0') && digits.length === 10) return `966${digits.slice(1)}@c.us`;
    if (digits.length === 9) return `966${digits}@c.us`;
    return `${digits}@c.us`;
  }

  async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
    const chatId = formatPhone(phone);
    const url = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
      });
      const json = await res.json();
      return res.ok && !!json.idMessage;
    } catch (e) {
      console.error('Green API error:', e);
      return false;
    }
  }

  serve(async (req) => {
    // التحقق من صحة الطلب (من GitHub Actions فقط)
    const secret = req.headers.get('x-cron-secret') ?? '';
    if (CRON_SECRET && secret !== CRON_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date().toISOString();

    // جلب الرسائل المستحقة الإرسال
    const { data: items, error } = await supabase
      .from('whatsapp_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(50);

    if (error) {
      console.error('Queue fetch error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'لا رسائل مستحقة' }), { status: 200 });
    }

    let sent = 0, cancelled = 0, failed = 0;

    for (const item of items) {
      // التحقق: هل الطالب لا يزال غائباً؟ (قد يكون المعلم صحَّح الخطأ)
      const today = item.scheduled_at.slice(0, 10);
      const { data: latestAtt } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', item.student_id)
        .eq('date', today)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAtt && latestAtt.status !== 'absent') {
        // الطالب حضر أو تم تصحيح حالته — إلغاء الإشعار
        await supabase.from('whatsapp_queue').update({
          status: 'cancelled',
          sent_at: now,
        }).eq('id', item.id);
        cancelled++;
        continue;
      }

      // الإرسال عبر Green API
      const ok = await sendWhatsApp(item.phone, item.message);

      await supabase.from('whatsapp_queue').update({
        status: ok ? 'sent' : 'failed',
        sent_at: now,
      }).eq('id', item.id);

      if (ok) sent++;
      else failed++;

      // تأخير 2 ثانية بين الرسائل لتجنب الحظر
      if (items.indexOf(item) < items.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const result = { processed: items.length, sent, cancelled, failed };
    console.log('WhatsApp queue result:', result);
    return new Response(JSON.stringify(result), { status: 200 });
  });
  