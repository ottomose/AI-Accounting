import Anthropic from '@anthropic-ai/sdk';
import type { ParsedTransaction } from './types';
import type { Suggestion } from './categorize';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
const MODEL = process.env.AI_MODEL ?? 'claude-sonnet-4-20250514';
const BATCH_SIZE = 25;

interface AccountRef { code: string; nameKa: string; type: string }

const SYSTEM = `შენ ხარ ქართული ბასს-ის ბუღალტერი. მომხმარებელი გიგზავნის ტრანზაქციების ჩამონათვალს საბანკო ამონაწერიდან.
თითოეული ტრანზაქციისთვის განსაზღვრე debit და credit ანგარიშის კოდი მოცემული ანგარიშთა გეგმიდან.
საბანკო ანგარიშია 1232 (GEL). შემოსული თანხისთვის debit = 1232; გასული თანხისთვის credit = 1232.
პასუხი უნდა იყოს ზუსტად JSON array — შენიშვნების გარეშე, markdown-ის გარეშე.
თითოეული ობიექტი: {"i": <index>, "d": "<debit_code>", "c": "<credit_code>", "r": "<მოკლე მიზეზი ქართულად>", "review": <true|false>}
review = true, თუ ბუნდოვანია და ოპერატორმა უნდა დაადასტუროს.`;

export async function aiCategorizeBatch(
  transactions: ParsedTransaction[],
  indices: number[], // original indices into a larger list
  accounts: AccountRef[]
): Promise<Map<number, Suggestion>> {
  if (transactions.length === 0) return new Map();

  const result = new Map<number, Suggestion>();

  // Split into batches
  for (let start = 0; start < transactions.length; start += BATCH_SIZE) {
    const chunk = transactions.slice(start, start + BATCH_SIZE);
    const chunkIndices = indices.slice(start, start + BATCH_SIZE);

    const accountsList = accounts
      .map((a) => `${a.code} | ${a.nameKa} (${a.type})`)
      .join('\n');

    const txList = chunk
      .map((tx, i) => {
        const dir = tx.direction === 'in' ? 'შემოსული' : 'გასული';
        return `[${i}] ${tx.date} | ${dir} ${tx.amount} ${tx.currency || 'GEL'} | ${tx.description}${tx.partnerName ? ` | partner: ${tx.partnerName}` : ''}${tx.bankTransactionType ? ` | type: ${tx.bankTransactionType}` : ''}`;
      })
      .join('\n');

    const userMsg = `ანგარიშთა გეგმა:\n${accountsList}\n\nტრანზაქციები:\n${txList}\n\nდააბრუნე JSON array.`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    });

    let rawText = '';
    for (const block of response.content) {
      if (block.type === 'text') rawText += block.text;
    }

    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) continue;

    try {
      const parsed = JSON.parse(match[0]) as Array<{
        i: number;
        d: string;
        c: string;
        r: string;
        review?: boolean;
      }>;
      for (const item of parsed) {
        const origIndex = chunkIndices[item.i];
        if (origIndex === undefined) continue;
        result.set(origIndex, {
          debitAccountCode: item.d,
          creditAccountCode: item.c,
          confidence: 'medium',
          reason: item.r || 'AI კატეგორიზაცია',
          needsReview: item.review ?? true,
        });
      }
    } catch (err) {
      console.error('[aiCategorizeBatch] JSON parse failed:', err);
    }
  }

  return result;
}
