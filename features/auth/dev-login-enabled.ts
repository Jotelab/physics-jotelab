/**
 * Gate for the dev-only password login (see `dev-login.ts`): on ONLY when
 * `DEV_PASSWORD_LOGIN=true` — a flag no deployed environment sets. Server-side
 * only (the login page and the action both check it there).
 */
export function devPasswordLoginEnabled(): boolean {
  return process.env.DEV_PASSWORD_LOGIN === "true"
}
