<?php
/**
 * GravHub SEO redirects + 404 monitor admin page.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="wrap gravhub-seo-wrap">
	<h1><?php esc_html_e( 'Redirects', 'gravhub-seo' ); ?></h1>

	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<h2><?php esc_html_e( 'Add Redirect', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
				<div style="flex:1; min-width:200px;">
					<label for="gravhub-redirect-from"><?php esc_html_e( 'From (path on this site)', 'gravhub-seo' ); ?></label>
					<input type="text" id="gravhub-redirect-from" class="widefat" placeholder="/old-page" />
				</div>
				<div style="flex:1; min-width:200px;">
					<label for="gravhub-redirect-to"><?php esc_html_e( 'To (path or full URL)', 'gravhub-seo' ); ?></label>
					<input type="text" id="gravhub-redirect-to" class="widefat" placeholder="/new-page" />
				</div>
				<div style="width:100px;">
					<label for="gravhub-redirect-type"><?php esc_html_e( 'Type', 'gravhub-seo' ); ?></label>
					<select id="gravhub-redirect-type" class="widefat">
						<option value="301">301</option>
						<option value="302">302</option>
					</select>
				</div>
				<div>
					<button type="button" class="button button-primary" id="gravhub-redirect-add"><?php esc_html_e( 'Add Redirect', 'gravhub-seo' ); ?></button>
				</div>
			</div>
			<div id="gravhub-redirect-suggestions" style="margin-top:12px; display:none;">
				<p class="description"><?php esc_html_e( 'Suggested destinations (by URL similarity):', 'gravhub-seo' ); ?></p>
				<div id="gravhub-suggestions-list"></div>
			</div>
		</div>
	</div>

	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<h2><?php esc_html_e( 'Active Redirects', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<table class="widefat striped">
				<thead>
					<tr>
						<th><?php esc_html_e( 'From', 'gravhub-seo' ); ?></th>
						<th><?php esc_html_e( 'To', 'gravhub-seo' ); ?></th>
						<th><?php esc_html_e( 'Type', 'gravhub-seo' ); ?></th>
						<th><?php esc_html_e( 'Hits', 'gravhub-seo' ); ?></th>
						<th></th>
					</tr>
				</thead>
				<tbody id="gravhub-redirects-list">
					<tr><td colspan="5"><?php esc_html_e( 'Loading…', 'gravhub-seo' ); ?></td></tr>
				</tbody>
			</table>
		</div>
	</div>

	<div class="gravhub-card">
		<div class="gravhub-card-header">
			<h2><?php esc_html_e( '404 Monitor', 'gravhub-seo' ); ?></h2>
		</div>
		<div class="gravhub-card-body">
			<p class="description"><?php esc_html_e( 'Real requests that hit a 404 on this site. Add a redirect for any of these to send visitors somewhere real.', 'gravhub-seo' ); ?></p>
			<table class="widefat striped">
				<thead>
					<tr>
						<th><?php esc_html_e( 'Path', 'gravhub-seo' ); ?></th>
						<th><?php esc_html_e( 'Hits', 'gravhub-seo' ); ?></th>
						<th><?php esc_html_e( 'Last Seen', 'gravhub-seo' ); ?></th>
						<th></th>
					</tr>
				</thead>
				<tbody id="gravhub-404-list">
					<tr><td colspan="4"><?php esc_html_e( 'Loading…', 'gravhub-seo' ); ?></td></tr>
				</tbody>
			</table>
		</div>
	</div>
</div>

<script>
(function () {
	'use strict';

	var restUrl = <?php echo wp_json_encode( esc_url_raw( rest_url( 'gravhub-seo/v1/' ) ) ); ?>;
	var nonce   = <?php echo wp_json_encode( wp_create_nonce( 'wp_rest' ) ); ?>;

	function apiFetch( path, options ) {
		options = options || {};
		return fetch( restUrl + path, {
			method: options.method || 'GET',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
			body: options.body ? JSON.stringify( options.body ) : undefined,
		} ).then( function ( r ) { return r.json(); } );
	}

	function escapeHtml( str ) {
		var div = document.createElement( 'div' );
		div.textContent = str == null ? '' : String( str );
		return div.innerHTML;
	}

	/* ----- Redirects list ----- */
	function loadRedirects() {
		apiFetch( 'redirects' ).then( function ( rows ) {
			var tbody = document.getElementById( 'gravhub-redirects-list' );
			if ( ! Array.isArray( rows ) || rows.length === 0 ) {
				tbody.innerHTML = '<tr><td colspan="5"><?php echo esc_js( __( 'No redirects yet.', 'gravhub-seo' ) ); ?></td></tr>';
				return;
			}
			tbody.innerHTML = rows.map( function ( row ) {
				return '<tr>' +
					'<td>' + escapeHtml( row.from_path ) + '</td>' +
					'<td>' + escapeHtml( row.to_path ) + '</td>' +
					'<td>' + escapeHtml( row.redirect_type ) + '</td>' +
					'<td>' + escapeHtml( row.hit_count ) + '</td>' +
					'<td><button type="button" class="button-link-delete gravhub-redirect-delete" data-id="' + row.id + '"><?php echo esc_js( __( 'Delete', 'gravhub-seo' ) ); ?></button></td>' +
				'</tr>';
			} ).join( '' );

			tbody.querySelectorAll( '.gravhub-redirect-delete' ).forEach( function ( btn ) {
				btn.addEventListener( 'click', function () {
					if ( ! confirm( '<?php echo esc_js( __( 'Delete this redirect?', 'gravhub-seo' ) ); ?>' ) ) return;
					apiFetch( 'redirects/' + btn.dataset.id, { method: 'DELETE' } ).then( loadRedirects );
				} );
			} );
		} );
	}

	document.getElementById( 'gravhub-redirect-add' ).addEventListener( 'click', function () {
		var fromEl = document.getElementById( 'gravhub-redirect-from' );
		var toEl   = document.getElementById( 'gravhub-redirect-to' );
		var typeEl = document.getElementById( 'gravhub-redirect-type' );

		if ( ! fromEl.value.trim() || ! toEl.value.trim() ) {
			alert( '<?php echo esc_js( __( 'From and To are both required.', 'gravhub-seo' ) ); ?>' );
			return;
		}

		apiFetch( 'redirects', {
			method: 'POST',
			body: { from_path: fromEl.value.trim(), to_path: toEl.value.trim(), redirect_type: parseInt( typeEl.value, 10 ) },
		} ).then( function ( res ) {
			if ( res && res.error ) {
				alert( res.error );
				return;
			}
			fromEl.value = '';
			toEl.value = '';
			document.getElementById( 'gravhub-redirect-suggestions' ).style.display = 'none';
			loadRedirects();
			load404Log();
		} );
	} );

	/* ----- 404 log ----- */
	function load404Log() {
		apiFetch( '404-log' ).then( function ( rows ) {
			var tbody = document.getElementById( 'gravhub-404-list' );
			if ( ! Array.isArray( rows ) || rows.length === 0 ) {
				tbody.innerHTML = '<tr><td colspan="4"><?php echo esc_js( __( 'No 404s logged yet.', 'gravhub-seo' ) ); ?></td></tr>';
				return;
			}
			tbody.innerHTML = rows.map( function ( row ) {
				return '<tr>' +
					'<td>' + escapeHtml( row.path ) + '</td>' +
					'<td>' + escapeHtml( row.hit_count ) + '</td>' +
					'<td>' + escapeHtml( row.last_seen ) + '</td>' +
					'<td>' +
						'<button type="button" class="button gravhub-404-add-redirect" data-id="' + row.id + '" data-path="' + escapeHtml( row.path ) + '"><?php echo esc_js( __( 'Add Redirect', 'gravhub-seo' ) ); ?></button> ' +
						'<button type="button" class="button-link-delete gravhub-404-dismiss" data-id="' + row.id + '"><?php echo esc_js( __( 'Dismiss', 'gravhub-seo' ) ); ?></button>' +
					'</td>' +
				'</tr>';
			} ).join( '' );

			tbody.querySelectorAll( '.gravhub-404-dismiss' ).forEach( function ( btn ) {
				btn.addEventListener( 'click', function () {
					apiFetch( '404-log/' + btn.dataset.id, { method: 'DELETE' } ).then( load404Log );
				} );
			} );

			tbody.querySelectorAll( '.gravhub-404-add-redirect' ).forEach( function ( btn ) {
				btn.addEventListener( 'click', function () {
					document.getElementById( 'gravhub-redirect-from' ).value = btn.dataset.path;
					document.getElementById( 'gravhub-redirect-to' ).focus();
					window.scrollTo( { top: 0, behavior: 'smooth' } );
					loadSuggestions( btn.dataset.id );
				} );
			} );
		} );
	}

	function loadSuggestions( logId ) {
		var wrap = document.getElementById( 'gravhub-redirect-suggestions' );
		var list = document.getElementById( 'gravhub-suggestions-list' );
		list.innerHTML = '<?php echo esc_js( __( 'Loading suggestions…', 'gravhub-seo' ) ); ?>';
		wrap.style.display = 'block';

		apiFetch( '404-log/' + logId + '/suggestions' ).then( function ( rows ) {
			if ( ! Array.isArray( rows ) || rows.length === 0 ) {
				list.innerHTML = '<?php echo esc_js( __( 'No close matches found — enter a destination manually.', 'gravhub-seo' ) ); ?>';
				return;
			}
			list.innerHTML = rows.map( function ( row ) {
				return '<button type="button" class="button gravhub-suggestion" data-url="' + escapeHtml( row.url ) + '" style="margin:2px 4px 2px 0;">' +
					escapeHtml( row.title ) + ' <span style="opacity:.6;">(' + row.score + '% match)</span>' +
				'</button>';
			} ).join( '' );

			list.querySelectorAll( '.gravhub-suggestion' ).forEach( function ( btn ) {
				btn.addEventListener( 'click', function () {
					var url = btn.dataset.url;
					try {
						document.getElementById( 'gravhub-redirect-to' ).value = new URL( url ).pathname;
					} catch ( e ) {
						document.getElementById( 'gravhub-redirect-to' ).value = url;
					}
				} );
			} );
		} );
	}

	loadRedirects();
	load404Log();
})();
</script>
