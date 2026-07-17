<?php
/**
 * GravHub Broken Outbound Link Scanner.
 *
 * Periodically scans published post/page content for outbound (external)
 * links and checks whether they still resolve, logging ones that don't so
 * dead external links can be fixed or removed without manually re-checking
 * every page's outgoing links by hand.
 *
 * No admin menu of its own — results surface as a Broken Links section on
 * the existing "Redirects" page (admin/views/redirects-page.php), the same
 * way the 404 Monitor lives there rather than getting its own top-level
 * page for one small table.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GravHub_Broken_Link_Scanner {

	/**
	 * Posts scanned per cron run. Keeps a single WP-Cron invocation fast
	 * even on a large site — full site coverage happens gradually across
	 * runs (oldest-scanned-first), not all at once.
	 *
	 * @var int
	 */
	const POSTS_PER_RUN = 5;

	/**
	 * Distinct external URLs actually HTTP-checked per run. A single post
	 * can easily contain more outbound links than this — the remainder
	 * simply get checked on the next run once this post's
	 * last-scanned timestamp is updated and it cycles back through.
	 *
	 * @var int
	 */
	const LINKS_PER_RUN = 20;

	const REQUEST_TIMEOUT = 8;

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_action( 'gravhub_broken_link_scan', array( $this, 'scan_batch' ) );
	}

	/**
	 * Create (or update, via dbDelta's diff-based migration) the results
	 * table. Safe to call on every admin page load — matches the self-heal
	 * pattern already used by GravHub_Redirect_Manager::create_tables().
	 */
	public static function create_tables() {
		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$table            = $wpdb->prefix . 'gravhub_broken_links';

		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			post_id BIGINT UNSIGNED NOT NULL,
			post_title VARCHAR(255) NOT NULL DEFAULT '',
			url VARCHAR(500) NOT NULL,
			status_code SMALLINT DEFAULT NULL,
			error_message VARCHAR(255) DEFAULT NULL,
			first_seen DATETIME NOT NULL,
			last_checked DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY post_url (post_id, url(191))
		) {$charset_collate};";

		dbDelta( $sql );
	}

	private function table() {
		global $wpdb;
		return $wpdb->prefix . 'gravhub_broken_links';
	}

	/**
	 * Count of currently-logged broken links — used by the dashboard
	 * notification feed, matching get_redirect_count()/get_404_count()'s
	 * cheap-COUNT pattern.
	 *
	 * @return int
	 */
	public function get_broken_link_count() {
		global $wpdb;
		$table = $this->table();
		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	/**
	 * Scan a batch of posts for outbound links and check each one. Runs on
	 * the gravhub_broken_link_scan cron event (scheduled by
	 * GravHub_SEO::self_heal_activation(), same idempotent self-heal
	 * pattern as the daily health report cron) and can also be triggered
	 * on demand via the REST "Scan Now" route.
	 *
	 * @return array{posts_scanned: int, links_checked: int, broken_found: int}
	 */
	public function scan_batch() {
		$posts = $this->get_next_posts_to_scan();

		$site_host     = wp_parse_url( home_url(), PHP_URL_HOST );
		$links_checked = 0;
		$broken_found  = 0;
		$checked_urls  = array(); // Dedupe within this run — the same external URL often appears on multiple posts.

		foreach ( $posts as $post ) {
			$external_links = $this->extract_external_links( $post->post_content, $site_host );

			foreach ( $external_links as $url ) {
				if ( isset( $checked_urls[ $url ] ) ) {
					// Already checked this exact URL earlier in this same
					// run (for a different post) — reuse the full result
					// (including the real status code/error) rather than
					// requesting it again or losing that detail.
					$check = $checked_urls[ $url ];
				} else {
					if ( $links_checked >= self::LINKS_PER_RUN ) {
						continue;
					}
					$links_checked++;
					$check                 = $this->check_link( $url );
					$checked_urls[ $url ] = $check;
				}

				if ( $check['ok'] ) {
					$this->clear_result( $post->ID, $url );
				} else {
					$this->record_result( $post, $url, $check['status_code'], $check['error'] );
					$broken_found++;
				}
			}

			update_post_meta( $post->ID, '_gravhub_links_last_scanned', current_time( 'mysql' ) );
		}

		return array(
			'posts_scanned' => count( $posts ),
			'links_checked' => $links_checked,
			'broken_found'  => $broken_found,
		);
	}

	/**
	 * Posts never scanned first, then the least-recently-scanned — a plain
	 * meta-value ORDER BY excludes posts missing the meta key entirely, so
	 * this runs as two queries instead of fighting WP_Query's meta_query
	 * clause syntax for "nulls first".
	 */
	private function get_next_posts_to_scan() {
		$never_scanned = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => self::POSTS_PER_RUN,
				'no_found_rows'  => true,
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
					array(
						'key'     => '_gravhub_links_last_scanned',
						'compare' => 'NOT EXISTS',
					),
				),
			)
		);

		$remaining = self::POSTS_PER_RUN - count( $never_scanned );
		if ( $remaining <= 0 ) {
			return $never_scanned;
		}

		$previously_scanned = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => $remaining,
				'no_found_rows'  => true,
				'meta_key'       => '_gravhub_links_last_scanned', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'orderby'        => 'meta_value',
				'order'          => 'ASC',
			)
		);

		return array_merge( $never_scanned, $previously_scanned );
	}

	/**
	 * Same href-extraction regex GravHub_SEO_Analyzer already uses for its
	 * own external-links check, kept consistent rather than introducing a
	 * second parsing approach (e.g. DOMDocument) for the same job.
	 */
	private function extract_external_links( $content, $site_host ) {
		$links = array();
		if ( ! preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\']/i', $content, $matches ) ) {
			return $links;
		}

		foreach ( $matches[1] as $href ) {
			$link_host = wp_parse_url( $href, PHP_URL_HOST );
			if ( $link_host && $link_host !== $site_host && preg_match( '#^https?://#i', $href ) ) {
				$links[ $href ] = true; // Dedupe within this one post's content.
			}
		}

		return array_keys( $links );
	}

	/**
	 * HEAD-check a single URL, falling back to GET when a server rejects
	 * HEAD outright (some do, returning 405 even though the resource is
	 * fine) — matches the fallback pattern GravHub_Health_Reporter already
	 * uses for its own live sitemap/security checks.
	 *
	 * @return array{ok: bool, status_code: int|null, error: string|null}
	 */
	private function check_link( $url ) {
		$args = array(
			'timeout'     => self::REQUEST_TIMEOUT,
			'redirection' => 5,
			'sslverify'   => false, // A site's own outbound link check shouldn't fail on the *target* site's cert config.
		);

		$response = wp_remote_head( $url, $args );

		if ( is_wp_error( $response ) || 405 === (int) wp_remote_retrieve_response_code( $response ) ) {
			$response = wp_remote_get( $url, $args );
		}

		if ( is_wp_error( $response ) ) {
			return array(
				'ok'          => false,
				'status_code' => null,
				'error'       => $response->get_error_message(),
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );

		// status_code alone conveys the failure for a real HTTP response —
		// error_message is reserved for cases with no status_code at all
		// (DNS failure, timeout, connection refused), set in the
		// is_wp_error() branch above.
		return array(
			'ok'          => $code > 0 && $code < 400,
			'status_code' => $code,
			'error'       => null,
		);
	}

	private function record_result( $post, $url, $status_code, $error ) {
		global $wpdb;
		$table = $this->table();
		$now   = current_time( 'mysql' );

		$existing_id = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE post_id = %d AND url = %s", $post->ID, $url ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		if ( $existing_id ) {
			$wpdb->update(
				$table,
				array(
					'status_code'   => $status_code,
					'error_message' => $error,
					'last_checked'  => $now,
				),
				array( 'id' => $existing_id ),
				array( '%d', '%s', '%s' ),
				array( '%d' )
			);
			return;
		}

		$wpdb->insert(
			$table,
			array(
				'post_id'       => $post->ID,
				'post_title'    => get_the_title( $post ),
				'url'           => $url,
				'status_code'   => $status_code,
				'error_message' => $error,
				'first_seen'    => $now,
				'last_checked'  => $now,
			),
			array( '%d', '%s', '%s', '%d', '%s', '%s', '%s' )
		);
	}

	/**
	 * A previously-broken link that now checks out fine is removed rather
	 * than kept around in a "resolved" state — the table is meant to
	 * reflect links that need attention right now.
	 */
	private function clear_result( $post_id, $url ) {
		global $wpdb;
		$table = $this->table();
		$wpdb->delete( $table, array( 'post_id' => $post_id, 'url' => $url ), array( '%d', '%s' ) ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
	}

	/**
	 * REST routes. All gated on manage_gravhub_seo, same as every other
	 * admin-facing GravHub route.
	 */
	public function register_rest_routes() {
		$auth = function () {
			return current_user_can( 'manage_gravhub_seo' );
		};

		register_rest_route(
			'gravhub-seo/v1',
			'/broken-links',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_list_broken_links' ),
				'permission_callback' => $auth,
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/broken-links/(?P<id>\d+)',
			array(
				'methods'             => 'DELETE',
				'callback'            => array( $this, 'rest_dismiss_broken_link' ),
				'permission_callback' => $auth,
			)
		);

		register_rest_route(
			'gravhub-seo/v1',
			'/broken-links/scan-now',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'rest_scan_now' ),
				'permission_callback' => $auth,
			)
		);
	}

	public function rest_list_broken_links( $request ) {
		global $wpdb;
		$table = $this->table();
		$rows  = $wpdb->get_results( "SELECT id, post_id, post_title, url, status_code, error_message, last_checked FROM {$table} ORDER BY last_checked DESC LIMIT 200" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		foreach ( $rows as &$row ) {
			$row->post_edit_link = get_edit_post_link( (int) $row->post_id, '' );
		}

		return new WP_REST_Response( $rows, 200 );
	}

	public function rest_dismiss_broken_link( $request ) {
		global $wpdb;
		$table = $this->table();
		$wpdb->delete( $table, array( 'id' => (int) $request['id'] ), array( '%d' ) );
		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * Runs one scan batch synchronously so "Scan Now" gives immediate
	 * feedback instead of waiting for the next cron tick — same
	 * POSTS_PER_RUN/LINKS_PER_RUN bounds apply, so this is still bounded
	 * request time, not a full-site crawl on demand.
	 */
	public function rest_scan_now( $request ) {
		$result = $this->scan_batch();
		return new WP_REST_Response(
			array_merge( array( 'success' => true ), $result ),
			200
		);
	}
}
