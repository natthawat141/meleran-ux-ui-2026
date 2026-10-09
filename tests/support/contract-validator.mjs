import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const contract = JSON.parse(readFileSync(new URL('../../packages/contracts/openapi/openapi.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ ...contract, $id: 'https://melearn.invalid/contract' });
const validators = new Map();

export function schemaValidator(schema) {
  const key = JSON.stringify(schema);
  if (!validators.has(key)) {
    validators.set(key, ajv.compile({ ...schema, $id: undefined,
      // Resolve canonical document-local refs without network access.
      ...(schema.$ref ? { $ref: 'https://melearn.invalid/contract' + schema.$ref } : {}),
    }));
  }
  return validators.get(key);
}

export function findOperation(method, rawPath) {
  const path = rawPath.split('?')[0].replace(/^\/+|\/+$/g, '').split('/');
  for (const [template, methods] of Object.entries(contract.paths)) {
    const parts = template.slice(1).split('/');
    if (parts.length === path.length && parts.every((part, i) => /^\{.+\}$/.test(part) || part === path[i])) {
      if (methods[method.toLowerCase()]) return methods[method.toLowerCase()];
    }
  }
}

export function assertContractResponse(method, path, response) {
  const operation = findOperation(method,path);
  if (!operation) return; // Explicitly deferred provider operations have no application schema.
  const declared = operation.responses[response.status];
  if (!declared) throw new Error(`Undeclared HTTP status ${method} ${path}: ${response.status}`);
  if (response.status === 204) {
    if (response.body !== undefined) throw new Error(`Unexpected204 body ${path}`);
    return;
  }
  const validate = schemaValidator(declared.content['application/json'].schema);
  if (!validate(response.body)) throw new Error(`Contract mismatch ${method} ${path} ${response.status}: ${ajv.errorsText(validate.errors)}`);
}
