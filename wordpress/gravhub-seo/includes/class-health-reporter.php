<?php
/**
 * GravHub Health Reporter.
 *
 * Collects site health data and sends reports to GravHub.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class GravHub_Health_Reporter
 */
class GravHub_Health_Reporter {

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
	 * Collect all health data for the site.
	 *
	 * @return array Health data payload.
	 */
	public function collect_health_data() {
		return array(
			'site_url'        => get_site_url(),
			'site_name'       => get_bloginfo( 'name' ),
			'collected_at'    => current_time( 'c' ),
			'wordpress'       => $this->get_wordpress_info(),
			'php'             => $this->get_php_info(),
			'active_plugins'  => $this->get_plugins_info(),
			'active_theme'    => $this->get_theme_info(),
			'security'        => $this->get_security_checks(),
			'sitemap'         => $this->get_sitemap_status(),
		);
	}

	/**
	 * Send the health report to GravHub.
	 *
	 * @return array|WP_Error API response or error.
	 */
	public function send_report() {
		$data   = $this->collect_health_data();
		$result = $this->api_client->send_health_report( $data );

		if ( ! is_wp_error( $result ) ) {
			update_option( 'gravhub_last_health_report', time() );
		}

		return $result;
	}

	/**
	 * Get WordPress version info.
	 *
	 * @return array
	 */
	private function get_wordpress_info() {
		global $wp_version;

		return array(
			'version' => $wp_version,
			'locale'  => get_locale(),
			'is_multisite' => is_multisite(),
		);
	}

	/**
	 * Get PHP version info.
	 *
	 * @return array
	 */
	private function get_php_info() {
		return array(
			'version'      => phpversion(),
			'memory_limit' => ini_get( 'memory_limit' ),
			'max_execution_time' => ini_get( 'max_execution_time' ),
		);
	}

	/**
	 * Get active plugins with version and update availability.
	 *
	 * @return array
	 */
	private function get_plugins_info() {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all_plugins    = get_plugins();
		$active_plugins = get_option( 'active_plugins', array() );
		$update_plugins = get_site_transient( 'update_plugins' );
		$plugins_info   = array();

		foreach ( $active_plugins as $plugin_file ) {
			if ( ! isset( $all_plugins[ $plugin_file ] ) ) {
				continue;
			}

			$plugin_data = $all_plugins[ $plugin_file ];
			$has_update  = false;

			if ( $update_plugins && isset( $update_plugins->response[ $plugin_file ] ) ) {
				$has_update = true;
			}

			$plugins_info[] = array(
				'name'            => $plugin_data['Name'],
				'version'         => $plugin_data['Version'],
				'update_available' => $has_update,
				'plugin_file'     => $plugin_file,
			);
		}

		return $plugins_info;
	}

	/**
	 * Get active theme info.
	 *
	 * @return array
	 */
	private function get_theme_info() {
		$theme         = wp_get_theme();
		$update_themes = get_site_transient( 'update_themes' );
		$has_update    = false;

		if ( $update_themes && isset( $update_themes->response[ $theme->get_stylesheet() ] ) ) {
			$has_update = true;
		}

		return array(
			'name'             => $theme->get( 'Name' ),
			'version'          => $theme->get( 'Version' ),
			'parent_theme'     => $theme->parent() ? $theme->parent()->get( 'Name' ) : null,
			'update_available' => $has_update,
		);
	}

	/**
	 * Run security checks.
	 *
	 * @return array
	 */
	private function get_security_checks() {
		return array(
			'wp_login_exposed' => $this->check_wp_login_exposed(),
			'xmlrpc_enabled'   => $this->check_xmlrpc_enabled(),
			'directory_listing_enabled' => $this->check_directory_listing(),
		);
	}

	/**
	 * Check if wp-login.php is exposed (not protected/hidden).
	 *
	 * @return bool
	 */
	private function check_wp_login_exposed() {
		$login_url = wp_login_url();
		$response  = wp_remote_head(
			$login_url,
			array(
				'timeout'     => 10,
				'redirection' => 0,
				'sslverify'   => false,
			)
		);

		if ( is_wp_error( $response ) ) {
			return false; // Can't determine, assume not exposed.
		}

		$code = wp_remote_retrieve_response_code( $response );

		// If login page returns 200, it's exposed.
		return 200 === $code;
	}

	/**
	 * Check if XML-RPC is enabled.
	 *
	 * @return bool
	 */
	private function check_xmlrpc_enabled() {
		$xmlrpc_url = site_url( '/xmlrpc.php' );
		$response   = wp_remote_head(
			$xmlrpc_url,
			array(
				'timeout'     => 10,
				'redirection' => 0,
				'sslverify'   => false,
			)
		);

		if ( is_wp_error( $response ) ) {
			return false;
		}

		$code = wp_remote_retrieve_response_code( $response );

		// If xmlrpc.php returns 200 or 405, it exists and is accessible.
		return in_array( $code, array( 200, 405 ), true );
	}

	/**
	 * Check if directory listing is enabled.
	 *
	 * @return bool
	 */
	private function check_directory_listing() {
		$uploads_dir = wp_get_upload_dir();
		$response    = wp_remote_get(
			$uploads_dir['baseurl'] . '/',
			array(
				'timeout'     => 10,
				'redirection' => 0,
				'sslverify'   => false,
			)
		);

		if ( is_wp_error( $response ) ) {
			return false;
		}

		$body = wp_remote_retrieve_body( $response );

		// Directory listings typically contain "Index of" or similar.
		return (bool) preg_match( '/<title>Index of/i', $body );
	}

	/**
	 * Check sitemap availability.
	 *
	 * @return array
	 */
	private function get_sitemap_status() {
		$sitemaps = array(
			'xml_sitemap'    => '/sitemap.xml',
			'wp_sitemap'     => '/wp-sitemap.xml',
		);

		$status = array();

		foreach ( $sitemaps as $key => $path ) {
			$url      = site_url( $path );
			$response = wp_remote_head(
				$url,
				array(
					'timeout'     => 10,
					'redirection' => 3,
					'sslverify'   => false,
				)
			);

			if ( is_wp_error( $response ) ) {
				$status[ $key ] = false;
				continue;
			}

			$code          = wp_remote_retrieve_response_code( $response );
			$status[ $key ] = ( $code >= 200 && $code < 400 );
		}

		$status['has_sitemap'] = $status['xml_sitemap'] || $status['wp_sitemap'];

		return $status;
	}
}
