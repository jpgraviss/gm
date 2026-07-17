<?php
/**
 * GravHub Admin Page.
 *
 * Handles the plugin's admin settings page.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class GravHub_Admin_Page
 */
class GravHub_Admin_Page {

	/**
	 * API client instance.
	 *
	 * @var GravHub_API_Client
	 */
	private $api_client;

	/**
	 * SEO analyzer instance.
	 *
	 * @var GravHub_SEO_Analyzer
	 */
	private $seo_analyzer;

	/**
	 * Health reporter instance — used to seed the dashboard notification
	 * feed with cheap (no-live-HTTP-call) update signals and the last
	 * cached security-check result, without ever calling
	 * collect_health_data() fresh on a page render.
	 *
	 * @var GravHub_Health_Reporter
	 */
	private $health_reporter;

	/**
	 * Redirect manager instance — used to surface real redirect/404 counts
	 * in the dashboard notification feed and module grid.
	 *
	 * @var GravHub_Redirect_Manager
	 */
	private $redirect_manager;

	/**
	 * Constructor.
	 *
	 * @param GravHub_API_Client       $api_client       API client instance.
	 * @param GravHub_SEO_Analyzer     $seo_analyzer     SEO analyzer instance.
	 * @param GravHub_Health_Reporter  $health_reporter  Health reporter instance.
	 * @param GravHub_Redirect_Manager $redirect_manager Redirect manager instance.
	 */
	public function __construct( GravHub_API_Client $api_client, GravHub_SEO_Analyzer $seo_analyzer, GravHub_Health_Reporter $health_reporter, GravHub_Redirect_Manager $redirect_manager ) {
		$this->api_client       = $api_client;
		$this->seo_analyzer     = $seo_analyzer;
		$this->health_reporter  = $health_reporter;
		$this->redirect_manager = $redirect_manager;

		// Priority 5, not the default 10 — must run before
		// GravHub_Redirect_Manager::register_menu() (also hooked at the
		// default priority) so our self-referencing submenu below lands
		// first in $submenu['gravhub-seo']. See register_menu()'s docblock
		// for why that ordering matters.
		add_action( 'admin_menu', array( $this, 'register_menu' ), 5 );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		// Unconditional (no hook_suffix check) — the sidebar menu this guards
		// against renders on every wp-admin screen, not just our own pages.
		add_action( 'admin_footer', array( $this, 'print_menu_guard_script' ) );
	}

	/**
	 * Register admin menu.
	 *
	 * WordPress core quirk: if a top-level menu's only registered submenu
	 * has a different slug than the parent, core silently points the
	 * top-level sidebar link at that submenu instead of the page
	 * registered here via add_menu_page() — the "GravHub SEO" button would
	 * open Redirects instead of the dashboard. add_menu_page() alone
	 * doesn't populate $submenu['gravhub-seo'] at all; only
	 * add_submenu_page() calls do, and GravHub_Redirect_Manager's
	 * "Redirects" page (slug gravhub-seo-redirects) is the only other one
	 * registered under this parent. The fix is the explicit
	 * add_submenu_page() call below, self-referencing the same slug as the
	 * parent — WordPress recognizes that as "the top-level page already has
	 * its own entry" and stops redirecting. It has to run before Redirects'
	 * registration (hence this method being hooked at priority 5, see
	 * __construct()) since WordPress uses whichever submenu was added
	 * first.
	 */
	public function register_menu() {
		add_menu_page(
			__( 'GravHub SEO', 'gravhub-seo' ),
			__( 'GravHub SEO', 'gravhub-seo' ),
			'manage_gravhub_seo',
			'gravhub-seo',
			array( $this, 'render_page' ),
			'dashicons-search',
			80
		);

		add_submenu_page(
			'gravhub-seo',
			__( 'GravHub SEO', 'gravhub-seo' ),
			__( 'Dashboard', 'gravhub-seo' ),
			'manage_gravhub_seo',
			'gravhub-seo',
			array( $this, 'render_page' )
		);
	}

