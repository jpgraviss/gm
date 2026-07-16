# GravHub Email Tracking (Gmail extension)

Unpacked Chrome/Edge extension that tracks opens and clicks on emails sent from a real Gmail
inbox and mirrors that activity onto the matching GravHub CRM contact's timeline — similar to
HubSpot's free Gmail tracking extension, but pointed at GravHub instead of HubSpot.

## What it does

- Adds a small "● Tracking on" badge to every Gmail compose window.
- On Send, mints a tracking record in GravHub, embeds a 1×1 tracking pixel in the message body,
  and rewrites every link so clicks route through GravHub first (then redirect to the real URL).
- Opens/clicks show up in the extension's popup (grouped Priority / Today / Yesterday / Earlier,
  same as the reference product) and as `crm_activities` rows on the recipient's contact record,
  if one exists.
- Background polling fires a desktop notification when a tracked email is opened or clicked.
- A quick contact lookup is available via the popup/options for recipients who already exist as
  CRM contacts.

## Install (unpacked, internal use only — not published to the Chrome Web Store)

1. In GravHub, go to **Settings → Email Tracking** and click **Generate Token**. Copy the token —
   it is shown exactly once and cannot be recovered afterward (only its hash is stored server-side).
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this `browser-extension/` folder.
5. Click the new toolbar icon → **Set up** (or right-click the icon → Options).
6. Paste in your GravHub base URL (e.g. `https://app.gravhub.com`) and the token from step 1,
   then **Save**. The options page does a live test call before saving, so a bad token or
   unreachable URL is caught immediately instead of failing silently later.
7. Open Gmail (`mail.google.com`) and start a new compose — you should see the tracking badge.

## Architecture notes

- **Manifest V3.** `background.js` is the only script that talks to GravHub's API — a content
  script or popup calling a different-origin API directly gets blocked by CORS, but a service
  worker with `host_permissions` is exempt. `content.js` and `popup.js` route every backend call
  through `chrome.runtime.sendMessage()` to the background worker.
- **Auth.** The extension authenticates with a long-lived Bearer token (`ghext_...`), generated
  from GravHub's Settings page. GravHub only stores the token's SHA-256 hash, so if you lose it
  you generate a new one and revoke the old one — there's no "show it again."
- **Send interception.** Gmail exposes no API to hook into sending a message, and its DOM is
  unversioned and changes without notice. This extension uses the same technique real tools
  (Mailtrack, HubSpot's own extension, Streak) use: listen for the Send button click in the
  **capture phase**, `preventDefault`/`stopImmediatePropagation` it, do the async work (mint a
  tracking id, mutate the compose body), then re-dispatch a synthetic click on the same button so
  Gmail's own send handler runs normally against the now-modified DOM. If the tracking API call
  fails for any reason, the email still sends — untracked, never blocked.
- **Tracking pixel / click redirects** are served by GravHub itself (`/api/track/open/[id]`,
  `/api/track/click/ext/[token]`), publicly reachable with no auth, since the requests come from
  the email recipient's mail client, not a logged-in GravHub session.

## Known fragility (read before assuming a bug is server-side)

Gmail's DOM has no stable public contract, so the following are the most likely things to break
after a Gmail UI update, and are the first places to look if tracking silently stops working:

- **`findSendButton()` / the send-button selector** (`content.js`) matches on
  `data-tooltip^="Send"` / `aria-label^="Send"`. This is **locale-dependent** — a non-English
  Gmail UI (or a future English copy change) can miss the button entirely, in which case the
  interceptor never fires and mail sends normally but untracked. There is no error surfaced to
  the user in this case by design (a tracking failure must never block sending mail).
- **`extractRecipientEmail()`** reads the first element with an `email` attribute in the compose
  header. Gmail renders recipient chips this way today; if that markup changes, recipient
  resolution (and therefore CRM contact matching) breaks quietly.
- **`findComposeBodies()` / `findComposeContainer()`** rely on `aria-label="Message Body"` and
  `role="dialog"` — accessibility attributes tend to be Gmail's most stable selectors, but that's
  a trend, not a guarantee.
- If any of the above stop matching, the extension degrades to "does nothing" (mail sends
  normally, no tracking), not to a visible error — that's a deliberate tradeoff so a broken
  selector can never block someone from sending email.

## `host_permissions` breadth

`manifest.json` currently requests `host_permissions: ["https://*/*"]` rather than scoping to a
single GravHub domain. This was a deliberate shortcut to avoid making users go through an extra
runtime permission grant while GravHub's own deployment URL isn't fixed yet (and to avoid
re-editing/reloading the extension every time it changes). **Recommended hardening once the
production GravHub URL is finalized**: narrow this to `["https://app.gravhub.com/*"]` (or
whatever the real domain is) plus `https://mail.google.com/*`, and reload the unpacked extension.

## Files

- `manifest.json` — Manifest V3 config.
- `background.js` — the only script with network access; API calls, polling, notifications.
- `content.js` / `content.css` — Gmail DOM injection (badge, send interception, pixel/link rewrite).
- `popup.html` / `popup.js` / `popup.css` — toolbar activity feed.
- `options.html` / `options.js` — base URL + token setup.
- `icons/` — toolbar icons (16/48/128px).
