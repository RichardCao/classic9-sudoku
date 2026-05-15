import type { CandidateMask, Digit } from './types.js';

export const ALL_DIGITS_MASK = 0x1ff;

export function isDigit(value: number): value is Digit {
  return Number.isInteger(value) && value >= 1 && value <= 9;
}

export function maskForDigit(digit: Digit): CandidateMask {
  return 1 << (digit - 1);
}

export function hasDigit(mask: CandidateMask, digit: Digit): boolean {
  return (mask & maskForDigit(digit)) !== 0;
}

export function addDigit(mask: CandidateMask, digit: Digit): CandidateMask {
  return mask | maskForDigit(digit);
}

export function removeDigit(mask: CandidateMask, digit: Digit): CandidateMask {
  return mask & ~maskForDigit(digit);
}

export function countMaskBits(mask: CandidateMask): number {
  let value = mask;
  let count = 0;
  while (value !== 0) {
    value &= value - 1;
    count += 1;
  }
  return count;
}

export function digitsFromMask(mask: CandidateMask): Digit[] {
  const digits: Digit[] = [];
  for (let digit = 1; digit <= 9; digit += 1) {
    if (hasDigit(mask, digit as Digit)) {
      digits.push(digit as Digit);
    }
  }
  return digits;
}

export function maskFromDigits(digits: readonly number[]): CandidateMask {
  let mask = 0;
  for (const digit of digits) {
    if (!isDigit(digit)) {
      throw new Error(`Invalid digit: ${digit}`);
    }
    mask = addDigit(mask, digit);
  }
  return mask;
}
