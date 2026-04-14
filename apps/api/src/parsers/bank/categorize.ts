import type { ParsedTransaction } from './types';

export interface Suggestion {
  debitAccountCode: string;
  creditAccountCode: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  needsReview: boolean;
}

// Bank cash account (GEL). TODO: resolve by currency/bank
const CASH_GEL = '1232';

// Rule-based categorization for known TBC patterns.
// Returns null if no confident match — caller should fall back to AI.
export function ruleCategorize(tx: ParsedTransaction): Suggestion | null {
  const desc = (tx.description || '').toLowerCase();
  const partnerName = (tx.partnerName || '').toLowerCase();
  const addInfo = (tx.additionalInfo || '').toLowerCase();
  const opCode = tx.opCode || '';
  const bankType = (tx.bankTransactionType || '').toLowerCase();

  // === Bank fees (always CREDIT cash, DEBIT 533) ===
  const isFee =
    opCode === 'SMSC' ||
    opCode === '*SBC*' ||
    opCode === 'MBSFE' ||
    desc.includes('საკომისიო') ||
    desc.includes('sms მომსახურების') ||
    partnerName.includes('დებიტორები - sms') ||
    partnerName.includes('საკომისიო შემოსავალი');

  if (isFee && tx.direction === 'out') {
    return {
      debitAccountCode: '533', // Bank Fees
      creditAccountCode: CASH_GEL,
      confidence: 'high',
      reason: 'საბანკო საკომისიო (აღმოჩენილია აღწერილობიდან/op code-დან)',
      needsReview: false,
    };
  }

  // === Tax payments (GIT + treasury account) ===
  if (opCode === 'GIT' || desc.includes('გადასახადების ერთიანი კოდი')) {
    return {
      debitAccountCode: '223', // Income Tax Payable (default — user can refine)
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'გადასახადების ერთიანი კოდი — ბიუჯეტში გადარიცხვა',
      needsReview: true, // user should pick the exact tax type (223/224/etc.)
    };
  }

  // === Incoming customer payment (GIB) ===
  if (opCode === 'GIB' && tx.direction === 'in') {
    return {
      debitAccountCode: CASH_GEL,
      creditAccountCode: '1221', // Accounts Receivable
      confidence: 'high',
      reason: `კლიენტისგან შემოსული თანხა${tx.partnerName ? ` (${tx.partnerName})` : ''}`,
      needsReview: false,
    };
  }

  // === Outgoing transfer to supplier (GMN/GMB) ===
  if ((opCode === 'GMN' || opCode === 'GMB') && tx.direction === 'out') {
    // Check if partner is an individual (likely employee advance or owner draw)
    const looksLikeIndividual =
      tx.partnerTaxCode && /^\d{11}$/.test(tx.partnerTaxCode); // 11-digit personal ID
    if (looksLikeIndividual) {
      return {
        debitAccountCode: '1221', // Treat as advance to individual (needs review)
        creditAccountCode: CASH_GEL,
        confidence: 'low',
        reason: `ფიზ. პირზე გადარიცხვა (${tx.partnerName}) — შეიძლება იყოს ავანსი, ხელფასი ან მესაკუთრის გატანა`,
        needsReview: true,
      };
    }
    return {
      debitAccountCode: '221', // Accounts Payable (supplier)
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: `მომწოდებელზე გადარიცხვა${tx.partnerName ? ` (${tx.partnerName})` : ''}`,
      needsReview: true,
    };
  }

  // === Parking / fines (*MBS*) ===
  if (opCode === '*MBS*' || desc.includes('fine') || desc.includes('parking') || desc.includes('ჯარიმ')) {
    return {
      debitAccountCode: '529', // Other Operating Expenses
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'ჯარიმა / პარკინგი',
      needsReview: true,
    };
  }

  // === Utilities ===
  if (bankType.includes('კომუნალური') || desc.includes('კომუნალ') || desc.includes('ელექტრო') || desc.includes('წყალი') || desc.includes('გაზი')) {
    return {
      debitAccountCode: '523',
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'კომუნალური ხარჯი',
      needsReview: true,
    };
  }

  // === Salary ===
  if (desc.includes('ხელფას') || desc.includes('salary') || addInfo.includes('ხელფას')) {
    return {
      debitAccountCode: '521',
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'ხელფასის გადახდა',
      needsReview: true,
    };
  }

  // Nothing matched — AI fallback
  return null;
}
