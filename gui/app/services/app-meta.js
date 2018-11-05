// Copyright 2016 Documize Inc. <legal@documize.com>. All rights reserved.
//
// This software (Documize Community Edition) is licensed under
// GNU AGPL v3 http://www.gnu.org/licenses/agpl-3.0.en.html
//
// You can operate outside the AGPL restrictions by purchasing
// Documize Enterprise Edition and obtaining a commercial license
// by contacting <sales@documize.com>.
//
// https://documize.com

import $ from 'jquery';
import { htmlSafe } from '@ember/string';
import { resolve } from 'rsvp';
import miscUtil from '../utils/misc';
import config from '../config/environment';
import Service, { inject as service } from '@ember/service';

export default Service.extend({
	ajax: service(),
	localStorage: service(),
	kcAuth: service(),
	appHost: '',
	apiHost: `${config.apiHost}`,
	endpoint: `${config.apiHost}/${config.apiNamespace}`,
	conversionEndpoint: '',
	orgId: '',
	title: '',
	version: '',
	revision: 1000,
	message: '',
	edition: 'Community',
	valid: true,
	allowAnonymousAccess: false,
	authProvider: null,
	authConfig: null,
	setupMode: false,
	secureMode: false,
	maxTags: 3,
	storageProvider: '',

	// for major.minor semver release detection
	// for bugfix releases, only admin is made aware of new release and end users see no What's New messaging
	updateAvailable: false,

	// invalidLicense() {
	// 	return this.valid === false;
	// },

	getBaseUrl(endpoint) {
		return [this.get('endpoint'), endpoint].join('/');
	},

	boot(requestedRoute, requestedUrl) { // eslint-disable-line no-unused-vars
		let constants = this.get('constants');
		this.set('authProvider', constants.AuthProvider.Documize);

		let dbhash;
		if (is.not.null(document.head.querySelector("[property=dbhash]"))) {
			dbhash = document.head.querySelector("[property=dbhash]").content;
		}

		let isInSetupMode = dbhash && dbhash !== "{{.DBhash}}";
		if (isInSetupMode) {
			this.setProperties({
				title: htmlSafe("Documize Setup"),
				allowAnonymousAccess: true,
				setupMode: true
			});

			this.get('localStorage').clearAll();

			return resolve(this);
		}

		requestedRoute = requestedRoute.toLowerCase().trim();

		return this.get('ajax').request('public/meta').then((response) => {
			this.setProperties(response);
			this.set('version', 'v' + this.get('version'));
			this.set('appHost', window.location.host);

			if (requestedRoute === 'secure') {
				this.setProperties({
					title: htmlSafe("Secure document viewing"),
					allowAnonymousAccess: true,
					secureMode: true
				});

				this.get('localStorage').clearAll();
				return resolve(this);
			} else if (is.not.include(requestedUrl, '/auth/')) {
				this.get('localStorage').storeSessionItem('entryUrl', requestedUrl);
			}

			let self = this;
			let cacheBuster = + new Date();

			$.getJSON(`https://storage.googleapis.com/documize/news/meta.json?cb=${cacheBuster}`, function (versions) {
				let cv = 'v' + versions.community.version;
				let ev = 'v' + versions.enterprise.version;
				let re = self.get('edition');
				let rv = self.get('version');

				self.set('communityLatest', cv);
				self.set('enterpriseLatest', ev);
				self.set('updateAvailable', false); // set to true for testing

				let isNewCommunity = miscUtil.isNewVersion(rv, cv, true);
				let isNewEnterprise = miscUtil.isNewVersion(rv, ev, true);

				if (re === 'Community' && isNewCommunity) self.set('updateAvailable', true);
				if (re === 'Enterprise' && isNewEnterprise) self.set('updateAvailable', true);
			});

			return response;
		});
	}
});
