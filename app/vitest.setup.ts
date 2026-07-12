/**
 * Runs once before every Vitest file.
 *
 * Two jobs:
 *
 * 1. Install jest-dom's matchers, which give the component tests readable assertions like
 *    `expect(el).toHaveTextContent(...)` instead of poking at DOM internals.
 *
 * 2. Provide an app router. `useRouter()` throws "invariant expected app router to be mounted"
 *    outside a real Next tree, and a component is entitled to use it — the setup card's practice
 *    doorway does, because it has to stamp its timestamp at the MOMENT OF THE CLICK. (The Desk is
 *    served from a cache now, so a timestamp rendered on the server would be the time the page was
 *    GENERATED, not the time the reader saw the card — and that timestamp is what arms the
 *    cooling-off pause.) Rendering that card in a unit test should not require the test to know any
 *    of that, so the router is stubbed here, once.
 *
 *    The stub records nothing and asserts nothing: a test that cares where a navigation went should
 *    mock it explicitly and say so. This only keeps the tree mountable.
 */
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/",
  };
});
