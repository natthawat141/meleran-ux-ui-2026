import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

interface Validate {
  (value: unknown): boolean;
  errors?: unknown;
}
interface AjvInstance {
  addSchema(schema: unknown, id: string): void;
  compile(schema: unknown): Validate;
}

/** Reuse approved frontend development dependencies; none enter the backend runtime. */
const frontendRequire = createRequire(resolve(__dirname, '../../../frontend/package.json'));
const Ajv = frontendRequire('ajv/dist/2020').default as new (options: object) => AjvInstance;
const addFormats = frontendRequire('ajv-formats') as (ajv: AjvInstance) => void;
const document = JSON.parse(readFileSync(resolve(__dirname,
  '../../../docs/implementation/contracts/FOUNDATION-01.openapi.json'), 'utf8')) as { components: unknown };
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema({ components: document.components }, 'foundation');
const validateError = ajv.compile({ $ref: 'foundation#/components/schemas/ErrorEnvelope' });

export function assertErrorContract(body: unknown): void {
  if (!validateError(body)) throw new Error(`ErrorEnvelope mismatch: ${JSON.stringify(validateError.errors)}`);
}

const validators = new Map<string, Validate>();
export function assertTaskContract(task: string, schema: string, body: unknown): void {
  if (!/^[A-Z]+-\d{2}$/.test(task) || !/^[A-Za-z0-9]+$/.test(schema)) throw new Error('Invalid test contract identifier.');
  const key = task + ':' + schema;
  if (!validators.has(key)) {
    const source = JSON.parse(readFileSync(resolve(__dirname, '../../../docs/implementation/contracts', task + '.openapi.json'), 'utf8')) as { components: unknown };
    const validator = new Ajv({ allErrors: true, strict: false });
    addFormats(validator);
    validator.addSchema({ components: source.components }, task);
    validators.set(key, validator.compile({ $ref: `${task}#/components/schemas/${schema}` }));
  }
  const validate = validators.get(key)!;
  if (!validate(body)) throw new Error(`Canonical ${schema} mismatch: ${JSON.stringify(validate.errors)}`);
}
