import type { Operation, Outcome } from './continuation';

export function* capture<T>(block: () => Operation<T>): Operation<Outcome<T>> {
  try {
    let value = yield* block();
    return { type: 'completed', value };
  } catch (error) {
    return { type: 'errored', error: error as Error }
  }
}

export function* release<T>(outcome: Outcome<T>): Operation<T> {
  if (outcome.type === 'completed') {
    return outcome.value;
  } else {
    throw outcome.error;
  }
}
