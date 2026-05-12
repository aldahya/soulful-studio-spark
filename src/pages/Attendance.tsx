async function load() {
  setLoading(true);
  const [att, perms] = await Promise.all([

    // ← استخدم attendance_full_view بدلاً من attendance_records
    supabase.from('attendance_full_view')
      .select('id, status, date, recorded_at, student_name, student_number, stage, class_name, teacher_name')
      .eq('date', date)
      .order('recorded_at', { ascending: false }),

    supabase.from('permissions')
      .select('id, status, date, issued_at, reason, students(full_name, student_number, stage, classes(name)), teachers(full_name)')
      .eq('date', date).order('issued_at', { ascending: false }),
  ]);

  const a: Row[] = ((att.data ?? []) as any[]).map((r) => ({
    kind: 'attendance',
    id: r.id,
    status: r.status,
    date: r.date,
    recorded_at: r.recorded_at,
    student_name: r.student_name ?? '—',
    student_number: r.student_number ?? '',
    stage: r.stage,
    class_name: r.class_name ?? null,
    teacher_name: r.teacher_name ?? null,   // ← الآن يأتي من الـ view مباشرة
  }));

  const p: Row[] = ((perms.data ?? []) as any[]).map((r) => ({
    kind: 'permission',
    id: r.id,
    status: r.status,
    date: r.date,
    recorded_at: r.issued_at,
    student_name: r.students?.full_name ?? '—',
    student_number: r.students?.student_number ?? '',
    stage: r.students?.stage,
    class_name: r.students?.classes?.name ?? null,
    teacher_name: r.teachers?.full_name ?? null,
    reason: r.reason,
  }));

  setRows([...a, ...p].sort((x, y) => y.recorded_at.localeCompare(x.recorded_at)));
  setLoading(false);
}
