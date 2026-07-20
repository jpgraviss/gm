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
				$schema_type      = get_post_meta( $post_id, '_gravhub_schema_type', true );
				$faq_items_raw    = get_post_meta( $post_id, '_gravhub_faq_items', true );
				$hreflang_raw     = get_post_meta( $post_id, '_gravhub_hreflang_items', true );

				if ( $meta_title )       $settings['meta_title']       = $meta_title;
				if ( $meta_description ) $settings['meta_description'] = $meta_description;
				if ( $og_title )         $settings['og_title']         = $og_title;
				if ( $og_description )   $settings['og_description']   = $og_description;
				if ( $og_image )         $settings['og_image']         = $og_image;
				if ( $canonical )        $settings['canonical_url']    = $canonical;
				if ( $noindex )          $settings['noindex']          = true;
				if ( $nofollow )         $settings['nofollow']         = true;
				if ( $schema_markup )    $settings['schema_markup']    = $schema_markup;
				if ( $schema_type )      $settings['post_schema_type'] = $schema_type;

				if ( $faq_items_raw ) {
					$decoded_faq = json_decode( $faq_items_raw, true );
					if ( is_array( $decoded_faq ) && ! empty( $decoded_faq ) ) {
						$settings['post_faq_items'] = $decoded_faq;
					}
				}

				if ( $hreflang_raw ) {
					$decoded_hreflang = json_decode( $hreflang_raw, true );
					if ( is_array( $decoded_hreflang ) && ! empty( $decoded_hreflang ) ) {
						$settings['hreflang_items'] = $decoded_hreflang;
					}
				}

				if ( $post_id ) {
					$settings['post_id'] = $post_id;
				}
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

		// Organization/WebSite/LocalBusiness schema is site-wide config
		// (Settings > Organization & Local Business), not tied to any one
		// page's meta — it must still be able to print on the homepage
		// even when there's nothing page-specific to say.
		$show_site_schema = is_front_page() && $this->has_site_schema_config();

		if ( ! $this->api_client->is_configured() && ! is_singular() && ! $show_site_schema ) {
			// Nothing page-specific could exist here (no API config on a
			// non-singular page means no per-post meta either) and no
			// site-wide schema to show — skip the API round trip entirely.
			return;
		}

		$page_settings = $this->get_page_settings();
		if ( null === $page_settings && ! $show_site_schema ) return;

		echo "\n<!-- GravHub SEO -->\n";

		if ( $page_settings ) {
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

			// Hreflang alternates
			$this->output_hreflang_tags( $page_settings );

			// Open Graph tags
			$this->output_og_tags( $page_settings );

			// Twitter Card
			$this->output_twitter_card( $page_settings );

			// JSON-LD schema markup (per-post, e.g. FAQ/Article/Service)
			$this->output_jsonld( $page_settings );
		}

		// Site-wide JSON-LD (Organization/WebSite/LocalBusiness)
		if ( $show_site_schema ) {
			$this->output_site_schema();
		}

		echo "<!-- /GravHub SEO -->\n\n";
	}

	/**
	 * Whether enough Organization/LocalBusiness settings exist to be worth
	 * checking is_front_page() for on every request.
	 */
	private function has_site_schema_config() {
		return (bool) get_option( 'gravhub_org_name', '' ) || (bool) get_option( 'gravhub_local_business_enabled', false );
	}

	/**
	 * Emit Organization + WebSite + LocalBusiness JSON-LD as a single
	 * @graph on the homepage. Each piece is genuinely inert (prints
	 * nothing) until its own real minimum fields are filled in via
	 * Settings > Organization & Local Business — never fabricated.
	 */
	private function output_site_schema() {
		$graph = array();

		$org_name = get_option( 'gravhub_org_name', '' );
		if ( ! empty( $org_name ) ) {
			$org = array(
				'@type' => 'Organization',
				'@id'   => home_url( '/#organization' ),
				'name'  => $org_name,
				'url'   => home_url( '/' ),
			);

			$logo = get_option( 'gravhub_org_logo', '' );
			if ( ! empty( $logo ) ) {
				$org['logo'] = $logo;
			}

			$same_as = $this->get_same_as_urls();
			if ( ! empty( $same_as ) ) {
				$org['sameAs'] = $same_as;
			}

			$graph[] = $org;

			$graph[] = array(
				'@type'     => 'WebSite',
				'@id'       => home_url( '/#website' ),
				'name'      => get_bloginfo( 'name' ),
				'url'       => home_url( '/' ),
				'publisher' => array( '@id' => home_url( '/#organization' ) ),
			);
		}

		if ( get_option( 'gravhub_local_business_enabled', false ) ) {
			$local_business = $this->build_local_business_schema();
			if ( $local_business ) {
				$graph[] = $local_business;
			}
		}

		if ( empty( $graph ) ) return;

		$schema = array(
			'@context' => 'https://schema.org',
			'@graph'   => $graph,
		);

		printf(
			'<script type="application/ld+json">%s</script>' . "\n",
			wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);
	}

	/**
	 * Parse the Same As textarea option (already newline-normalized and
	 * URL-validated by GravHub_Admin_Page::sanitize_same_as() on save).
	 */
	private function get_same_as_urls() {
		$raw = get_option( 'gravhub_org_same_as', '' );
		if ( empty( $raw ) ) return array();
		$lines = array_filter( array_map( 'trim', explode( "\n", $raw ) ) );
		return array_values( $lines );
	}

	/**
	 * Builds LocalBusiness schema only once the real minimum identifying
	 * fields (name + a street address) are actually filled in — returns
	 * null (nothing printed) until then, same inert-until-configured
	 * pattern every other GravHub integration follows.
	 */
	private function build_local_business_schema() {
		$name = get_option( 'gravhub_local_business_name', '' );
		if ( empty( $name ) ) {
			$name = get_option( 'gravhub_org_name', '' );
		}
		$street = get_option( 'gravhub_local_business_address', '' );

		if ( empty( $name ) || empty( $street ) ) return null;

		$business = array(
			'@type'   => get_option( 'gravhub_local_business_type', 'LocalBusiness' ),
			'name'    => $name,
			'url'     => home_url( '/' ),
			'address' => array(
				'@type'         => 'PostalAddress',
				'streetAddress' => $street,
			),
		);

		$city    = get_option( 'gravhub_local_business_city', '' );
		$state   = get_option( 'gravhub_local_business_state', '' );
		$zip     = get_option( 'gravhub_local_business_zip', '' );
		$country = get_option( 'gravhub_local_business_country', '' );
		$phone   = get_option( 'gravhub_local_business_phone', '' );
		$logo    = get_option( 'gravhub_org_logo', '' );

		if ( ! empty( $city ) )    $business['address']['addressLocality'] = $city;
		if ( ! empty( $state ) )   $business['address']['addressRegion']   = $state;
		if ( ! empty( $zip ) )     $business['address']['postalCode']      = $zip;
		if ( ! empty( $country ) ) $business['address']['addressCountry']  = $country;
		if ( ! empty( $phone ) )   $business['telephone']                  = $phone;
		if ( ! empty( $logo ) )    $business['image']                     = $logo;

		return $business;
	}

	/**
	 * Alternate-language/region versions of this page, configured per-post
	 * in the metabox's Advanced tab. Only prints what's actually
	 * configured — no self-referencing or x-default entry is fabricated,
	 * matching every other GravHub integration's inert-until-configured
	 * pattern.
	 */
	private function output_hreflang_tags( $settings ) {
		if ( empty( $settings['hreflang_items'] ) || ! is_array( $settings['hreflang_items'] ) ) {
			return;
		}
		foreach ( $settings['hreflang_items'] as $item ) {
			if ( empty( $item['lang'] ) || empty( $item['url'] ) ) {
				continue;
			}
			printf(
				'<link rel="alternate" hreflang="%s" href="%s" />' . "\n",
				esc_attr( $item['lang'] ),
				esc_url( $item['url'] )
			);
		}
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
		// A structured per-post Schema Type (Article/Service/FAQ, set in the
		// metabox's Schema tab) takes priority over the freeform API-sourced
		// schema_markup — it's the more deliberate, specific signal when both
		// happen to be present.
		$schema = $this->build_typed_schema( $settings );
		if ( null === $schema ) {
			$schema = $settings['schema_markup'] ?? null;
		}
		if ( empty( $schema ) || ! is_array( $schema ) ) return;

		if ( ! isset( $schema['@context'] ) ) {
			$schema['@context'] = 'https://schema.org';
		}

		printf(
			'<script type="application/ld+json">%s</script>' . "\n",
			wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
		);
	}

	/**
	 * Build Article/Service/FAQPage JSON-LD from the metabox's Schema tab.
	 * FAQPage reads the exact same `post_faq_items` list the
	 * [gravhub_faq] shortcode renders as a visible accordion — they can
	 * never drift out of sync since both come from one field.
	 */
	private function build_typed_schema( $settings ) {
		$type = $settings['post_schema_type'] ?? '';
		if ( empty( $type ) || empty( $settings['post_id'] ) ) return null;

		$post_id = (int) $settings['post_id'];
		$post    = get_post( $post_id );
		if ( ! $post ) return null;

		$url = get_permalink( $post_id );

		switch ( $type ) {
			case 'Article':
				return array(
					'@type'            => 'Article',
					'headline'         => get_the_title( $post_id ),
					'description'      => wp_strip_all_tags( get_the_excerpt( $post ) ),
					'author'           => array(
						'@type' => 'Person',
						'name'  => get_the_author_meta( 'display_name', $post->post_author ),
					),
					'datePublished'    => get_the_date( 'c', $post_id ),
					'dateModified'     => get_the_modified_date( 'c', $post_id ),
					'mainEntityOfPage' => array(
						'@type' => 'WebPage',
						'@id'   => $url,
					),
				);

			case 'Service':
				return array(
					'@type'       => 'Service',
					'name'        => get_the_title( $post_id ),
					'description' => wp_strip_all_tags( get_the_excerpt( $post ) ),
					'url'         => $url,
				);

			case 'FAQ':
				$items = $settings['post_faq_items'] ?? array();
				if ( empty( $items ) || ! is_array( $items ) ) return null;

				$entities = array();
				foreach ( $items as $item ) {
					if ( empty( $item['question'] ) || empty( $item['answer'] ) ) continue;
					$entities[] = array(
						'@type'          => 'Question',
						'name'           => $item['question'],
						'acceptedAnswer' => array(
							'@type' => 'Answer',
							'text'  => wp_strip_all_tags( $item['answer'] ),
						),
					);
				}
				if ( empty( $entities ) ) return null;

				return array(
					'@type'      => 'FAQPage',
					'mainEntity' => $entities,
				);
		}

		return null;
	}

	private function get_current_url() {
		if ( is_front_page() || is_home() ) {
			return home_url( '/' );
		}
		global $wp;
		return home_url( $wp->request );
	}
}
