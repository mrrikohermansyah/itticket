## Diagnosis
- The error at `assets/js/pages/dashboard.js:100` is thrown when `getDocs(q)` runs with no auth attached to Firestore.
- `dashboard.js` initializes its own Firebase app and Firestore using CDN `10.12.2` (`assets/js/pages/dashboard.js:20`, `:27`), while the auth service uses `auth`/`db` from a different app/version (`assets/js/services/firebase-auth-service.js:20`, `assets/js/utils/firebase-config.js:13–21`).
- Because Firestore uses the auth of its own app instance, `request.auth` becomes null and rules deny reads.
- The failing rule is `firestore.rules:53`, which requires a signed-in user and `resource.data.user_id == request.auth.uid`.

## Changes
- Use a single shared Firebase app across auth and Firestore:
  - In `assets/js/pages/dashboard.js`, remove local `initializeApp`/`getFirestore(app)` and import the shared `db` (and `auth` if needed):
    - `import { db } from '../utils/firebase-config.js'`
    - Replace `this.db = getFirestore(app)` with `this.db = db`.
  - Keep `firebaseAuthService.getCurrentUser()` as-is; it already uses the shared `auth`.
- Optionally unify CDN versions later (10.7.1 or 10.12.2) to avoid mixed SDK modules; not required for the immediate fix if we rely solely on `firebase-config.js` exports.

## Rule Considerations
- No rule change is needed for the tickets list; once auth is attached, reads that filter by `user_id == uid` will pass (`firestore.rules:53`).
- Regular users attempting to read `admins/{adminId}` or other users will be denied by design (`firestore.rules:27`, `:20`). Client code should avoid those reads unless the user is admin.
- If you need user-side soft delete, we can expand allowed update keys for owners in `tickets` rules; propose separately if desired.

## Verification
- After code change, sign in and load the dashboard:
  - `assets/js/pages/dashboard.js:97–101` should log a successful snapshot size and not the permission error.
  - Realtime listener (`assets/js/pages/dashboard.js:106–117`) should start receiving updates.
- Confirm created tickets have `user_id == uid` and appear in the list; rule aligns with this.

## Rollback/Compatibility
- The change is localized to `dashboard.js` and leverages existing `firebase-config.js`. If issues arise, revert to previous imports and re-evaluate version unification.

Confirm to proceed and I will implement the changes and validate in the app.