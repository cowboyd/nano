import { Operation, shift, reset } from './continuation';

export function* run<T>(block: () => Operation<T>): Operation<Task<T>> {
  let children = new Set<any>();

  let state = { children, *halt() {} };
  let outcome: T;
  let watchers: any[] = [];

  let start = yield* reset<(state: any) => Operation<T>>(function*() {

    yield* shift(function*(k) {
      return function*(state: any) {
        state.halt = function* halt() {};
        return yield* k()(state);
      }
    })

    outcome = yield* block();

    for (let k = watchers.shift(); !!k; k = watchers.shift()) {
      k(outcome);
    }

    return function*() { return state };
  });

  yield* start(state);

  return {
    halt() { return state.halt(); },
    *[Symbol.iterator]() {
      if (outcome) {
        return outcome;
      } else {
        return yield* shift(function*(k) {
          watchers.push(k);
        })
      }
    }
  };
}
