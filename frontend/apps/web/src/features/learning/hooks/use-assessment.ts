import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assessmentApi } from '../api/assessment-api';
import type { AttemptView } from '../api/assessment-api';
export function useStartAttempt() {
  const client = useQueryClient();
  return useMutation({ mutationFn: assessmentApi.start, onSuccess: async (attempt) => {
    client.setQueryData(['assessment', 'attempt', attempt.id], attempt);
    await Promise.all([client.invalidateQueries({ queryKey: ['learning', 'course', attempt.course_id] }), client.invalidateQueries({ queryKey: ['learning', 'enrollments'] })]);
  } });
}
export function useAttempt(attemptId: string) {
  return useQuery({ queryKey: ['assessment', 'attempt', attemptId], queryFn: ({ signal }) => assessmentApi.attempt(attemptId, signal), enabled: Boolean(attemptId) });
}
export function useSaveAttemptAnswers() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ attemptId, answers }: { attemptId: string; answers: AttemptView['answers'] }) => assessmentApi.saveAnswers(attemptId, answers), onSuccess: (attempt) => client.setQueryData(['assessment', 'attempt', attempt.id], attempt) });
}
export function useSubmitAttempt() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ attemptId, answers }: { attemptId: string; answers: AttemptView['answers'] }) => assessmentApi.saveAnswers(attemptId, answers).then(() => assessmentApi.submit(attemptId)), onSuccess: async (attempt) => {
    client.setQueryData(['assessment', 'attempt', attempt.id], attempt);
    await Promise.all([client.invalidateQueries({ queryKey: ['learning', 'course', attempt.course_id] }), client.invalidateQueries({ queryKey: ['learning', 'enrollments'] })]);
  } });
}
export function useGradingQueue() {
  return useQuery({ queryKey: ['assessment', 'grading-queue'], queryFn: ({ signal }) => assessmentApi.gradingQueue(signal) });
}
export function useGradeQuestion() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ attemptId, questionId, score, comment }: { attemptId: string; questionId: string; score: number; comment: string | null }) => assessmentApi.grade(attemptId, questionId, score, comment), onSuccess: async (attempt) => {
    client.setQueryData(['assessment', 'attempt', attempt.id], attempt);
    await Promise.all([client.invalidateQueries({ queryKey: ['assessment', 'grading-queue'] }), client.invalidateQueries({ queryKey: ['learning', 'course', attempt.course_id] }), client.invalidateQueries({ queryKey: ['learning', 'enrollments'] })]);
  } });
}
