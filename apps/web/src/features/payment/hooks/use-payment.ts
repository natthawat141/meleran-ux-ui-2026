import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from '../api/payment-api';

export function usePaymentStatus(paymentId: string) {
  return useQuery({ queryKey: ['payment', paymentId], queryFn: ({ signal }) => paymentApi.status(paymentId, signal), enabled: Boolean(paymentId), refetchInterval: (query) => {
    const payment = query.state.data;
    return payment && (payment.status === 'pending' || payment.status === 'processing' || (payment.status === 'succeeded' && payment.fulfillment_status === 'pending')) ? 4_000 : false;
  } });
}

export function useStartPayment() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ courseId, requestId }: { courseId: string; requestId: string }) => paymentApi.checkout(courseId, requestId), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['payment'] }), client.invalidateQueries({ queryKey: ['learning'] }), client.invalidateQueries({ queryKey: ['enrollments'] })]);
  } });
}

export function useSimulateStripeCompletion(paymentId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => paymentApi.simulateStripeCompletion(paymentId), onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['payment', paymentId] }),
      client.invalidateQueries({ queryKey: ['learning'] }),
      client.invalidateQueries({ queryKey: ['enrollments'] }),
    ]);
  } });
}

export function useRedeemCourseCode() {
  const client = useQueryClient();
  return useMutation({ mutationFn: paymentApi.redeem, onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['payment'] }), client.invalidateQueries({ queryKey: ['learning'] }), client.invalidateQueries({ queryKey: ['enrollments'] })]);
  } });
}
