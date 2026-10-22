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
- **Status:** Unresolved in this review; no code changes or regression tests were made.

### WD-SEC-002 — Password-reset OTP is logged

- **Severity:** Medium
- **Confidence:** 9/10
- **Affected code:** `backend/routes/auth.js` (line 125; OTP is stored at lines 118–122 and accepted at lines 201–218).
- **Evidence:** The reset OTP is written to application logs after it is stored. The unauthenticated password-reset endpoint accepts the OTP until it expires.
- **Impact and prerequisites:** A person or service with access to application logs could use a still-valid OTP to reset the associated account password.
- **Recommended remediation:** Remove the OTP from logs and review access and retention for existing logs that may contain reset credentials.
- **Status:** Unresolved in this review; no code changes or regression tests were made.

### WD-SEC-003 — Password reset does not revoke existing JWTs

- **Severity:** Medium
- **Confidence:** 8/10
- **Affected code:** `backend/routes/auth.js` (lines 212–218); `backend/middleware/auth.js` (lines 44–66).
- **Evidence:** Password reset changes the password and clears the OTP, but authentication middleware accepts any correctly signed, unexpired token for an active account without checking a token version or password-change time. The reviewed default token lifetime is seven days.
- **Impact and prerequisites:** A party holding a previously issued account token can continue using it until it expires, even after the account owner resets the password.
- **Recommended remediation:** Revoke existing tokens on password reset, for example by incrementing a per-user token version and checking it during authentication, or by validating tokens against a stored password-change timestamp.
- **Status:** Unresolved in this review; no code changes or regression tests were made.

## Limitations and unverified areas

- No production or external host was contacted; no destructive or live testing was performed.
- Deployment-specific JWT settings, database permissions and network restrictions, frontend/CDN security headers, dependency advisories, and production log access and retention were not verified.
- No dynamic tests, dependency scans, secret scans, or full test suite were run as part of this static review.

## Priority

Address the OTP logging and unescaped email content promptly, then implement and test token revocation on password reset. Review the unverified deployment and operational controls before drawing broader conclusions about the production security posture.
