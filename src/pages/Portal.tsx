// src/pages/Portal.tsx — بوابة مجموعة المالكي التعليمية (صفحة اختيار المدرسة)
  import { useEffect } from 'react';
  import { ArrowLeft, ExternalLink, Building2, MapPin, Phone, ChevronDown, Star } from 'lucide-react';
  import { useNavigate } from 'react-router-dom';

  interface School {
    id: string;
    name: string;
    subtitle: string;
    logo: string;
    bgLight: string;
    textColor: string;
    badgeBg: string;
    badgeText: string;
    borderColor: string;
    btnStyle: React.CSSProperties;
    description: string;
    stages: string;
  }

  const SCHOOLS: School[] = [
    {
      id: 'dahya-boys',
      name: 'مدارس الضاحية الأهلية',
      subtitle: 'للبنين',
      logo: '/logos/dahya-boys.png',
      bgLight: 'bg-teal-50',
      textColor: 'text-teal-700',
      badgeBg: 'bg-teal-100',
      badgeText: 'text-teal-800',
      borderColor: 'border-teal-200 hover:border-teal-400',
      btnStyle: { background: 'linear-gradient(135deg, hsl(195 50% 16%), hsl(178 55% 30%))' },
      description: 'بيئة تعليمية متميزة للطلاب بمنهج أصيل وتقنيات حديثة.',
      stages: 'ابتدائي • متوسط • ثانوي',
    },
    {
      id: 'dahya-girls',
      name: 'مدارس الضاحية الأهلية',
      subtitle: 'للبنات',
      logo: '/logos/dahya-girls.png',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-700',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      borderColor: 'border-blue-200 hover:border-blue-400',
      btnStyle: { background: 'linear-gradient(135deg, hsl(215 55% 22%), hsl(215 60% 42%))' },
      description: 'بيئة تعليمية آمنة ومتكاملة تُنمي مهارات الطالبات.',
      stages: 'رياض أطفال • ابتدائي • متوسط',
    },
    {
      id: 'ajyal',
      name: 'مدارس أجيال المعالي الأهلية',
      subtitle: 'للبنين والبنات',
      logo: '/logos/ajyal.png',
      bgLight: 'bg-amber-50',
      textColor: 'text-amber-700',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      borderColor: 'border-amber-200 hover:border-amber-400',
      btnStyle: { background: 'linear-gradient(135deg, hsl(30 50% 18%), hsl(38 80% 40%))' },
      description: 'نبني جيلاً يحمل قيم الريادة والتميز والإبداع.',
      stages: 'رياض أطفال • ابتدائي • متوسط',
    },
    {
      id: 'qanadeel',
      name: 'مدارس قناديل الشرق الأهلية',
      subtitle: 'للبنين والبنات',
      logo: '/logos/qanadeel.png',
      bgLight: 'bg-violet-50',
      textColor: 'text-violet-700',
      badgeBg: 'bg-violet-100',
      badgeText: 'text-violet-800',
      borderColor: 'border-violet-200 hover:border-violet-400',
      btnStyle: { background: 'linear-gradient(135deg, hsl(255 50% 18%), hsl(258 52% 42%))' },
      description: 'قناديل تُضيء الطريق — نُوقِد شعلة المعرفة في كل طالب.',
      stages: 'رياض أطفال • ابتدائي • متوسط',
    },
  ];

  export default function Portal() {
    const navigate = useNavigate();

    useEffect(() => {
      document.title = 'مجموعة المالكي التعليمية — بوابة المدارس';
    }, []);

    const openSchool = (id: string) => {
      navigate(`/login?school=${id}`);
    };

    return (
      <div dir="rtl" className="min-h-screen font-sans overflow-x-hidden" style={{ background: 'linear-gradient(160deg, hsl(195 40% 97%), hsl(178 30% 94%), hsl(195 20% 98%))' }}>
        {/* ─── Blobs ─── */}
        <div className="pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full blur-3xl opacity-30"
             style={{ background: 'hsl(178 55% 70%)' }} />
        <div className="pointer-events-none fixed -left-24 top-1/3 h-80 w-80 rounded-full blur-3xl opacity-20"
             style={{ background: 'hsl(38 80% 70%)', animationDelay: '4s' }} />

        {/* ─── Nav ─── */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-teal-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white shadow-md flex items-center justify-center p-1 border border-gray-100">
                <img src="/logos/malki-group.png" alt="مجموعة المالكي" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900 leading-none">مجموعة المالكي</p>
                <p className="text-xs text-teal-600 font-medium">التعليمية</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse inline-block" />
              نظام الحضور الذكي
            </div>
          </div>
        </header>

        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(140deg, hsl(195 50% 14%), hsl(178 55% 25%), hsl(172 45% 40%))' }}>
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center p-3 shadow-xl">
                <img src="/logos/malki-group.png" alt="مجموعة المالكي التعليمية" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs font-medium mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-teal-300 animate-pulse" />
              نظام الحضور الذكي بالباركود
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-4">
              مجموعة المالكي
              <br />
              <span style={{ color: 'hsl(45 90% 65%)' }}>التعليمية</span>
            </h1>
            <p className="text-lg text-white/75 leading-relaxed mb-10 max-w-xl mx-auto">
              بوابة موحدة لإدارة الحضور في مدارس المجموعة — اختر مدرستك وادخل لنظام الحضور الذكي
            </p>
            <div className="flex flex-col items-center gap-2 text-white/50 text-xs">
              <span>تصفح المدارس</span>
              <ChevronDown className="w-5 h-5 animate-bounce" />
            </div>
            {/* Stats */}
            <div className="mt-14 pt-10 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {[{ v: '4', l: 'مدارس أهلية' }, { v: '٣', l: 'مراحل دراسية' }, { v: 'باركود', l: 'نظام الحضور' }, { v: 'لحظي', l: 'تقارير فورية' }].map((s) => (
                <div key={s.l} className="text-center">
                  <div className="text-3xl font-black text-white mb-1">{s.v}</div>
                  <div className="text-sm text-white/70">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Schools Grid ─── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold mb-4">
              مدارس المجموعة
            </span>
            <h2 className="text-3xl font-black text-gray-900 mb-3">اختر مدرستك</h2>
            <p className="text-gray-500 text-base max-w-md mx-auto">
              كل مدرسة لها نظامها المستقل — بياناتها وتقاريرها وحساباتها منفصلة تماماً
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SCHOOLS.map((school) => (
              <div
                key={school.id}
                className={`group relative rounded-3xl bg-white border-2 ${school.borderColor} shadow-md cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
                onClick={() => openSchool(school.id)}
              >
                <div className="h-1.5 rounded-t-3xl" style={school.btnStyle} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl ${school.bgLight} flex items-center justify-center flex-shrink-0 p-1.5 border border-gray-100`}>
                        <img src={school.logo} alt={`لوجو ${school.name}`} className="w-full h-full object-contain"
                             onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 leading-snug">{school.name}</h3>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${school.badgeBg} ${school.badgeText}`}>
                          {school.subtitle}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className={`w-4 h-4 mt-1 ${school.textColor} opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0`} />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">{school.description}</p>
                  <div className={`${school.bgLight} rounded-xl px-3 py-2.5 mb-5`}>
                    <p className="text-xs text-gray-500 mb-0.5">المراحل الدراسية</p>
                    <p className={`text-xs font-bold ${school.textColor}`}>{school.stages}</p>
                  </div>
                  <button
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl text-white text-sm font-bold transition-all duration-200 shadow-sm active:scale-95"
                    style={school.btnStyle}
                  >
                    <span>الدخول للنظام</span>
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Note */}
          <div className="mt-10 flex items-start gap-3 p-5 rounded-2xl bg-teal-50 border border-teal-200 max-w-2xl mx-auto">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-teal-800 mb-1">بيانات منفصلة لكل مدرسة</p>
              <p className="text-xs text-teal-700 leading-relaxed">
                كل مدرسة تعمل بقاعدة بيانات مستقلة — طلابها وفصولها ومعلموها وتقاريرها معزولة تماماً لأعلى مستوى من الخصوصية والأمان.
              </p>
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center p-1.5">
                  <img src="/logos/malki-group.png" alt="مجموعة المالكي" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="font-black text-white">مجموعة المالكي التعليمية</p>
                  <p className="text-xs text-teal-400">نظام إدارة الحضور الذكي</p>
                </div>
              </div>
              <ul className="flex flex-wrap justify-center gap-4 text-sm text-gray-400">
                {SCHOOLS.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 cursor-pointer hover:text-teal-400 transition-colors"
                      onClick={() => openSchool(s.id)}>
                    <img src={s.logo} alt={s.name} className="w-5 h-5 object-contain" />
                    <span>{s.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-teal-500" />
                <span>المملكة العربية السعودية</span>
              </div>
              <span>© {new Date().getFullYear()} مجموعة المالكي التعليمية — جميع الحقوق محفوظة</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }
  