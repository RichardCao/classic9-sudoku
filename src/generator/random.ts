export const MAX_SEED = 0xffffffff;

export function defaultSeed(now = Date.now()): number {
  const seed = Math.trunc(now) % MAX_SEED;
  return seed >= 1 ? seed : 1;
}

export class SeededRandom {
  private state: number;

  public constructor(seed: number) {
    const normalizedSeed = Math.trunc(seed);
    if (!Number.isInteger(normalizedSeed) || normalizedSeed < 1 || normalizedSeed > MAX_SEED) {
      throw new Error('seed must be an integer between 1 and 0xffffffff');
    }
    this.state = normalizedSeed >>> 0;
  }

  public next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }
}

export function shuffleWithRandom<T>(items: readonly T[], random: () => number): T[] {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex]!, clone[index]!];
  }
  return clone;
}
