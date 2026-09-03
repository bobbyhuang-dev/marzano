import { MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";

import App from "@/App";
import { TRANSITION } from "@/lib/motion";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* One default for every JS animation, and one place that decides about
        reduced motion: positions and layout go instant, opacity still fades. */}
    <MotionConfig transition={TRANSITION.base} reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
