import test from "node:test";
import assert from "node:assert/strict";
import { NexiomConnect, NexiomError, NexiomValidationError } from "../dist/index.js";
import { createRequire } from "node:module";

const { version } = createRequire(import.meta.url)("../package.json");

const mail = {
  from: "hello@example.com",
  to: "user@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
};
const accepted = { messageId: "msg_1", totalQueued: 1, deliveryIds: ["del_1"], scheduledAt: null };
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
    "cancel",
    "reschedule",
    "list",
    "get",
  ]);
  assert.deepEqual(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.emails.suppressions)), [
    "constructor",
    "list",
  ]);
  assert.deepEqual(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.templates)), [
    "constructor",
    "list",
    "get",
    "variables",
    "versions",
  ]);
  assert.deepEqual(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.domains)), [
    "constructor",
    "create",
    "list",
    "get",
    "verify",
    "delete",
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
  assert.equal(calls[0].headers.get("user-agent"), `nexiom-connect-node/${version}`);
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
  await sdk.contacts.properties.update("prop_1", { fallbackValue: null, projectId: "ignored" });
  assert.deepEqual(calls[2].body, { fallback_value: null });
  assert.equal(calls[2].method, "PATCH");
  await sdk.contacts.properties.update("prop_1", { name: "company_name", type: "string" });
  assert.deepEqual(calls[3].body, { key: "company_name", type: "string" });
  assert.equal(calls[3].url, "https://api-connect.nxiom.com/api/v1/emails/properties/prop_1");
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
  await sdk.emails.reschedule("msg_1", { scheduledAt: "2026-10-06T09:00:00+01:00" });
  assert.equal(calls.length, 7);
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

test("a Retry-After beyond the deadline returns the API error at once, including HTTP-date", async () => {
  for (const delay of ["60", new Date(Date.now() + 60_000).toUTCString()]) {
    const { sdk, calls } = fixture(
      () => json({ error: "rate_limited", message: "Slow down" }, 429, { "retry-after": delay }),
      { maxRetries: 2, timeout: 5_000 },
    );
    const started = Date.now();
    const { error } = await sdk.emails.send(mail);
    assert.equal(error.kind, "api");
    assert.equal(error.status, 429);
    assert.equal(error.code, "rate_limited");
    assert.equal(calls.length, 1);
    assert.ok(Date.now() - started < 1_000);
  }
});

test("a Retry-After within the deadline is honored", async () => {
  const { sdk, calls } = fixture(
    (_, __, n) => (n === 1 ? json({}, 429, { "retry-after": "0.05" }) : json({ data: accepted })),
    { maxRetries: 1, timeout: 5_000 },
  );
  const started = Date.now();
  assert.equal((await sdk.emails.send(mail)).error, null);
  assert.equal(calls.length, 2);
  assert.ok(Date.now() - started >= 40);
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
      return json({}, 429, { "retry-after": "5" });
    },
    { maxRetries: 2 },
  );
  const result = await sdk.contacts.list({}, { signal: controller.signal });
  assert.equal(result.error.kind, "aborted");
  assert.equal(calls.length, 1);
});

