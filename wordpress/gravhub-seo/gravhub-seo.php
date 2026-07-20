<?php
/**
 * Plugin Name: GravHub SEO
 * Description: Enterprise SEO management plugin by Graviss Marketing. Full on-page SEO analysis, focus keywords, XML sitemaps, meta management, and centralized reporting via GravHub.
 * Version: 1.5.2
 * Author: Graviss Marketing
 * Author URI: https://gravissmarketing.com
 * License: Proprietary
 * Text Domain: gravhub-seo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'GRAVHUB_SEO_VERSION', '1.5.2' );
define( 'GRAVHUB_SEO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'GRAVHUB_SEO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'GRAVHUB_SEO_PLUGIN_FILE', __FILE__ );

require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-api-client.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-seo-analyzer.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-meta-manager.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-health-reporter.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-seo-metabox.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-sitemap.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-shortcodes.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-redirect-manager.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-broken-link-scanner.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'includes/class-internal-linking.php';
require_once GRAVHUB_SEO_PLUGIN_DIR . 'admin/class-admin-page.php';

final class GravHub_SEO {

	private static $instance = null;

	public $api_client;
	public $seo_analyzer;
	public $meta_manager;
	public $health_reporter;
	public $seo_metabox;
	public $sitemap;
	public $shortcodes;
	public $redirect_manager;
	public $broken_link_scanner;
	public $internal_linking;
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
		$this->shortcodes      = new GravHub_Shortcodes();
		$this->redirect_manager = new GravHub_Redirect_Manager();
		$this->broken_link_scanner = new GravHub_Broken_Link_Scanner();
		$this->internal_linking = new GravHub_Internal_Linking();

		if ( is_admin() ) {
			$this->admin_page = new GravHub_Admin_Page( $this->api_client, $this->seo_analyzer, $this->health_reporter, $this->redirect_manager, $this->broken_link_scanner );
		}

		$this->init_hooks();
	}

	private function init_hooks() {
		add_action( 'wp_head', array( $this->meta_manager, 'output_meta_tags' ), 1 );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_action( 'gravhub_daily_report', array( $this->health_reporter, 'send_report' ) );
		add_action( 'admin_init', array( $this, 'self_heal_activation' ) );
		add_filter( 'map_meta_cap', array( $this, 'allow_site_admins_to_manage' ), 10, 4 );
		add_filter( 'cron_schedules', array( $this, 'register_weekly_cron_schedule' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval
	}

	/**
	 * WordPress core only ships hourly/twicedaily/daily — the broken-link
	 * scanner runs weekly (external links don't change often enough to
	 * justify daily crawling every site's outbound links).
	 */
	public function register_weekly_cron_schedule( $schedules ) {
		if ( ! isset( $schedules['weekly'] ) ) {
			$schedules['weekly'] = array(
				'interval' => 7 * DAY_IN_SECONDS,
				'display'  => __( 'Once Weekly', 'gravhub-seo' ),
			);
		}
		return $schedules;
	}

	/**
	 * self_heal_activation() only grants manage_gravhub_seo to a role
	 * literally named 'administrator' — on installs where that's not how
	 * the logged-in admin's role is set up (multisite, a role-editor
	 * plugin, a renamed/custom admin role), the grant misses them even
	 * though they're unambiguously a site admin, and every capability
	 * check in the plugin (including WordPress core's own menu-access
	 * check on add_menu_page/add_submenu_page — the source of the generic
	 * "Sorry, you are not allowed to access this page" screen) then locks
	 * them out. Returning an empty array from map_meta_cap is the standard
	 * WordPress idiom for "grant unconditionally" — this makes
	 * manage_options (WP's built-in "is a site admin" capability) always
	 * sufficient, on top of manage_gravhub_seo if a user happens to have
	 * that directly.
	 */
	public function allow_site_admins_to_manage( $caps, $cap, $user_id, $args ) {
		if ( 'manage_gravhub_seo' === $cap && user_can( $user_id, 'manage_options' ) ) {
			return array();
		}
		return $caps;
	}

	/**
	 * Re-applies everything the activation hook normally sets up: the
	 * manage_gravhub_seo capability and the daily report cron schedule.
	 *
	 * register_activation_hook() only fires on a true WordPress
	 * activate/deactivate cycle — it does NOT run when the plugin files are
	 * simply overwritten in place (e.g. uploading a new zip directly via
	 * FTP/SFTP, or replacing files without deactivating first). When that
	 * happens the capability is never granted and the cron never scheduled,
	 * which silently breaks every "Test Connection" / "Run Analysis" /
	 * "Send Health Report" button (permission_callback checks the missing
	 * capability) and the automatic daily health report (never scheduled).
	 * Running this idempotently on every admin page load makes the plugin
	 * self-heal the next time any administrator visits wp-admin, regardless
	 * of how it was installed.
	 */
	public function self_heal_activation() {
		$role = get_role( 'administrator' );
		if ( $role && ! $role->has_cap( 'manage_gravhub_seo' ) ) {
			$role->add_cap( 'manage_gravhub_seo' );
		}

		if ( ! wp_next_scheduled( 'gravhub_daily_report' ) ) {
			wp_schedule_event( time(), 'daily', 'gravhub_daily_report' );
		}

		if ( ! wp_next_scheduled( 'gravhub_broken_link_scan' ) ) {
			wp_schedule_event( time(), 'weekly', 'gravhub_broken_link_scan' );
		}

		// dbDelta() is safe to re-run idempotently, but it's not cheap —
		// only run it when the installed table version doesn't match this
		// plugin build, not on every single admin page load.
		if ( get_option( 'gravhub_redirect_tables_version' ) !== GRAVHUB_SEO_VERSION ) {
			GravHub_Redirect_Manager::create_tables();
			update_option( 'gravhub_redirect_tables_version', GRAVHUB_SEO_VERSION );
		}

		if ( get_option( 'gravhub_broken_link_tables_version' ) !== GRAVHUB_SEO_VERSION ) {
			GravHub_Broken_Link_Scanner::create_tables();
			update_option( 'gravhub_broken_link_tables_version', GRAVHUB_SEO_VERSION );
		}
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
			'/live-readability',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_live_readability' ),
				'permission_callback' => function () {
					// Anyone who can edit posts gets live feedback while
					// writing — this is stateless text analysis on whatever
					// content the request sends, not gated behind
					// manage_gravhub_seo like the SEO-config routes.
					return current_user_can( 'edit_posts' );
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

		register_rest_route(
			'gravhub-seo/v1',
			'/dashboard-analytics',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_dashboard_analytics' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_gravhub_seo' );
				},
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/dashboard-keywords',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_dashboard_keywords' ),
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
		update_option( 'gravhub_last_analysis_time', time() );

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

	/**
	 * Live readability scoring for the metabox's Readability tab — runs
	 * GravHub_SEO_Analyzer's same checks used at save-time, but against
	 * whatever content the editor currently has (including unsaved
	 * changes) instead of the last-saved post_content.
	 */
	public function rest_live_readability( $request ) {
		$content = (string) $request->get_param( 'content' );
		$checks  = $this->seo_analyzer->analyze_readability_content( $content );

		$flesch_score = 0;
		foreach ( $checks as $check ) {
			if ( 'flesch_reading_ease' === $check['type'] && isset( $check['value'] ) ) {
				$flesch_score = $check['value'];
			}
		}

		return new WP_REST_Response(
			array(
				'score'  => $flesch_score,
				'checks' => $checks,
			),
			200
		);
	}

	public function rest_run_analysis( $request ) {
		$results = $this->seo_analyzer->analyze_all_pages();

		$send_result = $this->api_client->send_scores( $results );

		update_option( 'gravhub_last_analysis', $results );
		update_option( 'gravhub_last_analysis_time', time() );

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

	/**
	 * Proxy for the dashboard's Site Analytics section — fetched client-side
	 * (JS) rather than server-side in render_page(), since
	 * get_dashboard_analytics() makes a cross-origin call to the GravHub app
	 * that can take up to REQUEST_TIMEOUT seconds on a cache miss.
	 */
	public function rest_dashboard_analytics( $request ) {
		$force   = 'true' === $request->get_param( 'force' );
		$payload = $this->api_client->get_dashboard_analytics( $force );

		if ( is_wp_error( $payload ) ) {
			return new WP_REST_Response( array( 'error' => $payload->get_error_message() ), 200 );
		}

		return new WP_REST_Response( $payload, 200 );
	}

	/**
	 * Proxy for the dashboard's Keywords section — same async-fetch reasoning
	 * as rest_dashboard_analytics() above.
	 */
	public function rest_dashboard_keywords( $request ) {
		$force   = 'true' === $request->get_param( 'force' );
		$payload = $this->api_client->get_dashboard_keywords( $force );

		if ( is_wp_error( $payload ) ) {
			return new WP_REST_Response( array( 'error' => $payload->get_error_message() ), 200 );
		}

		return new WP_REST_Response( $payload, 200 );
	}

	public static function activate() {
		$admin_role = get_role( 'administrator' );
		if ( $admin_role ) {
			$admin_role->add_cap( 'manage_gravhub_seo' );
		}

		if ( ! wp_next_scheduled( 'gravhub_daily_report' ) ) {
			wp_schedule_event( time(), 'daily', 'gravhub_daily_report' );
		}

		// The weekly broken-link scan is deliberately NOT scheduled here —
		// register_activation_hook() fires before this same request's
		// plugins_loaded/init_hooks() has registered the custom 'weekly'
		// cron_schedules entry, so wp_schedule_event() with 'weekly' at
		// this exact point wouldn't reliably resolve to a real interval.
		// self_heal_activation() (admin_init, which always runs after
		// init_hooks() within the same request) schedules it instead —
		// including on the very next page load right after activation.

		GravHub_Redirect_Manager::create_tables();
		update_option( 'gravhub_redirect_tables_version', GRAVHUB_SEO_VERSION );

		GravHub_Broken_Link_Scanner::create_tables();
		update_option( 'gravhub_broken_link_tables_version', GRAVHUB_SEO_VERSION );

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

		$link_scan_timestamp = wp_next_scheduled( 'gravhub_broken_link_scan' );
		if ( $link_scan_timestamp ) {
			wp_unschedule_event( $link_scan_timestamp, 'gravhub_broken_link_scan' );
		}
	}
}

register_activation_hook( GRAVHUB_SEO_PLUGIN_FILE, array( 'GravHub_SEO', 'activate' ) );
register_deactivation_hook( GRAVHUB_SEO_PLUGIN_FILE, array( 'GravHub_SEO', 'deactivate' ) );

function gravhub_seo() {
	return GravHub_SEO::get_instance();
}

add_action( 'plugins_loaded', 'gravhub_seo' );
