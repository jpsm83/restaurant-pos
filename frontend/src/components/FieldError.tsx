/** Inline validation message for a single field (use with react-hook-form `formState.errors`). */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
