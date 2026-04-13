import { ConfidenceLevel } from './types';
import type { ConfidenceContext, ConfidenceResult } from './types';

const BASE_SCORE = 50;

interface ScoringRule {
  name: string;
  evaluate: (ctx: ConfidenceContext) => number;
  reason: (ctx: ConfidenceContext, delta: number) => string | null;
}

const rules: ScoringRule[] = [
  {
    name: 'known_counterparty',
    evaluate: (ctx) => (ctx.isKnownCounterparty ? 20 : -25),
    reason: (ctx, delta) =>
      delta > 0
        ? 'ცნობილი კონტრაგენტი (+20)'
        : ctx.isKnownCounterparty
          ? null
          : 'ახალი/უცნობი კონტრაგენტი (-25)',
  },
  {
    name: 'typical_amount',
    evaluate: (ctx) => {
      if (!ctx.isTypicalAmount && ctx.amountRatio > 3) return -15;
      if (ctx.isTypicalAmount) return 10;
      return 0;
    },
    reason: (ctx, delta) => {
      if (delta < 0)
        return `თანხა უჩვეულოდ დიდია (${ctx.amountRatio.toFixed(1)}x საშუალოზე) (-15)`;
      if (delta > 0) return 'თანხა ტიპიურ დიაპაზონშია (+10)';
      return null;
    },
  },
  {
    name: 'specific_account',
    evaluate: (ctx) => (ctx.accountIsSpecific ? 15 : 0),
    reason: (_ctx, delta) =>
      delta > 0 ? 'კონკრეტული ანგარიში მითითებულია (+15)' : null,
  },
  {
    name: 'ocr_fields',
    evaluate: (ctx) => {
      if (ctx.ocrFieldsTotal === 0) return 0;
      const ratio = ctx.ocrFieldsRecognized / ctx.ocrFieldsTotal;
      if (ratio >= 1) return 20;
      if (ratio >= 0.8) return 10;
      if (ratio >= 0.5) return 0;
      return -10;
    },
    reason: (ctx, delta) => {
      if (ctx.ocrFieldsTotal === 0) return null;
      const ratio = ctx.ocrFieldsRecognized / ctx.ocrFieldsTotal;
      if (delta > 0)
        return `OCR: ${ctx.ocrFieldsRecognized}/${ctx.ocrFieldsTotal} ველი ამოცნობილი (${(ratio * 100).toFixed(0)}%) (+${delta})`;
      if (delta < 0)
        return `OCR: მხოლოდ ${ctx.ocrFieldsRecognized}/${ctx.ocrFieldsTotal} ველი ამოცნობილი (${delta})`;
      return null;
    },
  },
  {
    name: 'ocr_confidence',
    evaluate: (ctx) => {
      if (ctx.ocrConfidence === 0) return 0;
      if (ctx.ocrConfidence < 0.6) return -20;
      if (ctx.ocrConfidence < 0.8) return -5;
      return 5;
    },
    reason: (ctx, delta) => {
      if (ctx.ocrConfidence === 0) return null;
      if (delta < -10)
        return `OCR confidence დაბალია (${(ctx.ocrConfidence * 100).toFixed(0)}%) (-20)`;
      if (delta < 0)
        return `OCR confidence საშუალოა (${(ctx.ocrConfidence * 100).toFixed(0)}%) (-5)`;
      return null;
    },
  },
];

function scoreToLevel(score: number): ConfidenceLevel {
  if (score >= 90) return ConfidenceLevel.GREEN;
  if (score >= 70) return ConfidenceLevel.YELLOW;
  return ConfidenceLevel.RED;
}

export function assessConfidence(context: ConfidenceContext): ConfidenceResult {
  let score = BASE_SCORE;
  const reasons: string[] = [];

  for (const rule of rules) {
    const delta = rule.evaluate(context);
    score += delta;
    const reason = rule.reason(context, delta);
    if (reason) {
      reasons.push(reason);
    }
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    level: scoreToLevel(score),
    reasoning: reasons.join('; '),
  };
}

export { scoreToLevel };
