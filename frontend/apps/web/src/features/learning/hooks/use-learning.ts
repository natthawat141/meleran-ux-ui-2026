import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningApi } from '../api/learning-api';

export function useMyLearning() {
  return useQuery({ queryKey: ['learning', 'enrollments'], queryFn: ({ signal }) => learningApi.myEnrollments(signal) });
}
export function useLearningCourse(courseId: string) {
  return useQuery({ queryKey: ['learning', 'course', courseId], queryFn: ({ signal }) => learningApi.course(courseId, signal), enabled: Boolean(courseId) });
}
export function useLearningItem(courseId: string, itemId: string) {
  return useQuery({ queryKey: ['learning', 'item', courseId, itemId], queryFn: ({ signal }) => learningApi.item(courseId, itemId, signal), enabled: Boolean(courseId && itemId) });
}
export function useCompleteLearningItem(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (itemId: string) => learningApi.complete(itemId), onSuccess: async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['learning', 'course', courseId] }), queryClient.invalidateQueries({ queryKey: ['learning', 'enrollments'] })]);
  } });
}
export function useSaveLearningResume(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ itemId, positionSeconds }: { itemId: string; positionSeconds: number }) => learningApi.resume(itemId, positionSeconds), onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ['learning', 'course', courseId] });
  } });
}
