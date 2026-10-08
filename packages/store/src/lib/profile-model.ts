export interface ProfileDetails {
  username?: string;
  firstName?: string;
  lastName?: string;
  firstNameEnglish?: string;
  lastNameEnglish?: string;
  certificateName?: string;
  birthDate?: string;
  phone?: string;
  school?: string;
  educationLevel?: string;
  interests?: string[];
  learningGoals?: string[];
  googleLinkedEmail?: string;
}

export type ProfileValues = ProfileDetails & {
  name: string;
  bio?: string;
  avatar?: string;
};

export interface ProfileUserLike extends ProfileDetails {
  id: string;
  name: string;
}

export function defaultUsername(user: ProfileUserLike, users: ProfileUserLike[]): string {
  const existing = user.username?.trim();
  if (existing) return users.some((item) => item.id !== user.id && item.username?.trim().toLowerCase() === existing.toLowerCase()) ? '' : existing;
  const candidate = user.id.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30);
  if (candidate.length < 3) return '';
  return users.some((item) => item.id !== user.id && (item.username?.trim() || item.id.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30)).toLowerCase() === candidate.toLowerCase())
    ? ''
    : candidate;
}

export function validateProfile(values: Pick<ProfileValues, 'name' | 'username' | 'birthDate'>, users: ProfileUserLike[], userId: string): string | undefined {
  if (!values.name?.trim()) return 'กรอกชื่อที่แสดง';
  const username = values.username?.trim() ?? '';
  if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) return 'ชื่อผู้ใช้ต้องยาว 3–30 ตัว และใช้ a-z, 0-9, จุด หรือขีดล่าง';
  if (users.some((user) => user.id !== userId && (user.username?.trim() || user.id.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30)).toLowerCase() === username.toLowerCase())) return 'ชื่อผู้ใช้นี้มีผู้ใช้แล้ว';
  const dob = values.birthDate?.trim();
  if (dob) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 'กรอกวันเกิดให้ครบในรูปแบบ ปปปป-ดด-วว';
    const [year, month, day] = dob.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    const afterToday = year > today.getFullYear() || (year === today.getFullYear() && (month > today.getMonth() + 1 || (month === today.getMonth() + 1 && day > today.getDate())));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day || afterToday) return 'วันเกิดไม่ถูกต้องหรืออยู่ในอนาคต';
  }
  return undefined;
}

export function certificateRecipient(user: ProfileUserLike): string {
  return user.certificateName?.trim() || [user.firstName, user.lastName].map((part) => part?.trim()).filter(Boolean).join(' ') || user.name;
}

export function snapshotLegacyCertificateNames<T extends { userId: string; recipientName?: string }>(certificates: T[], users: ProfileUserLike[]): T[] {
  return certificates.map((certificate) => {
    if (certificate.recipientName) return certificate;
    const user = users.find((item) => item.id === certificate.userId);
    return user ? { ...certificate, recipientName: user.name } : certificate;
  });
}
