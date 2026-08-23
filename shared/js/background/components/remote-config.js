/**
 * @typedef {import('../settings.js')} Settings
 * @typedef {import('@duckduckgo/privacy-configuration/schema/config.ts').CurrentGenericConfig} Config
 */

import { getFeatureSettings, isFeatureEnabled, satisfiesMinVersion } from '../utils';
import { getExtensionVersion, getFromSessionStorage } from '../wrapper';
import ResourceLoader from './resource-loader';
import constants from '../../../data/constants';

/**
 * @returns {Promise<string>}
 */
async function getConfigUrl() {
    const override = await getFromSessionStorage('configURLOverride');
    if (override) {
        return override;
    }
    return constants.tdsLists[2].url;
}

export default class RemoteConfig extends ResourceLoader {
    /**
     * @param {{
     *  settings: Settings
     * }} opts
     */
    constructor({ settings }) {
        super(
            {
                name: 'config',
                remoteUrl: getConfigUrl,
                localUrl: '/data/bundled/extension-config.json',
                updateIntervalMinutes: 15,
            },
            { settings },
        );
        /** @type {Config?} */
        this.config = null;
        this.settings = settings;
        this.onUpdate(async (_, etag, v) => {
            this.updateConfig(v);
        });
    }

    /**
     * Honor the published feature state only. OpenFocusd does not assign
     * DDG rollout, target, or experiment cohorts.
     * @param {Config} configValue
     */
    updateConfig(configValue) {
        this.config = structuredClone(configValue);
    }

    /**
     * @param {string} featureName
     * @returns {boolean}
     */
    isFeatureEnabled(featureName) {
        return isFeatureEnabled(featureName, this.config || undefined);
    }

    /**
     * @param {string} featureName
     * @returns {object}
     */
    getFeatureSettings(featureName) {
        return getFeatureSettings(featureName, this.config || undefined);
    }

    /**
     * @param {string} featureName
     * @param {string} subFeatureName
     * @returns {boolean}
     */
    isSubFeatureEnabled(featureName, subFeatureName) {
        if (this.config) {
            return isSubFeatureEnabled(featureName, subFeatureName, this.config);
        }
        return false;
    }
}

/**
 * @param {string} featureName
 * @param {string} subFeatureName
 * @param {Config} config
 * @returns {boolean}
 */
export function isSubFeatureEnabled(featureName, subFeatureName, config) {
    const feature = config.features[featureName];
    const subFeature = (feature?.features || {})[subFeatureName];
    if (!feature || !subFeature) {
        return false;
    }
    if (subFeature.minSupportedVersion) {
        const extensionVersionString = getExtensionVersion();
        if (!satisfiesMinVersion(subFeature.minSupportedVersion, extensionVersionString)) {
            return false;
        }
    }
    return subFeature.state === 'enabled';
}
