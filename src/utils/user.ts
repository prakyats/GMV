/**
 * Global Identity Utilities (Production Hardened)
 */

interface UserIdentity {
  displayName?: string | null;
  email?: string | null;
  name?: string | null;
}

/**
 * Resolves a user's display name following a strict hierarchy:
 * 1. Auth displayName (authoritative)
 * 2. Auth email (fallback)
 * 3. Internal DB name (legacy/context fallback)
 * 4. Default string "Member"
 */
export const getUserDisplayName = (user?: UserIdentity | null): string => {
  const name =
    user?.displayName?.trim() ||
    user?.email?.trim() ||
    user?.name?.trim() ||
    "Member";
    
  return name;
};

/**
 * Normalizes a name for stable, case-insensitive sorting.
 */
export const getSortableName = (user?: UserIdentity | null): string => {
  return getUserDisplayName(user).toLowerCase().trim();
};

/**
 * Returns a truncated display name for UI safety (max 25 chars).
 * Prevents long email addresses from breaking mobile layouts.
 */
export const formatUserDisplayName = (user?: UserIdentity | null): string => {
  const name = getUserDisplayName(user);
  return name.length > 25 ? `${name.substring(0, 25)}...` : name;
};

/**
 * Extracts a safe initial for avatars.
 * Always returns a character, falling back to 'M' for Member.
 */
export const getUserInitial = (user?: UserIdentity | null): string => {
  const name = getUserDisplayName(user).trim();
  return name ? name[0].toUpperCase() : "M";
};
