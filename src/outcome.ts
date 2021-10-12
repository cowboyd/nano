import type { Operation } from './continuation';

export type Outcome<T> =
  { type: 'completed', value: T } |
  { type: 'errored', error: Error } |
  { type: 'halted' };

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
  } else if (outcome.type === 'errored') {
    throw outcome.error;
  } else {
    throw new Error('halted');
  }
}

export function* catchHalt(outcome: Outcome<unknown>): Operation<void> {
  if (outcome.type === 'errored') {
    throw outcome.error;
  }
}

export function halted<T>(): Outcome<T> {
  return { type: 'halted'};
}

export function completed<T>(value: T): Outcome<T> {
  return { type: 'completed', value };
}

export function errored<T>(error: Error): Outcome<T> {
  return { type: 'errored', error };
}
