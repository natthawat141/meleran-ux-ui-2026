# Contract snapshot

`openapi.json` is the committed snapshot used by frontend generation, mock tests and standalone CI. The editable canonical schema moved to `../../../../docs/api-contract/openapi.json` in the workspace docs repository.

Edit canonical, run `npm run contracts:sync`, then generate/check/test and commit both repositories. Do not edit this snapshot directly. Standalone checkout consumers can build/test the pinned snapshot without sibling repositories.
