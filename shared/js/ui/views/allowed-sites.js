const Parent = window.DDG.base.View;
const t = window.DDG.base.i18n.t;
const { formatRemainingLong } = require('../../shared-utils/site-groups');

const isHiddenClass = 'is-hidden';

function AllowedSites(ops) {
    this.model = ops.model;
    this.pageView = ops.pageView;
    this.template = ops.template;

    Parent.call(this, ops);
    this.setup();
}

AllowedSites.prototype = window.$.extend({}, Parent.prototype, {
    setup() {
        this.bindEvents([
            [this.$el, 'click', this._onClick],
            [this.$el, 'keydown', this._onKeydown],
            [this.$el, 'change', this._onDurationChange],
            [this.store.subscribe, 'change:allowedSites', this._onModelChange],
        ]);
        this._startTimer();
    },

    destroy() {
        this._stopTimer();
        Parent.prototype.destroy.call(this);
    },

    _startTimer() {
        this._stopTimer();
        this._timer = window.setInterval(() => this._tick(), 1000);
    },

    _stopTimer() {
        if (this._timer) {
            window.clearInterval(this._timer);
            this._timer = null;
        }
    },

    async _tick() {
        if (!this.model.locked && !this.model.sanctuaryRemainingSeconds) {
            return;
        }
        this._updatingTimersOnly = true;
        try {
            await this.model.load();
        } catch (error) {
            console.warn('Failed to refresh Sanctuary timer', error);
        } finally {
            this._updatingTimersOnly = false;
        }
    },

    _onModelChange() {
        if (this._updatingTimersOnly) {
            this._updateRemaining();
            return;
        }
        this._rerenderPreservingInput();
    },

    _updateRemaining() {
        const note = this.$el.find('.js-sanctuary-remaining').get(0);
        const remaining = formatRemainingLong(this.model.sanctuaryRemainingSeconds || 0);
        if (note) {
            note.textContent = t('options:sanctuaryActiveNote.title', { remaining });
        }
        if (!this.model.locked) {
            this._updatingTimersOnly = false;
            this._rerenderPreservingInput();
        }
    },

    _rerenderPreservingInput() {
        const input = this.$el.find('.js-allowed-sites-input').get(0);
        const value = input && 'value' in input ? input.value : '';
        const active = document.activeElement;
        const field = active?.className || '';
        const fieldValue = active && 'value' in active ? active.value : null;
        const pendingClear = this._pendingClear;
        this.unbindEvents();
        this._rerender();
        this.setup();
        this._pendingClear = pendingClear;
        const next = this.$el.find('.js-allowed-sites-input').get(0);
        if (next) {
            next.value = value;
        }
        const selector = field.includes('js-sanctuary-hours')
            ? '.js-sanctuary-hours'
            : field.includes('js-sanctuary-minutes')
              ? '.js-sanctuary-minutes'
              : null;
        if (selector) {
            const restored = this.$el.find(selector).get(0);
            if (restored && !restored.disabled && fieldValue != null) {
                restored.value = fieldValue;
                restored.focus();
            }
        }
        if (pendingClear) {
            this.$el.find('.js-allowed-sites-clear-dialog').removeClass(isHiddenClass);
        }
    },

    _onClick(event) {
        const toggle = window.$(event.target).closest('.js-sanctuary-show-popup');
        if (toggle.length) {
            event.preventDefault();
            this._toggleShowOnPopup();
            return;
        }
        const target = window.$(event.target).closest('button');
        if (event.target.classList?.contains('js-allowed-sites-clear-dialog')) {
            this._hideClearDialog();
            return;
        }
        if (!target.length) {
            return;
        }
        if (target.hasClass('js-allowed-sites-add')) {
            this._addSites();
            return;
        }
        if (target.hasClass('js-allowed-sites-remove')) {
            this._removeSite(target.attr('data-pattern'));
            return;
        }
        if (target.hasClass('js-allowed-sites-clear')) {
            if (!target.prop('disabled')) {
                this._showClearDialog();
            }
            return;
        }
        if (target.hasClass('js-allowed-sites-clear-cancel')) {
            this._hideClearDialog();
            return;
        }
        if (target.hasClass('js-allowed-sites-clear-submit')) {
            this._confirmClear();
        }
    },

    _onKeydown(event) {
        if (event.key === 'Escape' && this._pendingClear) {
            event.preventDefault();
            this._hideClearDialog();
        }
    },

    _onDurationChange(event) {
        if (!window.$(event.target).is('.js-sanctuary-hours, .js-sanctuary-minutes')) {
            return;
        }
        this._saveDuration();
    },

    async _saveDuration() {
        if (this.model.locked) {
            return;
        }
        const hours = this.$el.find('.js-sanctuary-hours').val();
        const minutes = this.$el.find('.js-sanctuary-minutes').val();
        try {
            const result = await this.model.saveSanctuary({ hours, minutes });
            if (result?.locked) {
                this._showError(t('options:sanctuaryLockedError.title'));
            }
        } catch (error) {
            console.error('Failed to save Sanctuary duration', error);
        }
    },

    async _toggleShowOnPopup() {
        if (this.model.locked) {
            this._showError(t('options:sanctuaryLockedError.title'));
            return;
        }
        try {
            const result = await this.model.saveSanctuary({ showOnPopup: !this.model.sanctuaryShowOnPopup });
            if (result?.locked) {
                this._showError(t('options:sanctuaryLockedError.title'));
            }
        } catch (error) {
            console.error('Failed to save Sanctuary popup setting', error);
        }
    },

    _errorMessage(error) {
        if (error.reason === 'conflict') {
            return t('options:allowedSiteConflict.title', {
                domain: error.domain,
                groupName: error.groupName,
            });
        }
        if (error.reason === 'tooBroad') {
            return t('options:allowedSiteTooBroad.title', { line: error.line });
        }
        return t('options:allowedSiteInvalid.title', { line: error.line });
    },

    async _addSites() {
        if (this.model.locked) {
            this._showError(t('options:sanctuaryLockedError.title'));
            return;
        }
        const text = this.$el.find('.js-allowed-sites-input').val();
        this._hideError();
        try {
            const result = await this.model.add(text);
            if (result?.locked) {
                this._showError(t('options:sanctuaryLockedError.title'));
                return;
            }
            if (result?.empty) {
                this._showError(t('options:allowedSiteEmpty.title'));
                return;
            }
            if (result?.added?.length || (result?.saved && !result?.errors?.length)) {
                this.$el.find('.js-allowed-sites-input').val('');
            }
            if (result?.errors?.length) {
                this._showError(result.errors.map((error) => this._errorMessage(error)).join('\n'));
            }
        } catch (error) {
            console.error('Failed to add allowed sites', error);
            this._showError(t('options:allowedSitesSaveError.title'));
        }
    },

    async _removeSite(pattern) {
        if (!pattern) {
            return;
        }
        if (this.model.locked) {
            this._showError(t('options:sanctuaryLockedError.title'));
            return;
        }
        this._hideError();
        const result = await this.model.remove(pattern);
        if (result?.locked) {
            this._showError(t('options:sanctuaryLockedError.title'));
        }
    },

    _showClearDialog() {
        if (this.model.locked) {
            this._showError(t('options:sanctuaryLockedError.title'));
            return;
        }
        this._pendingClear = true;
        this.$el.find('.js-allowed-sites-clear-dialog').removeClass(isHiddenClass);
    },

    _hideClearDialog() {
        this._pendingClear = false;
        this.$el.find('.js-allowed-sites-clear-dialog').addClass(isHiddenClass);
    },

    async _confirmClear() {
        this._hideClearDialog();
        this._hideError();
        const result = await this.model.clearAll();
        if (result?.locked) {
            this._showError(t('options:sanctuaryLockedError.title'));
        }
    },

    _showError(message) {
        this.$el.find('.js-allowed-sites-error').text(message).removeClass(isHiddenClass);
    },

    _hideError() {
        this.$el.find('.js-allowed-sites-error').addClass(isHiddenClass).text('');
    },
});

module.exports = AllowedSites;
