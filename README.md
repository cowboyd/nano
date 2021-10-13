## nano

A controller-free implementation of [Effection][] primitives based entirely
on delimited continuations.

It works by making generators themselves the fundamental unit of composition, so
as a result, there is no need to explicitly "drive" them with a controller.
Instead, tasks are driven at the edges of the computation by directly invoking
continuations. For example, even `halt()` just invokes a continuation of a
computation.

Operations are able to access and compose task state using a continuation based
implementation of the [state monad pattern][].

This simplification of the runtime by basing it on absurdly powerful
control-flow abstractions has several key consequences.

#### Unified `Operation` type

Because the only things that a generator may
yield are `Reset` and `Shift` values, it means that every operation is just a
composition of resets and shifts at the end of which is a return value. As such,
only one operation type is needed:

``` typescript
export interface Operation<T> {
  [Symbol.iterator](): Iterator<Reset | Shift, T, any>;
}
```
#### TypeScript Just Works™

Since operations are all consumed as return
values and not yielded values, the TypeScript compiler can trivially
discriminate the type of the left-hand side of an assignment. This is one of the
weaknesses of both Effection v1 and v2

``` typescript
function* () {
  // TS knows that this is a `Task<string>`
  let task = yield* spawn(function*() { return "Hello!" });

  // TS knows that this is a `string`
  let message = yield* task;
}
```

#### "Thin" operations

There is no need to create a separate task object just to compute
intermediate values. Tasks are only needed to compute values
concurrently. In other words, there is no `yieldingTo` task. Instead,
using simple continuations, operations can be "stitched" inline into
the body of a task using the `perform()` operation, but still compose
well with the context in which they are running


#### "Thin" combinators

Because intermediate values are "thin", it means that combinator
operations like `all` do not need any special handling. They
seemlessly compose with the surrounding context.  Perhaps the biggest
indicator of the power of this pattern can be seen in the
implementation of resource. It is written completely in user-space
without needing any hooks from the core:

``` typescript
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
```

It is interesting to note that all of the elements of Effection
resources are there: the resource task, the init function running
inside of the resource task, the various elements being shut down at
the right time. The only difference is that it can be expressed as
simple function without any "scope switching" logic to manage where
child tasks end up. Instead, because of "thin" perform, the `spawn()`
composes with the enclosing task. And also, anything in `init()`
composes cleanly into the spawned resource task.

``` typescript
function* run() {
  let server = yield* resource(function*() {
    let http = createServer();
    http.listen();
    yield* spawn(function*() {
      try {
        yield* suspend();
      } finally {
        http.close();
      }
    });
    yield* once(http, 'listening');
    return server;
  });
```
Because `init()` is thin, the "teardown" task that closes the server is spawned
into the resource task.

### Trade Offs

#### `yield*` all the things

Instead of using `yield` in lieu of `await`, you would use `yield*` everywhere.
This has a lot of advantages from allowing you to "inline" operations to compose
well with the enclosing scope, to making it very TypeScript friendly. However,
`yield*` this is definitely "weird", and I'd say even weirder and rarer than
`yield` which might turn some people off.

#### `Promise` is not yieldable

The only things that can be yielded by a generator are `Reset` and
`Shift`, so in order to consume a promise, you would need to have a
function that decomposed it into `shift` and `reset` (probably via
`perform`). E.g. `yield* waitFor(promise)`. It is possible, that you
could make the `Control` type `Reset | Shift | Promise`, but that
would introduce inconsistency int that  you'd be using `yield* operation`
everywhere else except for promises which would be `yield promise`. That could
be confusing, along with the fact that using bare `yield` for promises would
suffer from the same issues typing issues as in Effection v1 and v2.

#### no implicit suspend

For the same reason that `Promise` is not yieldable, neither is `undefined`.
Since it is not iterable, it cannot be used with a `yield*` expression which
means that you must have an explicit `suspend()` operation if that's what you
want your task to do. Again, we could include `undefined` in the `Control` type,
but it feels awkward to sometimes use `yield` and sometimes `yield*` Of all the
clear departures from the old API, I think this is not very controversial.

#### Inspector may be very different

With the sparse task tree that only has tasks for concurrent operations, it is a
big unknown how we will generate the visualization for operations on the stack.
Will this radically affect how we generate our visualization?

[Effection]: https://frontside.com/effection
[state monad pattern]: https://github.com/cowboyd/delimited-continuations-tutorial/blob/main/exercise-9.ts
