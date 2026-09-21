import test from "node:test";
import assert from "node:assert/strict";
import { NexiomConnect, NexiomError, NexiomValidationError } from "../dist/index.js";
import { createRequire } from "node:module";

const mail = {
  from: "hello@example.com",
  to: "user@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
};
const accepted = { messageId: "msg_1", totalQueued: 1, deliveryIds: ["del_1"] };
const contact = {
  id: "ct_1",
  email: "user@example.com",
  first_name: null,
  last_name: null,
  phone_number: null,
  email_status: "subscribed",
  created_at: "2026-09-21T00:00:00.000Z",
};
const property = { id: "prop_1", key: "company", type: "string", fallback_value: null };
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
function fixture(handler = () => json({ data: accepted }), options = {}) {
  const calls = [];
  const sdk = new NexiomConnect({
    apiKey: "nc_test_key",
    maxRetries: 0,
    ...options,
    fetch: async (url, init) => {
      calls.push({
        url,
        ...init,
        body: init.body === undefined ? undefined : JSON.parse(init.body),
      });
      return handler(url, init, calls.length);
    },
  });
  return { sdk, calls };
}

test("named ESM and CJS exports expose only requested resource methods", () => {
  const cjs = createRequire(import.meta.url)("../dist/index.cjs");
  assert.equal(typeof cjs.NexiomConnect, "function");
  const { sdk } = fixture();
  assert.deepEqual(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.emails)), [
    "constructor",
    "send",
  ]);
  assert.equal(sdk.mail, undefined);
});

test("send uses production host, v1 resource path, bearer auth and idempotency", async () => {
  const { sdk, calls } = fixture();
  const result = await sdk.emails.send({ ...mail, orgId: "forbidden", projectId: "forbidden" });
  assert.deepEqual(result.data, accepted);
  assert.equal(result.error, null);
  assert.equal(calls[0].url, "https://api-connect.nxiom.com/api/v1/emails/send");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.get("authorization"), "Bearer nc_test_key");
  assert.equal(calls[0].headers.get("content-type"), "application/json");
  assert.match(calls[0].headers.get("user-agent"), /^nexiom-connect-node\/0\.1\.0$/);
  assert.match(result.response.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(calls[0].headers.get("idempotency-key"), result.response.idempotencyKey);
  assert.deepEqual(calls[0].body, mail);
  assert.equal(calls[0].redirect, "manual");
});

test("custom host preserves base path and strips trailing slash", async () => {
  const { sdk, calls } = fixture(undefined, { baseUrl: "http://localhost:3000/api/" });
  await sdk.emails.send(mail, { idempotencyKey: "order-1" });
  assert.equal(calls[0].url, "http://localhost:3000/api/v1/emails/send");
  assert.equal(calls[0].headers.get("idempotency-key"), "order-1");
});

test("template, recipients and optional email fields follow backend contract", async () => {
  const { sdk, calls } = fixture();
  const body = {
    from: mail.from,
    fromName: "Nexiom",
    to: [mail.to],
    cc: ["other@example.com"],
    bcc: "private@example.com",
    replyTo: "reply@example.com",
    templateId: "tpl_1",
    templateVariables: { name: "Ada", count: 2, active: true },
    metadata: { order: 1 },
  };
  await sdk.emails.send(body);
  assert.deepEqual(calls[0].body, body);
});

