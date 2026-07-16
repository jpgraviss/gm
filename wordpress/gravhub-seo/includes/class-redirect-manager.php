<?php
/**
 * GravHub Redirect Manager.
 *
 * URL redirects (with hit tracking) and a 404 monitor, similar to
 * Redirection / RankMath's redirect module. Self-contained: registers its
 * own DB tables, template_redirect hooks, REST routes, and admin submenu
 * page rather than threading through the existing settings-page.php.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GravHub_Redirect_Manager {

	/**
	 * Max candidate posts/pages scanned for fuzzy redirect suggestions.
	 * Keeps an on-demand suggestion request fast even on a large site,
	 * at the cost of only considering the most recently modified content.
	 *
	 * @var int
	 */
	const SUGGESTION_CANDIDATE_LIMIT = 300;

	public function __construct() {
		add_action( 'template_redirect', array( $this, 'maybe_redirect' ), 1 );
		add_action( 'template_redirect', array( $this, 'maybe_log_404' ), 20 );
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	/**
	 * Create (or update, via dbDelta's diff-based migration) both tables.
	 * Safe to call on every admin page load — matches the self-heal
	 * pattern already used for the plugin's capability/cron setup, since
	 * register_activation_hook() doesn't fire on an in-place file overwrite.
	 */
	public static function create_tables() {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();

		$redirects_table = $wpdb->prefix . 'gravhub_redirects';
		$log_table        = $wpdb->prefix . 'gravhub_404_log';

		$sql = "CREATE TABLE {$redirects_table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			from_path VARCHAR(255) NOT NULL,
			to_path VARCHAR(500) NOT NULL,
			redirect_type SMALLINT NOT NULL DEFAULT 301,
			hit_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY from_path (from_path)
		) {$charset_collate};

		CREATE TABLE {$log_table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			path VARCHAR(255) NOT NULL,
			hit_count BIGINT UNSIGNED NOT NULL DEFAULT 1,
			referrer VARCHAR(500) DEFAULT NULL,
			first_seen DATETIME NOT NULL,
			last_seen DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY path (path)
		) {$charset_collate};";

		dbDelta( $sql );
	}

	private function redirects_table() {
		global $wpdb;
		return $wpdb->prefix . 'gravhub_redirects';
	}

	private function log_table() {
		global $wpdb;
		return $wpdb->prefix . 'gravhub_404_log';
	}

	/**
	 * Normalize the current request into a bare path ("/foo/bar", no query
	 * string, no trailing slash except for the homepage itself).
	 */
	private function get_current_path() {
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		if ( empty( $uri ) ) {
			return '';
		}
		$path = wp_parse_url( $uri, PHP_URL_PATH );
		if ( empty( $path ) ) {
			return '';
		}
		$trimmed = trim( $path, '/' );
		return '' === $trimmed ? '/' : '/' . $trimmed;
	}

	/**
	 * If the current request path matches a configured redirect, send it
	 * and stop. Runs before WordPress has fully resolved the request, so
	 * this fires regardless of whether the path would otherwise 404 or hit
	 * a real page — a redirect always wins.
	 */
	public function maybe_redirect() {
		if ( is_admin() ) {
			return;
		}

		$path = $this->get_current_path();
		if ( empty( $path ) ) {
			return;
		}

		global $wpdb;
		$table    = $this->redirects_table();
		$redirect = $wpdb->get_row( $wpdb->prepare( "SELECT to_path, redirect_type FROM {$table} WHERE from_path = %s", $path ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		if ( ! $redirect ) {
			return;
		}

		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET hit_count = hit_count + 1 WHERE from_path = %s", $path ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		$destination = $redirect->to_path;
		if ( ! preg_match( '#^https?://#i', $destination ) ) {
			$destination = home_url( $destination );
		}

		wp_redirect( $destination, (int) $redirect->redirect_type ); // phpcs:ignore WordPress.Security.SafeRedirect
		exit;
	}

	/**
	 * Log the current request path if (and only if) WordPress has already
	 * determined this is a real 404 — runs late on template_redirect so
	 * maybe_redirect() above has already had a chance to intercept it.
	 */
	public function maybe_log_404() {
		if ( is_admin() || ! is_404() ) {
			return;
		}

		$path = $this->get_current_path();
		if ( empty( $path ) ) {
			return;
		}

		global $wpdb;
		$table    = $this->log_table();
		$now      = current_time( 'mysql' );
		$referrer = isset( $_SERVER['HTTP_REFERER'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ) : '';

		$existing_id = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE path = %s", $path ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		if ( $existing_id ) {
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET hit_count = hit_count + 1, last_seen = %s WHERE id = %d", $now, $existing_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		} else {
			$wpdb->insert(
				$table,
				array(
					'path'       => $path,
					'hit_count'  => 1,
					'referrer'   => $referrer,
					'first_seen' => $now,
					'last_seen'  => $now,
				),
				array( '%s', '%d', '%s', '%s', '%s' )
			);
		}
	}

	/**
	 * Register the "Redirects" submenu page under the main GravHub SEO menu.
	 */
	public function register_menu() {
		add_submenu_page(
			'gravhub-seo',
			__( 'Redirects', 'gravhub-seo' ),
			__( 'Redirects', 'gravhub-seo' ),
			'manage_gravhub_seo',
			'gravhub-seo-redirects',
			array( $this, 'render_page' )
		);
	}

	public function render_page() {
		if ( ! current_user_can( 'manage_gravhub_seo' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'gravhub-seo' ) );
		}
		include GRAVHUB_SEO_PLUGIN_DIR . 'admin/views/redirects-page.php';
	}

	/**
	 * REST routes. All gated on manage_gravhub_seo — same capability
	 * check every other admin-facing GravHub route already uses.
	 */
	public function register_rest_routes() {
		$auth = function () {
			return current_user_can( 'manage_gravhub_seo' );
		};

		register_rest_route(
			'gravhub-seo/v1',
			'/redirects',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'rest_list_redirects' ),
					'permission_callback' => $auth,
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'rest_create_redirect' ),
					'permission_callback' => $auth,
				),
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/redirects/(?P<id>\d+)',
			array(
				'methods'             => 'DELETE',
				'callback'            => array( $this, 'rest_delete_redirect' ),
				'permission_callback' => $auth,
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/404-log',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'rest_list_404_log' ),
					'permission_callback' => $auth,
				),
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/404-log/(?P<id>\d+)',
			array(
				'methods'             => 'DELETE',
				'callback'            => array( $this, 'rest_delete_404_entry' ),
				'permission_callback' => $auth,
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/404-log/(?P<id>\d+)/suggestions',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_get_suggestions' ),
				'permission_callback' => $auth,
			)
		);
	}

	public function rest_list_redirects( $request ) {
		global $wpdb;
		$table = $this->redirects_table();
		$rows  = $wpdb->get_results( "SELECT id, from_path, to_path, redirect_type, hit_count, created_at FROM {$table} ORDER BY created_at DESC" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		return new WP_REST_Response( $rows, 200 );
	}

	public function rest_create_redirect( $request ) {
		$from_path = $this->sanitize_path( $request->get_param( 'from_path' ) );
		$to_path   = trim( (string) $request->get_param( 'to_path' ) );
		$type      = (int) $request->get_param( 'redirect_type' );
		$type      = in_array( $type, array( 301, 302 ), true ) ? $type : 301;

		if ( empty( $from_path ) || empty( $to_path ) ) {
			return new WP_REST_Response( array( 'error' => __( 'From and To are both required.', 'gravhub-seo' ) ), 400 );
		}

		// Accept either a full URL or a site-relative path for the
		// destination; only validate/normalize the "from" side, which must
		// always be a path on THIS site (that's what template_redirect
		// matches incoming requests against).
		if ( ! preg_match( '#^https?://#i', $to_path ) ) {
			$to_path = '/' . ltrim( $to_path, '/' );
		}

		global $wpdb;
		$table = $this->redirects_table();
		$now   = current_time( 'mysql' );

		$result = $wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (from_path, to_path, redirect_type, hit_count, created_at, updated_at) VALUES (%s, %s, %d, 0, %s, %s)
				 ON DUPLICATE KEY UPDATE to_path = VALUES(to_path), redirect_type = VALUES(redirect_type), updated_at = VALUES(updated_at)", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$from_path,
				$to_path,
				$type,
				$now,
				$now
			)
		);

		if ( false === $result ) {
			return new WP_REST_Response( array( 'error' => __( 'Failed to save redirect.', 'gravhub-seo' ) ), 500 );
		}

		return new WP_REST_Response( array( 'success' => true ), 201 );
	}

	public function rest_delete_redirect( $request ) {
		global $wpdb;
		$table = $this->redirects_table();
		$wpdb->delete( $table, array( 'id' => (int) $request['id'] ), array( '%d' ) );
		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	public function rest_list_404_log( $request ) {
		global $wpdb;
		$table = $this->log_table();
		$rows  = $wpdb->get_results( "SELECT id, path, hit_count, referrer, first_seen, last_seen FROM {$table} ORDER BY last_seen DESC LIMIT 200" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		return new WP_REST_Response( $rows, 200 );
	}

	public function rest_delete_404_entry( $request ) {
		global $wpdb;
		$table = $this->log_table();
		$wpdb->delete( $table, array( 'id' => (int) $request['id'] ), array( '%d' ) );
		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * Fuzzy-match suggestions for a 404 entry: the nearest existing
	 * published post/page permalinks by slug similarity, so dead-link
	 * cleanup doesn't mean guessing the right destination by hand.
	 */
	public function rest_get_suggestions( $request ) {
		global $wpdb;
		$table = $this->log_table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT path FROM {$table} WHERE id = %d", (int) $request['id'] ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		if ( ! $row ) {
			return new WP_REST_Response( array( 'error' => __( 'Not found.', 'gravhub-seo' ) ), 404 );
		}

		$segments = explode( '/', trim( $row->path, '/' ) );
		$last     = end( $segments );
		$target   = strtolower( trim( preg_replace( '/[-_]+/', ' ', $last ) ) );

		if ( empty( $target ) ) {
			return new WP_REST_Response( array(), 200 );
		}

		$candidates = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => self::SUGGESTION_CANDIDATE_LIMIT,
				'orderby'        => 'modified',
				'order'          => 'DESC',
				'no_found_rows'  => true,
			)
		);

		$scored = array();
		foreach ( $candidates as $candidate ) {
			$slug = strtolower( trim( preg_replace( '/[-_]+/', ' ', $candidate->post_name ) ) );
			if ( empty( $slug ) ) {
				continue;
			}
			similar_text( $target, $slug, $percent );
			$scored[] = array(
				'url'   => get_permalink( $candidate ),
				'title' => get_the_title( $candidate ),
				'score' => round( $percent, 1 ),
			);
		}

		usort(
			$scored,
			function ( $a, $b ) {
				return $b['score'] <=> $a['score'];
			}
		);

		return new WP_REST_Response( array_slice( $scored, 0, 5 ), 200 );
	}

	private function sanitize_path( $path ) {
		$path = trim( (string) $path );
		if ( empty( $path ) ) {
			return '';
		}
		// A "from" path is always local — strip any scheme/host a user
		// might have pasted in by mistake, keep only the path itself.
		$parsed = wp_parse_url( $path );
		$only_path = isset( $parsed['path'] ) ? $parsed['path'] : $path;
		$trimmed = trim( $only_path, '/' );
		return '' === $trimmed ? '/' : '/' . $trimmed;
	}
}
