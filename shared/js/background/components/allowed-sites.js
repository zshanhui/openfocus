import { registerMessageHandler } from '../message-registry';
import { findAllowedConflict, parseAllowedSitesInput } from '../../shared-utils/allowed-sites';
import { getSiteGroups } from '../site-groups-store';
import { addAllowedSitePatterns, clearAllowedSites, getAllowedSites, removeAllowedSitePattern } from '../allowed-sites-store';
import { refreshCategoryAllowRules } from '../dnr-category-blocklist';
import { isSanctuaryActive } from '../sanctuary-store';
import { refreshOpenTabActionIcons } from '../events/privacy-icon-indicator';

export default class AllowedSites {
    /**
     * @param {{ settings: import('../settings.js') }} options
     */
    constructor({ settings }) {
        this.featureName = 'AllowedSites';
        this.settings = settings;

        registerMessageHandler('getAllowedSites', () => this.handleGet());
        registerMessageHandler('addAllowedSites', (options) => this.handleAdd(options));
        registerMessageHandler('removeAllowedSite', (options) => this.handleRemove(options));
        registerMessageHandler('clearAllowedSites', () => this.handleClear());

        this._ready = this.init();
    }

    async init() {
        try {
            await this.settings.ready();
            getAllowedSites();
        } catch (error) {
            console.error('Allowed sites failed to initialize', error);
        }
    }

    async getState() {
        await this._ready;
        return {
            patterns: getAllowedSites(),
            locked: isSanctuaryActive(),
        };
    }

    async handleGet() {
        return this.getState();
    }

    /**
     * @param {{ text?: unknown }} [options]
     */
    async handleAdd(options = {}) {
        await this._ready;
        if (isSanctuaryActive()) {
            return { saved: false, added: [], errors: [], ...(await this.getState()) };
        }
        if (typeof options.text !== 'string' || !options.text.trim()) {
            return { saved: false, empty: true, added: [], errors: [], ...(await this.getState()) };
        }
        const { patterns: parsed, rejected } = parseAllowedSitesInput(options.text);
        const existing = new Set(getAllowedSites());
        const groups = getSiteGroups();
        /** @type {string[]} */
        const toAdd = [];
        /** @type {Array<{ line: string, reason: string, domain?: string, groupName?: string }>} */
        const errors = rejected.map((item) => ({ line: item.line, reason: item.reason }));

        for (const pattern of parsed) {
            if (existing.has(pattern)) {
                continue;
            }
            const conflict = findAllowedConflict(pattern, groups);
            if (conflict) {
                errors.push({
                    line: pattern,
                    reason: 'conflict',
                    domain: conflict.domain,
                    groupName: conflict.groupName,
                });
                continue;
            }
            toAdd.push(pattern);
            existing.add(pattern);
        }

        if (toAdd.length) {
            addAllowedSitePatterns(toAdd);
            await refreshCategoryAllowRules();
            await refreshOpenTabActionIcons().catch((error) => console.warn('Failed to refresh action icons', error));
        }

        return {
            saved: toAdd.length > 0 || errors.length === 0,
            added: toAdd,
            errors,
            ...(await this.getState()),
        };
    }

    /**
     * @param {{ pattern?: string }} [options]
     */
    async handleRemove(options = {}) {
        await this._ready;
        if (isSanctuaryActive()) {
            return { saved: false, ...(await this.getState()) };
        }
        if (!options.pattern) {
            return { saved: false, ...(await this.getState()) };
        }
        removeAllowedSitePattern(options.pattern);
        await refreshCategoryAllowRules();
        await refreshOpenTabActionIcons().catch((error) => console.warn('Failed to refresh action icons', error));
        return { saved: true, ...(await this.getState()) };
    }

    async handleClear() {
        await this._ready;
        if (isSanctuaryActive()) {
            return { saved: false, ...(await this.getState()) };
        }
        clearAllowedSites();
        await refreshCategoryAllowRules();
        await refreshOpenTabActionIcons().catch((error) => console.warn('Failed to refresh action icons', error));
        return { saved: true, ...(await this.getState()) };
    }
}
