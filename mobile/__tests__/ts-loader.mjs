import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import ts from 'typescript';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') {
    return nextResolve('react-native-web', context);
  }

  if (specifier === 'expo-secure-store') {
    return nextResolve(new URL('./mocks/expo-secure-store.mjs', import.meta.url).href, context);
  }

  let target = specifier;
  if (specifier.startsWith('@/')) {
    target = fileURLToPath(new URL(`../src/${specifier.slice(2)}`, import.meta.url));
  }

  try {
    return await nextResolve(target, context);
  } catch (err) {
    if (
      (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_UNSUPPORTED_DIR_IMPORT') &&
      (target.startsWith('.') || target.startsWith('/') || /^[a-zA-Z]:/.test(target))
    ) {
      for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        try {
          return await nextResolve(target + ext, context);
        } catch {}
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.tsx') || (url.endsWith('.ts') && (url.includes('components') || url.includes('auth')))) {
    const filePath = fileURLToPath(url);
    const source = fs.readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filePath,
    });
    return {
      format: 'module',
      shortCircuit: true,
      source: transpiled.outputText,
    };
  }
  return nextLoad(url, context);
}
