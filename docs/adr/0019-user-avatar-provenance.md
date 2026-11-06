# ADR-0019: User avatar provenance and provider sync

- **Status:** Accepted
- **Date:** 2026-11-06
- **Ticket:** GitHub issue #366

## Context

A User's profile photo can come from Google sign-up or linking, or from an
upload. Google sign-in backfills details the User is missing, including the
profile picture. Removing a photo clears `personalDetails.imageUrl`, which made
the field look empty again; the next Google sign-in re-imported the Google
picture. Removal was therefore not durable for Google-linked Users, and the
chrome avatar returned from initials to the picture the person had just removed.

The stored URL is not enough to decide what to do next: an empty field can mean
"never set", "the provider picture expired", or "the person explicitly removed
their photo". Those states need different behaviour, especially because an
uploaded Cloudinary asset is ours to delete while a Google-hosted picture is
not.

## Decision

### 1. Store where the current photo came from

`personalDetails` carries `imageSource` (`google` | `upload` | `removed`) and
`imageUpdatedAt` alongside `imageUrl`. `imageSource` is server-owned and never
client-settable. The fields stay flat beside the existing `imageUrl` rather than
becoming a subdocument, so legacy rows need no data migration and the stored
display URL remains single-valued.

- `google`: imported from the linked Google account.
- `upload`: uploaded by the person; Project Imperium owns the asset.
- `removed`: the person explicitly removed the photo; `imageUrl` is unset.

### 2. Provider sync never overrides user intent

Google sign-up records `imageSource: "google"`. Linking or a later Google
sign-in fills the picture only when it is empty and `imageSource` is neither
`upload` nor `removed`. Names and language keep their existing "fill only when
missing" behaviour; only the avatar becomes user-owned.

### 3. Removal is explicit and source-aware

Removing the photo unsets `imageUrl` and records `imageSource: "removed"` with
`imageUpdatedAt`. An uploaded asset is deleted from Cloudinary first; a
Google-hosted picture is only cleared locally because Project Imperium does not
own it. A failed remote deletion leaves the stored picture unchanged. Replacing
or uploading a photo records `imageSource: "upload"` and clears the removed
state. A DELETE for an account that has never had a photo records nothing, so
the field stays eligible for a later provider seed.

Legacy rows without a source keep their current URL and are treated as
user-owned for future provider sync. A legacy row with no stored URL remains
eligible for a provider seed, because an empty legacy field cannot be
distinguished from a removal made before provenance existed. A legacy Google
URL that is later removed gets `imageSource: "removed"` at that moment.

## Consequences

**Positive**

- A removed photo stays removed across Google sign-ins; the avatar stays initials.
- Provider sync cannot silently replace an uploaded photo.
- The removal route only deletes assets Project Imperium owns.
- Provenance gives future UI (for example "Use my Google photo") a safe basis.

**Negative / costs**

- Two server-owned fields are added to `personalDetails` and must stay excluded
  from client profile responses.
- Existing Google pictures imported before this decision have no source until
  the person next uploads or removes a photo; the backfill safety still holds
  because their URL is not blank.
- A Google URL that expires is cleared only when the person acts; the avatar
  falls back to initials rather than silently re-importing the picture.

## Related

- ADR-0018 establishes the account surface and Profile's ownership of the photo.
- `docs/product/users.md` §3.11 owns the profile photo rules.
