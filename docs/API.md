# ArtDera API

All endpoints return either `{ "success": true, "data": ..., "message": ... }` or `{ "success": false, "error": { "code": "...", "message": "...", "fieldErrors": {} } }`. JSON writes reject unknown fields. IDs, query limits, dates, prices, slugs, and status transitions are validated server-side.

Authentication uses the `artdera_session` HTTP-only cookie. “Owner” means the authenticated object owner; gallery-staff operations additionally require the assigned permission.

## Authentication

| Method and route                                      | Auth     | Request / result                                                                                                    | Common errors                                                 |
| ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `POST /api/auth/register`                             | Public   | Name, email, optional phone, password, role, location, accepted terms, and selected plan; creates user and session. | `ACCOUNT_EXISTS`, `PLAN_SELECTION_REQUIRED`, `TERMS_REQUIRED` |
| `POST /api/auth/login`                                | Public   | Email/password; returns safe user and destination.                                                                  | `INVALID_CREDENTIALS`, `ACCOUNT_SUSPENDED`, `ACCOUNT_LOCKED`  |
| `GET /api/auth/session`                               | Optional | Returns current safe user, subscription, and destination.                                                           | —                                                             |
| `POST /api/auth/logout` / `POST /api/auth/refresh`    | User     | Revokes or rotates the current opaque session.                                                                      | `AUTH_REQUIRED`                                               |
| `POST /api/auth/change-password`                      | User     | Current and new password; revokes other sessions.                                                                   | `CURRENT_PASSWORD_INCORRECT`                                  |
| `PATCH /api/auth/contact` / `PATCH /api/auth/profile` | User     | Validated current-user contact or public profile fields.                                                            | `EMAIL_EXISTS`, `PHONE_EXISTS`                                |
| `POST /api/auth/sessions/revoke-others`               | User     | Revokes all sessions except the current one.                                                                        | `AUTH_REQUIRED`                                               |

## Plans, subscriptions, and payments

| Method and route                                   | Auth / role                     | Purpose                                                                                  |
| -------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/plans`                                   | Public                          | Active server-owned prices, limits, commissions, features, and billing cycles.           |
| `POST /api/plans/select`                           | Optional                        | Stores a short-lived hashed pending selection and HTTP-only selection cookie.            |
| `PATCH /api/plans/:planId`                         | Admin                           | Updates permitted plan fields and writes an audit record.                                |
| `GET /api/subscriptions/current`                   | User                            | Current subscription snapshot.                                                           |
| `POST /api/subscriptions/payment`                  | Verified user                   | Creates a provider payment intent from the database plan price.                          |
| `POST /api/subscriptions/payment/:id/confirm-demo` | Verified user, development only | Verifies demo payment, atomically activates subscription, creates invoice, and notifies. |
| `POST /api/subscriptions/change`                   | Verified seller                 | Paid upgrade preparation or validated immediate/end-of-cycle downgrade.                  |
| `POST /api/subscriptions/cancel`                   | User                            | Immediate Free fallback or end-of-period cancellation.                                   |
| `GET /api/subscriptions/payments` / `invoices`     | User                            | Private payment and invoice history.                                                     |

## Marketplace and seller operations

| Module        | Major routes                                                                                          | Access and validation                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Bootstrap     | `GET /api/bootstrap`                                                                                  | Public catalog plus safe role-scoped private bootstrap data.                               |
| Stores        | `GET /api/stores/:slug`, `GET/POST/PATCH /api/stores`, onboarding draft/complete routes               | Public reads; seller ownership for writes; server slug and plan checks.                    |
| Artworks      | `GET /api/artworks`, `GET /api/artworks/mine`, `POST/PATCH /api/artworks`, `PATCH /api/artworks/bulk` | Paginated public search; seller ownership; centralized quota and feature enforcement.      |
| Uploads       | `POST /api/uploads`, private read/delete routes                                                       | Authenticated, rate-limited, signature-checked, purpose/access controlled.                 |
| Analytics     | `GET /api/analytics?range=30d`                                                                        | Artist/gallery; server aggregates events, orders, and artwork counters.                    |
| Customers     | `GET /api/customers`                                                                                  | Pro Plus/Gallery permission; completed-order aggregation only.                             |
| Promotions    | `GET/POST /api/promotions`, `POST /api/promotions/:id/confirm-demo`                                   | Seller-owned artwork/store; exact server price bands; approval and time window enforced.   |
| Verification  | `GET/POST /api/verification`                                                                          | Seller-owned store; private submitted data is excluded from public/admin list serializers. |
| Support       | `GET/POST /api/support`, `POST /api/support/:id/messages`                                             | User-owned tickets; admin/support may access operational queues.                           |
| Notifications | list/read/read-all/delete and preferences routes                                                      | Current user only.                                                                         |
| Newsletter    | `POST /api/newsletter`                                                                                | Public validated upsert; duplicate-safe normalized email.                                  |

Artwork list query supports page/limit, query text, category, medium, style, city, store/artist/gallery IDs, price range, framing, international shipping, verification, and server-defined sort. Active sponsored artwork is inserted at no more than one in five results; expired/unapproved promotions are excluded.

## Messaging, offers, and consultations

| Method and route                                                            | Access                            | Purpose                                                                                              |
| --------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET/POST /api/messages/conversations`                                      | Participant / authenticated buyer | List or create a conversation.                                                                       |
| `GET /api/messages/conversations/:id`                                       | Participant                       | Conversation, messages, offers, and authorized consultations.                                        |
| `POST /api/messages/conversations/:id/messages`                             | Participant                       | Sanitized message/attachment references with contact/payment-link moderation flags.                  |
| `POST .../:id/read`, `PATCH .../:id/status`                                 | Participant                       | Read, archive, block, or report.                                                                     |
| `POST /api/messages/offers`, `PATCH /api/messages/offers/:id`               | Participant with offer-side rules | Create, accept, reject, counter once, or withdraw.                                                   |
| `POST /api/messages/consultations`, `PATCH /api/messages/consultations/:id` | Participant                       | Request, accept, reject, suggest alternatives, cancel, or complete. Meeting URL is participant-only. |

