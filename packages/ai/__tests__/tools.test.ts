import { describe, it, expect } from 'vitest';
import {
  tools,
  getToolByName,
  getToolsByCategory,
  createJournalEntryParams,
  categorizeTransactionParams,
  flagForReviewParams,
  processDocumentParams,
} from '../src/tools';
import { ToolCategory } from '../src/types';

describe('Tool Definitions', () => {
  it('should have exactly 10 tools defined', () => {
    expect(tools).toHaveLength(10);
  });

  it('should have unique tool names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should have all required fields for each tool', () => {
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.descriptionKa).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.parameters).toBeTruthy();
      expect(tool.parametersJsonSchema).toBeTruthy();
    }
  });

  it('should have valid JSON schemas with type "object"', () => {
    for (const tool of tools) {
      const schema = tool.parametersJsonSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toBeDefined();
    }
  });

  it('should find tool by name', () => {
    const tool = getToolByName('create_journal_entry');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('create_journal_entry');
  });

  it('should return undefined for unknown tool', () => {
    expect(getToolByName('nonexistent')).toBeUndefined();
  });

  it('should filter tools by category', () => {
    const journalTools = getToolsByCategory(ToolCategory.JOURNAL);
    expect(journalTools.length).toBeGreaterThan(0);
    for (const tool of journalTools) {
      expect(tool.category).toBe(ToolCategory.JOURNAL);
    }
  });

  it('should have Georgian descriptions for all tools', () => {
    for (const tool of tools) {
      // Georgian unicode range: U+10A0 to U+10FF
      expect(tool.descriptionKa).toMatch(/[\u10A0-\u10FF]/);
    }
  });
});

describe('Zod Schema Validation', () => {
  it('should validate create_journal_entry params', () => {
    const valid = createJournalEntryParams.safeParse({
      date: '2026-04-13',
      description: 'Test entry',
      lines: [
        { accountId: '550e8400-e29b-41d4-a716-446655440000', debit: 100, credit: 0 },
        { accountId: '550e8400-e29b-41d4-a716-446655440001', debit: 0, credit: 100 },
      ],
    });
    expect(valid.success).toBe(true);
  });

  it('should reject journal entry with less than 2 lines', () => {
    const invalid = createJournalEntryParams.safeParse({
      date: '2026-04-13',
      description: 'Test',
      lines: [{ accountId: '550e8400-e29b-41d4-a716-446655440000', debit: 100, credit: 0 }],
    });
    expect(invalid.success).toBe(false);
  });

  it('should reject invalid UUID in accountId', () => {
    const invalid = createJournalEntryParams.safeParse({
      date: '2026-04-13',
      description: 'Test',
      lines: [
        { accountId: 'not-a-uuid', debit: 100, credit: 0 },
        { accountId: 'also-not-uuid', debit: 0, credit: 100 },
      ],
    });
    expect(invalid.success).toBe(false);
  });

  it('should validate categorize_transaction params', () => {
    const valid = categorizeTransactionParams.safeParse({
      description: 'Office rent payment',
      amount: 1500,
      counterpartyName: 'Landlord LLC',
    });
    expect(valid.success).toBe(true);
  });

  it('should validate flag_for_review params', () => {
    const valid = flagForReviewParams.safeParse({
      reason: 'Unusual amount',
      priority: 'high',
      relatedEntityId: '550e8400-e29b-41d4-a716-446655440000',
      relatedEntityType: 'journal_entry',
    });
    expect(valid.success).toBe(true);
  });

  it('should reject invalid priority', () => {
    const invalid = flagForReviewParams.safeParse({
      reason: 'Test',
      priority: 'urgent',
      relatedEntityId: '550e8400-e29b-41d4-a716-446655440000',
      relatedEntityType: 'journal_entry',
    });
    expect(invalid.success).toBe(false);
  });

  it('should validate process_document params', () => {
    const valid = processDocumentParams.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      documentType: 'invoice',
    });
    expect(valid.success).toBe(true);
  });
});
