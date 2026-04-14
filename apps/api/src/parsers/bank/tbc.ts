import * as XLSX from 'xlsx';
import type { ParsedStatement, ParsedTransaction } from './types';

// TBC XLSX export columns (English row, used as canonical keys)
const TBC_COLUMNS = [
  'Date',
  'Description',
  'Additional Information',
  'Paid Out',
  'Paid In',
  'Balance',
  'Type',
  'Document Date',
  'Document Number',
  "Partner's Account",
  "Partner's Name",
  "Partner's Tax Code",
  "Partner's Bank Code",
  "Partner's Bank",
  'Intermediary Bank Code',
  'Intermediary Bank',
  'Charge Details',
  'Taxpayer Code',
  'Taxpayer Name',
  'Treasury Code',
  'Op. Code',
  'Additional Description',
  'Transaction ID',
];

const TBC_GEORGIAN_HEADER_SIGNAL = ['თარიღი', 'დანიშნულება', 'გასული თანხა', 'შემოსული თანხა'];

export function isTbcStatement(rows: unknown[][]): boolean {
  // Check any of the first 10 rows for the Georgian header signal
  const scanLimit = Math.min(10, rows.length);
  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    if (!row) continue;
    const joined = row.map((c) => String(c ?? '')).join('|');
    if (TBC_GEORGIAN_HEADER_SIGNAL.every((k) => joined.includes(k))) return true;
  }
  return false;
}

function parseGeorgianDate(val: unknown): string | undefined {
  if (val == null || val === '') return undefined;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}

function parseAmount(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\s/g, '').replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export function parseTbcXlsx(buffer: Buffer): ParsedStatement {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });

  // Locate header row: row that matches Georgian signal; English row is next
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const joined = (rows[i] ?? []).map((c) => String(c ?? '')).join('|');
    if (TBC_GEORGIAN_HEADER_SIGNAL.every((k) => joined.includes(k))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('TBC: header row not found');
  }

  // Data starts 2 rows after Georgian header (skip English header)
  const dataStartIdx = headerIdx + 2;

  const transactions: ParsedTransaction[] = [];
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;
  let periodStart: string | undefined;
  let periodEnd: string | undefined;

  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const date = parseGeorgianDate(row[0]);
    if (!date) continue; // skip blank/summary rows

    const paidOut = parseAmount(row[3]);
    const paidIn = parseAmount(row[4]);
    const balance = parseAmount(row[5]);

    if (paidOut == null && paidIn == null) continue;

    const direction: 'in' | 'out' = (paidIn ?? 0) > 0 ? 'in' : 'out';
    const amount = direction === 'in' ? (paidIn ?? 0) : (paidOut ?? 0);

    if (openingBalance === undefined && balance !== undefined) {
      // Opening balance = balance - net effect of first tx
      const net = direction === 'in' ? amount : -amount;
      openingBalance = balance - net;
    }
    closingBalance = balance ?? closingBalance;
    periodStart = periodStart ?? date;
    periodEnd = date;

    const raw: Record<string, unknown> = {};
    TBC_COLUMNS.forEach((key, idx) => {
      raw[key] = row[idx] ?? null;
    });

    transactions.push({
      date,
      description: String(row[1] ?? '').trim(),
      additionalInfo: String(row[2] ?? '').trim() || undefined,
      amount,
      direction,
      balance,
      currency: 'GEL',
      bankTransactionType: String(row[6] ?? '').trim() || undefined,
      documentDate: parseGeorgianDate(row[7]),
      documentNumber: String(row[8] ?? '').trim() || undefined,
      partnerAccount: String(row[9] ?? '').trim() || undefined,
      partnerName: String(row[10] ?? '').trim() || undefined,
      partnerTaxCode: String(row[11] ?? '').trim() || undefined,
      partnerBankCode: String(row[12] ?? '').trim() || undefined,
      partnerBank: String(row[13] ?? '').trim() || undefined,
      opCode: String(row[20] ?? '').trim() || undefined,
      transactionId: String(row[22] ?? '').trim() || undefined,
      raw,
    });
  }

  return {
    bank: 'TBC',
    currency: 'GEL',
    periodStart,
    periodEnd,
    openingBalance,
    closingBalance,
    transactions,
  };
}
