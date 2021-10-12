import { describe, it } from 'mocha';
import expect from 'expect';
import { evaluate } from '../src/continuation';
import { capture } from '../src/outcome';

describe('capture', () => {
  it('can capture completed operations', () => {
    expect(evaluate(() => capture(function*() { return 5 })))
      .toEqual({ type: 'completed', value: 5 });
  });

  it('can capture errored operations', () => {
    expect(evaluate(() => capture(function*() { throw new Error('boom') })))
      .toEqual({ type: 'errored', error: expect.objectContaining({ message: 'boom'}) });
  });
});
