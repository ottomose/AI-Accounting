import 'dotenv/config';
import { Client } from 'pg';

// ბასს-ის ანგარიშთა გეგმა — ოფიციალური 4-ნიშნა კოდებით
// Structure: level 1 = გეგმის კატეგორია (1000/2000/...), level 2 = ქვეჯგუფი (1100/1200/...),
// level 3 = ანგარიში (1110/1210/...)
interface ChartAccount {
  code: string;
  name: string;
  nameKa: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  level: number;
  isGroup: boolean;
  parentCode: string | null;
}

const chartOfAccounts: ChartAccount[] = [
  // ==================== აქტივები ====================
  { code: '1000', name: 'Current Assets', nameKa: 'მიმდინარე აქტივები', type: 'asset', level: 1, isGroup: true, parentCode: null },

  // 1100 ნაღდი ფული
  { code: '1100', name: 'Cash', nameKa: 'ნაღდი ფული', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1110', name: 'Cash in GEL', nameKa: 'ნაღდი ფული ეროვნულ ვალუტაში', type: 'asset', level: 3, isGroup: false, parentCode: '1100' },
  { code: '1120', name: 'Cash in Foreign Currency', nameKa: 'ნაღდი ფული უცხოურ ვალუტაში', type: 'asset', level: 3, isGroup: false, parentCode: '1100' },

  // 1200 ფული საბანკო ანგარიშებზე
  { code: '1200', name: 'Bank Accounts', nameKa: 'ფული საბანკო ანგარიშებზე', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1210', name: 'GEL in Resident Banks', nameKa: 'ეროვნული ვალუტა რეზიდენტ ბანკებში', type: 'asset', level: 3, isGroup: false, parentCode: '1200' },
  { code: '1220', name: 'FX in Resident Banks', nameKa: 'უცხოური ვალუტა რეზიდენტ ბანკებში', type: 'asset', level: 3, isGroup: false, parentCode: '1200' },
  { code: '1230', name: 'FX in Non-resident Banks', nameKa: 'უცხოური ვალუტა არარეზიდენტ ბანკებში', type: 'asset', level: 3, isGroup: false, parentCode: '1200' },
  { code: '1290', name: 'Other Bank Accounts', nameKa: 'ფული სხვა საბანკო ანგარიშებზე', type: 'asset', level: 3, isGroup: false, parentCode: '1200' },

  // 1300 მოკლევადიანი ინვესტიციები
  { code: '1300', name: 'Short-term Investments', nameKa: 'მოკლევადიანი ინვესტიციები', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1310', name: 'ST Investments in Securities', nameKa: 'მოკლევადიანი ინვესტიციები საწარმოს ფასიან ქაღალდებში', type: 'asset', level: 3, isGroup: false, parentCode: '1300' },
  { code: '1320', name: 'ST Investments in Govt. Securities', nameKa: 'მოკლევადიანი ინვესტიციები სახელმწ. ფასიან ქაღალდებში', type: 'asset', level: 3, isGroup: false, parentCode: '1300' },
  { code: '1330', name: 'Current Portion of LT Investments', nameKa: 'გრძელვადიანი ინვესტიციების მიმდინარე ნაწილი', type: 'asset', level: 3, isGroup: false, parentCode: '1300' },
  { code: '1390', name: 'Other ST Investments', nameKa: 'სხვა მოკლევადიანი ინვესტიციები', type: 'asset', level: 3, isGroup: false, parentCode: '1300' },

  // 1400 მოკლევადიანი მოთხოვნები
  { code: '1400', name: 'Short-term Receivables', nameKa: 'მოკლევადიანი მოთხოვნები', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1410', name: 'Trade Receivables', nameKa: 'მოთხოვნები მიწოდებიდან და მომსახურებიდან', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1415', name: 'Allowance for Doubtful Accounts', nameKa: 'საეჭვო ვალების რეზერვი', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1420', name: 'Receivables from Affiliates', nameKa: 'მოთხოვნები მეკავშირე საწარმოების მიმართ', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1430', name: 'Receivables from Personnel', nameKa: 'მოთხოვნები საწარმოს პერსონალის მიმართ', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1440', name: 'Receivables from Management', nameKa: 'მოთხოვნები ხელმძღვანელებისა და სამეთვალყურეო ორგანოების წევრების მიმართ', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1450', name: 'Loans to Partners', nameKa: 'მოთხოვნები პარტნიორებზე გაცემული სესხებით', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1460', name: 'Current Portion of Partner Capital Debt', nameKa: 'კაპიტალის შევსებაზე პარტნიორების გრძელვადიანი დავალიანებების მიმდინარე ნაწილი', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1470', name: 'Current Portion of LT Receivables', nameKa: 'გრძელვადიანი მოთხოვნების მიმდინარე ნაწილი', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1480', name: 'Advances to Suppliers', nameKa: 'მომწოდებლებზე გადახდილი ავანსები', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },
  { code: '1490', name: 'Other ST Receivables', nameKa: 'სხვა მოკლევადიანი მოთხოვნები', type: 'asset', level: 3, isGroup: false, parentCode: '1400' },

  // 1500 მოკლევადიანი სათამასუქო მოთხოვნები
  { code: '1500', name: 'ST Notes Receivable', nameKa: 'მოკლევადიანი სათამასუქო მოთხოვნები', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1510', name: 'ST Notes Received', nameKa: 'მიღებული მოკლევადიანი თამასუქები', type: 'asset', level: 3, isGroup: false, parentCode: '1500' },
  { code: '1520', name: 'Current Portion of LT Notes', nameKa: 'მიღებული გრძელვადიანი თამასუქების მიმდინარე ნაწილი', type: 'asset', level: 3, isGroup: false, parentCode: '1500' },

  // 1600 სასაქონლო-მატერიალური მარაგები
  { code: '1600', name: 'Inventory', nameKa: 'სასაქონლო-მატერიალური მარაგები', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1610', name: 'Merchandise', nameKa: 'საქონელი', type: 'asset', level: 3, isGroup: false, parentCode: '1600' },
  { code: '1620', name: 'Raw Materials', nameKa: 'ნედლეული და მასალები', type: 'asset', level: 3, isGroup: false, parentCode: '1600' },
  { code: '1630', name: 'Work in Progress', nameKa: 'დაუმთავრებელი წარმოება', type: 'asset', level: 3, isGroup: false, parentCode: '1600' },
  { code: '1640', name: 'Finished Goods', nameKa: 'მზა პროდუქცია', type: 'asset', level: 3, isGroup: false, parentCode: '1600' },
  { code: '1690', name: 'Other Production Supplies', nameKa: 'სხვა საწარმოო მარაგი', type: 'asset', level: 3, isGroup: false, parentCode: '1600' },

  // 1700 წინასწარ გაწეული ხარჯები
  { code: '1700', name: 'Prepaid Expenses', nameKa: 'წინასწარ გაწეული ხარჯები', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1710', name: 'Prepaid Services', nameKa: 'წინასწარ ანაზღაურებული მომსახურება', type: 'asset', level: 3, isGroup: false, parentCode: '1700' },
  { code: '1720', name: 'Prepaid Rent', nameKa: 'წინასწარ გადახდილი საიჯარო ქირა', type: 'asset', level: 3, isGroup: false, parentCode: '1700' },
  { code: '1790', name: 'Other Prepaid Expenses', nameKa: 'სხვა წინასწარ გადახდილი ხარჯები', type: 'asset', level: 3, isGroup: false, parentCode: '1700' },

  // 1800 დარიცხული მოთხოვნები
  { code: '1800', name: 'Accrued Receivables', nameKa: 'დარიცხული მოთხოვნები', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1810', name: 'Dividends Receivable', nameKa: 'მისაღები დივიდენდები', type: 'asset', level: 3, isGroup: false, parentCode: '1800' },
  { code: '1820', name: 'Interest Receivable', nameKa: 'მისაღები პროცენტები', type: 'asset', level: 3, isGroup: false, parentCode: '1800' },
  { code: '1890', name: 'Other Accrued Receivables', nameKa: 'სხვა დარიცხული მოთხოვნები', type: 'asset', level: 3, isGroup: false, parentCode: '1800' },

  // 1900 სხვა მიმდინარე აქტივები
  { code: '1900', name: 'Other Current Assets', nameKa: 'სხვა მიმდინარე აქტივები', type: 'asset', level: 2, isGroup: true, parentCode: '1000' },
  { code: '1910', name: 'Other Current Assets', nameKa: 'სხვა მიმდინარე აქტივები', type: 'asset', level: 3, isGroup: false, parentCode: '1900' },

  // 2000 გრძელვადიანი აქტივები
  { code: '2000', name: 'Non-current Assets', nameKa: 'გრძელვადიანი აქტივები', type: 'asset', level: 1, isGroup: true, parentCode: null },

  // 2100 ძირითადი საშუალებები
  { code: '2100', name: 'Property, Plant & Equipment', nameKa: 'ძირითადი საშუალებები', type: 'asset', level: 2, isGroup: true, parentCode: '2000' },
  { code: '2110', name: 'Land', nameKa: 'მიწის ნაკვეთები', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2120', name: 'Construction in Progress', nameKa: 'დაუმთავრებელი მშენებლობები', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2130', name: 'Buildings', nameKa: 'შენობები', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2140', name: 'Structures', nameKa: 'ნაგებობები', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2150', name: 'Machinery & Equipment', nameKa: 'მანქანა-დანადგარები', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2160', name: 'Office Equipment', nameKa: 'ოფისის აღჭურვილობა', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2170', name: 'Furniture & Other Inventory', nameKa: 'ავეჯი და სხვა ინვენტარი', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2180', name: 'Vehicles', nameKa: 'სატრანსპორტო საშუალებები', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },
  { code: '2190', name: 'Leasehold Improvements', nameKa: 'იჯარით აღებული ქონების კეთილმოწყობა', type: 'asset', level: 3, isGroup: false, parentCode: '2100' },

  // 2200 ძირითადი საშუალებების ცვეთა
  { code: '2200', name: 'Accumulated Depreciation', nameKa: 'ძირითადი საშუალებების ცვეთა', type: 'asset', level: 2, isGroup: true, parentCode: '2000' },
  { code: '2230', name: 'Buildings Depreciation', nameKa: 'შენობების ცვეთა', type: 'asset', level: 3, isGroup: false, parentCode: '2200' },
  { code: '2240', name: 'Structures Depreciation', nameKa: 'ნაგებობების ცვეთა', type: 'asset', level: 3, isGroup: false, parentCode: '2200' },
  { code: '2250', name: 'Machinery Depreciation', nameKa: 'მანქანა-დანადგარების ცვეთა', type: 'asset', level: 3, isGroup: false, parentCode: '2200' },
  { code: '2260', name: 'Office Equipment Depreciation', nameKa: 'ოფისის აღჭურვილობის ცვეთა', type: 'asset', level: 3, isGroup: false, parentCode: '2200' },
  { code: '2270', name: 'Furniture Depreciation', nameKa: 'ავეჯისა და სხვა ინვენტარის ცვეთა', type: 'asset', level: 3, isGroup: false, parentCode: '2200' },
  { code: '2280', name: 'Vehicles Depreciation', nameKa: 'სატრანსპორტო საშუალებების ცვეთა', type: 'asset', level: 3, isGroup: false, parentCode: '2200' },
  { code: '2290', name: 'Leasehold Improvements Depreciation', nameKa: 'იჯარით აღებული ქონების კეთილმოწყობის ცვეთა', type: 'asset', level: 3, isGroup: false, parentCode: '2200' },

  // 2300 გრძელვადიანი მოთხოვნები
  { code: '2300', name: 'LT Receivables', nameKa: 'გრძელვადიანი მოთხოვნები', type: 'asset', level: 2, isGroup: true, parentCode: '2000' },
  { code: '2310', name: 'LT Notes Received', nameKa: 'მიღებული გრძელვადიანი თამასუქები', type: 'asset', level: 3, isGroup: false, parentCode: '2300' },
  { code: '2320', name: 'Finance Lease Receivables', nameKa: 'ფინანსურ იჯარასთან დაკავშირებული მოთხოვნები', type: 'asset', level: 3, isGroup: false, parentCode: '2300' },
  { code: '2330', name: 'Receivables on Capital Contributions', nameKa: 'მოთხოვნები საწესდებო კაპიტალის შევსებაზე', type: 'asset', level: 3, isGroup: false, parentCode: '2300' },
  { code: '2340', name: 'Deferred Tax Assets', nameKa: 'გადავადებული საგადასახადო აქტივები', type: 'asset', level: 3, isGroup: false, parentCode: '2300' },
  { code: '2390', name: 'Other LT Receivables', nameKa: 'სხვა გრძელვადიანი მოთხოვნები', type: 'asset', level: 3, isGroup: false, parentCode: '2300' },

  // 2400 გრძელვადიანი ინვესტიციები
  { code: '2400', name: 'LT Investments', nameKa: 'გრძელვადიანი ინვესტიციები', type: 'asset', level: 2, isGroup: true, parentCode: '2000' },
  { code: '2410', name: 'LT Investments in Securities', nameKa: 'გრძელვადიანი ინვესტიციები საწარმოთა ფასიან ქაღალდებში', type: 'asset', level: 3, isGroup: false, parentCode: '2400' },
  { code: '2420', name: 'LT Investments in Govt. Securities', nameKa: 'გრძელვადიანი ინვესტიციები სახელმწ. ფასიან ქაღალდებში', type: 'asset', level: 3, isGroup: false, parentCode: '2400' },
  { code: '2430', name: 'Investments in Associates', nameKa: 'მონაწილეობა სხვა საზოგადოებაში', type: 'asset', level: 3, isGroup: false, parentCode: '2400' },
  { code: '2490', name: 'Other LT Investments', nameKa: 'სხვა გრძელვადიანი ინვესტიციები', type: 'asset', level: 3, isGroup: false, parentCode: '2400' },

  // 2500 არამატერიალური აქტივები
  { code: '2500', name: 'Intangible Assets', nameKa: 'არამატერიალური აქტივები', type: 'asset', level: 2, isGroup: true, parentCode: '2000' },
  { code: '2510', name: 'Licenses', nameKa: 'ლიცენზიები', type: 'asset', level: 3, isGroup: false, parentCode: '2500' },
  { code: '2520', name: 'Concessions', nameKa: 'კონცესიები', type: 'asset', level: 3, isGroup: false, parentCode: '2500' },
  { code: '2530', name: 'Patents', nameKa: 'პატენტები', type: 'asset', level: 3, isGroup: false, parentCode: '2500' },
  { code: '2540', name: 'Goodwill', nameKa: 'გუდვილი', type: 'asset', level: 3, isGroup: false, parentCode: '2500' },
  { code: '2590', name: 'Other Intangible Assets', nameKa: 'სხვა არამატერიალური აქტივები', type: 'asset', level: 3, isGroup: false, parentCode: '2500' },

  // 2600 არამატერიალური აქტივების ამორტიზაცია
  { code: '2600', name: 'Accumulated Amortization', nameKa: 'არამატერიალური აქტივების ამორტიზაცია', type: 'asset', level: 2, isGroup: true, parentCode: '2000' },
  { code: '2610', name: 'Licenses Amortization', nameKa: 'ლიცენზიების ამორტიზაცია', type: 'asset', level: 3, isGroup: false, parentCode: '2600' },
  { code: '2620', name: 'Concessions Amortization', nameKa: 'კონცესიების ამორტიზაცია', type: 'asset', level: 3, isGroup: false, parentCode: '2600' },
  { code: '2630', name: 'Patents Amortization', nameKa: 'პატენტების ამორტიზაცია', type: 'asset', level: 3, isGroup: false, parentCode: '2600' },
  { code: '2640', name: 'Goodwill Amortization', nameKa: 'გუდვილის ამორტიზაცია', type: 'asset', level: 3, isGroup: false, parentCode: '2600' },
  { code: '2690', name: 'Other Intangibles Amortization', nameKa: 'სხვა არამატერიალური აქტივების ამორტიზაცია', type: 'asset', level: 3, isGroup: false, parentCode: '2600' },

  // ==================== ვალდებულებები ====================
  { code: '3000', name: 'Current Liabilities', nameKa: 'მიმდინარე ვალდებულებები', type: 'liability', level: 1, isGroup: true, parentCode: null },

  // 3100 მოკლევადიანი ვალდებულებები
  { code: '3100', name: 'ST Liabilities', nameKa: 'მოკლევადიანი ვალდებულებები', type: 'liability', level: 2, isGroup: true, parentCode: '3000' },
  { code: '3110', name: 'Trade Payables', nameKa: 'მოწოდებიდან და მომსახურურებიდან წარმოქმნილი ვალდებულებები', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },
  { code: '3120', name: 'Advances Received', nameKa: 'მიღებული ავანსები', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },
  { code: '3130', name: 'Salaries Payable', nameKa: 'გადასახდელი ხელფასი', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },
  { code: '3140', name: 'Royalties', nameKa: 'როიალტი', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },
  { code: '3150', name: 'Commission Payable', nameKa: 'საკომისიო გადასახდელები', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },
  { code: '3160', name: 'Payable to Personnel', nameKa: 'ვალდებულებები საწარმოს პერსონალის წინაშე', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },
  { code: '3170', name: 'Payable to Affiliates', nameKa: 'ვალდებულებები მეკავშირე საწარმოების წინაშე', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },
  { code: '3190', name: 'Other ST Liabilities', nameKa: 'სხვა მოკლევადიანი ვალდებულებები', type: 'liability', level: 3, isGroup: false, parentCode: '3100' },

  // 3200 მოკლევადიანი სესხები
  { code: '3200', name: 'ST Loans', nameKa: 'მოკლევადიანი სესხები', type: 'liability', level: 2, isGroup: true, parentCode: '3000' },
  { code: '3210', name: 'ST Loans', nameKa: 'მოკლევადიანი სესხები', type: 'liability', level: 3, isGroup: false, parentCode: '3200' },
  { code: '3220', name: 'Loans from Partners', nameKa: 'სესხები პარტნიორებისაგან', type: 'liability', level: 3, isGroup: false, parentCode: '3200' },
  { code: '3230', name: 'Current Portion of LT Loans', nameKa: 'გრძელვადიანი სესხების მიმდინარე ნაწილი', type: 'liability', level: 3, isGroup: false, parentCode: '3200' },

  // 3300 საგადასახადო ვალდებულებები
  { code: '3300', name: 'Tax Liabilities', nameKa: 'საგადასახადო ვალდებულებები', type: 'liability', level: 2, isGroup: true, parentCode: '3000' },
  { code: '3310', name: 'Profit Tax Payable', nameKa: 'გადასახდელი მოგების გადასახადი', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },
  { code: '3320', name: 'Income Tax Payable', nameKa: 'გადასახდელი საშემოსავლო გადასახადი', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },
  { code: '3330', name: 'VAT Payable', nameKa: 'გადასახდელი დ.ღ.გ.', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },
  { code: '3340', name: 'VAT Paid', nameKa: 'გადახდილი დ.ღ.გ.', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },
  { code: '3350', name: 'Excise Payable', nameKa: 'გადასახდელი აქციზი', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },
  { code: '3360', name: 'Excise Paid', nameKa: 'გადახდილი აქციზი', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },
  { code: '3370', name: 'Social Tax', nameKa: 'სოციალური გადასახადი', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },
  { code: '3390', name: 'Other Tax Liabilities', nameKa: 'სხვა საგადასახადო ვალდებულებები', type: 'liability', level: 3, isGroup: false, parentCode: '3300' },

  // 3400 დარიცხული ვალდებულებები
  { code: '3400', name: 'Accrued Liabilities', nameKa: 'დარიცხული ვალდებულებები', type: 'liability', level: 2, isGroup: true, parentCode: '3000' },
  { code: '3410', name: 'Interest Payable', nameKa: 'გადასახდელი პროცენტები', type: 'liability', level: 3, isGroup: false, parentCode: '3400' },
  { code: '3420', name: 'Dividends Payable', nameKa: 'გადასახდელი დივიდენდები', type: 'liability', level: 3, isGroup: false, parentCode: '3400' },
  { code: '3430', name: 'Warranty Obligations', nameKa: 'ვალდებულება საგარანტიო მომსახურებაზე', type: 'liability', level: 3, isGroup: false, parentCode: '3400' },
  { code: '3490', name: 'Other Accrued Liabilities', nameKa: 'სხვა დარიცხული ვალდებულებები', type: 'liability', level: 3, isGroup: false, parentCode: '3400' },

  // 4000 გრძელვადიანი ვალდებულებები
  { code: '4000', name: 'Non-current Liabilities', nameKa: 'გრძელვადიანი ვალდებულებები', type: 'liability', level: 1, isGroup: true, parentCode: null },

  // 4100 გრძელვადიანი სასესხო ვალდებულებები
  { code: '4100', name: 'LT Loan Liabilities', nameKa: 'გრძელვადიანი სასესხო ვალდებულებები', type: 'liability', level: 2, isGroup: true, parentCode: '4000' },
  { code: '4110', name: 'Bonds Payable', nameKa: 'გასანაღდებელი ობლიგაციები', type: 'liability', level: 3, isGroup: false, parentCode: '4100' },
  { code: '4120', name: 'Notes Payable', nameKa: 'გასანაღდებელი თამასუქები', type: 'liability', level: 3, isGroup: false, parentCode: '4100' },
  { code: '4130', name: 'Finance Lease Liabilities', nameKa: 'ვალდებულებები ფინანსურ იჯარაზე', type: 'liability', level: 3, isGroup: false, parentCode: '4100' },
  { code: '4140', name: 'LT Loans', nameKa: 'გრძელვადიანი სესხები', type: 'liability', level: 3, isGroup: false, parentCode: '4100' },
  { code: '4190', name: 'Other LT Loan Liabilities', nameKa: 'სხვა გრძელვადიანი სასესხო ვალდებულებები', type: 'liability', level: 3, isGroup: false, parentCode: '4100' },

  // 4200 გადავადებული გადასახადები
  { code: '4200', name: 'Deferred Tax & Other LT Liabilities', nameKa: 'გადავადებული გადასახადები და სხვა გრძელვადიანი ვალდებულებები', type: 'liability', level: 2, isGroup: true, parentCode: '4000' },
  { code: '4210', name: 'Deferred Profit Tax', nameKa: 'გადავადებული მოგების გადასახადი', type: 'liability', level: 3, isGroup: false, parentCode: '4200' },
  { code: '4220', name: 'Other LT Liabilities', nameKa: 'სხვა გრძელვადიანი ვალდებულებები', type: 'liability', level: 3, isGroup: false, parentCode: '4200' },

  // 4300 ანარიცხები
  { code: '4300', name: 'Provisions', nameKa: 'ანარიცხები', type: 'liability', level: 2, isGroup: true, parentCode: '4000' },
  { code: '4310', name: 'Pension Provisions', nameKa: 'საპენსიო უზრუნველყოფის ანარიცხები', type: 'liability', level: 3, isGroup: false, parentCode: '4300' },
  { code: '4320', name: 'Other Provisions', nameKa: 'სხვა ანარიცხები', type: 'liability', level: 3, isGroup: false, parentCode: '4300' },

  // 4400 გადავადებული შემოსავალი
  { code: '4400', name: 'Deferred Revenue', nameKa: 'გადავადებული შემოსავალი', type: 'liability', level: 2, isGroup: true, parentCode: '4000' },
  { code: '4410', name: 'Deferred Revenue', nameKa: 'გადავადებული შემოსავალი', type: 'liability', level: 3, isGroup: false, parentCode: '4400' },

  // ==================== კაპიტალი ====================
  { code: '5000', name: 'Equity', nameKa: 'საკუთარი კაპიტალი', type: 'equity', level: 1, isGroup: true, parentCode: null },

  // 5100 საწესდებო კაპიტალი
  { code: '5100', name: 'Share Capital', nameKa: 'საწესდებო კაპიტალი', type: 'equity', level: 2, isGroup: true, parentCode: '5000' },
  { code: '5110', name: 'Common Shares', nameKa: 'ჩვეულებრივი აქციები', type: 'equity', level: 3, isGroup: false, parentCode: '5100' },
  { code: '5120', name: 'Preferred Shares', nameKa: 'პრივილეგირებული აქციები', type: 'equity', level: 3, isGroup: false, parentCode: '5100' },
  { code: '5130', name: 'Treasury Stock', nameKa: 'გამოსყიდული საკუთარი აქციები', type: 'equity', level: 3, isGroup: false, parentCode: '5100' },
  { code: '5140', name: 'Paid-in Capital', nameKa: 'საემისიო კაპიტალი', type: 'equity', level: 3, isGroup: false, parentCode: '5100' },
  { code: '5150', name: 'LLC Share Capital', nameKa: 'საწესდებო კაპიტალი შპს-ში', type: 'equity', level: 3, isGroup: false, parentCode: '5100' },

  // 5200 პარტნიორთა კაპიტალი
  { code: '5200', name: 'Partner Capital', nameKa: 'პარტნიორთა კაპიტალი', type: 'equity', level: 2, isGroup: true, parentCode: '5000' },
  { code: '5210', name: 'Partner Capital', nameKa: 'პარტნიორთა კაპიტალი', type: 'equity', level: 3, isGroup: false, parentCode: '5200' },

  // 5300 მოგება-ზარალი
  { code: '5300', name: 'Profit/Loss', nameKa: 'მოგება-ზარალი', type: 'equity', level: 2, isGroup: true, parentCode: '5000' },
  { code: '5310', name: 'Retained Earnings', nameKa: 'გაუნაწილებელი მოგება', type: 'equity', level: 3, isGroup: false, parentCode: '5300' },
  { code: '5320', name: 'Accumulated Loss', nameKa: 'დაუფარავი ზარალი', type: 'equity', level: 3, isGroup: false, parentCode: '5300' },
  { code: '5330', name: 'Current Period P/L', nameKa: 'საანგარიშგებო პერიოდის მოგება-ზარალი', type: 'equity', level: 3, isGroup: false, parentCode: '5300' },

  // 5400 რეზერვები და დაფინანსება
  { code: '5400', name: 'Reserves & Funding', nameKa: 'რეზერვები და დაფინანსება', type: 'equity', level: 2, isGroup: true, parentCode: '5000' },
  { code: '5410', name: 'Reserve Capital', nameKa: 'სარეზერვო კაპიტალი', type: 'equity', level: 3, isGroup: false, parentCode: '5400' },
  { code: '5420', name: 'PPE Revaluation Reserve', nameKa: 'ძირითადი საშუალებების გადაფასების რეზერვი', type: 'equity', level: 3, isGroup: false, parentCode: '5400' },
  { code: '5430', name: 'Investment Revaluation Reserve', nameKa: 'ინვესტიციების გადაფასების რეზერვი', type: 'equity', level: 3, isGroup: false, parentCode: '5400' },
  { code: '5490', name: 'Other Reserves', nameKa: 'სხვა რეზერვები და დაფინანსება', type: 'equity', level: 3, isGroup: false, parentCode: '5400' },

  // ==================== შემოსავლები ====================
  { code: '6000', name: 'Operating Revenue', nameKa: 'საოპერაციო შემოსავლები', type: 'revenue', level: 1, isGroup: true, parentCode: null },

  // 6100 საოპერაციო შემოსავლები
  { code: '6100', name: 'Operating Revenue', nameKa: 'საოპერაციო შემოსავლები', type: 'revenue', level: 2, isGroup: true, parentCode: '6000' },
  { code: '6110', name: 'Sales Revenue', nameKa: 'შემოსავალი რეალიზაციიდან', type: 'revenue', level: 3, isGroup: false, parentCode: '6100' },
  { code: '6120', name: 'Sales Returns & Discounts', nameKa: 'გაყიდული საქონლის დაბრუნება და ფასდათმობა', type: 'revenue', level: 3, isGroup: false, parentCode: '6100' },
  { code: '6130', name: 'Doubtful Accounts Recovery', nameKa: 'შემოსავალი საეჭვო მოთხოვნებიდან', type: 'revenue', level: 3, isGroup: false, parentCode: '6100' },
  { code: '6190', name: 'Other Operating Revenue', nameKa: 'სხვა საოპერაციო შემოსავლები', type: 'revenue', level: 3, isGroup: false, parentCode: '6100' },

  // ==================== ხარჯები ====================
  { code: '7000', name: 'Operating Expenses', nameKa: 'საოპერაციო ხარჯები', type: 'expense', level: 1, isGroup: true, parentCode: null },

  // 7100 რეალიზებული პროდუქციის თვითღირებულება
  { code: '7100', name: 'COGS (Manufacturing)', nameKa: 'რეალიზებული პროდუქციის თვითღირებულება', type: 'expense', level: 2, isGroup: true, parentCode: '7000' },
  { code: '7110', name: 'Direct Materials', nameKa: 'ძირითადი მასალების დანახარჯები/შეძენა', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7120', name: 'Direct Labor', nameKa: 'პირდაპირი ხელფასი', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7130', name: 'Social Tax on Direct Labor', nameKa: 'სოციალური დანარიცხები პირდაპირ ხელფასზე', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7140', name: 'Indirect Materials', nameKa: 'დამხმარე მასალების დანახარჯები/შეძენა', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7150', name: 'Indirect Labor', nameKa: 'არაპირდაპირი ხელფასი', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7160', name: 'Social Tax on Indirect Labor', nameKa: 'სოციალური დანარიცხები არაპირდაპირ ხელფასზე', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7170', name: 'Depreciation & Amortization', nameKa: 'ცვეთა და ამორტიზაცია', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7180', name: 'Repair Expenses', nameKa: 'რემონტის დანახარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7185', name: 'Inventory Adjustments', nameKa: 'სასაქონლო-მატერიალური მარაგების კორექტირება', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },
  { code: '7190', name: 'Other Operating Expenses (COGS)', nameKa: 'სხვა საოპერაციო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7100' },

  // 7200 რეალიზებული საქონლის თვითღირებულება (სავაჭრო)
  { code: '7200', name: 'COGS (Trading)', nameKa: 'რეალიზებული საქონლის თვითღირებულება', type: 'expense', level: 2, isGroup: true, parentCode: '7000' },
  { code: '7210', name: 'Goods Sold/Purchased', nameKa: 'გაყიდული/შეძენილი საქონელი', type: 'expense', level: 3, isGroup: false, parentCode: '7200' },
  { code: '7220', name: 'Purchase Returns & Discounts', nameKa: 'შეძენილი საქონლის უკანდაბრუნება და ფასდათმობა', type: 'expense', level: 3, isGroup: false, parentCode: '7200' },
  { code: '7290', name: 'Inventory Adjustments (Trading)', nameKa: 'სასაქონლო-მატერიალური მარაგების კორექტირება', type: 'expense', level: 3, isGroup: false, parentCode: '7200' },

  // 7300 მიწოდების ხარჯები
  { code: '7300', name: 'Selling Expenses', nameKa: 'მიწოდების ხარჯები', type: 'expense', level: 2, isGroup: true, parentCode: '7000' },
  { code: '7310', name: 'Advertising', nameKa: 'რეკლამის ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7300' },
  { code: '7320', name: 'Sales Salaries & Commissions', nameKa: 'შრომის ანაზღაურება და საკომისიო გასამრჯელო', type: 'expense', level: 3, isGroup: false, parentCode: '7300' },
  { code: '7330', name: 'Social Tax on Sales Labor', nameKa: 'შრომის ანაზღაურებაზე დანარიცხი', type: 'expense', level: 3, isGroup: false, parentCode: '7300' },
  { code: '7340', name: 'Transport & Storage', nameKa: 'ტრანსპორტირებისა და შენახვის ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7300' },
  { code: '7390', name: 'Other Selling Expenses', nameKa: 'სხვა მიწოდების ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7300' },

  // 7400 საერთო და ადმინისტრაციული ხარჯები
  { code: '7400', name: 'General & Administrative', nameKa: 'საერთო და ადმინისტრაციული ხარჯები', type: 'expense', level: 2, isGroup: true, parentCode: '7000' },
  { code: '7410', name: 'Admin Salaries', nameKa: 'შრომის ანაზღაურება', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7415', name: 'Social Tax on Admin', nameKa: 'სოციალური დანარიცხები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7420', name: 'Rent Expense', nameKa: 'საიჯარო ქირა', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7425', name: 'Office Supplies', nameKa: 'საოფისე ინვენტარი', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7430', name: 'Communications', nameKa: 'კომუნიკაციის ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7435', name: 'Insurance', nameKa: 'დაზღვევა', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7440', name: 'Repairs (Admin)', nameKa: 'რემონტი', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7445', name: 'Computer Expenses', nameKa: 'კომპიუტერის ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7450', name: 'Consulting Fees', nameKa: 'საკონსულტაციო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7455', name: 'Depreciation (Admin)', nameKa: 'ცვეთა და ამორტიზაცია', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7460', name: 'Bad Debt Expense', nameKa: 'საეჭვო მოთხოვნებთან დაკავშირებული ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7470', name: 'Other Tax Expenses', nameKa: 'სხვა საგადასახადო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7480', name: 'Warranty Expenses', nameKa: 'საგარანტიო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },
  { code: '7490', name: 'Other G&A Expenses', nameKa: 'სხვა საერთო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '7400' },

  // 8000 არასაოპერაციო შემოსავლები და ხარჯები
  { code: '8100', name: 'Non-operating Revenue', nameKa: 'არასაოპერაციო შემოსავლები', type: 'revenue', level: 1, isGroup: true, parentCode: null },
  { code: '8110', name: 'Interest Income', nameKa: 'საპროცენტო შემოსავლები', type: 'revenue', level: 3, isGroup: false, parentCode: '8100' },
  { code: '8120', name: 'Dividend Income', nameKa: 'დივიდენდები', type: 'revenue', level: 3, isGroup: false, parentCode: '8100' },
  { code: '8130', name: 'Non-operating Gain', nameKa: 'არასაოპერაციო მოგება', type: 'revenue', level: 3, isGroup: false, parentCode: '8100' },
  { code: '8190', name: 'Other Non-operating Revenue', nameKa: 'სხვა არასაოპერაციო შემოსავლები', type: 'revenue', level: 3, isGroup: false, parentCode: '8100' },

  { code: '8200', name: 'Non-operating Expenses', nameKa: 'არასაოპერაციო ხარჯები', type: 'expense', level: 1, isGroup: true, parentCode: null },
  { code: '8210', name: 'Interest Expense', nameKa: 'საპროცენტო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '8200' },
  { code: '8220', name: 'Non-operating Loss', nameKa: 'არასაოპერაციო ზარალი', type: 'expense', level: 3, isGroup: false, parentCode: '8200' },
  { code: '8290', name: 'Other Non-operating Expenses', nameKa: 'სხვა არასაოპერაციო ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '8200' },

  // 9000 განსაკუთრებული და სხვა შემოსავლები/ხარჯები
  { code: '9100', name: 'Extraordinary Items', nameKa: 'განსაკუთრებული შემოსავლები და ხარჯები', type: 'revenue', level: 1, isGroup: true, parentCode: null },
  { code: '9110', name: 'Extraordinary Income', nameKa: 'განსაკუთრებული შემოსავლები', type: 'revenue', level: 3, isGroup: false, parentCode: '9100' },
  { code: '9120', name: 'Extraordinary Expenses', nameKa: 'განსაკუთრებული ხარჯები', type: 'expense', level: 3, isGroup: false, parentCode: '9100' },

  { code: '9200', name: 'Other Expenses', nameKa: 'სხვა ხარჯები', type: 'expense', level: 2, isGroup: true, parentCode: null },
  { code: '9210', name: 'Profit Tax', nameKa: 'მოგების გადასახადი', type: 'expense', level: 3, isGroup: false, parentCode: '9200' },
];

export async function seedAccountsForCompany(companyId: string, force = false): Promise<number> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const existing = await client.query(
      'SELECT COUNT(*)::int AS c FROM accounts WHERE company_id = $1',
      [companyId]
    );
    if (existing.rows[0].c > 0) {
      if (!force) {
        console.log(`[seed] company ${companyId} already has ${existing.rows[0].c} accounts, skipping (pass force=true to reset)`);
        return 0;
      }
      console.log(`[seed] force=true — deleting existing ${existing.rows[0].c} accounts for ${companyId}`);
      // Delete journal lines first (FK), then journal entries, then accounts
      await client.query(
        `DELETE FROM journal_lines WHERE account_id IN (SELECT id FROM accounts WHERE company_id = $1)`,
        [companyId]
      );
      await client.query(`DELETE FROM journal_entries WHERE company_id = $1`, [companyId]);
      await client.query(`DELETE FROM accounts WHERE company_id = $1`, [companyId]);
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
  const force = process.argv.includes('--force');
  if (!companyId) {
    console.error('Usage: npx tsx src/db/seed-accounts.ts <company-id> [--force]');
    process.exit(1);
  }
  seedAccountsForCompany(companyId, force).catch((e) => {
    console.error('Seed error:', e.message);
    process.exit(1);
  });
}
