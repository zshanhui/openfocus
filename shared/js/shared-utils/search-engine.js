export const SEARCH_ENGINE_DDG = 'ddg';
export const SEARCH_ENGINE_BRAVE = 'brave';

export const SEARCH_PLACEHOLDER_DDG = 'Search DuckDuckGo';
export const SEARCH_PLACEHOLDER_BRAVE = 'Search Brave';

/**
 * @param {unknown} value
 * @returns {typeof SEARCH_ENGINE_DDG | typeof SEARCH_ENGINE_BRAVE}
 */
export function normalizeSearchEngine(value) {
    return value === SEARCH_ENGINE_BRAVE ? SEARCH_ENGINE_BRAVE : SEARCH_ENGINE_DDG;
}

/**
 * @param {unknown} engine
 * @returns {string}
 */
export function searchPlaceholder(engine) {
    return normalizeSearchEngine(engine) === SEARCH_ENGINE_BRAVE ? SEARCH_PLACEHOLDER_BRAVE : SEARCH_PLACEHOLDER_DDG;
}

/**
 * @param {string} term
 * @param {unknown} engine
 * @returns {string}
 */
export function buildSearchUrl(term, engine) {
    const query = String(term || '');
    if (normalizeSearchEngine(engine) === SEARCH_ENGINE_BRAVE) {
        const url = new URL('https://search.brave.com/search');
        url.searchParams.set('q', query);
        return url.toString();
    }

    const url = new URL('https://duckduckgo.com/');
    url.searchParams.set('q', query);
    return url.toString();
}
