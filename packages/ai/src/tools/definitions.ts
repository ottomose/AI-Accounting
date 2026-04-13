import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { ToolCategory } from '../types';

// ==================== Zod Schemas ====================

export const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0),
  credit: z.number().min(0),
  description: z.string().optional(),
});

export const createJournalEntryParams = z.object({
  date: z.string().describe('ISO date string'),
  description: z.string(),
  reference: z.string().optional(),
  currency: z.enum(['GEL', 'USD', 'EUR', 'GBP', 'TRY', 'RUB']).default('GEL'),
  exchangeRate: z.number().positive().default(1),
  lines: z.array(journalLineSchema).min(2),
});

export const categorizeTransactionParams = z.object({
  description: z.string(),
  amount: z.number(),
  counterpartyName: z.string().optional(),
  currency: z.enum(['GEL', 'USD', 'EUR', 'GBP', 'TRY', 'RUB']).default('GEL'),
});

export const getAccountBalanceParams = z.object({
  accountId: z.string().uuid(),
  asOfDate: z.string().optional().describe('ISO date string'),
});

export const listPayablesParams = z.object({
  dueBefore: z.string().optional().describe('ISO date string'),
  status: z.enum(['pending', 'overdue', 'paid']).optional(),
});

export const listReceivablesParams = z.object({
  dueBefore: z.string().optional().describe('ISO date string'),
  status: z.enum(['pending', 'overdue', 'collected']).optional(),
});

export const generateReportParams = z.object({
  reportType: z.enum(['pnl', 'balance_sheet', 'cash_flow', 'trial_balance']),
  periodStart: z.string().describe('ISO date string'),
  periodEnd: z.string().describe('ISO date string'),
  currency: z.enum(['GEL', 'USD', 'EUR']).default('GEL'),
});

export const lookupCounterpartyParams = z.object({
  query: z.string().describe('Name or tax ID'),
});

export const calculateTaxParams = z.object({
  taxType: z.enum(['vat', 'income', 'profit']),
  periodStart: z.string().describe('ISO date string'),
  periodEnd: z.string().describe('ISO date string'),
});

export const flagForReviewParams = z.object({
  reason: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  relatedEntityId: z.string().uuid(),
  relatedEntityType: z.enum(['journal_entry', 'transaction', 'document', 'counterparty']),
});

export const processDocumentParams = z.object({
  documentId: z.string().uuid(),
  documentType: z.enum(['receipt', 'invoice', 'bank_statement', 'other']).optional(),
});

// ==================== JSON Schema Converter ====================

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return { type: 'object', properties, required };
  }

  if (schema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: 'string' };
    if (schema.description) result.description = schema.description;
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema.options as string[] };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element as z.ZodType),
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap() as z.ZodType);
  }

  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(schema.removeDefault() as z.ZodType);
    return { ...inner, default: schema._def.defaultValue() };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  return { type: 'string' };
}

// ==================== Tool Definitions ====================

export const tools: ToolDefinition[] = [
  {
    name: 'create_journal_entry',
    description: 'Create a double-entry journal entry with debit and credit lines',
    descriptionKa: 'ორმაგი ჩანაწერის შექმნა დებეტისა და კრედიტის ხაზებით',
    category: ToolCategory.JOURNAL,
    parameters: createJournalEntryParams,
    parametersJsonSchema: zodToJsonSchema(createJournalEntryParams),
  },
  {
    name: 'categorize_transaction',
    description: 'Categorize a transaction into the appropriate account based on description and amount',
    descriptionKa: 'ტრანზაქციის კატეგორიზაცია შესაბამის ანგარიშზე აღწერისა და თანხის მიხედვით',
    category: ToolCategory.JOURNAL,
    parameters: categorizeTransactionParams,
    parametersJsonSchema: zodToJsonSchema(categorizeTransactionParams),
  },
  {
    name: 'get_account_balance',
    description: 'Get the current balance of a specific account',
    descriptionKa: 'კონკრეტული ანგარიშის მიმდინარე ნაშთის მიღება',
    category: ToolCategory.QUERY,
    parameters: getAccountBalanceParams,
    parametersJsonSchema: zodToJsonSchema(getAccountBalanceParams),
  },
  {
    name: 'list_payables',
    description: 'List accounts payable (creditors) with optional filters',
    descriptionKa: 'გადასახდელი ვალდებულებების (კრედიტორების) სიის ნახვა',
    category: ToolCategory.QUERY,
    parameters: listPayablesParams,
    parametersJsonSchema: zodToJsonSchema(listPayablesParams),
  },
  {
    name: 'list_receivables',
    description: 'List accounts receivable (debtors) with optional filters',
    descriptionKa: 'მისაღები მოთხოვნების (დებიტორების) სიის ნახვა',
    category: ToolCategory.QUERY,
    parameters: listReceivablesParams,
    parametersJsonSchema: zodToJsonSchema(listReceivablesParams),
  },
  {
    name: 'generate_report',
    description: 'Generate a financial report (P&L, balance sheet, cash flow, or trial balance)',
    descriptionKa: 'ფინანსური ანგარიშგების გენერაცია (მოგება-ზარალი, ბალანსი, ფულადი ნაკადები, საცდელი ბალანსი)',
    category: ToolCategory.REPORT,
    parameters: generateReportParams,
    parametersJsonSchema: zodToJsonSchema(generateReportParams),
  },
  {
    name: 'lookup_counterparty',
    description: 'Look up a counterparty by name or tax ID',
    descriptionKa: 'კონტრაგენტის ძიება სახელით ან საიდენტიფიკაციო ნომრით',
    category: ToolCategory.QUERY,
    parameters: lookupCounterpartyParams,
    parametersJsonSchema: zodToJsonSchema(lookupCounterpartyParams),
  },
  {
    name: 'calculate_tax',
    description: 'Calculate tax liability for a given period and tax type',
    descriptionKa: 'გადასახადის გამოთვლა მოცემული პერიოდისა და ტიპისთვის (დღგ, საშემოსავლო, მოგების)',
    category: ToolCategory.TAX,
    parameters: calculateTaxParams,
    parametersJsonSchema: zodToJsonSchema(calculateTaxParams),
  },
  {
    name: 'flag_for_review',
    description: 'Flag an entity for manual review with reason and priority',
    descriptionKa: 'ობიექტის მონიშვნა ხელით შემოწმებისთვის მიზეზისა და პრიორიტეტის მითითებით',
    category: ToolCategory.REVIEW,
    parameters: flagForReviewParams,
    parametersJsonSchema: zodToJsonSchema(flagForReviewParams),
  },
  {
    name: 'process_document',
    description: 'Process an uploaded document through OCR and data extraction pipeline',
    descriptionKa: 'ატვირთული დოკუმენტის დამუშავება OCR-ისა და მონაცემების ამოღების პაიპლაინით',
    category: ToolCategory.OCR,
    parameters: processDocumentParams,
    parametersJsonSchema: zodToJsonSchema(processDocumentParams),
  },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return tools.filter((t) => t.category === category);
}
