import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { redeemAdminApi } from '../api/redeem-admin-api';

export function useAdminRedeemCourses() { return useQuery({ queryKey: ['admin', 'redeem', 'courses'], queryFn: redeemAdminApi.courses }); }
export function useAdminRedeemCodes() { return useQuery({ queryKey: ['admin', 'redeem', 'codes'], queryFn: redeemAdminApi.codes }); }
export function useCreateRedeemCodes() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ courseId, count }: { courseId: string; count: number }) => redeemAdminApi.create(courseId, count), onSuccess: async () => client.invalidateQueries({ queryKey: ['admin', 'redeem', 'codes'] }) });
}
export function useRevokeRedeemCode() {
  const client = useQueryClient();
  return useMutation({ mutationFn: redeemAdminApi.revoke, onSuccess: async () => client.invalidateQueries({ queryKey: ['admin', 'redeem', 'codes'] }) });
}
