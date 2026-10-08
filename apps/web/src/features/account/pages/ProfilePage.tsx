import React, { useState } from 'react';
import { Alert } from 'antd';
import type { ProfileValues, UpdateProfileRequest } from '@melearn/contracts';
import { ProfileSettings } from '../components/ProfileSettings';
import { useAuthSession } from '../../auth/api/AuthSessionProvider';
import { authSessionApi, provisionalLoginError } from '../../auth/api/auth-session';

export function ProfilePage() {
  const session = useAuthSession();
  const [saving, setSaving] = useState(false);
  const user = session.user;
  if (!user) return <Alert type="info" showIcon message="กรุณาเข้าสู่ระบบเพื่อดูบัญชีของคุณ" />;
  const profileUser = { ...user.profile, id: user.id, name: user.display_name, username: user.username ?? undefined,
    email: user.email ?? '', role: user.roles.join(', '), avatar: user.avatar_url ?? undefined,
    googleLinkedEmail: user.auth_methods.includes('google') ? user.email ?? undefined : undefined };
  const save = async (values: ProfileValues) => {
    const { name, avatar, username, googleLinkedEmail: _google, ...profile } = values;
    const body: UpdateProfileRequest = { display_name: name, username, profile };
    // Local uploaded blobs are UI drafts until an upload API exists.
    if (avatar && !/^(https?:\/\/|\/(?!\/))/.test(avatar)) return { ok: false, message: 'กรุณาใช้ URL รูปภาพแบบ HTTP/HTTPS; การอัปโหลดไฟล์รอ Media API' };
    if (avatar) body.avatar_url = avatar;
    if (!avatar) body.avatar_url = null;
    if (avatar?.startsWith('data:')) return { ok: false, message: 'ยังไม่มี API อัปโหลดรูป กรุณาใช้ URL รูปภาพ' };
    setSaving(true);
    try { await authSessionApi.updateProfile(body); await session.refresh(); return { ok: true }; }
    catch (error) { return { ok: false, message: provisionalLoginError(error) }; }
    finally { setSaving(false); }
  };
  return <ProfileSettings key={user.id} user={profileUser} users={[profileUser]} updateProfile={save} saving={saving} />;
}
