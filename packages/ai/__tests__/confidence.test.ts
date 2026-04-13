import { describe, it, expect } from 'vitest';
import { assessConfidence, scoreToLevel } from '../src/confidence';
import { ConfidenceLevel } from '../src/types';
import type { ConfidenceContext } from '../src/types';

const baseContext: ConfidenceContext = {
  isKnownCounterparty: false,
  isTypicalAmount: false,
  amountRatio: 1,
  ocrFieldsRecognized: 0,
  ocrFieldsTotal: 0,
  ocrConfidence: 0,
  accountIsSpecific: false,
};

describe('scoreToLevel', () => {
  it('should return GREEN for score >= 90', () => {
    expect(scoreToLevel(90)).toBe(ConfidenceLevel.GREEN);
    expect(scoreToLevel(100)).toBe(ConfidenceLevel.GREEN);
  });

  it('should return YELLOW for score 70-89', () => {
    expect(scoreToLevel(70)).toBe(ConfidenceLevel.YELLOW);
    expect(scoreToLevel(89)).toBe(ConfidenceLevel.YELLOW);
  });

  it('should return RED for score < 70', () => {
    expect(scoreToLevel(69)).toBe(ConfidenceLevel.RED);
    expect(scoreToLevel(0)).toBe(ConfidenceLevel.RED);
  });
});

describe('assessConfidence', () => {
  it('should return base score with neutral context', () => {
    const result = assessConfidence(baseContext);
    // Base 50 - 25 (unknown counterparty) = 25
    expect(result.score).toBeLessThan(50);
    expect(result.level).toBe(ConfidenceLevel.RED);
  });

  it('should boost score for known counterparty', () => {
    const result = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
    });
    // Base 50 + 20 (known) = 70
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('should boost score for typical amount', () => {
    const result = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      isTypicalAmount: true,
    });
    // 50 + 20 (known) + 10 (typical) = 80
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('should penalize unusually large amounts', () => {
    const normal = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      isTypicalAmount: true,
      amountRatio: 1,
    });

    const unusual = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      isTypicalAmount: false,
      amountRatio: 5,
    });

    expect(unusual.score).toBeLessThan(normal.score);
  });

  it('should boost for specific account', () => {
    const generic = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      accountIsSpecific: false,
    });

    const specific = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      accountIsSpecific: true,
    });

    expect(specific.score).toBe(generic.score + 15);
  });

  it('should boost for fully recognized OCR fields', () => {
    const result = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      isTypicalAmount: true,
      accountIsSpecific: true,
      ocrFieldsRecognized: 8,
      ocrFieldsTotal: 8,
      ocrConfidence: 0.95,
    });

    // 50 + 20 + 10 + 15 + 20 + 5 = 120 → clamped to 100
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toBe(ConfidenceLevel.GREEN);
  });

  it('should penalize low OCR confidence', () => {
    const result = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      ocrFieldsRecognized: 3,
      ocrFieldsTotal: 8,
      ocrConfidence: 0.4,
    });

    expect(result.reasoning).toContain('OCR confidence');
    expect(result.score).toBeLessThan(70);
  });

  it('should return GREEN for ideal scenario', () => {
    const result = assessConfidence({
      isKnownCounterparty: true,
      isTypicalAmount: true,
      amountRatio: 1,
      ocrFieldsRecognized: 8,
      ocrFieldsTotal: 8,
      ocrConfidence: 0.95,
      accountIsSpecific: true,
    });

    expect(result.level).toBe(ConfidenceLevel.GREEN);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('should clamp score between 0 and 100', () => {
    // Worst case scenario
    const worst = assessConfidence({
      isKnownCounterparty: false,
      isTypicalAmount: false,
      amountRatio: 10,
      ocrFieldsRecognized: 1,
      ocrFieldsTotal: 10,
      ocrConfidence: 0.3,
      accountIsSpecific: false,
    });

    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it('should include reasoning string', () => {
    const result = assessConfidence({
      ...baseContext,
      isKnownCounterparty: true,
      accountIsSpecific: true,
    });

    expect(result.reasoning).toBeTruthy();
    expect(typeof result.reasoning).toBe('string');
  });
});
