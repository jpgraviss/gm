<?php
/**
 * GravHub API Client.
 *
 * Handles communication with the GravHub platform API.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class GravHub_API_Client
 */
class GravHub_API_Client {

	/**
	 * Option name for the API key.
	 *
	 * @var string
	 */
	const OPTION_API_KEY = 'gravhub_api_key';

	/**
	 * Option name for the GravHub URL.
	 *
	 * @var string
	 */
	const OPTION_API_URL = 'gravhub_api_url';

	/**
	 * Transient name for cached SEO settings.
	 *
	 * @var string
	 */
	const TRANSIENT_SEO_SETTINGS = 'gravhub_seo_settings_cache';

	/**
	 * Cache duration in seconds (6 hours).
	 *
	 * @var int
	 */
	const CACHE_DURATION = 21600;

	/**
	 * Transient name for cached dashboard traffic analytics.
	 *
	 * @var string
	 */
	const TRANSIENT_DASHBOARD_ANALYTICS = 'gravhub_dashboard_analytics_cache';

	/**
	 * Transient name for cached dashboard keyword summary.
	 *
	 * @var string
	 */
	const TRANSIENT_DASHBOARD_KEYWORDS = 'gravhub_dashboard_keywords_cache';

	/**
	 * Dashboard cache duration in seconds (15 minutes) — much shorter than
	 * CACHE_DURATION since this is live traffic/keyword data meant to feel
	 * current on the dashboard, not slow-changing meta configuration.
	 *
	 * @var int
	 */
	const DASHBOARD_CACHE_DURATION = 900;

	/**
	 * Request timeout in seconds.
	 *
	 * @var int
	 */
	const REQUEST_TIMEOUT = 30;

	/**
	 * Get the stored API key.
	 *
	 * @return string
	 */
	public function get_api_key() {
		return get_option( self::OPTION_API_KEY, '' );
	}

	/**
	 * Get the stored GravHub URL.
	 *
	 * @return string
	 */
	public function get_api_url() {
		return untrailingslashit( get_option( self::OPTION_API_URL, '' ) );
	}

	/**
	 * Check if the client is configured.
	 *
	 * @return bool
	 */
	public function is_configured() {
		return ! empty( $this->get_api_key() ) && ! empty( $this->get_api_url() );
	}

	/**
	 * Build request headers.
	 *
	 * @return array
	 */
	private function get_headers() {
		return array(
			'Content-Type'  => 'application/json',
			'X-GravHub-Key' => $this->get_api_key(),
		);
	}

