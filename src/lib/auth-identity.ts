import type { Role } from '../types';

export interface LoginIdentity {
  email: string;
  username?: string;
}

export interface PrototypeLoginIdentity extends LoginIdentity {
  password?: string;
  role: Role;
}

export type PrototypeLoginResult<User> =
  | { ok: true; user: User }
  | { ok: false; reason: 'credentials' | 'role' };

export function findUserByLoginIdentifier<User extends LoginIdentity>(
  users: User[],
  identifier: string
): User | undefined {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier) return undefined;

  return users.find((user) =>
    user.email.trim().toLowerCase() === normalizedIdentifier ||
    user.username?.trim().toLowerCase() === normalizedIdentifier
  );
}

export function authenticatePrototypeUser<User extends PrototypeLoginIdentity>(
  users: User[],
  identifier: string,
  password: string | undefined,
  requiredRole?: Role
): PrototypeLoginResult<User> {
  const user = findUserByLoginIdentifier(users, identifier);
  if (!user || user.password !== password) return { ok: false, reason: 'credentials' };
  if (requiredRole && user.role !== requiredRole) return { ok: false, reason: 'role' };
  return { ok: true, user };
}
