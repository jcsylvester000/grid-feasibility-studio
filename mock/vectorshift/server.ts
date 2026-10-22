/** Starts the mock VectorShift server: npm run mock:vs (port MOCK_VS_PORT, default 4010). */
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { handleMockRequest } from "./handler";

const port = Number(process.env.MOCK_VS_PORT ?? 4010);
// Reports follow the inputs (prototype engine) unless MOCK_VS_PAYLOADS=golden.
process.env.MOCK_VS_PAYLOADS ??= "prototype";

createServer(async (req, res) => {
  try {
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : (Readable.toWeb(req) as ReadableStream);
    const request = new Request(`http://localhost:${port}${req.url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body,
      duplex: "half",
    } as RequestInit);
    const response = await handleMockRequest(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    console.log(`${new Date().toISOString()} ${req.method} ${req.url} -> ${response.status}`);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end();
  }
}).listen(port, () => {
  console.log(`Mock VectorShift listening on http://localhost:${port}  (POST /v1/pipeline/{id}/run)`);
  console.log(`Payloads: ${process.env.MOCK_VS_PAYLOADS} (set MOCK_VS_PAYLOADS=golden for the fixed C6 sample)`);
  console.log(`Delay per run: ${process.env.MOCK_VS_DELAY_MS ?? 2500} ms. Scenarios via pipeline id, e.g. mock-quick_report--failed`);
});
