import { getStorageData, saveStorageData, getAnyActiveSession } from '../storage/storage';
import { INITIAL_STORAGE_SCHEMA } from '../shared/types';
import { calculateRemainingMs } from '../features/session/timerCalculations';

// Initialize defaults on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const data = await getStorageData();
    if (!data || !data.settings) {
      await saveStorageData(INITIAL_STORAGE_SCHEMA);
    }
  }
});

// Update action badge based on active session
async function updateActionBadge() {
  try {
    const activeInfo = await getAnyActiveSession();
    if (activeInfo && activeInfo.session.status === 'active') {
      const remainingMs = calculateRemainingMs(activeInfo.session.deadlineTime);
      const remainingMins = Math.ceil(remainingMs / 60000);
      if (remainingMs > 0) {
        chrome.action.setBadgeText({ text: `${remainingMins}m` });
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
      } else {
        chrome.action.setBadgeText({ text: '0m' });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    // Defensive handling in background worker
    console.debug('Badge update error:', err);
  }
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_OPTIONS_PAGE') {
    const url = message.tab ? `options.html#${message.tab}` : 'options.html';
    chrome.tabs.create({ url });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    updateActionBadge().then(() => sendResponse({ success: true }));
    return true;
  }

  return false;
});

// Sync badge on startup
updateActionBadge();
