import { Continuation, Continue, Operation, reset, shift } from './continuation';
import { Outcome } from './outcome';


export type NewDestiny<T> = [Continue<Outcome<T>>, Operation<Outcome<T>>];

export function* createDestiny<T>(): Operation<NewDestiny<T>> {
  let outcome: Outcome<T>;
  let watchers: Continuation<Outcome<T>>[] = [];

  let produce = yield* reset<Continue<Outcome<T>>>(function*() {
    outcome = yield* shift<Outcome<T>>(function*(k) { return k; });

    for (let k = watchers.shift(); k; k = watchers.shift()) {
      k(outcome);
    }
  });

  return [produce, {
    *[Symbol.iterator]() {
      if (outcome) {
        return outcome;
      } else {
        return yield* shift<Outcome<T>>(function*(k) { watchers.push(k); });
      }
    }
  }];
}
