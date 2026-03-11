import { useState, useEffect } from "react";

/**
 * Returns the visual viewport height, which shrinks when the mobile
 * virtual keyboard opens. Falls back to window.innerHeight.
 */
export function useVisualViewport(): number {
  const [height, setHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => setHeight(vv.height);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return height;
}
