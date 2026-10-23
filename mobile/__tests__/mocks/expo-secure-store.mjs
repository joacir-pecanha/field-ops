const store = new Map();

export async function getItemAsync(key) {
  return store.has(key) ? store.get(key) : null;
}

export async function setItemAsync(key, value) {
  store.set(key, String(value));
}

export async function deleteItemAsync(key) {
  store.delete(key);
}

export function isAvailableAsync() {
  return Promise.resolve(true);
}

export function __resetStore() {
  store.clear();
}

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  isAvailableAsync,
  __resetStore,
};
