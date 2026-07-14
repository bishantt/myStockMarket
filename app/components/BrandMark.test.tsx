import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandMark } from "./BrandMark";

/**
 * BrandMark — the mark's one door (plan 5.7).
 *
 * Two contracts are worth a test, and they are the two that break silently.
 */
describe("BrandMark", () => {
  /**
   * THE CLS CONTRACT. An <img> with no width/height reserves no box, so the page reflows the
   * instant the image lands — under the reader's thumb, in the top bar, on every room. It is the
   * cheapest layout shift in the world to ship and one of the hardest to notice on a fast laptop.
   * The dimensions are constants in the component precisely so that this test can be absolute.
   */
  it("always renders with explicit width and height, so it can never shift the layout", () => {
    for (const [size, px] of [["bar", 28], ["inline", 20], ["panel", 96]] as const) {
      const { container, unmount } = render(<BrandMark size={size} />);
      const img = container.querySelector("img");
      expect(img).not.toBeNull();
      expect(img!.getAttribute("width")).toBe(String(px));
      expect(img!.getAttribute("height")).toBe(String(px));
      unmount();
    }
  });

  it("serves the 64px asset to the small lockups and the 192px asset to the login panel", () => {
    const { container, unmount } = render(<BrandMark size="bar" />);
    expect(container.querySelector("img")!.getAttribute("src")).toBe("/icons/brandmark-64.webp");
    unmount();

    const panel = render(<BrandMark size="panel" />);
    expect(panel.container.querySelector("img")!.getAttribute("src")).toBe(
      "/icons/brandmark-192.webp",
    );
  });

  /**
   * THE ALT CONTRACT. Everywhere the mark is used, the product's name is written in text right
   * beside it. An alt of "myStockMarket" there would make a screen reader say the name twice, which
   * is not access, it is noise — so the default is empty, and a caller must ASK for a label.
   */
  it("is decorative by default, and takes a label only when asked", () => {
    const { container, unmount } = render(<BrandMark />);
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
    unmount();

    render(<BrandMark alt="myStockMarket" />);
    expect(screen.getByAltText("myStockMarket")).toBeTruthy();
  });
});
