<?php
/**
 * GravHub Sitemap Generator.
 *
 * Generates XML sitemaps following the sitemaps.org protocol, similar to
 * Yoast SEO and RankMath. Provides a sitemap index and sub-sitemaps for
 * configured post types and taxonomies.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GravHub_Sitemap {

	/**
	 * Maximum number of URLs per sitemap.
	 *
	 * @var int
	 */
	const MAX_URLS_PER_SITEMAP = 1000;

	/**
	 * Query variable used to identify sitemap requests.
	 *
	 * @var string
	 */
	const QUERY_VAR = 'gravhub_sitemap';

	/**
	 * Constructor. Registers all necessary hooks.
	 */
	public function __construct() {
		add_action( 'init', array( $this, 'add_rewrite_rules' ) );
		add_action( 'template_redirect', array( $this, 'intercept_sitemap_request' ) );
		add_action( 'save_post', array( $this, 'ping_google_on_change' ), 10, 1 );
		add_action( 'delete_post', array( $this, 'ping_google_on_change' ), 10, 1 );
	}

	/**
	 * Check whether the sitemap feature is enabled.
	 *
	 * @return bool
	 */
	public function is_enabled() {
		return (bool) get_option( 'gravhub_sitemap_enabled', true );
	}

	/**
	 * Get the post types included in the sitemap.
	 *
	 * @return array
	 */
	public function get_included_post_types() {
		return (array) get_option( 'gravhub_sitemap_post_types', array( 'post', 'page' ) );
	}

	/**
	 * Get the taxonomies included in the sitemap.
	 *
	 * @return array
	 */
	public function get_included_taxonomies() {
		return (array) get_option( 'gravhub_sitemap_taxonomies', array( 'category', 'post_tag' ) );
	}

	/**
	 * Register rewrite rules for all sitemap endpoints.
	 */
	public function add_rewrite_rules() {
		if ( ! $this->is_enabled() ) {
			return;
		}

		add_rewrite_rule( 'sitemap\.xml$', 'index.php?' . self::QUERY_VAR . '=index', 'top' );
		add_rewrite_rule( 'sitemap-posts\.xml$', 'index.php?' . self::QUERY_VAR . '=posts', 'top' );
		add_rewrite_rule( 'sitemap-pages\.xml$', 'index.php?' . self::QUERY_VAR . '=pages', 'top' );
		add_rewrite_rule( 'sitemap-categories\.xml$', 'index.php?' . self::QUERY_VAR . '=categories', 'top' );
		add_rewrite_rule( 'sitemap-tags\.xml$', 'index.php?' . self::QUERY_VAR . '=tags', 'top' );

		add_filter( 'query_vars', array( $this, 'register_query_var' ) );
	}

	/**
	 * Register the sitemap query variable so WordPress recognises it.
	 *
	 * @param array $vars Existing query variables.
	 * @return array
	 */
	public function register_query_var( $vars ) {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	/**
	 * Flush rewrite rules. Call on plugin activation.
	 */
	public static function flush_rules() {
		$instance = new self();
		$instance->add_rewrite_rules();
		flush_rewrite_rules();
	}

	/**
	 * Intercept the current request and render the appropriate sitemap.
	 */
	public function intercept_sitemap_request() {
		if ( ! $this->is_enabled() ) {
			return;
		}

		$sitemap = get_query_var( self::QUERY_VAR );

		if ( empty( $sitemap ) ) {
			return;
		}

		switch ( $sitemap ) {
			case 'index':
				$this->render_index();
				break;

			case 'posts':
				$this->render_post_type_sitemap( 'post' );
				break;

			case 'pages':
				$this->render_post_type_sitemap( 'page' );
				break;

			case 'categories':
				$this->render_taxonomy_sitemap( 'category' );
				break;

			case 'tags':
				$this->render_taxonomy_sitemap( 'post_tag' );
				break;

			default:
				return;
		}

		exit;
	}

	/**
	 * Send XML headers before rendering any sitemap.
	 */
	private function send_headers() {
		header( 'Content-Type: application/xml; charset=UTF-8' );
		header( 'X-Robots-Tag: noindex' );
	}

	/**
	 * Render the sitemap index with links to all sub-sitemaps.
	 */
	public function render_index() {
		$this->send_headers();

		echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		echo '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

		$included_post_types = $this->get_included_post_types();
		$included_taxonomies = $this->get_included_taxonomies();

		// Post type sub-sitemaps.
		if ( in_array( 'post', $included_post_types, true ) ) {
			$lastmod = $this->get_latest_post_modified( 'post' );
			echo "\t<sitemap>\n";
			echo "\t\t<loc>" . esc_url( home_url( '/sitemap-posts.xml' ) ) . "</loc>\n";
			if ( $lastmod ) {
				echo "\t\t<lastmod>" . esc_html( $lastmod ) . "</lastmod>\n";
			}
			echo "\t</sitemap>\n";
		}

		if ( in_array( 'page', $included_post_types, true ) ) {
			$lastmod = $this->get_latest_post_modified( 'page' );
			echo "\t<sitemap>\n";
			echo "\t\t<loc>" . esc_url( home_url( '/sitemap-pages.xml' ) ) . "</loc>\n";
			if ( $lastmod ) {
				echo "\t\t<lastmod>" . esc_html( $lastmod ) . "</lastmod>\n";
			}
			echo "\t</sitemap>\n";
		}

		// Taxonomy sub-sitemaps.
		if ( in_array( 'category', $included_taxonomies, true ) ) {
			echo "\t<sitemap>\n";
			echo "\t\t<loc>" . esc_url( home_url( '/sitemap-categories.xml' ) ) . "</loc>\n";
			echo "\t</sitemap>\n";
		}

		if ( in_array( 'post_tag', $included_taxonomies, true ) ) {
			echo "\t<sitemap>\n";
			echo "\t\t<loc>" . esc_url( home_url( '/sitemap-tags.xml' ) ) . "</loc>\n";
			echo "\t</sitemap>\n";
		}

		echo '</sitemapindex>' . "\n";
	}

	/**
	 * Render a sitemap for a specific post type.
	 *
	 * @param string $post_type The post type slug (e.g. 'post', 'page').
	 */
	public function render_post_type_sitemap( $post_type ) {
		$included_post_types = $this->get_included_post_types();

		if ( ! in_array( $post_type, $included_post_types, true ) ) {
			status_header( 404 );
			return;
		}

		$this->send_headers();

		$args = array(
			'post_type'      => $post_type,
			'post_status'    => 'publish',
			'posts_per_page' => self::MAX_URLS_PER_SITEMAP,
			'orderby'        => 'modified',
			'order'          => 'DESC',
			'no_found_rows'  => true,
			'meta_query'     => array(
				'relation' => 'OR',
				array(
					'key'     => '_gravhub_robots_noindex',
					'compare' => 'NOT EXISTS',
				),
				array(
					'key'     => '_gravhub_robots_noindex',
					'value'   => '1',
					'compare' => '!=',
				),
			),
		);

		$query = new WP_Query( $args );

		echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";

		if ( $query->have_posts() ) {
			while ( $query->have_posts() ) {
				$query->the_post();

				$post_id   = get_the_ID();
				$permalink = get_permalink( $post_id );
				$lastmod   = get_the_modified_date( 'c', $post_id );

				$is_homepage = ( 'page' === $post_type && (int) get_option( 'page_on_front' ) === $post_id );

				if ( $is_homepage ) {
					$priority   = '1.0';
					$changefreq = 'daily';
				} elseif ( 'page' === $post_type ) {
					$priority   = '0.8';
					$changefreq = 'weekly';
				} else {
					$priority   = '0.6';
					$changefreq = 'monthly';
				}

				echo "\t<url>\n";
				echo "\t\t<loc>" . esc_url( $permalink ) . "</loc>\n";
				echo "\t\t<lastmod>" . esc_html( $lastmod ) . "</lastmod>\n";
				echo "\t\t<changefreq>" . esc_html( $changefreq ) . "</changefreq>\n";
				echo "\t\t<priority>" . esc_html( $priority ) . "</priority>\n";

				foreach ( $this->get_post_images( $post_id ) as $image_url ) {
					echo "\t\t<image:image>\n";
					echo "\t\t\t<image:loc>" . esc_url( $image_url ) . "</image:loc>\n";
					echo "\t\t</image:image>\n";
				}

				echo "\t</url>\n";
			}

			wp_reset_postdata();
		}

		echo '</urlset>' . "\n";
	}

	/**
	 * Gather image URLs for a post: its featured image plus any <img> tags
	 * literally present in post_content (covers both classic-editor HTML and
	 * Gutenberg image blocks, which store a real <img> tag in post_content).
	 * Does not run post_content through the `the_content` filter — this only
	 * needs to find image URLs, not fully render the post.
	 *
	 * @param int $post_id The post ID.
	 * @return string[] Deduplicated list of absolute image URLs.
	 */
	private function get_post_images( $post_id ) {
		$images = array();

		$featured_id = get_post_thumbnail_id( $post_id );
		if ( $featured_id ) {
			$featured_url = wp_get_attachment_image_url( $featured_id, 'full' );
			if ( $featured_url ) {
				$images[] = $featured_url;
			}
		}

		$content = get_post_field( 'post_content', $post_id );
		if ( ! empty( $content ) && preg_match_all( '/<img[^>]+src=["\']([^"\']+)["\']/i', $content, $matches ) ) {
			foreach ( $matches[1] as $src ) {
				if ( ! in_array( $src, $images, true ) ) {
					$images[] = $src;
				}
			}
		}

		// The sitemap image extension caps at 1,000 images per URL — enforced
		// defensively, though no realistic single page would approach it.
		return array_slice( $images, 0, 1000 );
	}

	/**
	 * Render a sitemap for a specific taxonomy.
	 *
	 * @param string $taxonomy The taxonomy slug (e.g. 'category', 'post_tag').
	 */
	public function render_taxonomy_sitemap( $taxonomy ) {
		$included_taxonomies = $this->get_included_taxonomies();

		if ( ! in_array( $taxonomy, $included_taxonomies, true ) ) {
			status_header( 404 );
			return;
		}

		$this->send_headers();

		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => true,
				'number'     => self::MAX_URLS_PER_SITEMAP,
			)
		);

		echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

		if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
			foreach ( $terms as $term ) {
				$term_link = get_term_link( $term );

				if ( is_wp_error( $term_link ) ) {
					continue;
				}

				echo "\t<url>\n";
				echo "\t\t<loc>" . esc_url( $term_link ) . "</loc>\n";
				echo "\t\t<changefreq>weekly</changefreq>\n";
				echo "\t\t<priority>0.4</priority>\n";
				echo "\t</url>\n";
			}
		}

		echo '</urlset>' . "\n";
	}

	/**
	 * Ping Google to notify of sitemap changes.
	 *
	 * Fires on save_post and delete_post. Non-blocking fire-and-forget request.
	 *
	 * @param int $post_id The post ID that was saved or deleted.
	 */
	public function ping_google_on_change( $post_id ) {
		// Do not ping for autosaves or revisions.
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}

		if ( ! $this->is_enabled() ) {
			return;
		}

		$sitemap_url = home_url( '/sitemap.xml' );
		$ping_url    = 'https://www.google.com/ping?sitemap=' . rawurlencode( $sitemap_url );

		wp_remote_get(
			$ping_url,
			array(
				'timeout'  => 5,
				'blocking' => false,
			)
		);
	}

	/**
	 * Get the most recent modified date for a post type in W3C format.
	 *
	 * @param string $post_type The post type slug.
	 * @return string|false W3C date string, or false if no posts found.
	 */
	private function get_latest_post_modified( $post_type ) {
		$latest = get_posts(
			array(
				'post_type'      => $post_type,
				'post_status'    => 'publish',
				'posts_per_page' => 1,
				'orderby'        => 'modified',
				'order'          => 'DESC',
				'no_found_rows'  => true,
			)
		);

		if ( empty( $latest ) ) {
			return false;
		}

		return get_post_modified_time( 'c', true, $latest[0] );
	}
}
