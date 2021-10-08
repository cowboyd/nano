export type Outcome<T> =
  { type: 'completed', value: T } |
  { type: 'errored', error: Error };

export interface Continue<T = any, R = any> {
  (value: T): R;
}

export interface Fail<R = any> {
  (error: Error): R;
}

export interface Continuation<T = any, R = any>  extends Continue<T, R> {
 //reject: Fail<R>;
}

export interface Iteration<T> {
  [Symbol.iterator](): Iterator<Control, T, any>;
}

export type  Operation<T = unknown> = Iteration<T> | (() => Operation<T>);

export type Control =
  { type: 'reset', block: () => Operation } |
  { type: 'shift', block: (k: Continuation) => Operation }

export function* reset<T>(block: () => Operation): Operation<T> {
  return yield { type: 'reset', block };
}

export function* shift<T>(block: (k: Continuation<T>) => Operation): Operation<T> {
  return yield { type: 'shift', block };
}

export function evaluate<T>(operation: Operation<T>, done: Continue = v => v, value?: unknown): T {
  let block = operation;
  while (typeof block === 'function') {
    block = block();
  }
  let prog = (block)[Symbol.iterator]();
  let next = prog.next(value);
  if (next.done) {
    return done(next.value);
  } else {
    let control = next.value;
    if (control.type === 'reset') {
      return evaluate(control.block, v => evaluate({ [Symbol.iterator]: () => prog }, done, v)) as T;
    } else {
      let k = (value: any) => evaluate({ [Symbol.iterator]: () => prog }, v => v, value);
      //(k as any).reject = (error: Error) => prog.throw?(error)
      return evaluate(() => control.block(k), done) as T;
    }
  }
}
