export function usesPrototypeData(pathname: string): boolean {
  if (pathname === '/teach/reviews') return false;
  return pathname === '/teach' || pathname.startsWith('/teach/') || pathname.startsWith('/instructors/');
}
