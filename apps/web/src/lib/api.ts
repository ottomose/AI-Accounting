const API_URL =
  (typeof window !== 'undefined' && (window as any).__API_URL__) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options?.headers },
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
export const seedCompanyAccounts = (companyId: string, force = false) =>
  request<{ success: boolean; seeded: number; forced: boolean }>(
    `/api/companies/${companyId}/seed-accounts${force ? '?force=true' : ''}`,
    { method: 'POST' }
  );

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

export const updateJournalEntry = (id: string, data: Partial<CreateJournalEntryData>) =>
  request<{ success: boolean }>(`/api/journal-entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteJournalEntry = (id: string) =>
  request<{ success: boolean }>(`/api/journal-entries/${id}`, { method: 'DELETE' });

export const voidJournalEntry = (id: string) =>
  request<{ entry: JournalEntry }>(`/api/journal-entries/${id}/void`, { method: 'POST' });

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

// Proxy upload — sends file through API to R2 (avoids CORS issues)
export async function uploadDocument(file: File, companyId: string): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);

  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }

  const data = await res.json();
  return data.document;
}

export const getDocumentDownloadUrl = (id: string) =>
  request<{ downloadUrl: string }>(`/api/documents/${id}/download`);

export const deleteDocument = (id: string) =>
  request<{ success: boolean }>(`/api/documents/${id}`, { method: 'DELETE' });

export const parseStatement = (id: string) =>
  request<{ documentId: string; statement: ParsedStatement }>(
    `/api/documents/${id}/parse-statement`,
    { method: 'POST' }
  );

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
  exchangeRate?: string;
  createdAt?: string;
  postedAt?: string;
  totalDebit?: string;
  totalCredit?: string;
  lineCount?: number;
  lines?: JournalLine[];
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  accountNameKa?: string;
  debit: string | number;
  credit: string | number;
  description?: string;
}

export interface CreateJournalEntryData {
  date: string;
  description: string;
  currency: string;
  companyId: string;
  sourceRef?: string;
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

export interface ParsedTransaction {
  date: string;
  description: string;
  additionalInfo?: string;
  amount: number;
  direction: 'in' | 'out';
  balance?: number;
  currency?: string;
  bankTransactionType?: string;
  partnerName?: string;
  partnerTaxCode?: string;
  opCode?: string;
  transactionId?: string;
  alreadyPosted?: boolean;
  suggestion: {
    debitAccountCode: string;
    creditAccountCode: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    needsReview: boolean;
  } | null;
}

export interface ParsedStatement {
  bank: string;
  accountNumber?: string;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  transactions: ParsedTransaction[];
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
