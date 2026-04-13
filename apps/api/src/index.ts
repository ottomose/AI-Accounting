import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth';
import { authMiddleware, requireRole } from './auth/middleware';
import documentsRoute from './routes/documents';
import journalEntriesRoute from './routes/journal-entries';
import accountingRoute from './routes/accounting';
import chatRoute from './routes/chat';
import companiesRoute from './routes/companies';

const app = new Hono();

app.use('*', logger());

const corsOrigin = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173']
  : ['http://localhost:5173', 'https://ai-accountingweb-production.up.railway.app'];

app.use(
  '*',
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Better Auth routes — manually inject CORS headers since auth.handler returns a raw Response
app.on(['POST', 'GET', 'OPTIONS'], '/api/auth/*', async (c) => {
  const origin = c.req.header('origin') ?? '';
  const allowed = corsOrigin.includes(origin);

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowed ? origin : corsOrigin[0],
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  const response = await auth.handler(c.req.raw);
  const newResponse = new Response(response.body, response);
  if (allowed) {
    newResponse.headers.set('Access-Control-Allow-Origin', origin);
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return newResponse;
});

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

// Journal Entries API
app.route('/api/journal-entries', journalEntriesRoute);

// Accounting API (accounts, ledger, trial-balance)
app.route('/api', accountingRoute);

// AI Chat API
app.route('/api/chat', chatRoute);

// Companies API
app.route('/api/companies', companiesRoute);

// Admin-only route example
app.get('/api/admin/users', authMiddleware, requireRole('admin'), (c) => {
  return c.json({ message: 'Admin access granted' });
});

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });

export default app;
