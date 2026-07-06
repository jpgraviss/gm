<?php
/**
 * GravHub SEO admin settings page template.
 *
 * @package GravHub_SEO
 *
 * @var bool  $is_connected       Whether the API is configured.
 * @var int   $last_report_time   Timestamp of last health report.
 * @var int   $last_analysis_time Timestamp of last SEO analysis.
 * @var array $analysis_results   Last analysis results.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap gravhub-seo-wrap">
	<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

	<!-- Connection Settings -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<h2><?php esc_html_e( 'Connection', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<form method="post" action="options.php">
				<?php
				settings_fields( 'gravhub_seo_settings' );
				do_settings_sections( 'gravhub-seo' );
				submit_button( __( 'Save Settings', 'gravhub-seo' ) );
				?>
			</form>
			<div class="gravhub-connection-actions">
				<button type="button" class="button" id="gravhub-test-connection" <?php disabled( ! $is_connected ); ?>>
					<?php esc_html_e( 'Test Connection', 'gravhub-seo' ); ?>
				</button>
				<span id="gravhub-connection-result"></span>
			</div>
		</div>
	</div>

	<!-- Status -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<h2><?php esc_html_e( 'Status', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<table class="gravhub-status-table">
				<tr>
					<th><?php esc_html_e( 'Connection Status', 'gravhub-seo' ); ?></th>
					<td>
						<?php if ( $is_connected ) : ?>
							<span class="gravhub-status-badge gravhub-status-connected">
								<?php esc_html_e( 'Connected', 'gravhub-seo' ); ?>
							</span>
						<?php else : ?>
							<span class="gravhub-status-badge gravhub-status-disconnected">
								<?php esc_html_e( 'Disconnected', 'gravhub-seo' ); ?>
							</span>
						<?php endif; ?>
					</td>
				</tr>
				<tr>
					<th><?php esc_html_e( 'Last Health Report', 'gravhub-seo' ); ?></th>
					<td>
						<?php if ( $last_report_time ) : ?>
							<?php
							echo esc_html(
								sprintf(
									/* translators: %s: human-readable time difference */
									__( '%s ago', 'gravhub-seo' ),
									human_time_diff( $last_report_time, current_time( 'timestamp' ) )
								)
							);
							?>
							<br>
							<small class="description">
								<?php echo esc_html( date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $last_report_time ) ); ?>
							</small>
						<?php else : ?>
							<em><?php esc_html_e( 'Never', 'gravhub-seo' ); ?></em>
						<?php endif; ?>
					</td>
				</tr>
				<tr>
					<th><?php esc_html_e( 'Last SEO Analysis', 'gravhub-seo' ); ?></th>
					<td>
						<?php if ( $last_analysis_time ) : ?>
							<?php
							echo esc_html(
								sprintf(
									/* translators: %s: human-readable time difference */
									__( '%s ago', 'gravhub-seo' ),
									human_time_diff( $last_analysis_time, current_time( 'timestamp' ) )
								)
							);
							?>
							<br>
							<small class="description">
								<?php echo esc_html( date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $last_analysis_time ) ); ?>
							</small>
						<?php else : ?>
							<em><?php esc_html_e( 'Never', 'gravhub-seo' ); ?></em>
						<?php endif; ?>
					</td>
				</tr>
			</table>
			<p>
				<button type="button" class="button" id="gravhub-send-report" <?php disabled( ! $is_connected ); ?>>
					<?php esc_html_e( 'Send Health Report Now', 'gravhub-seo' ); ?>
				</button>
				<span id="gravhub-report-result"></span>
			</p>
		</div>
	</div>

	<!-- SEO Scores -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<h2><?php esc_html_e( 'SEO Scores', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<p>
				<button type="button" class="button button-primary" id="gravhub-run-analysis">
					<?php esc_html_e( 'Run Analysis Now', 'gravhub-seo' ); ?>
				</button>
				<span id="gravhub-analysis-result"></span>
			</p>

			<?php if ( ! empty( $analysis_results ) ) : ?>
				<table class="widefat gravhub-scores-table" id="gravhub-scores-table">
					<thead>
						<tr>
							<th><?php esc_html_e( 'Page', 'gravhub-seo' ); ?></th>
							<th><?php esc_html_e( 'Type', 'gravhub-seo' ); ?></th>
							<th><?php esc_html_e( 'Score', 'gravhub-seo' ); ?></th>
							<th><?php esc_html_e( 'Issues', 'gravhub-seo' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $analysis_results as $result ) : ?>
							<tr>
								<td>
									<a href="<?php echo esc_url( get_edit_post_link( $result['post_id'] ) ); ?>">
										<?php echo esc_html( $result['title'] ); ?>
									</a>
									<br>
									<small class="description"><?php echo esc_html( $result['url'] ); ?></small>
								</td>
								<td><?php echo esc_html( ucfirst( $result['type'] ) ); ?></td>
								<td>
									<?php
									$score_class = 'gravhub-score-red';
									if ( $result['score'] >= 80 ) {
										$score_class = 'gravhub-score-green';
									} elseif ( $result['score'] >= 50 ) {
										$score_class = 'gravhub-score-yellow';
									}
									?>
									<span class="gravhub-score-badge <?php echo esc_attr( $score_class ); ?>">
										<?php echo esc_html( $result['score'] ); ?>
									</span>
								</td>
								<td>
									<?php if ( ! empty( $result['issues'] ) ) : ?>
										<ul class="gravhub-issues-list">
											<?php foreach ( $result['issues'] as $issue ) : ?>
												<li>
													<span class="gravhub-severity-badge gravhub-severity-<?php echo esc_attr( $issue['severity'] ); ?>">
														<?php echo esc_html( ucfirst( $issue['severity'] ) ); ?>
													</span>
													<?php echo esc_html( $issue['message'] ); ?>
												</li>
											<?php endforeach; ?>
										</ul>
									<?php else : ?>
										<span class="gravhub-no-issues"><?php esc_html_e( 'No issues found', 'gravhub-seo' ); ?></span>
									<?php endif; ?>
								</td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php else : ?>
				<p class="description">
					<?php esc_html_e( 'No analysis results yet. Click "Run Analysis Now" to analyze your pages.', 'gravhub-seo' ); ?>
				</p>
			<?php endif; ?>
		</div>
	</div>
</div>

<script>
(function() {
	'use strict';

	var restUrl = <?php echo wp_json_encode( esc_url_raw( rest_url( 'gravhub-seo/v1/' ) ) ); ?>;
	var nonce   = <?php echo wp_json_encode( wp_create_nonce( 'wp_rest' ) ); ?>;

	function apiRequest(endpoint, resultEl, successMsg) {
		resultEl.textContent = '<?php echo esc_js( __( 'Working...', 'gravhub-seo' ) ); ?>';
		resultEl.className = 'gravhub-result-pending';

		fetch(restUrl + endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce
			}
		})
		.then(function(response) { return response.json(); })
		.then(function(data) {
			if (data.success) {
				resultEl.textContent = successMsg || data.message || '<?php echo esc_js( __( 'Success!', 'gravhub-seo' ) ); ?>';
				resultEl.className = 'gravhub-result-success';
				if (endpoint === 'run-analysis') {
					setTimeout(function() { location.reload(); }, 1500);
				}
			} else {
				resultEl.textContent = data.message || '<?php echo esc_js( __( 'An error occurred.', 'gravhub-seo' ) ); ?>';
				resultEl.className = 'gravhub-result-error';
			}
		})
		.catch(function(err) {
			resultEl.textContent = '<?php echo esc_js( __( 'Request failed. Check console for details.', 'gravhub-seo' ) ); ?>';
			resultEl.className = 'gravhub-result-error';
			console.error('GravHub SEO:', err);
		});
	}

	var testBtn = document.getElementById('gravhub-test-connection');
	if (testBtn) {
		testBtn.addEventListener('click', function() {
			apiRequest('test-connection', document.getElementById('gravhub-connection-result'));
		});
	}

	var reportBtn = document.getElementById('gravhub-send-report');
	if (reportBtn) {
		reportBtn.addEventListener('click', function() {
			apiRequest('send-report', document.getElementById('gravhub-report-result'));
		});
	}

	var analysisBtn = document.getElementById('gravhub-run-analysis');
	if (analysisBtn) {
		analysisBtn.addEventListener('click', function() {
			apiRequest(
				'run-analysis',
				document.getElementById('gravhub-analysis-result'),
				'<?php echo esc_js( __( 'Analysis complete! Refreshing...', 'gravhub-seo' ) ); ?>'
			);
		});
	}
})();
</script>
