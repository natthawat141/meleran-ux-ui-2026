export type Role = 'learner' | 'instructor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  bio?: string;
  avatar?: string;
  avatar_url?: string | null;
  status?: 'active' | 'suspended' | 'pending' | 'invited';
  emailVerified?: boolean;
  email_verified?: boolean;
}

export interface CurrentUser {
  id: string;
  display_name: string;
  username: string;
  email: string | null;
  email_verified: boolean;
  avatar_url: string | null;
  roles: Role[];
  origin: 'self' | 'google' | 'admin';
  auth_methods: ('password' | 'google')[];
  learning_eligible: boolean;
}

export interface LoginRequest {
  username_or_email: string;
  password?: string;
}

export interface LoginResponse {
  user: CurrentUser;
}

export interface RegisterRequest {
  email: string;
  password?: string;
  display_name?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  new_password?: string;
}
