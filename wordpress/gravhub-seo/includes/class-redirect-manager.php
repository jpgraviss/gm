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

	/**
	 * Max rows read from an uploaded CSV import. AUDIT.md #192 — protects
	 * against an oversized file turning one admin-post.php request into an
	 * unbounded number of DB round trips.
	 *
	 * @var int
	 */
	const MAX_IMPORT_ROWS = 5000;

	public function __construct() {
		add_action( 'template_redirect', array( $this, 'maybe_redirect' ), 1 );
		add_action( 'template_redirect', array( $this, 'maybe_log_404' ), 20 );
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		// admin-post.php, not REST — WP_REST_Server JSON-serializes every
		// response by default, which fights a plain CSV file download.
		// This is the standard WordPress pattern for admin-triggered
		// downloads/uploads instead.
		add_action( 'admin_post_gravhub_export_redirects', array( $this, 'handle_export_redirects' ) );
		add_action( 'admin_post_gravhub_import_redirects', array( $this, 'handle_import_redirects' ) );
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
	 * Count of configured redirects — used by the dashboard notification
	 * feed and module grid. A plain COUNT, cheap enough to call on every
	 * dashboard page load (unlike anything in class-health-reporter.php's
	 * security checks, which make live HTTP requests).
	 *
	 * @return int
	 */
	public function get_redirect_count() {
		global $wpdb;
		$table = $this->redirects_table();
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	/**
	 * Count of distinct logged 404 paths — used by the dashboard
	 * notification feed and module grid.
	 *
	 * @return int
	 */
	public function get_404_count() {
		global $wpdb;
		$table = $this->log_table();
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
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
		// destination; from_path is already normalized by sanitize_path()
		// above, and must always be a local path (that's what
		// maybe_redirect() matches incoming requests against).
		if ( ! preg_match( '#^https?://#i', $to_path ) ) {
			$to_path = '/' . ltrim( $to_path, '/' );
		}

		if ( false === $this->upsert_redirect( $from_path, $to_path, $type ) ) {
			return new WP_REST_Response( array( 'error' => __( 'Failed to save redirect.', 'gravhub-seo' ) ), 500 );
		}

		return new WP_REST_Response( array( 'success' => true ), 201 );
	}

	/**
	 * Insert a redirect, or update it in place if from_path (the table's
	 * unique key) already exists. Shared by the single-redirect REST route
	 * and CSV import, so re-importing an already-imported file is
	 * idempotent rather than erroring on duplicates.
	 *
	 * Callers are responsible for sanitizing from_path (sanitize_path()) and
	 * normalizing to_path (a bare local path gets a leading slash; a full
	 * URL is passed through as-is) before calling this.
	 *
	 * @return int|false Number of affected rows, or false on failure (same
	 *                    contract as $wpdb->query()).
	 */
	private function upsert_redirect( $from_path, $to_path, $type ) {
		global $wpdb;
		$table = $this->redirects_table();
		$now   = current_time( 'mysql' );

		return $wpdb->query(
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

	/**
	 * Streams all configured redirects as a downloadable CSV.
	 */
	public function handle_export_redirects() {
		if ( ! current_user_can( 'manage_gravhub_seo' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'gravhub-seo' ) );
		}
		check_admin_referer( 'gravhub_export_redirects' );

		global $wpdb;
		$table = $this->redirects_table();
		$rows  = $wpdb->get_results( "SELECT from_path, to_path, redirect_type FROM {$table} ORDER BY from_path ASC" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="gravhub-redirects-' . gmdate( 'Y-m-d' ) . '.csv"' );

		$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_fopen
		fputcsv( $out, array( 'from_path', 'to_path', 'redirect_type' ) );
		foreach ( $rows as $row ) {
			fputcsv(
				$out,
				array(
					$this->csv_safe( $row->from_path ),
					$this->csv_safe( $row->to_path ),
					$row->redirect_type,
				)
			);
		}
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_fclose
		exit;
	}

	/**
	 * Bulk-creates/updates redirects from an uploaded CSV
	 * (from_path,to_path,redirect_type, with or without a header row).
	 * Uses the same upsert_redirect() insert-or-update-on-from_path
	 * semantics as the single-redirect REST route, so re-importing an
	 * already-imported file is idempotent rather than erroring on
	 * duplicates.
	 */
	public function handle_import_redirects() {
		if ( ! current_user_can( 'manage_gravhub_seo' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'gravhub-seo' ) );
		}
		check_admin_referer( 'gravhub_import_redirects' );

		$redirect_url = admin_url( 'admin.php?page=gravhub-seo-redirects' );

		if ( empty( $_FILES['csv_file']['tmp_name'] ) || ! is_uploaded_file( $_FILES['csv_file']['tmp_name'] ) ) {
			wp_safe_redirect( add_query_arg( 'gravhub_import', 'error', $redirect_url ) );
			exit;
		}

		$handle = fopen( $_FILES['csv_file']['tmp_name'], 'r' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_fopen
		if ( ! $handle ) {
			wp_safe_redirect( add_query_arg( 'gravhub_import', 'error', $redirect_url ) );
			exit;
		}

		$imported = 0;
		$skipped  = 0;
		$row_num  = 0;
		$capped   = false;

		while ( ( $data = fgetcsv( $handle ) ) !== false ) {
			$row_num++;

			// AUDIT.md #192 — an unbounded loop here meant an oversized
			// upload (accidental or otherwise) could tie up the request for
			// as many rows as the file contained, each one a DB round trip
			// via upsert_redirect(). Stop reading past the cap rather than
			// processing the whole file.
			if ( $row_num > self::MAX_IMPORT_ROWS ) {
				$capped = true;
				break;
			}

			// Skip a header row if present, matching the export's own
			// column order — don't require it, so a hand-written CSV
			// without one still imports.
			if ( 1 === $row_num && isset( $data[0] ) && 'from_path' === trim( strtolower( $data[0] ) ) ) {
				continue;
			}

			$from_path = isset( $data[0] ) ? $this->sanitize_path( $data[0] ) : '';
			$to_path   = isset( $data[1] ) ? trim( $data[1] ) : '';
			$type      = isset( $data[2] ) ? (int) $data[2] : 301;
			$type      = in_array( $type, array( 301, 302 ), true ) ? $type : 301;

			if ( empty( $from_path ) || empty( $to_path ) ) {
				$skipped++;
				continue;
			}

			if ( ! preg_match( '#^https?://#i', $to_path ) ) {
				$to_path = '/' . ltrim( $to_path, '/' );
			}

			if ( false === $this->upsert_redirect( $from_path, $to_path, $type ) ) {
				$skipped++;
			} else {
				$imported++;
			}
		}
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_fclose

		$args = array(
			'gravhub_import' => 'success',
			'imported'       => $imported,
			'skipped'        => $skipped,
		);
		if ( $capped ) {
			$args['capped'] = self::MAX_IMPORT_ROWS;
		}

		wp_safe_redirect( add_query_arg( $args, $redirect_url ) );
		exit;
	}

	/**
	 * Prefixes a leading =, +, -, or @ with a single quote — the standard
	 * CSV/formula-injection guard. A redirect's to_path is settable via CSV
	 * import as well as the admin UI, so a crafted value could otherwise be
	 * interpreted as a live formula by Excel/Sheets when a staff member
	 * later opens an exported file.
	 */
	private function csv_safe( $value ) {
		$value = (string) $value;
		if ( preg_match( '/^[=+\-@]/', $value ) ) {
			return "'" . $value;
		}
		return $value;
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
