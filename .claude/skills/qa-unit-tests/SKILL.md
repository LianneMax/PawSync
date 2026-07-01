---
name: qa-unit-tests
description: "Write or review unit tests for QA purposes in this codebase (Vitest). Use whenever the user asks to write unit tests, add test coverage, write a *.test.ts file, or review existing tests for quality. Also trigger on 'add tests for X', 'write QA tests', 'cover this function with tests', or '/qa-unit-tests'. Enforces good practices (AAA structure, isolated mocks, edge/error cases, deterministic) and flags bad practices (testing implementation details, real DB/network calls, over-mocking, flaky time/order dependence, snapshot-everything)."
---

# QA Unit Tests

Stack: **Vitest** (`describe`/`it`/`expect`/`vi`). Tests live next to source as `<name>.test.ts`, colocated in the same folder as the module under test (see `apps/external/src/services/carts/services.carts.test.ts`, `apps/external/src/services/order/order.test.ts`).

Goal: tests that catch real regressions and read as documentation — not tests that exist to pad coverage numbers.

## Good practices

**Structure: Arrange-Act-Assert.** Build inputs, call the function, assert. Group related cases under nested `describe` blocks named after the function/feature being tested.

**One behavior per test.** Test name states the behavior and the case: `"Get cart items subtotal (invalid)"`, `"Get cart items subtotal (regular price total)"`. Reader should know what broke from the test name alone, no need to open the file.

**Test the public contract, not internals.** Call the exported function with realistic inputs and assert on its return value / thrown error / side-effect calls. Don't reach into private state or reimplement the function's logic inside the test to "check the math twice" — that just duplicates the bug into the test.

**Cover the edge and error cases, not just the happy path.** Every test file above pairs a valid case with an invalid one (e.g. negative price → `InvalidCartProductCostError`). At minimum cover: empty/zero input, invalid/negative input, boundary values, and the documented error path.

**Mock only external boundaries.** Mock `prisma`, network calls (`@omni/shared/paymongo/...`, AWS SES), and other modules' side effects with `vi.mock(...)`. Don't mock the function under test or pure helpers it calls internally — that hides the logic you're supposed to be testing.

```ts
vi.mock("@omni/shared/aws-ses/send-email", () => ({
  sendLowStockNotificationEmail: vi.fn(),
}));
```

**Type your mocks.** Give `vi.fn<...>()` explicit arg/return types (see `2c2p.test.ts`'s `OrderUpdateArg`/`CartUpsertArg`) so a signature change breaks the test at compile time, not silently at runtime.

**Use builder functions for fixtures.** When a test needs a realistic object repeatedly, write a small `buildX(overrides = {})` helper with sane defaults plus spread overrides, rather than copy-pasting full objects into every test (see `buildPayload`, `buildFakeOrder` in `2c2p.test.ts`).

**Clean up mocks between tests.** Always reset mock state so one test can't leak into the next:

```ts
afterEach(() => {
  vi.restoreAllMocks();
});
```

**Assert on thrown errors by type/instance, not just "it throws."**

```ts
expect(() => getCartItemsSubtotal(cartItems)).toThrowError(
  new InvalidCartProductCostError(cartItems[0]!.productItem),
);
```

**Keep tests deterministic.** No reliance on real wall-clock time, random IDs, or network/DB state. If time matters, use `vi.useFakeTimers()`/`vi.setSystemTime()`, not `Date.now()` in the test waiting on the real clock.

**Assert on cause, not just outcome, for side-effecting code.** When testing something that calls a mocked dependency (e.g. `prisma.order.update`), assert on the arguments it was called with, not just that the function "completed" — that's what actually proves the right thing happened.

## Bad practices — avoid

- **Testing implementation details.** Asserting on internal call counts/private variables ties the test to refactors that don't change behavior. Test inputs/outputs and the calls to *external* dependencies, not internal structure.
- **Over-mocking.** Mocking so much that the test only proves the mocks return what you told them to. If nearly everything is mocked, ask whether the test is exercising any real logic at all.
- **Hitting real DB/network/filesystem/clock.** Slow, flaky, and not how unit tests should run in CI. Use `vi.mock` for `@omni/db` / `prisma`, external SDKs, email senders, payment gateways.
- **Snapshot-everything.** Blanket `toMatchSnapshot()` on large objects hides what's actually being verified and rubber-stamps regressions on the next `-u`. Prefer explicit `toEqual`/`toBe` assertions on the fields that matter; reserve snapshots for genuinely large/stable structural output.
- **Shared mutable state across tests.** Don't let one `it` block depend on side effects from a prior one (e.g. reusing a mutated fixture object). Each test builds its own data or resets shared fixtures in `beforeEach`.
- **Vague test names.** `"it works"`, `"test 1"` give no signal on failure. Name the behavior and the case.
- **Asserting too loosely.** `expect(result).toBeTruthy()` on a value that should be a specific number/object hides wrong values that still happen to be truthy. Assert the exact expected value.
- **One giant test covering many cases via `if`/loops with `console.log` debugging left in.** Split into separate `it` blocks — failures should pinpoint the exact failing case, not require reading branch logic in the test itself.
- **Catching and swallowing errors in the test itself.** If you wrap the call in `try/catch` to "check" an error without using `expect(...).toThrow()`/`toThrowError()`, a thrown error of the wrong type can pass silently.
- **Forgetting `afterEach` cleanup with `vi.mock`.** Stale mock return values/call counts from a previous test bleed into the next and cause confusing, order-dependent failures.

## When writing tests for a function

1. Read the function under test fully — note every branch, thrown error, and external call.
2. Identify external boundaries it touches (`prisma`, other service modules, SDKs) — these get `vi.mock`, nothing else.
3. Write one `it` per branch/case: at least one happy path, one per error condition, boundary values (zero, empty array, negative).
4. For side-effecting functions, assert on the arguments passed to mocked calls, not just that they were called.
5. Run the suite (`pnpm --filter <app> test` or `turbo test --parallel`) and confirm new tests fail without the fix/feature and pass with it — a test that can't fail proves nothing.
