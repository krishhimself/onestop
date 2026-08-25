import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Only .test.jsx here. The pure-logic suites (pasteDetect, display) are
    // .test.js and run under `node --test`, which needs no DOM and no transform;
    // splitting by extension keeps each runner to the files it is right for.
    include: ["src/**/*.test.jsx"],
    // Implementations and call history are cleared between tests, so a call
    // recorded in one test can never be read as the call under test in the next.
    // Each suite re-stubs what it needs in beforeEach.
    mockReset: true,
  },
});
