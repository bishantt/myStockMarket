/**
 * Runs once before every Vitest file.
 *
 * Its only job is to install jest-dom's matchers, which give the component tests readable
 * assertions like `expect(el).toHaveTextContent(...)` instead of poking at DOM internals.
 */
import "@testing-library/jest-dom/vitest";
