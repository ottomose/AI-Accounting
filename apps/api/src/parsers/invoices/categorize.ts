import type { ParsedInvoice, InvoiceSuggestion } from './types';

// Account codes (BASS)
const AR = '1410'; // მოთხოვნები მიწოდებიდან
const AP = '3110'; // მომწოდებლები
const REVENUE = '6110'; // შემოსავალი რეალიზაციიდან
const VAT_ACCOUNT = '3330'; // დღგ (payable credit / recoverable debit — netted at period end)
const DEFAULT_EXPENSE = '7490'; // სხვა ადმ. ხარჯი (fallback)

export function categorizeInvoice(inv: ParsedInvoice): InvoiceSuggestion | null {
  const total = inv.totalAmount;
  const vat = inv.vat || 0;
  const net = total - vat;

  if (total <= 0) return null;

  // === SALE (we are seller) ===
  if (inv.direction === 'sale') {
    const lines = [
      { accountCode: AR, debit: total, credit: 0, description: inv.description },
      { accountCode: REVENUE, debit: 0, credit: net, description: inv.description },
    ];
    if (vat > 0) {
      lines.push({ accountCode: VAT_ACCOUNT, debit: 0, credit: vat, description: 'დღგ გადასახდელი' });
    }
    return {
      lines,
      confidence: 'high',
      reason: `გაყიდვა — ${inv.buyerName || 'კლიენტი'}`,
      needsReview: false,
    };
  }

  // === PURCHASE (we are buyer) ===
  if (inv.direction === 'purchase') {
    const expenseCode = guessExpenseAccount(inv.description);
    const lines = [
      { accountCode: expenseCode.code, debit: net, credit: 0, description: inv.description },
    ];
    if (vat > 0) {
      lines.push({ accountCode: VAT_ACCOUNT, debit: vat, credit: 0, description: 'დღგ ჩასათვლელი' });
    }
    lines.push({ accountCode: AP, debit: 0, credit: total, description: inv.description });
    return {
      lines,
      confidence: expenseCode.confidence,
      reason: `შესყიდვა — ${inv.sellerName || 'მომწოდებელი'} · ${expenseCode.reason}`,
      needsReview: expenseCode.confidence !== 'high',
    };
  }

  return null;
}

function guessExpenseAccount(description: string): {
  code: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  const d = description.toLowerCase();

  if (/იჯარ|ქირა|rent/.test(d)) return { code: '7420', confidence: 'high', reason: 'იჯარა' };
  if (/რეკლამ|advertisement|marketing/.test(d)) return { code: '7310', confidence: 'high', reason: 'რეკლამა' };
  if (/ტრანსპორტ|გადაზიდვ|transport|logistics/.test(d))
    return { code: '7340', confidence: 'high', reason: 'ტრანსპორტი' };
  if (/კომუნიკაც|ინტერნეტ|ტელეფონ|mobile|internet/.test(d))
    return { code: '7430', confidence: 'high', reason: 'კომუნიკაცია' };
  if (/საოფისე|კანცელარია|office|stationery/.test(d))
    return { code: '7425', confidence: 'high', reason: 'საოფისე' };
  if (/საკონსულტაც|იურიდიულ|consult|legal/.test(d))
    return { code: '7450', confidence: 'high', reason: 'საკონსულტაციო' };
  if (/რემონტ|repair|maintenance/.test(d))
    return { code: '7440', confidence: 'high', reason: 'რემონტი' };
  if (/კომპიუტერ|software|license|ლიცენზი/.test(d))
    return { code: '7445', confidence: 'high', reason: 'IT/პროგრამული' };
  if (/დაზღვევ|insurance/.test(d))
    return { code: '7435', confidence: 'high', reason: 'დაზღვევა' };
  if (/ნედლეულ|მასალ|raw material/.test(d))
    return { code: '1620', confidence: 'medium', reason: 'ნედლეული (მატერიალური აქტივი)' };
  if (/საქონლ|goods|merchandise/.test(d))
    return { code: '1610', confidence: 'medium', reason: 'საქონელი' };

  return { code: DEFAULT_EXPENSE, confidence: 'low', reason: 'default — დააზუსტე ხარჯის ანგარიში' };
}
