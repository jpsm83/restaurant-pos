import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  /** Stored profile picture URL; the initials fallback shows when it is absent or fails. */
  imageUrl?: string | null;
  /** Email or name used to derive the initials fallback. */
  fallback: string;
  /** Accessible image label. Omit for decorative avatars that sit inside a labelled control. */
  alt?: string;
  className?: string;
  /** Overrides the initials text size for larger avatars. */
  fallbackClassName?: string;
}

/** Two-letter initials from an email local part or a person's name. */
function initialsFrom(value: string): string {
  const identity = value.includes("@") ? value.split("@")[0] : value;
  const parts = identity.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return identity.trim().slice(0, 2).toUpperCase() || "?";
}

/**
 * Circular User avatar: the stored profile picture when it loads, otherwise
 * initials. A failed remote image (for example an expired Google URL) falls
 * back instead of leaving an empty circle.
 */
export function UserAvatar({
  imageUrl,
  fallback,
  alt,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <span
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border border-border bg-muted",
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      {showImage && imageUrl ? (
        <img
          src={imageUrl}
          alt={alt ?? ""}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <span
          role={alt ? "img" : undefined}
          aria-label={alt}
          className={cn(
            "flex size-full items-center justify-center text-xs font-semibold uppercase tracking-tight text-muted-foreground",
            fallbackClassName,
          )}
        >
          {initialsFrom(fallback)}
        </span>
      )}
    </span>
  );
}