## Commerce

| Module       | Routes                                                                       | Rules                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Wishlist     | `GET /api/wishlist`, `POST/DELETE /api/wishlist/:artworkId`                  | Current user, duplicate-safe.                                                                                                                 |
| Following    | `GET /api/follows`, `POST/DELETE /api/follows/:storeId`                      | Current user; counters updated safely.                                                                                                        |
| Cart         | `GET /api/cart`, `POST /api/cart/items`, `DELETE /api/cart/items/:artworkId` | Persistent user cart; availability and current price returned by server.                                                                      |
| Checkout     | `POST /api/checkout`                                                         | Buyer; accepts JazzCash or Easypaisa, recalculates every amount, reserves artwork, and returns the exact receiving account plus order amount. |
| Manual proof | `GET /api/order-payments/:id/manual`, `POST /api/order-payments/:id/proof`   | Owning buyer only; restores instructions and accepts a private image, transfer number, sender details, and optional note.                     |
| Proof review | `GET/PATCH /api/admin/payment-proofs[/:id]`                                  | Administrator only; approve, reject, or request more information. Approval atomically marks the order paid and its reserved artwork sold.     |
| Demo payment | `POST /api/order-payments/:id/confirm-demo`                                  | Buyer, development only; unavailable in production.                                                                                           |
| Orders       | `GET /api/orders`, `PATCH /api/orders/:id/status`                            | Buyer/seller object authorization and actor-specific transition graph.                                                                        |
| Shipping     | `GET/PATCH /api/shipping/:orderId`                                           | Eligible order participant; persisted estimate is not represented as a courier quote.                                                         |
| Estimate     | `POST /api/shipping/estimate`                                                | Seller/staff; applies the active destination shipping rule and returns a non-binding marketplace estimate.                                    |
| Payouts      | `GET /api/payouts`                                                           | Seller only; server-calculated and read-only to seller.                                                                                       |
| Reviews      | public store list, `POST /api/reviews`, `PATCH /api/reviews/:id/respond`     | One approved review per completed eligible order item; seller response only.                                                                  |

## Gallery

All `/api/gallery/*` routes require a Gallery subscription. Staff calls are intersected with both the owner plan snapshot and assigned permissions.

- `GET/PATCH /api/gallery/profile`
- `GET /api/gallery/staff`, `POST /api/gallery/staff/invite`, `PATCH /api/gallery/staff/:id`
- `GET/POST /api/gallery/artists`
- `GET/POST /api/gallery/exhibitions`, `PATCH /api/gallery/exhibitions/:id`
- `GET /api/gallery/customers`

Staff and pending invitations count toward the database plan’s maximum seats.

## Admin

All `/api/admin/*` routes require the `admin` role and mutations are audited.

- Dashboard: `GET /api/admin/dashboard`
- User status: `PATCH /api/admin/users/:id/status`
- Artwork moderation: `PATCH /api/admin/artworks/:id/moderation`
- Verification: `PATCH /api/admin/verification/:id`
- Promotion: `PATCH /api/admin/promotions/:id`
- Review and payout operations: `PATCH /api/admin/reviews/:id`, `PATCH /api/admin/payouts/:id`
- Configuration: `POST /api/admin/shipping-rules`, `POST /api/admin/taxonomy`, `POST /api/admin/collections`, `PATCH /api/admin/settings/:key`
- Paginated resources: `GET /api/admin/resources/:resource?page=1&limit=50&q=...`

Resource names include users, stores, artworks, verifications, orders, payments, promotions, subscriptions, payouts, shipments, reviews, disputes, taxonomy/categories, collections, exhibitions, leads, content, support, notifications, newsletters, invoices, audit logs, shipping rules, settings, conversations, messages, and analytics.
