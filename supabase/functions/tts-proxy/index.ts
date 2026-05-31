// TTS Proxy — يستخدم Google Translate TTS لتوليد الصوت العربي
// لا يحتاج API key — يعمل مع أي متصفح بدون تثبيت أصوات

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const text = url.searchParams.get('text') ?? '';
    const lang = url.searchParams.get('lang') ?? 'ar';

    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Google Translate TTS (غير رسمي — يعمل بشكل موثوق للنصوص القصيرة)
    const gttsUrl =
      `https://translate.googleapis.com/translate_tts?ie=UTF-8` +
      `&q=${encodeURIComponent(text)}` +
      `&tl=${encodeURIComponent(lang)}` +
      `&client=gtx&ttsspeed=0.9`;

    const response = await fetch(gttsUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `TTS fetch failed: ${response.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audio = await response.arrayBuffer();

    return new Response(audio, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
