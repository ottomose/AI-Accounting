import { Hono } from 'hono';
import { Client } from 'pg';
import { authMiddleware } from '../auth/middleware';

const journalEntriesRoute = new Hono();

interface JournalLine {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
}

interface CreateJournalEntry {
  date: string;
  description: string;
  currency?: string;
  exchangeRate?: number;
  companyId: string;
  lines: JournalLine[];
}

// POST /journal-entries — ატომური insert ვალიდაციით
journalEntriesRoute.post('/', authMiddleware, async (c) => {
  const body = await c.req.json<CreateJournalEntry>();
  const { user } = c.get('authSession');

  // ვალიდაცია: მინიმუმ 2 ხაზი
  if (!body.lines || body.lines.length < 2) {
    return c.json({ error: 'Journal entry must have at least 2 lines' }, 400);
  }

  // ვალიდაცია: SUM(debit) === SUM(credit)
  const totalDebit = body.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = body.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return c.json(
      {
        error: `Debits (${totalDebit.toFixed(2)}) must equal Credits (${totalCredit.toFixed(2)})`,
      },
      400
    );
  }

  // ვალიდაცია: თითოეულ ხაზს debit ან credit უნდა ჰქონდეს, არა ორივე
  for (const line of body.lines) {
    if ((line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0)) {
      return c.json(
        { error: 'Each line must have either debit or credit, not both or neither' },
        400
      );
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query('BEGIN');

    // Generate entry number
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM journal_entries WHERE company_id = $1`,
      [body.companyId]
    );
    const entryNumber = `JE-${String(Number(countResult.rows[0].count) + 1).padStart(6, '0')}`;

    // Insert journal entry
    const entryResult = await client.query(
      `INSERT INTO journal_entries (entry_number, date, description, currency, exchange_rate, company_id, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        entryNumber,
        body.date,
        body.description,
        body.currency || 'GEL',
        body.exchangeRate || 1.0,
        body.companyId,
        user.id,
      ]
    );
    const entry = entryResult.rows[0];

    // Insert journal lines
    const lines = [];
    for (const line of body.lines) {
      const lineResult = await client.query(
        `INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [entry.id, line.accountId, line.description || null, line.debit, line.credit, body.companyId]
      );
      lines.push(lineResult.rows[0]);
    }

    await client.query('COMMIT');

    return c.json({ entry: { ...entry, lines } }, 201);
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  } finally {
    await client.end();
  }
});

// POST /journal-entries/:id/post — draft -> posted
journalEntriesRoute.post('/:id/post', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { user } = c.get('authSession');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      `UPDATE journal_entries
       SET status = 'posted', posted_by_id = $1, posted_at = now(), updated_at = now()
       WHERE id = $2 AND status = 'draft'
       RETURNING *`,
      [user.id, id]
    );

    if (result.rowCount === 0) {
      return c.json({ error: 'Entry not found or already posted' }, 404);
    }

    return c.json({ entry: result.rows[0] });
  } finally {
    await client.end();
  }
});

// POST /journal-entries/:id/void — posted -> voided
journalEntriesRoute.post('/:id/void', authMiddleware, async (c) => {
  const id = c.req.param('id');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      `UPDATE journal_entries
       SET status = 'voided', updated_at = now()
       WHERE id = $1 AND status = 'posted'
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return c.json({ error: 'Entry not found or not in posted status' }, 404);
    }

    return c.json({ entry: result.rows[0] });
  } finally {
    await client.end();
  }
});

// GET /journal-entries?companyId=xxx
journalEntriesRoute.get('/', authMiddleware, async (c) => {
  const companyId = c.req.query('companyId');
  if (!companyId) return c.json({ error: 'companyId required' }, 400);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      `SELECT je.*,
              json_agg(json_build_object(
                'id', jl.id,
                'accountId', jl.account_id,
                'description', jl.description,
                'debit', jl.debit,
                'credit', jl.credit
              ) ORDER BY jl.debit DESC) as lines
       FROM journal_entries je
       LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
       WHERE je.company_id = $1
       GROUP BY je.id
       ORDER BY je.date DESC, je.entry_number DESC`,
      [companyId]
    );

    return c.json({ entries: result.rows });
  } finally {
    await client.end();
  }
});

export default journalEntriesRoute;
