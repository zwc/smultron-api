// scripts/generate-openapi.ts
import fs from "fs";
import path from "path";
import yaml from "yaml";
import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// --- paths ---
const HANDLERS_DIR = path.resolve(process.cwd(), "src", "handlers");
const SCHEMAS_MODULE = path.resolve(process.cwd(), "src", "schemas", "handlers.ts");
const OUT_PATH = path.resolve(process.cwd(), "infrastructure", "swagger.generated.yaml");

// --- tiny helpers ---
function listHandlerFiles() {
  return fs.readdirSync(HANDLERS_DIR).filter((f) => f.endsWith(".ts"));
}
function extractExportsFromSource(src: string) {
  const out: any = {};
  const m = src.match(/export const method\s*=\s*['"]([A-Z]+)['"]/);
  const r = src.match(/export const route\s*=\s*['"]([^'"]+)['"]/);
  const req = src.match(/export const requestSchema\s*=\s*([A-Za-z0-9_]+)/);
  const res = src.match(/export const responseSchema\s*=\s*([A-Za-z0-9_]+)/);
  if (m) out.method = m[1];
  if (r) out.route = r[1];
  if (req) out.requestSchema = req[1];
  if (res) out.responseSchema = res[1];
  return out;
}
function pathToFileURL(p: string) {
  let resolved = path.resolve(p);
  if (!resolved.startsWith("/")) resolved = "/" + resolved;
  return new URL("file://" + resolved);
}

async function main() {
  // 1) Load your exported Zod schemas (Bun can import TS directly)
  const schemasMod: Record<string, z.ZodTypeAny> = await import(
    pathToFileURL(SCHEMAS_MODULE).href
  );

  // 2) Register all schemas once — this gives them stable $refs by name
  const registry = new OpenAPIRegistry();
  for (const [name, schema] of Object.entries(schemasMod)) {
    if (schema && typeof (schema as any)._def === "object") {
      registry.register(name, schema as z.ZodTypeAny);
    }
  }

  // 3) Build paths by scanning handlers
  for (const file of listHandlerFiles()) {
    const full = path.join(HANDLERS_DIR, file);
    const src = fs.readFileSync(full, "utf8");
    const ex = extractExportsFromSource(src);
    if (!ex.method || !ex.route) continue;

    // Try to get schemas from the central schemas module first
    let req: z.ZodTypeAny | undefined = schemasMod[ex.requestSchema];
    let res: z.ZodTypeAny | undefined = schemasMod[ex.responseSchema];

    // If not found in schemas module, try to import from the handler file itself
    if ((ex.requestSchema && !req) || (ex.responseSchema && !res)) {
      try {
        const handlerMod = await import(pathToFileURL(full).href);
        if (ex.requestSchema && !req) req = handlerMod.requestSchema;
        if (ex.responseSchema && !res) res = handlerMod.responseSchema;
      } catch (err) {
        console.warn(`Could not import handler module ${file}:`, err);
      }
    }

    // Register per-route operation
    const method = ex.method.toLowerCase() as
      | "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

    const request: any = {};
    
    // Simple convention:
    // - GET/DELETE: request schema is query params if it's a Zod object
    // - Others: request schema is JSON body
    if (req && (req as any)._def) {
      if (method === "get" || method === "delete") {
        // For GET/DELETE, treat the request schema as query parameters
        request.query = req;
      } else {
        request.body = {
          content: {
            "application/json": { schema: req },
          },
        };
      }
    }

    const responses: any = {
      200: res
        ? {
            description: "OK",
            content: { "application/json": { schema: res } },
          }
        : { description: "OK" },
    };

    registry.registerPath({
      method,
      path: ex.route, // supports `/items/{id}`; path params come from the route itself
      // You can add summary/tags/etc by exporting them from handlers and merging here
      request,
      responses,
    });
  }

  // 4) Generate and write the OpenAPI document once
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Smultron API (generated)",
      version: "1.0.0",
      description:
        "Generated OpenAPI from Zod schemas with @asteasolutions/zod-to-openapi",
    },
    servers: [{ url: "http://localhost:3000/v1", description: "Local development" }],
  });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, yaml.stringify(document), "utf8");
  console.log("Wrote", OUT_PATH);
}

main().catch((err) => {
  console.error("Generator error:", err);
  process.exit(1);
});