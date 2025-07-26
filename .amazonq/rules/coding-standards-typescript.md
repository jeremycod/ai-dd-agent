# TypeScript Coding Standards

All TypeScript code in this project must adhere to the following standards to ensure consistency, readability, and maintainability.

## 1. Type Safety and Strictness
- **Explicit Types:** All function parameters, return values, and significant variables must have explicit type annotations. Avoid `any` unless absolutely necessary and justified with a comment.
- **Strict Null Checks:** Ensure `strictNullChecks` is enabled in `tsconfig.json`. Handle `null` and `undefined` explicitly where they might occur.
- **Enums:** Prefer `const enum` for simple, compile-time constant enums. For runtime enums, use regular `enum` or union types with literal strings if string enums are sufficient.

## 2. Naming Conventions
- **CamelCase for Variables/Functions:** `myVariableName`, `doSomethingCool()`.
- **PascalCase for Classes/Interfaces/Types:** `MyClass`, `IDataProvider`, `DiagnosticCase`.
- **CONSTANT_CASE for Global Constants:** `MAX_RETRIES`, `DEFAULT_TIMEOUT`.
- **File Naming:** `kebab-case` for file names (e.g., `data-collection.ts`, `problem-categorization.ts`).

## 3. Immutability
- **Prefer `const` over `let`:** Use `const` by default for variables that are not reassigned.
- **Readonly Properties:** Use `readonly` for class properties that are set only during initialization.
- **Immutable Data Structures:** Favor immutability where possible, especially for state objects passed through the LangGraph workflow. Avoid direct modification of `AgentState` within nodes; instead, return new state objects or use reducer functions as intended by LangGraph.

## 4. Error Handling
- **Asynchronous Error Handling:** All asynchronous operations (Promises) must include proper error handling (e.g., `try-catch` blocks, `.catch()` for Promises, or `Promise.allSettled` as already used).
- **Custom Error Classes:** Define custom error classes for domain-specific errors (e.g., `InvalidEnvironmentError`, `GenieAPIError`) to make error identification easier.
- **Graceful Degradation:** When external APIs are unavailable, ensure the system can gracefully degrade or provide informative error messages, as described in `project-workflows.md`.

## 5. Modularity and Reusability
- **Single Responsibility Principle:** Each file, function, and class should have a single, clearly defined responsibility.
- **Small Functions:** Keep functions small and focused.
- **Dependency Injection:** Favor dependency injection for external services (Datadog client, Mongo client) to improve testability and modularity.

## 6. Asynchronous Programming
- **Async/Await:** Prefer `async/await` for asynchronous code readability. Avoid deeply nested callback functions.
- **Promise.allSettled:** Continue using `Promise.allSettled` for parallel operations to ensure robust error handling and avoid workflow breaks from single failures.

## 7. Logging
- **Structured Logging:** Use structured logging (e.g., JSON logs) for all important events, errors, and diagnostic steps.
- **Logging Levels:** Use appropriate logging levels (debug, info, warn, error) for different severities.
- **Sensitive Data:** Never log sensitive user information or production secrets. Mask or redact sensitive data.