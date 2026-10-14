import test from "node:test";
import assert from "node:assert/strict";
import { NexiomConnect, NexiomValidationError } from "../dist/index.js";

const message = {
  id: "msg_1",
  channel: "whatsapp",
  status: "accepted",
  sender: "+213555000111",
  sender_name: "Acme",
  recipient: "+213555123456",
  category: "utility",
  template: { id: "wat_1", name: "order_update", language: "en_US", version: 1 },
  is_billable: true,
  cost: "0.0000",
  cost_currency: "DZD",
  failure_code: null,
  failure_reason: null,
  created_at: "2026-10-14T09:30:00.000Z",
  accepted_at: "2026-10-14T09:30:01.000Z",
  sent_at: null,
  delivered_at: null,
  read_at: null,
  failed_at: null,
};
const send = {
  channel: "whatsapp",
  from: "+213555000111",
  to: "+213555123456",
  template: { id: "wat_1", variables: { body: { 1: "Amina", 2: "A-1234" } } },
};

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

function fixture(handler = () => json({ message: "Message sent", data: message }), options = {}) {
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

test("the client exposes messaging.send and get only, and no whatsapp resource", () => {
  const { sdk } = fixture();
  assert.deepEqual(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.messaging)), [
    "constructor",
    "send",
    "get",
  ]);
  assert.equal(sdk.whatsapp, undefined);
});

test("send posts a WhatsApp template message with an idempotency key and unwraps data", async () => {
  const { sdk, calls } = fixture();
  const result = await sdk.messaging.send({ ...send, orgId: "forbidden", senderId: "was_1" });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, message);
  assert.equal(calls[0].url, "https://api-connect.nxiom.com/api/v1/messaging/messages");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.get("authorization"), "Bearer nc_test_key");
  assert.match(result.response.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(calls[0].headers.get("idempotency-key"), result.response.idempotencyKey);
  // Only the documented fields are sent; the phone number in `from` names the sender.
  assert.deepEqual(calls[0].body, {
    channel: "whatsapp",
    from: "+213555000111",
    to: "+213555123456",
    template: { id: "wat_1", variables: { body: { 1: "Amina", 2: "A-1234" } } },
  });
});

test("a template without variables sends no variables, and numbers are trimmed", async () => {
  const { sdk, calls } = fixture();
  await sdk.messaging.send(
    { channel: "whatsapp", from: " +213555000111 ", to: "+213555123456", template: { id: "wat_1" } },
    { idempotencyKey: "order-A-1234-shipped" },
  );

  assert.deepEqual(calls[0].body, {
    channel: "whatsapp",
    from: "+213555000111",
    to: "+213555123456",
    template: { id: "wat_1" },
  });
  assert.equal(calls[0].headers.get("idempotency-key"), "order-A-1234-shipped");
});

test("keyed sends retry transient failures with the same key; get retries too", async () => {
  const answers = [() => json({ error: "service_unavailable", message: "Busy" }, 503), () => json({ data: message })];
  const { sdk, calls } = fixture((url, init, count) => answers[count - 1](), { maxRetries: 1 });
  const sent = await sdk.messaging.send(send, { idempotencyKey: "key-1" });

  assert.equal(sent.error, null);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.get("idempotency-key"), "key-1");

  const reads = [() => json({ error: "too_many_requests" }, 429), () => json({ data: { ...message, content: null } })];
  const reader = fixture((url, init, count) => reads[count - 1](), { maxRetries: 1 });
  const read = await reader.sdk.messaging.get("msg_1");

  assert.equal(read.error, null);
  assert.equal(reader.calls.length, 2);
});

test("API refusals are returned with their status and code, without retrying", async () => {
  const { sdk, calls } = fixture(
    () =>
      json(
        {
          error: "unexpected_state",
          code: "whatsapp_template_not_approved",
          message: "This template is not approved by WhatsApp.",
          correlationId: "req_1",
        },
        422,
      ),
    { maxRetries: 2 },
  );
  const result = await sdk.messaging.send(send);

  assert.equal(result.data, null);
  assert.equal(result.error.status, 422);
  assert.equal(result.error.code, "whatsapp_template_not_approved");
  assert.equal(result.error.requestId, "req_1");
  assert.equal(calls.length, 1);
});

test("get reads one message by ID and returns its content", async () => {
  const details = {
    ...message,
    status: "read",
    content: {
      header: null,
      body: [
        { text: "Hi ", variable: null },
        { text: "Amina", variable: "1" },
      ],
      footer: null,
      buttons: [],
    },
  };
  const { sdk, calls } = fixture(() => json({ message: "Message fetched", data: details }));
  const result = await sdk.messaging.get("msg_1");

  assert.deepEqual(result.data, details);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "https://api-connect.nxiom.com/api/v1/messaging/messages/msg_1");
  assert.equal(calls[0].headers.get("idempotency-key"), null);
});

test("invalid send and get arguments fail before fetch", async () => {
  const { sdk, calls } = fixture();
  const template = (variables) => ({ ...send, template: { id: "wat_1", variables } });
  const invalid = [
    { ...send, channel: undefined },
    { ...send, channel: "sms" },
    { ...send, from: "was_1" },
    { ...send, from: "0555000111" },
    { ...send, to: "+0555" },
    { ...send, template: undefined },
    { ...send, template: { id: " " } },
    template([]),
    template({ body: { 1: 2 } }),
    template({ body: { "first name": "Amina" } }),
    template({ body: { 1: "x".repeat(1025) } }),
  ];

  for (const params of invalid) {
    assert.throws(() => sdk.messaging.send(params), NexiomValidationError, JSON.stringify(params));
  }

  assert.throws(() => sdk.messaging.send(send, { idempotencyKey: "has space" }), NexiomValidationError);
  assert.throws(() => sdk.messaging.send(send, { idempotencyKey: "k".repeat(201) }), NexiomValidationError);
  assert.throws(() => sdk.messaging.get(""), NexiomValidationError);
  assert.throws(() => sdk.messaging.get(".."), NexiomValidationError);
  assert.equal(calls.length, 0);
});
