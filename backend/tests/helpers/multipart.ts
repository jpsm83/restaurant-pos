/**
 * Build a `multipart/form-data` body from string fields for route tests.
 */
export const multipart = (fields: Record<string, string>): FormData => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
};
