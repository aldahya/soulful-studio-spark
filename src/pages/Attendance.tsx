import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_LABELS, STATUS_COLORS, STAGE_LABELS, formatDate, todayISO, type AttendanceStatus, type Stage } from '@/lib/i18n';
import { Loader2, Download, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';

type Filter = 'all' | AttendanceStatus | 'permission';

interface AttRow {
  kind: 'attendance'; id: string; status: AttendanceStatus; date: string; recorded_at: string;
  student_name: string; student_number: string; stage: Stage; class_name: string | null; teacher_name: string | null;
}
interface PermRow {
  kind: 'permission'; id: string; status: 'pending' | 'used' | 'returned'; date: string; recorded_at: string;
  student_name: string; student_number: string; stage: Stage; class_name: string | null; teacher_name: string | null; reason: string;
}
type Row = AttRow | PermRow;

const PERM_STATUS_LABELS = { pending: 'استذان معلَّق', used: 'استذان (خرج)', returned: 'استذان (عاد)' } as const;

export default function Attendance() {
  const { isAdmin, teacherStage, schoolId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  const [stageFilter, setStageFilter] = useState<'all' | Stage>('all');

  useEffect(() => { document.title = 'سجل الحضور | نظام الضاحية'; }, []);
  useEffect(() => { if (schoolId) load(); }, [date, schoolId]);

  useEffect(() => {
    if (!isAdmin && teacherStage) setStageFilter(teacherStage);
  }, [isAdmin, teacherStage]);

  async function load() {
    if (!schoolId) return;
    setLoading(true);

    const [att, perms] = await Promise.all([
      supabase
        .from('attendance_full_view')
        .select('id, status, date, recorded_at, student_name, student
