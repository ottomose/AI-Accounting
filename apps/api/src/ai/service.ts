import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { db } from '../db';
import { accounts, journalEntries, journalLines, documents, companies } from '../db/schema';
import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { SYSTEM_PROMPT } from './prompts';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
const MODEL = process.env.AI_MODEL ?? 'claude-sonnet-4-20250514';

// ==================== Tool Definitions for Claude ====================

const aiTools: Tool[] = [
  {
    name: 'create_journal_entry',
    description: 'Create a double-entry journal entry with debit and credit lines. SUM(debit) must equal SUM(credit).',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
        description: { type: 'string' },
        reference: { type: 'string' },
        currency: { type: 'string', enum: ['GEL', 'USD', 'EUR', 'GBP', 'TRY', 'RUB'], default: 'GEL' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              accountCode: { type: 'string', description: 'Account code (e.g. 1110, 5010)' },
              debit: { type: 'number' },
              credit: { type: 'number' },
              description: { type: 'string' },
            },
            required: ['accountCode', 'debit', 'credit'],
          },
          minItems: 2,
        },
      },
      required: ['date', 'description', 'lines'],
    },
  },
  {
    name: 'get_account_balance',
    description: 'Get the current balance of a specific account by code',
    input_schema: {
      type: 'object' as const,
      properties: {
        accountCode: { type: 'string', description: 'Account code (e.g. 1110)' },
        companyId: { type: 'string' },
        asOfDate: { type: 'string', description: 'ISO date, defaults to today' },
      },
      required: ['accountCode', 'companyId'],
    },
  },
  {
    name: 'list_accounts',
    description: 'List all accounts in the chart of accounts for a company',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string' },
        type: { type: 'string', enum: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'get_trial_balance',
    description: 'Get trial balance for a company as of a date',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string' },
        asOfDate: { type: 'string', description: 'ISO date, defaults to today' },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'list_journal_entries',
    description: 'List recent journal entries for a company',
    input_schema: {
      type: 'object' as const,
      properties: {
        companyId: { type: 'string' },
        limit: { type: 'number', default: 20 },
        status: { type: 'string', enum: ['draft', 'posted', 'voided'] },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'categorize_transaction',
    description: 'Suggest debit/credit accounts for a transaction based on description and amount',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string' },
        amount: { type: 'number' },
        counterpartyName: { type: 'string' },
        currency: { type: 'string', default: 'GEL' },
      },
      required: ['description', 'amount'],
    },
  },
];

// ==================== Tool Executor ====================

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: { companyId: string; userId: string }
): Promise<unknown> {
  switch (name) {
    case 'create_journal_entry':
      return executeCreateJournalEntry(args, context);
    case 'get_account_balance':
      return executeGetAccountBalance(args, context);
    case 'list_accounts':
      return executeListAccounts(args, context);
    case 'get_trial_balance':
      return executeGetTrialBalance(args, context);
    case 'list_journal_entries':
      return executeListJournalEntries(args, context);
    case 'categorize_transaction':
      return { suggestion: true, ...args, note: 'Categorization is advisory — use create_journal_entry to post.' };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function executeCreateJournalEntry(
  args: Record<string, unknown>,
  context: { companyId: string; userId: string }
) {
  const lines = args.lines as Array<{ accountCode: string; debit: number; credit: number; description?: string }>;

  // Validate debit = credit
  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: `Debit (${totalDebit}) does not equal credit (${totalCredit})` };
  }

  // Resolve account codes to IDs
  const accountRows = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.companyId, context.companyId));

  const codeToId = new Map(accountRows.map((a) => [a.code, a.id]));

  for (const line of lines) {
    if (!codeToId.has(line.accountCode)) {
      return { error: `Account code ${line.accountCode} not found` };
    }
  }

  // Generate entry number
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(eq(journalEntries.companyId, context.companyId));
  const entryNumber = `JE-${String(Number(count[0].count) + 1).padStart(5, '0')}`;

  // Insert journal entry
  const [entry] = await db
    .insert(journalEntries)
    .values({
      entryNumber,
      date: new Date(args.date as string),
      description: args.description as string,
      currency: ((args.currency as string) ?? 'GEL') as 'GEL' | 'USD' | 'EUR' | 'GBP' | 'TRY' | 'RUB',
      companyId: context.companyId,
      createdById: context.userId,
    })
    .returning();

  // Insert lines
  const lineValues = lines.map((l) => ({
    journalEntryId: entry.id,
    accountId: codeToId.get(l.accountCode)!,
    debit: String(l.debit || 0),
    credit: String(l.credit || 0),
    description: l.description ?? null,
    companyId: context.companyId,
  }));

  await db.insert(journalLines).values(lineValues);

  return {
    success: true,
    entryId: entry.id,
    entryNumber,
    status: 'draft',
    totalDebit,
    totalCredit,
    lineCount: lines.length,
  };
}

async function executeGetAccountBalance(
  args: Record<string, unknown>,
  context: { companyId: string }
) {
  const companyId = (args.companyId as string) || context.companyId;
  const code = args.accountCode as string;

  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.companyId, companyId), eq(accounts.code, code)));

  if (!account) return { error: `Account ${code} not found` };

  const result = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.accountId, account.id),
        eq(journalEntries.status, 'posted'),
        args.asOfDate ? lte(journalEntries.date, new Date(args.asOfDate as string)) : undefined
      )
    );

  const debit = parseFloat(result[0].totalDebit);
  const credit = parseFloat(result[0].totalCredit);

  return {
    accountCode: code,
    accountName: account.name,
    accountNameKa: account.nameKa,
    type: account.type,
    totalDebit: debit,
    totalCredit: credit,
    balance: debit - credit,
  };
}

