import { useQuery } from '@tanstack/react-query';
import { adminPaymentApi } from '../api/admin-payment-api';

export function useAdminPayment(paymentId: string) {
  return useQuery({ queryKey: ['admin', 'payment', paymentId], queryFn: ({ signal }) => adminPaymentApi.get(paymentId, signal), enabled: Boolean(paymentId) });
}
