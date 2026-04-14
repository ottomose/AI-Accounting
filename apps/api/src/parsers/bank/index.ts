import * as XLSX from 'xlsx';
import type { BankId, ParsedStatement } from './types';
import { isTbcStatement, parseTbcXlsx } from './tbc';

export type { ParsedStatement, ParsedTransaction, BankId } from './types';

export function detectBank(buffer: Buffer): BankId {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      // Debug: log first 3 rows of each sheet
      console.log(`[detectBank] sheet="${sheetName}" rows=${rows.length}`);
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        console.log(`[detectBank]   row[${i}]:`, (rows[i] ?? []).slice(0, 6).map((c) => String(c ?? '').slice(0, 30)).join(' | '));
      }
      if (isTbcStatement(rows)) return 'TBC';
    }
    return 'UNKNOWN';
  } catch (err) {
    console.error('[detectBank] error:', err);
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
