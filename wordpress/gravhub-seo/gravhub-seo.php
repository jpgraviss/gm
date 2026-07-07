<?php
/**
 * Plugin Name: GravHub SEO
 * Description: Enterprise SEO management plugin by Graviss Marketing. Full on-page SEO analysis, focus keywords, XML sitemaps, meta management, and centralized reporting via GravHub.
 * Version: 1.2.0
 * Author: Graviss Marketing
 * Author URI: https://gravissmarketing.com
 * License: Proprietary
 * Text Domain: gravhub-seo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GRAVHUB_SEO_VERSION', '1.2.0' );
define( 'GRAVHUB_SEO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'GRAVHUB_SEO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'GRAVHUB_SEO_PLUGIN_FILE', __FILE__ );

require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-api-client.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-seo-analyzer.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-meta-manager.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-health-reporter.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-seo-metabox.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-sitemap.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'admin/class-admin-page.php';

final class GravHub_SEO {

	private static $instance = null;

	public $api_client;
	public $seo_analyzer;
	public $meta_manager;
	public $health_reporter;
	public $seo_metabox;
	public $sitemap;
	public $admin_page;

	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		$this->api_client      = new GravHub_API_Client();
		$this->seo_analyzer    = new GravHub_SEO_Analyzer();
		$this->meta_manager    = new GravHub_Meta_Manager( $this->api_client );
		$this->health_reporter = new GravHub_Health_Reporter( $this->api_client );
		$this->seo_metabox     = new GravHub_SEO_Metabox( $this->seo_analyzer );
		$this->sitemap         = new GravHub_Sitemap();

		if ( is_admin() ) {
			$this->admin_page = new GravHub_Admin_Page( $this->api_client, $this->seo_analyzer );
		}

		$this->init_hooks();
	}

	private function init_hooks() {
		add_action( 'wp_head', array( $this->meta_manager, 'output_meta_tags' ), 1 );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_action( 'gravhub_daily_report', array( $this->health_reporter, 'send_report' ) );
	}

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

		register_rest_route(
			'gravhub-seo/v1',
			'/heartbeat',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_heartbeat' ),
				'permission_callback' => array( $this, 'verify_gravhub_key' ),
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/remote-sync',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_remote_sync' ),
				'permission_callback' => array( $this, 'verify_gravhub_key' ),
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/save-option',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_save_option' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_gravhub_seo' );
				},
			)
		);
	}

	public function verify_gravhub_key( $request ) {
		$key = $request->get_header( 'X-GravHub-Key' );
		if ( empty( $key ) ) {
			return false;
		}
		$stored_key = $this->api_client->get_api_key();
		return ! empty( $stored_key ) && hash_equals( $stored_key, $key );
	}

	public function rest_heartbeat( $request ) {
		$last_analysis = get_option( 'gravhub_last_analysis_time', 0 );
		$last_report   = get_option( 'gravhub_last_health_report', 0 );

		return new WP_REST_Response(
			array(
				'status'          => 'connected',
				'plugin_version'  => GRAVHUB_SEO_VERSION,
				'wp_version'      => get_bloginfo( 'version' ),
				'php_version'     => phpversion(),
				'site_name'       => get_bloginfo( 'name' ),
				'site_url'        => get_site_url(),
				'last_analysis'   => $last_analysis ? gmdate( 'c', $last_analysis ) : null,
				'last_report'     => $last_report ? gmdate( 'c', $last_report ) : null,
				'page_count'      => wp_count_posts( 'page' )->publish ?? 0,
				'post_count'      => wp_count_posts( 'post' )->publish ?? 0,
			),
			200
		);
	}

	public function rest_remote_sync( $request ) {
		$analysis = $this->seo_analyzer->analyze_all_pages();
		$this->api_client->send_scores( $analysis );
		update_option( 'gravhub_last_analysis', $analysis );
		update_option( 'gravhub_last_analysis_time', current_time( 'timestamp' ) );

		$health = $this->health_reporter->send_report();

		return new WP_REST_Response(
			array(
				'success'        => true,
				'pages_analyzed' => count( $analysis ),
				'health_sent'    => ! is_wp_error( $health ),
				'synced_at'      => current_time( 'c' ),
			),
			200
		);
	}

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

	public function rest_run_analysis( $request ) {
		$results = $this->seo_analyzer->analyze_all_pages();

		$send_result = $this->api_client->send_scores( $results );

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

	public function rest_save_option( $request ) {
		$allowed = array( 'gravhub_sitemap_enabled', 'gravhub_sitemap_post_types', 'gravhub_module_states' );
		$option  = $request->get_param( 'option' );
		$value   = $request->get_param( 'value' );

		if ( ! in_array( $option, $allowed, true ) ) {
			return new WP_REST_Response( array( 'success' => false, 'message' => 'Invalid option.' ), 400 );
		}

		update_option( $option, $value );

		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	public static function activate() {
		$admin_role = get_role( 'administrator' );
		if ( $admin_role ) {
			$admin_role->add_cap( 'manage_gravhub_seo' );
		}

		if ( ! wp_next_scheduled( 'gravhub_daily_report' ) ) {
			wp_schedule_event( time(), 'daily', 'gravhub_daily_report' );
		}

		GravHub_Sitemap::flush_rules();
	}

	public static function deactivate() {
		$admin_role = get_role( 'administrator' );
		if ( $admin_role ) {
			$admin_role->remove_cap( 'manage_gravhub_seo' );
		}

		$timestamp = wp_next_scheduled( 'gravhub_daily_report' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'gravhub_daily_report' );
		}
	}
}

register_activation_hook( GRAVHUB_SEO_PLUGIN_FILE, array( 'GravHub_SEO', 'activate' ) );
register_deactivation_hook( GRAVHUB_SEO_PLUGIN_FILE, array( 'GravHub_SEO', 'deactivate' ) );

function gravhub_seo() {
	return GravHub_SEO::get_instance();
}

add_action( 'plugins_loaded', 'gravhub_seo' );
