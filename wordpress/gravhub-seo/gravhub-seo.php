<?php
/**
 * Plugin Name: GravHub SEO
 * Description: Internal SEO management plugin for Graviss Marketing. Connects WordPress sites to GravHub for centralized SEO management.
 * Version: 1.0.0
 * Author: Graviss Marketing
 * Author URI: https://gravissmarketing.com
 * License: Proprietary
 * Text Domain: gravhub-seo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GRAVHUB_SEO_VERSION', '1.0.0' );
define( 'GRAVHUB_SEO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'GRAVHUB_SEO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'GRAVHUB_SEO_PLUGIN_FILE', __FILE__ );

/**
 * Load plugin includes.
 */
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-api-client.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-seo-analyzer.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-meta-manager.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-health-reporter.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'admin/class-admin-page.php';

/**
 * Main plugin class.
 */
final class GravHub_SEO {

	/**
	 * Singleton instance.
	 *
	 * @var GravHub_SEO|null
	 */
	private static $instance = null;

	/**
	 * API client instance.
	 *
	 * @var GravHub_API_Client
	 */
	public $api_client;

	/**
	 * SEO analyzer instance.
	 *
	 * @var GravHub_SEO_Analyzer
	 */
	public $seo_analyzer;

	/**
	 * Meta manager instance.
	 *
	 * @var GravHub_Meta_Manager
	 */
	public $meta_manager;

	/**
	 * Health reporter instance.
	 *
	 * @var GravHub_Health_Reporter
	 */
	public $health_reporter;

	/**
	 * Admin page instance.
	 *
	 * @var GravHub_Admin_Page
	 */
	public $admin_page;

	/**
	 * Get singleton instance.
	 *
	 * @return GravHub_SEO
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		$this->api_client      = new GravHub_API_Client();
		$this->seo_analyzer    = new GravHub_SEO_Analyzer();
		$this->meta_manager    = new GravHub_Meta_Manager( $this->api_client );
		$this->health_reporter = new GravHub_Health_Reporter( $this->api_client );

		if ( is_admin() ) {
			$this->admin_page = new GravHub_Admin_Page( $this->api_client, $this->seo_analyzer );
		}

		$this->init_hooks();
	}

	/**
	 * Initialize hooks.
	 */
	private function init_hooks() {
		// Output managed meta tags in wp_head.
		add_action( 'wp_head', array( $this->meta_manager, 'output_meta_tags' ), 1 );

		// Register REST API endpoints.
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );

		// Hook daily health report to cron event.
		add_action( 'gravhub_daily_report', array( $this->health_reporter, 'send_report' ) );
	}

	/**
	 * Register REST API routes for admin AJAX calls.
	 */
	public function register_rest_routes() {
		register_rest_route(
			'gravhub-seo/v1',
			'/test-connection',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_test_connection' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_gravhub_seo' );
				},
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/run-analysis',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_run_analysis' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_gravhub_seo' );
				},
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/send-report',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_send_report' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_gravhub_seo' );
				},
			)
		);
	}

	/**
	 * REST callback: test API connection.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function rest_test_connection( $request ) {
		$settings = $this->api_client->get_seo_settings();

		if ( is_wp_error( $settings ) ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => $settings->get_error_message(),
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => __( 'Connection successful.', 'gravhub-seo' ),
			),
			200
		);
	}

	/**
	 * REST callback: run SEO analysis.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function rest_run_analysis( $request ) {
		$results = $this->seo_analyzer->analyze_all_pages();

		// Send scores to GravHub.
		$send_result = $this->api_client->send_scores( $results );

		// Store results locally.
		update_option( 'gravhub_last_analysis', $results );
		update_option( 'gravhub_last_analysis_time', current_time( 'timestamp' ) );

		return new WP_REST_Response(
			array(
				'success' => true,
				'results' => $results,
				'sent'    => ! is_wp_error( $send_result ),
			),
			200
		);
	}

	/**
	 * REST callback: send health report.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response
	 */
	public function rest_send_report( $request ) {
		$result = $this->health_reporter->send_report();

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => $result->get_error_message(),
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => __( 'Health report sent.', 'gravhub-seo' ),
			),
			200
		);
	}

	/**
	 * Plugin activation.
	 */
	public static function activate() {
		// Add capability to administrator role.
		$admin_role = get_role( 'administrator' );
		if ( $admin_role ) {
			$admin_role->add_cap( 'manage_gravhub_seo' );
		}

		// Schedule daily health report cron.
		if ( ! wp_next_scheduled( 'gravhub_daily_report' ) ) {
			wp_schedule_event( time(), 'daily', 'gravhub_daily_report' );
		}
	}

	/**
	 * Plugin deactivation.
	 */
	public static function deactivate() {
		// Remove capability from administrator role.
		$admin_role = get_role( 'administrator' );
		if ( $admin_role ) {
			$admin_role->remove_cap( 'manage_gravhub_seo' );
		}

		// Clear scheduled cron event.
		$timestamp = wp_next_scheduled( 'gravhub_daily_report' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'gravhub_daily_report' );
		}
	}
}

// Activation and deactivation hooks.
register_activation_hook( GRAVHUB_SEO_PLUGIN_FILE, array( 'GravHub_SEO', 'activate' ) );
register_deactivation_hook( GRAVHUB_SEO_PLUGIN_FILE, array( 'GravHub_SEO', 'deactivate' ) );

/**
 * Initialize the plugin.
 *
 * @return GravHub_SEO
 */
function gravhub_seo() {
	return GravHub_SEO::get_instance();
}

// Boot the plugin.
add_action( 'plugins_loaded', 'gravhub_seo' );
