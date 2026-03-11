# Ratings API — `app/api/v1/ratings`

This folder contains the **REST API for the Rating entity**: user reviews of a **Business** (0–5 stars and optional comment). Creating a rating updates the business’s **averageRating** and **ratingCount**, which are used for discovery filtering and display.

---

## 1. Purpose and role

- **Rating** = one review: `businessId`, `userId` (ref User), optional `orderId` (ref Order), `score` (0–5), optional `comment`, timestamps.
- **Business aggregate:** On rating create, the API recomputes the average of all ratings for that business and updates `Business.averageRating` and `Business.ratingCount`. The discovery endpoint (GET `/api/v1/business` with `rating` / `minRating` query) uses these fields.
- **Rating reminder emails:** Intended rules: **on-site self-order** → send rating email 90 min after order, at most **once per 24h** per user (per business); **delivery order** → send email 60 min after order (optional 24h cap). To be implemented via a cron or scheduled job that queries eligible orders, checks a **RatingEmailLog** (userId, businessId, orderId?, sentAt) to enforce the 24h cap for on-site, sends one email per user with a link to rate, and inserts into the log. Not yet implemented.

---

## 2. Route reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ratings` | Create a rating. Body: `businessId` (required), `score` (0–5, required), optional `orderId`, optional `comment`. Identity from **session** (userId). Updates Business.averageRating and Business.ratingCount. |
| GET | `/api/v1/ratings/business/:businessId` | List ratings for a business. Optional query: `limit` (default 20, max 100), `skip` (default 0). Returns array with populated userId (display name). |
| GET | `/api/v1/ratings/:ratingId` | Get one rating by ID (populated userId). |

---

## 3. Dependencies

- **Business:** Rating references businessId; when a Business is deleted, Rating is cascaded (Rating.deleteMany({ businessId }, { session }) in business DELETE).
- **User:** Rating references userId; display names come from User on GET.
