export type InvoiceDirection = 'sale' | 'purchase' | 'unknown';

export interface ParsedInvoice {
  invoiceId: string; // RS.ge ID — unique, used as source_ref
  series?: string;
  issueDate?: string; // ISO
  operationDate?: string; // ISO — used as journal entry date
  description: string;
  unit?: string;
  quantity?: number;
  totalAmount: number; // includes VAT + excise
  taxationType?: string; // "ჩვეულებრივი" | "საცალო" | ...
  vat: number;
  excise?: number;
  buyerTaxCode?: string;
  buyerName?: string;
  sellerTaxCode?: string;
  sellerName?: string;
  note?: string;
  direction: InvoiceDirection; // computed based on company taxId
  raw?: Record<string, unknown>;
}

export interface ParsedInvoiceRegistry {
  invoices: ParsedInvoice[];
}

export interface InvoiceSuggestion {
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  needsReview: boolean;
}
