/**
 * Password rules for creating Business accounts, User accounts (admin API), and auth signup.
 * Login accepts any stored hash; this applies only to setting a new password.
 */

export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include a lowercase letter, an uppercase letter, a number, and a symbol.";

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

export function isValidPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}
