import type { Operation, Outcome } from './continuation';

export function* capture<T>(block: () => Operation<T>): Operation<Outcome<T>> {
  try {
    let value = yield* block();
    return { type: 'completed', value };
  } catch (error) {
    return { type: 'errored', error: error as Error }
  }
}
