import { useMemo, useState, type UIEvent } from "react";
import type { NotificationItem } from "../types";

interface NotificationsVirtualListProps {
  items: NotificationItem[];
  height?: number;
  rowHeight?: number;
  overscan?: number;
}

export default function NotificationsVirtualList({
  items,
  height = 280,
  rowHeight = 64,
  overscan = 4,
}: NotificationsVirtualListProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const { startIndex, endIndex, offsetY, totalHeight } = useMemo(() => {
    const visibleCount = Math.ceil(height / rowHeight);
    const rawStart = Math.floor(scrollTop / rowHeight);
    const start = Math.max(0, rawStart - overscan);
    const end = Math.min(items.length, rawStart + visibleCount + overscan);
    const offset = start * rowHeight;
    const total = items.length * rowHeight;
    return { startIndex: start, endIndex: end, offsetY: offset, totalHeight: total };
  }, [height, rowHeight, overscan, scrollTop, items.length]);

  const visibleItems = items.slice(startIndex, endIndex);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div
      className="w-full overflow-y-auto rounded-md border border-neutral-200 bg-white"
      style={{ height }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item) => (
            <article
              key={item._id}
              className="flex items-center border-b border-neutral-100 px-3"
              style={{ height: rowHeight }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">
                  {item.message}
                </p>
                <p className="text-xs text-neutral-500">
                  {item.notificationType}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

