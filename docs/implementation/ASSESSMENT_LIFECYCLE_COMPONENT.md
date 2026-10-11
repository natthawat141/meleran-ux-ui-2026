# Assessment lifecycle — Wave 12–13 component evidence

Canonical **1.0.0-draft.2**, SHA256 `b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be`. Scope Final1.6 §§2.6,3.4–3.5,5.6,6.6 remain business authority. Latest user authorizes documented agent choices and continued implementation; former D06/D09/D10 waits do not stop this subset.

| Task | Exact operation | Implementation |
| --- | --- | --- |
| ASSESS-01 | POST /learn/items/{id}/attempts · post_learn_items_id_attempts | Start/resume immutable snapshot;201 new,200 resumed |
| ASSESS-01 | PUT /learn/attempts/{id}/answers · put_learn_attempts_id_answers | SaveAnswersRequest → WireAttemptView |
| ASSESS-01 | POST /learn/attempts/{id}/submit · post_learn_attempts_id_submit | EmptyRequest → WireAttemptView200 |
| ASSESS-02 | GET /learn/items/{id}/results · get_learn_items_id_results | QuizResults; existing owned Attempt GET remains |
| GRADE-01 | GET /instructor/grading-queue · get_instructor_grading-queue | GradingQueuePage,limit/cursor only |
| GRADE-01 | PUT /instructor/attempts/{id}/questions/{question_id}/grade · put_instructor_attempts_id_questions_question_id_grade | QuestionGradeRequest → WireAttemptView |

## Confirmed behavior

Fresh normalized roles/session and learning eligibility; Published enrolled Quiz only for learner commands, no own-course learning or Admin participation. Grade requires current owner Instructor in Web; Admin/foreign Instructor forbidden. Historical self results remain readable after archive/role changes without granting content. All four question types and immutable questions/options/keys/maxima; public SQL projection never selects keys. Answers freeze on Submit. Pending manual scores never expose a final result. Strict raw score **>70%**, fully graded only; lower retake cannot clear earlier best/Progress/first completion/certificate. Last auto/manual grade invokes Enrollment-owned CompletionCoordinator and Certificate issuer in the same transaction.

## Agent-selected protocols, changeable by user

- Start serializes via owned Enrollment UPDATE. Resume the sole `in_progress` attempt; multiple legacy active attempts fail closed. Every explicit Start after submission starts a retake, including while another attempt awaits review. There is no fabricated request ID for canonical EmptyRequest. Int attempt-number overflow409; no business attempt limit.
- Save is a per-question patch: supplied answers replace that question, omitted questions remain, `{}` clears its draft. Validate the whole map before any upsert; unknown/foreign question or option IDs and score/result claims422. Canonical lacks a revision; serialized last accepted draft write wins. Frozen attempt409.
- Choice auto-grading uses exact selected-set equality against frozen key, including multiple-choice; full points or zero, no invented partial-credit scale. Every snapshot question needs a substantive answer before Submit. Same Submit returns original/current result and does not change submission time or create an attempt.
- Essay default text; snapshot `response_mode:text/image/either` honored by submission, projections and best proof. Image type requires image. Learner wire schema omits response_mode; no undocumented field added. Existing Frontend authoring adapter already maps image-only questions to image type; broader learner rendering of either-mode remains a UI gap.
- Manual score uses canonical half-point steps and snapshot maximum, including zero-point questions. First recorded grade/comment/provenance immutable; identical replay returns current view, different payload409. No revision/idempotency endpoint added. Regrading policy/UI can be changed explicitly later.
- Image is stored as submitted reference, never fetched by Nest: HTTPS, single-slash asset path or PNG/JPEG/WebP Data URL; no SVG/javascript/protocol-relative URL. Agent technical budget2MiB characters/reference, Save raw JSON12MiB; no new upload/storage endpoint. This is an operational bound, not a Scope-confirmed image policy. Production upload/storage remains separate D09 work.
- Queue order submitted_at DESC/id ASC; signed cursor bound to Instructor/limit. Current ownership locked; no foreign answer IDs selected. Learner display name is a SQL statement/RepeatableRead snapshot, without taking learner Account lock after Enrollment. This avoids inversion with learning writer Account→Enrollment locks. Existing managed read tests retained.
- Results order number DESC/id ASC; best compares exact earned/max rational values across definition versions, stable earliest tie. Results GET holds owned Enrollment SHARE (writers UPDATE), reads immutable proof and never repairs/evaluates completion.

## Modules/transactions

`AssessmentReadModule` exports only BestResultReader/ManagedAttemptReader. `CompletionModule` consumes these readers plus CertificatesModule. `AssessmentsModule` consumes CompletionModule, own read/write/history services; `EnrollmentsModule` consumes CompletionModule. No cycle, no cross-feature private imports, no cross-owner Prisma write, no schema/dependency delta.

Learning writer lock order: fresh Session/Account/normalized roles → Course SHARE → owned Enrollment UPDATE → Attempt UPDATE. Grade: fresh current Instructor → owned Course SHARE → Enrollment UPDATE → Attempt UPDATE → Answer. Readers use compatible SHARE locks. Atomic grading/completion failure rolls back Answer/Attempt/Progress/Enrollment/Certificate. Read-only endpoints do not call the coordinator.

## Verification

- `backend/test/database/assessment-write.pg-spec.ts`: **25** actual HTTP/PostgreSQL cases, including contracts, authorization, frozen historical definition, all types, incomplete submit, exact70/>70, choice-only/concurrent Submit, pending/final grade, best/lower retake, concurrent grades, last-grade rollback, queue cursor/lock order, Data-image transport, reconnect and no-GET-write.
- Existing Attempt/Completion/Management regressions: **65** cases retained. 24 new cases +65 regressions ran together89PASS; subsequent added transport case1PASS. Exact full regression runs in hosted CI.
- `assessment-write.pipe.spec.ts`:12 unit boundary cases. Foundation53, strict TypeScript/boundary gate/Nest build; Frontend tests176, Web/Admin/packages typecheck and Draft contract generation check.
- Actual Frontend clients: authoring/review/publication/enrollment → Start/Save/Submit → owner queue/grade → Results/Learning/Certificate → lower retake/reconnect. Harness injects configuration only, retains real fetch/clients/decoders and PostgreSQL. It adds7 checks to206 existing checks; final proof logged in execution board only after successful run.
- Frontend runtime decoder accepts canonical zero-point question/grade and validates QuizResults pending nulls/fractional scores; no mock/entity becomes database truth.

Component verification does **not** close original113 acceptance/browser/provider/Production gates. No STG/deploy/live migration. Canonical contract remains Draft; new provider deltas tracked separately.
