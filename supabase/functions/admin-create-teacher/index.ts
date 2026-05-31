// Edge function: admin creates a teacher login (any email domain) + links to teachers + user_roles
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey     = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;

    // تحقق من أن المستدعي مدير
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: roleRow } = await userClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden: admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { email, password, full_name, stage, all_stages, is_admin, school_id } = await req.json();
    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: 'missing fields: email, password, full_name' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if ((password as string).length < 6) {
      return new Response(JSON.stringify({ error: 'password must be at least 6 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // إنشاء مستخدم Auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? 'create failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const newUserId = created.user.id;

    // إدراج في teachers (مع all_stages والمرحلة وschool_id)
    const teacherPayload: Record<string, unknown> = {
      user_id:    newUserId,
      email,
      full_name,
      all_stages: all_stages === true,
    };
    if (!all_stages && stage) teacherPayload.stage = stage;
    if (school_id) teacherPayload.school_id = school_id;

    const { error: tErr } = await admin.from('teachers').insert(teacherPayload);
    if (tErr) {
      await admin.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(JSON.stringify({ error: tErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // إدراج في user_roles مع school_id
    const rolePayload: Record<string, unknown> = {
      user_id: newUserId,
      role:    is_admin ? 'admin' : 'teacher',
    };
    if (school_id) rolePayload.school_id = school_id;
    await admin.from('user_roles').insert(rolePayload);

    return new Response(JSON.stringify({ ok: true, user_id: newUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
