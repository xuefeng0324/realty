export type DataMode = "seed" | "csv-url";

export const DATA_MODE_STORAGE_KEY = "realty_app.dataMode";
export const CSV_BASE_URL_STORAGE_KEY = "realty_app.csvBaseUrl";

export function normalizeDataMode(value: unknown): DataMode {
  return value === "csv-url" ? "csv-url" : "seed";
}

export function getStoredDataMode(): DataMode {
  return normalizeDataMode(uni.getStorageSync(DATA_MODE_STORAGE_KEY));
}

export function getStoredCsvBaseUrl(): string {
  const value = uni.getStorageSync(CSV_BASE_URL_STORAGE_KEY);
  return typeof value === "string" ? value.trim() : "";
}
