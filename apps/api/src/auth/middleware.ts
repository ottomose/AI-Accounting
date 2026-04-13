import { createMiddleware } from 'hono/factory';
import { auth } from './index';

export type AuthSession = {
  user: typeof auth.$Infer.Session.user;
  session: typeof auth.$Infer.Session.session;
};

export const authMiddleware = createMiddleware<{
  Variables: { authSession: AuthSession };
}>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('authSession', session);
  await next();
});

export const requireRole = (...roles: string[]) =>
  createMiddleware<{
    Variables: { authSession: AuthSession };
  }>(async (c, next) => {
    const { user } = c.get('authSession');
    if (!roles.includes(user.role ?? 'client')) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
