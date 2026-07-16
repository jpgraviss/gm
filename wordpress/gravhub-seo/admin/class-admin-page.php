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
	 * Constructor.
	 *
	 * @param GravHub_API_Client   $api_client   API client instance.
	 * @param GravHub_SEO_Analyzer $seo_analyzer SEO analyzer instance.
	 */
	public function __construct( GravHub_API_Client $api_client, GravHub_SEO_Analyzer $seo_analyzer ) {
		$this->api_client   = $api_client;
		$this->seo_analyzer = $seo_analyzer;

		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Register admin menu.
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
		if ( 'toplevel_page_gravhub-seo' !== $hook_suffix ) {
			return;
		}

		wp_enqueue_style(
			'gravhub-seo-admin',
			GRAVHUB_SEO_PLUGIN_URL . 'assets/admin.css',
			array(),
			GRAVHUB_SEO_VERSION
		);

		// JS is inlined in the settings-page.php template.
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

		include GRAVHUB_SEO_PLUGIN_DIR . 'admin/views/settings-page.php';
	}
}
