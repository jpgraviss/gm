<?php
/**
 * GravHub SEO Metabox.
 *
 * Provides a Yoast/RankMath-style metabox on post/page edit screens for
 * managing per-post SEO settings, social meta, robots directives, and
 * real-time SEO analysis.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class GravHub_SEO_Metabox
 */
class GravHub_SEO_Metabox {

	/**
	 * SEO analyzer instance.
	 *
	 * @var GravHub_SEO_Analyzer
	 */
	private $seo_analyzer;

	/**
	 * Meta keys managed by this metabox.
	 *
	 * @var array
	 */
	private $meta_keys = array(
		'_gravhub_meta_title',
		'_gravhub_meta_description',
		'_gravhub_focus_keyword',
		'_gravhub_og_title',
		'_gravhub_og_description',
		'_gravhub_og_image',
		'_gravhub_robots_noindex',
		'_gravhub_robots_nofollow',
		'_gravhub_canonical_url',
	);

	/**
	 * Constructor.
	 *
	 * @param GravHub_SEO_Analyzer $seo_analyzer SEO analyzer instance.
	 */
	public function __construct( GravHub_SEO_Analyzer $seo_analyzer ) {
		$this->seo_analyzer = $seo_analyzer;

		add_action( 'add_meta_boxes', array( $this, 'register_metabox' ) );
		add_action( 'save_post', array( $this, 'save_metabox' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Register the metabox for all public post types.
	 */
	public function register_metabox() {
		$post_types = get_post_types( array( 'public' => true ), 'names' );

		foreach ( $post_types as $post_type ) {
			add_meta_box(
				'gravhub_seo_metabox',
				__( 'GravHub SEO', 'gravhub-seo' ),
				array( $this, 'render_metabox' ),
				$post_type,
				'normal',
				'high'
			);
		}
	}

	/**
	 * Enqueue metabox assets on post edit screens only.
	 *
	 * @param string $hook_suffix The current admin page hook suffix.
	 */
	public function enqueue_assets( $hook_suffix ) {
		if ( ! in_array( $hook_suffix, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		wp_enqueue_style(
			'gravhub-seo-metabox',
			GRAVHUB_SEO_PLUGIN_URL . 'assets/metabox.css',
			array(),
			GRAVHUB_SEO_VERSION
		);

		wp_enqueue_script(
			'gravhub-seo-metabox',
			GRAVHUB_SEO_PLUGIN_URL . 'assets/metabox.js',
			array( 'jquery' ),
			GRAVHUB_SEO_VERSION,
			true
		);

		// Enqueue WordPress media library scripts for OG image picker.
		wp_enqueue_media();
	}

	/**
	 * Render the metabox HTML.
	 *
	 * @param WP_Post $post The current post object.
	 */
	public function render_metabox( $post ) {
		// Load current meta values.
		$meta = array();
		foreach ( $this->meta_keys as $key ) {
			$meta[ $key ] = get_post_meta( $post->ID, $key, true );
		}

		$seo_score  = (int) get_post_meta( $post->ID, '_gravhub_seo_score', true );
		$seo_issues = get_post_meta( $post->ID, '_gravhub_seo_issues', true );
		$seo_issues = $seo_issues ? json_decode( $seo_issues, true ) : array();

		// Nonce field.
		wp_nonce_field( 'gravhub_seo_metabox_save', 'gravhub_seo_metabox_nonce' );

		// Determine score color.
		$score_color = $this->get_score_color( $seo_score );

		// Build the permalink for the Google preview.
		$permalink = get_permalink( $post );
		if ( ! $permalink ) {
			$permalink = home_url( '/' );
		}
		?>

		<div class="gravhub-metabox-wrap">

			<!-- Tab Navigation -->
			<nav class="gravhub-metabox-tabs">
				<button type="button" class="gravhub-tab-button gravhub-tab-active" data-tab="general">
					<?php esc_html_e( 'General', 'gravhub-seo' ); ?>
				</button>
				<button type="button" class="gravhub-tab-button" data-tab="social">
					<?php esc_html_e( 'Social', 'gravhub-seo' ); ?>
				</button>
				<button type="button" class="gravhub-tab-button" data-tab="advanced">
					<?php esc_html_e( 'Advanced', 'gravhub-seo' ); ?>
				</button>
				<button type="button" class="gravhub-tab-button" data-tab="analysis">
					<?php esc_html_e( 'Analysis', 'gravhub-seo' ); ?>
					<?php if ( $seo_score > 0 ) : ?>
						<span class="gravhub-tab-score" style="background: <?php echo esc_attr( $score_color ); ?>;">
							<?php echo esc_html( $seo_score ); ?>
						</span>
					<?php endif; ?>
				</button>
			</nav>

			<!-- General Tab -->
			<div class="gravhub-tab-panel gravhub-tab-panel-active" data-panel="general">

				<!-- Focus Keyword -->
				<div class="gravhub-field">
					<label for="gravhub-focus-keyword">
						<?php esc_html_e( 'Focus Keyword', 'gravhub-seo' ); ?>
					</label>
					<input
						type="text"
						id="gravhub-focus-keyword"
						name="_gravhub_focus_keyword"
						value="<?php echo esc_attr( $meta['_gravhub_focus_keyword'] ); ?>"
						class="widefat"
						placeholder="<?php esc_attr_e( 'Enter the primary keyword for this page', 'gravhub-seo' ); ?>"
					/>
					<p class="gravhub-field-description">
						<?php esc_html_e( 'The main keyword or phrase you want this page to rank for.', 'gravhub-seo' ); ?>
					</p>
				</div>

				<!-- Meta Title -->
				<div class="gravhub-field">
					<label for="gravhub-meta-title">
						<?php esc_html_e( 'Meta Title', 'gravhub-seo' ); ?>
					</label>
					<input
						type="text"
						id="gravhub-meta-title"
						name="_gravhub_meta_title"
						value="<?php echo esc_attr( $meta['_gravhub_meta_title'] ); ?>"
						class="widefat"
						placeholder="<?php echo esc_attr( $post->post_title ); ?>"
						data-counter-target="gravhub-title-counter"
						data-counter-min="50"
						data-counter-max="60"
					/>
					<div class="gravhub-char-counter-wrap">
						<span id="gravhub-title-counter" class="gravhub-char-counter" data-min="50" data-max="60">
							<span class="gravhub-char-count"><?php echo esc_html( mb_strlen( $meta['_gravhub_meta_title'] ) ); ?></span>
							/ 60
						</span>
						<span class="gravhub-char-hint">
							<?php esc_html_e( 'Recommended: 50-60 characters', 'gravhub-seo' ); ?>
						</span>
					</div>
				</div>

				<!-- Meta Description -->
				<div class="gravhub-field">
					<label for="gravhub-meta-description">
						<?php esc_html_e( 'Meta Description', 'gravhub-seo' ); ?>
					</label>
					<textarea
						id="gravhub-meta-description"
						name="_gravhub_meta_description"
						class="widefat"
						rows="3"
						placeholder="<?php esc_attr_e( 'Enter a concise description of this page for search results', 'gravhub-seo' ); ?>"
						data-counter-target="gravhub-desc-counter"
						data-counter-min="120"
						data-counter-max="160"
					><?php echo esc_textarea( $meta['_gravhub_meta_description'] ); ?></textarea>
					<div class="gravhub-char-counter-wrap">
						<span id="gravhub-desc-counter" class="gravhub-char-counter" data-min="120" data-max="160">
							<span class="gravhub-char-count"><?php echo esc_html( mb_strlen( $meta['_gravhub_meta_description'] ) ); ?></span>
							/ 160
						</span>
						<span class="gravhub-char-hint">
							<?php esc_html_e( 'Recommended: 120-160 characters', 'gravhub-seo' ); ?>
						</span>
					</div>
				</div>

				<!-- Google Search Preview -->
				<div class="gravhub-field">
					<label><?php esc_html_e( 'Google Search Preview', 'gravhub-seo' ); ?></label>
					<div class="gravhub-search-preview">
						<div class="gravhub-preview-title" id="gravhub-preview-title">
							<?php
							$preview_title = ! empty( $meta['_gravhub_meta_title'] )
								? $meta['_gravhub_meta_title']
								: $post->post_title;
							echo esc_html( $preview_title );
							?>
						</div>
						<div class="gravhub-preview-url" id="gravhub-preview-url">
							<?php echo esc_html( $permalink ); ?>
						</div>
						<div class="gravhub-preview-description" id="gravhub-preview-description">
							<?php
							$preview_desc = ! empty( $meta['_gravhub_meta_description'] )
								? $meta['_gravhub_meta_description']
								: wp_trim_words( $post->post_content, 25, '...' );
							echo esc_html( $preview_desc );
							?>
						</div>
					</div>
				</div>

			</div>

			<!-- Social Tab -->
			<div class="gravhub-tab-panel" data-panel="social">

				<!-- OG Title -->
				<div class="gravhub-field">
					<label for="gravhub-og-title">
						<?php esc_html_e( 'Social Title', 'gravhub-seo' ); ?>
					</label>
					<input
						type="text"
						id="gravhub-og-title"
						name="_gravhub_og_title"
						value="<?php echo esc_attr( $meta['_gravhub_og_title'] ); ?>"
						class="widefat"
						placeholder="<?php esc_attr_e( 'Title for social media sharing', 'gravhub-seo' ); ?>"
					/>
					<p class="gravhub-field-description">
						<?php esc_html_e( 'Overrides the meta title when shared on Facebook, LinkedIn, etc.', 'gravhub-seo' ); ?>
					</p>
				</div>

				<!-- OG Description -->
				<div class="gravhub-field">
					<label for="gravhub-og-description">
						<?php esc_html_e( 'Social Description', 'gravhub-seo' ); ?>
					</label>
					<textarea
						id="gravhub-og-description"
						name="_gravhub_og_description"
						class="widefat"
						rows="3"
						placeholder="<?php esc_attr_e( 'Description for social media sharing', 'gravhub-seo' ); ?>"
					><?php echo esc_textarea( $meta['_gravhub_og_description'] ); ?></textarea>
				</div>

				<!-- OG Image -->
				<div class="gravhub-field">
					<label for="gravhub-og-image">
						<?php esc_html_e( 'Social Image', 'gravhub-seo' ); ?>
					</label>
					<div class="gravhub-image-field">
						<input
							type="text"
							id="gravhub-og-image"
							name="_gravhub_og_image"
							value="<?php echo esc_attr( $meta['_gravhub_og_image'] ); ?>"
							class="widefat gravhub-og-image-input"
							placeholder="<?php esc_attr_e( 'https://example.com/image.jpg', 'gravhub-seo' ); ?>"
						/>
						<button
							type="button"
							class="button gravhub-upload-image-button"
							data-target="gravhub-og-image"
						>
							<?php esc_html_e( 'Select Image', 'gravhub-seo' ); ?>
						</button>
					</div>
					<p class="gravhub-field-description">
						<?php esc_html_e( 'Recommended size: 1200 x 630 pixels.', 'gravhub-seo' ); ?>
					</p>
					<?php if ( ! empty( $meta['_gravhub_og_image'] ) ) : ?>
						<div class="gravhub-og-image-preview" id="gravhub-og-image-preview">
							<img src="<?php echo esc_url( $meta['_gravhub_og_image'] ); ?>" alt="" />
						</div>
					<?php else : ?>
						<div class="gravhub-og-image-preview" id="gravhub-og-image-preview" style="display: none;">
							<img src="" alt="" />
						</div>
					<?php endif; ?>
				</div>

				<!-- Social Preview Card -->
				<div class="gravhub-field">
					<label><?php esc_html_e( 'Social Preview', 'gravhub-seo' ); ?></label>
					<div class="gravhub-social-preview">
						<div class="gravhub-social-preview-image" id="gravhub-social-preview-image">
							<?php if ( ! empty( $meta['_gravhub_og_image'] ) ) : ?>
								<img src="<?php echo esc_url( $meta['_gravhub_og_image'] ); ?>" alt="" />
							<?php else : ?>
								<div class="gravhub-social-preview-placeholder">
									<?php esc_html_e( 'No image selected', 'gravhub-seo' ); ?>
								</div>
							<?php endif; ?>
						</div>
						<div class="gravhub-social-preview-content">
							<div class="gravhub-social-preview-domain" id="gravhub-social-preview-domain">
								<?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?>
							</div>
							<div class="gravhub-social-preview-title" id="gravhub-social-preview-title">
								<?php
								$social_title = ! empty( $meta['_gravhub_og_title'] )
									? $meta['_gravhub_og_title']
									: ( ! empty( $meta['_gravhub_meta_title'] ) ? $meta['_gravhub_meta_title'] : $post->post_title );
								echo esc_html( $social_title );
								?>
							</div>
							<div class="gravhub-social-preview-desc" id="gravhub-social-preview-desc">
								<?php
								$social_desc = ! empty( $meta['_gravhub_og_description'] )
									? $meta['_gravhub_og_description']
									: ( ! empty( $meta['_gravhub_meta_description'] ) ? $meta['_gravhub_meta_description'] : '' );
								echo esc_html( $social_desc );
								?>
							</div>
						</div>
					</div>
				</div>

			</div>

			<!-- Advanced Tab -->
			<div class="gravhub-tab-panel" data-panel="advanced">

				<!-- Canonical URL -->
				<div class="gravhub-field">
					<label for="gravhub-canonical-url">
						<?php esc_html_e( 'Canonical URL', 'gravhub-seo' ); ?>
					</label>
					<input
						type="url"
						id="gravhub-canonical-url"
						name="_gravhub_canonical_url"
						value="<?php echo esc_attr( $meta['_gravhub_canonical_url'] ); ?>"
						class="widefat"
						placeholder="<?php echo esc_attr( $permalink ); ?>"
					/>
					<p class="gravhub-field-description">
						<?php esc_html_e( 'Set a canonical URL to avoid duplicate content issues. Leave blank to use the default permalink.', 'gravhub-seo' ); ?>
					</p>
				</div>

				<!-- Robots Directives -->
				<div class="gravhub-field">
					<label><?php esc_html_e( 'Robots Directives', 'gravhub-seo' ); ?></label>

					<div class="gravhub-checkbox-group">
						<label class="gravhub-checkbox-label">
							<input
								type="checkbox"
								name="_gravhub_robots_noindex"
								value="1"
								<?php checked( $meta['_gravhub_robots_noindex'], '1' ); ?>
							/>
							<?php esc_html_e( 'No Index', 'gravhub-seo' ); ?>
							<span class="gravhub-checkbox-description">
								<?php esc_html_e( 'Prevent search engines from indexing this page.', 'gravhub-seo' ); ?>
							</span>
						</label>

						<label class="gravhub-checkbox-label">
							<input
								type="checkbox"
								name="_gravhub_robots_nofollow"
								value="1"
								<?php checked( $meta['_gravhub_robots_nofollow'], '1' ); ?>
							/>
							<?php esc_html_e( 'No Follow', 'gravhub-seo' ); ?>
							<span class="gravhub-checkbox-description">
								<?php esc_html_e( 'Prevent search engines from following links on this page.', 'gravhub-seo' ); ?>
							</span>
						</label>
					</div>
				</div>

			</div>

			<!-- Analysis Tab -->
			<div class="gravhub-tab-panel" data-panel="analysis">

				<!-- SEO Score Circle -->
				<div class="gravhub-analysis-header">
					<div class="gravhub-score-circle">
						<svg viewBox="0 0 120 120" width="120" height="120">
							<circle
								cx="60" cy="60" r="54"
								fill="none"
								stroke="#e2e4e7"
								stroke-width="8"
							/>
							<circle
								cx="60" cy="60" r="54"
								fill="none"
								stroke="<?php echo esc_attr( $score_color ); ?>"
								stroke-width="8"
								stroke-linecap="round"
								stroke-dasharray="<?php echo esc_attr( 2 * M_PI * 54 ); ?>"
								stroke-dashoffset="<?php echo esc_attr( 2 * M_PI * 54 * ( 1 - $seo_score / 100 ) ); ?>"
								transform="rotate(-90 60 60)"
							/>
							<text
								x="60" y="55"
								text-anchor="middle"
								font-size="28"
								font-weight="700"
								fill="<?php echo esc_attr( $score_color ); ?>"
							><?php echo esc_html( $seo_score ); ?></text>
							<text
								x="60" y="75"
								text-anchor="middle"
								font-size="11"
								fill="#646970"
							><?php esc_html_e( 'SEO Score', 'gravhub-seo' ); ?></text>
						</svg>
					</div>
					<div class="gravhub-score-summary">
						<?php if ( $seo_score >= 80 ) : ?>
							<p class="gravhub-score-label gravhub-score-label-good">
								<?php esc_html_e( 'Good', 'gravhub-seo' ); ?>
							</p>
							<p class="gravhub-score-message">
								<?php esc_html_e( 'This page is well-optimized for search engines.', 'gravhub-seo' ); ?>
							</p>
						<?php elseif ( $seo_score >= 50 ) : ?>
							<p class="gravhub-score-label gravhub-score-label-ok">
								<?php esc_html_e( 'Needs Improvement', 'gravhub-seo' ); ?>
							</p>
							<p class="gravhub-score-message">
								<?php esc_html_e( 'There are some SEO issues to address on this page.', 'gravhub-seo' ); ?>
							</p>
						<?php elseif ( $seo_score > 0 ) : ?>
							<p class="gravhub-score-label gravhub-score-label-poor">
								<?php esc_html_e( 'Poor', 'gravhub-seo' ); ?>
							</p>
							<p class="gravhub-score-message">
								<?php esc_html_e( 'This page has significant SEO issues that should be fixed.', 'gravhub-seo' ); ?>
							</p>
						<?php else : ?>
							<p class="gravhub-score-label">
								<?php esc_html_e( 'Not Analyzed', 'gravhub-seo' ); ?>
							</p>
							<p class="gravhub-score-message">
								<?php esc_html_e( 'Save or update this post to run SEO analysis.', 'gravhub-seo' ); ?>
							</p>
						<?php endif; ?>
					</div>
				</div>

				<!-- Issues List -->
				<?php if ( ! empty( $seo_issues ) ) : ?>
					<div class="gravhub-issues-panel">
						<h4 class="gravhub-issues-heading">
							<?php
							printf(
								/* translators: %d: number of issues */
								esc_html__( 'Issues Found (%d)', 'gravhub-seo' ),
								count( $seo_issues )
							);
							?>
						</h4>
						<ul class="gravhub-metabox-issues-list">
							<?php foreach ( $seo_issues as $issue ) : ?>
								<li class="gravhub-issue-item">
									<span class="gravhub-severity-badge gravhub-severity-<?php echo esc_attr( $issue['severity'] ); ?>">
										<?php echo esc_html( $issue['severity'] ); ?>
									</span>
									<?php echo esc_html( $issue['message'] ); ?>
								</li>
							<?php endforeach; ?>
						</ul>
					</div>
				<?php elseif ( $seo_score > 0 ) : ?>
					<p class="gravhub-no-issues">
						<?php esc_html_e( 'No issues found. Great job!', 'gravhub-seo' ); ?>
					</p>
				<?php endif; ?>

			</div>

		</div>

		<script type="text/javascript">
		(function($) {
			'use strict';

			// Tab switching.
			$('.gravhub-tab-button').on('click', function(e) {
				e.preventDefault();
				var tab = $(this).data('tab');

				$('.gravhub-tab-button').removeClass('gravhub-tab-active');
				$(this).addClass('gravhub-tab-active');

				$('.gravhub-tab-panel').removeClass('gravhub-tab-panel-active');
				$('.gravhub-tab-panel[data-panel="' + tab + '"]').addClass('gravhub-tab-panel-active');
			});

			// Character counter function.
			function updateCounter(input, counterId) {
				var $counter = $('#' + counterId);
				var len = $(input).val().length;
				var min = parseInt($counter.data('min'), 10);
				var max = parseInt($counter.data('max'), 10);

				$counter.find('.gravhub-char-count').text(len);

				$counter.removeClass('gravhub-counter-good gravhub-counter-warning gravhub-counter-over');
				if (len === 0) {
					// No class.
				} else if (len >= min && len <= max) {
					$counter.addClass('gravhub-counter-good');
				} else if (len > max) {
					$counter.addClass('gravhub-counter-over');
				} else {
					$counter.addClass('gravhub-counter-warning');
				}
			}

			// Bind character counters.
			$('#gravhub-meta-title').on('input', function() {
				updateCounter(this, 'gravhub-title-counter');
				updateGooglePreview();
			});

			$('#gravhub-meta-description').on('input', function() {
				updateCounter(this, 'gravhub-desc-counter');
				updateGooglePreview();
			});

			// Initialize counters on load.
			updateCounter($('#gravhub-meta-title')[0], 'gravhub-title-counter');
			updateCounter($('#gravhub-meta-description')[0], 'gravhub-desc-counter');

			// Google Search Preview live update.
			function updateGooglePreview() {
				var title = $('#gravhub-meta-title').val() || $('#gravhub-meta-title').attr('placeholder') || '';
				var desc  = $('#gravhub-meta-description').val() || '';

				$('#gravhub-preview-title').text(title);
				$('#gravhub-preview-description').text(desc);
			}

			// Social Preview live update.
			$('#gravhub-og-title').on('input', function() {
				var val = $(this).val() || $('#gravhub-meta-title').val() || $('#gravhub-meta-title').attr('placeholder') || '';
				$('#gravhub-social-preview-title').text(val);
			});

			$('#gravhub-og-description').on('input', function() {
				var val = $(this).val() || $('#gravhub-meta-description').val() || '';
				$('#gravhub-social-preview-desc').text(val);
			});

			// WordPress Media Library image picker.
			$('.gravhub-upload-image-button').on('click', function(e) {
				e.preventDefault();

				var targetId = $(this).data('target');
				var $input   = $('#' + targetId);

				var frame = wp.media({
					title: '<?php echo esc_js( __( 'Select Social Image', 'gravhub-seo' ) ); ?>',
					button: { text: '<?php echo esc_js( __( 'Use This Image', 'gravhub-seo' ) ); ?>' },
					multiple: false,
					library: { type: 'image' }
				});

				frame.on('select', function() {
					var attachment = frame.state().get('selection').first().toJSON();
					$input.val(attachment.url).trigger('input');

					// Update image previews.
					$('#gravhub-og-image-preview').show().find('img').attr('src', attachment.url);
					var $socialImg = $('#gravhub-social-preview-image');
					$socialImg.html('<img src="' + attachment.url + '" alt="" />');
				});

				frame.open();
			});

			// Update social image preview on manual URL input.
			$('#gravhub-og-image').on('input', function() {
				var url = $(this).val();
				if (url) {
					$('#gravhub-og-image-preview').show().find('img').attr('src', url);
					$('#gravhub-social-preview-image').html('<img src="' + url + '" alt="" />');
				} else {
					$('#gravhub-og-image-preview').hide();
					$('#gravhub-social-preview-image').html('<div class="gravhub-social-preview-placeholder"><?php echo esc_js( __( 'No image selected', 'gravhub-seo' ) ); ?></div>');
				}
			});
		})(jQuery);
		</script>

		<style type="text/css">
			/* Metabox wrapper */
			.gravhub-metabox-wrap {
				margin: -6px -12px -12px;
			}

			/* Tab navigation */
			.gravhub-metabox-tabs {
				display: flex;
				border-bottom: 2px solid #e2e4e7;
				background: #f6f7f7;
				margin: 0;
				padding: 0;
			}

			.gravhub-tab-button {
				background: none;
				border: none;
				border-bottom: 2px solid transparent;
				margin-bottom: -2px;
				padding: 12px 16px;
				font-size: 13px;
				font-weight: 600;
				color: #50575e;
				cursor: pointer;
				transition: color 0.15s, border-color 0.15s;
				display: flex;
				align-items: center;
				gap: 6px;
			}

			.gravhub-tab-button:hover {
				color: #015035;
			}

			.gravhub-tab-button.gravhub-tab-active {
				color: #015035;
				border-bottom-color: #015035;
			}

			.gravhub-tab-score {
				display: inline-block;
				font-size: 11px;
				font-weight: 700;
				color: #fff;
				padding: 1px 6px;
				border-radius: 10px;
				line-height: 1.4;
			}

			/* Tab panels */
			.gravhub-tab-panel {
				display: none;
				padding: 16px;
			}

			.gravhub-tab-panel-active {
				display: block;
			}

			/* Fields */
			.gravhub-field {
				margin-bottom: 16px;
			}

			.gravhub-field:last-child {
				margin-bottom: 0;
			}

			.gravhub-field > label {
				display: block;
				font-weight: 600;
				margin-bottom: 6px;
				color: #1d2327;
				font-size: 13px;
			}

			.gravhub-field-description {
				margin: 4px 0 0;
				font-size: 12px;
				color: #646970;
				font-style: italic;
			}

			/* Character counter */
			.gravhub-char-counter-wrap {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-top: 4px;
			}

			.gravhub-char-counter {
				font-size: 12px;
				color: #646970;
				font-weight: 600;
			}

			.gravhub-char-counter.gravhub-counter-good {
				color: #00a32a;
			}

			.gravhub-char-counter.gravhub-counter-warning {
				color: #dba617;
			}

			.gravhub-char-counter.gravhub-counter-over {
				color: #d63638;
			}

			.gravhub-char-hint {
				font-size: 12px;
				color: #646970;
			}

			/* Google Search Preview */
			.gravhub-search-preview {
				background: #fff;
				border: 1px solid #dadce0;
				border-radius: 8px;
				padding: 16px;
				max-width: 600px;
				font-family: Arial, sans-serif;
			}

			.gravhub-preview-title {
				font-size: 18px;
				line-height: 1.3;
				color: #1a0dab;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				cursor: pointer;
			}

			.gravhub-preview-title:hover {
				text-decoration: underline;
			}

			.gravhub-preview-url {
				font-size: 13px;
				line-height: 1.5;
				color: #006621;
				margin-top: 2px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.gravhub-preview-description {
				font-size: 13px;
				line-height: 1.54;
				color: #545454;
				margin-top: 2px;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
				overflow: hidden;
			}

			/* Image field */
			.gravhub-image-field {
				display: flex;
				gap: 8px;
				align-items: flex-start;
			}

			.gravhub-image-field .widefat {
				flex: 1;
			}

			.gravhub-og-image-preview {
				margin-top: 8px;
				max-width: 300px;
			}

			.gravhub-og-image-preview img {
				max-width: 100%;
				height: auto;
				border-radius: 4px;
				border: 1px solid #c3c4c7;
			}

			/* Social Preview Card */
			.gravhub-social-preview {
				border: 1px solid #dadce0;
				border-radius: 8px;
				overflow: hidden;
				max-width: 500px;
				background: #fff;
			}

			.gravhub-social-preview-image {
				background: #f0f0f0;
				min-height: 100px;
				max-height: 260px;
				overflow: hidden;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.gravhub-social-preview-image img {
				width: 100%;
				height: auto;
				display: block;
			}

			.gravhub-social-preview-placeholder {
				padding: 40px;
				color: #646970;
				font-size: 13px;
			}

			.gravhub-social-preview-content {
				padding: 12px 16px;
			}

			.gravhub-social-preview-domain {
				font-size: 11px;
				color: #606770;
				text-transform: uppercase;
				letter-spacing: 0.02em;
			}

			.gravhub-social-preview-title {
				font-size: 15px;
				font-weight: 600;
				color: #1d2129;
				line-height: 1.3;
				margin-top: 4px;
			}

			.gravhub-social-preview-desc {
				font-size: 13px;
				color: #606770;
				line-height: 1.4;
				margin-top: 4px;
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
				overflow: hidden;
			}

			/* Checkbox group */
			.gravhub-checkbox-group {
				display: flex;
				flex-direction: column;
				gap: 12px;
			}

			.gravhub-checkbox-label {
				display: flex;
				align-items: flex-start;
				gap: 8px;
				font-weight: 600;
				color: #1d2327;
				font-size: 13px;
				cursor: pointer;
			}

			.gravhub-checkbox-label input[type="checkbox"] {
				margin-top: 2px;
			}

			.gravhub-checkbox-description {
				display: block;
				font-weight: 400;
				color: #646970;
				font-size: 12px;
				margin-top: 2px;
			}

			/* Analysis tab */
			.gravhub-analysis-header {
				display: flex;
				align-items: center;
				gap: 24px;
				margin-bottom: 20px;
				padding-bottom: 20px;
				border-bottom: 1px solid #e2e4e7;
			}

			.gravhub-score-circle {
				flex-shrink: 0;
			}

			.gravhub-score-summary {
				flex: 1;
			}

			.gravhub-score-label {
				font-size: 18px;
				font-weight: 700;
				margin: 0 0 4px;
			}

			.gravhub-score-label-good {
				color: #00a32a;
			}

			.gravhub-score-label-ok {
				color: #dba617;
			}

			.gravhub-score-label-poor {
				color: #d63638;
			}

			.gravhub-score-message {
				margin: 0;
				color: #646970;
				font-size: 13px;
			}

			/* Issues panel */
			.gravhub-issues-heading {
				margin: 0 0 8px;
				font-size: 13px;
				color: #1d2327;
			}

			.gravhub-metabox-issues-list {
				margin: 0;
				padding: 0;
				list-style: none;
			}

			.gravhub-issue-item {
				padding: 8px 12px;
				margin-bottom: 4px;
				background: #f6f7f7;
				border-radius: 4px;
				font-size: 13px;
				line-height: 1.5;
				display: flex;
				align-items: center;
				gap: 8px;
			}

			.gravhub-issue-item .gravhub-severity-badge {
				flex-shrink: 0;
			}
		</style>
		<?php
	}

	/**
	 * Save metabox data when the post is saved.
	 *
	 * @param int     $post_id The post ID.
	 * @param WP_Post $post    The post object.
	 */
	public function save_metabox( $post_id, $post = null ) {
		// Verify nonce.
		if ( ! isset( $_POST['gravhub_seo_metabox_nonce'] ) ||
			! wp_verify_nonce( $_POST['gravhub_seo_metabox_nonce'], 'gravhub_seo_metabox_save' ) ) {
			return;
		}

		// Check autosave.
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		// Check permissions.
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		// Save text fields.
		$text_fields = array(
			'_gravhub_meta_title',
			'_gravhub_focus_keyword',
			'_gravhub_og_title',
			'_gravhub_canonical_url',
			'_gravhub_og_image',
		);

		foreach ( $text_fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				$value = sanitize_text_field( wp_unslash( $_POST[ $field ] ) );
				update_post_meta( $post_id, $field, $value );
			}
		}

		// Save textarea fields.
		$textarea_fields = array(
			'_gravhub_meta_description',
			'_gravhub_og_description',
		);

		foreach ( $textarea_fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				$value = sanitize_textarea_field( wp_unslash( $_POST[ $field ] ) );
				update_post_meta( $post_id, $field, $value );
			}
		}

		// Save URL fields with URL-specific sanitization.
		$url_fields = array(
			'_gravhub_canonical_url',
			'_gravhub_og_image',
		);

		foreach ( $url_fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				$value = esc_url_raw( wp_unslash( $_POST[ $field ] ) );
				update_post_meta( $post_id, $field, $value );
			}
		}

		// Save checkbox fields.
		$checkbox_fields = array(
			'_gravhub_robots_noindex',
			'_gravhub_robots_nofollow',
		);

		foreach ( $checkbox_fields as $field ) {
			if ( isset( $_POST[ $field ] ) && '1' === $_POST[ $field ] ) {
				update_post_meta( $post_id, $field, '1' );
			} else {
				delete_post_meta( $post_id, $field );
			}
		}

		// Run SEO analysis and save computed fields.
		if ( null === $post ) {
			$post = get_post( $post_id );
		}

		if ( $post && 'publish' === $post->post_status ) {
			$analysis = $this->seo_analyzer->analyze_page( $post );

			update_post_meta( $post_id, '_gravhub_seo_score', (int) $analysis['score'] );
			update_post_meta( $post_id, '_gravhub_seo_issues', wp_json_encode( $analysis['issues'] ) );
		}
	}

	/**
	 * Get the color for a given SEO score.
	 *
	 * @param int $score The SEO score (0-100).
	 * @return string Hex color code.
	 */
	private function get_score_color( $score ) {
		if ( $score >= 80 ) {
			return '#00a32a'; // Green.
		} elseif ( $score >= 50 ) {
			return '#dba617'; // Yellow.
		} elseif ( $score > 0 ) {
			return '#d63638'; // Red.
		}
		return '#c3c4c7'; // Gray (not yet analyzed).
	}
}
