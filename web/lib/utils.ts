/** Decode a JWT payload and return the `exp` field (seconds since epoch), or null if unparseable. */
export function parseTokenExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1];
    const pad = b64.length % 4;
    const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(json);
    return typeof obj.exp === 'number' ? obj.exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns the "deadline" timestamp for today: 20:01 local time.
 * A token is considered expired if it expires before this moment.
 */
export function todayDeadlineMs(): number {
  const d = new Date();
  d.setHours(20, 1, 0, 0);
  return d.getTime();
}
