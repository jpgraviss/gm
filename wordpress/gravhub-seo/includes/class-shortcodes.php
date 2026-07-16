<?php
/**
 * GravHub Shortcodes.
 *
 * Public-facing shortcodes. Currently just [gravhub_faq], which renders the
 * exact same Q&A data the FAQPage JSON-LD is built from (see
 * GravHub_Meta_Manager::build_typed_schema()) as a visible accordion — the
 * two are read from one field (_gravhub_faq_items), so the schema and what
 * a visitor actually sees can never drift out of sync with each other.
 *
 * @package GravHub_SEO
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GravHub_Shortcodes {

	/**
	 * Whether the accordion's shared CSS/JS has already been printed on
	 * this page load — only needed once even if the shortcode is used
	 * more than once on the same page.
	 *
	 * @var bool
	 */
	private static $assets_printed = false;

	public function __construct() {
		add_shortcode( 'gravhub_faq', array( $this, 'render_faq' ) );
	}

	/**
	 * Render the [gravhub_faq] shortcode.
	 *
	 * @param array $atts Shortcode attributes. Supports `id` to render
	 *                     another post's FAQ items (defaults to the current post).
	 * @return string
	 */
	public function render_faq( $atts ) {
		$atts    = shortcode_atts( array( 'id' => 0 ), $atts );
		$post_id = $atts['id'] ? (int) $atts['id'] : get_the_ID();

		if ( ! $post_id ) {
			return '';
		}

		$raw = get_post_meta( $post_id, '_gravhub_faq_items', true );
		if ( empty( $raw ) ) {
			return '';
		}

		$items = json_decode( $raw, true );
		if ( ! is_array( $items ) || empty( $items ) ) {
			return '';
		}

		static $instance = 0;
		$instance++;

		ob_start();
		?>
		<div class="gravhub-faq-accordion">
			<?php
			foreach ( $items as $i => $item ) :
				if ( empty( $item['question'] ) || empty( $item['answer'] ) ) {
					continue;
				}
				$panel_id = 'gravhub-faq-' . $instance . '-' . $i;
				?>
				<div class="gravhub-faq-item">
					<button
						type="button"
						class="gravhub-faq-question"
						aria-expanded="false"
						aria-controls="<?php echo esc_attr( $panel_id ); ?>"
					>
						<span class="gravhub-faq-question-text"><?php echo esc_html( $item['question'] ); ?></span>
						<span class="gravhub-faq-icon" aria-hidden="true">+</span>
					</button>
					<div class="gravhub-faq-answer" id="<?php echo esc_attr( $panel_id ); ?>" hidden>
						<?php echo wp_kses_post( wpautop( $item['answer'] ) ); ?>
					</div>
				</div>
			<?php endforeach; ?>
		</div>
		<?php
		if ( ! self::$assets_printed ) {
			self::$assets_printed = true;
			?>
			<style>
			.gravhub-faq-accordion { margin: 24px 0; }
			.gravhub-faq-item { border-bottom: 1px solid #e2e4e7; }
			.gravhub-faq-question {
				width: 100%;
				text-align: left;
				background: none;
				border: none;
				padding: 16px 0;
				font: inherit;
				font-weight: 600;
				cursor: pointer;
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 16px;
			}
			.gravhub-faq-icon { font-size: 1.3em; line-height: 1; flex-shrink: 0; transition: transform 0.2s ease; }
			.gravhub-faq-question[aria-expanded="true"] .gravhub-faq-icon { transform: rotate(45deg); }
			.gravhub-faq-answer { padding: 0 0 16px; }
			.gravhub-faq-answer[hidden] { display: none; }
			.gravhub-faq-answer p:first-child { margin-top: 0; }
			.gravhub-faq-answer p:last-child { margin-bottom: 0; }
			</style>
			<script>
			(function () {
				document.querySelectorAll( '.gravhub-faq-accordion' ).forEach( function ( accordion ) {
					accordion.querySelectorAll( '.gravhub-faq-question' ).forEach( function ( button ) {
						button.addEventListener( 'click', function () {
							var expanded = button.getAttribute( 'aria-expanded' ) === 'true';
							var panel = document.getElementById( button.getAttribute( 'aria-controls' ) );
							button.setAttribute( 'aria-expanded', expanded ? 'false' : 'true' );
							if ( panel ) {
								panel.hidden = expanded;
							}
						} );
					} );
				} );
			})();
			</script>
			<?php
		}

		return ob_get_clean();
	}
}
