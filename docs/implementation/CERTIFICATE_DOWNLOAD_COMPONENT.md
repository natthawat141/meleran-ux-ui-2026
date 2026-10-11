# CERT-01 private download — scoped D07 execution choice

Canonical Draft2 SHA256 `b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be`; Scope §§2.7,5.7,6.7. Latest user permits documented agent choices.

**GET /me/certificates/{id}/download · get_me_certificates_id_download** now returns canonical `CertificateDownload {filename,content_type:"text/plain",content}` from actual PostgreSQL issuance. This preserves the current HTTP shape and supports the existing Frontend text-file download. It does not declare the mock-era shape a frozen PDF/storage/signing contract.

Confirmed: owner only, original issued recipient/course/date/code; no recompletion or second issuance; file failure can retry from the same persisted completed snapshot. Fresh session/normalized identity → owned Enrollment SHARE → Certificate SHARE → immutable metadata projection; deterministic rendering after the read authorization point. Admin has no cross-account bypass. Historical completion remains readable after archive/name/role changes. Zero database/file/network writes, no public download URL, `Cache-Control: private,no-store`.

Agent-selected technical renderer: UTF8 Thai text, issuance-date ISO string, control characters flattened in display fields, deterministic ASCII filename from a SHA256-derived Certificate ID fragment. No new dependency, schema or endpoint. PDF layout/font/storage/expiry/signing remain separate future contract choices; no PDF/Production claim.

Verification:8 actual HTTP/PostgreSQL cases for canonical payload, immutable names/time/code, repeated/concurrent download/reconnect, foreign Instructor/Admin/Guest, namespace/unknown IDs, post-guard revocation, render-failure retry and archive. Actual unchanged Frontend certificateApi.download adds4 checks to213 prior checks, total217. Existing host77 checkpoint `0caca8e` passed Backend714 tests (53foundation+76units+585PG) and Frontend176 tests/build/typecheck/contracts. Current download full regression awaits its own pushed SHA. Browser/original113 acceptance remain pending.
