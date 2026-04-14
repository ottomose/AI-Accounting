import type { ParsedTransaction } from './types';

export interface Suggestion {
  debitAccountCode: string;
  creditAccountCode: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  needsReview: boolean;
}

// Bank cash account (GEL) — BASS 1210: ეროვნული ვალუტა რეზიდენტ ბანკებში
const CASH_GEL = '1210';

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
      debitAccountCode: '7490', // სხვა საერთო ხარჯები (საბანკო საკომისიო)
      creditAccountCode: CASH_GEL,
      confidence: 'high',
      reason: 'საბანკო საკომისიო',
      needsReview: false,
    };
  }

  // === Tax payments (GIT + treasury account) ===
  if (opCode === 'GIT' || desc.includes('გადასახადების ერთიანი კოდი')) {
    return {
      debitAccountCode: '3390', // სხვა საგადასახადო ვალდებულებები (default — user picks 3310/3320/3330)
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'გადასახადების ერთიანი კოდი — ბიუჯეტში გადარიცხვა (დააზუსტე რომელი გადასახადი)',
      needsReview: true,
    };
  }

  // === Incoming customer payment (GIB) ===
  if (opCode === 'GIB' && tx.direction === 'in') {
    return {
      debitAccountCode: CASH_GEL,
      creditAccountCode: '1410', // მოთხოვნები მიწოდებიდან და მომსახურებიდან
      confidence: 'high',
      reason: `კლიენტისგან შემოსული თანხა${tx.partnerName ? ` (${tx.partnerName})` : ''}`,
      needsReview: false,
    };
  }

  // === Outgoing transfer (GMN/GMB) ===
  if ((opCode === 'GMN' || opCode === 'GMB') && tx.direction === 'out') {
    const looksLikeIndividual =
      tx.partnerTaxCode && /^\d{11}$/.test(tx.partnerTaxCode);
    if (looksLikeIndividual) {
      return {
        debitAccountCode: '1430', // მოთხოვნები საწარმოს პერსონალის მიმართ (ავანსი)
        creditAccountCode: CASH_GEL,
        confidence: 'low',
        reason: `ფიზ. პირზე გადარიცხვა (${tx.partnerName}) — შეიძლება იყოს ავანსი, ხელფასი ან მესაკუთრის გატანა`,
        needsReview: true,
      };
    }
    return {
      debitAccountCode: '3110', // მოწოდებიდან წარმოქმნილი ვალდებულებები
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: `მომწოდებელზე გადარიცხვა${tx.partnerName ? ` (${tx.partnerName})` : ''}`,
      needsReview: true,
    };
  }

  // === Parking / fines (*MBS*) ===
  if (opCode === '*MBS*' || desc.includes('fine') || desc.includes('parking') || desc.includes('ჯარიმ')) {
    return {
      debitAccountCode: '7490', // სხვა საერთო ხარჯები
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'ჯარიმა / პარკინგი',
      needsReview: true,
    };
  }

  // === Utilities ===
  if (bankType.includes('კომუნალური') || desc.includes('კომუნალ') || desc.includes('ელექტრო') || desc.includes('წყალი') || desc.includes('გაზი')) {
    return {
      debitAccountCode: '7430', // კომუნიკაციის ხარჯები (ან 7490)
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'კომუნალური/კომუნიკაცია',
      needsReview: true,
    };
  }

  // === Salary ===
  if (desc.includes('ხელფას') || desc.includes('salary') || addInfo.includes('ხელფას')) {
    return {
      debitAccountCode: '3130', // გადასახდელი ხელფასი
      creditAccountCode: CASH_GEL,
      confidence: 'medium',
      reason: 'ხელფასის გადახდა',
      needsReview: true,
    };
  }

  // Nothing matched — AI fallback
  return null;
}
