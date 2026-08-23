import ResourceLoader from './resource-loader.js';
import constants from '../../../data/constants';

/**
 * @typedef {import('../settings.js')} Settings
 * @typedef {import('./remote-config.js').default} RemoteConfig
 */

export default class TDSStorage {
    /**
     * @param {{
     *  settings: Settings,
     *  remoteConfig: RemoteConfig,
     * }} opts
     */
    constructor({ settings, remoteConfig }) {
        this.settings = settings;
        this.remoteConfig = remoteConfig;
        /** @deprecated config is an alias of remoteConfig */
        this.config = this.remoteConfig;
        this.surrogates = new ResourceLoader(
            {
                name: 'surrogates',
                localUrl: '/data/surrogates.txt',
                format: 'text',
            },
            { settings },
        );
        this.tds = new ResourceLoader(
            {
                name: 'tds',
                remoteUrl: this.getTDSUrl.bind(this),
                updateIntervalMinutes: 15,
            },
            { settings },
        );
    }

    ready() {
        return Promise.all([this.tds.ready, this.surrogates.ready, this.remoteConfig.ready]);
    }

    async getTDSUrl() {
        await this.config.ready;
        return constants.tdsLists[1].url;
    }
}
