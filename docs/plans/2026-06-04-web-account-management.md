# Web Account Management Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the web-first account experience for Xiake: email/password and Google login, recovery question password reset, account menu, synced favorites, user management page, photo uploads, and API application records.

**Architecture:** Keep the existing homepage layout and Home menu, but remove account navigation from that menu and add a separate account button beside it. Extend the current JSON-file-backed user/photo/API services rather than introducing a database. Build account UI as progressive enhancement around existing static HTML, controllers, and Express routes.

**Tech Stack:** Node/Express, JSON file persistence under `~/.xiake`, vanilla JS modules, existing CSS theme tokens, Jest, Supertest, Sharp/Multer for photos.

---

## Decisions Locked

- Web first; mini-program follows later.
- Home menu stays conceptually unchanged; account button is separate.
- Signed-out account button opens a modal with login, register, forgot password, Google login.
- Signed-in account button opens a dropdown matching `home-view-menu-dropdown`, with management page and logout.
- Email/password login is supported.
- Registration stores email, password hash, recovery question, recovery answer hash. No email sending and no email verification.
- Forgot password flow is email -> recovery question -> answer + new password.
- Manual accounts can bind Google. Google accounts can later set email/password.
- Signed-out favorites remain local cache; signed-in favorites save to account. Login should support syncing local favorites to account.
- Upload requires login. Max upload size is 10MB.
- Server compresses uploaded images for public display and deletes originals because high-resolution originals are not offered.
- Uploads are reviewed before appearing on share map.
- If an approved photo is edited, the old approved version continues to display until the edit is approved.
- User delete physically deletes photo files and metadata.
- API application uses existing public web API form fields. Anonymous users can apply. Signed-in users can have one account-level application record, distinct from anonymous applications for future quota levels.

---

## Agent Recon Notes

- Existing `index.html` already contains `data-view="user"` inside the Home menu. This must move out to the new account button flow; `#tab-panel-user` can remain as the Manage destination.
- Existing `UserPanelController` uses `/auth/me`, `/auth/google/start`, `/auth/wechat/web/start`, `/auth/logout`, and already renders favorites/recent lists. It should become the account UI owner.
- Existing `/api/user/*` routes require Bearer tokens, but web auth uses `xiake_session` HttpOnly cookie. Backend must accept cookie sessions there, otherwise web favorites cannot sync after cookie login.
- Existing `FavoriteController` is localStorage only. It renders `.favorite-name` / `.favorite-actions`, while CSS mainly styles `.favorite-item-name` / `.favorite-item-coords` / `.favorite-item-remove`; this mismatch contributes to the broken popover layout.
- Existing photo user edit mutates the approved record and sets it to pending, which removes it from public gallery. The desired behavior requires pending-edit versioning.
- Existing photo service keeps originals and exposes `/api/photos/:id/original`; the new product requirement is compression-only public display with original deletion.
- Existing API application service already supports anonymous vs user ownership, but does not enforce one application per signed-in user.

---

## Task 1: Backend Email Account Foundation

**Files:**
- Modify: `server/services/UserService.js`
- Modify: `server/routes/auth.js`
- Test: `tests/unit/server/auth-routes.test.js`
- Test: `tests/unit/server/user-auth-foundation.test.js`

**Step 1: Write failing tests**

Add tests for:
- `POST /auth/register` creates a user with email identity and session.
- `POST /auth/login` accepts email/password and returns session.
- Wrong password returns 401.
- `GET /auth/recovery-question?email=...` returns only the question.
- `POST /auth/reset-password` accepts email, answer, newPassword.
- Recovery answer mismatch is rejected and never returns the answer.

**Step 2: Implement UserService email identity**

Add methods:
- `normalizeEmail(email)`
- `hashSecret(value, salt?)` using `crypto.scryptSync` or `crypto.pbkdf2Sync`.
- `verifySecret(value, stored)`
- `createEmailUser({ email, password, recoveryQuestion, recoveryAnswer })`
- `loginEmailUser({ email, password })`
- `getRecoveryQuestion(email)`
- `resetPasswordWithRecovery({ email, recoveryAnswer, newPassword })`
- `setPasswordForUser(userId, { email, password, recoveryQuestion, recoveryAnswer })`

