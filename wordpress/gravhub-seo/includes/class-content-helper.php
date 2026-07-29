<?php
/**
 * GravHub Content Helper.
 *
 * Shared logic for resolving a post's real, analyzable content — used by
 * every part of the plugin that needs to read what a page actually says
 * (SEO scoring, broken-link scanning, internal-link suggestions), rather
 * than each duplicating the same Elementor-detection branch.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class GravHub_Content_Helper
 */
class GravHub_Content_Helper {

	/**
	 * Returns the real rendered content for analysis. Elementor-built pages
	 * store the visual content as JSON in _elementor_data, not post_content
	 * (post_content on those pages is a hidden SEO-text fallback that is
	 * never shown to real visitors) — so for those pages this pulls the
	 * actual builder-rendered HTML instead of running the_content on the
	 * hidden fallback text.
	 *
	 * @param WP_Post $post The post to analyze.
	 * @return string Rendered HTML content.
	 */
	public static function get_analyzable_content( $post ) {
		if ( class_exists( '\Elementor\Plugin' ) ) {
			$document = \Elementor\Plugin::$instance->documents->get( $post->ID );
			if ( $document && $document->is_built_with_elementor() ) {
				return \Elementor\Plugin::$instance->frontend->get_builder_content_for_display( $post->ID );
			}
		}
		return apply_filters( 'the_content', $post->post_content );
	}
}
