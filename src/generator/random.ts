export class SeededRandom {
  private state: number;

  public constructor(seed: number) {
    this.state = (Math.trunc(seed) || 1) >>> 0;
    if (this.state === 0) {
      this.state = 1;
    }
  }

  public next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0xffffffff;
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
