import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth';
import { authMiddleware, requireRole } from './auth/middleware';
import documentsRoute from './routes/documents';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Better Auth routes
app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw));

// Public routes
app.get('/', (c) => {
  return c.json({ message: 'AI Accounting API', version: '0.1.0' });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes
app.get('/api/me', authMiddleware, (c) => {
  const { user } = c.get('authSession');
  return c.json({ user });
});

// Documents API
app.route('/api/documents', documentsRoute);

// Admin-only route example
app.get('/api/admin/users', authMiddleware, requireRole('admin'), (c) => {
  return c.json({ message: 'Admin access granted' });
});

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
