<?php
/**
 * GravHub SEO Analyzer.
 *
 * Analyzes published posts and pages for SEO quality.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class GravHub_SEO_Analyzer
 */
class GravHub_SEO_Analyzer {

	/**
	 * Ideal minimum title length.
	 *
	 * @var int
	 */
	const TITLE_MIN_LENGTH = 50;

	/**
	 * Ideal maximum title length.
	 *
	 * @var int
	 */
	const TITLE_MAX_LENGTH = 60;

	/**
	 * Ideal minimum meta description length.
	 *
	 * @var int
	 */
	const META_DESC_MIN_LENGTH = 120;

	/**
	 * Ideal maximum meta description length.
	 *
	 * @var int
	 */
	const META_DESC_MAX_LENGTH = 160;

	/**
	 * Minimum recommended content word count.
	 *
	 * @var int
	 */
	const MIN_WORD_COUNT = 300;

	/**
	 * Maximum recommended URL slug length.
	 *
	 * @var int
	 */
	const MAX_SLUG_LENGTH = 75;

	/**
	 * Analyze a single post/page for SEO quality.
	 *
	 * @param WP_Post $post The post to analyze.
	 * @return array Analysis result with score and issues.
	 */
	public function analyze_page( $post ) {
		$issues = array();
		$score  = 100;

		// Get post content without shortcodes rendered.
		$content = $post->post_content;

		// Get the post permalink for URL analysis.
		$permalink = get_permalink( $post );
		$url_path  = wp_parse_url( $permalink, PHP_URL_PATH );

		// 1. Title length check.
		$title        = $post->post_title;
		$title_length = mb_strlen( $title );

		if ( empty( $title ) ) {
			$issues[] = array(
				'type'     => 'title_missing',
				'message'  => __( 'Page title is empty.', 'gravhub-seo' ),
				'severity' => 'error',
			);
			$score   -= 15;
		} elseif ( $title_length < self::TITLE_MIN_LENGTH ) {
			$issues[] = array(
				'type'     => 'title_short',
				'message'  => sprintf(
					/* translators: 1: current length, 2: minimum length */
					__( 'Title is %1$d characters. Ideal length is %2$d-%3$d characters.', 'gravhub-seo' ),
					$title_length,
					self::TITLE_MIN_LENGTH,
					self::TITLE_MAX_LENGTH
				),
				'severity' => 'warning',
			);
			$score   -= 5;
		} elseif ( $title_length > self::TITLE_MAX_LENGTH ) {
			$issues[] = array(
				'type'     => 'title_long',
				'message'  => sprintf(
					/* translators: 1: current length, 2: maximum length */
					__( 'Title is %1$d characters. It may be truncated in search results (ideal max: %2$d).', 'gravhub-seo' ),
					$title_length,
					self::TITLE_MAX_LENGTH
				),
				'severity' => 'warning',
			);
			$score   -= 5;
		}

		// 2. Meta description check.
		$meta_description = get_post_meta( $post->ID, '_gravhub_meta_description', true );

		// Also check Yoast and RankMath meta descriptions as fallback.
		if ( empty( $meta_description ) ) {
			$meta_description = get_post_meta( $post->ID, '_yoast_wpseo_metadesc', true );
		}
		if ( empty( $meta_description ) ) {
			$meta_description = get_post_meta( $post->ID, 'rank_math_description', true );
		}

		if ( empty( $meta_description ) ) {
			$issues[] = array(
				'type'     => 'meta_description_missing',
				'message'  => __( 'Meta description is not set.', 'gravhub-seo' ),
				'severity' => 'error',
			);
			$score   -= 15;
		} else {
			$desc_length = mb_strlen( $meta_description );
			if ( $desc_length < self::META_DESC_MIN_LENGTH ) {
				$issues[] = array(
					'type'     => 'meta_description_short',
					'message'  => sprintf(
						/* translators: 1: current length, 2: minimum length */
						__( 'Meta description is %1$d characters. Recommended minimum is %2$d.', 'gravhub-seo' ),
						$desc_length,
						self::META_DESC_MIN_LENGTH
					),
					'severity' => 'warning',
				);
				$score   -= 5;
			} elseif ( $desc_length > self::META_DESC_MAX_LENGTH ) {
				$issues[] = array(
					'type'     => 'meta_description_long',
					'message'  => sprintf(
						/* translators: 1: current length, 2: maximum length */
						__( 'Meta description is %1$d characters. It may be truncated (ideal max: %2$d).', 'gravhub-seo' ),
						$desc_length,
						self::META_DESC_MAX_LENGTH
					),
					'severity' => 'warning',
				);
				$score   -= 3;
			}
		}

		// 3. H1 tag count check.
		$rendered_content = apply_filters( 'the_content', $content );
		$h1_count         = preg_match_all( '/<h1[\s>]/i', $rendered_content, $matches );

		if ( 0 === $h1_count ) {
			$issues[] = array(
				'type'     => 'h1_missing',
				'message'  => __( 'No H1 tag found in content.', 'gravhub-seo' ),
				'severity' => 'warning',
			);
			$score   -= 10;
		} elseif ( $h1_count > 1 ) {
			$issues[] = array(
				'type'     => 'h1_multiple',
				'message'  => sprintf(
					/* translators: %d: number of H1 tags */
					__( 'Multiple H1 tags found (%d). Use exactly one H1 per page.', 'gravhub-seo' ),
					$h1_count
				),
				'severity' => 'warning',
			);
			$score   -= 5;
		}

		// 4. Image alt text check.
		$img_count    = preg_match_all( '/<img\s[^>]*>/i', $rendered_content, $img_matches );
		$no_alt_count = 0;

		if ( $img_count > 0 ) {
			foreach ( $img_matches[0] as $img_tag ) {
				if ( ! preg_match( '/\salt=["\'][^"\']+["\']/i', $img_tag ) ) {
					$no_alt_count++;
				}
			}

			if ( $no_alt_count > 0 ) {
				$issues[] = array(
					'type'     => 'img_alt_missing',
					'message'  => sprintf(
						/* translators: 1: images without alt, 2: total images */
						__( '%1$d of %2$d images are missing alt text.', 'gravhub-seo' ),
						$no_alt_count,
						$img_count
					),
					'severity' => 'warning',
				);
				$score   -= min( 10, $no_alt_count * 3 );
			}
		}

		// 5. Internal links check.
		$site_host      = wp_parse_url( get_site_url(), PHP_URL_HOST );
		$internal_links = 0;

		if ( preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\']/i', $rendered_content, $link_matches ) ) {
			foreach ( $link_matches[1] as $href ) {
				$link_host = wp_parse_url( $href, PHP_URL_HOST );
				if ( $link_host === $site_host || ( null === $link_host && 0 !== strpos( $href, '#' ) ) ) {
					$internal_links++;
				}
			}
		}

