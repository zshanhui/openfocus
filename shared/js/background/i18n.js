import browser from 'webextension-polyfill';

export const UI_LOCALE_STORAGE_KEY = 'openfocusd-ui-locale';

export const UI_LOCALES = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: '中文' },
    { code: 'ar', name: 'العربية' },
    { code: 'bg', name: 'Български' },
    { code: 'cs', name: 'Čeština' },
    { code: 'da', name: 'Dansk' },
    { code: 'de', name: 'Deutsch' },
    { code: 'et', name: 'Eesti' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'hr', name: 'Hrvatski' },
    { code: 'it', name: 'Italiano' },
    { code: 'lv', name: 'Latviešu' },
    { code: 'lt', name: 'Lietuvių' },
    { code: 'hu', name: 'Magyar' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'nb', name: 'Norsk' },
    { code: 'pl', name: 'Polski' },
    { code: 'pt', name: 'Português' },
    { code: 'ro', name: 'Română' },
    { code: 'sk', name: 'Slovenčina' },
    { code: 'sl', name: 'Slovenščina' },
    { code: 'fi', name: 'Suomi' },
    { code: 'sv', name: 'Svenska' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'el', name: 'Ελληνικά' },
    { code: 'ru', name: 'Русский' },
];

const UI_LOCALE_CODES = new Set(UI_LOCALES.map((locale) => locale.code));

function normalizeLocale(locale) {
    if (!locale || typeof locale !== 'string') {
        return '';
    }
    const lang = locale.slice(0, 2).toLowerCase();
    if (['nn', 'no'].includes(lang)) {
        return 'nb';
    }
    return UI_LOCALE_CODES.has(lang) ? lang : '';
}

export function getBrowserLocale() {
    if (!browser?.i18n) {
        return 'en';
    }
    // returns browser locale with country suffix removed
    const lang = browser.i18n.getUILanguage().slice(0, 2);
    // handle Norwegian locales
    if (['nn', 'no'].includes(lang)) {
        return 'nb';
    }
    return lang;
}

export function getStoredUiLocale() {
    try {
        if (typeof localStorage === 'undefined') {
            return '';
        }
        return normalizeLocale(localStorage.getItem(UI_LOCALE_STORAGE_KEY));
    } catch (e) {
        return '';
    }
}

export function setStoredUiLocale(locale) {
    const normalized = normalizeLocale(locale);
    if (!normalized || typeof localStorage === 'undefined') {
        return;
    }
    localStorage.setItem(UI_LOCALE_STORAGE_KEY, normalized);
}

export function getUserLocale() {
    return getStoredUiLocale() || getBrowserLocale();
}

export function getFullUserLocale() {
    if (!browser?.i18n) {
        return 'en-US';
    }

    return browser.i18n.getUILanguage();
}

export function getUserLocaleCountry() {
    try {
        return getFullUserLocale().split('-')[1];
    } catch (e) {
        return '';
    }
}
