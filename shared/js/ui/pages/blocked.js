import { iconPaths } from '../../../data/constants';
import { pickDaodejingQuote } from '../../shared-utils/daodejing-quotes';

const action = globalThis.chrome?.action || globalThis.chrome?.browserAction;

function showDailyQuote() {
    const quote = pickDaodejingQuote();
    const english = document.querySelector('.blocked-quote__text');
    const chinese = document.querySelector('.blocked-quote__source');
    const cite = document.querySelector('.blocked-quote__link');
    if (!english || !chinese || !cite) {
        return;
    }
    english.textContent = quote.english;
    chinese.textContent = quote.chinese;
    cite.textContent = `Daodejing ${quote.chapter}`;
    cite.closest('figure')?.removeAttribute('hidden');
}

async function setRedToolbarIcon() {
    if (!action?.setIcon) {
        return;
    }
    let tabId;
    try {
        const tab = await chrome.tabs.getCurrent();
        tabId = tab?.id;
    } catch {
        tabId = undefined;
    }
    if (tabId == null) {
        return;
    }
    try {
        await action.setIcon({ path: iconPaths.inBlockGroup, tabId });
    } catch {
        // The background listener will retry once the service worker is ready.
    }
}

function applySanctuaryCopy(state) {
    if (!state?.active) {
        return;
    }
    const title = document.querySelector('.blocked-card__title');
    const message = document.querySelector('.blocked-card__message');
    if (title) {
        title.textContent = 'Sanctuary Mode is on';
    }
    if (message) {
        message.textContent = 'Only sites on your Allowed Sites list can be used until the timer ends.';
    }
}

showDailyQuote();
setRedToolbarIcon();
chrome.runtime.sendMessage({ messageType: 'blockedPageShown' }).catch(() => {});
chrome.runtime
    .sendMessage({ messageType: 'getSanctuaryState' })
    .then(applySanctuaryCopy)
    .catch(() => {});
