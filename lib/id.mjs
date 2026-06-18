import { createHash } from 'node:crypto';

export function makeId(url) {
  return createHash('sha256').update(String(url)).digest('hex').slice(0, 16);
}
