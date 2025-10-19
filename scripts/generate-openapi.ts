import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { z } from 'zod';

// Use zod-to-json-schema for schema conversion
const { zodToJsonSchema }: any = await import('zod-to-json-schema').then(m => m);

const HANDLERS_DIR = path.resolve(process.cwd(), 'src', 'handlers');
const SCHEMAS_MODULE = path.resolve(process.cwd(), 'src', 'schemas', 'handlers.ts');
const OUT_PATH = path.resolve(process.cwd(), 'infrastructure', 'swagger.generated.yaml');

function listHandlerFiles() {
  return fs.readdirSync(HANDLERS_DIR).filter(f => f.endsWith('.ts'));
}

function extractExportsFromSource(src: string) {
  const result: any = {};
  const methodMatch = src.match(/export const method\s*=\s*['"]([A-Z]+)['"]/);
  const routeMatch = src.match(/export const route\s*=\s*['"]([^'"]+)['"]/);
  const reqMatch = src.match(/export const requestSchema\s*=\s*([A-Za-z0-9_]+)/);
  const resMatch = src.match(/export const responseSchema\s*=\s*([A-Za-z0-9_]+)/);

  if (methodMatch) result.method = methodMatch[1];
  if (routeMatch) result.route = routeMatch[1];
  if (reqMatch) result.requestSchema = reqMatch[1];
  if (resMatch) result.responseSchema = resMatch[1];
  return result;
}

async function build() {
  const files = listHandlerFiles();

  // Use static document metadata; prefer handler/schema-level metadata for specifics
  const openapi: any = {
    openapi: '3.0.0',
    info: {
      title: 'Smultron API (generated)',
      version: '1.0.0',
      description: 'Generated OpenAPI document from Zod schemas (handler/schema-level metadata preferred)',
    },
    // keep a small servers array as reasonable defaults (not derived from package.json)
    servers: [
      { url: 'http://localhost:3000/v1', description: 'Local development' }
    ],
    paths: {},
    components: { schemas: {} }
  };

  // import schemas module
  let schemasMod: any = {};
  try {
    schemasMod = await import(pathToFileURL(SCHEMAS_MODULE).href);
  } catch (err: any) {
    console.error('Failed to import schemas module:', err?.message || String(err));
    process.exit(1);
  }

  // Read handlers schemas source to map envelope wrappers
  const handlersSchemasSrc = fs.readFileSync(SCHEMAS_MODULE, 'utf8');
  const envelopeMap: Record<string, string> = {};
  const envRegex = /export const\s+(\w+)\s*=\s*envelope\(\s*(\w+)\s*\)/g;
  let mm: RegExpExecArray | null;
  while ((mm = envRegex.exec(handlersSchemasSrc)) !== null) {
    if (mm[1] && mm[2]) envelopeMap[mm[1]] = mm[2];
  }

  // Build a minimal zod-openapi object
  const zodOpenApiObject: any = { openapi: '3.0.0', info: { title: 'Smultron API (generated)', version: '1.0.0' }, paths: {}, components: { schemas: {} } };

  // Register schemas into zod-openapi structure
  const componentsRegistry: Record<string, any> = {};
  for (const key of Object.keys(schemasMod)) {
    const schema = schemasMod[key];
    if (!schema) continue;
    // If envelope mapping, register inner first
    if (envelopeMap[key]) continue; // we'll register envelope after inner
    try {
      componentsRegistry[key] = { schema };
    } catch (err) {
      // ignore
    }
  }

  // Add envelopes referencing inner names
  for (const envName of Object.keys(envelopeMap)) {
    const inner = envelopeMap[envName];
    if (!componentsRegistry[inner]) continue;
    // create a thin wrapper for envelope
    componentsRegistry[envName] = { schema: schemasMod[envName] };
  }

  // Build the 'paths' section from handlers (we'll fill components by zod-openapi)
  for (const file of files) {
    const fullPath = path.join(HANDLERS_DIR, file);
    const src = fs.readFileSync(fullPath, 'utf8');
    const ex = extractExportsFromSource(src);
    // try to import the handler module to extract runtime metadata (openapi/metadata) and ensure schema exports exist
    let handlerModule: any = {};
    try {
      handlerModule = await import(pathToFileURL(fullPath).href);
    } catch (_err) {
      handlerModule = {};
    }
    if (!ex.method || !ex.route) continue;
    const pathItem = zodOpenApiObject.paths[ex.route] = zodOpenApiObject.paths[ex.route] || {};
    const op: any = {};
    if (ex.requestSchema) {
      op.requestBody = { content: { 'application/json': { schema: { $ref: `#/components/schemas/${ex.requestSchema}` } } } };
    }
    if (ex.responseSchema) {
      op.responses = { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: `#/components/schemas/${ex.responseSchema}` } } } } };
    } else {
      op.responses = { '200': { description: 'OK' } };
    }
    // path params
    const matches = Array.from(ex.route.matchAll(/\{([^}]+)\}/g));
    const paramMatches = (matches as RegExpMatchArray[]).map(m => m[1]);
    if (paramMatches.length) op.parameters = paramMatches.map(p => ({ name: p, in: 'path', required: true, schema: { type: 'string' } }));
    pathItem[ex.method.toLowerCase()] = op;
  }

  zodOpenApiObject.components = { schemas: componentsRegistry };
  for (const [envName, inner] of Object.entries(envelopeMap)) {
    if (openapi.components.schemas[envName]) {
      try {
        openapi.components.schemas[envName].description =
          openapi.components.schemas[envName].description || 'Standard API envelope: { data, meta, links, error }';
        const s = openapi.components.schemas[envName];
        if (s.properties && s.properties.data && !s.properties.data.description) {
          s.properties.data.description = 'The wrapped response payload';
        }
      } catch (_e) {
        // ignore any failures here
      }
    }
  }
  // Use zod-openapi createSchema to convert each exported schema into components
  try {
    const { createSchema }: any = await import('zod-openapi');
    const exportedNames = Object.keys(schemasMod);
    // store metadata extracted from zod .meta() for later use (params/headers/ids)
    const schemaMetas: Record<string, any> = {};
    for (const name of exportedNames) {
      const schema = schemasMod[name];
      if (!schema) continue;
      // try to read Zod metadata from schema._def.metadata or schema._def.meta (compat)
      const meta = (schema && (schema._def?.metadata || schema._def?.meta || schema._def?.openapi)) || null;
      if (meta) schemaMetas[name] = meta;
      try {
        const { schema: createdSchema, components } = createSchema(schema, { openapiVersion: '3.0.0' });
        // merge components.schemas
        if (components && components.schemas) {
          for (const [k, v] of Object.entries(components.schemas)) {
            openapi.components.schemas[k] = v;
          }
        }
        // Determine the component key: allow meta.outputId or meta.id to override the exported name
        let componentKey = name;
        if (meta && meta.outputId) componentKey = meta.outputId;
        else if (meta && meta.id) componentKey = meta.id;

        // If metadata provides an override for the rendered schema, apply it
        let finalSchema = createdSchema;
        if (meta && meta.override) {
          try {
            if (typeof meta.override === 'function') {
              finalSchema = meta.override(createdSchema, schema) || createdSchema;
            } else if (typeof meta.override === 'object') {
              finalSchema = meta.override;
            }
          } catch (_e) {
            // ignore override failures and fall back to createdSchema
            finalSchema = createdSchema;
          }
        }

        // add top-level schema if createdSchema/finalSchema is present and not a $ref
        if (finalSchema && typeof finalSchema === 'object' && !finalSchema.$ref) {
          openapi.components.schemas[componentKey] = finalSchema;
        }
      } catch (e: any) {
        // fallback handled below
        // console.warn('createSchema failed for', name, e?.message || String(e));
      }
    }
    // attach schemaMetas map to openapi for later usage when building paths
    (openapi as any).__schemaMetas = schemaMetas;
  } catch (err: any) {
    console.warn('zod-openapi import failed, will fall back to zod-to-json-schema for components:', err?.message || String(err));
  }

  // Lightweight Zod v4 -> JSON Schema converter
  function convertZodToJsonSchema(zodSchema: any): any {
    if (!zodSchema || typeof zodSchema !== 'object') throw new Error('Not a zod schema');

    if (zodSchema instanceof z.ZodString) return { type: 'string' };
    if (zodSchema instanceof z.ZodNumber) return { type: 'number' };
    if (zodSchema instanceof z.ZodBoolean) return { type: 'boolean' };
    if (zodSchema instanceof z.ZodLiteral) return { const: zodSchema._def.value, type: typeof zodSchema._def.value };
    if (zodSchema instanceof z.ZodEnum) return { type: 'string', enum: zodSchema._def.values };
    if (zodSchema instanceof z.ZodNativeEnum) return { type: 'string', enum: Object.values(zodSchema._def.values) };
    if (zodSchema instanceof z.ZodArray) {
      const itemType = zodSchema._def.type;
      return { type: 'array', items: convertZodToJsonSchema(itemType) };
    }
    if (zodSchema instanceof z.ZodOptional || zodSchema instanceof z.ZodNullable) {
      const inner = (zodSchema as any).unwrap();
      const js = convertZodToJsonSchema(inner);
      js.nullable = true;
      return js;
    }
    if (zodSchema instanceof z.ZodObject) {
      // shape may be function (old) or object (new)
      const shapeGetter = zodSchema._def.shape;
      const shape = typeof shapeGetter === 'function' ? shapeGetter() : shapeGetter;
      const properties: any = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = convertZodToJsonSchema(v);
        try {
          if (!v.isOptional || !v.isOptional()) required.push(k);
        } catch (_) {
          // ignore
        }
      }
      const res: any = { type: 'object', properties };
      if (required.length) res.required = required;
      return res;
    }
    if (zodSchema instanceof z.ZodUnion) {
      const options = zodSchema._def.options || [];
      return { anyOf: options.map((o: any) => convertZodToJsonSchema(o)) };
    }
    if (zodSchema instanceof z.ZodRecord) {
      return { type: 'object', additionalProperties: true };
    }
    // fallback: try zod-to-json-schema
    const js = zodToJsonSchema(zodSchema, 'fallback');
    if (js && js.definitions && Object.keys(js.definitions).length === 1) return js.definitions[Object.keys(js.definitions)[0]];
    return js;
  }

  for (const file of files) {
    const fullPath = path.join(HANDLERS_DIR, file);
    const src = fs.readFileSync(fullPath, 'utf8');
    const ex = extractExportsFromSource(src);
    if (!ex.method || !ex.route) continue;

    // import handler module for runtime metadata (openapi / metadata)
    let handlerModule: any = {};
    try {
      handlerModule = await import(pathToFileURL(fullPath).href);
    } catch (_err) {
      handlerModule = {};
    }

    const pathItem = openapi.paths[ex.route] = openapi.paths[ex.route] || {};
    const op: any = { responses: {} };

    // Merge per-handler metadata if available (openapi or metadata)
    const handlerMeta = handlerModule.openapi || handlerModule.metadata || null;
    if (handlerMeta && typeof handlerMeta === 'object') {
      if (handlerMeta.summary) op.summary = handlerMeta.summary;
      if (handlerMeta.description) op.description = handlerMeta.description;
      if (handlerMeta.operationId) op.operationId = handlerMeta.operationId;
      if (handlerMeta.tags) op.tags = handlerMeta.tags;
    }

    if (ex.requestSchema) {
      const name = ex.requestSchema;
      if (openapi.components.schemas[name]) {
        op.requestBody = { content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } } };
      }
      // if the request schema had Zod .meta() params, merge them as path/query/header params
      const metas = (openapi as any).__schemaMetas || {};
      const metaFor = metas[name] || null;
      if (metaFor && metaFor.param) {
        // param can be an object or array of parameter objects
        const paramsToAdd = Array.isArray(metaFor.param) ? metaFor.param : [metaFor.param];
        op.parameters = op.parameters || [];
        for (const p of paramsToAdd) {
          // normalize: ensure name/in/required/schema
          op.parameters.push(p);
        }
      }
    }

    if (ex.responseSchema) {
      const name = ex.responseSchema;
      if (openapi.components.schemas[name]) {
        op.responses['200'] = { description: 'OK', content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } } };
        // if the response schema had Zod .meta() headers, attach them
        const metas = (openapi as any).__schemaMetas || {};
        const metaFor = metas[name] || null;
        if (metaFor && metaFor.header) {
          op.responses['200'].headers = metaFor.header;
        }
      } else {
        op.responses['200'] = { description: 'OK' };
      }
    } else {
      op.responses['200'] = { description: 'OK' };
    }

    // add path parameters for routes with {param}
    const params: any[] = [];
  const matches = Array.from(ex.route.matchAll(/\{([^}]+)\}/g));
  const paramMatches = (matches as RegExpMatchArray[]).map(m => m[1]);
    for (const p of paramMatches) {
      params.push({ name: p, in: 'path', required: true, schema: { type: 'string' } });
    }
    if (params.length) op.parameters = params;

    pathItem[ex.method.toLowerCase()] = op;
  }

  const yamlStr = yaml.stringify(openapi);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, yamlStr, 'utf8');
  console.log('Wrote', OUT_PATH);
}

function pathToFileURL(p: string) {
  let resolved = path.resolve(p);
  if (!resolved.startsWith('/')) resolved = '/' + resolved;
  return new URL('file://' + resolved);
}

build().catch(err => {
  console.error('Generator error:', err);
  process.exit(1);
});
