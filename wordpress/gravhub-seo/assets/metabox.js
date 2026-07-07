/**
 * GravHub SEO — Post Editor Metabox
 *
 * Handles tab switching, live character counters, Google/Social previews,
 * WordPress media uploads, score animation, and focus keyword highlighting.
 *
 * @package GravHub_SEO
 */
(function() {
	'use strict';

	/* =====================================================================
	   Constants
	   ===================================================================== */

	var TITLE_IDEAL_MIN  = 50;
	var TITLE_IDEAL_MAX  = 60;
	var TITLE_WARN_MIN   = 40;
	var TITLE_WARN_MAX   = 65;
	var TITLE_HARD_MAX   = 70; // bar scale max

	var DESC_IDEAL_MIN   = 120;
	var DESC_IDEAL_MAX   = 160;
	var DESC_WARN_MIN    = 100;
	var DESC_WARN_MAX    = 180;
	var DESC_HARD_MAX    = 200; // bar scale max

	var STORAGE_KEY      = 'gravhub_metabox_active_tab';

	/* =====================================================================
	   Utility helpers
	   ===================================================================== */

	/**
	 * Shortcut for getElementById with the gravhub- prefix.
	 *
	 * @param {string} id  The ID suffix (without the "gravhub-" prefix).
	 * @return {HTMLElement|null}
	 */
	function el(id) {
		return document.getElementById('gravhub-' + id);
	}

	/**
	 * Determine the severity class for a character count.
	 *
	 * @param {number} len       Current character count.
	 * @param {number} idealMin  Ideal minimum.
	 * @param {number} idealMax  Ideal maximum.
	 * @param {number} warnMin   Warning lower bound.
	 * @param {number} warnMax   Warning upper bound.
	 * @return {string} "green", "amber", or "red"
	 */
	function counterSeverity(len, idealMin, idealMax, warnMin, warnMax) {
		if (len >= idealMin && len <= idealMax) {
			return 'green';
		}
		if ((len >= warnMin && len < idealMin) || (len > idealMax && len <= warnMax)) {
			return 'amber';
		}
		return 'red';
	}

	/**
	 * Escape HTML entities in a string.
	 *
	 * @param {string} str
	 * @return {string}
	 */
	function escapeHtml(str) {
		var div = document.createElement('div');
		div.appendChild(document.createTextNode(str));
		return div.innerHTML;
	}

	/* =====================================================================
	   Tab Switching
	   ===================================================================== */

	/**
	 * Initialise tab navigation. Persists the active tab in sessionStorage
	 * so the user returns to the same tab after a page reload.
	 */
	function initTabs() {
		var tabs   = document.querySelectorAll('.gravhub-metabox-tab');
		var panels = document.querySelectorAll('.gravhub-tab-panel');

		if (!tabs.length) {
			return;
		}

		/**
		 * Activate a specific tab by its data-tab value.
		 *
		 * @param {string} tabId  The data-tab attribute value.
		 */
		function activateTab(tabId) {
			var i;

			// Deactivate all tabs and panels.
			for (i = 0; i < tabs.length; i++) {
				tabs[i].classList.remove('is-active');
			}
			for (i = 0; i < panels.length; i++) {
				panels[i].classList.remove('is-active');
			}

			// Activate the target tab and panel.
			var targetTab   = document.querySelector('.gravhub-metabox-tab[data-tab="' + tabId + '"]');
			var targetPanel = el('panel-' + tabId);

			if (targetTab) {
				targetTab.classList.add('is-active');
			}
			if (targetPanel) {
				targetPanel.classList.add('is-active');
			}

			// Persist selection.
			try {
				sessionStorage.setItem(STORAGE_KEY, tabId);
			} catch (e) {
				// sessionStorage may be unavailable; fail silently.
			}

			// If switching to the analysis tab, trigger score animation.
			if (tabId === 'analysis') {
				animateScore();
			}
		}

		// Bind click handlers.
		for (var i = 0; i < tabs.length; i++) {
			tabs[i].addEventListener('click', function(e) {
				e.preventDefault();
				var tabId = this.getAttribute('data-tab');
				if (tabId) {
					activateTab(tabId);
				}
			});
		}

		// Restore previously active tab from sessionStorage.
		var saved = null;
		try {
			saved = sessionStorage.getItem(STORAGE_KEY);
		} catch (e) {
			// Ignore.
		}

		if (saved && document.querySelector('.gravhub-metabox-tab[data-tab="' + saved + '"]')) {
			activateTab(saved);
		}
	}

	/* =====================================================================
	   Character Counters
	   ===================================================================== */

	/**
	 * Update a character counter UI (progress bar + text).
	 *
	 * @param {HTMLElement} input     The input or textarea element.
	 * @param {string}      wrapperId The counter wrapper element ID suffix.
	 * @param {number}      idealMin  Ideal minimum character count.
	 * @param {number}      idealMax  Ideal maximum character count.
	 * @param {number}      warnMin   Warning lower bound.
	 * @param {number}      warnMax   Warning upper bound.
	 * @param {number}      hardMax   Hard maximum for bar width calculation.
	 */
	function updateCounter(input, wrapperId, idealMin, idealMax, warnMin, warnMax, hardMax) {
		var wrap = el(wrapperId);
		if (!wrap) {
			return;
		}

		var len      = input.value.length;
		var severity = counterSeverity(len, idealMin, idealMax, warnMin, warnMax);

		// Update bar fill width.
		var fill = wrap.querySelector('.gravhub-counter-fill');
		if (fill) {
			var pct = Math.min((len / hardMax) * 100, 100);
			fill.style.width = pct + '%';
		}

		// Update counter text.
		var text = wrap.querySelector('.gravhub-counter-text');
		if (text) {
			text.textContent = len + ' / ' + idealMin + '–' + idealMax + ' characters';
		}

		// Apply severity class to the wrapper.
		wrap.className = wrap.className
			.replace(/gravhub-counter--(green|amber|red)/g, '')
			.trim();
		wrap.classList.add('gravhub-counter--' + severity);
	}

	/**
	 * Initialise live character counters for the meta title and description fields.
	 */
	function initCounters() {
		var titleInput = el('meta-title');
		var descInput  = el('meta-description');

		if (titleInput) {
			var updateTitle = function() {
				updateCounter(
					titleInput, 'title-counter',
					TITLE_IDEAL_MIN, TITLE_IDEAL_MAX,
					TITLE_WARN_MIN, TITLE_WARN_MAX,
					TITLE_HARD_MAX
				);
			};
			titleInput.addEventListener('input', updateTitle);
			// Set initial state.
			updateTitle();
		}

		if (descInput) {
			var updateDesc = function() {
				updateCounter(
					descInput, 'desc-counter',
					DESC_IDEAL_MIN, DESC_IDEAL_MAX,
					DESC_WARN_MIN, DESC_WARN_MAX,
					DESC_HARD_MAX
				);
			};
			descInput.addEventListener('input', updateDesc);
			// Set initial state.
			updateDesc();
		}
	}

	/* =====================================================================
	   Google Preview
	   ===================================================================== */

	/**
	 * Update the Google search result preview based on current field values.
	 * Falls back to the post title if the meta title is empty.
	 */
	function updateGooglePreview() {
		var titleInput = el('meta-title');
		var descInput  = el('meta-description');
		var previewTitle = el('google-preview-title');
		var previewDesc  = el('google-preview-desc');

		if (!previewTitle || !previewDesc) {
			return;
		}

		// Title: use meta title, or fall back to the WP post title.
		var titleVal = titleInput ? titleInput.value.trim() : '';
		if (!titleVal) {
			// Attempt to read the WP post title from the editor.
			var postTitleEl = document.getElementById('title') ||
				document.querySelector('.editor-post-title__input') ||
				document.querySelector('h1.wp-block-post-title');
			if (postTitleEl) {
				titleVal = (postTitleEl.value || postTitleEl.textContent || '').trim();
			}
		}

		// Highlight focus keyword in the title.
		previewTitle.innerHTML = titleVal ? highlightKeyword(escapeHtml(titleVal)) : escapeHtml('Untitled');

		// Description: use meta description or show a placeholder.
		var descVal = descInput ? descInput.value.trim() : '';
		if (descVal) {
			previewDesc.innerHTML = highlightKeyword(escapeHtml(descVal));
		} else {
			previewDesc.innerHTML = '<em>(No meta description set)</em>';
		}
	}

	/**
	 * Initialise Google Preview listeners.
	 */
	function initGooglePreview() {
		var titleInput = el('meta-title');
		var descInput  = el('meta-description');

		if (titleInput) {
			titleInput.addEventListener('input', updateGooglePreview);
		}
		if (descInput) {
			descInput.addEventListener('input', updateGooglePreview);
		}

		// Also listen to the native WP post title field.
		var postTitleEl = document.getElementById('title');
		if (postTitleEl) {
			postTitleEl.addEventListener('input', updateGooglePreview);
		}

		// Set the permalink in the preview URL.
		var previewUrl = el('google-preview-url');
		if (previewUrl && typeof gravhubMetabox !== 'undefined' && gravhubMetabox.permalink) {
			previewUrl.textContent = gravhubMetabox.permalink;
		}

		// Initial render.
		updateGooglePreview();
	}

	/* =====================================================================
	   Social Preview
	   ===================================================================== */

	/**
	 * Update the social share preview card (Facebook/LinkedIn style).
	 * Falls back to the meta title/description when OG fields are empty.
	 */
	function updateSocialPreview() {
		var ogTitleInput = el('og-title');
		var ogDescInput  = el('og-description');
		var ogImageInput = el('og-image');

		var socialTitle = el('social-preview-title');
		var socialDesc  = el('social-preview-desc');
		var socialImg   = el('social-preview-img');
		var socialImgPlaceholder = el('social-preview-img-placeholder');

		// Title: OG title -> meta title -> post title.
		var titleVal = ogTitleInput ? ogTitleInput.value.trim() : '';
		if (!titleVal) {
			var metaTitleInput = el('meta-title');
			titleVal = metaTitleInput ? metaTitleInput.value.trim() : '';
		}
		if (!titleVal) {
			var postTitleEl = document.getElementById('title') ||
				document.querySelector('.editor-post-title__input');
			if (postTitleEl) {
				titleVal = (postTitleEl.value || postTitleEl.textContent || '').trim();
			}
		}

		if (socialTitle) {
			socialTitle.textContent = titleVal || 'Untitled';
		}

		// Description: OG description -> meta description.
		var descVal = ogDescInput ? ogDescInput.value.trim() : '';
		if (!descVal) {
			var metaDescInput = el('meta-description');
			descVal = metaDescInput ? metaDescInput.value.trim() : '';
		}

		if (socialDesc) {
			socialDesc.textContent = descVal || '';
		}

		// Image.
		var imgUrl = ogImageInput ? ogImageInput.value.trim() : '';
		if (socialImg && socialImgPlaceholder) {
			if (imgUrl) {
				socialImg.src = imgUrl;
				socialImg.style.display = 'block';
				socialImgPlaceholder.style.display = 'none';
			} else {
				socialImg.style.display = 'none';
				socialImgPlaceholder.style.display = '';
			}
		}

		// Domain display.
		var socialDomain = el('social-preview-domain');
		if (socialDomain && typeof gravhubMetabox !== 'undefined' && gravhubMetabox.siteUrl) {
			try {
				socialDomain.textContent = new URL(gravhubMetabox.siteUrl).hostname;
			} catch (e) {
				socialDomain.textContent = gravhubMetabox.siteUrl;
			}
		}
	}

	/**
	 * Initialise Social Preview listeners.
	 */
	function initSocialPreview() {
		var fields = ['og-title', 'og-description', 'og-image', 'meta-title', 'meta-description'];

		for (var i = 0; i < fields.length; i++) {
			var field = el(fields[i]);
			if (field) {
				field.addEventListener('input', updateSocialPreview);
			}
		}

		// Initial render.
		updateSocialPreview();
	}

	/* =====================================================================
	   WordPress Media Library Upload
	   ===================================================================== */

	/**
	 * Initialise the "Upload Image" button to open the WordPress media picker.
	 * On selection, fills the OG Image URL field and updates previews.
	 */
	function initMediaUpload() {
		var uploadBtn  = el('og-image-upload');
		var imageInput = el('og-image');
		var imgPreview = el('og-image-thumb');
		var previewWrap = el('og-image-preview');

		if (!uploadBtn || !imageInput) {
			return;
		}

		var mediaFrame = null;

		uploadBtn.addEventListener('click', function(e) {
			e.preventDefault();

			// If wp.media is not available, fall back gracefully.
			if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
				return;
			}

			// Re-use existing frame if already created.
			if (mediaFrame) {
				mediaFrame.open();
				return;
			}

			// Create a new media frame.
			mediaFrame = wp.media({
				title: 'Select OG Image',
				button: {
					text: 'Use this image'
				},
				multiple: false,
				library: {
					type: 'image'
				}
			});

			// Handle image selection.
			mediaFrame.on('select', function() {
				var attachment = mediaFrame.state().get('selection').first().toJSON();
				imageInput.value = attachment.url;

				// Show the thumbnail preview.
				if (imgPreview) {
					imgPreview.src = attachment.url;
				}
				if (previewWrap) {
					previewWrap.classList.add('has-image');
				}

				// Trigger input event so social preview updates.
				imageInput.dispatchEvent(new Event('input', { bubbles: true }));
			});

			mediaFrame.open();
		});

		// Show existing image preview on load if a URL is already set.
		if (imageInput.value.trim() && imgPreview && previewWrap) {
			imgPreview.src = imageInput.value.trim();
			previewWrap.classList.add('has-image');
		}
	}

	/* =====================================================================
	   Score Circle Animation
	   ===================================================================== */

	/**
	 * Animate the SVG score circle from 0 to the stored score value.
	 * Reads the score from the data-score attribute on the circle SVG element.
	 */
	function animateScore() {
		var svg = el('score-svg');
		if (!svg) {
			return;
		}

		var score        = parseInt(svg.getAttribute('data-score'), 10) || 0;
		var circleFill   = svg.querySelector('.gravhub-score-circle-fill');
		var circleText   = svg.querySelector('.gravhub-score-circle-text');
		var scoreLabel   = el('score-label');

		if (!circleFill) {
			return;
		}

		// Calculate SVG circle dimensions.
		var radius        = parseFloat(circleFill.getAttribute('r'));
		var circumference = 2 * Math.PI * radius;

		// Set the full circumference as the dash array.
		circleFill.style.strokeDasharray = circumference;

		// Start fully hidden (offset = circumference).
		circleFill.style.strokeDashoffset = circumference;

		// Determine stroke color based on score.
		var strokeColor;
		if (score >= 70) {
			strokeColor = '#15803d';
		} else if (score >= 40) {
			strokeColor = '#d97706';
		} else {
			strokeColor = '#dc2626';
		}
		circleFill.style.stroke = strokeColor;

		// Animate using requestAnimationFrame.
		var startTime  = null;
		var duration   = 1000; // 1 second

		function step(timestamp) {
			if (!startTime) {
				startTime = timestamp;
			}

			var progress = Math.min((timestamp - startTime) / duration, 1);

			// Ease out cubic.
			var eased = 1 - Math.pow(1 - progress, 3);

			var currentScore  = Math.round(eased * score);
			var currentOffset = circumference - (eased * score / 100) * circumference;

			circleFill.style.strokeDashoffset = currentOffset;

			if (circleText) {
				circleText.textContent = currentScore;
			}

			if (progress < 1) {
				requestAnimationFrame(step);
			}
		}

		// Reset text before animating.
		if (circleText) {
			circleText.textContent = '0';
		}

		// Update the label.
		if (scoreLabel) {
			scoreLabel.className = 'gravhub-score-label';
			if (score >= 70) {
				scoreLabel.textContent = 'Good';
				scoreLabel.classList.add('gravhub-score-label--good');
			} else if (score >= 40) {
				scoreLabel.textContent = 'Needs Work';
				scoreLabel.classList.add('gravhub-score-label--ok');
			} else {
				scoreLabel.textContent = 'Poor';
				scoreLabel.classList.add('gravhub-score-label--poor');
			}
		}

		requestAnimationFrame(step);
	}

	/* =====================================================================
	   Focus Keyword Highlighting
	   ===================================================================== */

	/** @type {string} Cached focus keyword for highlighting. */
	var currentKeyword = '';

	/**
	 * Highlight occurrences of the focus keyword in a string of escaped HTML.
	 *
	 * @param {string} html  The escaped HTML text to process.
	 * @return {string} HTML with keyword occurrences wrapped in highlight spans.
	 */
	function highlightKeyword(html) {
		if (!currentKeyword) {
			return html;
		}

		// Escape special regex characters in the keyword.
		var escapedKw = currentKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		var regex     = new RegExp('(' + escapedKw + ')', 'gi');

		return html.replace(regex, '<span class="gravhub-keyword-highlight">$1</span>');
	}

	/**
	 * Initialise focus keyword field listener. When the keyword changes,
	 * update the cached value and re-render the Google preview.
	 */
	function initFocusKeyword() {
		var keywordInput = el('focus-keyword');
		if (!keywordInput) {
			return;
		}

		// Set initial value.
		currentKeyword = keywordInput.value.trim();

		keywordInput.addEventListener('input', function() {
			currentKeyword = this.value.trim();
			updateGooglePreview();
		});
	}

	/* =====================================================================
	   Initialisation
	   ===================================================================== */

	/**
	 * Boot all metabox features once the DOM is ready.
	 */
	function init() {
		initTabs();
		initCounters();
		initGooglePreview();
		initSocialPreview();
		initMediaUpload();
		initFocusKeyword();

		// If the analysis tab is active on load, animate immediately.
		var analysisPanel = el('panel-analysis');
		if (analysisPanel && analysisPanel.classList.contains('is-active')) {
			animateScore();
		}
	}

	// Wait for the DOM to be ready.
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

})();
