import { Operation, Outcome, shift, reset, Continuation } from './continuation';
import { capture, release } from './capture';

export interface Task<T = unknown> extends Operation<T> {
  halt(): Operation<T>;
}

export function* createTask<T>(block: () => Operation<T>): Operation<Task<T>> {
  let children = new Set<Task>();
  let state = { children };
  let outcome: Outcome<T>;
  let watchers: any[] = [];
  let continuation = (x => x) as Continuation;
  let start = yield* reset<(state: any) => Operation<T>>(function*() {

    yield* shift<void>(function*(k) {
      continuation = k;
      return function*(state: any) {
        return yield* k()(state);
      }
    })

    outcome = yield* capture(block);

    let order = [...children];
    for (let child = order.shift(); !!child; child = order.shift()) {
      yield* child.halt();
    }

    for (let k = watchers.shift(); !!k; k = watchers.shift()) {
      k(outcome);
    }

    return function*() { return state };
  });

  yield* start(state);


  return {
    *halt() {
      continuation.return({});
    },
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

export function* suspend() {
  return yield* shift<void>(function*() {
    return function*(state: any) { return state; }
  });
}

export function* spawn<T>(block: () => Operation<T>): Operation<Task<T>> {
  return yield* shift<Task<T>>(function*(k) {
    let child = yield* createTask(block);
    return function*({ children }: any) {
      children.add(child);
      return yield* k(child)({ children });
    }
  })
}
