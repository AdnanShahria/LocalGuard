import '@testing-library/jest-dom';
import { vi } from 'vitest';

// In-memory mock storage for chrome.storage.local
const mockStorage: Record<string, any> = {};

const mockChromeStorage = {
  local: {
    get: vi.fn((keys: string[], callback: (result: Record<string, any>) => void) => {
      const result: Record<string, any> = {};
      keys.forEach((k) => {
        if (mockStorage[k] !== undefined) {
          result[k] = JSON.parse(JSON.stringify(mockStorage[k]));
        }
      });
      callback(result);
    }),
    set: vi.fn((items: Record<string, any>, callback?: () => void) => {
      Object.assign(mockStorage, JSON.parse(JSON.stringify(items)));
      if (callback) callback();
    }),
    clear: vi.fn((callback?: () => void) => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      if (callback) callback();
    }),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

const mockChromeRuntime = {
  lastError: null,
  sendMessage: vi.fn(),
  openOptionsPage: vi.fn(),
  getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
};

const mockChromeAction = {
  setBadgeText: vi.fn(),
  setBadgeBackgroundColor: vi.fn(),
};

const mockChromeTabs = {
  create: vi.fn(),
};

// Polyfill global chrome object
(globalThis as any).chrome = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime,
  action: mockChromeAction,
  tabs: mockChromeTabs,
};

// Helper for test resets
export function resetMockStorage() {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  vi.clearAllMocks();
}