test("all contact methods, response envelopes, and tenant-free requests", async () => {
  const { sdk, calls } = fixture((url, init) =>
    json(
      init.method === "DELETE"
        ? { success: true }
        : {
            data: url.includes("?") ? { items: [contact], total: 1, page: 2, limit: 10 } : contact,
          },
    ),
  );
  const params = {
    email: contact.email,
    firstName: "Ada",
    userId: "usr_1",
    properties: { score: 0 },
    organizationId: "forbidden",
    projectId: "forbidden",
  };
  assert.equal((await sdk.contacts.create(params)).data.id, "ct_1");
  const listed = await sdk.contacts.list({
    page: 2,
    limit: 10,
    search: "Ada & Co",
    emailStatus: "subscribed",
    listId: "list_1",
    segmentId: "seg_1",
    orgId: "forbidden",
  });
  assert.deepEqual(listed.data, { items: [contact], total: 1, page: 2, limit: 10 });
  await sdk.contacts.get("id/with ?#");
  await sdk.contacts.update("ct_1", { ...params, userId: null, emailStatus: "unsubscribed" });
  assert.deepEqual((await sdk.contacts.delete("ct_1")).data, { success: true });
  assert.deepEqual(
    calls.map((x) => x.method),
    ["POST", "GET", "GET", "PUT", "DELETE"],
  );
  assert.equal(new URL(calls[1].url).searchParams.get("search"), "Ada & Co");
  assert.match(calls[2].url, /id%2Fwith%20%3F%23$/);
  assert.equal(calls[3].body.userId, null);
  for (const call of calls) {
    assert.equal(call.headers.get("authorization"), "Bearer nc_test_key");
    for (const key of ["orgId", "organizationId", "projectId"]) {
      assert.equal(new URL(call.url).searchParams.has(key), false);
      assert.equal(Object.hasOwn(call.body ?? {}, key), false);
      assert.equal(call.headers.has(key), false);
    }
  }
});

test("property methods map name/fallbackValue; filters are local", async () => {
  const { sdk, calls } = fixture((_, init) =>
    json(
      init.method === "DELETE"
        ? { success: true }
        : {
            data:
              init.method === "GET"
                ? [property, { ...property, id: "prop_2", key: "score", type: "number" }]
                : property,
          },
    ),
  );
  await sdk.contacts.properties.create({
    name: "company",
    type: "string",
    fallbackValue: "Unknown",
    projectId: "ignored",
  });
  assert.deepEqual(calls[0].body, { key: "company", type: "string", fallback_value: "Unknown" });
  assert.equal(calls[0].url, "https://api-connect.nxiom.com/api/v1/emails/properties");
  assert.deepEqual((await sdk.contacts.properties.list({ type: "string", search: "COMP" })).data, [
    property,
  ]);
  assert.equal(new URL(calls[1].url).search, "");
  await sdk.contacts.properties.update("prop_1", { fallbackValue: null, name: "ignored" });
  assert.deepEqual(calls[2].body, { fallback_value: null });
  assert.equal(calls[2].method, "PATCH");
  assert.deepEqual((await sdk.contacts.properties.delete("prop_1")).data, { success: true });
});

test("properties list works without params and preserves API errors", async () => {
  const { sdk } = fixture(() => json({ data: [property] }));
  assert.deepEqual((await sdk.contacts.properties.list()).data, [property]);
  const { sdk: denied } = fixture(() => json({ message: "Denied" }, 403));
  assert.equal((await denied.contacts.properties.list()).error.status, 403);
});
for (const status of [400, 401, 403, 404, 409, 422]) {
  test(`HTTP ${status} is not retried and preserves diagnostics`, async () => {
    const { sdk, calls } = fixture(
      () =>
        json(
          {
            error: "invalid_argument",
            code: "specific_code",
            message: "Helpful message",
            correlationId: "req_1",
            details: { field: "email" },
          },
          status,
        ),
      { maxRetries: 2 },
    );
    const { data, error, response } = await sdk.emails.send(mail);
    assert.equal(data, null);
    assert.ok(error instanceof NexiomError);
    assert.equal(error.kind, "api");
    assert.equal(error.status, status);
    assert.equal(error.code, "specific_code");
    assert.equal(error.requestId, "req_1");
    assert.deepEqual(error.details, { field: "email" });
    assert.equal(response.requestId, "req_1");
    assert.equal(calls.length, 1);
  });
}
for (const status of [408, 429, 500, 502, 503, 504]) {
  test(`email retries HTTP ${status} with same key and body`, async () => {
    const { sdk, calls } = fixture(
      (_, __, n) =>
        n === 1
          ? json({ message: "Try later" }, status, { "retry-after": "0" })
          : json({ data: accepted }, 202),
      { maxRetries: 2 },
    );
    const result = await sdk.emails.send(mail);
    assert.equal(result.error, null);
    assert.equal(result.response.status, 202);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].headers.get("idempotency-key"), calls[1].headers.get("idempotency-key"));
    assert.deepEqual(calls[0].body, calls[1].body);
  });
}

