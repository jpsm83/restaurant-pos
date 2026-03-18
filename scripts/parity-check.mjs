import http from "node:http";

function requestJson(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers: {
          Accept: "application/json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let json = null;
          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            json = { _raw: data };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", (e) => resolve({ status: 0, json: { error: e.message } }));
    if (body !== undefined) {
      const payload = JSON.stringify(body);
      req.setHeader("Content-Type", "application/json");
      req.setHeader("Content-Length", Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

const NEXT_BASE = process.env.NEXT_BASE_URL ?? "http://127.0.0.1:3000";
const BACKEND_BASE = process.env.BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

const cases = [
  { name: "health", method: "GET", path: "/health", backendOnly: true },
  { name: "business_list", method: "GET", path: "/api/v1/business" },
  { name: "orders_list", method: "GET", path: "/api/v1/orders" },
  { name: "salesInstances_list", method: "GET", path: "/api/v1/salesInstances" },
];

const results = [];

for (const c of cases) {
  const backend = await requestJson(`${BACKEND_BASE}${c.path}`, { method: c.method });
  let next = null;
  if (!c.backendOnly) {
    next = await requestJson(`${NEXT_BASE}${c.path}`, { method: c.method });
  }
  results.push({ case: c.name, path: c.path, backend, next });
}

console.log(JSON.stringify({ NEXT_BASE, BACKEND_BASE, results }, null, 2));

