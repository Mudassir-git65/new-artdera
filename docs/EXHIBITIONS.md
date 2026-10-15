# ArtDera online exhibitions

The public launch campaign lives at `/exhibition`. It presents **ArtDera Online Exhibition 2026**, opening **24 November 2026 at 00:00 Pakistan time** (`2026-11-23T19:00:00Z`). Each published exhibition also has a permanent viewing room at `/exhibition/<slug>`. Exhibition content uses the existing MongoDB `Exhibition` collection; artist biographies and artwork details come from the marketplace’s current records.

## The 2026 launch page

Before opening, the cinematic hero displays a live Days / Hours / Minutes / Seconds countdown, **Get Early Access** and **Notify Me**. Selected artwork previews and artist introductions remain visible, while the complete viewing room displays **The Doors Open 24.11.2026**. At the opening instant, the countdown and launch CTAs automatically change to **Exhibition Now Live — Enter Exhibition**, and the viewing room becomes available. The clock uses the server timestamp, with a one-second client update and regular data refresh.

The landing page includes exhibition previews, featured works, real statistics, artists, curator’s note, a cinematic trailer, artwork stories, ArtDera’s mission, private collector preview registration, advisor contact and a final opening CTA. Before opening, artwork dialogs prioritise stories and early access; prices and purchase controls become available in the live exhibition. Existing marketplace listings remain available through the marketplace.

In **Admin → Exhibitions**, open **The 2026 launch campaign → Campaign artwork, trailer & advisor settings**. Select a curated exhibition, configure an optional hero video, trailer video, trailer poster and ArtDera’s official WhatsApp advisor number. These settings are saved in `SystemSetting` under `exhibition-launch-2026`. The existing ArtDera film at `/hero.mp4` is the starting trailer; replace it with the final exhibition film through these controls.

By default, the campaign uses a published exhibition with slug `artdera-online-exhibition-2026`. Until that record is published, the landing page previews real, approved public ArtDera works and accurately labels them as early collection previews. No sample artists or exhibition records are inserted into production. Draft selections are never exposed by the campaign.

Early-access, Notify Me, private-preview and campaign artwork enquiries work before a curated exhibition is published. Find them under **Launch registrations**, with CSV export and manual follow-up links. They are saved in `ExhibitionLaunchLead`; early-access and Notify Me subscriptions also join the existing newsletter database. The forms save consent and contact preferences; they do not send automated emails or book appointments.

## Create an exhibition

1. Sign in as an administrator and open **Admin → Exhibitions** (`/admin/exhibitions`).
2. Choose **Create exhibition**. Enter a title, URL slug, theme, introduction and opening/closing dates. Date inputs use the administrator’s local time; the display time zone controls the dates shown to visitors.
3. Select participating artists and approved artworks. Reorder the selected works to set the gallery’s sequence. Artist images, names, biographies and profile links update from existing public profiles.
4. Assign selected works to virtual rooms. Featured Collection, Contemporary Art, Emerging Artists and Collector’s Selection are supplied as editable starting rooms. Additional rooms can be created without code changes.
5. Add a curator’s note, curator name, optional story image, private preview instructions and live sessions. Event URLs must use HTTPS; event time zones use IANA names such as `Asia/Karachi` or `Europe/London`.
6. Set **Scheduled**, **Active** or **Completed**, enable **Publish online**, and save. Leave publication disabled while preparing a draft. A cover image or at least one artwork is needed to publish; without a cover, the first selected artwork becomes the hero image.

Opening and closing dates control each individual exhibition’s phase, countdowns and purchase buttons. The main `/exhibition` marketing campaign uses the fixed 24 November 2026 opening date. Individual exhibition pages remain available to revisit after closing; unpublishing removes public access to those pages.

The campaign stays visible while curation is in progress, with working opening-list registrations and real public artwork previews. The application does not insert sample artists or exhibitions into production.

## Artwork availability and purchasing

Saved exhibition selections include **Available**, **Reserved** and **Sold** controls. Changes apply to the actual marketplace artwork and appear in every exhibition featuring that work. Admin changes cannot replace checkout-owned reservations or artworks attached to active orders. Reactivating a sold work respects the seller’s active subscription and listing limits.

Artwork dialogs show medium, dimensions, year, price and availability. **Buy Artwork** uses the existing cart and checkout; it is enabled for available works during an open exhibition. Availability refreshes every minute and when returning to the page, while the cart API verifies stock again before adding a work. Sold and reserved works remain on view and accept enquiries. Unapproved works, demo records and works from unpublished stores are filtered out.

Enter ArtDera’s official advisor number in **ArtDera advisor WhatsApp number**, using country code and number as digits without a plus sign. This enables the WhatsApp advisor button. The button stays disabled until a real number is configured.

## Collector requests

Private preview requests and artwork enquiries are saved in `ExhibitionRegistration` with contact consent. Find them under **Manage exhibition → Collector requests**, with a CSV export of the latest 500 requests. Duplicate requests for the same email, exhibition and request type/artwork update the existing request. Private preview requests close when the exhibition closes or preview registration is disabled.

Requests require manual follow-up by the ArtDera team. Submitting a request does not send an automated email or automatically book an appointment. Collectors Circle registrations use the existing newsletter subscription system with source `exhibition-collectors-circle`.

## API and validation

- Public reads: `GET /api/exhibitions`, `GET /api/exhibitions/:slug`.
- Collector submissions: `POST /api/exhibitions/:slug/registrations`, with rate limiting and explicit consent.
- Campaign registrations: `POST /api/exhibitions/launch/registrations`.
- Campaign settings: `GET/PATCH /api/admin/exhibitions/launch-settings`.
- Campaign contact requests: `GET /api/admin/exhibitions/launch-registrations`.
- Admin management: `GET/POST /api/admin/exhibitions`, `GET/PATCH /api/admin/exhibitions/:id`.
- Selection search: `GET /api/admin/exhibitions/candidates?q=...`.
- Requests: `GET /api/admin/exhibitions/:id/registrations`.
- Availability: `PATCH /api/admin/exhibitions/:id/artworks/:artworkId/availability`.

Admin APIs enforce the administrator role, validate date ranges and room membership, and audit content and availability changes. The existing gallery-owned exhibition endpoints and marketplace purchase flows remain in place. New schema fields are additive; existing records need no destructive migration. Published exhibition URLs are included in the sitemap.

Run `npm run typecheck`, `npm test` and the existing production build before deployment. Exhibition integration coverage is in `tests/exhibitions.test.ts`, including the Pakistan-time opening boundary, server-rendered locked/live states, pre-publication signup persistence, draft privacy and media settings.
