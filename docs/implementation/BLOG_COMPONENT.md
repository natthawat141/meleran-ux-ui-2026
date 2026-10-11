# Blog component execution

Canonical Draft.2 SHA256 b94be2175334ed8d612d713a47ac5cbcd0136ec19320faa5059991ab82e9b9be unchanged; Scope §2.8/5.9/6.10 and B01–B04 preserved. Agent protocol choices: [decision record](AUTONOMOUS_EXECUTION_DECISIONS.md).

| Task | Implemented canonical operations |
| --- | --- |
| BLOG-01 | GET /blog; GET /blog/{slug} |
| BLOG-02 | POST/GET /admin/blog; PATCH /admin/blog/{id}; GET /admin/blog/{id}/preview |
| BLOG-03 | POST /admin/blog/{id}/publish; POST /admin/blog/{id}/unpublish; DELETE /admin/blog/{id} |

Feature-local Controllers/Service/request Pipe/DTO/tests. Fresh normalized Admin/session namespace then Blog UPDATE lock. Revision precondition and content/editor/status/audit save atomically; unique slug conflicts409; published changes immediate. First author/time/publication/slug immutable; no Instructor authoring authority or academic writes. DELETE retains immutable tombstone and reserved slug; no purge/retention interval invented. Public select includes only canonical metadata/content, never identity profile/management audit; Draft/hidden/unknown404. Owned Admin preview and management list retain rich content. Signed query-bound keysets with explicit search fields.

Append-only 20261011051000_blog_authoring adds missing plain/category/reading/editor/deletion fields, FKs and audit trigger. Existing10 batches unchanged; unknown legacy fields remain NULL, incomplete canonical projection fails closed. Only isolated melearn_test applied; full11-batch rollback via Course migration suites.27 models unchanged.

Targeted actual PostgreSQL21 Blog tests plus rerun Course creator7/directory16 against11 batches pass;4 feature units cover request/rich trust boundary. Canonical schemas, role/namespace matrix, stale/parallel writes, rollback afterSQL, lifecycle/visibility/audit, Unicode200,000-character body, privacy, read-only/reconnect and no academic changes covered. Actual unchanged Frontend public Blog client and Admin resource decoder add9 passing checks (create/preview, Draft hidden, publish public list/detail, immediate save, stale409, unpublish, DELETE retained audit, namespace denied, reconnect), total186. Read-only Prisma/Test PostgreSQL parity has no DDL difference. No browser/full original acceptance claim from fixtures.

Remaining full feature gates: authenticated Frontend browser B01–B04, provider Login branch, staging/release boundaries. API completeness and original acceptance are tracked separately in EXECUTION_STATUS/OPERATION_MATRIX; no new acceptance IDs or HTTP routes.
