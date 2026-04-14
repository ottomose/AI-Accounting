import 'dotenv/config';
import { Client } from 'pg';

// ბასს ანგარიშთა გეგმა — იერარქიული სტრუქტურა
const chartOfAccounts = [
  // ==================== 1. აქტივები ====================
  { code: '1', name: 'Assets', nameKa: 'აქტივები', type: 'asset', level: 1, isGroup: true, parentCode: null },

  // 1.1 გრძელვადიანი აქტივები
  { code: '11', name: 'Non-current Assets', nameKa: 'გრძელვადიანი აქტივები', type: 'asset', level: 2, isGroup: true, parentCode: '1' },
  { code: '111', name: 'Property, Plant & Equipment', nameKa: 'ძირითადი საშუალებები', type: 'asset', level: 3, isGroup: true, parentCode: '11' },
  { code: '1111', name: 'Land', nameKa: 'მიწა', type: 'asset', level: 4, isGroup: false, parentCode: '111' },
  { code: '1112', name: 'Buildings', nameKa: 'შენობა-ნაგებობები', type: 'asset', level: 4, isGroup: false, parentCode: '111' },
  { code: '1113', name: 'Machinery & Equipment', nameKa: 'მანქანა-დანადგარები', type: 'asset', level: 4, isGroup: false, parentCode: '111' },
  { code: '1114', name: 'Vehicles', nameKa: 'სატრანსპორტო საშუალებები', type: 'asset', level: 4, isGroup: false, parentCode: '111' },
  { code: '1115', name: 'Office Equipment', nameKa: 'საოფისე ინვენტარი', type: 'asset', level: 4, isGroup: false, parentCode: '111' },
  { code: '1116', name: 'Accumulated Depreciation', nameKa: 'ცვეთა (დაგროვილი)', type: 'asset', level: 4, isGroup: false, parentCode: '111' },

  { code: '112', name: 'Intangible Assets', nameKa: 'არამატერიალური აქტივები', type: 'asset', level: 3, isGroup: true, parentCode: '11' },
  { code: '1121', name: 'Software', nameKa: 'პროგრამული უზრუნველყოფა', type: 'asset', level: 4, isGroup: false, parentCode: '112' },
  { code: '1122', name: 'Licenses & Patents', nameKa: 'ლიცენზიები და პატენტები', type: 'asset', level: 4, isGroup: false, parentCode: '112' },
  { code: '1123', name: 'Goodwill', nameKa: 'გუდვილი', type: 'asset', level: 4, isGroup: false, parentCode: '112' },

  { code: '113', name: 'Long-term Investments', nameKa: 'გრძელვადიანი ინვესტიციები', type: 'asset', level: 3, isGroup: false, parentCode: '11' },

  // 1.2 მიმდინარე აქტივები
  { code: '12', name: 'Current Assets', nameKa: 'მიმდინარე აქტივები', type: 'asset', level: 2, isGroup: true, parentCode: '1' },
  { code: '121', name: 'Inventory', nameKa: 'სასაქონლო-მატერიალური მარაგები', type: 'asset', level: 3, isGroup: true, parentCode: '12' },
  { code: '1211', name: 'Raw Materials', nameKa: 'ნედლეული', type: 'asset', level: 4, isGroup: false, parentCode: '121' },
  { code: '1212', name: 'Finished Goods', nameKa: 'მზა პროდუქცია', type: 'asset', level: 4, isGroup: false, parentCode: '121' },
  { code: '1213', name: 'Merchandise', nameKa: 'საქონელი', type: 'asset', level: 4, isGroup: false, parentCode: '121' },

  { code: '122', name: 'Trade Receivables', nameKa: 'მოთხოვნები (დებიტორები)', type: 'asset', level: 3, isGroup: true, parentCode: '12' },
  { code: '1221', name: 'Accounts Receivable', nameKa: 'სავაჭრო მოთხოვნები', type: 'asset', level: 4, isGroup: false, parentCode: '122' },
  { code: '1222', name: 'Notes Receivable', nameKa: 'მისაღები თამასუქები', type: 'asset', level: 4, isGroup: false, parentCode: '122' },
  { code: '1223', name: 'Allowance for Doubtful Accounts', nameKa: 'საეჭვო მოთხოვნების რეზერვი', type: 'asset', level: 4, isGroup: false, parentCode: '122' },

  { code: '123', name: 'Cash & Cash Equivalents', nameKa: 'ფულადი სახსრები', type: 'asset', level: 3, isGroup: true, parentCode: '12' },
  { code: '1231', name: 'Cash on Hand', nameKa: 'სალარო', type: 'asset', level: 4, isGroup: false, parentCode: '123' },
  { code: '1232', name: 'Bank Accounts (GEL)', nameKa: 'საბანკო ანგარიში (GEL)', type: 'asset', level: 4, isGroup: false, parentCode: '123' },
  { code: '1233', name: 'Bank Accounts (USD)', nameKa: 'საბანკო ანგარიში (USD)', type: 'asset', level: 4, isGroup: false, parentCode: '123' },
  { code: '1234', name: 'Bank Accounts (EUR)', nameKa: 'საბანკო ანგარიში (EUR)', type: 'asset', level: 4, isGroup: false, parentCode: '123' },

  { code: '124', name: 'Prepaid Expenses', nameKa: 'წინასწარ გადახდილი ხარჯები', type: 'asset', level: 3, isGroup: false, parentCode: '12' },
  { code: '125', name: 'VAT Receivable', nameKa: 'დღგ — მისაღები', type: 'asset', level: 3, isGroup: false, parentCode: '12' },

  // ==================== 2. ვალდებულებები ====================
  { code: '2', name: 'Liabilities', nameKa: 'ვალდებულებები', type: 'liability', level: 1, isGroup: true, parentCode: null },

  { code: '21', name: 'Non-current Liabilities', nameKa: 'გრძელვადიანი ვალდებულებები', type: 'liability', level: 2, isGroup: true, parentCode: '2' },
  { code: '211', name: 'Long-term Loans', nameKa: 'გრძელვადიანი სესხები', type: 'liability', level: 3, isGroup: false, parentCode: '21' },
  { code: '212', name: 'Bonds Payable', nameKa: 'გადასახდელი ობლიგაციები', type: 'liability', level: 3, isGroup: false, parentCode: '21' },

  { code: '22', name: 'Current Liabilities', nameKa: 'მიმდინარე ვალდებულებები', type: 'liability', level: 2, isGroup: true, parentCode: '2' },
  { code: '221', name: 'Accounts Payable', nameKa: 'სავაჭრო ვალდებულებები (კრედიტორები)', type: 'liability', level: 3, isGroup: false, parentCode: '22' },
  { code: '222', name: 'Salaries Payable', nameKa: 'გადასახდელი ხელფასები', type: 'liability', level: 3, isGroup: false, parentCode: '22' },
  { code: '223', name: 'Income Tax Payable', nameKa: 'გადასახდელი მოგების გადასახადი', type: 'liability', level: 3, isGroup: false, parentCode: '22' },
  { code: '224', name: 'VAT Payable', nameKa: 'დღგ — გადასახდელი', type: 'liability', level: 3, isGroup: false, parentCode: '22' },
  { code: '225', name: 'Short-term Loans', nameKa: 'მოკლევადიანი სესხები', type: 'liability', level: 3, isGroup: false, parentCode: '22' },
  { code: '226', name: 'Accrued Expenses', nameKa: 'დარიცხული ვალდებულებები', type: 'liability', level: 3, isGroup: false, parentCode: '22' },

  // ==================== 3. კაპიტალი ====================
  { code: '3', name: 'Equity', nameKa: 'საკუთარი კაპიტალი', type: 'equity', level: 1, isGroup: true, parentCode: null },
  { code: '31', name: 'Share Capital', nameKa: 'საწესდებო კაპიტალი', type: 'equity', level: 2, isGroup: false, parentCode: '3' },
  { code: '32', name: 'Additional Paid-in Capital', nameKa: 'ემისიის დამატებითი კაპიტალი', type: 'equity', level: 2, isGroup: false, parentCode: '3' },
  { code: '33', name: 'Retained Earnings', nameKa: 'გაუნაწილებელი მოგება', type: 'equity', level: 2, isGroup: false, parentCode: '3' },
  { code: '34', name: 'Reserves', nameKa: 'სარეზერვო კაპიტალი', type: 'equity', level: 2, isGroup: false, parentCode: '3' },
  { code: '35', name: 'Current Year Profit/Loss', nameKa: 'მიმდინარე წლის მოგება/ზარალი', type: 'equity', level: 2, isGroup: false, parentCode: '3' },

  // ==================== 4. შემოსავლები ====================
  { code: '4', name: 'Revenue', nameKa: 'შემოსავლები', type: 'revenue', level: 1, isGroup: true, parentCode: null },
  { code: '41', name: 'Sales Revenue', nameKa: 'გაყიდვებიდან შემოსავალი', type: 'revenue', level: 2, isGroup: true, parentCode: '4' },
  { code: '411', name: 'Product Sales', nameKa: 'პროდუქციის რეალიზაცია', type: 'revenue', level: 3, isGroup: false, parentCode: '41' },
  { code: '412', name: 'Service Revenue', nameKa: 'მომსახურებიდან შემოსავალი', type: 'revenue', level: 3, isGroup: false, parentCode: '41' },
  { code: '42', name: 'Other Income', nameKa: 'სხვა შემოსავლები', type: 'revenue', level: 2, isGroup: true, parentCode: '4' },
  { code: '421', name: 'Interest Income', nameKa: 'პროცენტით მიღებული შემოსავალი', type: 'revenue', level: 3, isGroup: false, parentCode: '42' },
  { code: '422', name: 'Foreign Exchange Gain', nameKa: 'სავალუტო კურსის სხვაობით მიღებული შემოსავალი', type: 'revenue', level: 3, isGroup: false, parentCode: '42' },

  // ==================== 5. ხარჯები ====================
  { code: '5', name: 'Expenses', nameKa: 'ხარჯები', type: 'expense', level: 1, isGroup: true, parentCode: null },

  { code: '51', name: 'Cost of Goods Sold', nameKa: 'რეალიზებული საქონლის თვითღირებულება', type: 'expense', level: 2, isGroup: false, parentCode: '5' },

  { code: '52', name: 'Operating Expenses', nameKa: 'საოპერაციო ხარჯები', type: 'expense', level: 2, isGroup: true, parentCode: '5' },
  { code: '521', name: 'Salary Expense', nameKa: 'ხელფასის ხარჯი', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '522', name: 'Rent Expense', nameKa: 'იჯარის ხარჯი', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '523', name: 'Utilities Expense', nameKa: 'კომუნალური ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '524', name: 'Office Supplies', nameKa: 'საკანცელარიო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '525', name: 'Depreciation Expense', nameKa: 'ცვეთის ხარჯი', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '526', name: 'Marketing & Advertising', nameKa: 'მარკეტინგი და რეკლამა', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '527', name: 'Professional Services', nameKa: 'პროფესიული მომსახურება', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '528', name: 'Insurance Expense', nameKa: 'დაზღვევის ხარჯი', type: 'expense', level: 3, isGroup: false, parentCode: '52' },
  { code: '529', name: 'Other Operating Expenses', nameKa: 'სხვა საოპერაციო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '52' },

  { code: '53', name: 'Financial Expenses', nameKa: 'ფინანსური ხარჯები', type: 'expense', level: 2, isGroup: true, parentCode: '5' },
  { code: '531', name: 'Interest Expense', nameKa: 'პროცენტის ხარჯი', type: 'expense', level: 3, isGroup: false, parentCode: '53' },
  { code: '532', name: 'Foreign Exchange Loss', nameKa: 'სავალუტო კურსის ზარალი', type: 'expense', level: 3, isGroup: false, parentCode: '53' },
  { code: '533', name: 'Bank Fees', nameKa: 'საბანკო მომსახურების ხარჯი', type: 'expense', level: 3, isGroup: false, parentCode: '53' },

  { code: '54', name: 'Tax Expenses', nameKa: 'გადასახადების ხარჯი', type: 'expense', level: 2, isGroup: true, parentCode: '5' },
  { code: '541', name: 'Income Tax Expense', nameKa: 'მოგების გადასახადი', type: 'expense', level: 3, isGroup: false, parentCode: '54' },
  { code: '542', name: 'Property Tax', nameKa: 'ქონების გადასახადი', type: 'expense', level: 3, isGroup: false, parentCode: '54' },
];

export async function seedAccountsForCompany(companyId: string): Promise<number> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // Skip if already seeded
    const existing = await client.query(
      'SELECT COUNT(*)::int AS c FROM accounts WHERE company_id = $1',
      [companyId]
    );
    if (existing.rows[0].c > 0) {
      console.log(`[seed] company ${companyId} already has ${existing.rows[0].c} accounts, skipping`);
      return 0;
    }

    const idMap = new Map<string, string>();
    for (const acc of chartOfAccounts) {
      const parentId = acc.parentCode ? idMap.get(acc.parentCode) : null;
      const result = await client.query(
        `INSERT INTO accounts (code, name, name_ka, type, parent_id, level, is_group, company_id)
         VALUES ($1, $2, $3, $4::account_type, $5, $6, $7, $8)
         RETURNING id`,
        [acc.code, acc.name, acc.nameKa, acc.type, parentId, acc.level, acc.isGroup, companyId]
      );
      idMap.set(acc.code, result.rows[0].id);
    }
    console.log(`[seed] Seeded ${chartOfAccounts.length} accounts for company ${companyId}`);
    return chartOfAccounts.length;
  } finally {
    await client.end();
  }
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const companyId = process.argv[2];
  if (!companyId) {
    console.error('Usage: npx tsx src/db/seed-accounts.ts <company-id>');
    process.exit(1);
  }
  seedAccountsForCompany(companyId).catch((e) => {
    console.error('Seed error:', e.message);
    process.exit(1);
  });
}
