# Autonomous continuation: read flows, resume, AI history and Admin accounts

11 ต.ค. 2026 · canonical Draft.2 / SHA256 `b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be` unchanged

คำอนุญาตล่าสุดให้เลือก technical decisions และบันทึกเพื่อแก้ภายหลัง: [decision record](AUTONOMOUS_EXECUTION_DECISIONS.md). ไม่มี schema delta/library installation/cloud mutation/deploy ในชุดนี้

| Task | Exact operations implemented |
| --- | --- |
| CATALOG-01 | GET /courses (`get_courses`) |
| CATALOG-02 | GET /instructors/{id}/courses (`get_instructors_id_courses`) |
| ENROLL-01 | GET /me/enrollments (`get_me_enrollments`) |
| CERT-01 | GET /me/certificates (`get_me_certificates`) |
| REDEEM-01 | GET /admin/redeem-codes (`get_admin_redeem-codes`) |
| MGMT-05 | GET /admin/summary; GET /instructor/summary (`get_admin_summary`, `get_instructor_summary`) |
| LEARN-02 | PUT /learn/items/{id}/resume (`put_learn_items_id_resume`) |
| AI-02 | POST /me/ai/conversations; GET /me/ai/conversations; GET /me/ai/conversations/{id}/messages |
| AI-05 | DELETE /me/ai/conversations/{id} (`delete_me_ai_conversations_id`) |
| MGMT-01 | POST /admin/users; GET /admin/users (`post_admin_users`, `get_admin_users`) |
| MGMT-02 | GET /admin/instructors (`get_admin_instructors`) |

## Boundaries and semantics

Controllers/pipes validate exact input; typed feature-local services/projectors. Pagination shared only for scalar query validation and signed keyset protocol; route/filter/limit/owner binding prevents replay into another scope. Independent ignored CURSOR_SIGNING_SECRET generated locally; CI uses a test-only value. Key rotation invalidates cursors; no offset/mock fallback

Published Catalog summary uses explicit fields; public Instructor courses correctly return full canonical CourseDetail including description/outcomes/outline, with no item bodies/keys/transcript. Normalized Instructor grants; no compatibility role-string authority. Own Enrollment current completion counts derive from current Progress rows; certificates always use immutable issue snapshots, including archived courses

Management summaries use one scoped SQL aggregate statement; Instructor only owned courses, distinct enrolled accounts, pending manual-grading attempts counted once. Admin adds global user/pending-course counts. No PII, counters from browser mocks or read-triggered writes

Resume locks fresh Account authority → Course SHARE → Enrollment UPDATE → central ResumeWriter. Omitted position preserves; null clears; zero valid; seconds only for Video. Repeated/parallel requests update server time/order without completing/grading/reissuing. Writer failure rolls back the entire transaction

AI history fresh self scope includes Admin only for their own chats. Create with course context checks read eligibility and AI enablement; general create has no quota side effects. Account UPDATE before shared resolution prevents simultaneous same-account creates from lock upgrades. Search title/messages, activity order; message pages use position order, immutable practice snapshot/last answer. Private knowledge/provider keys stay out of response; legacy missing wire metadata fails closed. Tombstone delete returns repeat-safe 204, retaining quota/request dedupe/FK history

Admin account creation uses the Auth-owned asynchronous password kernel; fresh session/grant recheck after KDF, immutable creator audit, Learner role and optional unverified email metadata. Duplicate/concurrent creation rolls back without partial credentials/roles. Directories use normalized grants, signed owner-bound cursors and bounded canonical projections. All protected handlers now require explicit authoritative namespaces; the compatibility CSV session fallback and dead prototype writers are retired.

## Verification

- `test/database/continuation-lists-resume.pg-spec.ts`: **20 shared tests** across 8 operations; exact response schemas, visibility/filter/cursor/ownership, read no-writes, persisted summary counts, resume omission/null/zero, parallel saves, reconnect and rollback
- `test/database/ai-history.pg-spec.ts`: **13 shared tests** across 4 operations; both audience owners, course eligibility, saved search/messages/practice, metadata quarantine, parallel creates, tombstone/replay, quota preservation and forbidden foreign Admin access
- `test/database/admin-account-directory.pg-spec.ts`: **13 shared tests** across 3 operations; create/race/conflict, revoked authority after KDF, rollback, directory projections, owner-bound cursor, namespace and persistence
- Pagination **4 foundation tests**; AI metadata/practice/create **3 feature tests**; Admin create validation **3 feature tests**
- Existing actual Frontend clients → built Nest → isolated PostgreSQL: **21 new checks** (10 list/summary/resume + 5 AI history + 6 Admin accounts), total162. No mocked fetcher/provider answer/browser login substituted
- Current board covers **40/86** component APIs; 46 pending operations and 5 deferred records retained, 113 original cases unchanged. Full suite/hosted/browser evidence is added to EXECUTION_STATUS only after verification

## Remaining work

Implement remaining course authoring/review, assessment/completion/grading and provider flows under renewed decision authority. Certificate download and AI sender remain separate operations; this component does not claim generated PDF, successful AI provider calls or original full feature acceptance
