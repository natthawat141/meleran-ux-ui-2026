const LOCAL_ORIGIN = 'https://melearn.local';

/** Keeps grading navigation inside the retained Instructor review flows. */
export function getGradingReturnTo(returnTo: string | null | undefined, fallbackQuizId?: string): string {
  const fallback = fallbackQuizId
    ? `/teach/quizzes/${encodeURIComponent(fallbackQuizId)}/attempts`
    : '/teach/quizzes';

  if (!returnTo?.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) return fallback;

  try {
    const url = new URL(returnTo, LOCAL_ORIGIN);
    const isReviewQueue = url.pathname === '/teach/reviews';
    const isQuizAttempts = /^\/teach\/quizzes\/[^/]+\/attempts$/.test(url.pathname);
    if (url.origin !== LOCAL_ORIGIN || (!isReviewQueue && !isQuizAttempts)) return fallback;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
