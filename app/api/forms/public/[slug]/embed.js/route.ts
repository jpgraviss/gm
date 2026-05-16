import { NextRequest, NextResponse } from 'next/server'

/**
 * Returns a JS snippet that creates an iframe pointing at /go/form/[slug].
 * Usage on a client website:
 *   <div data-gravhub-form="my-contact-form"></div>
 *   <script src="https://app.gravissmarketing.com/api/forms/public/my-contact-form/embed.js" async></script>
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gravissmarketing.com'

  const js = `
(function () {
  var slug = ${JSON.stringify(slug)};
  var src = ${JSON.stringify(appUrl)} + '/go/form/' + slug;
  var targets = document.querySelectorAll('[data-gravhub-form="' + slug + '"]');
  targets.forEach(function (el) {
    if (el.dataset.gravhubLoaded) return;
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = '100%';
    iframe.style.minHeight = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.setAttribute('title', 'Form');
    el.innerHTML = '';
    el.appendChild(iframe);
    el.dataset.gravhubLoaded = '1';

    // Auto-resize on height post messages from the iframe
    window.addEventListener('message', function (event) {
      if (event.source !== iframe.contentWindow) return;
      if (event.data && event.data.type === 'gravhub:resize' && typeof event.data.height === 'number') {
        iframe.style.height = (event.data.height + 20) + 'px';
      }
    });
  });
})();
`.trim()

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
