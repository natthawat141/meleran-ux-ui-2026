export function youtubeEmbedUrl(value: string = ''): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return undefined;
    const host = url.hostname.toLowerCase();
    const id = host === 'youtu.be' ? url.pathname.slice(1) :
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host) ?
        url.pathname === '/watch' ? url.searchParams.get('v') :
        /^\/(shorts|embed)\//.test(url.pathname) ? url.pathname.split('/')[2] : undefined : undefined;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
  } catch { return undefined; }
}

export function normalizeYoutubeUrl(value: string): string {
  const embed = youtubeEmbedUrl(value);
  return embed ? `https://www.youtube.com/watch?v=${embed.split('/').pop()}` : value;
}
