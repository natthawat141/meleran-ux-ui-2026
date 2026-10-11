# Learning completion and course authoring continuation

Canonical Draft.2 / SHA256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be unchanged. Latest autonomous choices: [decision record](AUTONOMOUS_EXECUTION_DECISIONS.md).

| Task | Exact implemented HTTP subset |
| --- | --- |
| LEARN-02 | POST /learn/items/{id}/complete — post_learn_items_id_complete |
| LEARN-01 | GET /me/progress — get_me_progress |
| COURSE-01 | POST/GET /instructor/courses; POST/GET /admin/courses |
| COURSE-02 | GET /courses/{id}/authoring; GET /courses/{id}/authoring-preview |

COMPLETION-01 internal coordinator is Enrollment-owned, with Assessment BestResultReader and Certificate CompletionIssuer declared interfaces. Course SHARE → Enrollment UPDATE → Attempt SHARE lock order. Manual Article/Video only; exact current item completeness and fully graded Quiz proof; best earned/max by Decimal rational comparison (stable first tie); strict >70. Atomic first snapshot/time plus unique Certificate; preserved after content/name edits. No new issuance endpoint, PDF/network transaction or trusted client scores. Historical missing Certificate/corrupt grade evidence requires explicit repair and fails closed.

Own Progress is owner-only historical metadata (including archived courses), coherent read snapshot, signed keyset and private resume order projection. It grants no content capability.

Fresh Course create records real actor vs single normalized Instructor, UUID-derived stable slug, Draft revision1 and AI disabled. Explicit optional defaults follow Draft shapes. Each successful create request is distinct because canonical has no replay key. Management page is owned/Admin, status-filtered, canonical bounded summary with no content/keys/PII. Legacy required creator/revision cannot be fabricated; those Authoring rows are quarantined. Preview only validates its own revision and never selects private keys; owner/Admin read private authoring definitions, no learner answers or Transcript bodies.

Append-only migration 20261011050000_course_authoring adds nullable publisher audit, missing Article/Chapter metadata and immutable-submission storage. Existing nine batches unchanged; 27 models. Known first publisher/time is immutable. Legacy unknown fields remain NULL. Applied only to isolated melearn_test; full-chain rollback and checksum tested.

Known physical/contract gap: price amount_minor remains existing PostgreSQL signed 32-bit Int. Create rejects >2147483647 with 422; canonical Money currently has no upper bound. This is an agent-selected storage safeguard, not a confirmed business maximum; BigInt/Decimal or canonical range delta remains explicit follow-up. Negative/nonfinite reading_minutes is rejected physically as meaningful duration metadata.

Targeted PostgreSQL: completion-command24, course-directory16, authoring-read9; course-creator7 rerun against10 batches. Course metadata3 feature units. Actual Frontend clients add15 checks (completion6/authoring9), total177 passing against Nest/isolated PostgreSQL. Frontend preview decoder now follows canonical minimal AuthoringPreview instead of wrongly requiring full management audit metadata; canonical optional Draft body/video and fractional reading_minutes are accepted. One regression test covers minimal Draft plus keys/duplicate IDs/audit leakage rejection; full Frontend173 tests and typecheck pass. No original full feature/browser/provider acceptance implied. Full backend regression is recorded separately after completion.

Remaining COURSE-02 operations: PATCH aggregate + submit review; Review/Publish, Assessment mutations/grading/results, Blog and providers follow. Full original113 acceptance cases stay tracked.

Local Login continuation: existing Username HTTP route now calls the verified asynchronous password/session kernel. Active legacy PBKDF2-1000, string comparison and CSV-role session creation are removed. Fresh normalized authority, protected /me read via issued cookie, Web/Admin namespace, bad/unsupported credentials, disabled accounts, explicit unavailable Email branch and production Secure cookie are checked in the local-auth-kernel PostgreSQL suite. AUTH-01 remains partial until Firebase Email behavior is implemented; no extra canonical operation is counted.
