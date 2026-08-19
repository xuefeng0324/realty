export type LocalEntityType = "listing" | "community" | "school";

export interface UserLibraryEntity {
  type: LocalEntityType;
  id: string;
  title: string;
  city: string;
  coverUrl?: string;
  route: string;
  query: Record<string, string>;
  updatedAt: number;
}

export interface UserLibraryEntityInput {
  type: LocalEntityType;
  id: string | number;
  title: string;
  city?: string;
  coverUrl?: string | null;
  route: string;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export interface UserLibraryV1 {
  version: 1;
  favorites: UserLibraryEntity[];
  history: UserLibraryEntity[];
}

export const USER_LIBRARY_VERSION = 1 as const;
export const USER_LIBRARY_HISTORY_LIMIT = 100;
export const USER_LIBRARY_HISTORY_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const ENTITY_TYPES = new Set<LocalEntityType>(["listing", "community", "school"]);

export function createEmptyUserLibrary(): UserLibraryV1 {
  return {
    version: USER_LIBRARY_VERSION,
    favorites: [],
    history: []
  };
}

export function userLibraryEntityKey(type: LocalEntityType, id: string | number): string {
  return `${type}:${String(id)}`;
}

function normalizeQuery(
  query: UserLibraryEntityInput["query"] | Record<string, unknown>
): Record<string, string> | null {
  if (query == null) return {};
  if (typeof query !== "object" || Array.isArray(query)) return null;

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!key) return null;
    if (value == null) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return null;
    }
    normalized[key] = String(value);
  }
  return normalized;
}

function normalizeInput(input: UserLibraryEntityInput, updatedAt: number): UserLibraryEntity | null {
  const id = String(input.id).trim();
  const title = input.title.trim();
  const route = input.route.trim();
  const query = normalizeQuery(input.query ?? {});
  if (
    !ENTITY_TYPES.has(input.type) ||
    !id ||
    !title ||
    !route.startsWith("/pages/") ||
    !Number.isFinite(updatedAt) ||
    updatedAt <= 0 ||
    query == null
  ) {
    return null;
  }

  const coverUrl = input.coverUrl?.trim();
  return {
    type: input.type,
    id,
    title,
    city: input.city?.trim() ?? "",
    ...(coverUrl ? { coverUrl } : {}),
    route,
    query,
    updatedAt
  };
}

function normalizeStoredEntity(value: unknown): UserLibraryEntity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.updatedAt !== "number") return null;
  if (
    typeof item.type !== "string" ||
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.city !== "string" ||
    typeof item.route !== "string"
  ) {
    return null;
  }
  if (item.coverUrl != null && typeof item.coverUrl !== "string") return null;
  if (!item.query || typeof item.query !== "object" || Array.isArray(item.query)) return null;
  const query = normalizeQuery(item.query as Record<string, unknown>);
  if (query == null || query.id == null || String(query.id).trim() !== item.id.trim()) return null;

  return normalizeInput(
    {
      type: item.type as LocalEntityType,
      id: item.id,
      title: item.title,
      city: item.city,
      coverUrl: item.coverUrl as string | undefined,
      route: item.route,
      query
    },
    item.updatedAt
  );
}

function dedupeNewest(items: UserLibraryEntity[]): UserLibraryEntity[] {
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
  const seen = new Set<string>();
  return sorted.filter((item) => {
    const key = userLibraryEntityKey(item.type, item.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pruneUserLibraryHistory(
  items: UserLibraryEntity[],
  now: number = Date.now()
): UserLibraryEntity[] {
  const oldestAllowed = now - USER_LIBRARY_HISTORY_MAX_AGE_MS;
  return dedupeNewest(items)
    .filter((item) => item.updatedAt >= oldestAllowed)
    .slice(0, USER_LIBRARY_HISTORY_LIMIT);
}

/**
 * 读取版本化存储。JSON 损坏、结构损坏或未知版本都安全回到空库，
 * 不尝试猜测旧结构，避免错误数据污染收藏与足迹。
 */
export function parseUserLibrary(raw: unknown, now: number = Date.now()): UserLibraryV1 {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return createEmptyUserLibrary();
    }
    const value = parsed as Record<string, unknown>;
    if (value.version !== USER_LIBRARY_VERSION) return createEmptyUserLibrary();
    if (!Array.isArray(value.favorites) || !Array.isArray(value.history)) {
      return createEmptyUserLibrary();
    }

    const favorites = value.favorites.map(normalizeStoredEntity);
    const history = value.history.map(normalizeStoredEntity);
    if (favorites.some((item) => item == null) || history.some((item) => item == null)) {
      return createEmptyUserLibrary();
    }

    return {
      version: USER_LIBRARY_VERSION,
      favorites: dedupeNewest(favorites as UserLibraryEntity[]),
      history: pruneUserLibraryHistory(history as UserLibraryEntity[], now)
    };
  } catch {
    return createEmptyUserLibrary();
  }
}

export function serializeUserLibrary(library: UserLibraryV1): string {
  return JSON.stringify(library);
}

export function isUserLibraryFavorite(
  library: UserLibraryV1,
  type: LocalEntityType,
  id: string | number
): boolean {
  const key = userLibraryEntityKey(type, id);
  return library.favorites.some((item) => userLibraryEntityKey(item.type, item.id) === key);
}

export function setUserLibraryFavorite(
  library: UserLibraryV1,
  input: UserLibraryEntityInput,
  favorite: boolean,
  now: number = Date.now()
): UserLibraryV1 {
  const key = userLibraryEntityKey(input.type, input.id);
  const withoutCurrent = library.favorites.filter(
    (item) => userLibraryEntityKey(item.type, item.id) !== key
  );
  if (!favorite) {
    return { ...library, favorites: withoutCurrent };
  }

  const normalized = normalizeInput(input, now);
  if (!normalized) return library;
  return { ...library, favorites: [normalized, ...withoutCurrent] };
}

export function recordUserLibraryHistory(
  library: UserLibraryV1,
  input: UserLibraryEntityInput,
  now: number = Date.now()
): UserLibraryV1 {
  const normalized = normalizeInput(input, now);
  if (!normalized) return library;
  const key = userLibraryEntityKey(normalized.type, normalized.id);
  const next = [
    normalized,
    ...library.history.filter((item) => userLibraryEntityKey(item.type, item.id) !== key)
  ];
  return { ...library, history: pruneUserLibraryHistory(next, now) };
}

export function buildUserLibraryUrl(item: UserLibraryEntity): string {
  const query = Object.entries(item.query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return query ? `${item.route}?${query}` : item.route;
}