test("per-request timeout and retry overrides take effect", async () => {
  const { sdk, calls } = fixture(() => json({}, 503, { "retry-after": "0" }), { maxRetries: 2 });
  assert.equal((await sdk.contacts.list({}, { maxRetries: 0 })).error.kind, "api");
  assert.equal(calls.length, 1);
  const { sdk: hanging } = fixture(
    (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      ),
  );
  assert.equal((await hanging.contacts.list({}, { timeout: 10 })).error.kind, "timeout");
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
    () => sdk.contacts.list({ page: 10_001 }),
    () => sdk.contacts.update("ct_1", {}),
    () => sdk.emails.send({ ...mail, to: [] }),
    () => sdk.emails.send({ ...mail, to: ["a@b.com", "c@d.com"], cc: "e@f.com" }),
    () => sdk.emails.send({ ...mail, html: "" }),
    () => sdk.emails.send(mail, { idempotencyKey: "bad key" }),
    () => sdk.contacts.properties.update("p", {}),
    () => sdk.contacts.properties.create({ name: "x", type: "boolean" }),
    () => sdk.contacts.properties.update("p", { name: " " }),
    () => sdk.contacts.properties.update("p", { type: "boolean" }),
    () => sdk.emails.send({ ...mail, scheduledAt: "tomorrow" }),
    () => sdk.emails.send({ ...mail, scheduledAt: new Date(NaN) }),
    () => sdk.emails.cancel(""),
    () => sdk.emails.reschedule("msg_1", {}),
    () => sdk.emails.reschedule("..", { scheduledAt: new Date() }),
    () => sdk.emails.list({ limit: 0 }),
    () => sdk.emails.list({ cursor: "x".repeat(1025) }),
    () => sdk.emails.list({ startDate: "" }),
    () => sdk.emails.get(""),
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

test("scheduled sends, cancel, reschedule, and email logs follow the backend contract", async () => {
  const scheduledAt = "2026-10-05T09:00:00+01:00";
  const canceled = {
    messageId: "msg_1",
    status: "canceled",
    canceledAt: "2026-10-04T12:00:00.000Z",
    deliveryIds: ["del_1"],
  };
  const rescheduled = {
    messageId: "msg_1",
    status: "scheduled",
    scheduledAt: "2026-10-06T08:00:00.000Z",
    deliveryIds: ["del_1"],
  };
  const page = { items: [], total: null, limit: 10, hasMore: true, nextCursor: "next_1" };
  const delivery = { id: "del_1", message_id: "msg_1", status: "scheduled", open_count: 0 };
  const { sdk, calls } = fixture((url, init) => {
    if (url.endsWith("/send")) {
      return json({ data: { ...accepted, scheduledAt: "2026-10-05T08:00:00.000Z" } }, 202);
    }
    if (url.endsWith("/cancel")) {
      return json({ message: "Scheduled email canceled", data: canceled });
    }
    if (init.method === "PATCH") {
      return json({ message: "Scheduled email rescheduled", data: rescheduled });
    }
    if (url.includes("/logs?")) {
      return json({ message: "Email logs fetched", data: page });
    }
    // The delivery detail endpoint returns the resource without a data wrapper.
    return json(delivery);
  });

  const sent = await sdk.emails.send({ ...mail, scheduledAt });
  assert.equal(sent.data.scheduledAt, "2026-10-05T08:00:00.000Z");
  assert.equal(calls[0].body.scheduledAt, scheduledAt);

  await sdk.emails.send({ ...mail, scheduledAt: new Date("2026-10-05T08:00:00Z") });
  assert.equal(calls[1].body.scheduledAt, "2026-10-05T08:00:00.000Z");

  assert.deepEqual((await sdk.emails.cancel("msg_1")).data, canceled);
  assert.equal(calls[2].method, "POST");
  assert.equal(calls[2].url, "https://api-connect.nxiom.com/api/v1/emails/messages/msg_1/cancel");
  assert.equal(calls[2].body, undefined);

  const moved = await sdk.emails.reschedule("msg_1", {
    scheduledAt: new Date("2026-10-06T08:00:00Z"),
    projectId: "ignored",
  });
  assert.deepEqual(moved.data, rescheduled);
  assert.equal(calls[3].url, "https://api-connect.nxiom.com/api/v1/emails/messages/msg_1");
  assert.deepEqual(calls[3].body, { scheduledAt: "2026-10-06T08:00:00.000Z" });

  const listed = await sdk.emails.list({
    limit: 10,
    cursor: "cur_1",
    status: "scheduled",
    source: "api",
    recipient: "user@example.com",
    contactId: "ct_1",
    startDate: new Date("2026-10-01T00:00:00Z"),
    endDate: "2026-10-02T00:00:00Z",
    orgId: "forbidden",
  });
  assert.deepEqual(listed.data, page);
  const query = new URL(calls[4].url).searchParams;
  assert.equal(new URL(calls[4].url).pathname, "/api/v1/emails/logs");
  assert.deepEqual(Object.fromEntries(query), {
    limit: "10",
    cursor: "cur_1",
    status: "scheduled",
    source: "api",
    recipient: "user@example.com",
    contactId: "ct_1",
    startDate: "2026-10-01T00:00:00.000Z",
    endDate: "2026-10-02T00:00:00Z",
  });

  assert.deepEqual((await sdk.emails.get("del_1")).data, delivery);
  assert.equal(calls[5].url, "https://api-connect.nxiom.com/api/v1/emails/logs/del_1");

  for (const call of calls) {
    for (const key of ["orgId", "organizationId", "projectId"]) {
      assert.equal(new URL(call.url).searchParams.has(key), false);
      assert.equal(Object.hasOwn(call.body ?? {}, key), false);
    }
  }
});

test("cancel is retried because canceling twice is safe; reads of one delivery retry too", async () => {
  const { sdk, calls } = fixture(
    (_, __, n) =>
      n % 2 === 1
        ? json({}, 503, { "retry-after": "0" })
        : json(n === 2 ? { data: { messageId: "msg_1" } } : { id: "del_1" }),
    { maxRetries: 1 },
  );
  assert.equal((await sdk.emails.cancel("msg_1")).error, null);
  assert.equal((await sdk.emails.get("del_1")).error, null);
  assert.equal(calls.length, 4);
});

test("a delivery detail that is not an object is a protocol failure", async () => {
  for (const body of ["null", "[]", '"text"']) {
    const { sdk } = fixture(() => new Response(body, { status: 200 }));
    assert.equal((await sdk.emails.get("del_1")).error.kind, "protocol");
  }
});

const variable = {
  id: "var_1",
  key: "first_name",
  type: "string",
  required: true,
  fallback_value: null,
};
const templateVersion = {
  id: "ver_2",
  template_id: "tpl_1",
  version_number: 2,
  status: "published",
  subject: "Welcome, {{first_name}}",
  html: "<p>Hi {{first_name}}</p>",
  text: null,
  variables: [variable],
};
const template = {
  id: "tpl_1",
  name: "Welcome",
  alias: "welcome",
  origin: "custom",
  published_version_id: "ver_2",
  draft_version: null,
  published_version: templateVersion,
};
const domain = {
  id: "dom_1",
  domain: "mail.example.com",
  status: "pending",
  region: "global",
  open_tracking: true,
  dns_records: [{ id: "dns_1", purpose: "dkim", record_type: "CNAME", status: "pending" }],
};

function assertTenantFree(calls) {
  for (const call of calls) {
    assert.equal(call.headers.get("authorization"), "Bearer nc_test_key");
    for (const key of ["orgId", "organizationId", "projectId"]) {
      assert.equal(new URL(call.url).searchParams.has(key), false);
      assert.equal(Object.hasOwn(call.body ?? {}, key), false);
      assert.equal(call.headers.has(key), false);
    }
  }
}

test("suppressions list sends search, limit, and cursor and returns the page", async () => {
  const page = {
    items: [
      { email: "gone@example.com", reason: "hard_bounce" },
      { email: "reader@example.com", reason: "unsubscribed" },
    ],
    nextCursor: "next_1",
    hasMore: true,
  };
  const { sdk, calls } = fixture(() => json({ message: "Email suppressions fetched", data: page }));

  const listed = await sdk.emails.suppressions.list({
    search: "example.com",
    limit: 2,
    cursor: "cur_1",
    projectId: "forbidden",
  });
  assert.equal(listed.error, null);
  assert.deepEqual(listed.data, page);
  assert.equal(calls[0].method, "GET");
  assert.equal(new URL(calls[0].url).pathname, "/api/v1/emails/suppressions");
  assert.deepEqual(Object.fromEntries(new URL(calls[0].url).searchParams), {
    search: "example.com",
    limit: "2",
    cursor: "cur_1",
  });
  assert.equal(calls[0].body, undefined);

  await sdk.emails.suppressions.list();
  assert.equal(calls[1].url, "https://api-connect.nxiom.com/api/v1/emails/suppressions");
  assertTenantFree(calls);
});

test("template methods follow the backend contract and unwrap their data", async () => {
  const page = { items: [template], total: 1, page: 2, limit: 10 };
  const { sdk, calls } = fixture((url) => {
    const { pathname } = new URL(url);
    if (pathname.endsWith("/variables")) {
      // The variables endpoint returns { data } without a message.
      return json({ data: [variable] });
    }
    if (pathname.endsWith("/versions")) {
      return json({ message: "Email template versions fetched", data: [templateVersion] });
    }
    if (pathname.endsWith("/templates")) {
      return json({ message: "Email templates fetched", data: page });
    }
    return json({ message: "Email template details fetched", data: template });
  });

  const listed = await sdk.templates.list({
    page: 2,
    limit: 10,
    status: "changes_in_draft",
    search: "Welcome & Co",
    origin: "custom",
    category: "onboarding",
    orgId: "forbidden",
  });
  assert.deepEqual(listed.data, page);
  assert.equal(calls[0].method, "GET");
  assert.equal(new URL(calls[0].url).pathname, "/api/v1/emails/templates");
  assert.deepEqual(Object.fromEntries(new URL(calls[0].url).searchParams), {
    page: "2",
    limit: "10",
    status: "changes_in_draft",
    search: "Welcome & Co",
    origin: "custom",
    category: "onboarding",
  });

  await sdk.templates.list();
  assert.equal(calls[1].url, "https://api-connect.nxiom.com/api/v1/emails/templates");

  assert.deepEqual((await sdk.templates.get("tpl_1")).data, template);
  assert.equal(calls[2].url, "https://api-connect.nxiom.com/api/v1/emails/templates/tpl_1");

  await sdk.templates.get("id/with ?#");
  assert.match(calls[3].url, /\/templates\/id%2Fwith%20%3F%23$/);

  assert.deepEqual((await sdk.templates.variables("tpl_1")).data, [variable]);
  assert.equal(
    calls[4].url,
    "https://api-connect.nxiom.com/api/v1/emails/templates/tpl_1/variables",
  );

  assert.deepEqual((await sdk.templates.versions("tpl_1", { limit: 1, beforeVersion: 3 })).data, [
    templateVersion,
  ]);
  assert.equal(
    calls[5].url,
    "https://api-connect.nxiom.com/api/v1/emails/templates/tpl_1/versions?limit=1&beforeVersion=3",
  );

  await sdk.templates.versions("tpl_1");
  assert.equal(calls[6].url, "https://api-connect.nxiom.com/api/v1/emails/templates/tpl_1/versions");

  assert.ok(calls.every((call) => call.method === "GET" && call.body === undefined));
  assertTenantFree(calls);
});

test("template collections that are not arrays are protocol failures", async () => {
  for (const data of [{ items: [] }, {}]) {
    const { sdk } = fixture(() => json({ data }));
    assert.equal((await sdk.templates.variables("tpl_1")).error.kind, "protocol");
    assert.equal((await sdk.templates.versions("tpl_1")).error.kind, "protocol");
  }
  const { sdk: denied } = fixture(() => json({ message: "Not found" }, 404));
  assert.equal((await denied.templates.variables("tpl_1")).error.status, 404);
  assert.equal((await denied.templates.versions("tpl_1")).error.status, 404);
});

test("domain methods follow the backend contract and unwrap their data", async () => {
  const page = { items: [domain], total: 1, page: 1, limit: 50 };
  const { sdk, calls } = fixture((url, init) => {
    if (init.method === "DELETE") {
      return json({ success: true });
    }
    if (init.method === "POST") {
      // Create and verify return { data } without a message.
      return json({ data: url.endsWith("/verify") ? { ...domain, status: "verified" } : domain });
    }
    if (new URL(url).pathname.endsWith("/domains")) {
      return json({ message: "Email domains fetched", data: page });
    }
    return json({ message: "Email domain details fetched", data: domain });
  });

  const created = await sdk.domains.create({
    domain: "mail.example.com",
    openTracking: false,
    projectId: "forbidden",
  });
  assert.deepEqual(created.data, domain);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "https://api-connect.nxiom.com/api/v1/emails/domains");
  assert.equal(calls[0].headers.get("content-type"), "application/json");
  assert.deepEqual(calls[0].body, { domain: "mail.example.com", openTracking: false });

  await sdk.domains.create({ domain: "mail.example.com" });
  assert.deepEqual(calls[1].body, { domain: "mail.example.com" });

  const listed = await sdk.domains.list({
    page: 1,
    limit: 50,
    status: "verified",
    search: "example",
    orgId: "forbidden",
  });
  assert.deepEqual(listed.data, page);
  assert.equal(calls[2].method, "GET");
  assert.equal(
    calls[2].url,
    "https://api-connect.nxiom.com/api/v1/emails/domains?page=1&limit=50&status=verified&search=example",
  );

  await sdk.domains.list();
  assert.equal(calls[3].url, "https://api-connect.nxiom.com/api/v1/emails/domains");

  assert.deepEqual((await sdk.domains.get("dom_1")).data, domain);
  assert.equal(calls[4].method, "GET");
  assert.equal(calls[4].url, "https://api-connect.nxiom.com/api/v1/emails/domains/dom_1");

  assert.equal((await sdk.domains.verify("dom_1")).data.status, "verified");
  assert.equal(calls[5].method, "POST");
  assert.equal(calls[5].url, "https://api-connect.nxiom.com/api/v1/emails/domains/dom_1/verify");
  assert.equal(calls[5].body, undefined);
  assert.equal(calls[5].headers.has("content-type"), false);

  assert.deepEqual((await sdk.domains.delete("id/with ?#")).data, { success: true });
  assert.equal(calls[6].method, "DELETE");
  assert.match(calls[6].url, /\/domains\/id%2Fwith%20%3F%23$/);
  assertTenantFree(calls);
});

test("template, domain, and suppression reads and domain verification retry", async () => {
  const { sdk, calls } = fixture(
    (url, _, n) => {
      if (n % 2 === 1) {
        return json({ message: "Unavailable" }, 503, { "retry-after": "0" });
      }
      const { pathname } = new URL(url);
      if (pathname.endsWith("/variables") || pathname.endsWith("/versions")) {
        return json({ data: [] });
      }
      return json({ data: {} });
    },
    { maxRetries: 1 },
  );
  for (const read of [
    () => sdk.emails.suppressions.list(),
    () => sdk.templates.list(),
    () => sdk.templates.get("tpl_1"),
    () => sdk.templates.variables("tpl_1"),
    () => sdk.templates.versions("tpl_1"),
    () => sdk.domains.list(),
    () => sdk.domains.get("dom_1"),
    () => sdk.domains.verify("dom_1"),
  ]) {
    assert.equal((await read()).error, null);
  }
  assert.equal(calls.length, 16);
  assert.equal(calls[14].method, "POST");
  assert.equal(calls[15].url, calls[14].url);
});

test("domain create and delete never retry even with an increased retry count", async () => {
  const { sdk, calls } = fixture(() => json({}, 503, { "retry-after": "0" }), { maxRetries: 10 });
  assert.equal((await sdk.domains.create({ domain: "mail.example.com" })).error.status, 503);
  assert.equal((await sdk.domains.delete("dom_1")).error.status, 503);
  assert.equal(calls.length, 2);

  const { sdk: offline, calls: attempts } = fixture(
    () => {
      throw new Error("connection lost");
    },
    { maxRetries: 10 },
  );
  assert.equal((await offline.domains.create({ domain: "mail.example.com" })).error.kind, "network");
  assert.equal((await offline.domains.delete("dom_1")).error.kind, "network");
  assert.equal(attempts.length, 2);
});

test("invalid template, domain, and suppression arguments fail before fetch", () => {
  const { sdk, calls } = fixture();
  for (const action of [
    () => sdk.emails.suppressions.list({ search: "" }),
    () => sdk.emails.suppressions.list({ search: "   " }),
    () => sdk.emails.suppressions.list({ search: "x".repeat(256) }),
    () => sdk.emails.suppressions.list({ search: 1 }),
    () => sdk.emails.suppressions.list({ limit: 0 }),
    () => sdk.emails.suppressions.list({ limit: 101 }),
    () => sdk.emails.suppressions.list({ limit: 1.5 }),
    () => sdk.emails.suppressions.list({ cursor: "" }),
    () => sdk.emails.suppressions.list({ cursor: "x".repeat(401) }),
    () => sdk.templates.list({ page: 0 }),
    () => sdk.templates.list({ page: 10_001 }),
    () => sdk.templates.list({ page: 1.5 }),
    () => sdk.templates.list({ limit: 0 }),
    () => sdk.templates.list({ limit: 101 }),
    () => sdk.templates.list({ status: "saved" }),
    () => sdk.templates.list({ origin: "shared" }),
    () => sdk.templates.list({ search: 1 }),
    () => sdk.templates.list({ category: ["welcome"] }),
    () => sdk.templates.get(""),
    () => sdk.templates.get(".."),
    () => sdk.templates.variables(" "),
    () => sdk.templates.variables("."),
    () => sdk.templates.versions(""),
    () => sdk.templates.versions("tpl_1", { limit: 101 }),
    () => sdk.templates.versions("tpl_1", { limit: 0 }),
    () => sdk.templates.versions("tpl_1", { beforeVersion: 0 }),
    () => sdk.templates.versions("tpl_1", { beforeVersion: 1.5 }),
    () => sdk.domains.create(),
    () => sdk.domains.create({}),
    () => sdk.domains.create({ domain: " " }),
    () => sdk.domains.create({ domain: "mail.example.com", openTracking: "yes" }),
    () => sdk.domains.list({ page: 10_001 }),
    () => sdk.domains.list({ limit: 101 }),
    () => sdk.domains.list({ status: "active" }),
    () => sdk.domains.list({ search: 1 }),
    () => sdk.domains.get(""),
    () => sdk.domains.get(".."),
    () => sdk.domains.verify(""),
    () => sdk.domains.verify("."),
    () => sdk.domains.delete(""),
    () => sdk.domains.delete(".."),
  ]) {
    assert.throws(action, NexiomValidationError);
  }
  assert.equal(calls.length, 0);
});
