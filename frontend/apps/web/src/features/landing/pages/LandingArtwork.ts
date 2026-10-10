import writing from '@melearn/ui/assets/generated/landing-writing-photo.webp';
import data from '@melearn/ui/assets/generated/landing-data-photo.webp';
import focus from '@melearn/ui/assets/generated/landing-focus-photo.webp';

const artwork: Record<string, string> = { writing, data, focus };

// Replace only bundled prototype artwork on Landing; keep uploaded/external covers.
export function landingCover(cover: string | undefined, key?: string): string {
  if (cover) {
    const bundled = cover.match(/(?:^|\/)(?:course|article)-(writing|data|focus)-v[12](?:\.[a-z]+|-[\w-]+\.[a-z]+)(?:\?.*)?$/i);
    if (!bundled) return cover;
    return artwork[bundled[1].toLowerCase()] ?? writing;
  }
  return artwork[key ?? 'writing'] ?? writing;
}
