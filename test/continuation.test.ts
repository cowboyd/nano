import expect from 'expect';
import { describe, it } from 'mocha';
import { evaluate, shift } from '../src/continuation';

describe('continuation', () => {
  it('can raise errors', () => {
    expect(() => evaluate(function*() {
      yield* shift(function*(k) {
        k.throw(new Error('boom!'));
      })
    })).toThrowError('boom!');
  });

  it('can catch errors', () => {
    expect(evaluate(function*() {
      try {
        yield* shift(function*(k) {
          return k.throw(new Error('boom!'))
        });
        return "did not throw";
      } catch (error) {
        return (error as Error).message;
      }
    })).toEqual("boom!");
  });

  it('allows you to return', () => {
    expect(evaluate(function*() {
      yield* shift(function*(k) {
        return k.return('hello');
      });
    })).toEqual('hello');
  });
});
