const bel = require('nanohtml');
const t = window.DDG.base.i18n.t;
const toggleButton = require('./shared/toggle-button.js');
const { secondsToHoursMinutes, formatRemainingLong } = require('../../shared-utils/site-groups');

function globeIcon() {
    return bel`<svg class="allowed-sites-chip__icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.25"></circle>
        <path d="M2 8h12M8 2c2.2 2.2 2.2 9.8 0 12M8 2c-2.2 2.2-2.2 9.8 0 12" fill="none" stroke="currentColor" stroke-width="1.25"></path>
    </svg>`;
}

function siteChip(pattern, locked) {
    return bel`<li class="allowed-sites-chip">
        <button
            class="allowed-sites-chip__remove js-allowed-sites-remove"
            type="button"
            data-pattern="${pattern}"
            aria-label="${t('options:removeAllowedSite.title', { pattern })}"
            disabled=${locked}
        >×</button>
        ${globeIcon()}
        <span class="allowed-sites-chip__pattern">${pattern}</span>
    </li>`;
}

module.exports = function () {
    const patterns = this.model.patterns || [];
    const empty = patterns.length === 0;
    const locked = Boolean(this.model.locked);
    const time = secondsToHoursMinutes(this.model.sanctuaryDurationSeconds || 0);
    const remaining = formatRemainingLong(this.model.sanctuaryRemainingSeconds || 0);

    return bel`<section class="options-content__allowed-sites${locked ? ' is-locked' : ''}">
        <h2 class="menu-title">${t('options:allowedSitesHeading.title')}</h2>
        <p class="menu-paragraph">${t('options:allowedSitesIntro.title')}</p>
        <ul class="allowed-sites-tips">
            <li>${t('options:allowedSitesTipMultiple.title')}</li>
            <li>${t('options:allowedSitesTipWildcard.title')}</li>
        </ul>
        <textarea
            class="allowed-sites-input js-allowed-sites-input"
            rows="6"
            spellcheck="false"
            placeholder="${t('options:allowedSitesPlaceholder.title')}"
            disabled=${locked}
        ></textarea>
        <button class="allowed-sites-add js-allowed-sites-add" type="button" disabled=${locked}>${t('options:addAllowedSites.title')}</button>
        <p class="allowed-sites-remove-hint">${t('options:allowedSitesRemoveHint.title')}</p>
        <ul class="allowed-sites-list js-allowed-sites-list">
            ${patterns.map((pattern) => siteChip(pattern, locked))}
        </ul>
        <p class="allowed-sites-error is-hidden js-allowed-sites-error" role="alert"></p>
        <button class="allowed-sites-clear js-allowed-sites-clear" type="button" disabled=${empty || locked}>${t('options:clearAllAllowedSites.title')}</button>
        <p class="allowed-sites-note">${t('options:allowedSitesNote.title')}</p>
        <section class="sanctuary-settings">
            <h2 class="menu-title">${t('options:sanctuaryHeading.title')}</h2>
            ${locked ? bel`<p class="sanctuary-locked-note js-sanctuary-remaining">${t('options:sanctuaryActiveNote.title', { remaining })}</p>` : null}
            <p class="menu-paragraph">${t('options:sanctuaryDesc.title')}</p>
            <div class="site-group-time sanctuary-duration">
                <span class="site-group-time__label">${t('options:sanctuaryDuration.title')}</span>
                <label class="site-group-time__unit">
                    <input class="js-sanctuary-hours" type="number" min="0" max="5" value="${time.hours}" disabled=${locked}>
                    <span>${t('options:hoursAbbr.title')}</span>
                </label>
                <label class="site-group-time__unit">
                    <input class="js-sanctuary-minutes" type="number" min="0" max="59" value="${time.minutes}" disabled=${locked || time.hours >= 5}>
                    <span>${t('options:minutesAbbr.title')}</span>
                </label>
            </div>
            <div class="sanctuary-toggle">
                <h3 class="menu-title sanctuary-toggle__title">
                    ${t('options:sanctuaryShowOnPopup.title')}
                    ${toggleButton(Boolean(this.model.sanctuaryShowOnPopup), `js-sanctuary-show-popup${locked ? ' is-disabled' : ''}`, 'sanctuaryShowOnPopup')}
                </h3>
                <p class="menu-paragraph">${t('options:sanctuaryShowOnPopupDesc.title')}</p>
            </div>
        </section>
        <div class="site-group-dialog is-hidden js-allowed-sites-clear-dialog" role="dialog" aria-modal="true" aria-labelledby="allowed-sites-clear-dialog-title">
            <div class="site-group-dialog__panel">
                <p class="site-group-dialog__text" id="allowed-sites-clear-dialog-title">${t('options:clearAllAllowedConfirm.title')}</p>
                <div class="site-group-dialog__actions">
                    <button class="site-group-dialog__no js-allowed-sites-clear-cancel" type="button">${t('options:confirmCancel.title')}</button>
                    <button class="site-group-dialog__yes js-allowed-sites-clear-submit" type="button">${t('options:confirmClearAll.title')}</button>
                </div>
            </div>
        </div>
    </section>`;
};
