import fs from "node:fs";
import path from "node:path";

const inventoryPath = path.join(process.cwd(), "route-inventory.json");
const inv = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

function toFastifyUrl(p) {
  const rel = p.replace(/^app\/api\/v1\//, "").replace(/\/route\.ts$/, "");
  const parts = rel.split("/").map((seg) =>
    seg.replace(/^\[(\.\.\.)?(.*)\]$/, (_m, _dots, name) => `:${name}`)
  );
  return "/" + parts.join("/");
}

const rows = inv
  .filter((r) => r.path.startsWith("app/api/v1/"))
  .map((r) => ({
    url: toFastifyUrl(r.path),
    methods: String(r.methods || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }));

const implementedPrefixes = ["/business", "/orders", "/salesInstances"];
const seen = new Set();
const out = [];

out.push('import type { FastifyPluginAsync } from "fastify";');
out.push("");
out.push("export const legacyStubsRoutes: FastifyPluginAsync = async (app) => {");
out.push("  // Temporary stubs for endpoints not yet migrated.");
out.push("");

for (const r of rows) {
  if (implementedPrefixes.some((p) => r.url.startsWith(p))) continue;
  for (const m of r.methods) {
    const key = `${m} ${r.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      `  app.route({ method: "${m}", url: "${r.url}", handler: async (_req, reply) => reply.code(501).send({ message: "Not implemented in backend yet" }) });`
    );
  }
}

out.push("};");
out.push("");

const target = path.join(process.cwd(), "backend/src/routes/v1/legacyStubs.ts");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out.join("\n"), "utf8");

console.log(JSON.stringify({ wrote: target, stubs: seen.size }, null, 2));

