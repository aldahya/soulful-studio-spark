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
  kind: 'attendance'; id
