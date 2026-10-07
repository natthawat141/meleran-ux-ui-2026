function segment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded === '.' || decoded === '..' || decoded.includes('/')) return null;
    return encodeURIComponent(decoded);
  } catch {
    return null;
  }
}

function withLocation(target: string, search: string, hash: string): string {
  return `${target}${search}${hash}`;
}

/** Maps only known legacy Admin authoring paths; Instructor and retired actions fail closed. */
export function resolveAdminCompatibilityRoute(pathname: string, search = '', hash = ''): string | null {
  if (pathname === '/teach') return withLocation('/admin', search, hash);
  if (pathname === '/teach/courses') return withLocation('/admin/courses', search, hash);
  if (pathname === '/teach/courses/new') return withLocation('/admin/courses/new', search, hash);
  if (pathname === '/teach/quizzes') return withLocation('/admin/quizzes', search, hash);
  if (pathname === '/teach/learners') return withLocation('/admin/learners', search, hash);

  const patterns: Array<[RegExp, (groups: string[]) => string]> = [
    [/^\/teach\/courses\/([^/]+)\/settings$/, ([id]) => `/admin/courses/${id}/settings`],
    [/^\/teach\/courses\/([^/]+)\/curriculum$/, ([id]) => `/admin/courses/${id}/curriculum`],
    [/^\/teach\/courses\/([^/]+)\/chapters\/([^/]+)$/, ([courseId, chapterId]) => `/admin/courses/${courseId}/chapters/${chapterId}`],
    [/^\/teach\/courses\/([^/]+)\/videos\/([^/]+)$/, ([courseId, itemId]) => `/admin/courses/${courseId}/videos/${itemId}`],
    [/^\/teach\/courses\/([^/]+)\/articles\/([^/]+)$/, ([courseId, itemId]) => `/admin/courses/${courseId}/articles/${itemId}`],
    [/^\/teach\/courses\/([^/]+)\/quizzes$/, ([id]) => `/admin/courses/${id}/quizzes`],
    [/^\/teach\/courses\/([^/]+)\/preview$/, ([id]) => `/admin/courses/${id}/preview`],
    [/^\/teach\/courses\/([^/]+)\/learners$/, ([id]) => `/admin/courses/${id}/learners`],
    [/^\/teach\/courses\/([^/]+)$/, ([id]) => `/admin/courses/${id}/overview`],
    [/^\/teach\/quizzes\/([^/]+)$/, ([id]) => `/admin/quizzes/${id}`],
  ];

  for (const [pattern, buildTarget] of patterns) {
    const match = pathname.match(pattern);
    if (!match) continue;
    const encoded = match.slice(1).map(segment);
    if (encoded.some((value) => value === null)) return null;
    return withLocation(buildTarget(encoded as string[]), search, hash);
  }

  return null;
}