test("reads retry with a bounded attempt count", async () => {
  const { sdk, calls } = fixture(
    () => json({ message: "Unavailable" }, 503, { "retry-after": "0" }),
    { maxRetries: 2 },
  );
  assert.equal((await sdk.contacts.list()).error.status, 503);
  assert.equal(calls.length, 3);
});

test("contact mutations never retry even with an increased retry count", async () => {
  const { sdk, calls } = fixture(() => json({}, 503, { "retry-after": "0" }), { maxRetries: 10 });
  await sdk.contacts.create({ email: mail.to });
  await sdk.contacts.update("ct_1", { email: mail.to });
  await sdk.contacts.delete("ct_1");
  await sdk.contacts.properties.create({ name: "company", type: "string" });
  await sdk.contacts.properties.update("prop_1", { fallbackValue: null });
  await sdk.contacts.properties.delete("prop_1");
  assert.equal(calls.length, 6);
});

test("network failure is typed, redacted, and retryable for sends", async () => {
  const { sdk, calls } = fixture(
    (_, __, n) => {
      if (n === 1) {
        throw new Error("secret nc_test_key");
      }
      return json({ data: accepted });
    },
    { maxRetries: 1 },
  );
  assert.equal((await sdk.emails.send(mail)).error, null);
  assert.equal(calls.length, 2);
  const { sdk: failing } = fixture(() => {
    throw new Error("secret nc_test_key");
  });
  const result = await failing.contacts.create({ email: mail.to });
  assert.equal(result.error.kind, "network");
  assert.doesNotMatch(JSON.stringify(result), /nc_test_key/);
});

test("total deadline covers Retry-After and supports HTTP-date", async () => {
  for (const delay of ["60", new Date(Date.now() + 60_000).toUTCString()]) {
    const { sdk, calls } = fixture(() => json({}, 429, { "retry-after": delay }), {
      maxRetries: 2,
      timeout: 20,
    });
    assert.equal((await sdk.emails.send(mail)).error.kind, "timeout");
    assert.equal(calls.length, 1);
  }
});

test("timeout aborts an in-flight request", async () => {
  const { sdk } = fixture(
    (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      ),
    { timeout: 20 },
  );
  assert.equal((await sdk.contacts.list()).error.kind, "timeout");
});

test("timeout covers response body consumption", async () => {
  const { sdk } = fixture(
    (_, { signal }) => ({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: () =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
        ),
    }),
    { timeout: 20 },
  );
  assert.equal((await sdk.contacts.list()).error.kind, "timeout");
});

test("pre-aborted requests never call fetch", async () => {
  const { sdk, calls } = fixture();
  const result = await sdk.emails.send(mail, { signal: AbortSignal.abort() });
  assert.equal(result.error.kind, "aborted");
  assert.equal(calls.length, 0);
});

test("cancellation interrupts retry backoff", async () => {
  const controller = new AbortController();
  const { sdk, calls } = fixture(
    () => {
      setTimeout(() => controller.abort(), 10);
      return json({}, 429, { "retry-after": "60" });
    },
    { maxRetries: 2 },
  );
  const result = await sdk.contacts.list({}, { signal: controller.signal });
  assert.equal(result.error.kind, "aborted");
  assert.equal(calls.length, 1);
});

