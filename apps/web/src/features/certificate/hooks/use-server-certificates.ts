import { useQuery } from '@tanstack/react-query';
import { certificateApi } from '../api/certificate-api';
export function useServerCertificates() { return useQuery({ queryKey: ['certificates', 'mine'], queryFn: ({ signal }) => certificateApi.list(signal) }); }
export function useServerCertificate(id: string) { return useQuery({ queryKey: ['certificates', id], queryFn: ({ signal }) => certificateApi.get(id, signal), enabled: Boolean(id) }); }
