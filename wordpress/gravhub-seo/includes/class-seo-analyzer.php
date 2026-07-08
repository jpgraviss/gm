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

		// 8. External links check.
		$external_links = 0;

		if ( preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\']/i', $rendered_content, $ext_link_matches ) ) {
			foreach ( $ext_link_matches[1] as $href ) {
				$link_host = wp_parse_url( $href, PHP_URL_HOST );
				if ( $link_host && $link_host !== $site_host ) {
					$external_links++;
				}
			}
		}

		if ( 0 === $external_links ) {
			$issues[] = array(
				'type'     => 'external_links',
				'message'  => __( 'No external links found. Linking to authoritative sources can improve credibility and SEO.', 'gravhub-seo' ),
				'severity' => 'info',
			);
			$score   -= 2;
		}

		// 9. Text to HTML ratio check.
		$raw_html_length = mb_strlen( $rendered_content );
		$text_length     = mb_strlen( $stripped_content );

		if ( $raw_html_length > 0 ) {
			$text_ratio = ( $text_length / $raw_html_length ) * 100;
			if ( $text_ratio < 10 ) {
				$issues[] = array(
					'type'     => 'text_to_html_ratio',
					'message'  => sprintf(
						/* translators: %s: the ratio percentage */
						__( 'Text-to-HTML ratio is %.1f%%. Aim for at least 10%% for better crawlability.', 'gravhub-seo' ),
						$text_ratio
					),
					'severity' => 'warning',
				);
				$score   -= 5;
			}
		}

		// 10. Consecutive sentences starting with the same word.
		$sentences = preg_split( '/[.!?]+\s+/', $stripped_content, -1, PREG_SPLIT_NO_EMPTY );

		if ( count( $sentences ) >= 3 ) {
			$consecutive_count = 1;
			$flagged           = false;

			for ( $i = 1, $len = count( $sentences ); $i < $len; $i++ ) {
				$prev_first = strtolower( strtok( trim( $sentences[ $i - 1 ] ), ' ' ) );
				$curr_first = strtolower( strtok( trim( $sentences[ $i ] ), ' ' ) );

				if ( $prev_first === $curr_first && '' !== $prev_first ) {
					$consecutive_count++;
					if ( $consecutive_count >= 3 && ! $flagged ) {
						$issues[] = array(
							'type'     => 'consecutive_sentences',
							'message'  => sprintf(
								/* translators: %s: the repeated word */
								__( 'Three or more consecutive sentences start with "%s". Vary your sentence openings for better readability.', 'gravhub-seo' ),
								ucfirst( $curr_first )
							),
							'severity' => 'warning',
						);
						$score  -= 3;
						$flagged = true;
					}
				} else {
					$consecutive_count = 1;
				}
			}
		}

		// 11. Focus keyword analysis.
		$focus_keyword = get_post_meta( $post->ID, '_gravhub_focus_keyword', true );

		if ( ! empty( $focus_keyword ) ) {
			$keyword_checks = $this->analyze_focus_keyword( $post, $focus_keyword );
			foreach ( $keyword_checks as $check ) {
				if ( ! $check['passed'] ) {
					$issues[] = array(
						'type'     => $check['type'],
						'message'  => $check['message'],
						'severity' => $check['severity'],
					);
					if ( 'error' === $check['severity'] ) {
						$score -= 5;
					} elseif ( 'warning' === $check['severity'] ) {
						$score -= 3;
					} else {
						$score -= 1;
					}
				}
			}
		}

		// 12. Readability analysis.
		$readability_checks = $this->analyze_readability( $post );
		$readability_score  = 0;

		foreach ( $readability_checks as $check ) {
			// Capture the Flesch score for the return value.
			if ( 'flesch_reading_ease' === $check['type'] && isset( $check['value'] ) ) {
				$readability_score = $check['value'];
			}

			if ( ! $check['passed'] ) {
				$issues[] = array(
					'type'     => $check['type'],
					'message'  => $check['message'],
					'severity' => $check['severity'],
				);
				if ( 'error' === $check['severity'] ) {
					$score -= 5;
				} elseif ( 'warning' === $check['severity'] ) {
					$score -= 3;
				} else {
					$score -= 1;
				}
			}
		}

		// Ensure score stays within 0-100.
		$score = max( 0, min( 100, $score ) );

		// Save computed score and issues as post meta.
		update_post_meta( $post->ID, '_gravhub_seo_score', $score );
		update_post_meta( $post->ID, '_gravhub_seo_issues', wp_json_encode( $issues ) );

		return array(
			'post_id'           => $post->ID,
			'title'             => $title,
			'url'               => $permalink,
			'type'              => $post->post_type,
			'score'             => $score,
			'issues'            => $issues,
			'word_count'        => $word_count,
			'readability_score' => $readability_score,
			'focus_keyword'     => $focus_keyword,
			'analyzed'          => current_time( 'mysql' ),
		);
	}

	/**
	 * Analyze focus keyword usage throughout a post.
	 *
	 * @param WP_Post $post    The post to analyze.
	 * @param string  $keyword The focus keyword to check for.
	 * @return array Array of check results with type, message, severity, and passed.
	 */
	public function analyze_focus_keyword( $post, $keyword ) {
		$checks   = array();
		$keyword  = trim( $keyword );

		if ( empty( $keyword ) ) {
			return $checks;
		}

		$keyword_lower   = mb_strtolower( $keyword );
		$content         = $post->post_content;
		$rendered        = apply_filters( 'the_content', $content );
		$stripped        = wp_strip_all_tags( $rendered );
		$stripped_lower  = mb_strtolower( $stripped );
		$title_lower     = mb_strtolower( $post->post_title );

		// 1. Keyword in title.
		$in_title = ( false !== mb_strpos( $title_lower, $keyword_lower ) );
		$checks[] = array(
			'type'     => 'keyword_in_title',
			'message'  => $in_title
				? __( 'Focus keyword appears in the title.', 'gravhub-seo' )
				: __( 'Focus keyword does not appear in the title.', 'gravhub-seo' ),
			'severity' => $in_title ? 'ok' : 'error',
			'passed'   => $in_title,
		);

		// 2. Keyword in first paragraph (first 200 characters).
		$first_paragraph = mb_strtolower( mb_substr( $stripped, 0, 200 ) );
		$in_first_para   = ( false !== mb_strpos( $first_paragraph, $keyword_lower ) );
		$checks[]        = array(
			'type'     => 'keyword_in_first_paragraph',
			'message'  => $in_first_para
				? __( 'Focus keyword appears in the first paragraph.', 'gravhub-seo' )
				: __( 'Focus keyword does not appear in the first paragraph. Include it early in your content.', 'gravhub-seo' ),
			'severity' => $in_first_para ? 'ok' : 'warning',
			'passed'   => $in_first_para,
		);

		// 3. Keyword in URL slug.
		$permalink    = get_permalink( $post );
		$url_path     = wp_parse_url( $permalink, PHP_URL_PATH );
		$slug         = $url_path ? trim( $url_path, '/' ) : '';
		$keyword_slug = sanitize_title( $keyword );
		$in_url       = ( false !== strpos( $slug, $keyword_slug ) );
		$checks[]     = array(
			'type'     => 'keyword_in_url',
			'message'  => $in_url
				? __( 'Focus keyword appears in the URL.', 'gravhub-seo' )
				: __( 'Focus keyword does not appear in the URL slug.', 'gravhub-seo' ),
			'severity' => $in_url ? 'ok' : 'warning',
			'passed'   => $in_url,
		);

		// 4. Keyword in meta description.
		$meta_desc       = get_post_meta( $post->ID, '_gravhub_meta_description', true );
		$in_meta_desc    = false;

		if ( ! empty( $meta_desc ) ) {
			$in_meta_desc = ( false !== mb_strpos( mb_strtolower( $meta_desc ), $keyword_lower ) );
		}

		$checks[] = array(
			'type'     => 'keyword_in_meta_description',
			'message'  => $in_meta_desc
				? __( 'Focus keyword appears in the meta description.', 'gravhub-seo' )
				: __( 'Focus keyword does not appear in the meta description.', 'gravhub-seo' ),
			'severity' => $in_meta_desc ? 'ok' : 'warning',
			'passed'   => $in_meta_desc,
		);

		// 5. Keyword in subheadings (H2/H3).
		$in_subheading = false;

		if ( preg_match_all( '/<h[23][^>]*>(.*?)<\/h[23]>/is', $rendered, $heading_matches ) ) {
			foreach ( $heading_matches[1] as $heading_text ) {
				$heading_clean = mb_strtolower( wp_strip_all_tags( $heading_text ) );
				if ( false !== mb_strpos( $heading_clean, $keyword_lower ) ) {
					$in_subheading = true;
					break;
				}
			}
		}

		$checks[] = array(
			'type'     => 'keyword_in_subheading',
			'message'  => $in_subheading
				? __( 'Focus keyword appears in a subheading.', 'gravhub-seo' )
				: __( 'Focus keyword does not appear in any H2 or H3 subheading.', 'gravhub-seo' ),
			'severity' => $in_subheading ? 'ok' : 'warning',
			'passed'   => $in_subheading,
		);

		// 6. Keyword density.
		$total_words     = str_word_count( $stripped );
		$keyword_words   = str_word_count( $keyword );
		$keyword_count   = mb_substr_count( $stripped_lower, $keyword_lower );
		$density         = ( $total_words > 0 ) ? ( $keyword_count * $keyword_words / $total_words ) * 100 : 0;
		$density_rounded = round( $density, 2 );
		$density_ok      = ( $density >= 0.5 && $density <= 3 );
		$density_message = '';

		if ( $density < 0.5 ) {
			$density_message = sprintf(
				/* translators: %s: the density percentage */
				__( 'Keyword density is %s%%. This is too low; aim for 1-3%%.', 'gravhub-seo' ),
				$density_rounded
			);
		} elseif ( $density > 3 ) {
			$density_message = sprintf(
				/* translators: %s: the density percentage */
				__( 'Keyword density is %s%%. This may be considered keyword stuffing; aim for 1-3%%.', 'gravhub-seo' ),
				$density_rounded
			);
		} else {
			$density_message = sprintf(
				/* translators: %s: the density percentage */
				__( 'Keyword density is %s%%. This is within the ideal range.', 'gravhub-seo' ),
				$density_rounded
			);
		}

		$checks[] = array(
			'type'     => 'keyword_density',
			'message'  => $density_message,
			'severity' => $density_ok ? 'ok' : 'warning',
			'passed'   => $density_ok,
		);

		// 7. Keyword in image alt text.
		$in_img_alt = false;

		if ( preg_match_all( '/<img\s[^>]*alt=["\']([^"\']*)["\'][^>]*>/i', $rendered, $alt_matches ) ) {
			foreach ( $alt_matches[1] as $alt_text ) {
				if ( false !== mb_strpos( mb_strtolower( $alt_text ), $keyword_lower ) ) {
					$in_img_alt = true;
					break;
				}
			}
		}

		$checks[] = array(
			'type'     => 'keyword_in_image_alt',
			'message'  => $in_img_alt
				? __( 'Focus keyword appears in image alt text.', 'gravhub-seo' )
				: __( 'Focus keyword does not appear in any image alt text.', 'gravhub-seo' ),
			'severity' => $in_img_alt ? 'ok' : 'info',
			'passed'   => $in_img_alt,
		);

		return $checks;
	}

	/**
	 * Analyze readability of a post's content.
	 *
	 * @param WP_Post $post The post to analyze.
	 * @return array Array of readability check results.
	 */
	public function analyze_readability( $post ) {
		$checks          = array();
		$content         = $post->post_content;
		$rendered        = apply_filters( 'the_content', $content );
		$stripped        = wp_strip_all_tags( $rendered );
		$stripped        = trim( $stripped );

		if ( empty( $stripped ) ) {
			return $checks;
		}

		// Split into sentences.
		$sentences       = preg_split( '/[.!?]+(?:\s|$)/', $stripped, -1, PREG_SPLIT_NO_EMPTY );
		$sentences       = array_filter( array_map( 'trim', $sentences ) );
		$total_sentences = count( $sentences );

		if ( 0 === $total_sentences ) {
			return $checks;
		}

		// Count total words and syllables.
		$words           = preg_split( '/\s+/', $stripped, -1, PREG_SPLIT_NO_EMPTY );
		$total_words     = count( $words );
		$total_syllables = 0;

		foreach ( $words as $word ) {
			$total_syllables += $this->count_syllables( $word );
		}

		// 1. Flesch Reading Ease.
		$flesch = 206.835
			- 1.015 * ( $total_words / $total_sentences )
			- 84.6 * ( $total_syllables / $total_words );
		$flesch = round( $flesch, 1 );

		$flesch_ok      = ( $flesch >= 60 && $flesch <= 70 );
		$flesch_message = '';

		if ( $flesch < 30 ) {
			$flesch_message = sprintf(
				/* translators: %s: Flesch score */
				__( 'Flesch Reading Ease score is %s (very difficult). Aim for 60-70 for web content.', 'gravhub-seo' ),
				$flesch
			);
			$flesch_severity = 'error';
		} elseif ( $flesch < 60 ) {
			$flesch_message = sprintf(
				/* translators: %s: Flesch score */
				__( 'Flesch Reading Ease score is %s (somewhat difficult). Aim for 60-70 for web content.', 'gravhub-seo' ),
				$flesch
			);
			$flesch_severity = 'warning';
		} elseif ( $flesch > 80 ) {
			$flesch_message = sprintf(
				/* translators: %s: Flesch score */
				__( 'Flesch Reading Ease score is %s (very easy). Content may lack depth for your audience.', 'gravhub-seo' ),
				$flesch
			);
			$flesch_severity = 'info';
			$flesch_ok       = true; // Not a failure, just informational.
		} else {
			$flesch_message = sprintf(
				/* translators: %s: Flesch score */
				__( 'Flesch Reading Ease score is %s. Good readability for web content.', 'gravhub-seo' ),
				$flesch
			);
			$flesch_severity = 'ok';
			$flesch_ok       = true;
		}

		$checks[] = array(
			'type'     => 'flesch_reading_ease',
			'message'  => $flesch_message,
			'severity' => $flesch_severity,
			'passed'   => $flesch_ok,
			'value'    => $flesch,
		);

		// 2. Average sentence length.
		$avg_sentence_length = $total_words / $total_sentences;
		$avg_sentence_length = round( $avg_sentence_length, 1 );
		$sentence_ok         = ( $avg_sentence_length <= 20 );

		$checks[] = array(
			'type'     => 'sentence_length',
			'message'  => $sentence_ok
				? sprintf(
					/* translators: %s: average sentence length */
					__( 'Average sentence length is %s words. Good.', 'gravhub-seo' ),
					$avg_sentence_length
				)
				: sprintf(
					/* translators: %s: average sentence length */
					__( 'Average sentence length is %s words. Try to keep sentences under 20 words on average.', 'gravhub-seo' ),
					$avg_sentence_length
				),
			'severity' => $sentence_ok ? 'ok' : 'warning',
			'passed'   => $sentence_ok,
		);

		// 3. Paragraph length check.
		$paragraphs        = preg_split( '/\n\s*\n|<\/p>\s*<p|<br\s*\/?>\s*<br\s*\/?>/i', $rendered );
		$long_paragraphs   = 0;

		foreach ( $paragraphs as $paragraph ) {
			$para_text  = wp_strip_all_tags( $paragraph );
			$para_words = str_word_count( $para_text );
			if ( $para_words > 150 ) {
				$long_paragraphs++;
			}
		}

		$paragraph_ok = ( 0 === $long_paragraphs );
		$checks[]     = array(
			'type'     => 'paragraph_length',
			'message'  => $paragraph_ok
				? __( 'All paragraphs are a reasonable length.', 'gravhub-seo' )
				: sprintf(
					/* translators: %d: number of long paragraphs */
					_n(
						'%d paragraph exceeds 150 words. Break long paragraphs into shorter ones for better readability.',
						'%d paragraphs exceed 150 words. Break long paragraphs into shorter ones for better readability.',
						$long_paragraphs,
						'gravhub-seo'
					),
					$long_paragraphs
				),
			'severity' => $paragraph_ok ? 'ok' : 'warning',
			'passed'   => $paragraph_ok,
		);

		// 4. Subheading distribution — flag sections > 300 words without a subheading.
		$content_parts = preg_split( '/<h[2-4][^>]*>/i', $rendered );
		$long_sections = 0;

		foreach ( $content_parts as $part ) {
			$section_text  = wp_strip_all_tags( $part );
			$section_words = str_word_count( $section_text );
			if ( $section_words > 300 ) {
				$long_sections++;
			}
		}

		$subheading_ok = ( 0 === $long_sections );
		$checks[]      = array(
			'type'     => 'subheading_distribution',
			'message'  => $subheading_ok
				? __( 'Content is well structured with subheadings.', 'gravhub-seo' )
				: sprintf(
					/* translators: %d: number of long sections */
					_n(
						'%d section has more than 300 words without a subheading. Add H2-H4 headings to break up long sections.',
						'%d sections have more than 300 words without a subheading. Add H2-H4 headings to break up long sections.',
						$long_sections,
						'gravhub-seo'
					),
					$long_sections
				),
			'severity' => $subheading_ok ? 'ok' : 'warning',
			'passed'   => $subheading_ok,
		);

		// 5. Passive voice estimation.
		$passive_count = 0;

		foreach ( $sentences as $sentence ) {
			// Match common passive voice patterns: was/were/been/being/is/are/am + past participle.
			if ( preg_match( '/\b(?:is|are|am|was|were|been|being|be)\s+\w+(?:ed|en|t)\b/i', $sentence ) ) {
				$passive_count++;
			}
		}

		$passive_percent = ( $total_sentences > 0 ) ? round( ( $passive_count / $total_sentences ) * 100, 1 ) : 0;
		$passive_ok      = ( $passive_percent <= 10 );

		$checks[] = array(
			'type'     => 'passive_voice',
			'message'  => $passive_ok
				? sprintf(
					/* translators: %s: passive voice percentage */
					__( 'Passive voice is used in %s%% of sentences. Good.', 'gravhub-seo' ),
					$passive_percent
				)
				: sprintf(
					/* translators: %s: passive voice percentage */
					__( 'Passive voice is used in %s%% of sentences. Try to keep it under 10%%.', 'gravhub-seo' ),
					$passive_percent
				),
			'severity' => $passive_ok ? 'ok' : 'warning',
			'passed'   => $passive_ok,
		);

		// 6. Transition words check.
		$transition_words = array(
			'however', 'therefore', 'furthermore', 'additionally', 'moreover',
			'consequently', 'nevertheless', 'meanwhile', 'similarly', 'likewise',
			'in addition', 'as a result', 'for example', 'for instance', 'in contrast',
			'on the other hand', 'in conclusion', 'to summarize', 'in other words',
			'specifically', 'in fact', 'of course', 'undoubtedly', 'indeed',
			'above all', 'first', 'second', 'third', 'finally', 'next', 'then',
			'also', 'besides', 'equally', 'hence', 'thus', 'accordingly',
			'although', 'even though', 'whereas', 'while', 'despite', 'instead',
			'rather', 'yet', 'still', 'otherwise', 'after all', 'in particular',
			'notably', 'especially', 'significantly', 'importantly', 'primarily',
		);

		$sentences_with_transition = 0;

		foreach ( $sentences as $sentence ) {
			$sentence_lower = mb_strtolower( $sentence );
			foreach ( $transition_words as $tw ) {
				if ( false !== mb_strpos( $sentence_lower, $tw ) ) {
					$sentences_with_transition++;
					break;
				}
			}
		}

		$transition_percent = ( $total_sentences > 0 ) ? round( ( $sentences_with_transition / $total_sentences ) * 100, 1 ) : 0;
		$transition_ok      = ( $transition_percent >= 20 );

		$checks[] = array(
			'type'     => 'transition_words',
			'message'  => $transition_ok
				? sprintf(
					/* translators: %s: transition word percentage */
					__( '%s%% of sentences contain transition words. Good.', 'gravhub-seo' ),
					$transition_percent
				)
				: sprintf(
					/* translators: %s: transition word percentage */
					__( 'Only %s%% of sentences contain transition words. Use more transitions (however, therefore, furthermore, etc.) for better flow. Aim for at least 20%%.', 'gravhub-seo' ),
					$transition_percent
				),
			'severity' => $transition_ok ? 'ok' : 'warning',
			'passed'   => $transition_ok,
		);

		return $checks;
	}

	/**
	 * Count the number of syllables in an English word.
	 *
	 * Uses a simple heuristic: count vowel groups, subtract silent-e, minimum 1.
	 *
	 * @param string $word The word to count syllables for.
	 * @return int The estimated syllable count.
	 */
	public function count_syllables( $word ) {
		$word = strtolower( trim( $word ) );
		$word = preg_replace( '/[^a-z]/', '', $word );

		if ( empty( $word ) ) {
			return 1;
		}

		// Count vowel groups (a, e, i, o, u, y).
		$count = preg_match_all( '/[aeiouy]+/', $word, $matches );

		// Subtract silent-e at end of word.
		if ( preg_match( '/[^aeiouy]e$/', $word ) ) {
			$count--;
		}

		// Ensure minimum of 1 syllable.
		return max( 1, $count );
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
