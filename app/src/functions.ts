// chunks([1, 2, 3, 4, 5], 2) => [[1, 2], [3, 4], [5]]
export function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
  let i = 0;
  while (true) {
    if (i > arr.length) break;
    const j = i + n;
    yield arr.slice(i, j);
    i = j;
  }
}

// chunksExact([1, 2, 3, 4, 5], 2) => [[1, 2], [3, 4]]
export function* chunksExact<T>(arr: T[], n: number): Generator<T[], void> {
  let i = 0;
  while (true) {
    const j = i + n;
    if (j > arr.length) break;
    yield arr.slice(i, j);
    i = j;
  }
}

// converts all T1 to T2 and puts them in sublists of n if there are more than 2n
export function createSublists<T1, T2, S>(
  list: T1[],
  n: number,
  convert: (t: T1, n: number) => T2,
  makeSublist: (t: T2[], n: number) => S,
): T2[] | S[] {
  const sublistMinimum = n * 2;
  const t2: T2[] = list.map(convert);
  if (t2.length < sublistMinimum) {
    return t2;
  } else {
    return chunks(t2, n)
      .map((x) => [...x])
      .map(makeSublist)
      .toArray();
  }
}

// [0.0-1.0] -> [0-255]
export function roundTo255(n: number): number {
  return Math.round(n * 255.0);
}
