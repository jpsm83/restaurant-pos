import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export type RecordDetailsModalPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface RecordDetailsModalSize {
  width: string;
  height: string;
}

export interface RecordDetailsModalProps {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  headerActions?: React.ReactNode;
  position?: RecordDetailsModalPosition;
  size?: RecordDetailsModalSize;
  onSizeChange?: (size: RecordDetailsModalSize) => void;
  children: React.ReactNode;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;

type ResizeDirection =
  | "right"
  | "left"
  | "bottom"
  | "top"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface ModalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_SIZE: RecordDetailsModalSize = { width: "42vw", height: "80vh" };

function resolveModalSize(size?: RecordDetailsModalSize): RecordDetailsModalSize {
  return size ?? DEFAULT_SIZE;
}

function parseCssLengthToPx(value: string, viewportSize: number): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.endsWith("px")) {
    const n = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(n) ? n : viewportSize;
  }
  if (trimmed.endsWith("vw") || trimmed.endsWith("vh")) {
    const n = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(n) ? (viewportSize * n) / 100 : viewportSize;
  }
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : viewportSize;
}

function buildInitialRect(
  size: RecordDetailsModalSize,
  position: RecordDetailsModalPosition
): ModalRect {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.max(MIN_WIDTH, Math.round(parseCssLengthToPx(size.width, viewportWidth)));
  const height = Math.max(MIN_HEIGHT, Math.round(parseCssLengthToPx(size.height, viewportHeight)));
  const margin = 12;

  let x = Math.round((viewportWidth - width) / 2);
  let y = Math.round((viewportHeight - height) / 2);
  if (position === "top-left") {
    x = margin;
    y = margin;
  } else if (position === "top-right") {
    x = viewportWidth - width - margin;
    y = margin;
  } else if (position === "bottom-left") {
    x = margin;
    y = viewportHeight - height - margin;
  } else if (position === "bottom-right") {
    x = viewportWidth - width - margin;
    y = viewportHeight - height - margin;
  }

  return { x, y, width, height };
}

