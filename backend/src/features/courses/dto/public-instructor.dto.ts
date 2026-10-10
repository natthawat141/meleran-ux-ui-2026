export interface PublicInstructorDto {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
}

// Profile remains a compatibility storage field. Only the canonical public bio
// may leave this projection; malformed stored data must not leak as an entity.
export function publicBio(profileJson: string): string | null {
  const profile: unknown = JSON.parse(profileJson);
  if (typeof profile !== 'object' || profile === null || Array.isArray(profile)) {
    throw new Error('Invalid stored instructor profile');
  }
  const bio = (profile as Record<string, unknown>).bio;
  if (bio === undefined || bio === null) return null;
  if (typeof bio !== 'string') throw new Error('Invalid stored instructor bio');
  return bio;
}
