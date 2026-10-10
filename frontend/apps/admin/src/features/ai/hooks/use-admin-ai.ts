import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAiApi } from '../api/admin-ai-api';

export function useAdminAiCourses() { return useQuery({ queryKey: ['admin-ai', 'courses'], queryFn: ({ signal }) => adminAiApi.courses(signal) }); }
export function useAdminAiAuthoring(id: string) { return useQuery({ queryKey: ['admin-ai', 'authoring', id], queryFn: ({ signal }) => adminAiApi.authoring(id, signal), enabled: Boolean(id) }); }
export function useAdminTranscript(courseId: string, itemId: string) { return useQuery({ queryKey: ['admin-ai', 'transcript', courseId, itemId], queryFn: ({ signal }) => adminAiApi.transcript(courseId, itemId, signal), enabled: Boolean(courseId && itemId) }); }
export function useSetCourseAiEnabled() { const client = useQueryClient(); return useMutation({ mutationFn: ({ courseId, enabled }: { courseId: string; enabled: boolean }) => adminAiApi.setAiEnabled(courseId, enabled), onSuccess: async (_, value) => client.invalidateQueries({ queryKey: ['admin-ai', 'authoring', value.courseId] }) }); }
export function useSaveAdminTranscript() { const client = useQueryClient(); return useMutation({ mutationFn: ({ courseId, itemId, text }: { courseId: string; itemId: string; text: string }) => adminAiApi.saveTranscript(courseId, itemId, text), onSuccess: async (_, value) => client.invalidateQueries({ queryKey: ['admin-ai', 'transcript', value.courseId, value.itemId] }) }); }