export const RecordDetailsModal: React.FC<RecordDetailsModalProps> = ({
  open,
  title,
  onClose,
  canGoPrevious = false,
  canGoNext = false,
  onPrevious,
  onNext,
  headerActions,
  position = "center",
  size,
  onSizeChange,
  children,
}) => {
  const { t } = useTranslation("business");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const resolvedSize = useMemo(() => resolveModalSize(size), [size]);
  const [rect, setRect] = useState<ModalRect | null>(null);
  const interactionRef = useRef<{
    mode: "none" | "drag" | "resize";
    direction: ResizeDirection;
    startMouseX: number;
    startMouseY: number;
    startRect: ModalRect | null;
  }>({
    mode: "none",
    direction: "bottom-right",
    startMouseX: 0,
    startMouseY: 0,
    startRect: null,
  });

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    const applyRect = (nextRect: ModalRect | null) => {
      queueMicrotask(() => {
        if (!cancelled) {
          setRect(nextRect);
        }
      });
    };

    if (!open) {
      interactionRef.current.mode = "none";
      applyRect(null);
      return;
    }
    applyRect(buildInitialRect(resolvedSize, position));

    return () => {
      cancelled = true;
    };
  }, [open, position, resolvedSize]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const interaction = interactionRef.current;
      if (interaction.mode === "none" || !interaction.startRect) return;
      const dx = event.clientX - interaction.startMouseX;
      const dy = event.clientY - interaction.startMouseY;
      const start = interaction.startRect;

      if (interaction.mode === "drag") {
        setRect({
          ...start,
          x: start.x + dx,
          y: start.y + dy,
        });
        return;
      }

      let nextX = start.x;
      let nextY = start.y;
      let nextWidth = start.width;
      let nextHeight = start.height;

      if (interaction.direction.includes("right")) {
        nextWidth = Math.max(MIN_WIDTH, start.width + dx);
      }
      if (interaction.direction.includes("left")) {
        const candidate = start.width - dx;
        const clamped = Math.max(MIN_WIDTH, candidate);
        const applied = start.width - clamped;
        nextWidth = clamped;
        nextX = start.x + applied;
      }
      if (interaction.direction.includes("bottom")) {
        nextHeight = Math.max(MIN_HEIGHT, start.height + dy);
      }
      if (interaction.direction.includes("top")) {
        const candidate = start.height - dy;
        const clamped = Math.max(MIN_HEIGHT, candidate);
        const applied = start.height - clamped;
        nextHeight = clamped;
        nextY = start.y + applied;
      }

      setRect({
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      });
    };
    const onMouseUp = () => {
      interactionRef.current.mode = "none";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    if (!rect) return;
    interactionRef.current = {
      mode: "drag",
      direction: "bottom-right",
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startRect: rect,
    };
  };

  const handleResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    direction: ResizeDirection
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (!rect) return;
    interactionRef.current = {
      mode: "resize",
      direction,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startRect: rect,
    };
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !onSizeChange || !rect) return;
    onSizeChange({
      width: `${Math.round(rect.width)}px`,
      height: `${Math.round(rect.height)}px`,
    });
  }, [onSizeChange, open, rect]);

  if (!open || !rect) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        role="dialog"
        aria-modal="true"
        className="absolute pointer-events-auto"
        style={{
          left: `${Math.round(rect.x)}px`,
          top: `${Math.round(rect.y)}px`,
        }}
      >
        <div
          className="relative flex flex-col overflow-hidden border border-border bg-card shadow-lg"
          style={{
            width: `${Math.round(rect.width)}px`,
            height: `${Math.round(rect.height)}px`,
            minWidth: `${MIN_WIDTH}px`,
            minHeight: `${MIN_HEIGHT}px`,
          }}
        >
          <div
            className="flex cursor-move select-none items-center justify-between gap-2 border-b border-border bg-muted/70 px-3 py-2"
            onMouseDown={handleHeaderMouseDown}
          >
            <div className="text-sm text-foreground">{title}</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                aria-label={t("advancedTable.modal.previousRecord", { defaultValue: "Previous record" })}
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onPrevious}
                disabled={!canGoPrevious}
                title={t("advancedTable.modal.previousRecord", { defaultValue: "Previous record" })}
              >
                ▲
              </Button>
              <Button
                type="button"
                aria-label={t("advancedTable.modal.nextRecord", { defaultValue: "Next record" })}
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onNext}
                disabled={!canGoNext}
                title={t("advancedTable.modal.nextRecord", { defaultValue: "Next record" })}
              >
                ▼
              </Button>
              {headerActions}
              <Button
                ref={closeButtonRef}
                type="button"
                aria-label={t("advancedTable.modal.closeDetailsModal", { defaultValue: "Close details modal" })}
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                title={t("advancedTable.modal.close", { defaultValue: "Close" })}
              >
                ✕
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">{children}</div>
          <div
            className="absolute right-[-3px] top-[8px] bottom-[8px] w-2 cursor-ew-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "right")}
            aria-label={t("advancedTable.modal.resizeHandle", { defaultValue: "Resize modal" })}
            title={t("advancedTable.modal.resizeHandle", { defaultValue: "Resize modal" })}
          />
          <div
            className="absolute left-[-3px] top-[8px] bottom-[8px] w-2 cursor-ew-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "left")}
          />
          <div
            className="absolute bottom-[-3px] left-[8px] right-[8px] h-2 cursor-ns-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "bottom")}
          />
          <div
            className="absolute top-[-3px] left-[8px] right-[8px] h-2 cursor-ns-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "top")}
          />
          <div
            className="absolute top-[-3px] left-[-3px] h-3 w-3 cursor-nwse-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "top-left")}
          />
          <div
            className="absolute top-[-3px] right-[-3px] h-3 w-3 cursor-nesw-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "top-right")}
          />
          <div
            className="absolute bottom-[-3px] left-[-3px] h-3 w-3 cursor-nesw-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "bottom-left")}
          />
          <div
            className="absolute bottom-[-3px] right-[-3px] h-3 w-3 cursor-nwse-resize"
            onMouseDown={(event) => handleResizeMouseDown(event, "bottom-right")}
          />
        </div>
      </div>
    </div>
  );
};
