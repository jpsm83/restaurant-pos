/**
 * Measures the auth-card content width for the official Google control.
 *
 * Google Identity Services takes a pixel width capped at 400. The control
 * cannot be told `100%`, so the surrounding container is measured instead and
 * the result is passed back capped to Google's maximum. A ResizeObserver keeps
 * the control aligned when the card changes width.
 */
import { useCallback, useLayoutEffect, useState } from "react";

const MAX_GOOGLE_CONTROL_WIDTH = 400;

export function useGoogleControlWidth() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  const containerRef = useCallback((element: HTMLDivElement | null) => {
    setContainer(element);
  }, []);

  useLayoutEffect(() => {
    if (!container) return;

    const updateWidth = () => {
      const measured = Math.floor(container.getBoundingClientRect().width);
      if (measured <= 0) return;
      setWidth(Math.min(measured, MAX_GOOGLE_CONTROL_WIDTH));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  return { containerRef, width };
}