		if ( 0 === $internal_links ) {
			$issues[] = array(
				'type'     => 'no_internal_links',
				'message'  => __( 'No internal links found. Add links to other pages on your site.', 'gravhub-seo' ),
				'severity' => 'warning',
			);
			$score   -= 10;
		}

		// 6. Content length check.
		$stripped_content = wp_strip_all_tags( $rendered_content );
		$word_count       = str_word_count( $stripped_content );

		if ( $word_count < self::MIN_WORD_COUNT ) {
			$issues[] = array(
				'type'     => 'content_thin',
				'message'  => sprintf(
					/* translators: 1: current word count, 2: minimum word count */
					__( 'Content has %1$d words. Aim for at least %2$d words.', 'gravhub-seo' ),
					$word_count,
					self::MIN_WORD_COUNT
				),
				'severity' => 'warning',
			);
			$score   -= 10;
		}

		// 7. URL slug readability check.
		if ( $url_path ) {
			$slug = trim( $url_path, '/' );

			if ( mb_strlen( $slug ) > self::MAX_SLUG_LENGTH ) {
				$issues[] = array(
					'type'     => 'slug_too_long',
					'message'  => sprintf(
						/* translators: 1: current length, 2: max length */
						__( 'URL slug is %1$d characters. Keep it under %2$d for better readability.', 'gravhub-seo' ),
						mb_strlen( $slug ),
						self::MAX_SLUG_LENGTH
					),
					'severity' => 'warning',
				);
				$score   -= 5;
			}

			// Check for number-only segments.
			$segments = explode( '/', $slug );
			foreach ( $segments as $segment ) {
				if ( preg_match( '/^\d+$/', $segment ) ) {
					$issues[] = array(
						'type'     => 'slug_numeric_segment',
						'message'  => sprintf(
							/* translators: %s: the numeric segment */
							__( 'URL contains a numbers-only segment "%s". Use descriptive slugs.', 'gravhub-seo' ),
							$segment
						),
						'severity' => 'warning',
					);
					$score   -= 5;
					break; // Only flag once.
				}
			}
		}

		// Ensure score stays within 0-100.
		$score = max( 0, min( 100, $score ) );

		return array(
			'post_id'   => $post->ID,
			'title'     => $title,
			'url'       => $permalink,
			'type'      => $post->post_type,
			'score'     => $score,
			'issues'    => $issues,
			'word_count' => $word_count,
			'analyzed'  => current_time( 'mysql' ),
		);
	}

	/**
	 * Analyze all published posts and pages.
	 *
	 * @return array Array of analysis results.
	 */
	public function analyze_all_pages() {
		$results = array();

		$posts = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'orderby'        => 'title',
				'order'          => 'ASC',
			)
		);

		foreach ( $posts as $post ) {
			$results[] = $this->analyze_page( $post );
		}

		return $results;
	}
}