	/**
	 * Send a health report to GravHub.
	 *
	 * @param array $data Health report data.
	 * @return array|WP_Error Response body or error.
	 */
	public function send_health_report( $data ) {
		if ( ! $this->is_configured() ) {
			return new WP_Error( 'gravhub_not_configured', __( 'GravHub API is not configured.', 'gravhub-seo' ) );
		}

		$url = $this->get_api_url() . '/api/wordpress/seo/health';

		$response = wp_remote_post(
			$url,
			array(
				'headers' => $this->get_headers(),
				'body'    => wp_json_encode( $data ),
				'timeout' => self::REQUEST_TIMEOUT,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error(
				'gravhub_api_error',
				sprintf(
					/* translators: %d: HTTP status code */
					__( 'GravHub API returned HTTP %d.', 'gravhub-seo' ),
					$code
				)
			);
		}

		$body = wp_remote_retrieve_body( $response );

		return json_decode( $body, true );
	}

	/**
	 * Get SEO settings from GravHub.
	 *
	 * Results are cached as a transient for 6 hours.
	 *
	 * @param bool $force_refresh Whether to bypass the cache.
	 * @return array|WP_Error Settings array or error.
	 */
	public function get_seo_settings( $force_refresh = false ) {
		if ( ! $this->is_configured() ) {
			return new WP_Error( 'gravhub_not_configured', __( 'GravHub API is not configured.', 'gravhub-seo' ) );
		}

		// Check transient cache.
		if ( ! $force_refresh ) {
			$cached = get_transient( self::TRANSIENT_SEO_SETTINGS );
			if ( false !== $cached ) {
				return $cached;
			}
		}

		$site_url = rawurlencode( get_site_url() );
		$url      = $this->get_api_url() . '/api/wordpress/seo/settings?site=' . $site_url;

		$response = wp_remote_get(
			$url,
			array(
				'headers' => $this->get_headers(),
				'timeout' => self::REQUEST_TIMEOUT,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error(
				'gravhub_api_error',
				sprintf(
					/* translators: %d: HTTP status code */
					__( 'GravHub API returned HTTP %d.', 'gravhub-seo' ),
					$code
				)
			);
		}

		$body     = wp_remote_retrieve_body( $response );
		$settings = json_decode( $body, true );

		if ( null === $settings ) {
			return new WP_Error( 'gravhub_invalid_response', __( 'Invalid JSON response from GravHub.', 'gravhub-seo' ) );
		}

		// Cache for 6 hours.
		set_transient( self::TRANSIENT_SEO_SETTINGS, $settings, self::CACHE_DURATION );

		return $settings;
	}

	/**
	 * Get traffic analytics (GA4 + GSC) for this site's dashboard.
	 *
	 * Results are cached as a transient for 15 minutes.
	 *
	 * @param bool $force_refresh Whether to bypass the cache.
	 * @return array|WP_Error Analytics payload or error.
	 */
	public function get_dashboard_analytics( $force_refresh = false ) {
		if ( ! $this->is_configured() ) {
			return new WP_Error( 'gravhub_not_configured', __( 'GravHub API is not configured.', 'gravhub-seo' ) );
		}

		if ( ! $force_refresh ) {
			$cached = get_transient( self::TRANSIENT_DASHBOARD_ANALYTICS );
			if ( false !== $cached ) {
				return $cached;
			}
		}

		$site_url = rawurlencode( get_site_url() );
		$url      = $this->get_api_url() . '/api/wordpress/seo/analytics?site=' . $site_url;

		$response = wp_remote_get(
			$url,
			array(
				'headers' => $this->get_headers(),
				'timeout' => self::REQUEST_TIMEOUT,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error(
				'gravhub_api_error',
				sprintf(
					/* translators: %d: HTTP status code */
					__( 'GravHub API returned HTTP %d.', 'gravhub-seo' ),
					$code
				)
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( null === $data ) {
			return new WP_Error( 'gravhub_invalid_response', __( 'Invalid JSON response from GravHub.', 'gravhub-seo' ) );
		}

		set_transient( self::TRANSIENT_DASHBOARD_ANALYTICS, $data, self::DASHBOARD_CACHE_DURATION );

		return $data;
	}

	/**
	 * Get keyword position summary for this site's dashboard.
	 *
	 * Results are cached as a transient for 15 minutes.
	 *
	 * @param bool $force_refresh Whether to bypass the cache.
	 * @return array|WP_Error Keyword payload or error.
	 */
	public function get_dashboard_keywords( $force_refresh = false ) {
		if ( ! $this->is_configured() ) {
			return new WP_Error( 'gravhub_not_configured', __( 'GravHub API is not configured.', 'gravhub-seo' ) );
		}

		if ( ! $force_refresh ) {
			$cached = get_transient( self::TRANSIENT_DASHBOARD_KEYWORDS );
			if ( false !== $cached ) {
				return $cached;
			}
		}

		$site_url = rawurlencode( get_site_url() );
		$url      = $this->get_api_url() . '/api/wordpress/seo/keywords?site=' . $site_url;

		$response = wp_remote_get(
			$url,
			array(
				'headers' => $this->get_headers(),
				'timeout' => self::REQUEST_TIMEOUT,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error(
				'gravhub_api_error',
				sprintf(
					/* translators: %d: HTTP status code */
					__( 'GravHub API returned HTTP %d.', 'gravhub-seo' ),
					$code
				)
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( null === $data ) {
			return new WP_Error( 'gravhub_invalid_response', __( 'Invalid JSON response from GravHub.', 'gravhub-seo' ) );
		}

		set_transient( self::TRANSIENT_DASHBOARD_KEYWORDS, $data, self::DASHBOARD_CACHE_DURATION );

		return $data;
	}

	/**
	 * Send SEO scores to GravHub.
	 *
	 * @param array $pages Array of page analysis results.
	 * @return array|WP_Error Response body or error.
	 */
	public function send_scores( $pages ) {
		if ( ! $this->is_configured() ) {
			return new WP_Error( 'gravhub_not_configured', __( 'GravHub API is not configured.', 'gravhub-seo' ) );
		}

		$url = $this->get_api_url() . '/api/wordpress/seo/scores';

		$response = wp_remote_post(
			$url,
			array(
				'headers' => $this->get_headers(),
				'body'    => wp_json_encode(
					array(
						'site_url' => get_site_url(),
						'pages'    => $pages,
					)
				),
				'timeout' => self::REQUEST_TIMEOUT,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error(
				'gravhub_api_error',
				sprintf(
					/* translators: %d: HTTP status code */
					__( 'GravHub API returned HTTP %d.', 'gravhub-seo' ),
					$code
				)
			);
		}

		$body = wp_remote_retrieve_body( $response );

		return json_decode( $body, true );
	}
}
