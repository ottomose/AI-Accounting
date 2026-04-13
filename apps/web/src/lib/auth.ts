import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

const API_URL =
  (typeof window !== 'undefined' && (window as any).__API_URL__) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
