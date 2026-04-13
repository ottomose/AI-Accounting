export const OCR_RECEIPT = `გთხოვთ, ამოიცანი ამ ჩეკიდან/ქვითრიდან შემდეგი ინფორმაცია:

1. **თარიღი** — ტრანზაქციის თარიღი (ISO ფორმატი: YYYY-MM-DD)
2. **თანხა** — საერთო თანხა (რიცხვითი მნიშვნელობა)
3. **ვალუტა** — GEL, USD, EUR და ა.შ.
4. **გადამხდელი/გამყიდველი** — ორგანიზაციის სახელი
5. **საიდენტიფიკაციო ნომერი** — გადამხდელის/გამყიდველის საგადასახადო ნომერი (თუ მითითებულია)
6. **დანიშნულება** — რისთვის იყო გადახდა
7. **დღგ** — დღგ-ს თანხა (თუ ცალკე მითითებულია)
8. **გადახდის მეთოდი** — ნაღდი/ბარათი/გადარიცხვა

პასუხი დააბრუნე JSON ფორმატით:
{
  "date": "YYYY-MM-DD",
  "amount": number,
  "currency": "GEL",
  "vendor": "string",
  "vendorTaxId": "string | null",
  "purpose": "string",
  "vat": number | null,
  "paymentMethod": "cash | card | transfer",
  "confidence": number (0-100),
  "rawText": "ამოცნობილი ტექსტი სრულად"
}`;

export const OCR_INVOICE = `ამოიცანი ამ ინვოისიდან/ზედნადებიდან სრული ინფორმაცია:

1. **ინვოისის ნომერი**
2. **თარიღი** (გამოწერის და ვადის)
3. **გამყიდველი** — სახელი, საიდენტიფიკაციო ნომერი, მისამართი
4. **მყიდველი** — სახელი, საიდენტიფიკაციო ნომერი, მისამართი
5. **სტრიქონები (line items)**:
   - აღწერა
   - რაოდენობა
   - ფასი (ერთეულის)
   - თანხა
6. **ქვეჯამი** (subtotal)
7. **დღგ** (18%)
8. **ჯამი** (total)
9. **ვალუტა**

პასუხი JSON ფორმატით:
{
  "invoiceNumber": "string",
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD | null",
  "vendor": { "name": "string", "taxId": "string", "address": "string" },
  "buyer": { "name": "string", "taxId": "string", "address": "string" },
  "lineItems": [{ "description": "string", "quantity": number, "unitPrice": number, "amount": number }],
  "subtotal": number,
  "vat": number,
  "total": number,
  "currency": "GEL",
  "confidence": number (0-100)
}`;

export const OCR_BANK_STATEMENT = `ამოიცანი ამ საბანკო ამონაწერიდან ტრანზაქციების ცხრილი:

თითოეული ტრანზაქციისთვის:
1. **თარიღი**
2. **აღწერა/დანიშნულება**
3. **დებეტი** (გასავალი) ან **კრედიტი** (შემოსავალი)
4. **ნაშთი** (ტრანზაქციის შემდეგ)
5. **კონტრაგენტი** (თუ მითითებულია)

პასუხი JSON ფორმატით:
{
  "accountNumber": "string",
  "bankName": "string",
  "currency": "GEL",
  "periodStart": "YYYY-MM-DD",
  "periodEnd": "YYYY-MM-DD",
  "openingBalance": number,
  "closingBalance": number,
  "transactions": [{
    "date": "YYYY-MM-DD",
    "description": "string",
    "debit": number | null,
    "credit": number | null,
    "balance": number,
    "counterparty": "string | null"
  }],
  "confidence": number (0-100)
}`;

export const CATEGORIZE = `მოცემული ტრანზაქციის ინფორმაციის მიხედვით, განსაზღვრე რომელ ბასს ანგარიშებს ეკუთვნის ეს ტრანზაქცია.

ტრანზაქციის დეტალები:
- აღწერა: {{description}}
- თანხა: {{amount}} {{currency}}
- კონტრაგენტი: {{counterparty}}

გამოიყენე categorize_transaction tool და დააბრუნე:
1. დებეტის ანგარიში (account_id და code)
2. კრედიტის ანგარიში (account_id და code)
3. confidence score
4. მიზეზი (reasoning) — რატომ ეს ანგარიშები

გაითვალისწინე:
- ხარჯები → 5xxx ანგარიშები (დებეტი ხარჯი, კრედიტი ფულადი საშუალება/ვალდებულება)
- შემოსავლები → 4xxx ანგარიშები (დებეტი ფულადი საშუალება, კრედიტი შემოსავალი)
- აქტივების შეძენა → 1xxx ანგარიშები
- ვალდებულებები → 2xxx ანგარიშები`;

export const CHAT_CLIENT = `მომხმარებელი არის კლიენტი (არა ბუღალტერი).
პასუხობ მარტივად, გასაგები ენით, ქართულად.
ტექნიკურ ტერმინებს ხსნი მარტივი სიტყვებით.
არ იყენებ ბუღალტრულ ჟარგონს მომხმარებელთან საუბრისას.
თუ რამე არ იცი ან არ ხარ დარწმუნებული — პირდაპირ უთხარი, ნუ გამოიცნობ.`;

export const CHAT_OPERATOR = `მომხმარებელი არის ოპერატორი/ბუღალტერი.
შეგიძლია ტექნიკური ტერმინოლოგიის გამოყენება.
ხაზგასმით მიუთითე ანგარიშის კოდები, დებეტ-კრედიტ ხაზები.
თუ ტრანზაქციას ხელით შემოწმება სჭირდება — მონიშნე flag_for_review-ით.
თუ მომხმარებელი ითხოვს ანგარიშგებას — გამოიყენე generate_report tool.`;
