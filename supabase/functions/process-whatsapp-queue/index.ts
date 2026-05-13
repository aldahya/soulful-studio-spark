import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const GREEN_API_INSTANCE = Deno.env.get('GREEN_API_INSTANCE')!;
  const GREEN_API_TOKEN = Deno.env.get('GREEN_API_TOKEN')!;
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

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
      console.log('Green API response:', JSON.stringify(json));
      return res.ok && !!json.idMessage;
    } catch (e) {
      console.error('Green API error:', e);
      return false;
    }
  }

  serve(async (req) => {
    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
        },
      });
    }

    const secret = req.headers.get('x-cron-secret') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';
    let authorized = false;

    // 1. Cron secret check (GitHub Actions)
    if (CRON_SECRET && secret === CRON_SECRET) {
      authorized = true;
    }

    // 2. Authenticated Supabase user check (frontend direct call)
    if (!authorized && authHeader.startsWith('Bearer ')) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const userToken = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(userToken);
        if (!error && user) authorized = true;
      } catch (_) { /* ignore */ }
    }

    if (!authorized) {
      return new Response('Unauthorized', { status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const now = new Date().toISOString();

    const { data: items, error } = await supabase
      .from('whatsapp_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(50);

    if (error) {
      console.error('Queue fetch error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'لا رسائل مستحقة' }), {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    let sent = 0, cancelled = 0, failed = 0;

    for (const item of items) {
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
        await supabase.from('whatsapp_queue').update({
          status: 'cancelled',
          sent_at: now,
        }).eq('id', item.id);
        cancelled++;
        continue;
      }

      const ok = await sendWhatsApp(item.phone, item.message);
      await supabase.from('whatsapp_queue').update({
        status: ok ? 'sent' : 'failed',
        sent_at: now,
      }).eq('id', item.id);

      if (ok) sent++;
      else failed++;

      if (items.indexOf(item) < items.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const result = { processed: items.length, sent, cancelled, failed };
    console.log('WhatsApp queue result:', result);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  });
  