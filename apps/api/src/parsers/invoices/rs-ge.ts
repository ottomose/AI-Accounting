import * as XLSX from 'xlsx';
import type { ParsedInvoice, ParsedInvoiceRegistry, InvoiceDirection } from './types';

// RS.ge invoice registry header signals (Georgian)
const RS_GE_HEADER_SIGNALS = ['საქონელი', 'ღირებულება', 'მყიდველი', 'გამყიდველი'];

const COL_ALIASES = {
  description: ['საქონელი', 'მომსახურება'],
  unit: ['ზომის', 'ერთეული'],
  quantity: ['რაოდ'],
  total: ['ღირებულება', 'დღგ'],
  taxation: ['დაბეგვრა'],
  vat: ['დღგ'],
  excise: ['აქციზი'],
  id: ['ID'],
  series: ['სერია'],
  buyer: ['მყიდველი'],
  seller: ['გამყიდველი'],
  issueDate: ['გამოწერის'],
  operationDate: ['ოპერაციის'],
  note: ['შენიშვნა'],
};

function looksLikeRsGeHeader(row: unknown[]): boolean {
  const joined = row.map((c) => String(c ?? '')).join('|');
  const matches = RS_GE_HEADER_SIGNALS.filter((k) => joined.includes(k)).length;
  return matches >= 3;
}

function findColumnIndexes(headerRow: unknown[]): Record<string, number> {
  const result: Record<string, number> = {};
  const normalized = headerRow.map((c) => String(c ?? '').trim());

  // Match headers in order — "დღგ" appears both in total ("ღირებულება დღგ-ს ჩათვლით") and its own col
  normalized.forEach((cell, idx) => {
    const lower = cell;
    if (result.description === undefined && lower.includes('საქონელი')) result.description = idx;
    else if (result.unit === undefined && lower.includes('ზომის')) result.unit = idx;
    else if (result.quantity === undefined && (lower.includes('რაოდ') || lower === 'რაოდ.')) result.quantity = idx;
    else if (result.total === undefined && lower.includes('ღირებულება')) result.total = idx;
    else if (result.taxation === undefined && lower.includes('დაბეგვრა')) result.taxation = idx;
    else if (result.vat === undefined && lower.trim() === 'დღგ') result.vat = idx;
    else if (result.excise === undefined && lower.includes('აქციზი')) result.excise = idx;
    else if (result.id === undefined && (lower === 'ID' || lower.trim() === 'ID')) result.id = idx;
    else if (result.series === undefined && lower.includes('სერია')) result.series = idx;
    else if (result.buyer === undefined && lower.includes('მყიდველი')) result.buyer = idx;
    else if (result.seller === undefined && lower.includes('გამყიდველი')) result.seller = idx;
    else if (result.issueDate === undefined && lower.includes('გამოწერის')) result.issueDate = idx;
    else if (result.operationDate === undefined && lower.includes('ოპერაციის')) result.operationDate = idx;
    else if (result.note === undefined && lower.includes('შენიშვნა')) result.note = idx;
  });

  return result;
}

function parseDate(val: unknown): string | undefined {
  if (val == null || val === '') return undefined;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  // DD/MM/YYYY [HH:MM:SS]
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}

function parseAmount(val: unknown): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\s/g, '').replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Extracts tax code from "(404751531-დღგ) შპს დიემჯი დეველოპმენტი" → { taxCode: "404751531", name: "შპს დიემჯი დეველოპმენტი" }
function parseCounterparty(val: unknown): { taxCode?: string; name?: string } {
  if (!val) return {};
  const s = String(val).trim();
  const m = s.match(/^\((\d+)(?:-[^)]+)?\)\s*(.+)$/);
  if (m) return { taxCode: m[1], name: m[2].trim() };
  return { name: s || undefined };
}

export function isRsGeInvoiceRegistry(buffer: Buffer): boolean {
  try {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: '',
      });
      for (let i = 0; i < Math.min(20, rows.length); i++) {
        if (looksLikeRsGeHeader(rows[i] ?? [])) return true;
      }
    }
  } catch {
    // fall through
  }
  return false;
}

export function parseRsGeInvoices(
  buffer: Buffer,
  companyTaxId?: string
): ParsedInvoiceRegistry {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  let rows: unknown[][] = [];
  let headerIdx = -1;
  for (const sheetName of wb.SheetNames) {
    const candidate = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
    });
    for (let i = 0; i < Math.min(20, candidate.length); i++) {
      if (looksLikeRsGeHeader(candidate[i] ?? [])) {
        headerIdx = i;
        rows = candidate;
        break;
      }
    }
    if (headerIdx !== -1) break;
  }
  if (headerIdx === -1) {
    throw new Error('RS.ge: header row not found');
  }

  const headerRow = rows[headerIdx] ?? [];
  const cols = findColumnIndexes(headerRow);

  const invoices: ParsedInvoice[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const idVal = String(row[cols.id ?? -1] ?? '').trim();
    if (!idVal) continue; // skip empty rows

    const buyer = parseCounterparty(row[cols.buyer ?? -1]);
    const seller = parseCounterparty(row[cols.seller ?? -1]);

    let direction: InvoiceDirection = 'unknown';
    if (companyTaxId) {
      if (seller.taxCode === companyTaxId) direction = 'sale';
      else if (buyer.taxCode === companyTaxId) direction = 'purchase';
    }

    invoices.push({
      invoiceId: idVal,
      series: String(row[cols.series ?? -1] ?? '').trim() || undefined,
      issueDate: parseDate(row[cols.issueDate ?? -1]),
      operationDate: parseDate(row[cols.operationDate ?? -1]),
      description: String(row[cols.description ?? -1] ?? '').trim(),
      unit: String(row[cols.unit ?? -1] ?? '').trim() || undefined,
      quantity: (() => {
        const q = row[cols.quantity ?? -1];
        return q != null && q !== '' ? parseAmount(q) : undefined;
      })(),
      totalAmount: parseAmount(row[cols.total ?? -1]),
      taxationType: String(row[cols.taxation ?? -1] ?? '').trim() || undefined,
      vat: parseAmount(row[cols.vat ?? -1]),
      excise: cols.excise != null ? parseAmount(row[cols.excise]) : undefined,
      buyerTaxCode: buyer.taxCode,
      buyerName: buyer.name,
      sellerTaxCode: seller.taxCode,
      sellerName: seller.name,
      note: String(row[cols.note ?? -1] ?? '').trim() || undefined,
      direction,
    });
  }

  return { invoices };
}
