/**
 * Remote telemetry to improving.duckduckgo.com is disabled in OpenFocusd.
 */

/**
 * @param {string} _pixelName
 * @returns {string}
 */
export function getURL(_pixelName) {
    return '';
}

/**
 * @param {string} _pixelName
 * @param {Record<string, string>} [_params]
 * @returns {Promise<void>}
 */
export function sendPixelRequest(_pixelName, _params = {}) {
    return Promise.resolve();
}