Data model:
- Store an identity with `provider: 'email'`, `subject: normalizedEmail`, `email`, `passwordHash`, `recoveryQuestion`, `recoveryAnswerHash`.
- Never store plaintext password or recovery answer.

**Step 3: Add auth routes**

Add routes:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/recovery-question`
- `POST /auth/reset-password`
- `POST /auth/bind/google/start` or a clear route for future Google binding if existing OAuth callback can receive an active session.
- `POST /auth/password` for Google users to set password later if needed.

Reuse existing `sendLogin`, cookie session, bearer token support, and `/auth/me`.

**Step 4: Verify**

Run:

```bash
npm test -- tests/unit/server/auth-routes.test.js tests/unit/server/user-auth-foundation.test.js
```

Expected: new and existing auth tests pass.

---

## Task 2: Backend Google Binding Compatibility

**Files:**
- Modify: `server/services/UserService.js`
- Modify: `server/services/OAuthLoginService.js`
- Modify: `server/routes/auth.js`
- Test: `tests/unit/server/auth-routes.test.js`
- Test: `tests/unit/server/user-auth-foundation.test.js`

**Step 1: Write failing tests**

Cover:
- Google login with the same email as an existing email identity links to that user when explicitly binding or when safe by existing session.
- Google login without a matching user still creates a Google user.
- Manual email user can bind Google without losing favorites/recent locations.
- Google user can set email/password without losing Google identity.

**Step 2: Implement conservative binding**

Prefer explicit binding via an active session. Avoid silently merging accounts only by email unless tests and product decision allow it. If a Google identity belongs to another user, return 409.

**Step 3: Verify**

Run targeted auth/user tests.

---

## Task 3: Web Auth Client and Header Account UI

**Files:**
- Modify: `index.html`
- Modify: `styles/main.css`
- Modify: `src/controllers/AppController.js`
- Create: `src/services/AuthService.js`
- Create or modify tests under `tests/unit/` for header/account UI source guards.

**Step 1: Write failing tests**

Add source/DOM tests that assert:
- `home-view-menu-dropdown` no longer contains `data-view="user"`.
- Header has an account button beside Home menu.
- Signed-out account button opens `#auth-modal`.
- Modal has login/register/forgot tabs and close button.
- Signed-in account menu uses `home-view-menu-dropdown` style family and contains manage/logout.

**Step 2: Implement AuthService**

Methods:
- `getCurrentUser()`
- `register(payload)`
- `login(payload)`
- `logout()`
- `getRecoveryQuestion(email)`
- `resetPassword(payload)`
- `startGoogleLogin()`
- local token/cookie awareness if server returns token.

**Step 3: Implement header UI**

Do not change existing homepage layout beyond adding the account button/dropdown/modal. Reuse existing icon button sizing and dropdown style. Ensure desktop/mobile click outside and Escape close behavior.

**Step 4: Verify**

Run targeted unit/source tests and inspect manually in browser later.

---

## Task 4: Favorites Menu Redesign and Sync

**Files:**
- Modify: `index.html`
- Modify: `styles/main.css`
- Modify: `src/controllers/FavoriteController.js`
- Modify: `src/services/StorageService.js`
- Create: `src/services/UserDataService.js`
- Test: existing favorite/storage tests or new `tests/unit/favorites-auth-sync.test.js`

**Step 1: Write failing tests**

Cover:
- Favorite popover is anchored and does not overlap the input/add button on mobile.
- Signed-out add favorite saves local favorite.
- Signed-in add favorite calls `/api/user/favorites`.
- Sign-in sync can merge local favorites into account without duplicates.
- Signed-out users are not forced to login when adding favorites.

**Step 2: Implement UserDataService**

Wrap:
- `GET /api/user/favorites`
- `POST /api/user/favorites`
- `DELETE /api/user/favorites/:id`
- optionally recent locations.

**Step 3: Rework FavoriteController rendering**

Use a stable layout:
- top row: title + count
- primary action row: add current favorite
- list rows with switch/remove controls
- empty state without giant icon overlap

Use theme tokens and responsive constraints.