test("per-request timeout and retry overrides take effect", async () => {
  const { sdk, calls } = fixture(() => json({}, 503, { "retry-after": "60" }), { maxRetries: 2 });
  assert.equal((await sdk.contacts.list({}, { maxRetries: 0 })).error.kind, "api");
  assert.equal((await sdk.contacts.list({}, { timeout: 10 })).error.kind, "timeout");
  assert.equal(calls.length, 2);
});

test("redirects are surfaced rather than forwarded with credentials", async () => {
  const { sdk, calls } = fixture(
    () => new Response(null, { status: 307, headers: { location: "https://evil.example" } }),
  );
  assert.equal((await sdk.emails.send(mail)).error.status, 307);
  assert.equal(calls.length, 1);
});

test("invalid/empty JSON success is a protocol failure, not retried", async () => {
  for (const body of ["", "<html>gateway</html>", "null", '"unexpected"', "{}"]) {
    const { sdk, calls } = fixture(() => new Response(body, { status: 200 }), { maxRetries: 2 });
    assert.equal((await sdk.emails.send(mail)).error.kind, "protocol");
    assert.equal(calls.length, 1);
  }
});

test("non-JSON API failure retains HTTP status and request ID", async () => {
  const { sdk } = fixture(
    () =>
      new Response("<html>Bad gateway</html>", {
        status: 502,
        headers: { "x-request-id": "req_proxy" },
      }),
  );
  const { error } = await sdk.contacts.list();
  assert.equal(error.status, 502);
  assert.equal(error.requestId, "req_proxy");
});

test("invalid configuration and arguments fail before fetch", async () => {
  for (const options of [
    { apiKey: "" },
    { apiKey: "nc_\nsecret" },
    { apiKey: "nc_é" },
    { baseUrl: "" },
    { baseUrl: "ftp://localhost" },
    { baseUrl: "https://user:pass@example.com" },
    { baseUrl: "https://example.com?a=1" },
    { baseUrl: "http://example.com" },
    { timeout: 0 },
    { maxRetries: -1 },
  ]) {
    assert.throws(
      () => new NexiomConnect({ apiKey: "nc_test_key", ...options }),
      NexiomValidationError,
    );
  }
  const { sdk, calls } = fixture();
  for (const action of [
    () => sdk.contacts.get(""),
    () => sdk.contacts.get(".."),
    () => sdk.contacts.list({ limit: 101 }),
    () => sdk.contacts.list({ page: 1.5 }),
    () => sdk.contacts.update("ct_1", {}),
    () => sdk.emails.send({ ...mail, to: [] }),
    () => sdk.emails.send({ ...mail, to: ["a@b.com", "c@d.com"], cc: "e@f.com" }),
    () => sdk.emails.send({ ...mail, html: "" }),
    () => sdk.emails.send(mail, { idempotencyKey: "bad key" }),
    () => sdk.contacts.properties.update("p", {}),
    () => sdk.contacts.properties.create({ name: "x", type: "boolean" }),
  ]) {
    assert.throws(action, NexiomValidationError);
  }
  await assert.rejects(sdk.contacts.list({}, { timeout: NaN }), NexiomValidationError);
  const circular = {};
  circular.self = circular;
  await assert.rejects(sdk.emails.send({ ...mail, metadata: circular }), NexiomValidationError);
  assert.equal(calls.length, 0);
});

test("malformed property collections return protocol errors", async () => {
  for (const data of [{ items: [] }, [null], [{ id: "bad" }]]) {
    const { sdk } = fixture(() => json({ data }));
    assert.equal((await sdk.contacts.properties.list({ search: "x" })).error.kind, "protocol");
  }
});

test("network failure after a retry does not retain stale response metadata", async () => {
  const { sdk } = fixture(
    (_, __, n) => {
      if (n === 1) {
        return json({}, 503, { "retry-after": "0", "x-request-id": "old" });
      }
      throw new Error("connection lost");
    },
    { maxRetries: 1 },
  );
  const result = await sdk.contacts.list();
  assert.equal(result.error.kind, "network");
  assert.equal(result.response.status, null);
  assert.equal(result.response.requestId, null);
});
