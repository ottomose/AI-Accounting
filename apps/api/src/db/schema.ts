import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  pgEnum,
  integer,
  boolean,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema';

// ==================== ENUMS ====================

export const roleEnum = pgEnum('role', ['admin', 'operator', 'client']);

export const accountTypeEnum = pgEnum('account_type', [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]);

export const currencyEnum = pgEnum('currency', [
  'GEL',
  'USD',
  'EUR',
  'GBP',
  'TRY',
  'RUB',
]);

export const journalStatusEnum = pgEnum('journal_status', [
  'draft',
  'posted',
  'voided',
]);

// ==================== USERS ====================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  hashedPassword: text('hashed_password').notNull(),
  role: roleEnum('role').notNull().default('client'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ==================== COMPANIES ====================

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  taxId: text('tax_id').notNull().unique(),
  baseCurrency: currencyEnum('base_currency').notNull().default('GEL'),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ==================== CHART OF ACCOUNTS ====================

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameKa: text('name_ka').notNull(),
    type: accountTypeEnum('type').notNull(),
    parentId: uuid('parent_id'),
    level: integer('level').notNull().default(1),
    isGroup: boolean('is_group').notNull().default(false),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    index('accounts_company_code_idx').on(table.companyId, table.code),
    index('accounts_parent_idx').on(table.parentId),
  ]
);

// ==================== JOURNAL ENTRIES ====================

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryNumber: text('entry_number').notNull(),
    date: timestamp('date').notNull(),
    description: text('description').notNull(),
    status: journalStatusEnum('status').notNull().default('draft'),
    currency: currencyEnum('currency').notNull().default('GEL'),
    exchangeRate: decimal('exchange_rate', { precision: 12, scale: 6 })
      .notNull()
      .default('1.000000'),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id),
    postedById: text('posted_by_id').references(() => user.id),
    postedAt: timestamp('posted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('je_company_date_idx').on(table.companyId, table.date),
    index('je_company_number_idx').on(table.companyId, table.entryNumber),
  ]
);

// ==================== JOURNAL LINES ====================

export const journalLines = pgTable(
  'journal_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journalEntryId: uuid('journal_entry_id')
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    description: text('description'),
    debit: decimal('debit', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    credit: decimal('credit', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
  },
  (table) => [
    index('jl_entry_idx').on(table.journalEntryId),
    index('jl_account_idx').on(table.accountId),
    index('jl_company_idx').on(table.companyId),
  ]
);

// ==================== DOCUMENTS ====================

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileName: text('file_name').notNull(),
    fileUrl: text('file_url').notNull(),
    mimeType: text('mime_type').notNull(),
    journalEntryId: uuid('journal_entry_id').references(
      () => journalEntries.id
    ),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    uploadedById: text('uploaded_by_id')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('docs_company_idx').on(table.companyId)]
);

// ==================== AUDIT LOG ====================

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    action: text('action', { enum: ['INSERT', 'UPDATE', 'DELETE'] }).notNull(),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    companyId: uuid('company_id').references(() => companies.id),
    userId: text('user_id').references(() => user.id),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('audit_table_record_idx').on(table.tableName, table.recordId),
    index('audit_company_idx').on(table.companyId),
    index('audit_created_idx').on(table.createdAt),
  ]
);
