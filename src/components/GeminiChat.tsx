import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في نظام الاستئذان الذكي لمجموعة المالكي التعليمية.
تساعد المعلمين والإداريين في فهم واستخدام النظام بطريقة سهلة وواضحة.

معلومات عن النظام:
- نظام حضور وغياب ذكي يعمل بالباركود وQR Code
- يدعم مسح الباركود من خلال كاميرا الجوال
- يتيح لأولياء الأمور إرسال طلبات الاستئذان عبر رابط QR بدون تسجيل دخول
- يرسل إشعارات WhatsApp عند الموافقة على طلبات الاستئذان
- يُنادى على الطالب بالعربية 3 مرات عند الموافقة (Text-to-Speech)
- يدعم إنشاء تقارير الحضور وتصديرها
- يدعم عدة مدارس: الضاحية للبنين، الضاحية للبنات، أجيال، قناديل

أجب دائماً بالعربية، وكن موجزاً ومفيداً. إذا لم تعرف إجابة معينة عن النظام، اقترح التواصل مع المشرف.`;

export function GeminiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        text: 'مرحباً! أنا مساعدك الذكي لنظام الاستئذان 🎓\nكيف يمكنني مساعدتك اليوم؟',
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const updated: Message[] = [...messages, { role: 'user', text }];
    setMessages(updated);
    setLoading(true);

    try {
      const history = updated.slice(0, -1).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyDg2Upv5DWw3hHf1AmeOdcMpD2b_5cngLw`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              ...history,
              { role: 'user', parts: [{ text }] },
            ],
            generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
          }),
        }
      );

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'عذراً، لم أستطع الإجابة الآن. حاول مجدداً.';
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'خطأ في الاتصال. تحقق من الإنترنت وحاول مجدداً.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300',
          open
            ? 'bg-rose-500 hover:bg-rose-600 rotate-0'
            : 'bg-gradient-to-br from-teal-500 to-teal-700 hover:scale-110',
        )}
        aria-label="مساعد ذكي"
      >
        {open
          ? <X className="h-6 w-6 text-white" />
          : <Bot className="h-7 w-7 text-white" />}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white shadow">
            AI
          </span>
        )}
      </button>

      {/* Chat window */}
      <div
        className={cn(
          'fixed bottom-24 left-6 z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-border/50 transition-all duration-300 origin-bottom-left',
          open ? 'w-80 sm:w-96 h-[30rem] scale-100 opacity-100' : 'w-0 h-0 scale-90 opacity-0 pointer-events-none',
        )}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 bg-gradient-to-l from-teal-600 to-teal-700 px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">المساعد الذكي</p>
            <p className="text-xs text-teal-100">مدعوم بـ Gemini AI</p>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-gray-50">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-start' : 'justify-end')}>
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 mt-1">
                  <Bot className="h-4 w-4 text-teal-700" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-teal-600 text-white rounded-tr-sm'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-tl-sm',
                )}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-end gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 mt-1">
                <Bot className="h-4 w-4 text-teal-700" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-border/40 bg-white px-3 py-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="اكتب سؤالك..."
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-right outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="h-9 w-9 shrink-0 rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-40"
          >
            <Send className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      </div>
    </>
  );
}
