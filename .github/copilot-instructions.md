# GitHub Copilot Instructions (Strict Functional & Immutable)

These rules are **mandatory**. All generated code must comply.
If compliance is not possible, stop and ask for explicit instructions.

---

## Runtime & Tooling (Non-Negotiable)

- Always use **Bun**.
- Always use **bun:test** for unit tests.
- Never suggest or use:
  - npm
  - yarn
  - pnpm
  - jest
  - vitest
  - node-specific globals unless explicitly supported by Bun

---

## Functional Programming (Strict Enforcement)

### REQUIRED

- All code must be **100% functional**.
- Prefer:
  - pure functions
  - explicit inputs and outputs
  - function composition
- All data structures must be **immutable**.
- All logic must be referentially transparent.

### FORBIDDEN

- Classes
- `this`
- Prototypes
- Inheritance
- Hidden or implicit state
- Side effects outside explicitly named I/O boundaries

---

## Immutability Rules (Critical)

### ABSOLUTELY FORBIDDEN

- Variable reassignment
  ```ts
  let x = 1
  x = 2
  ```
- Object or array mutation
  ```ts
  obj.value = 1
  arr.push(1)
  arr[0] = 2
  ```
- Mutating array methods:
  - `push`
  - `pop`
  - `shift`
  - `unshift`
  - `splice`
  - `sort`
  - `reverse`

### REQUIRED INSTEAD

- Always create new values:
  ```ts
  const next = [...arr, value]
  const updated = { ...obj, value: 1 }
  const sorted = [...arr].toSorted()
  ```

---

## Side Effects & I/O Boundaries

- Side effects must be:
  - explicit
  - isolated
  - placed at system boundaries
- Core domain logic must be pure.
- Never mix computation and I/O.

```ts
// ❌ forbidden
const calculate = (x: number) => {
  console.log(x)
  return x * 2
}
```

---

## Formatting (Strict)

- Prettier is enforced with **no semicolons**.
- Never emit semicolons.
- Never override Prettier formatting.

---

## Testing (Strict Side‑Car Rule)

- Every source file **must** have a side‑car test:
  - `src/example.ts`
  - `src/example.test.ts`
- Always use **bun:test**.
- Tests must be:
  - deterministic
  - isolated
  - order‑independent
  - runnable in parallel
  - runnable in any order

### Test Isolation (Critical)

- **All mocks must be reset** in `beforeEach` or `afterEach` hooks.
- Tests **must not share state** between runs.
- Tests **must not depend on execution order**.
- Tests **must work correctly when run in parallel**.
- Each test must set up its own preconditions.
- Each test must clean up its own side effects.

```ts
// ✅ correct: isolated test with mock reset
import { describe, test, expect, mock, beforeEach } from 'bun:test'

const mockFn = mock(() => 'value')

describe('example', () => {
  beforeEach(() => {
    mockFn.mockClear() // Reset mock between tests
  })

  test('first test', () => {
    mockFn()
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  test('second test', () => {
    mockFn()
    expect(mockFn).toHaveBeenCalledTimes(1) // Still passes
  })
})
```

```ts
// ❌ forbidden: shared state between tests
let sharedValue = 0

test('first', () => {
  sharedValue++
  expect(sharedValue).toBe(1)
})

test('second', () => {
  sharedValue++
  expect(sharedValue).toBe(2) // Fails if run in different order
})
```

---

## Test Integrity (Absolute Rule)

- **Never modify existing working tests** to make new code pass.
- If tests fail:
  - fix the implementation
  - do not weaken assertions
- Only modify tests if explicitly instructed.

If a test appears incorrect:

- Stop and ask for clarification.

---

## Anti‑Patterns (Never Generate These)

### ❌ Object‑Oriented Code

```ts
class User {
  constructor(private name: string) {}
}
```

### ❌ Hidden Mutation

```ts
const add = (arr: number[]) => {
  arr.push(1)
  return arr
}
```

### ❌ Shared State

```ts
let cache: Record<string, string> = {}
```

### ❌ Weak or Loosened Tests

```ts
expect(result).toBeDefined()
```

### ❌ Conditional Test Logic

```ts
if (process.env.CI) {
  expect(result).toBe(1)
}
```

---

## Required Defaults

- Use `const` exclusively.
- Prefer `map`, `filter`, `reduce` over loops.
- Avoid `for`, `while`, `switch`.
- Prefer expressions over statements.
- Prefer small, composable functions.

---

## Conflict Resolution

- If any rule conflicts with:
  - existing code
  - existing tests
  - repository conventions

➡️ **Stop and ask for clarification. Do not guess.**
