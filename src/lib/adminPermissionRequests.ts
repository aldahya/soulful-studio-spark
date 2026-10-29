import { supabase } from '@/integrations/supabase/client';

type RpcError = { message: string };
type RpcResponse<T = unknown> = { data: T; error: RpcError | null };
type AdminPermissionRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResponse>;
};

const adminPermissionRpc = supabase as unknown as AdminPermissionRpcClient;

export async function createAdminPermissionRequest(input: {
  studentId: string;
  schoolSlug: string;
  reason: string;
  notes?: string | null;
}) {
  return await adminPermissionRpc.rpc('create_admin_permission_request', {
    p_student_id: input.studentId,
    p_school_slug: input.schoolSlug,
    p_reason: input.reason,
    p_notes: input.notes?.trim() || null,
  }) as RpcResponse<string | null>;
}

export async function approveAdminPermissionRequest(requestId: string) {
  return await adminPermissionRpc.rpc('approve_admin_permission_request', {
    p_request_id: requestId,
  });
}

export async function rejectAdminPermissionRequest(requestId: string) {
  return await adminPermissionRpc.rpc('reject_admin_permission_request', {
    p_request_id: requestId,
  });
}
