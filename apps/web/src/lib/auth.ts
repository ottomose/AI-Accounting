import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

const API_URL =
  (typeof window !== 'undefined' && (window as any).__API_URL__) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [adminClient()],
  fetchOptions: {
    onRequest(context) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        context.headers.set('Authorization', `Bearer ${token}`);
      }
    },
    onResponse(context) {
      // Store token from sign-in / sign-up responses
      if (context.response.ok) {
        context.response
          .clone()
          .json()
          .then((data: any) => {
            if (data?.token) {
              localStorage.setItem('auth_token', data.token);
            }
          })
          .catch(() => {});
      }
    },
  },
});

export const { useSession, signIn, signUp, signOut } = authClient;
