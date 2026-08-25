import { act } from "react";
import { createRoot } from "react-dom/client";

/**
 * Mount a component into a real DOM and let its effects settle.
 *
 * Deliberately thin — no testing-library. What these tests assert is which
 * network calls a page makes on mount and whether it renders what came back,
 * and that needs a root, an act() and textContent, not a query DSL.
 *
 * `act` flushes effects and the microtasks they await, so a page whose data
 * arrives from a resolved promise has already rendered by the time this returns.
 */
export async function render(element) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(element);
  });

  return {
    container,
    text: () => container.textContent || "",
    /** Every button whose label contains `label`, case-insensitive. */
    buttons: (label) =>
      [...container.querySelectorAll("button")].filter((b) =>
        (b.textContent || "").toLowerCase().includes(label.toLowerCase())
      ),
    /** Click and flush whatever the handler kicked off. */
    click: async (node) => {
      await act(async () => {
        node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      });
    },
    /** Type into a textarea/input the way React's onChange expects. */
    type: async (node, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        node instanceof window.HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype,
        "value"
      ).set;
      await act(async () => {
        setter.call(node, value);
        node.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/**
 * A profile payload as the backend would send one.
 *
 * An unrevealed profile carries the pseudonym and a null email — the real name
 * is never in the response — so tests that assert on anonymity are asserting
 * against the shape the server actually produces.
 */
export function profileFixture(overrides = {}) {
  return {
    user_id: "u1",
    name: "Anonymous Candidate",
    email: null,
    role: "candidate",
    revealed: false,
    ...overrides,
  };
}
