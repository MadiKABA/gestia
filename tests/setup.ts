import "dotenv/config";
import "@testing-library/jest-dom/vitest";

// jsdom n'implémente ni ResizeObserver ni document.elementFromPoint —
// requis par `input-otp` (OtpInput/PinInput) dès qu'un composant qui
// l'utilise est monté dans un test (sinon erreurs async non catchées après
// la fin du test, voir `input-otp/dist/index.mjs`).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
document.elementFromPoint ??= () => null;
