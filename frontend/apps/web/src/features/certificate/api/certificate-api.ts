import type { WireServerCertificate as ServerCertificate } from '@melearn/contracts';
export type { WireServerCertificate as ServerCertificate } from '@melearn/contracts';
import { apiClient as http } from '../../../shared/api/client';

function decodeCertificate(value: unknown): ServerCertificate {
  if (!value || typeof value !== 'object') throw new TypeError('Invalid certificate');
  const v = value as Record<string, unknown>;
  for (const key of ['id', 'code', 'course_id', 'course_title', 'learner_name', 'issued_at', 'enrollment_id']) if (typeof v[key] !== 'string') throw new TypeError('Invalid certificate');
  return v as unknown as ServerCertificate;
}
export const certificateApi = {
  list: (signal?: AbortSignal) => http.request('me/certificates', { method: 'GET', signal, decoder: (value) => {
    if (!value || typeof value !== 'object' || !Array.isArray((value as { items?: unknown }).items)) throw new TypeError('Invalid certificate list');
    return (value as { items: unknown[] }).items.map(decodeCertificate);
  } }),
  get: (id: string, signal?: AbortSignal) => http.request(`me/certificates/${encodeURIComponent(id)}`, { method: 'GET', signal, decoder: decodeCertificate }),
  download: (id: string, signal?: AbortSignal) => http.request(`me/certificates/${encodeURIComponent(id)}/download`, { method: 'GET', signal, decoder: (value) => value as { filename: string; content_type: string; content: string } }),
};
