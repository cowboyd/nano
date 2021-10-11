import { describe, it } from 'mocha';
import { createTask, Task, Operation, spawn, suspend } from '../src';
import { evaluate } from '../src/continuation';
import expect from 'expect';

describe('running a task', () => {
  it('can run a simple block', () => {
    expect(evaluate(function*() {
      let task = yield* createTask(function*() { return 5; });
      return yield* task;
    })).toEqual(5);
  });
  describe('a task that fails', () => {

    it('can be created and run without failing', () => {
      expect(run(function*() { throw new Error('boom'); })).toBeDefined();
    });

    it('causes failure when you actually try to access the result', () => {
      expect(() => {
        evaluate(() => run(function*() { throw new Error('boom'); }));
      }).toThrow('boom');
    });
  });


  describe('spawning a subtask', () => {
    it('halts all spawned tasks when the parent completes', () => {
      let halted = false;
      let result = run<string>(function*() {
        yield* spawn(function*() {
          try {
            yield* suspend();
          } finally {
            halted = true;
          }
        })
        return 'done';
      });
      expect(evaluate(function*() { return yield* result })).toEqual('done');
      expect(halted).toEqual(true);
    });
  });
});


function run<T>(block: () => Operation<T>): Task<T> {
  return evaluate(function*() { return yield* createTask(block); } );
}