	/**
	 * Register settings using the Settings API.
	 */
	public function register_settings() {
		// API key.
		register_setting(
			'gravhub_seo_settings',
			GravHub_API_Client::OPTION_API_KEY,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			)
		);

		// API URL.
		register_setting(
			'gravhub_seo_settings',
			GravHub_API_Client::OPTION_API_URL,
			array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
				'default'           => '',
			)
		);

		// Sitemap enabled.
		register_setting(
			'gravhub_seo_settings',
			'gravhub_sitemap_enabled',
			array(
				'type'              => 'boolean',
				'sanitize_callback' => 'rest_sanitize_boolean',
				'default'           => true,
			)
		);

		// Sitemap post types.
		register_setting(
			'gravhub_seo_settings',
			'gravhub_sitemap_post_types',
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize_post_types' ),
				'default'           => array( 'post', 'page' ),
			)
		);

		// Module states.
		register_setting(
			'gravhub_seo_settings',
			'gravhub_module_states',
			array(
				'type'              => 'object',
				'sanitize_callback' => array( $this, 'sanitize_module_states' ),
				'default'           => array(
					'seo_analysis'    => 1,
					'focus_keywords'  => 1,
					'meta_management' => 1,
					'xml_sitemap'     => 1,
					'social_previews' => 0,
				),
			)
		);

		// Connection section.
		add_settings_section(
			'gravhub_connection',
			__( 'Connection Settings', 'gravhub-seo' ),
			array( $this, 'render_connection_section_description' ),
			'gravhub-seo'
		);

		add_settings_field(
			'gravhub_api_url',
			__( 'GravHub URL', 'gravhub-seo' ),
			array( $this, 'render_api_url_field' ),
			'gravhub-seo',
			'gravhub_connection'
		);

		add_settings_field(
			'gravhub_api_key',
			__( 'API Key', 'gravhub-seo' ),
			array( $this, 'render_api_key_field' ),
			'gravhub-seo',
			'gravhub_connection'
		);

		$this->register_schema_settings();
	}

	/**
	 * Organization + WebSite + LocalBusiness JSON-LD settings. Rendered on
	 * the same 'gravhub-seo' settings page as Connection (so it saves
	 * through the same existing <form>), under its own section — neither
	 * schema type is fabricated: output stays off entirely
	 * (see GravHub_Meta_Manager::has_site_schema_config()) until real values
	 * are entered here.
	 */
	private function register_schema_settings() {
		register_setting( 'gravhub_seo_settings', 'gravhub_org_name', array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => '',
		) );
		register_setting( 'gravhub_seo_settings', 'gravhub_org_logo', array(
			'type'              => 'string',
			'sanitize_callback' => 'esc_url_raw',
			'default'           => '',
		) );
		register_setting( 'gravhub_seo_settings', 'gravhub_org_same_as', array(
			'type'              => 'string',
			'sanitize_callback' => array( $this, 'sanitize_same_as' ),
			'default'           => '',
		) );
		register_setting( 'gravhub_seo_settings', 'gravhub_local_business_enabled', array(
			'type'              => 'boolean',
			'sanitize_callback' => 'rest_sanitize_boolean',
			'default'           => false,
		) );
		register_setting( 'gravhub_seo_settings', 'gravhub_local_business_type', array(
			'type'              => 'string',
			'sanitize_callback' => array( $this, 'sanitize_local_business_type' ),
			'default'           => 'LocalBusiness',
		) );
		foreach ( array( 'name', 'address', 'city', 'state', 'zip', 'country', 'phone' ) as $field ) {
			register_setting( 'gravhub_seo_settings', 'gravhub_local_business_' . $field, array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			) );
		}

		add_settings_section(
			'gravhub_schema',
			__( 'Organization & Local Business Schema', 'gravhub-seo' ),
			array( $this, 'render_schema_section_description' ),
			'gravhub-seo'
		);

		add_settings_field(
			'gravhub_org_identity',
			__( 'Organization', 'gravhub-seo' ),
			array( $this, 'render_org_identity_field' ),
			'gravhub-seo',
			'gravhub_schema'
		);

		add_settings_field(
			'gravhub_org_same_as',
			__( 'Same As (social profiles)', 'gravhub-seo' ),
			array( $this, 'render_same_as_field' ),
			'gravhub-seo',
			'gravhub_schema'
		);

		add_settings_field(
			'gravhub_local_business',
			__( 'Local Business', 'gravhub-seo' ),
			array( $this, 'render_local_business_field' ),
			'gravhub-seo',
			'gravhub_schema'
		);
	}

	/**
	 * Sanitize the Same As textarea: one URL per line, invalid lines dropped
	 * rather than saved malformed.
	 */
	public function sanitize_same_as( $value ) {
		if ( ! is_string( $value ) ) {
			return '';
		}
		$lines = preg_split( '/[\r\n]+/', $value );
		$clean = array();
		foreach ( $lines as $line ) {
			$line = trim( $line );
			if ( '' === $line ) {
				continue;
			}
			$escaped = esc_url_raw( $line );
			if ( ! empty( $escaped ) ) {
				$clean[] = $escaped;
			}
		}
		return implode( "\n", $clean );
	}

	/**
	 * Restrict LocalBusiness @type to a known-safe schema.org subset rather
	 * than accepting an arbitrary string into JSON-LD output.
	 */
	public function sanitize_local_business_type( $value ) {
		$allowed = array( 'LocalBusiness', 'ProfessionalService', 'MarketingAgency', 'Store', 'Restaurant', 'MedicalBusiness' );
		return in_array( $value, $allowed, true ) ? $value : 'LocalBusiness';
	}

	/**
	 * Render schema section description.
	 */
	public function render_schema_section_description() {
		echo '<p>' . esc_html__( 'Powers Organization, WebSite, and LocalBusiness JSON-LD on the homepage. Nothing is output until real values are entered here — no data is guessed or fabricated.', 'gravhub-seo' ) . '</p>';
	}

	/**
	 * Render Organization name + logo fields.
	 */
	public function render_org_identity_field() {
		$name = get_option( 'gravhub_org_name', '' );
		$logo = get_option( 'gravhub_org_logo', '' );
		printf(
			'<input type="text" name="gravhub_org_name" value="%s" class="regular-text" placeholder="%s" /><br /><br />',
			esc_attr( $name ),
			esc_attr__( 'Business or organization name', 'gravhub-seo' )
		);
		printf(
			'<input type="url" name="gravhub_org_logo" value="%s" class="regular-text" placeholder="%s" />',
			esc_attr( $logo ),
			esc_attr__( 'https://example.com/logo.png', 'gravhub-seo' )
		);
		echo '<p class="description">' . esc_html__( 'Name and logo URL used for Organization + WebSite schema on the homepage.', 'gravhub-seo' ) . '</p>';
	}

	/**
	 * Render the Same As textarea (one URL per line).
	 */
	public function render_same_as_field() {
		$value = get_option( 'gravhub_org_same_as', '' );
		printf(
			'<textarea name="gravhub_org_same_as" rows="4" class="large-text" placeholder="%s">%s</textarea>',
			esc_attr__( "https://www.linkedin.com/company/...\nhttps://www.facebook.com/...", 'gravhub-seo' ),
			esc_textarea( $value )
		);
		echo '<p class="description">' . esc_html__( 'One URL per line — company (not personal) social profiles, e.g. LinkedIn company page, Facebook page, Instagram.', 'gravhub-seo' ) . '</p>';
	}

	/**
	 * Render the LocalBusiness fieldset: enable checkbox, type, and address.
	 */
	public function render_local_business_field() {
		$enabled = (bool) get_option( 'gravhub_local_business_enabled', false );
		$type    = get_option( 'gravhub_local_business_type', 'LocalBusiness' );
		$name    = get_option( 'gravhub_local_business_name', '' );
		$address = get_option( 'gravhub_local_business_address', '' );
		$city    = get_option( 'gravhub_local_business_city', '' );
		$state   = get_option( 'gravhub_local_business_state', '' );
		$zip     = get_option( 'gravhub_local_business_zip', '' );
		$country = get_option( 'gravhub_local_business_country', '' );
		$phone   = get_option( 'gravhub_local_business_phone', '' );

		$types = array(
			'LocalBusiness'       => __( 'Local Business (generic)', 'gravhub-seo' ),
			'ProfessionalService' => __( 'Professional Service', 'gravhub-seo' ),
			'MarketingAgency'     => __( 'Marketing Agency', 'gravhub-seo' ),
			'Store'               => __( 'Store', 'gravhub-seo' ),
			'Restaurant'          => __( 'Restaurant', 'gravhub-seo' ),
			'MedicalBusiness'     => __( 'Medical Business', 'gravhub-seo' ),
		);

		printf(
			'<label><input type="checkbox" name="gravhub_local_business_enabled" value="1" %s /> %s</label>',
			checked( $enabled, true, false ),
			esc_html__( 'This site has an addressable local presence worth marking up (mailing address, storefront, or office)', 'gravhub-seo' )
		);
		echo '<br /><br />';

		echo '<select name="gravhub_local_business_type">';
		foreach ( $types as $value => $label ) {
			printf( '<option value="%s" %s>%s</option>', esc_attr( $value ), selected( $type, $value, false ), esc_html( $label ) );
		}
		echo '</select>';
		echo '<p class="description">' . esc_html__( 'Business type for schema.org markup.', 'gravhub-seo' ) . '</p>';

		printf(
			'<input type="text" name="gravhub_local_business_name" value="%s" class="regular-text" placeholder="%s" /><br /><br />',
			esc_attr( $name ),
			esc_attr__( 'Business name (defaults to Organization name above if left blank)', 'gravhub-seo' )
		);
		printf(
			'<input type="text" name="gravhub_local_business_address" value="%s" class="regular-text" placeholder="%s" /><br /><br />',
			esc_attr( $address ),
			esc_attr__( 'Street address', 'gravhub-seo' )
		);
		printf(
			'<input type="text" name="gravhub_local_business_city" value="%s" placeholder="%s" style="width:23%%" /> ',
			esc_attr( $city ),
			esc_attr__( 'City', 'gravhub-seo' )
		);
		printf(
			'<input type="text" name="gravhub_local_business_state" value="%s" placeholder="%s" style="width:23%%" /> ',
			esc_attr( $state ),
			esc_attr__( 'State/Region', 'gravhub-seo' )
		);
		printf(
			'<input type="text" name="gravhub_local_business_zip" value="%s" placeholder="%s" style="width:23%%" /> ',
			esc_attr( $zip ),
			esc_attr__( 'Postal Code', 'gravhub-seo' )
		);
		printf(
			'<input type="text" name="gravhub_local_business_country" value="%s" placeholder="%s" style="width:23%%" /><br /><br />',
			esc_attr( $country ),
			esc_attr__( 'Country', 'gravhub-seo' )
		);
		printf(
			'<input type="text" name="gravhub_local_business_phone" value="%s" class="regular-text" placeholder="%s" />',
			esc_attr( $phone ),
			esc_attr__( 'Phone number', 'gravhub-seo' )
		);
		echo '<p class="description">' . esc_html__( 'LocalBusiness schema only prints once this box is checked AND a name + street address are both filled in.', 'gravhub-seo' ) . '</p>';
	}

	/**
	 * Sanitize post types array.
	 *
	 * @param mixed $value The value to sanitize.
	 * @return array Sanitized array of post type slugs.
	 */
	public function sanitize_post_types( $value ) {
		if ( ! is_array( $value ) ) {
			return array( 'post', 'page' );
		}
		return array_map( 'sanitize_key', $value );
	}

	/**
	 * Sanitize module states.
	 *
	 * @param mixed $value The value to sanitize.
	 * @return array Sanitized module states.
	 */
	public function sanitize_module_states( $value ) {
		if ( ! is_array( $value ) ) {
			return array();
		}
		$sanitized = array();
		foreach ( $value as $key => $state ) {
			$sanitized[ sanitize_key( $key ) ] = absint( $state ) ? 1 : 0;
		}
		return $sanitized;
	}

	/**
	 * Enqueue admin assets on the plugin page only.
	 *
	 * @param string $hook_suffix The current admin page hook suffix.
	 */
	public function enqueue_assets( $hook_suffix ) {
		// Both our own pages: the main dashboard (a top-level menu page, hook
		// suffix 'toplevel_page_{slug}') and the Redirects submenu (hook
		// suffix '{parent_slug}_page_{slug}') — redirects-page.php uses the
		// same .gravhub-* classes as the dashboard and was silently rendering
		// unstyled because this only ever matched the top-level page.
		$our_pages = array( 'toplevel_page_gravhub-seo', 'gravhub-seo_page_gravhub-seo-redirects' );
		if ( ! in_array( $hook_suffix, $our_pages, true ) ) {
			return;
		}

		wp_enqueue_style(
			'gravhub-seo-admin',
			GRAVHUB_SEO_PLUGIN_URL . 'assets/admin.css',
			array(),
			GRAVHUB_SEO_VERSION
		);

		// JS is inlined in the settings-page.php / redirects-page.php templates.
	}

	/**
	 * Defensive guard against third-party scripts rewriting our sidebar
	 * menu links. Confirmed cause on one live site: a WPCode snippet meant
	 * for the public site was scoped to also run in wp-admin, and rewrote
	 * "admin.php?page=gravhub-seo-redirects" into a bare "/gravhub-seo-
	 * redirects" path — WordPress has no route for that, so it fell through
	 * to the front-end 404 page instead of opening the Redirects screen.
	 *
	 * Runs on every admin page (not just ours) because the sidebar menu it
	 * protects is present everywhere. Re-asserts the correct, server-computed
	 * href on any link whose href still contains one of our page slugs —
	 * matching by slug substring rather than exact string means this keeps
	 * working no matter what shape the mangling takes, as long as the slug
	 * itself survives in the corrupted href.
	 */
	public function print_menu_guard_script() {
		$canonical = array(
			'gravhub-seo-redirects' => admin_url( 'admin.php?page=gravhub-seo-redirects' ),
			'gravhub-seo'           => admin_url( 'admin.php?page=gravhub-seo' ),
		);
		?>
		<script>
		( function () {
			var CANONICAL = <?php echo wp_json_encode( $canonical ); ?>;
			// Longest slug first so "gravhub-seo-redirects" wins over the
			// shorter "gravhub-seo" substring it contains.
			var SLUGS = Object.keys( CANONICAL ).sort( function ( a, b ) { return b.length - a.length; } );

			function fix() {
				var links = document.querySelectorAll( 'a[href*="gravhub-seo"]' );
				for ( var i = 0; i < links.length; i++ ) {
					var a = links[ i ];
					for ( var j = 0; j < SLUGS.length; j++ ) {
						if ( a.href.indexOf( SLUGS[ j ] ) !== -1 ) {
							if ( a.href !== CANONICAL[ SLUGS[ j ] ] ) {
								a.href = CANONICAL[ SLUGS[ j ] ];
							}
							break;
						}
					}
				}
			}

			if ( document.readyState === 'loading' ) {
				document.addEventListener( 'DOMContentLoaded', fix );
			} else {
				fix();
			}
			// Re-apply right before the flyout submenu is shown and right
			// before navigation, in case something rewrites hrefs lazily
			// after our initial pass instead of at load time.
			document.addEventListener( 'mouseover', function ( e ) {
				if ( e.target.closest && e.target.closest( '#toplevel_page_gravhub-seo' ) ) {
					fix();
				}
			}, true );
			document.addEventListener( 'click', function ( e ) {
				if ( e.target.closest && e.target.closest( 'a[href*="gravhub-seo"]' ) ) {
					fix();
				}
			}, true );
		} )();
		</script>
		<?php
	}

	/**
	 * Render connection section description.
	 */
	public function render_connection_section_description() {
		echo '<p>' . esc_html__( 'Enter your GravHub platform credentials to connect this site.', 'gravhub-seo' ) . '</p>';
	}

	/**
	 * Render API URL field.
	 */
	public function render_api_url_field() {
		$value = $this->api_client->get_api_url();
		printf(
			'<input type="url" id="gravhub_api_url" name="%s" value="%s" class="regular-text" placeholder="https://app.gravhub.io" />',
			esc_attr( GravHub_API_Client::OPTION_API_URL ),
			esc_attr( $value )
		);
		echo '<p class="description">' . esc_html__( 'The URL of your GravHub instance.', 'gravhub-seo' ) . '</p>';
	}

	/**
	 * Render API key field.
	 */
	public function render_api_key_field() {
		$value = $this->api_client->get_api_key();
		printf(
			'<input type="password" id="gravhub_api_key" name="%s" value="%s" class="regular-text" autocomplete="off" />',
			esc_attr( GravHub_API_Client::OPTION_API_KEY ),
			esc_attr( $value )
		);
		echo '<p class="description">' . esc_html__( 'Your GravHub API key. Found in GravHub under Settings > API Keys.', 'gravhub-seo' ) . '</p>';
	}

	/**
	 * Compute stats from analysis results.
	 *
	 * @param array $analysis_results Analysis results array.
	 * @return array Computed stats: total_pages, total_issues, average_score, score_distribution.
	 */
	private function compute_stats( $analysis_results ) {
		$stats = array(
			'total_pages'        => 0,
			'total_issues'       => 0,
			'average_score'      => 0,
			'score_distribution' => array(
				'green'  => 0,
				'yellow' => 0,
				'red'    => 0,
			),
		);

		if ( empty( $analysis_results ) || ! is_array( $analysis_results ) ) {
			return $stats;
		}

		$stats['total_pages'] = count( $analysis_results );
		$total_score          = 0;

		foreach ( $analysis_results as $result ) {
			$score        = isset( $result['score'] ) ? (int) $result['score'] : 0;
			$total_score += $score;

			if ( ! empty( $result['issues'] ) && is_array( $result['issues'] ) ) {
				$stats['total_issues'] += count( $result['issues'] );
			}

			if ( $score >= 80 ) {
				$stats['score_distribution']['green']++;
			} elseif ( $score >= 50 ) {
				$stats['score_distribution']['yellow']++;
			} else {
				$stats['score_distribution']['red']++;
			}
		}

		if ( $stats['total_pages'] > 0 ) {
			$stats['average_score'] = (int) round( $total_score / $stats['total_pages'] );
		}

		return $stats;
	}

	/**
	 * The plugin's full module catalog — the 5 original toggleable modules
	 * plus the features shipped this session that had no card representation
	 * at all. The new ones are purely navigational (link to their real page)
	 * rather than toggleable, since they don't have a natural single on/off
	 * state (e.g. Redirects has per-redirect entries, not a global switch).
	 *
	 * @return array
	 */
	private function get_module_catalog() {
		return array(
			'seo_analysis'    => array(
				'name'    => __( 'SEO Analysis', 'gravhub-seo' ),
				'desc'    => __( 'Analyze pages for SEO best practices.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
				'toggle'  => true,
			),
			'focus_keywords'  => array(
				'name'    => __( 'Focus Keywords', 'gravhub-seo' ),
				'desc'    => __( 'Set target keywords for each page.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
				'toggle'  => true,
			),
			'meta_management' => array(
				'name'    => __( 'Meta Management', 'gravhub-seo' ),
				'desc'    => __( 'Control title tags and meta descriptions.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
				'toggle'  => true,
			),
			'xml_sitemap'     => array(
				'name'    => __( 'XML Sitemap', 'gravhub-seo' ),
				'desc'    => __( 'Auto-generate XML sitemaps.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
				'toggle'  => true,
			),
			'social_previews' => array(
				'name'    => __( 'Social Previews', 'gravhub-seo' ),
				'desc'    => __( 'Open Graph and Twitter Card tags.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
				'toggle'  => true,
			),
			'redirects'       => array(
				'name'    => __( 'Redirections', 'gravhub-seo' ),
				'desc'    => __( 'Create 301/302 redirects for moved or renamed URLs.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a4 4 0 0 1 4 4v2M17 3l-4 4M17 3l4 4"/><path d="M7 21a4 4 0 0 1-4-4v-2M7 21l4-4M7 21l-4-4"/></svg>',
				'toggle'  => false,
				'link'    => admin_url( 'admin.php?page=gravhub-seo-redirects' ),
			),
			'404_monitor'     => array(
				'name'    => __( '404 Monitor', 'gravhub-seo' ),
				'desc'    => __( 'Track broken links and suggest redirect fixes.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
				'toggle'  => false,
				'link'    => admin_url( 'admin.php?page=gravhub-seo-redirects#404-log' ),
			),
			'schema'          => array(
				'name'    => __( 'Schema Markup', 'gravhub-seo' ),
				'desc'    => __( 'Article, Service, and FAQ structured data per page.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>',
				'toggle'  => false,
				'link'    => admin_url( 'edit.php' ),
			),
			'local_seo'       => array(
				'name'    => __( 'Local SEO', 'gravhub-seo' ),
				'desc'    => __( 'Organization and LocalBusiness schema for the homepage.', 'gravhub-seo' ),
				'icon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
				'toggle'  => false,
				'link'    => admin_url( 'admin.php?page=gravhub-seo#gravhub_schema' ),
			),
		);
	}

	/**
	 * Build the notification feed shown on the dashboard — compiled entirely
	 * from data that already exists (analysis issues, cached health-check
	 * results, cheap update signals, redirect/404 counts). No new storage,
	 * and nothing computed here makes a live outbound HTTP request: the
	 * security checks come from the option cached by
	 * GravHub_Health_Reporter::send_report(), not a fresh collect_health_data()
	 * call.
	 *
	 * @param int $total_issues Total issue count from the last analysis.
	 * @return array List of notification items: type, message, link.
	 */
	private function build_notifications( $total_issues ) {
		$notifications = array();

		if ( $total_issues > 0 ) {
			$notifications[] = array(
				'type'    => 'warning',
				'message' => sprintf(
					/* translators: %d: number of issues */
					_n( '%d SEO issue found across analyzed pages.', '%d SEO issues found across analyzed pages.', $total_issues, 'gravhub-seo' ),
					$total_issues
				),
				'link'    => '#gravhub-scores-table',
			);
		}

		$cheap_signals = $this->health_reporter->get_cheap_health_signals();
		if ( ! empty( $cheap_signals['plugins_needing_update'] ) ) {
			$notifications[] = array(
				'type'    => 'info',
				'message' => sprintf(
					/* translators: %d: number of plugins */
					_n( '%d plugin has an available update.', '%d plugins have available updates.', $cheap_signals['plugins_needing_update'], 'gravhub-seo' ),
					$cheap_signals['plugins_needing_update']
				),
				'link'    => admin_url( 'plugins.php' ),
			);
		}
		if ( ! empty( $cheap_signals['theme_needs_update'] ) ) {
			$notifications[] = array(
				'type'    => 'info',
				'message' => __( 'Your active theme has an available update.', 'gravhub-seo' ),
				'link'    => admin_url( 'themes.php' ),
			);
		}

		$last_health = get_option( 'gravhub_last_health_data', array() );
		if ( ! empty( $last_health['security'] ) ) {
			$security = $last_health['security'];
			if ( ! empty( $security['wp_login_exposed'] ) ) {
				$notifications[] = array(
					'type'    => 'warning',
					'message' => __( 'Your login page is publicly reachable at the default URL.', 'gravhub-seo' ),
					'link'    => '',
				);
			}
			if ( ! empty( $security['xmlrpc_enabled'] ) ) {
				$notifications[] = array(
					'type'    => 'warning',
					'message' => __( 'XML-RPC is enabled — a common brute-force target.', 'gravhub-seo' ),
					'link'    => '',
				);
			}
			if ( ! empty( $security['directory_listing_enabled'] ) ) {
				$notifications[] = array(
					'type'    => 'warning',
					'message' => __( 'Directory listing is enabled on your uploads folder.', 'gravhub-seo' ),
					'link'    => '',
				);
			}
		}
		if ( ! empty( $last_health['sitemap'] ) && empty( $last_health['sitemap']['has_sitemap'] ) ) {
			$notifications[] = array(
				'type'    => 'warning',
				'message' => __( 'No XML sitemap could be reached at the last health check.', 'gravhub-seo' ),
				'link'    => '',
			);
		}

		$count_404 = $this->redirect_manager->get_404_count();
		if ( $count_404 > 0 ) {
			$notifications[] = array(
				'type'    => 'info',
				'message' => sprintf(
					/* translators: %d: number of distinct 404 paths */
					_n( '%d page is returning a 404.', '%d pages are returning a 404.', $count_404, 'gravhub-seo' ),
					$count_404
				),
				'link'    => admin_url( 'admin.php?page=gravhub-seo-redirects#404-log' ),
			);
		}

		if ( empty( $notifications ) ) {
			$notifications[] = array(
				'type'    => 'success',
				'message' => __( 'No issues detected. Everything looks healthy.', 'gravhub-seo' ),
				'link'    => '',
			);
		}

		return $notifications;
	}

	/**
	 * Render the admin settings page.
	 */
	public function render_page() {
		if ( ! current_user_can( 'manage_gravhub_seo' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'gravhub-seo' ) );
		}

		// Get data for the template.
		$is_connected       = $this->api_client->is_configured();
		$last_report_time   = get_option( 'gravhub_last_health_report', 0 );
		$last_analysis_time = get_option( 'gravhub_last_analysis_time', 0 );
		$analysis_results   = get_option( 'gravhub_last_analysis', array() );

		// Compute stats.
		$stats              = $this->compute_stats( $analysis_results );
		$total_pages        = $stats['total_pages'];
		$total_issues       = $stats['total_issues'];
		$average_score      = $stats['average_score'];
		$score_distribution = $stats['score_distribution'];

		// Sitemap settings.
		$sitemap_enabled    = (bool) get_option( 'gravhub_sitemap_enabled', true );
		$sitemap_post_types = (array) get_option( 'gravhub_sitemap_post_types', array( 'post', 'page' ) );

		// Module states.
		$default_modules = array(
			'seo_analysis'    => 1,
			'focus_keywords'  => 1,
			'meta_management' => 1,
			'xml_sitemap'     => 1,
			'social_previews' => 0,
		);
		$module_states = wp_parse_args(
			(array) get_option( 'gravhub_module_states', array() ),
			$default_modules
		);

		$modules       = $this->get_module_catalog();
		$notifications = $this->build_notifications( $total_issues );
		$redirect_count = $this->redirect_manager->get_redirect_count();
		$count_404      = $this->redirect_manager->get_404_count();

		include GRAVHUB_SEO_PLUGIN_DIR . 'admin/views/settings-page.php';
	}
}
