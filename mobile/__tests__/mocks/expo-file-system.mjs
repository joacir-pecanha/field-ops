export const documentDirectory = 'file:///data/user/0/com.fieldops.mobile/files/';
export const cacheDirectory = 'file:///data/user/0/com.fieldops.mobile/cache/';
export const bundleDirectory = 'file:///data/user/0/com.fieldops.mobile/bundle/';

const files = new Map();
const directories = new Set([documentDirectory, cacheDirectory]);
let freeDiskStorageBytes = 500 * 1024 * 1024;
let forcedWriteError = null;

export function __resetMockFileSystem() {
  files.clear();
  directories.clear();
  directories.add(documentDirectory);
  directories.add(cacheDirectory);
  freeDiskStorageBytes = 500 * 1024 * 1024;
  forcedWriteError = null;
}

export function __setMockFreeDiskStorage(bytes) {
  freeDiskStorageBytes = bytes;
}

export function __setMockForcedWriteError(err) {
  forcedWriteError = err;
}

export function __getMockFiles() {
  return new Map(files);
}

export function __getMockDirectories() {
  return Array.from(directories);
}

export function __seedMockFile(uri, contents = 'mock-jpeg-bytes', size = 24576) {
  files.set(uri, { contents, size });
}

export async function getInfoAsync(uri) {
  const normalizedDir = uri.endsWith('/') ? uri : `${uri}/`;
  if (directories.has(uri) || directories.has(normalizedDir)) {
    return { exists: true, isDirectory: true, uri, size: 0 };
  }
  const file = files.get(uri);
  if (file) {
    return {
      exists: true,
      isDirectory: false,
      uri,
      size: file.size,
      modificationTime: Date.now() / 1000,
    };
  }
  return { exists: false, isDirectory: false, uri };
}

export async function makeDirectoryAsync(uri) {
  const normalized = uri.endsWith('/') ? uri : `${uri}/`;
  directories.add(normalized);
}

export async function copyAsync({ from, to }) {
  if (forcedWriteError) {
    throw forcedWriteError;
  }
  const source = files.get(from) ?? {
    contents: `copied:${from}`,
    size: 32768,
  };
  files.set(to, { ...source });
}

export async function deleteAsync(uri, options = {}) {
  const normalizedDir = uri.endsWith('/') ? uri : `${uri}/`;
  if (files.has(uri)) {
    files.delete(uri);
    return;
  }
  if (directories.has(normalizedDir)) {
    directories.delete(normalizedDir);
    return;
  }
  if (!options?.idempotent) {
    throw new Error(`File not found: ${uri}`);
  }
}

export async function writeAsStringAsync(uri, contents) {
  if (forcedWriteError) {
    throw forcedWriteError;
  }
  files.set(uri, {
    contents,
    size: typeof contents === 'string' ? contents.length : 16384,
  });
}

export async function readAsStringAsync(uri) {
  const file = files.get(uri);
  if (!file) {
    throw new Error(`File not found: ${uri}`);
  }
  return file.contents;
}

export async function getFreeDiskStorageAsync() {
  return freeDiskStorageBytes;
}

export default {
  documentDirectory,
  cacheDirectory,
  bundleDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  copyAsync,
  deleteAsync,
  writeAsStringAsync,
  readAsStringAsync,
  getFreeDiskStorageAsync,
  __resetMockFileSystem,
  __setMockFreeDiskStorage,
  __setMockForcedWriteError,
  __getMockFiles,
  __getMockDirectories,
  __seedMockFile,
};
