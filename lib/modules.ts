export function rolloutBucket(userId: string, moduleKey: string) {
  const input = `${userId}:${moduleKey}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % 100;
}

export function isModuleAvailableForUser(
  userId: string,
  moduleKey: string,
  enabled: boolean,
  rolloutPercent: number
) {
  if (!enabled) return false;
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  return rolloutBucket(userId, moduleKey) < rolloutPercent;
}
