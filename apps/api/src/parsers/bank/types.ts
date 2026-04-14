export type BankId = 'TBC' | 'BOG' | 'LIBERTY' | 'CREDO' | 'UNKNOWN';

export interface ParsedTransaction {
  date: string; // ISO YYYY-MM-DD
  description: string;
  additionalInfo?: string;
  amount: number; // always positive
  direction: 'in' | 'out'; // in = money received, out = money paid
  balance?: number;
  currency?: string;
  bankTransactionType?: string; // bank's own category label
  documentDate?: string;
  documentNumber?: string;
  partnerAccount?: string;
  partnerName?: string;
  partnerTaxCode?: string;
  partnerBankCode?: string;
  partnerBank?: string;
  opCode?: string; // TBC op codes: GIT, GIB, GMN, GMB, SMSC, *SBC*, *MBS*, MBSFE
  transactionId?: string;
  raw?: Record<string, unknown>;
}

export interface ParsedStatement {
  bank: BankId;
  accountNumber?: string;
  accountHolder?: string;
  taxCode?: string;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  transactions: ParsedTransaction[];
}
