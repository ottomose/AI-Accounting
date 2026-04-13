import { Hono } from 'hono';
import { Client } from 'pg';
import { authMiddleware } from '../auth/middleware';

const accountingRoute = new Hono();

// GET /accounts?companyId=xxx — ანგარიშთა გეგმა იერარქიით
accountingRoute.get('/accounts', authMiddleware, async (c) => {
  const companyId = c.req.query('companyId');
  if (!companyId) return c.json({ error: 'companyId required' }, 400);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      `SELECT id, code, name, name_ka, type, parent_id, level, is_group, is_active
       FROM accounts
       WHERE company_id = $1
       ORDER BY code`,
      [companyId]
    );

    return c.json({ accounts: result.rows });
  } finally {
    await client.end();
  }
});

// GET /ledger/:accountId?companyId=xxx — ანგარიშის ბრუნვა
accountingRoute.get('/ledger/:accountId', authMiddleware, async (c) => {
  const accountId = c.req.param('accountId');
  const companyId = c.req.query('companyId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  if (!companyId) return c.json({ error: 'companyId required' }, 400);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Account info
    const accResult = await client.query(
      `SELECT id, code, name, name_ka, type FROM accounts WHERE id = $1 AND company_id = $2`,
      [accountId, companyId]
    );
    if (accResult.rowCount === 0) return c.json({ error: 'Account not found' }, 404);

    // Ledger entries
    let query = `
      SELECT je.date, je.entry_number, je.description as entry_description,
             jl.description as line_description, jl.debit, jl.credit,
             je.currency, je.exchange_rate, je.status
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE jl.account_id = $1 AND jl.company_id = $2 AND je.status = 'posted'
    `;
    const params: (string | undefined)[] = [accountId, companyId];

    if (from) {
      params.push(from);
      query += ` AND je.date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND je.date <= $${params.length}`;
    }

    query += ` ORDER BY je.date, je.entry_number`;

    const ledgerResult = await client.query(query, params);

    // Running balance
    let balance = 0;
    const type = accResult.rows[0].type;
    const isDebitNormal = type === 'asset' || type === 'expense';

    const entries = ledgerResult.rows.map((row) => {
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      balance += isDebitNormal ? debit - credit : credit - debit;
      return { ...row, balance: balance.toFixed(2) };
    });

    return c.json({
      account: accResult.rows[0],
      entries,
      totalDebit: entries.reduce((s, e) => s + Number(e.debit), 0).toFixed(2),
      totalCredit: entries.reduce((s, e) => s + Number(e.credit), 0).toFixed(2),
      closingBalance: balance.toFixed(2),
    });
  } finally {
    await client.end();
  }
});

// GET /trial-balance?companyId=xxx — საცდელი ბალანსი
accountingRoute.get('/trial-balance', authMiddleware, async (c) => {
  const companyId = c.req.query('companyId');
  const asOf = c.req.query('asOf');

  if (!companyId) return c.json({ error: 'companyId required' }, 400);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    let dateFilter = '';
    const params: string[] = [companyId];
    if (asOf) {
      params.push(asOf);
      dateFilter = `AND je.date <= $${params.length}`;
    }

    const result = await client.query(
      `SELECT
         a.id, a.code, a.name, a.name_ka, a.type,
         COALESCE(SUM(jl.debit), 0)::numeric(15,2) as total_debit,
         COALESCE(SUM(jl.credit), 0)::numeric(15,2) as total_credit,
         CASE
           WHEN a.type IN ('asset', 'expense')
             THEN (COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0))::numeric(15,2)
           ELSE (COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0))::numeric(15,2)
         END as balance
       FROM accounts a
       LEFT JOIN journal_lines jl ON jl.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
         AND je.status = 'posted' ${dateFilter}
       WHERE a.company_id = $1 AND a.is_group = false
       GROUP BY a.id, a.code, a.name, a.name_ka, a.type
       HAVING COALESCE(SUM(jl.debit), 0) != 0 OR COALESCE(SUM(jl.credit), 0) != 0
       ORDER BY a.code`,
      params
    );

    const totalDebit = result.rows.reduce((s, r) => s + Number(r.total_debit), 0);
    const totalCredit = result.rows.reduce((s, r) => s + Number(r.total_credit), 0);

    return c.json({
      accounts: result.rows,
      totals: {
        debit: totalDebit.toFixed(2),
        credit: totalCredit.toFixed(2),
        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      },
    });
  } finally {
    await client.end();
  }
});

export default accountingRoute;
