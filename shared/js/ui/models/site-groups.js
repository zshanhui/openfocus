const Parent = window.DDG.base.Model;

function SiteGroups(attrs) {
    attrs.groups = [];
    attrs.blockAdultGamblingSites = false;
    attrs.categoryBlockSupported = false;
    Parent.call(this, attrs);
    this.load();
}

SiteGroups.prototype = window.$.extend({}, Parent.prototype, {
    modelName: 'siteGroups',

    load() {
        return this.sendMessage('getSiteGroupsState').then((state) => {
            this.set('groups', state?.groups || []);
            this.set('blockAdultGamblingSites', Boolean(state?.blockAdultGamblingSites));
            this.set('categoryBlockSupported', Boolean(state?.categoryBlockSupported));
            return this.groups;
        });
    },

    setAdultGamblingBlock(enabled) {
        return this.sendMessage('setAdultGamblingBlock', { enabled }).then((state) => {
            this.set('groups', state?.groups || []);
            this.set('blockAdultGamblingSites', Boolean(state?.blockAdultGamblingSites));
            this.set('categoryBlockSupported', Boolean(state?.categoryBlockSupported));
            return state;
        });
    },

    create() {
        return this.sendMessage('createSiteGroup').then((state) => {
            this.set('groups', state?.groups || []);
            return state;
        });
    },

    updateGroup(id, { name, maxSecondsPerDay }) {
        return this.sendMessage('updateSiteGroup', { id, name, maxSecondsPerDay }).then((state) => {
            this.set('groups', state?.groups || []);
            return state;
        });
    },

    deleteGroup(id) {
        return this.sendMessage('deleteSiteGroup', { id }).then((state) => {
            this.set('groups', state?.groups || []);
            return state;
        });
    },

    addDomain(groupId, domain, replaceAllowed = false) {
        return this.sendMessage('addSiteToGroup', { groupId, domain, replaceAllowed }).then((state) => {
            this.set('groups', state?.groups || []);
            return state;
        });
    },

    removeDomain(groupId, domain) {
        return this.sendMessage('removeSiteFromGroup', { groupId, domain }).then((state) => {
            this.set('groups', state?.groups || []);
            return state;
        });
    },
});

module.exports = SiteGroups;
