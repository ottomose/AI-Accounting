import { Hono } from 'hono';
import { authMiddleware, type AuthSession } from '../auth/middleware';
import { db } from '../db';
import { companies } from '../db/schema';
import { eq } from 'drizzle-orm';
import { seedAccountsForCompany } from '../db/seed-accounts';

const companiesRoute = new Hono<{ Variables: { authSession: AuthSession } }>();

companiesRoute.use('*', authMiddleware);

// List user's companies
companiesRoute.get('/', async (c) => {
  const { user } = c.get('authSession');

  const rows = await db
    .select()
    .from(companies)
    .where(eq(companies.ownerId, user.id));

  return c.json({ companies: rows });
});

// Create company
companiesRoute.post('/', async (c) => {
  const { user } = c.get('authSession');
  const { name, taxId } = await c.req.json();

  if (!name || !taxId) {
    return c.json({ error: 'name and taxId are required' }, 400);
  }

  const [company] = await db
    .insert(companies)
    .values({
      name,
      taxId,
      ownerId: user.id,
    })
    .returning();

  // Auto-seed chart of accounts for new company
  try {
    await seedAccountsForCompany(company.id);
  } catch (err) {
    console.error('[companies] auto-seed failed:', err);
  }

  return c.json({ company });
});

// Manual seed for existing companies
companiesRoute.post('/:id/seed-accounts', async (c) => {
  const id = c.req.param('id');
  try {
    const count = await seedAccountsForCompany(id);
    return c.json({ success: true, seeded: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// Get single company
companiesRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, id));

  if (!company) return c.json({ error: 'Not found' }, 404);
  return c.json({ company });
});

export default companiesRoute;
