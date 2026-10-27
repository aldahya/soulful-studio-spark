// Edge function: admin creates an Auth user and links it to teachers + user_roles.
// Uses the built-in fetch API so a remote package import cannot prevent the
// function from starting.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function responseJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error('admin-create-teacher is missing required Supabase runtime configuration');
      return jsonResponse({ error: 'function configuration incomplete' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'unauthenticated' }, 401);

    const callerResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    const caller = await responseJson(callerResponse);
    if (!callerResponse.ok || !caller?.id) return jsonResponse({ error: 'unauthenticated' }, 401);

    const adminHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };
    const rolesUrl = new URL(`${supabaseUrl}/rest/v1/user_roles`);
    rolesUrl.searchParams.set('select', 'role');
    rolesUrl.searchParams.set('user_id', `eq.${caller.id}`);
    rolesUrl.searchParams.set('role', 'eq.admin');
    rolesUrl.searchParams.set('limit', '1');
    const roleResponse = await fetch(rolesUrl, { headers: adminHeaders });
    const callerRoles = await responseJson(roleResponse);
    if (!roleResponse.ok) {
      console.error('admin role verification failed with status', roleResponse.status);
      return jsonResponse({ error: 'could not verify administrator permissions' }, 500);
    }
    if (!Array.isArray(callerRoles) || callerRoles.length === 0) {
      return jsonResponse({ error: 'forbidden: admin only' }, 403);
    }

    let input: any;
    try {
      input = await req.json();
    } catch {
      return jsonResponse({ error: 'invalid JSON request body' }, 400);
    }

    const { email, password, full_name, stage, all_stages, is_admin, school_id } = input ?? {};
    if (
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password ||
      typeof full_name !== 'string' || !full_name.trim()
    ) {
      return jsonResponse({ error: 'missing fields: email, password, full_name' }, 400);
    }
    if (password.length < 6) return jsonResponse({ error: 'password must be at least 6 characters' }, 400);

    const createUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name.trim() },
      }),
    });
    const createUserResult = await responseJson(createUserResponse);
    const newUserId = createUserResult?.id;
    if (!createUserResponse.ok || !newUserId) {
      return jsonResponse(
        { error: createUserResult?.msg ?? createUserResult?.message ?? 'could not create account' },
        createUserResponse.status || 400,
      );
    }

    const teacherPayload: Record<string, unknown> = {
      user_id: newUserId,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      all_stages: all_stages === true,
    };
    if (all_stages !== true && stage) teacherPayload.stage = stage;
    if (school_id) teacherPayload.school_id = school_id;

    const teacherResponse = await fetch(`${supabaseUrl}/rest/v1/teachers`, {
      method: 'POST',
      headers: { ...adminHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(teacherPayload),
    });
    const teacherResult = await responseJson(teacherResponse);
    if (!teacherResponse.ok) {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(newUserId)}`, {
        method: 'DELETE',
        headers: adminHeaders,
      }).catch(() => undefined);
      return jsonResponse(
        { error: teacherResult?.message ?? 'could not create teacher record' },
        400,
      );
    }

    const rolePayload: Record<string, unknown> = {
      user_id: newUserId,
      role: is_admin === true ? 'admin' : 'teacher',
    };
    if (school_id) rolePayload.school_id = school_id;

    const roleInsertResponse = await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: { ...adminHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(rolePayload),
    });
    const roleInsertResult = await responseJson(roleInsertResponse);
    if (!roleInsertResponse.ok) {
      await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/teachers?user_id=eq.${encodeURIComponent(newUserId)}`, {
          method: 'DELETE',
          headers: adminHeaders,
        }).catch(() => undefined),
        fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(newUserId)}`, {
          method: 'DELETE',
          headers: adminHeaders,
        }).catch(() => undefined),
      ]);
      return jsonResponse(
        { error: roleInsertResult?.message ?? 'could not assign account role' },
        400,
      );
    }

    return jsonResponse({ ok: true, user_id: newUserId });
  } catch (error) {
    console.error('admin-create-teacher failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'account creation failed unexpectedly' }, 500);
  }
});
