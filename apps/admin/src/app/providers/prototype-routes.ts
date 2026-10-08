export function usesPrototypeData(pathname: string): boolean {
  if (['/admin/access-codes', '/admin/payments', '/admin/ai'].includes(pathname)) return false;
  return pathname === '/admin' || pathname.startsWith('/admin/');
}
