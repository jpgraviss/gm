<?php
/**
 * GravHub Meta Manager.
 *
 * Manages meta tag output in wp_head based on GravHub settings.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class GravHub_Meta_Manager
 */
class GravHub_Meta_Manager {

	/**
	 * API client instance.
	 *
	 * @var GravHub_API_Client
	 */
	private $api_client;

	/**
	 * Constructor.
	 *
	 * @param GravHub_API_Client $api_client API client instance.
	 */
	public function __construct( GravHub_API_Client $api_client ) {
		$this->api_client = $api_client;
	}

	/**
	 * Check if another SEO plugin is active.
	 *
	 * @return bool
	 */
	private function is_other_seo_plugin_active() {
		// Check for Yoast SEO.
		if ( defined( 'WPSEO_VERSION' ) ) {
			return true;
		}

		// Check for RankMath.
		if ( class_exists( 'RankMath' ) ) {
			return true;
		}

		// Check for All in One SEO.
		if ( class_exists( 'AIOSEO\\Plugin\\AIOSEO' ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Get the current URL path for matching against managed settings.
	 *
	 * @return string
	 */
	private function get_current_path() {
		if ( is_front_page() || is_home() ) {
			return '/';
		}

		global $wp;
		$current_path = '/' . trim( $wp->request, '/' );

		return $current_path;
	}

	/**
	 * Get managed settings for the current page.
	 *
	 * @return array|null Settings for the current path, or null if none found.
	 */
	private function get_page_settings() {
		$settings = $this->api_client->get_seo_settings();

		if ( is_wp_error( $settings ) || empty( $settings ) ) {
			return null;
		}

		$current_path = $this->get_current_path();

		// Check for exact path match.
		if ( isset( $settings['pages'] ) && is_array( $settings['pages'] ) ) {
			foreach ( $settings['pages'] as $page_settings ) {
				if ( isset( $page_settings['path'] ) && $page_settings['path'] === $current_path ) {
					return $page_settings;
				}
			}
		}

		// Check for global/default settings.
		if ( isset( $settings['defaults'] ) ) {
			return $settings['defaults'];
		}

		return null;
	}

	/**
	 * Output managed meta tags in wp_head.
	 */
	public function output_meta_tags() {
		// Skip if another SEO plugin is handling meta tags.
		if ( $this->is_other_seo_plugin_active() ) {
			return;
		}

		if ( ! $this->api_client->is_configured() ) {
			return;
		}

		$page_settings = $this->get_page_settings();

		if ( null === $page_settings ) {
			return;
		}

		echo "\n<!-- GravHub SEO -->\n";

		// Meta description.
		if ( ! empty( $page_settings['meta_description'] ) ) {
			printf(
				'<meta name="description" content="%s" />' . "\n",
				esc_attr( $page_settings['meta_description'] )
			);
		}

		// Open Graph tags.
		$this->output_og_tags( $page_settings );

		// JSON-LD schema markup.
		$this->output_jsonld( $page_settings );

		echo "<!-- /GravHub SEO -->\n\n";
	}

	/**
	 * Output Open Graph meta tags.
	 *
	 * @param array $settings Page settings.
	 */
	private function output_og_tags( $settings ) {
		if ( ! empty( $settings['og_title'] ) ) {
			printf(
				'<meta property="og:title" content="%s" />' . "\n",
				esc_attr( $settings['og_title'] )
			);
		}

		if ( ! empty( $settings['og_description'] ) ) {
			printf(
				'<meta property="og:description" content="%s" />' . "\n",
				esc_attr( $settings['og_description'] )
			);
		}

		if ( ! empty( $settings['og_image'] ) ) {
			printf(
				'<meta property="og:image" content="%s" />' . "\n",
				esc_url( $settings['og_image'] )
			);
		}

		// Always output og:url and og:type if any OG tag is present.
		if ( ! empty( $settings['og_title'] ) || ! empty( $settings['og_description'] ) || ! empty( $settings['og_image'] ) ) {
			printf(
				'<meta property="og:url" content="%s" />' . "\n",
				esc_url( $this->get_current_url() )
			);
			printf(
				'<meta property="og:type" content="%s" />' . "\n",
				esc_attr( is_single() ? 'article' : 'website' )
			);
		}
	}

	/**
	 * Output JSON-LD structured data.
	 *
	 * @param array $settings Page settings.
	 */
	private function output_jsonld( $settings ) {
		if ( empty( $settings['schema'] ) || ! is_array( $settings['schema'] ) ) {
			return;
		}

		$schema = $settings['schema'];

		// Ensure @context is set.
		if ( ! isset( $schema['@context'] ) ) {
			$schema['@context'] = 'https://schema.org';
		}

		printf(
			'<script type="application/ld+json">%s</script>' . "\n",
			wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);
	}

	/**
	 * Get the full URL of the current page.
	 *
	 * @return string
	 */
	private function get_current_url() {
		if ( is_front_page() || is_home() ) {
			return home_url( '/' );
		}

		global $wp;
		return home_url( $wp->request );
	}
}