async function executeListAccounts(
  args: Record<string, unknown>,
  context: { companyId: string }
) {
  const companyId = (args.companyId as string) || context.companyId;
  const conditions = [eq(accounts.companyId, companyId), eq(accounts.isActive, true)];

  if (args.type) {
    conditions.push(eq(accounts.type, args.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'));
  }

  const rows = await db
    .select({
      code: accounts.code,
      name: accounts.name,
      nameKa: accounts.nameKa,
      type: accounts.type,
      level: accounts.level,
      isGroup: accounts.isGroup,
    })
    .from(accounts)
    .where(and(...conditions))
    .orderBy(accounts.code);

  return { accounts: rows, count: rows.length };
}

async function executeGetTrialBalance(
  args: Record<string, unknown>,
  context: { companyId: string }
) {
  const companyId = (args.companyId as string) || context.companyId;
  const asOfDate = args.asOfDate ? new Date(args.asOfDate as string) : new Date();

  const rows = await db
    .select({
      code: accounts.code,
      name: accounts.name,
      nameKa: accounts.nameKa,
      type: accounts.type,
      totalDebit: sql<string>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(accounts)
    .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
    .leftJoin(
      journalEntries,
      and(
        eq(journalLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.date, asOfDate)
      )
    )
    .where(and(eq(accounts.companyId, companyId), eq(accounts.isGroup, false)))
    .groupBy(accounts.id, accounts.code, accounts.name, accounts.nameKa, accounts.type)
    .orderBy(accounts.code);

  const balances = rows
    .map((r) => ({
      ...r,
      debit: parseFloat(r.totalDebit),
      credit: parseFloat(r.totalCredit),
      balance: parseFloat(r.totalDebit) - parseFloat(r.totalCredit),
    }))
    .filter((r) => r.debit !== 0 || r.credit !== 0);

  const totalDebit = balances.reduce((s, r) => s + r.debit, 0);
  const totalCredit = balances.reduce((s, r) => s + r.credit, 0);

  return {
    asOfDate: asOfDate.toISOString().split('T')[0],
    accounts: balances,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

async function executeListJournalEntries(
  args: Record<string, unknown>,
  context: { companyId: string }
) {
  const companyId = (args.companyId as string) || context.companyId;
  const limit = (args.limit as number) || 20;

  const conditions = [eq(journalEntries.companyId, companyId)];
  if (args.status) {
    conditions.push(eq(journalEntries.status, args.status as 'draft' | 'posted' | 'voided'));
  }

  const entries = await db
    .select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      date: journalEntries.date,
      description: journalEntries.description,
      status: journalEntries.status,
      currency: journalEntries.currency,
    })
    .from(journalEntries)
    .where(and(...conditions))
    .orderBy(desc(journalEntries.date))
    .limit(limit);

  return { entries, count: entries.length };
}

// ==================== Chat Function ====================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  context: { companyId: string; userId: string; userRole: string }
): Promise<{ reply: string; toolResults: Array<{ tool: string; result: unknown }> }> {
  const systemPrompt = SYSTEM_PROMPT + `\n\nContext:
- Company ID: ${context.companyId}
- User Role: ${context.userRole}
- Current Date: ${new Date().toISOString().split('T')[0]}`;

  const anthropicMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const toolResults: Array<{ tool: string; result: unknown }> = [];
  let finalReply = '';

  // Agentic loop — keep calling until no more tool_use
  let currentMessages = [...anthropicMessages];
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      messages: currentMessages,
      tools: aiTools,
    });

    // Collect text and tool_use blocks
    const assistantContent: ContentBlockParam[] = [];
    let hasToolUse = false;

    for (const block of response.content) {
      if (block.type === 'text') {
        finalReply += block.text;
        assistantContent.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_use') {
        hasToolUse = true;
        assistantContent.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    // Add assistant message
    currentMessages.push({ role: 'assistant', content: assistantContent });

    if (!hasToolUse || response.stop_reason === 'end_turn') {
      break;
    }

    // Execute tools and add results
    const toolResultBlocks: ContentBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`[AI] Executing tool: ${block.name}`, block.input);
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          context
        );
        toolResults.push({ tool: block.name, result });
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        } as ContentBlockParam);
      }
    }

    currentMessages.push({ role: 'user', content: toolResultBlocks });
    finalReply = ''; // Reset — we want the final text after all tools
  }

  return { reply: finalReply, toolResults };
}

// ==================== OCR Function ====================

export async function processDocumentOCR(
  imageBase64: string,
  mediaType: string,
  documentType: 'receipt' | 'invoice' | 'bank_statement'
): Promise<{ extracted: unknown; rawText: string }> {
  const prompts: Record<string, string> = {
    receipt: `ამოიცანი ამ ჩეკიდან/ქვითრიდან: თარიღი, თანხა, ვალუტა, გამყიდველი, საიდენტიფიკაციო ნომერი, დანიშნულება, დღგ, გადახდის მეთოდი. პასუხი JSON-ით.`,
    invoice: `ამოიცანი ამ ინვოისიდან: ნომერი, თარიღი, გამყიდველი, მყიდველი, სტრიქონები, ქვეჯამი, დღგ, ჯამი, ვალუტა. პასუხი JSON-ით.`,
    bank_statement: `ამოიცანი ამ საბანკო ამონაწერიდან: ანგარიშის ნომერი, ბანკი, ტრანზაქციები (თარიღი, აღწერა, დებეტი/კრედიტი, ნაშთი). პასუხი JSON-ით.`,
  };

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as ImageMediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompts[documentType],
          },
        ],
      },
    ],
  });

  let rawText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      rawText += block.text;
    }
  }

  // Try to parse JSON from response
  let extracted: unknown = null;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      extracted = null;
    }
  }

  return { extracted, rawText };
}
