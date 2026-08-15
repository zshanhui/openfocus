import { registerMessageHandler } from '../message-registry';
import { findAllowedConflict, parseAllowedSitesInput } from '../../shared-utils/allowed-sites';
import { getSiteGroups } from '../site-groups-store';
import { addAllowedSitePatterns, clearAllowedSites, getAllowedSites, removeAllowedSitePattern } from '../allowed-sites-store';
import { isSanctuaryActive } from '../sanctuary-store';

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
            return { saved: false, locked: true, added: [], errors: [], ...(await this.getState()) };
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
            return { saved: false, locked: true, ...(await this.getState()) };
        }
        if (!options.pattern) {
            return { saved: false, ...(await this.getState()) };
        }
        removeAllowedSitePattern(options.pattern);
        return { saved: true, ...(await this.getState()) };
    }

    async handleClear() {
        await this._ready;
        if (isSanctuaryActive()) {
            return { saved: false, locked: true, ...(await this.getState()) };
        }
        clearAllowedSites();
        return { saved: true, ...(await this.getState()) };
    }
}
