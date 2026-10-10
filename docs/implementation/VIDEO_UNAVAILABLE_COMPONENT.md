# VIDEO-01 — Unavailable upload / authoring authority

11 ต.ค. 2026. Implemented the one canonical operation; full task/feature acceptance remains gated by Auth and real editor integration.

## Confirmed / HTTP traceability

- Final 1.6 §2.3/6.5 and original V02: Video upload is deliberately unavailable in V1. No uploaded file/success record, replacement YouTube URL or learning progress. Course cover/answer images are separate capabilities and remain in scope.
- Canonical `1.0.0-draft.1`, SHA-256 `c52e240ed1467df9c4a5af99045292f83814f23b86d64532441d98b64da160c3` unchanged: `POST /api/v1/courses/{id}/videos/uploads`, operationId `post_courses_id_videos_uploads`, no defined request body, expected **503 ErrorEnvelope**. See [VIDEO-01 subset](contracts/VIDEO-01.openapi.json).
- Exact authorized response: `error.code='video_upload_not_available'`, `message='ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน'`, server request_id matching response header. No successful upload DTO, Location/upload URL or provider proof. Unknown course 404; unauthenticated 401; forbidden resource/role/app 403; actual infrastructure failures remain safe generic 500.

## Implemented boundaries

- Feature-local Courses VideoUploadController/VideoUploadService. Auth public requireAuthoring revalidates and holds Session/Account/normalized roles before Course shared lock. Owner Instructor or Admin is authorized; other instructors/learners cannot call course.update. No Enrollment or email-learning-readiness requirement is attached to this non-learning authoring action.
- AuthoritativeAudience accepts an explicit allowed-audience list only on opted-in routes. The app header chooses a known Web/Admin cookie/session namespace; server session binding and normalized roles decide authority. Admin audience still requires Admin role. Existing single-audience handlers and prototype route behavior are unchanged; D01 transport/cookie/CSRF/login/provider policies are not frozen.
- Transaction reads Course ownership and ends with unavailable error. No file parser/storage interceptor/provider SDK, write, seed or migration. Multipart bytes and attempted JSON URL/actor fields are never promoted to uploads or authorization.
- A dedicated fixed VideoUploadUnavailableException is the only new public 5xx path in the shared error filter. It renders fixed canonical code/text rather than exception diagnostics. Arbitrary ApiException/HttpException 5xx, even with that code string, remain hidden as generic internal error. No broad diagnostic disclosure added.

## Evidence / gates

- `test/database/video-upload.pg-spec.ts`: 14 actual HTTP/PostgreSQL tests: Draft/Published owner, normalized Admin through both audiences, foreign/learner/anonymous denial, namespace forgery, revoked/expired/disabled state, missing course, multipart/JSON attempts, concurrent calls/reconnect with all 27 model counts and Course/YouTube/cover/academic rows unchanged, post-guard role removal, observed authority lock wait, actual DB failure and deliberate-vs-arbitrary 5xx handling.
- Frontend harness passed six checks with the unchanged **generic HttpClient transport**, actual built Nest/Test PG and fixture sessions: owner503/Admin503/learner403/anonymous401/unknown404/network failure; success decoder never called. This is not an implemented frontend authoring handler or authenticated browser/editor acceptance. Existing 31 client checks also passed; total 37.
- Existing Web/Admin VideoEditor source shows the exact unavailable Alert when file mode is selected, and retains YouTube/cover controls. No frontend source was changed; source inspection is not browser evidence.
- Remaining: full Auth/normalized writer cutover, actual editor/browser V02 and G-COURSE. Upload is not a future video provider implementation; image upload/D09 remains a separate pending capability. V02 is still tracked, no full business case marked accepted from component tests.

Current counts/SHA/CI are recorded in EXECUTION_STATUS.json after verification. No dependency/schema/contract/cloud/STG/deploy change.

Verified code SHA: `78aee05c5d85828041c83e48b0ca428913e35c34`; [hosted Nest CI 38085878574](https://github.com/natthawat141/meleran-tutor/actions/runs/38085878574) passed 225 tests + 37 client checks, build/smoke/blueprint/boundaries. The six video checks cover generic transport only; authoring UI/browser/provider/full acceptance gates remain unverified.
