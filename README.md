# Inkline Connect Listing Grid Widget

A lightweight, embeddable JavaScript widget for Inkline Connect pages that fetches records from a custom object and renders them using a template file. The template uses simple `{{ token }}` placeholders that map directly to object fields.

## Features

- Fetches custom object records from the Inkline Connect API
- Uses a simple HTML template for rendering each record
- Tokens map directly to custom object field keys
- Supports record `updatedAt` / `updated_at`
- Works in Inkline Connect Custom Code elements

## Quick Start

1. Host the widget JS and your template file at public URLs (e.g., GitHub + jsDelivr or Inkline Connect File Manager).
2. Add one or more listing blocks to your page.
3. Add a single script tag with shared settings (token, location, paging).

Example embed:

```html
<div
  id="inkline-listing-grid__service-status"
  data-inkline-listing
  data-inkline-schema-key="custom_objects.service_status_events"
  data-inkline-template-url="https://cdn.jsdelivr.net/gh/inkline-media/SRV-VRS-outage-notification-listing@main/templates/service-status-event.html"
  data-inkline-sort-field="custom_objects.service_status_events.event_datetime"
  data-inkline-sort-order="desc"
></div>

<script>
  window.InklineListingConfig = {
    token: "YOUR_API_TOKEN",
    locationId: "YOUR_LOCATION_ID",
    pageLimit: 100,
    maxPages: 20
  };
</script>

<script
  src="https://cdn.jsdelivr.net/gh/inkline-media/SRV-VRS-outage-notification-listing@main/outage-events-widget.js?v=1"
></script>
```

## Template Format

Your template file should contain **HTML for a single record**. The widget wraps each record inside a `<li>` element, so keep your template markup self‑contained.

Example template:

```html
<div class="listing-grid-item">
  <div class="listing-grid-item__title">{{ custom_objects.service_status_events.event_title }}</div>
  <ul class="listing-grid-item__details">
    <li>Description: {{ custom_objects.service_status_events.event_description }}</li>
    <li>
      Event Date/Time:
      {{ custom_objects.service_status_events.event_datetime }}
      {{ custom_objects.service_status_events.event_hour }}:{{ custom_objects.service_status_events.event_minutes }}
      {{ custom_objects.service_status_events.event_ampm }}
    </li>
    <li>Last Updated: {{ updatedAt }}</li>
  </ul>
</div>
```

### Token Rules

- Tokens are delimited by `{{` and `}}`.
- The content inside the token is treated as a field key.
- Example token: `{{ custom_objects.service_status_events.event_title }}`
- The widget HTML‑escapes token values for safety.

### Special Tokens

- `{{ updatedAt }}` or `{{ updated_at }}` — record last updated time (if provided by Inkline Connect).
- `{{ createdAt }}` or `{{ created_at }}` — record created time (if provided by Inkline Connect).

## Configuration (Global Settings)

You can set shared settings globally with a small inline script:

```html
<script>
  window.InklineListingConfig = {
    token: "YOUR_API_TOKEN",
    locationId: "YOUR_LOCATION_ID",
    pageLimit: 100,
    maxPages: 20
  };
</script>
```

## Configuration (Script `data-*` Attributes)

| Attribute | Required | Description | Default |
|---|---|---|---|
| `data-inkline-token` | Yes | API access token (read‑only OK) | — |
| `data-inkline-location-id` | Yes | Location ID | — |
| `data-inkline-page-limit` | No | Records per page | `100` |
| `data-inkline-max-pages` | No | Max pages to request | `20` |
| `data-inkline-base-url` | No | API base URL | `https://services.leadconnectorhq.com` |
| `data-inkline-version` | No | Inkline Connect API version header | `2021-07-28` |

## Configuration (Listing Block `data-*` Attributes)

| Attribute | Required | Description | Default |
|---|---|---|---|
| `data-inkline-listing` | Yes | Marks a listing block | — |
| `data-inkline-schema-key` | Yes | Custom object schema key | `custom_objects.service_status_events` |
| `data-inkline-template-url` | Yes | Public URL to template HTML | — |
| `data-inkline-sort-field` | No | Field key to sort by | — |
| `data-inkline-sort-order` | No | Sort direction (`asc` or `desc`) | `asc` |

## Multiple Listings on One Page

To avoid loading the JS multiple times, include the script **once** with shared settings (token, location, paging), then create multiple listing blocks with `data-inkline-listing` and per‑listing overrides.

```html
<div
  id="inkline-listing-grid__status"
  data-inkline-listing
  data-inkline-schema-key="custom_objects.service_status_events"
  data-inkline-template-url="https://cdn.jsdelivr.net/gh/inkline-media/SRV-VRS-outage-notification-listing@main/templates/service-status-event.html"
  data-inkline-sort-field="custom_objects.service_status_events.event_datetime"
  data-inkline-sort-order="desc"
></div>

<div
  id="inkline-listing-grid__announcements"
  data-inkline-listing
  data-inkline-schema-key="custom_objects.announcements"
  data-inkline-template-url="https://cdn.jsdelivr.net/gh/inkline-media/SRV-VRS-outage-notification-listing@main/templates/announcement.html"
  data-inkline-sort-field="custom_objects.announcements.published_at"
  data-inkline-sort-order="asc"
></div>

<script>
  window.InklineListingConfig = {
    token: "YOUR_API_TOKEN",
    locationId: "YOUR_LOCATION_ID"
  };
</script>

<script src="https://cdn.jsdelivr.net/gh/inkline-media/SRV-VRS-outage-notification-listing@main/outage-events-widget.js?v=1"></script>
```

## Notes & Troubleshooting

- **Cache busting:** When updating the JS file, bump the `?v=` query string to avoid cached versions.
- **CORS:** If your template file or the API is blocked by CORS, host the file from a compatible CDN (jsDelivr, Inkline Connect File Manager, etc.).
- **Raw GitHub URLs:** `raw.githubusercontent.com` serves `text/plain` and may not execute as a script in some browsers. Prefer jsDelivr or GitHub Pages.

## Security

Your API token is embedded client‑side. Use a read‑only token and rotate it if needed. If you require full security, proxy the API call server‑side.

## License

MIT (add your preferred license here).
