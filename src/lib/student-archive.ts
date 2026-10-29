type SupabaseQueryResult = {
  data: any;
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;
  [key: string]: any;
};

export function isArchiveColumnUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const queryError = error as SupabaseQueryResult['error'];
  const message = [
    queryError?.code,
    queryError?.message,
    queryError?.details,
    queryError?.hint,
  ].filter(Boolean).join(' ').toLowerCase();

  return message.includes('archived_at') && (
    message.includes('42703')
    || message.includes('pgrst204')
    || message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('not found')
  );
}

export async function withActiveStudentFilter<T extends SupabaseQueryResult>(
  buildQuery: (filterArchived: boolean) => PromiseLike<T>,
): Promise<T & { archiveColumnAvailable: boolean }> {
  const filtered = await buildQuery(true);
  if (!isArchiveColumnUnavailable(filtered.error)) {
    return { ...filtered, archiveColumnAvailable: true };
  }

  const fallback = await buildQuery(false);
  return { ...fallback, archiveColumnAvailable: false };
}
