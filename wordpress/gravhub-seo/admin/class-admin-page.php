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
