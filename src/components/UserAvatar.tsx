import React from 'react';
import { Avatar } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import './user-avatar.css';
import type { User } from '../types';

export interface UserAvatarProps {
  user?: Pick<User, 'name' | 'avatar'> | null;
  size?: number;
}

export function UserAvatar({ user, size = 40 }: UserAvatarProps) {
  return (
    <Avatar
      className="user-avatar"
      src={user?.avatar || null}
      alt={user?.name ? `รูปโปรไฟล์ของ ${user.name}` : 'รูปโปรไฟล์'}
      size={size}
      radius="xl"
    >
      <IconUser size={Math.round(size * 0.5)} stroke={1.6} aria-hidden="true" />
    </Avatar>
  );
}
