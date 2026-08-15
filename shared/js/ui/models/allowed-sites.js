const Parent = window.DDG.base.Model;
const { sanctuaryHoursMinutesToSeconds } = require('../../shared-utils/sanctuary');

function AllowedSites(attrs) {
    attrs.patterns = [];
    attrs.locked = false;
    attrs.sanctuaryDurationSeconds = 3600;
    attrs.sanctuaryShowOnPopup = false;
    attrs.sanctuaryRemainingSeconds = 0;
    Parent.call(this, attrs);
    this.load();
}

AllowedSites.prototype = window.$.extend({}, Parent.prototype, {
    modelName: 'allowedSites',

    applyState(state) {
        this.set({
            patterns: state?.patterns || [],
            locked: Boolean(state?.locked),
        });
        return this.patterns;
    },

    load() {
        return Promise.all([this.sendMessage('getAllowedSites'), this.sendMessage('getSanctuaryState')]).then(([allowed, sanctuary]) => {
            this.set({
                patterns: allowed?.patterns || [],
                locked: Boolean(allowed?.locked || sanctuary?.locked),
                sanctuaryDurationSeconds: sanctuary?.durationSeconds ?? 3600,
                sanctuaryShowOnPopup: Boolean(sanctuary?.showOnPopup),
                sanctuaryRemainingSeconds: sanctuary?.remainingSeconds || 0,
            });
            return this.patterns;
        });
    },

    add(text) {
        return this.sendMessage('addAllowedSites', { text }).then((state) => {
            this.applyState(state);
            return state;
        });
    },

    remove(pattern) {
        return this.sendMessage('removeAllowedSite', { pattern }).then((state) => {
            this.applyState(state);
            return state;
        });
    },

    clearAll() {
        return this.sendMessage('clearAllowedSites').then((state) => {
            this.applyState(state);
            return state;
        });
    },

    saveSanctuary({ hours, minutes, showOnPopup }) {
        const options = {};
        if (hours != null || minutes != null) {
            options.durationSeconds = sanctuaryHoursMinutesToSeconds(hours, minutes);
        }
        if (showOnPopup != null) {
            options.showOnPopup = showOnPopup;
        }
        return this.sendMessage('updateSanctuarySettings', options).then((state) => {
            this.set({
                locked: Boolean(state?.locked),
                sanctuaryDurationSeconds: state?.durationSeconds ?? this.sanctuaryDurationSeconds,
                sanctuaryShowOnPopup: Boolean(state?.showOnPopup),
                sanctuaryRemainingSeconds: state?.remainingSeconds || 0,
            });
            return state;
        });
    },
});

module.exports = AllowedSites;
