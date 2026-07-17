<?php
/**
 * GravHub Internal Linking Suggestions.
 *
 * While editing a post, suggests other published posts/pages worth linking
 * to from it — a plain keyword/title-overlap heuristic (title word overlap,
 * focus-keyword presence), the same class of real, non-fabricated signal
 * GravHub_Redirect_Manager already uses (similar_text() slug matching) for
 * its own suggestions, not an AI/embeddings call.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GravHub_Internal_Linking {

	/**
	 * Max candidate posts/pages scanned per request — keeps an on-demand
	 * suggestion request fast even on a large site, same bound pattern as
	 * GravHub_Redirect_Manager::SUGGESTION_CANDIDATE_LIMIT.
	 *
	 * @var int
	 */
	const MAX_CANDIDATES = 300;

	const MAX_SUGGESTIONS = 8;

	/**
	 * Common English words excluded from title-overlap scoring so two
	 * unrelated posts that both happen to say "with" or "your" don't score
	 * as related.
	 *
	 * @var string[]
	 */
	const STOPWORDS = array(
		'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'you', 'our', 'are', 'was', 'were',
		'have', 'has', 'had', 'will', 'what', 'when', 'where', 'which', 'who', 'why', 'how', 'about',
		'into', 'their', 'them', 'they', 'these', 'those', 'been', 'being', 'more', 'most', 'some',
	);

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
	}

	public function register_rest_routes() {
		register_rest_route(
			'gravhub-seo/v1',
			'/internal-link-suggestions/(?P<post_id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'rest_get_suggestions' ),
				'permission_callback' => function ( $request ) {
					// Anyone who can edit this specific post gets link
					// suggestions while writing — not gated behind
					// manage_gravhub_seo, which is for SEO-config, not
					// day-to-day content editing.
					return current_user_can( 'edit_post', (int) $request['post_id'] );
				},
			)
		);
	}

	public function rest_get_suggestions( $request ) {
		$post_id = (int) $request['post_id'];
		$post    = get_post( $post_id );
		if ( ! $post ) {
			return new WP_REST_Response( array( 'error' => __( 'Not found.', 'gravhub-seo' ) ), 404 );
		}

		$focus_keyword    = trim( (string) get_post_meta( $post_id, '_gravhub_focus_keyword', true ) );
		$title_words      = $this->tokenize( $post->post_title );
		$already_linked   = $this->extract_linked_post_ids( $post->post_content );
		$already_linked[] = $post_id; // Never suggest linking a post to itself.

		$candidates = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => self::MAX_CANDIDATES,
				'orderby'        => 'modified',
				'order'          => 'DESC',
				'exclude'        => $already_linked,
				'no_found_rows'  => true,
			)
		);

		$scored = array();
		foreach ( $candidates as $candidate ) {
			list( $score, $reason ) = $this->score_candidate( $candidate, $title_words, $focus_keyword );
			if ( $score <= 0 ) {
				continue;
			}
			$scored[] = array(
				'post_id' => $candidate->ID,
				'title'   => get_the_title( $candidate ),
				'url'     => get_permalink( $candidate ),
				'score'   => $score,
				'reason'  => $reason,
			);
		}

		usort(
			$scored,
			function ( $a, $b ) {
				return $b['score'] <=> $a['score'];
			}
		);

		return new WP_REST_Response( array_slice( $scored, 0, self::MAX_SUGGESTIONS ), 200 );
	}

	/**
	 * @return array{0: int, 1: string} [score, human-readable reason]
	 */
	private function score_candidate( $candidate, $title_words, $focus_keyword ) {
		$score  = 0;
		$reason = '';

		$candidate_title_words = $this->tokenize( $candidate->post_title );
		$shared_title_words    = array_values( array_intersect( $title_words, $candidate_title_words ) );
		if ( ! empty( $shared_title_words ) ) {
			$score += 10 * count( $shared_title_words );
			$reason = sprintf(
				/* translators: %s: comma-separated shared words */
				__( 'Shares "%s" in the title', 'gravhub-seo' ),
				implode( ', ', $shared_title_words )
			);
		}

		if ( '' !== $focus_keyword ) {
			if ( false !== stripos( $candidate->post_title, $focus_keyword ) ) {
				$score += 15;
				$reason = sprintf(
					/* translators: %s: the focus keyword */
					__( 'Title contains your focus keyword "%s"', 'gravhub-seo' ),
					$focus_keyword
				);
			} elseif ( false !== stripos( wp_strip_all_tags( $candidate->post_content ), $focus_keyword ) ) {
				$score += 5;
				if ( '' === $reason ) {
					$reason = sprintf(
						/* translators: %s: the focus keyword */
						__( 'Mentions your focus keyword "%s"', 'gravhub-seo' ),
						$focus_keyword
					);
				}
			}
		}

		return array( $score, $reason );
	}

	/**
	 * Significant words (4+ letters, common stopwords excluded) from a
	 * string — used to compare titles for overlap.
	 */
	private function tokenize( $text ) {
		$text = strtolower( wp_strip_all_tags( (string) $text ) );
		preg_match_all( '/[a-z0-9]{4,}/', $text, $matches );
		$words = array_unique( $matches[0] );
		return array_values( array_diff( $words, self::STOPWORDS ) );
	}

	/**
	 * Post IDs this post's content already links to, so suggestions never
	 * repeat a link that's already there. Same href-extraction regex
	 * GravHub_SEO_Analyzer and GravHub_Broken_Link_Scanner both already use.
	 */
	private function extract_linked_post_ids( $content ) {
		$ids = array();
		if ( ! preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\']/i', $content, $matches ) ) {
			return $ids;
		}
		foreach ( $matches[1] as $href ) {
			$id = url_to_postid( $href );
			if ( $id ) {
				$ids[] = $id;
			}
		}
		return array_unique( $ids );
	}
}
