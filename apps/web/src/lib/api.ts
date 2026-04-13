const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Companies
export const getCompanies = () => request<{ companies: Company[] }>('/api/companies');
export const createCompany = (name: string, taxId: string) =>
  request<{ company: Company }>('/api/companies', {
    method: 'POST',
    body: JSON.stringify({ name, taxId }),
  });

// Accounts
export const getAccounts = (companyId: string) =>
  request<{ accounts: Account[] }>(`/api/accounts?companyId=${companyId}`);

// Journal Entries
export const getJournalEntries = (companyId: string) =>
  request<{ entries: JournalEntry[] }>(`/api/journal-entries?companyId=${companyId}`);

export const createJournalEntry = (data: CreateJournalEntryData) =>
  request<{ entry: JournalEntry }>('/api/journal-entries', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const postJournalEntry = (id: string) =>
  request<{ entry: JournalEntry }>(`/api/journal-entries/${id}/post`, { method: 'POST' });

// Trial Balance
export const getTrialBalance = (companyId: string) =>
  request<TrialBalanceResponse>(`/api/trial-balance?companyId=${companyId}`);

// Chat
export const sendChatMessage = (messages: ChatMessage[], companyId: string) =>
  request<{ reply: string; toolResults: ToolResult[] }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, companyId }),
  });

// Documents
export const getDocuments = (companyId: string) =>
  request<{ documents: Document[] }>(`/api/documents?companyId=${companyId}`);

export const getUploadUrl = (fileName: string, contentType: string, companyId: string) =>
  request<{ uploadUrl: string; document: Document }>('/api/documents/upload-url', {
    method: 'POST',
    body: JSON.stringify({ fileName, contentType, companyId }),
  });

export const processDocument = (id: string, documentType: string) =>
  request<{ documentId: string; extracted: unknown; rawText: string }>(
    `/api/documents/${id}/process`,
    { method: 'POST', body: JSON.stringify({ documentType }) }
  );

// Types
export interface Company {
  id: string;
  name: string;
  taxId: string;
  baseCurrency: string;
  ownerId: string;
  createdAt: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  nameKa: string;
  type: string;
  level: number;
  isGroup: boolean;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: string;
  currency: string;
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: string;
  credit: string;
  description?: string;
}

export interface CreateJournalEntryData {
  date: string;
  description: string;
  currency: string;
  companyId: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolResult {
  tool: string;
  result: unknown;
}

export interface Document {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  companyId: string;
  createdAt: string;
}

export interface TrialBalanceResponse {
  accounts: Array<{
    code: string;
    name: string;
    nameKa: string;
    type: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}
