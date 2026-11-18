export const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
};

export const FlipType = {
  Vertical: 'vertical',
  Horizontal: 'horizontal',
};

const manipulateCalls = [];
let callSequence = 0;
let defaultWidth = 3840;
let defaultHeight = 2160;

export function __resetMockImageManipulator() {
  manipulateCalls.length = 0;
  callSequence = 0;
  defaultWidth = 3840;
  defaultHeight = 2160;
}

export function __setMockImageDimensions(width, height) {
  defaultWidth = width;
  defaultHeight = height;
}

export function __getManipulateCalls() {
  return [...manipulateCalls];
}

export async function manipulateAsync(uri, actions = [], saveOptions = {}) {
  callSequence += 1;
  manipulateCalls.push({ uri, actions, saveOptions });

  let width = defaultWidth;
  let height = defaultHeight;

  for (const action of actions) {
    if (action && action.resize) {
      if (typeof action.resize.width === 'number') {
        width = action.resize.width;
      }
      if (typeof action.resize.height === 'number') {
        height = action.resize.height;
      }
    }
  }

  const outputUri = `file:///data/user/0/com.fieldops.mobile/cache/manipulated_${callSequence}.jpg`;
  return {
    uri: outputUri,
    width,
    height,
    base64: saveOptions?.base64 ? 'bW9jay1qcGVnLWJhc2U2NA==' : undefined,
  };
}

export default {
  SaveFormat,
  FlipType,
  manipulateAsync,
  __resetMockImageManipulator,
  __setMockImageDimensions,
  __getManipulateCalls,
};
