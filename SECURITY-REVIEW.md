# WishDora Security Review

## Scope and method

This review was a static inspection of repository application code and configuration. It did not contact production or external systems, exercise live endpoints, or verify deployment-specific settings. The findings below are confirmed from the reviewed code paths; they are not a claim that the repository is free of other vulnerabilities.

## Findings

### WD-SEC-001 — Unescaped user content in wish email

- **Severity:** Medium
- **Confidence:** 9/10
- **Affected code:** `backend/services/emailService.js` (lines 51–115); wish input is accepted in `backend/routes/wishes.js` (lines 108–168) and delivered through `backend/services/schedulerService.js` (lines 32–47).
- **Evidence:** The HTML email template inserts user-controlled `greeting`, `receiverName`, `message`, and `senderName` values without HTML escaping. A user can supply markup that is rendered in the recipient's email, enabling deceptive branded content or links.
- **Impact and prerequisites:** An authenticated user who can create a wish can influence the HTML received by the wish recipient.
- **Recommended remediation:** Escape all user-controlled values for HTML text context before template insertion. If rich text is a product requirement, use a narrowly defined allowlist and a maintained sanitizer.
- **Remediation:** Wish email dynamic text and image attributes are escaped at render time; wish messages remain plain text with preserved line breaks.
- **Verification:** `backend/test/emailService.test.js` covers HTML-like input, attribute injection, Unicode, and ordinary message formatting.
- **Status:** Fixed in application code and covered by regression tests.

### WD-SEC-002 — Password-reset OTP exposure

- **Severity:** Medium
- **Confidence:** 9/10
- **Affected code:** `backend/routes/auth.js`; development reset UI in `frontend/signin.html`.
- **Evidence:** The reset OTP was logged after storage and could also be returned in a development-only response when email delivery failed.
- **Impact and prerequisites:** A person or service with access to application logs could use a still-valid OTP to reset the associated account password.
- **Remediation:** Removed OTP logging and the development-only OTP response; auth error logs now include only a fixed event label and error class, not exception details.
- **Verification:** `backend/test/authOtpLogging.test.js` exercises successful and failed email delivery and verifies that the OTP is absent from captured logs and HTTP responses.
- **Status:** Fixed in application code; historical deployment logs still require operational review.

### WD-SEC-003 — Password reset did not revoke existing JWTs

- **Severity:** Medium
- **Confidence:** 8/10
- **Affected code:** `backend/routes/auth.js`; `backend/middleware/auth.js`; `backend/models/User.js`; user JWT issuers in `backend/controllers/authController.js`.
- **Evidence:** Before remediation, password reset changed the password and cleared the OTP, but authentication middleware accepted signed, unexpired tokens without checking a revocation counter.
- **Impact and prerequisites:** A party holding a previously issued account token can continue using it until it expires, even after the account owner resets the password.
- **Remediation:** Added a persisted per-user token version. All user-token issuers include it; both required and optional authentication compare it with the account's current version. Password reset atomically changes the password, consumes the OTP, and increments that user's version.
- **Compatibility and failure handling:** Existing tokens and account records without a version are interpreted as version 0. MongoDB's atomic increment initializes a missing stored version to 1 on reset, revoking those legacy tokens. Token-version lookup failures do not grant access.
- **Verification:** `npm --prefix backend test` passed a route-level regression test covering a valid legacy token before reset, successful reset, rejection of that token afterward, successful login with a new token, another user's unaffected legacy token, schema default behavior, and failure-safe optional authentication. The test uses an in-memory persistence stub; no live MongoDB was used.
- **Status:** Fixed in application code and covered by automated tests.

## Limitations and unverified areas

- No production or external host was contacted; no destructive or live testing was performed.
- Deployment-specific JWT settings, database permissions and network restrictions, frontend/CDN security headers, dependency advisories, and production log access and retention were not verified.
- No production traffic or live database was used. The backend test suite ran locally; dependency scans, secret scans, and deployment-level checks were not run.
- Backend HTTP access logging uses Morgan's default `dev` format, which records method, URL, status, response size, and timing; the app does not configure request-body logging. Application logs are written to stdout/stderr and may be retained by the hosting platform or log aggregator. No repository `.log` files were found during this follow-up; external historical logs were not inspected.

## Operational action for historical logs

Review the hosting provider and any connected log aggregator for logs covering the period when password-reset OTPs may have been emitted. Limit review to authorized operators, avoid copying or displaying OTP values, and follow the provider's retention and deletion controls to remove or securely expire affected records. If there is evidence of unauthorized access or a potentially exposed OTP still within its validity window, follow the incident-response process and invalidate the affected reset request. Confirm future retention and access controls for stdout/stderr logs.

## Priority

Review/delete affected historical logs under the hosting provider's controls. Review the remaining unverified deployment controls before drawing broader conclusions about the production security posture.
