import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { STORAGE_KEYS } from "../config";
import {
  createEmptyUserLibrary,
  isUserLibraryFavorite,
  parseUserLibrary,
  recordUserLibraryHistory,
  serializeUserLibrary,
  setUserLibraryFavorite,
  type LocalEntityType,
  type UserLibraryEntityInput,
  type UserLibraryV1
} from "../local/userLibrary";

function readStoredUserLibrary(): UserLibraryV1 {
  try {
    const raw = uni.getStorageSync(STORAGE_KEYS.userLibrary);
    if (raw === "" || raw == null) return createEmptyUserLibrary();
    return parseUserLibrary(raw);
  } catch (error) {
    console.warn("read user library failed:", error);
    return createEmptyUserLibrary();
  }
}

export const useUserLibraryStore = defineStore("userLibrary", () => {
  const library = ref<UserLibraryV1>(readStoredUserLibrary());
  const favorites = computed(() => library.value.favorites);
  const history = computed(() => library.value.history);

  function persist(next: UserLibraryV1): void {
    library.value = next;
    try {
      uni.setStorageSync(STORAGE_KEYS.userLibrary, serializeUserLibrary(next));
    } catch (error) {
      console.warn("save user library failed:", error);
    }
  }

  function isFavorite(type: LocalEntityType, id: string | number): boolean {
    return isUserLibraryFavorite(library.value, type, id);
  }

  function toggleFavorite(item: UserLibraryEntityInput): boolean {
    const favorite = !isFavorite(item.type, item.id);
    persist(setUserLibraryFavorite(library.value, item, favorite));
    return favorite;
  }

  function removeFavorite(type: LocalEntityType, id: string | number): void {
    const existing = library.value.favorites.find(
      (item) => item.type === type && item.id === String(id)
    );
    if (!existing) return;
    persist(setUserLibraryFavorite(library.value, existing, false));
  }

  function recordHistory(item: UserLibraryEntityInput): void {
    persist(recordUserLibraryHistory(library.value, item));
  }

  function clearHistory(): void {
    persist({ ...library.value, history: [] });
  }

  return {
    library,
    favorites,
    history,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    recordHistory,
    clearHistory
  };
});
