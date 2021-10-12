import { Operation, shift, reset, Continuation, evaluate, Continue } from './continuation';
import { createDestiny } from './destiny';
import { capture, release, catchHalt, Outcome, halted } from './outcome';

export interface Task<T = unknown> extends Operation<T>, Promise<T> {
  halt(): Operation<void>;
  outcome(): Operation<Outcome<T>>;
}

interface TaskState<T = unknown> {
  children: Set<Task>;
  settle: Continue<Outcome<T>>;
}

type Operator = Operation<(state: TaskState) => TaskState>;

export function* createTask<T>(block: () => Operation<T>): Operation<Task<T>> {
  let children = new Set<Task>();
  let [finish, finished] = yield* createDestiny<T>();
  let promise = new Promise<T>((resolve, reject) => {
    evaluate(function*() {
      try {
        resolve(yield* release(yield* finished));
      } catch (error) {
        reject(error);
      }
    });
  })

  return yield* reset<Task<T>>(function*() {

    let outcome = yield* shift<Outcome<T>>(function*(k) {
      function settle(outcome: Outcome<T>) {
        if (!!outcome) {
          k(outcome);
        }
      }

      let stop = yield* runState(block, { children, settle });

      let task: Task<T> = {
        *halt() {
          settle(halted<T>());
          stop();
          return yield* catchHalt(yield* finished);
        },
        outcome: () => finished,
        then: (...args) => promise.then(...args),
        catch: (...args) => promise.catch(...args),
        finally: (...args) => promise.finally(...args),
        [Symbol.toStringTag]: 'Task',
        *[Symbol.iterator]() {
          return yield* release(yield* finished);
        }
      };
      return task;
    });

    let order = [...children];
    for (let child = order.shift(); child; child = order.shift()) {
      yield* child.halt();
    }
    finish(outcome);
  });
}

function* runState<T>(block: () => Operation<T>, state: TaskState<T>): Operation<() => Operation<void>> {
  let continuation = (x => x) as Continuation;
  let start = yield* reset<Continue<TaskState<T>>>(function*() {
    continuation = yield* shift<Continuation>(function*(k): Operator {
      return state => k(k)(state);
    })
    state.settle(yield* capture(block));
    return function*() { return state; };
  });
  start(state);
  return () => continuation.return({});
};


export function* suspend() {
  return yield* perform(function*() { });
}

export function* spawn<T>(block: () => Operation<T>): Operation<Task<T>> {
  return yield* shift<Task<T>>(function*(k): Operator {
    let child = yield* createTask(block);

    return function(state) {
      evaluate(function*() {
        let outcome = yield* child.outcome();
        state.children.delete(child);
        if (outcome.type === 'errored') {
          state.settle(outcome)
        }
      });
      state.children.add(child);
      return k(child)(state);
    }
  })
}

export function* perform<T>(block: (resolve: Continue<T>, reject: Continue<Error>) => Operation<void>): Operation<T> {
  return yield* shift<T>(function*(k): Operator {
    yield* block(k, k.throw);
    return state => state;
  })
}

export function* sleep(duration: number): Operation<void> {
  yield* perform(function*(resolve) {
    let timeoutId = setTimeout(resolve, duration);
    try {
      yield* suspend();
    } finally {
      clearTimeout(timeoutId);
    }
  })
}

export function* resource<T>(init: () => Operation<T>): Operation<T> {
  return yield* perform(function*(resolve, reject) {
    yield* spawn(function*() { //resource task
      try {
        let value = yield* init();
        resolve(value);
      } catch(error) {
        reject(error as Error)
      }
      yield* suspend(); // resource tasks suspends
    });
  });
}
