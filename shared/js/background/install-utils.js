const settings = require('./settings');
const { getInstallTimestamp } = require('./utils');

/**
 * Persist a local install timestamp for features that need "days since install".
 * Migrates from legacy ATB cohort values when present.
 */
export async function ensureInstalledAt() {
    await settings.ready();
    if (settings.getSetting('installedAt')) {
        return;
    }

    const legacyAtb = settings.getSetting('atb');
    const timestamp = legacyAtb ? getInstallTimestamp(legacyAtb) : Date.now();
    settings.updateSetting('installedAt', timestamp || Date.now());
}
