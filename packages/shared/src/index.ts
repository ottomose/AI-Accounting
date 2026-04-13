// Shared types and utilities for AI Accounting

export interface Company {
  id: string;
  name: string;
  taxId: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  debitAccount: string;
  creditAccount: string;
}

export interface Account {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
}
