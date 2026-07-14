<?php
/**
 * GravHub Meta Manager.
 *
 * Manages meta tag output in wp_head based on per-post meta and GravHub settings.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GravHub_Meta_Manager {

	private $api_client;

	public function __construct( GravHub_API_Client $api_client ) {
		$this->api_client = $api_client;

		add_filter( 'pre_get_document_title', array( $this, 'filter_title' ), 20 );
		add_filter( 'wp_title', array( $this, 'filter_wp_title' ), 20, 2 );
	}

	private function is_other_seo_plugin_active() {
		if ( defined( 'WPSEO_VERSION' ) ) return true;
		if ( class_exists( 'RankMath' ) ) return true;
		if ( class_exists( 'AIOSEO\\Plugin\\AIOSEO' ) ) return true;
		return false;
	}

	private function get_current_path() {
		if ( is_front_page() || is_home() ) {
			return '/';
		}
		global $wp;
		return '/' . trim( $wp->request, '/' );
	}

	/**
	 * Get SEO settings for current page: GravHub API settings as the base
	 * layer, with per-post meta overriding individual fields on top.
	 *
	 * Previously this returned per-post meta OR API settings, whichever was
	 * present — if a post had ANY per-post meta field set (even a legacy
	 * meta_title from before GravHub app-managed SEO existed), the API's
	 * settings for that page (e.g. og_image/schema_markup set via the
	 * GravHub app's Meta tab) were silently discarded entirely, not just
	 * the one field the per-post meta actually overrode.
	 */
	private function get_page_settings() {
		$settings = array();

		// 1. GravHub managed settings (from API) — base layer
		$api_settings = $this->api_client->get_seo_settings();
		if ( ! is_wp_error( $api_settings ) && is_array( $api_settings ) ) {
			$current_path = $this->get_current_path();
			foreach ( $api_settings as $page_settings ) {
				if ( is_array( $page_settings ) && isset( $page_settings['page_path'] ) && $page_settings['page_path'] === $current_path ) {
					$settings = $page_settings;
					break;
				}
			}
		}

		// 2. Per-post meta overrides individual fields (highest priority)
		if ( is_singular() ) {
			$post_id = get_queried_object_id();
			if ( $post_id ) {
				$meta_title       = get_post_meta( $post_id, '_gravhub_meta_title', true );
				$meta_description = get_post_meta( $post_id, '_gravhub_meta_description', true );
				$og_title         = get_post_meta( $post_id, '_gravhub_og_title', true );
				$og_description   = get_post_meta( $post_id, '_gravhub_og_description', true );
				$og_image         = get_post_meta( $post_id, '_gravhub_og_image', true );
				$canonical        = get_post_meta( $post_id, '_gravhub_canonical_url', true );
				$noindex          = get_post_meta( $post_id, '_gravhub_robots_noindex', true );
				$nofollow         = get_post_meta( $post_id, '_gravhub_robots_nofollow', true );
				$schema_markup    = get_post_meta( $post_id, '_gravhub_schema_markup', true );

				if ( $meta_title )       $settings['meta_title']       = $meta_title;
				if ( $meta_description ) $settings['meta_description'] = $meta_description;
				if ( $og_title )         $settings['og_title']         = $og_title;
				if ( $og_description )   $settings['og_description']   = $og_description;
				if ( $og_image )         $settings['og_image']         = $og_image;
				if ( $canonical )        $settings['canonical_url']    = $canonical;
				if ( $noindex )          $settings['noindex']          = true;
				if ( $nofollow )         $settings['nofollow']         = true;
				if ( $schema_markup )    $settings['schema_markup']    = $schema_markup;
			}
		}

		return ! empty( $settings ) ? $settings : null;
	}

	/**
	 * Filter the document title via pre_get_document_title.
	 */
	public function filter_title( $title ) {
		if ( $this->is_other_seo_plugin_active() ) return $title;

		$settings = $this->get_page_settings();
		if ( $settings && ! empty( $settings['meta_title'] ) ) {
			return $settings['meta_title'];
		}
		return $title;
	}

	/**
	 * Filter wp_title for older themes.
	 */
	public function filter_wp_title( $title, $sep ) {
		if ( $this->is_other_seo_plugin_active() ) return $title;

		$settings = $this->get_page_settings();
		if ( $settings && ! empty( $settings['meta_title'] ) ) {
			return $settings['meta_title'];
		}
		return $title;
	}

	/**
	 * Output managed meta tags in wp_head.
	 */
	public function output_meta_tags() {
		if ( $this->is_other_seo_plugin_active() ) return;
		if ( ! $this->api_client->is_configured() ) {
			// Still check for per-post meta even without API config
			if ( ! is_singular() ) return;
		}

		$page_settings = $this->get_page_settings();
		if ( null === $page_settings ) return;

		echo "\n<!-- GravHub SEO -->\n";

		// Meta description
		if ( ! empty( $page_settings['meta_description'] ) ) {
			printf( '<meta name="description" content="%s" />' . "\n", esc_attr( $page_settings['meta_description'] ) );
		}

		// Canonical URL
		if ( ! empty( $page_settings['canonical_url'] ) ) {
			printf( '<link rel="canonical" href="%s" />' . "\n", esc_url( $page_settings['canonical_url'] ) );
		}

		// Robots meta
		$robots = array();
		if ( ! empty( $page_settings['noindex'] ) )  $robots[] = 'noindex';
		if ( ! empty( $page_settings['nofollow'] ) ) $robots[] = 'nofollow';
		if ( ! empty( $robots ) ) {
			printf( '<meta name="robots" content="%s" />' . "\n", esc_attr( implode( ', ', $robots ) ) );
		}

		// Open Graph tags
		$this->output_og_tags( $page_settings );

		// Twitter Card
		$this->output_twitter_card( $page_settings );

		// JSON-LD schema markup
		$this->output_jsonld( $page_settings );

		echo "<!-- /GravHub SEO -->\n\n";
	}

	private function output_og_tags( $settings ) {
		if ( ! empty( $settings['og_title'] ) ) {
			printf( '<meta property="og:title" content="%s" />' . "\n", esc_attr( $settings['og_title'] ) );
		}
		if ( ! empty( $settings['og_description'] ) ) {
			printf( '<meta property="og:description" content="%s" />' . "\n", esc_attr( $settings['og_description'] ) );
		}
		if ( ! empty( $settings['og_image'] ) ) {
			printf( '<meta property="og:image" content="%s" />' . "\n", esc_url( $settings['og_image'] ) );
		}

		if ( ! empty( $settings['og_title'] ) || ! empty( $settings['og_description'] ) || ! empty( $settings['og_image'] ) ) {
			printf( '<meta property="og:url" content="%s" />' . "\n", esc_url( $this->get_current_url() ) );
			printf( '<meta property="og:type" content="%s" />' . "\n", esc_attr( is_single() ? 'article' : 'website' ) );
			printf( '<meta property="og:site_name" content="%s" />' . "\n", esc_attr( get_bloginfo( 'name' ) ) );
		}
	}

	private function output_twitter_card( $settings ) {
		$title = $settings['og_title'] ?? ( $settings['meta_title'] ?? '' );
		$desc  = $settings['og_description'] ?? ( $settings['meta_description'] ?? '' );
		$image = $settings['og_image'] ?? '';

		if ( empty( $title ) && empty( $desc ) ) return;

		echo '<meta name="twitter:card" content="' . ( $image ? 'summary_large_image' : 'summary' ) . '" />' . "\n";
		if ( $title ) printf( '<meta name="twitter:title" content="%s" />' . "\n", esc_attr( $title ) );
		if ( $desc )  printf( '<meta name="twitter:description" content="%s" />' . "\n", esc_attr( $desc ) );
		if ( $image ) printf( '<meta name="twitter:image" content="%s" />' . "\n", esc_url( $image ) );
	}

	private function output_jsonld( $settings ) {
		$schema = $settings['schema_markup'] ?? null;
		if ( empty( $schema ) || ! is_array( $schema ) ) return;

		if ( ! isset( $schema['@context'] ) ) {
			$schema['@context'] = 'https://schema.org';
		}

		printf(
			'<script type="application/ld+json">%s</script>' . "\n",
			wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);
	}

	private function get_current_url() {
		if ( is_front_page() || is_home() ) {
			return home_url( '/' );
		}
		global $wp;
		return home_url( $wp->request );
	}
}