**Step 4: Verify**

Run tests and browser-check desktop/mobile.

---

## Task 5: Photo Upload Limits and Original Deletion

**Files:**
- Modify: `server/services/PhotoService.js`
- Modify: `server/routes/photos.js`
- Test: `tests/unit/server/PhotoService.test.js`
- Test: `tests/unit/server/photos-routes.test.js`
- Test: `tests/unit/server/photos-original-security.test.js`

**Step 1: Write failing tests**

Cover:
- Uploads above 10MB are rejected.
- Successful upload writes compressed display image and does not retain original high-resolution file.
- Public photo response never exposes original URL.
- `GET /api/photos/:id/original` should be removed or return 404/410 if high-res originals are no longer offered.

**Step 2: Implement compression-only storage**

Change constants from 20MB to 10MB. Replace `originals/` retention with temp file or in-memory Sharp pipeline:
- Generate public display image, likely under `thumbs/` or `photos/display/`.
- Store `thumbFile` or `displayFile`.
- Do not retain `origFile`.

**Step 3: Verify**

Run photo service/routes tests.

---

## Task 6: Approved Photo Edit Versioning

**Files:**
- Modify: `server/services/PhotoService.js`
- Modify: `server/routes/photos.js`
- Test: `tests/unit/server/PhotoService.test.js`
- Test: `tests/unit/server/photos-routes.test.js`

**Step 1: Write failing tests**

Cover:
- Approved photo remains public after owner submits metadata edits.
- Pending edits are visible to owner in `/api/photos/mine`.
- Public `/api/photos` continues returning approved fields until admin approves pending edit.
- Admin approval applies pending edit to public fields.

**Step 2: Implement pending edit model**

Add fields like:
- `pendingEdit`
- `pendingReviewStatus`
- `pendingReviewNote`

User edits should not overwrite public fields immediately when current photo is approved.

**Step 3: Verify**

Run photo tests.

---

## Task 7: API Application Account Records

**Files:**
- Modify: `server/services/ApiApplicationService.js`
- Modify: `server/routes/applications.js`
- Test: `tests/unit/server/token-management-api-applications-audit.test.js` or new route/service tests.

**Step 1: Write failing tests**

Cover:
- Anonymous applications still submit with existing fields.
- Signed-in user submission stores `ownerType: 'user'`.
- One signed-in account can have only one application record; repeat returns existing/update or 409 depending chosen behavior.
- Anonymous applications remain unrestricted by account rule.
- `GET /api/applications/mine` returns signed-in user application.

**Step 2: Implement**

Use existing form fields. For signed-in users, enforce uniqueness by `userId`.

**Step 3: Verify**

Run API application tests.

---

## Task 8: Web Management Page

**Files:**
- Modify: `index.html` or create `public/account.html` depending final routing.
- Modify: `styles/main.css`
- Create: `src/controllers/AccountController.js`
- Create: `src/services/PhotoUploadService.js`
- Test: source/DOM tests for management sections.

**Step 1: Write failing tests**

Assert management page includes:
- Favorites section.
- My uploads section with status, edit, delete.
- Upload form matching admin fields: photo, description, locationName, uploaderName, takenAt, lat, lon.
- API application section using existing API page fields.
- Upload form is unavailable when signed out.

**Step 2: Implement**

Prefer a tab/panel in existing app shell if that keeps Home menu consistent. If a standalone page is simpler, use the same header/topbar and theme tokens.

**Step 3: Verify**

Run tests and browser-check desktop/mobile.

---

## Task 9: Browser Verification

**Files:**
- Test: `tests/e2e/` if feasible.

**Step 1: Start local server**

Use existing project scripts or `node server/index.js` if appropriate.

**Step 2: Verify desktop**

Check:
- Home menu unchanged.
- Account button signed-out modal.
- Register/login/forgot flows.
- Favorite popover no overlap.
- Management page sections.

**Step 3: Verify mobile**

Check:
- Header controls fit.
- Favorite popover anchors below search row and does not cover text incorrectly.
- Auth modal is scrollable and closeable.

**Step 4: Run final tests**

Run targeted test groups and `git diff --check`.
