<?php
/**
 * GravHub SEO admin settings page template.
 *
 * @package GravHub_SEO
 *
 * @var bool   $is_connected         Whether the API is configured.
 * @var int    $last_report_time     Timestamp of last health report.
 * @var int    $last_analysis_time   Timestamp of last SEO analysis.
 * @var array  $analysis_results     Last analysis results.
 * @var int    $total_pages          Total pages analyzed.
 * @var int    $total_issues         Total issues found.
 * @var int    $average_score        Average SEO score.
 * @var array  $score_distribution   Score distribution (green, yellow, red counts).
 * @var bool   $sitemap_enabled      Whether sitemap is enabled.
 * @var array  $sitemap_post_types   Enabled sitemap post types.
 * @var array  $module_states        Module toggle states.
 * @var array  $modules              Full module catalog (toggleable + navigational).
 * @var array  $notifications        Notification feed items (type, message, link).
 * @var int    $redirect_count       Count of configured redirects.
 * @var int    $count_404            Count of distinct logged 404 paths.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap gravhub-seo-wrap">
	<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

	<!-- Header -->
	<div class="gravhub-header">
		<div class="gravhub-header-inner">
			<div class="gravhub-logo">
				<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="2" y="18" width="6" height="12" rx="1.5" fill="rgba(255,255,255,0.6)"/>
					<rect x="10" y="12" width="6" height="18" rx="1.5" fill="rgba(255,255,255,0.8)"/>
					<rect x="18" y="6" width="6" height="24" rx="1.5" fill="white"/>
					<circle cx="24" cy="6" r="5" stroke="white" stroke-width="2" fill="none"/>
					<line x1="27.5" y1="9.5" x2="30.5" y2="12.5" stroke="white" stroke-width="2" stroke-linecap="round"/>
				</svg>
				<span><?php esc_html_e( 'GravHub SEO', 'gravhub-seo' ); ?></span>
			</div>
			<span class="gravhub-version-badge">v<?php echo esc_html( GRAVHUB_SEO_VERSION ); ?></span>
		</div>
	</div>

	<!-- Dashboard Stats -->
	<div class="gravhub-stats-grid">
		<!-- Overall Score -->
		<div class="gravhub-stat-card gravhub-stat-card--score">
			<div class="gravhub-stat-label"><?php esc_html_e( 'Overall Score', 'gravhub-seo' ); ?></div>
			<?php
			$score_color_class = 'red';
			if ( $average_score >= 80 ) {
				$score_color_class = 'green';
			} elseif ( $average_score >= 50 ) {
				$score_color_class = 'amber';
			}
			$circumference = 2 * 3.14159 * 52;
			$offset        = $circumference - ( $average_score / 100 ) * $circumference;
			?>
			<div class="gravhub-score-circle gravhub-score-circle--lg">
				<svg width="120" height="120" viewBox="0 0 120 120">
					<circle class="score-track" cx="60" cy="60" r="52" stroke-width="8"/>
					<circle class="score-fill score-fill--<?php echo esc_attr( $score_color_class ); ?>" cx="60" cy="60" r="52" stroke-width="8"
						stroke-dasharray="<?php echo esc_attr( round( $circumference, 2 ) ); ?>"
						stroke-dashoffset="<?php echo esc_attr( round( $offset, 2 ) ); ?>"/>
				</svg>
				<span class="gravhub-score-number"><?php echo esc_html( $average_score ); ?></span>
			</div>
		</div>

		<!-- Pages Analyzed -->
		<div class="gravhub-stat-card">
			<div class="gravhub-stat-icon gravhub-stat-icon--blue">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
					<polyline points="14 2 14 8 20 8"/>
					<line x1="16" y1="13" x2="8" y2="13"/>
					<line x1="16" y1="17" x2="8" y2="17"/>
					<polyline points="10 9 9 9 8 9"/>
				</svg>
			</div>
			<div class="gravhub-stat-content">
				<div class="gravhub-stat-label"><?php esc_html_e( 'Pages Analyzed', 'gravhub-seo' ); ?></div>
				<div class="gravhub-stat-value"><?php echo esc_html( $total_pages ); ?></div>
			</div>
		</div>

		<!-- Issues Found -->
		<div class="gravhub-stat-card">
			<div class="gravhub-stat-icon gravhub-stat-icon--amber">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="8" x2="12" y2="12"/>
					<line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
			</div>
			<div class="gravhub-stat-content">
				<div class="gravhub-stat-label"><?php esc_html_e( 'Issues Found', 'gravhub-seo' ); ?></div>
				<div class="gravhub-stat-value"><?php echo esc_html( $total_issues ); ?></div>
			</div>
		</div>

		<!-- Last Sync -->
		<div class="gravhub-stat-card">
			<div class="gravhub-stat-icon gravhub-stat-icon--green">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="23 4 23 10 17 10"/>
					<polyline points="1 20 1 14 7 14"/>
					<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
				</svg>
			</div>
			<div class="gravhub-stat-content">
				<div class="gravhub-stat-label"><?php esc_html_e( 'Last Sync', 'gravhub-seo' ); ?></div>
				<div class="gravhub-stat-value" style="font-size: 18px;">
					<?php if ( $last_analysis_time ) : ?>
						<?php
						echo esc_html(
							sprintf(
								/* translators: %s: human-readable time difference */
								__( '%s ago', 'gravhub-seo' ),
								human_time_diff( $last_analysis_time, time() )
							)
						);
						?>
					<?php else : ?>
						<?php esc_html_e( 'Never', 'gravhub-seo' ); ?>
					<?php endif; ?>
				</div>
				<?php if ( $last_analysis_time ) : ?>
					<div class="gravhub-stat-sub">
						<?php echo esc_html( date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $last_analysis_time ) ); ?>
					</div>
				<?php endif; ?>
			</div>
		</div>
	</div>

	<!-- Notifications Feed -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<div class="gravhub-card-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				</svg>
			</div>
			<h2><?php esc_html_e( 'Notifications', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<ul class="gravhub-notification-list">
				<?php foreach ( $notifications as $notification ) : ?>
					<li class="gravhub-notification gravhub-notification--<?php echo esc_attr( $notification['type'] ); ?>">
						<span class="gravhub-notification-dot"></span>
						<span class="gravhub-notification-message">
							<?php if ( ! empty( $notification['link'] ) ) : ?>
								<a href="<?php echo esc_url( $notification['link'] ); ?>"><?php echo esc_html( $notification['message'] ); ?></a>
							<?php else : ?>
								<?php echo esc_html( $notification['message'] ); ?>
							<?php endif; ?>
						</span>
					</li>
				<?php endforeach; ?>
			</ul>
		</div>
	</div>

	<!-- Connection Settings Card -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<div class="gravhub-card-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
					<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
				</svg>
			</div>
			<h2><?php esc_html_e( 'Connection', 'gravhub-seo' ); ?></h2>
			<?php if ( $is_connected ) : ?>
				<span class="gravhub-connection-status gravhub-connection-status--connected" style="margin-left: auto;">
					<span class="gravhub-pulse-dot gravhub-pulse-dot--green"></span>
					<?php esc_html_e( 'Connected', 'gravhub-seo' ); ?>
				</span>
			<?php else : ?>
				<span class="gravhub-connection-status gravhub-connection-status--disconnected" style="margin-left: auto;">
					<span class="gravhub-pulse-dot gravhub-pulse-dot--red"></span>
					<?php esc_html_e( 'Disconnected', 'gravhub-seo' ); ?>
				</span>
			<?php endif; ?>
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
				<button type="button" class="gravhub-btn gravhub-btn--secondary" id="gravhub-test-connection" <?php disabled( ! $is_connected ); ?>>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
						<polyline points="22 4 12 14.01 9 11.01"/>
					</svg>
					<?php esc_html_e( 'Test Connection', 'gravhub-seo' ); ?>
				</button>
				<span id="gravhub-connection-result"></span>
			</div>
		</div>
	</div>

	<!-- SEO Overview Card -->
	<?php if ( ! empty( $analysis_results ) ) : ?>
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<div class="gravhub-card-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="20" x2="18" y2="10"/>
					<line x1="12" y1="20" x2="12" y2="4"/>
					<line x1="6" y1="20" x2="6" y2="14"/>
				</svg>
			</div>
			<h2><?php esc_html_e( 'SEO Overview', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<p class="gravhub-section-desc"><?php esc_html_e( 'Score distribution across all analyzed pages.', 'gravhub-seo' ); ?></p>
			<div class="gravhub-score-distribution">
				<?php
				$max_count = max( 1, $score_distribution['green'], $score_distribution['yellow'], $score_distribution['red'] );
				$bar_max   = 100; // max px height.
				?>
				<div class="gravhub-score-dist-bar">
					<div class="gravhub-score-dist-count"><?php echo esc_html( $score_distribution['green'] ); ?></div>
					<div class="gravhub-score-dist-fill gravhub-score-dist-fill--green" style="height: <?php echo esc_attr( max( 8, round( ( $score_distribution['green'] / $max_count ) * $bar_max ) ) ); ?>px;"></div>
					<div class="gravhub-score-dist-label"><?php esc_html_e( 'Good (80+)', 'gravhub-seo' ); ?></div>
				</div>
				<div class="gravhub-score-dist-bar">
					<div class="gravhub-score-dist-count"><?php echo esc_html( $score_distribution['yellow'] ); ?></div>
					<div class="gravhub-score-dist-fill gravhub-score-dist-fill--amber" style="height: <?php echo esc_attr( max( 8, round( ( $score_distribution['yellow'] / $max_count ) * $bar_max ) ) ); ?>px;"></div>
					<div class="gravhub-score-dist-label"><?php esc_html_e( 'Needs Work (50-79)', 'gravhub-seo' ); ?></div>
				</div>
				<div class="gravhub-score-dist-bar">
					<div class="gravhub-score-dist-count"><?php echo esc_html( $score_distribution['red'] ); ?></div>
					<div class="gravhub-score-dist-fill gravhub-score-dist-fill--red" style="height: <?php echo esc_attr( max( 8, round( ( $score_distribution['red'] / $max_count ) * $bar_max ) ) ); ?>px;"></div>
					<div class="gravhub-score-dist-label"><?php esc_html_e( 'Poor (<50)', 'gravhub-seo' ); ?></div>
				</div>
			</div>
		</div>
	</div>
	<?php endif; ?>

	<!-- SEO Scores Table -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<div class="gravhub-card-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
					<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
					<line x1="12" y1="22.08" x2="12" y2="12"/>
				</svg>
			</div>
			<h2><?php esc_html_e( 'SEO Scores', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<div style="display: flex; gap: 10px; margin-bottom: 16px;">
				<button type="button" class="gravhub-btn gravhub-btn--primary" id="gravhub-run-analysis">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="5 3 19 12 5 21 5 3"/>
					</svg>
					<?php esc_html_e( 'Run Analysis', 'gravhub-seo' ); ?>
				</button>
				<button type="button" class="gravhub-btn gravhub-btn--secondary" id="gravhub-sync-scores" <?php disabled( ! $is_connected ); ?>>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="23 4 23 10 17 10"/>
						<polyline points="1 20 1 14 7 14"/>
						<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
					</svg>
					<?php esc_html_e( 'Sync with GravHub', 'gravhub-seo' ); ?>
				</button>
				<span id="gravhub-analysis-result"></span>
			</div>

			<?php if ( ! empty( $analysis_results ) ) : ?>
				<table class="gravhub-scores-table" id="gravhub-scores-table">
					<thead>
						<tr>
							<th data-sort="title"><?php esc_html_e( 'Page', 'gravhub-seo' ); ?> <span class="sort-icon">&#9650;&#9660;</span></th>
							<th data-sort="type"><?php esc_html_e( 'Type', 'gravhub-seo' ); ?> <span class="sort-icon">&#9650;&#9660;</span></th>
							<th data-sort="score"><?php esc_html_e( 'Score', 'gravhub-seo' ); ?> <span class="sort-icon">&#9650;&#9660;</span></th>
							<th><?php esc_html_e( 'Issues', 'gravhub-seo' ); ?></th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ( $analysis_results as $idx => $result ) : ?>
							<tr data-title="<?php echo esc_attr( $result['title'] ); ?>" data-type="<?php echo esc_attr( $result['type'] ); ?>" data-score="<?php echo esc_attr( $result['score'] ); ?>">
								<td>
									<div class="gravhub-page-title">
										<a href="<?php echo esc_url( get_edit_post_link( $result['post_id'] ) ); ?>">
											<?php echo esc_html( $result['title'] ); ?>
										</a>
									</div>
									<div class="gravhub-page-url"><?php echo esc_html( $result['url'] ); ?></div>
								</td>
								<td>
									<span class="gravhub-page-type"><?php echo esc_html( ucfirst( $result['type'] ) ); ?></span>
								</td>
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
										<button type="button" class="gravhub-btn gravhub-btn--sm gravhub-btn--secondary gravhub-issue-toggle" data-target="issues-<?php echo esc_attr( $idx ); ?>">
											<?php
											echo esc_html(
												sprintf(
													/* translators: %d: number of issues */
													_n( '%d issue', '%d issues', count( $result['issues'] ), 'gravhub-seo' ),
													count( $result['issues'] )
												)
											);
											?>
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">
												<polyline points="6 9 12 15 18 9"/>
											</svg>
										</button>
									<?php else : ?>
										<span class="gravhub-no-issues">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">
												<polyline points="20 6 9 17 4 12"/>
											</svg>
											<?php esc_html_e( 'No issues', 'gravhub-seo' ); ?>
										</span>
									<?php endif; ?>
								</td>
							</tr>
							<?php if ( ! empty( $result['issues'] ) ) : ?>
								<tr class="gravhub-issues-row" id="issues-<?php echo esc_attr( $idx ); ?>">
									<td colspan="4">
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
									</td>
								</tr>
							<?php endif; ?>
						<?php endforeach; ?>
					</tbody>
				</table>
			<?php else : ?>
				<div class="gravhub-empty-state">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"/>
						<line x1="21" y1="21" x2="16.65" y2="16.65"/>
					</svg>
					<p><?php esc_html_e( 'No analysis results yet. Click "Run Analysis" to analyze your pages.', 'gravhub-seo' ); ?></p>
				</div>
			<?php endif; ?>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<div class="gravhub-card-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
				</svg>
			</div>
			<h2><?php esc_html_e( 'Quick Actions', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<div class="gravhub-actions-grid">
				<button type="button" class="gravhub-action-card" id="gravhub-quick-analysis">
					<div class="gravhub-action-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="5 3 19 12 5 21 5 3"/>
						</svg>
					</div>
					<span class="gravhub-action-label"><?php esc_html_e( 'Run Analysis', 'gravhub-seo' ); ?></span>
				</button>
				<button type="button" class="gravhub-action-card" id="gravhub-send-report" <?php disabled( ! $is_connected ); ?>>
					<div class="gravhub-action-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
							<polyline points="22,6 12,13 2,6"/>
						</svg>
					</div>
					<span class="gravhub-action-label"><?php esc_html_e( 'Send Health Report', 'gravhub-seo' ); ?></span>
				</button>
				<button type="button" class="gravhub-action-card" id="gravhub-quick-sync" <?php disabled( ! $is_connected ); ?>>
					<div class="gravhub-action-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="23 4 23 10 17 10"/>
							<polyline points="1 20 1 14 7 14"/>
							<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
						</svg>
					</div>
					<span class="gravhub-action-label"><?php esc_html_e( 'Sync Now', 'gravhub-seo' ); ?></span>
				</button>
				<button type="button" class="gravhub-action-card" id="gravhub-view-sitemap" onclick="window.open('<?php echo esc_url( home_url( '/sitemap.xml' ) ); ?>', '_blank');">
					<div class="gravhub-action-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
							<circle cx="12" cy="10" r="3"/>
						</svg>
					</div>
					<span class="gravhub-action-label"><?php esc_html_e( 'View Sitemap', 'gravhub-seo' ); ?></span>
				</button>
			</div>
			<span id="gravhub-report-result"></span>
		</div>
	</div>

	<div class="gravhub-two-col">
		<!-- Sitemap Settings Card -->
		<div class="gravhub-card">
			<div class="gravhub-card-header">
				<div class="gravhub-card-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
						<circle cx="12" cy="10" r="3"/>
					</svg>
				</div>
				<h2><?php esc_html_e( 'Sitemap Settings', 'gravhub-seo' ); ?></h2>
			</div>
			<div class="gravhub-card-body">
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
					<div>
						<div class="gravhub-section-title" style="margin-bottom: 2px;"><?php esc_html_e( 'XML Sitemap', 'gravhub-seo' ); ?></div>
						<p class="gravhub-section-desc" style="margin-bottom: 0;"><?php esc_html_e( 'Automatically generate an XML sitemap for search engines.', 'gravhub-seo' ); ?></p>
					</div>
					<label class="gravhub-toggle">
						<input type="checkbox" id="gravhub-sitemap-toggle" <?php checked( $sitemap_enabled ); ?>>
						<span class="gravhub-toggle-slider"></span>
					</label>
				</div>

				<div class="gravhub-section-title"><?php esc_html_e( 'Include Post Types', 'gravhub-seo' ); ?></div>
				<div class="gravhub-checkbox-group">
					<?php
					$available_types = get_post_types( array( 'public' => true ), 'objects' );
					foreach ( $available_types as $pt ) :
						$checked = in_array( $pt->name, $sitemap_post_types, true );
					?>
						<label>
							<input type="checkbox" class="gravhub-sitemap-pt" value="<?php echo esc_attr( $pt->name ); ?>" <?php checked( $checked ); ?>>
							<?php echo esc_html( $pt->labels->singular_name ); ?>
						</label>
					<?php endforeach; ?>
				</div>

				<div class="gravhub-sitemap-url">
					<code id="gravhub-sitemap-url-text"><?php echo esc_html( home_url( '/sitemap.xml' ) ); ?></code>
					<button type="button" class="gravhub-btn gravhub-btn--sm gravhub-btn--secondary gravhub-copy-btn" id="gravhub-copy-sitemap">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
						</svg>
						<?php esc_html_e( 'Copy', 'gravhub-seo' ); ?>
						<span class="gravhub-copy-tooltip"><?php esc_html_e( 'Copied!', 'gravhub-seo' ); ?></span>
					</button>
				</div>
			</div>
		</div>

		<!-- Modules Card -->
		<div class="gravhub-card">
			<div class="gravhub-card-header">
				<div class="gravhub-card-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="3" width="7" height="7"/>
						<rect x="14" y="3" width="7" height="7"/>
						<rect x="14" y="14" width="7" height="7"/>
						<rect x="3" y="14" width="7" height="7"/>
					</svg>
				</div>
				<h2><?php esc_html_e( 'Modules', 'gravhub-seo' ); ?></h2>
			</div>
			<div class="gravhub-card-body">
				<div class="gravhub-modules-grid">
					<?php
					foreach ( $modules as $module_key => $module ) :
						$is_toggleable = ! empty( $module['toggle'] );
						$is_active     = $is_toggleable && ! empty( $module_states[ $module_key ] );
					?>
						<div class="gravhub-module-card <?php echo $is_active ? 'gravhub-module-card--active' : ''; ?>">
							<div class="gravhub-module-icon">
								<?php echo $module['icon']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Static SVG. ?>
							</div>
							<div class="gravhub-module-info">
								<div class="gravhub-module-name"><?php echo esc_html( $module['name'] ); ?></div>
								<div class="gravhub-module-desc"><?php echo esc_html( $module['desc'] ); ?></div>
							</div>
							<?php if ( $is_toggleable ) : ?>
								<label class="gravhub-toggle">
									<input type="checkbox" class="gravhub-module-toggle" data-module="<?php echo esc_attr( $module_key ); ?>" <?php checked( $is_active ); ?>>
									<span class="gravhub-toggle-slider"></span>
								</label>
							<?php else : ?>
								<a href="<?php echo esc_url( $module['link'] ); ?>" class="gravhub-btn gravhub-btn--sm gravhub-btn--secondary">
									<?php esc_html_e( 'Manage', 'gravhub-seo' ); ?>
								</a>
							<?php endif; ?>
						</div>
					<?php endforeach; ?>
				</div>
			</div>
		</div>
	</div>

	<!-- Site Analytics (populated via JS — /dashboard-analytics proxies the
	     GravHub app's GA4/GSC pull, which can take several seconds on a
	     cache miss, so this can't block the initial page render) -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<div class="gravhub-card-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="20" x2="18" y2="10"/>
					<line x1="12" y1="20" x2="12" y2="4"/>
					<line x1="6" y1="20" x2="6" y2="14"/>
				</svg>
			</div>
			<h2><?php esc_html_e( 'Site Analytics', 'gravhub-seo' ); ?></h2>
			<span id="gravhub-analytics-period" class="gravhub-section-desc" style="margin-left: auto; margin-bottom: 0;"></span>
		</div>
		<div class="gravhub-card-body">
			<div id="gravhub-analytics-loading" class="gravhub-empty-state">
				<span class="gravhub-spinner"></span>
			</div>
			<div id="gravhub-analytics-content" style="display: none;">
				<div class="gravhub-stats-grid gravhub-stats-grid--analytics" id="gravhub-analytics-stats"></div>
				<div class="gravhub-two-col" style="margin-top: 20px;">
					<div>
						<div class="gravhub-section-title"><?php esc_html_e( 'Traffic by Channel', 'gravhub-seo' ); ?></div>
						<ul class="gravhub-channel-list" id="gravhub-analytics-channels"></ul>
					</div>
					<div>
						<div class="gravhub-section-title"><?php esc_html_e( 'Top Pages', 'gravhub-seo' ); ?></div>
						<ul class="gravhub-channel-list" id="gravhub-analytics-toppages"></ul>
					</div>
				</div>
			</div>
			<div id="gravhub-analytics-empty" class="gravhub-empty-state" style="display: none;">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="20" x2="18" y2="10"/>
					<line x1="12" y1="20" x2="12" y2="4"/>
					<line x1="6" y1="20" x2="6" y2="14"/>
				</svg>
				<p id="gravhub-analytics-empty-text"></p>
			</div>
		</div>
	</div>

	<!-- Keywords (populated via JS, same async-fetch reasoning as Site Analytics) -->
	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<div class="gravhub-card-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/>
					<line x1="21" y1="21" x2="16.65" y2="16.65"/>
				</svg>
			</div>
			<h2><?php esc_html_e( 'Keywords', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<div id="gravhub-keywords-loading" class="gravhub-empty-state">
				<span class="gravhub-spinner"></span>
			</div>
			<div id="gravhub-keywords-content" style="display: none;">
				<div class="gravhub-stats-grid gravhub-stats-grid--buckets" id="gravhub-keywords-buckets"></div>
				<div class="gravhub-two-col" style="margin-top: 20px;">
					<div>
						<div class="gravhub-section-title"><?php esc_html_e( 'Winning', 'gravhub-seo' ); ?></div>
						<ul class="gravhub-channel-list" id="gravhub-keywords-winning"></ul>
					</div>
					<div>
						<div class="gravhub-section-title"><?php esc_html_e( 'Losing', 'gravhub-seo' ); ?></div>
						<ul class="gravhub-channel-list" id="gravhub-keywords-losing"></ul>
					</div>
				</div>
			</div>
			<div id="gravhub-keywords-empty" class="gravhub-empty-state" style="display: none;">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/>
					<line x1="21" y1="21" x2="16.65" y2="16.65"/>
				</svg>
				<p id="gravhub-keywords-empty-text"></p>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<div class="gravhub-footer">
		<p><?php esc_html_e( 'Powered by Graviss Marketing', 'gravhub-seo' ); ?></p>
		<p>
			<?php
			echo esc_html(
				sprintf(
					/* translators: %s: plugin version */
					__( 'GravHub SEO v%s', 'gravhub-seo' ),
					GRAVHUB_SEO_VERSION
				)
			);
			?>
			&middot;
			<a href="https://app.gravhub.io" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Open GravHub Platform', 'gravhub-seo' ); ?></a>
		</p>
	</div>
</div>

<script>
(function() {
	'use strict';

	var restUrl = <?php echo wp_json_encode( esc_url_raw( rest_url( 'gravhub-seo/v1/' ) ) ); ?>;
	var nonce   = <?php echo wp_json_encode( wp_create_nonce( 'wp_rest' ) ); ?>;
	var ajaxUrl = <?php echo wp_json_encode( admin_url( 'admin-ajax.php' ) ); ?>;

	/* ----- Toast Notification ----- */
	function showToast(message, type) {
		var existing = document.querySelector('.gravhub-toast');
		if (existing) existing.remove();

		var toast = document.createElement('div');
		toast.className = 'gravhub-toast gravhub-toast--' + (type || 'success');
		toast.textContent = message;
		document.body.appendChild(toast);

		setTimeout(function() {
			toast.style.animation = 'gravhubToastOut 0.3s ease-in forwards';
			setTimeout(function() { toast.remove(); }, 300);
		}, 3000);
	}

	/* ----- API Request Helper ----- */
	function apiRequest(endpoint, resultEl, successMsg, options) {
		if (resultEl) {
			resultEl.innerHTML = '<span class="gravhub-spinner"></span>';
			resultEl.className = 'gravhub-result-pending';
		}

		fetch(restUrl + endpoint, {
			method: (options && options.method) || 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce
			},
			body: (options && options.body) ? JSON.stringify(options.body) : undefined
		})
		.then(function(response) { return response.json(); })
		.then(function(data) {
			// run-analysis's { success: true } only means the REST call itself
			// completed — it always returns success even when send_scores()
			// (the actual push to GravHub) failed, so a wrong API key/URL or
			// an unreachable GravHub instance previously still showed a green
			// "Analysis complete!" toast while GravHub silently got nothing.
			// { sent: false } is the real signal for that case.
			if ( data.success && false === data.sent ) {
				var notSentMsg = '<?php echo esc_js( __( 'Analysis ran locally, but GravHub never received it — check your Connection settings above.', 'gravhub-seo' ) ); ?>';
				if (resultEl) {
					resultEl.textContent = notSentMsg;
					resultEl.className = 'gravhub-result-error';
				}
				showToast(notSentMsg, 'error');
				return;
			}
			if (data.success) {
				if (resultEl) {
					resultEl.textContent = successMsg || data.message || '<?php echo esc_js( __( 'Success!', 'gravhub-seo' ) ); ?>';
					resultEl.className = 'gravhub-result-success';
				}
				showToast(successMsg || data.message || '<?php echo esc_js( __( 'Success!', 'gravhub-seo' ) ); ?>', 'success');
				if (endpoint === 'run-analysis') {
					setTimeout(function() { location.reload(); }, 1500);
				}
			} else {
				var msg = data.message || '<?php echo esc_js( __( 'An error occurred.', 'gravhub-seo' ) ); ?>';
				if (resultEl) {
					resultEl.textContent = msg;
					resultEl.className = 'gravhub-result-error';
				}
				showToast(msg, 'error');
			}
		})
		.catch(function(err) {
			var msg = '<?php echo esc_js( __( 'Request failed. Check console for details.', 'gravhub-seo' ) ); ?>';
			if (resultEl) {
				resultEl.textContent = msg;
				resultEl.className = 'gravhub-result-error';
			}
			showToast(msg, 'error');
			console.error('GravHub SEO:', err);
		});
	}

	/* ----- Save Option via AJAX ----- */
	function saveOption(option, value) {
		fetch(restUrl + 'save-option', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce
			},
			body: JSON.stringify({ option: option, value: value })
		}).catch(function(err) {
			console.error('GravHub SEO save-option:', err);
		});
	}

	/* ----- Test Connection ----- */
	var testBtn = document.getElementById('gravhub-test-connection');
	if (testBtn) {
		testBtn.addEventListener('click', function() {
			apiRequest('test-connection', document.getElementById('gravhub-connection-result'));
		});
	}

	/* ----- Send Health Report ----- */
	var reportBtn = document.getElementById('gravhub-send-report');
	if (reportBtn) {
		reportBtn.addEventListener('click', function() {
			apiRequest('send-report', document.getElementById('gravhub-report-result'), '<?php echo esc_js( __( 'Health report sent!', 'gravhub-seo' ) ); ?>');
		});
	}

	/* ----- Run Analysis (primary button and quick action) ----- */
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

	var quickAnalysisBtn = document.getElementById('gravhub-quick-analysis');
	if (quickAnalysisBtn) {
		quickAnalysisBtn.addEventListener('click', function() {
			apiRequest(
				'run-analysis',
				document.getElementById('gravhub-analysis-result'),
				'<?php echo esc_js( __( 'Analysis complete! Refreshing...', 'gravhub-seo' ) ); ?>'
			);
		});
	}

	/* ----- Sync (run analysis then send health report) ----- */
	function runFullSync(resultEl) {
		if (resultEl) {
			resultEl.innerHTML = '<span class="gravhub-spinner"></span>';
			resultEl.className = 'gravhub-result-pending';
		}

		fetch(restUrl + 'run-analysis', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': nonce
			}
		})
		.then(function(response) { return response.json(); })
		.then(function(data) {
			if (!data.success) {
				var msg = data.message || '<?php echo esc_js( __( 'Analysis failed.', 'gravhub-seo' ) ); ?>';
				if (resultEl) {
					resultEl.textContent = msg;
					resultEl.className = 'gravhub-result-error';
				}
				showToast(msg, 'error');
				return;
			}
			// { success: true } only means the analysis itself ran — it says
			// nothing about whether the scores actually reached GravHub.
			// Check { sent: false } explicitly rather than proceeding to send
			// the health report and reporting "Synced with GravHub!" when the
			// scores never arrived.
			if ( false === data.sent ) {
				var notSentMsg = '<?php echo esc_js( __( 'Analysis ran locally, but GravHub never received it — check your Connection settings above.', 'gravhub-seo' ) ); ?>';
				if (resultEl) {
					resultEl.textContent = notSentMsg;
					resultEl.className = 'gravhub-result-error';
				}
				showToast(notSentMsg, 'error');
				return;
			}
			// Analysis succeeded, now send health report.
			return fetch(restUrl + 'send-report', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': nonce
				}
			})
			.then(function(response) { return response.json(); })
			.then(function(reportData) {
				var successMsg = '<?php echo esc_js( __( 'Synced with GravHub!', 'gravhub-seo' ) ); ?>';
				if (resultEl) {
					resultEl.textContent = successMsg;
					resultEl.className = 'gravhub-result-success';
				}
				showToast(successMsg, 'success');
				setTimeout(function() { location.reload(); }, 1500);
			});
		})
		.catch(function(err) {
			var msg = '<?php echo esc_js( __( 'Sync failed. Check console for details.', 'gravhub-seo' ) ); ?>';
			if (resultEl) {
				resultEl.textContent = msg;
				resultEl.className = 'gravhub-result-error';
			}
			showToast(msg, 'error');
			console.error('GravHub SEO sync:', err);
		});
	}

	var syncBtn = document.getElementById('gravhub-sync-scores');
	if (syncBtn) {
		syncBtn.addEventListener('click', function() {
			runFullSync(document.getElementById('gravhub-analysis-result'));
		});
	}

	var quickSyncBtn = document.getElementById('gravhub-quick-sync');
	if (quickSyncBtn) {
		quickSyncBtn.addEventListener('click', function() {
			runFullSync(null);
		});
	}

	/* ----- Issue Row Toggle ----- */
	document.querySelectorAll('.gravhub-issue-toggle').forEach(function(btn) {
		btn.addEventListener('click', function() {
			var target = document.getElementById(this.getAttribute('data-target'));
			if (target) {
				target.classList.toggle('expanded');
				var chevron = this.querySelector('svg');
				if (chevron) {
					chevron.style.transform = target.classList.contains('expanded') ? 'rotate(180deg)' : '';
				}
			}
		});
	});

	/* ----- Table Sorting ----- */
	var table = document.getElementById('gravhub-scores-table');
	if (table) {
		var headers = table.querySelectorAll('thead th[data-sort]');
		headers.forEach(function(th) {
			th.addEventListener('click', function() {
				var field = this.getAttribute('data-sort');
				var tbody = table.querySelector('tbody');
				var rows = [];
				var dataRows = tbody.querySelectorAll('tr[data-' + field + ']');

				dataRows.forEach(function(row) {
					var issueRow = row.nextElementSibling;
					var pair = { main: row };
					if (issueRow && issueRow.classList.contains('gravhub-issues-row')) {
						pair.issues = issueRow;
					}
					rows.push(pair);
				});

				var ascending = !this.classList.contains('sorted-asc');

				// Clear all sort classes.
				headers.forEach(function(h) { h.classList.remove('sorted', 'sorted-asc', 'sorted-desc'); });
				this.classList.add('sorted', ascending ? 'sorted-asc' : 'sorted-desc');

				rows.sort(function(a, b) {
					var valA = a.main.getAttribute('data-' + field);
					var valB = b.main.getAttribute('data-' + field);
					if (field === 'score') {
						valA = parseInt(valA, 10);
						valB = parseInt(valB, 10);
					} else {
						valA = valA.toLowerCase();
						valB = valB.toLowerCase();
					}
					if (valA < valB) return ascending ? -1 : 1;
					if (valA > valB) return ascending ? 1 : -1;
					return 0;
				});

				rows.forEach(function(pair) {
					tbody.appendChild(pair.main);
					if (pair.issues) tbody.appendChild(pair.issues);
				});
			});
		});
	}

	/* ----- Copy Sitemap URL ----- */
	var copyBtn = document.getElementById('gravhub-copy-sitemap');
	if (copyBtn) {
		copyBtn.addEventListener('click', function() {
			var url = document.getElementById('gravhub-sitemap-url-text').textContent;
			if (navigator.clipboard) {
				navigator.clipboard.writeText(url).then(function() {
					copyBtn.classList.add('copied');
					setTimeout(function() { copyBtn.classList.remove('copied'); }, 1500);
				});
			} else {
				// Fallback.
				var input = document.createElement('input');
				input.value = url;
				document.body.appendChild(input);
				input.select();
				document.execCommand('copy');
				document.body.removeChild(input);
				copyBtn.classList.add('copied');
				setTimeout(function() { copyBtn.classList.remove('copied'); }, 1500);
			}
		});
	}

	/* ----- Sitemap Toggle ----- */
	var sitemapToggle = document.getElementById('gravhub-sitemap-toggle');
	if (sitemapToggle) {
		sitemapToggle.addEventListener('change', function() {
			saveOption('gravhub_sitemap_enabled', this.checked ? '1' : '0');
			showToast(this.checked ? '<?php echo esc_js( __( 'Sitemap enabled', 'gravhub-seo' ) ); ?>' : '<?php echo esc_js( __( 'Sitemap disabled', 'gravhub-seo' ) ); ?>', 'success');
		});
	}

	/* ----- Sitemap Post Type Checkboxes ----- */
	document.querySelectorAll('.gravhub-sitemap-pt').forEach(function(cb) {
		cb.addEventListener('change', function() {
			var checked = [];
			document.querySelectorAll('.gravhub-sitemap-pt:checked').forEach(function(c) {
				checked.push(c.value);
			});
			saveOption('gravhub_sitemap_post_types', checked);
		});
	});

	/* ----- Module Toggles ----- */
	document.querySelectorAll('.gravhub-module-toggle').forEach(function(toggle) {
		toggle.addEventListener('change', function() {
			var moduleKey = this.getAttribute('data-module');
			var card = this.closest('.gravhub-module-card');

			if (this.checked) {
				card.classList.add('gravhub-module-card--active');
			} else {
				card.classList.remove('gravhub-module-card--active');
			}

			// Gather all module states and save.
			var states = {};
			document.querySelectorAll('.gravhub-module-toggle').forEach(function(t) {
				states[t.getAttribute('data-module')] = t.checked ? 1 : 0;
			});
			saveOption('gravhub_module_states', states);
			showToast(this.checked ? '<?php echo esc_js( __( 'Module enabled', 'gravhub-seo' ) ); ?>' : '<?php echo esc_js( __( 'Module disabled', 'gravhub-seo' ) ); ?>', 'success');
		});
	});

	/* ----- Dashboard fetch helpers ----- */
	function el(tag, className, text) {
		var e = document.createElement(tag);
		if (className) e.className = className;
		if (text !== undefined && text !== null) e.textContent = text;
		return e;
	}

	function fmtNum(n) {
		return (n || 0).toLocaleString();
	}

	function fmtDuration(seconds) {
		var s = Math.round(seconds || 0);
		var m = Math.floor(s / 60);
		var rem = s % 60;
		return m + 'm ' + rem + 's';
	}

	function statTile(label, value) {
		var card = el('div', 'gravhub-stat-card');
		var content = el('div', 'gravhub-stat-content');
		content.appendChild(el('div', 'gravhub-stat-label', label));
		content.appendChild(el('div', 'gravhub-stat-value', value));
		card.appendChild(content);
		return card;
	}

	function channelRow(primary, secondary) {
		var li = el('li', 'gravhub-channel-item');
		li.appendChild(el('span', 'gravhub-channel-name', primary));
		li.appendChild(el('span', 'gravhub-channel-value', secondary));
		return li;
	}

	function fetchDashboard(endpoint, callback) {
		fetch(restUrl + endpoint, {
			method: 'GET',
			headers: { 'X-WP-Nonce': nonce }
		})
		.then(function(response) { return response.json(); })
		.then(callback)
		.catch(function(err) {
			console.error('GravHub SEO ' + endpoint + ':', err);
			callback(null);
		});
	}

	/* ----- Site Analytics ----- */
	var analyticsLoading = document.getElementById('gravhub-analytics-loading');
	var analyticsContent = document.getElementById('gravhub-analytics-content');
	var analyticsEmpty   = document.getElementById('gravhub-analytics-empty');
	var analyticsEmptyText = document.getElementById('gravhub-analytics-empty-text');

	fetchDashboard('dashboard-analytics', function(data) {
		analyticsLoading.style.display = 'none';

		if (!data || data.error || !data.connected || !data.configured || (!data.ga4 && !data.gsc)) {
			var msg = '<?php echo esc_js( __( 'This site is not yet linked to a GravHub client with GA4 or Search Console connected.', 'gravhub-seo' ) ); ?>';
			if (data && data.connected && !data.configured) {
				msg = '<?php echo esc_js( __( 'Linked to a GravHub client, but no GA4 or Search Console integration is configured yet.', 'gravhub-seo' ) ); ?>';
			}
			analyticsEmptyText.textContent = msg;
			analyticsEmpty.style.display = 'block';
			return;
		}

		document.getElementById('gravhub-analytics-period').textContent =
			'<?php echo esc_js( __( 'Last', 'gravhub-seo' ) ); ?> ' + (data.days || 28) + ' <?php echo esc_js( __( 'days', 'gravhub-seo' ) ); ?>';

		var statsEl = document.getElementById('gravhub-analytics-stats');
		statsEl.innerHTML = '';

		if (data.ga4 && data.ga4.summary) {
			var s = data.ga4.summary;
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Sessions', 'gravhub-seo' ) ); ?>', fmtNum(s.sessions)));
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Users', 'gravhub-seo' ) ); ?>', fmtNum(s.users)));
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Pageviews', 'gravhub-seo' ) ); ?>', fmtNum(s.pageviews)));
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Avg Session', 'gravhub-seo' ) ); ?>', fmtDuration(s.avgSessionDurationSec)));
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Bounce Rate', 'gravhub-seo' ) ); ?>', ((s.bounceRate || 0) * 100).toFixed(1) + '%'));
		}
		if (data.gsc) {
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Search Clicks', 'gravhub-seo' ) ); ?>', fmtNum(data.gsc.totalClicks)));
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Impressions', 'gravhub-seo' ) ); ?>', fmtNum(data.gsc.totalImpressions)));
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Avg CTR', 'gravhub-seo' ) ); ?>', ((data.gsc.avgCtr || 0) * 100).toFixed(1) + '%'));
			statsEl.appendChild(statTile('<?php echo esc_js( __( 'Avg Position', 'gravhub-seo' ) ); ?>', (data.gsc.avgPosition || 0).toFixed(1)));
		}

		var channelsEl = document.getElementById('gravhub-analytics-channels');
		channelsEl.innerHTML = '';
		if (data.ga4 && data.ga4.sources && data.ga4.sources.length) {
			data.ga4.sources.slice(0, 8).forEach(function(source) {
				channelsEl.appendChild(channelRow(source.channel, fmtNum(source.sessions)));
			});
		} else {
			channelsEl.appendChild(el('li', 'gravhub-channel-item gravhub-channel-item--empty', '<?php echo esc_js( __( 'No channel data available.', 'gravhub-seo' ) ); ?>'));
		}

		var topPagesEl = document.getElementById('gravhub-analytics-toppages');
		topPagesEl.innerHTML = '';
		if (data.ga4 && data.ga4.topPages && data.ga4.topPages.length) {
			data.ga4.topPages.slice(0, 8).forEach(function(page) {
				topPagesEl.appendChild(channelRow(page.title || page.path, fmtNum(page.sessions)));
			});
		} else {
			topPagesEl.appendChild(el('li', 'gravhub-channel-item gravhub-channel-item--empty', '<?php echo esc_js( __( 'No page data available.', 'gravhub-seo' ) ); ?>'));
		}

		analyticsContent.style.display = 'block';
	});

	/* ----- Keywords ----- */
	var keywordsLoading = document.getElementById('gravhub-keywords-loading');
	var keywordsContent = document.getElementById('gravhub-keywords-content');
	var keywordsEmpty   = document.getElementById('gravhub-keywords-empty');
	var keywordsEmptyText = document.getElementById('gravhub-keywords-empty-text');

	fetchDashboard('dashboard-keywords', function(data) {
		keywordsLoading.style.display = 'none';

		if (!data || data.error || !data.connected || !data.total) {
			var msg = '<?php echo esc_js( __( 'This site is not yet linked to a GravHub client with tracked keywords.', 'gravhub-seo' ) ); ?>';
			if (data && data.connected && !data.total) {
				msg = '<?php echo esc_js( __( 'Linked to a GravHub client, but no keywords are being tracked yet.', 'gravhub-seo' ) ); ?>';
			}
			keywordsEmptyText.textContent = msg;
			keywordsEmpty.style.display = 'block';
			return;
		}

		var bucketsEl = document.getElementById('gravhub-keywords-buckets');
		bucketsEl.innerHTML = '';
		var bucketLabels = { '1-3': '<?php echo esc_js( __( 'Top 3', 'gravhub-seo' ) ); ?>', '4-10': '4-10', '11-20': '11-20', '21-50': '21-50', '50+': '50+' };
		['1-3', '4-10', '11-20', '21-50', '50+'].forEach(function(key) {
			bucketsEl.appendChild(statTile(bucketLabels[key], fmtNum((data.buckets || {})[key])));
		});

		var winningEl = document.getElementById('gravhub-keywords-winning');
		winningEl.innerHTML = '';
		if (data.winning && data.winning.length) {
			data.winning.forEach(function(kw) {
				winningEl.appendChild(channelRow(kw.keyword, '+' + kw.delta + ' (#' + kw.current_position + ')'));
			});
		} else {
			winningEl.appendChild(el('li', 'gravhub-channel-item gravhub-channel-item--empty', '<?php echo esc_js( __( 'No recent gains.', 'gravhub-seo' ) ); ?>'));
		}

		var losingEl = document.getElementById('gravhub-keywords-losing');
		losingEl.innerHTML = '';
		if (data.losing && data.losing.length) {
			data.losing.forEach(function(kw) {
				losingEl.appendChild(channelRow(kw.keyword, kw.delta + ' (#' + kw.current_position + ')'));
			});
		} else {
			losingEl.appendChild(el('li', 'gravhub-channel-item gravhub-channel-item--empty', '<?php echo esc_js( __( 'No recent drops.', 'gravhub-seo' ) ); ?>'));
		}

		keywordsContent.style.display = 'block';
	});
})();
</script>
