import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // The React Compiler is not enabled in this build. Its advisory rules flag deliberate patterns here
    // (syncing URL parameters into local state, ticking clocks that read the time during render), so they warn
    // rather than fail the lint.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  { ignores: [".next/**", "out/**", "qa/**", "node_modules/**", "next-env.d.ts", "*.config.*"] },
];
export default config;
