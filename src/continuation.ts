export interface Continue<T = any, R = any> {
  (value: T): R;
}

export interface Continuation<T = any, R = any> extends Continue<T,R> {
  throw(error: Error): R;
  return(value: any): any;
}

export interface Operation<T = unknown> {
  [Symbol.iterator](): Iterator<Control, T, any>;
}

export type Control =
  { type: 'reset', block: () => Operation } |
  { type: 'shift', block: (k: Continuation) => Operation }

export function* reset<T>(block: () => Operation): Operation<T> {
  return yield { type: 'reset', block };
}

export function* shift<T>(block: (k: Continuation<T>) => Operation): Operation<T> {
  return yield { type: 'shift', block };
}

export function evaluate<T>(block: () => Operation<T>, done: Continue = v => v, step: Step = i => i.next()): T {
  let prog = block()[Symbol.iterator]();

  let next = step(prog);
  let continueBlock = () => ({ [Symbol.iterator]: () => prog });
  if (next.done) {
    return done(next.value);
  } else {
    let control = next.value;
    if (control.type === 'reset') {
      return evaluate(control.block, v => evaluate(continueBlock, done, i => i.next(v))) as T;
    } else {
      let id = (value: any) => value;
      let k = (value: any) => evaluate(continueBlock, id, i => i.next(value));
      Object.assign(k, {
        throw: (value: any) => evaluate(continueBlock, id, i => {
          if (i.throw) {
            return i.throw(value);
          } else {
            throw value;
          }
        }),
        return: (value: any) => evaluate(() => ({ [Symbol.iterator]: () => prog }), id, i => i.return ? i.return(value) : value)
      });
      return evaluate(() => control.block(k as Continuation), done) as T;
    }
  }
}

interface Step {
  (iterator: Iterator<Control, any, any>): IteratorResult<Control, any>;
}
