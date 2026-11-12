# Security Spec for Smlouvy pro živnostníky

## Data Invariants
1. Craftsman data (contracts, clients, profiles, site logs) is private to the authenticated owner (`request.auth.uid == userId`).
2. Documents cannot be read or listed by unauthenticated users or other users.
3. Path variables (userId, clientId, contractId, logId, shareId) must conform to `isValidId()` (<= 128 characters alphanumeric, dashes, underscores).
4. `public_shares/{shareId}` documents allow public `get` so that clients who receive the share link can view and sign the contract remotely.
5. In `public_shares/{shareId}`, clients without an account can only update `clientSignature`, `clientSignedAt`, `signerName`, and transition `status` from `'pending'` to `'signed'`. They cannot alter `contractNumber`, `totalAmount`, `ownerId`, or `contractData`.
6. Craftsman can create their own `public_shares` documents (as authenticated owner with UID or guest craftsman with pending status). Owner can update and delete their own shares.

## The "Dirty Dozen" Payloads (Designed to Fail)
1. **Unauthenticated List on /users/{userId}/contracts** -> REJECTED (Unauthorized)
2. **User B reading User A's client contacts** -> REJECTED (Mismatch UID)
3. **User B writing a contract into User A's subcollection** -> REJECTED (Mismatch UID)
4. **Malicious user injecting 2MB payload into doc ID** -> REJECTED (Failed isValidId)
5. **Client attempting to change totalAmount in public_shares** -> REJECTED (affectedKeys violation)
6. **Client attempting to overwrite ownerId in public_shares** -> REJECTED (ownerId immutable)
7. **Client attempting to re-sign an already 'signed' contract** -> REJECTED (Terminal state check)
8. **User attempting to create site log with missing required fields** -> REJECTED (isValidSiteLog check)
9. **User attempting to delete another craftsman's profile** -> REJECTED (Must be owner)
10. **Malicious user updating public_shares with unrecognized ghost fields** -> REJECTED (hasOnly affected keys check)
11. **User reading public_shares with invalid ID format** -> REJECTED (isValidId check)
12. **Blanket read/list on /public_shares** -> REJECTED (Listing public shares is strictly forbidden; only individual document get by known shareId is permitted)
