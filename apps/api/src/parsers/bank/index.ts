import * as XLSX from 'xlsx';
import type { BankId, ParsedStatement } from './types';
import { isTbcStatement, parseTbcXlsx } from './tbc';

export type { ParsedStatement, ParsedTransaction, BankId } from './types';

export function detectBank(buffer: Buffer): BankId {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (isTbcStatement(rows)) return 'TBC';
    // TODO: BOG, Liberty, Credo detection
    return 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

export function parseStatement(buffer: Buffer, mimeType: string): ParsedStatement {
  if (!isXlsxLike(mimeType)) {
    throw new Error(`Unsupported statement format: ${mimeType}. Only XLSX/XLS supported for now.`);
  }
  const bank = detectBank(buffer);
  switch (bank) {
    case 'TBC':
      return parseTbcXlsx(buffer);
    default:
      throw new Error('ვერ მოხერხდა ბანკის ავტომატური დეტექცია. მხოლოდ TBC-ის ფორმატი მუშაობს ამჟამად.');
  }
}

function isXlsxLike(mime: string): boolean {
  return (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  );
}
