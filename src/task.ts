import { Operation, Outcome, shift, reset } from './continuation';
import { capture, release } from './capture';
export interface Task<T = unknown> extends Operation<T> {
  //halt(): Operation<T>;
}

export function* createTask<T>(block: () => Operation<T>): Operation<Task<T>> {
  let children = new Set<any>();
  let state = { children, *halt() {} };
  let outcome: Outcome<T>;
  let watchers: any[] = [];

  let start = yield* reset<(state: any) => Operation<T>>(function*() {

    yield* shift<void>(function*(k) {
      return function*(state: any) {
        state.halt = function* halt() {};
        return yield* k()(state);
      }
    })

    outcome = yield* capture(block);

    for (let k = watchers.shift(); !!k; k = watchers.shift()) {
      k(outcome);
    }

    return function*() { return state };
  });

  yield* start(state);

  return {
    //*halt() { return yield* state.halt(); },
    *[Symbol.iterator]() {
      if (outcome) {
        return yield* release(outcome);
      } else {
        return yield* shift(function*(k) {
          watchers.push(k);
        })
      }
    }
  } as Task<T>;
}
