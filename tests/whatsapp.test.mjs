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
  sender: "+213555000111",
  to: "+213555123456",
  templateId: "wat_1",
  variables: { body: { 1: "Amina", 2: "A-1234" } },
};

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

function fixture(handler = () => json({ message: "WhatsApp message sent", data: message }), options = {}) {
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

test("the client exposes whatsapp.messages.send and get only", () => {
  const { sdk } = fixture();
  assert.deepEqual(Object.getOwnPropertyNames(sdk.whatsapp), ["messages"]);
  assert.deepEqual(Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.whatsapp.messages)), [
    "constructor",
    "send",
    "get",
  ]);
});

test("send posts the template send with an idempotency key and unwraps data", async () => {
  const { sdk, calls } = fixture();
  const result = await sdk.whatsapp.messages.send({ ...send, orgId: "forbidden", senderId: "was_1" });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, message);
  assert.equal(calls[0].url, "https://api-connect.nxiom.com/api/v1/messaging/whatsapp/messages");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.get("authorization"), "Bearer nc_test_key");
  assert.match(result.response.idempotencyKey, /^[0-9a-f-]{36}$/);
  assert.equal(calls[0].headers.get("idempotency-key"), result.response.idempotencyKey);
  // Only the documented fields are sent; the phone number names the sender.
  assert.deepEqual(calls[0].body, {
    sender: "+213555000111",
    to: "+213555123456",
    templateId: "wat_1",
    variables: { body: { 1: "Amina", 2: "A-1234" } },
  });
});

test("a template without variables sends no variables, and numbers are trimmed", async () => {
  const { sdk, calls } = fixture();
  await sdk.whatsapp.messages.send(
    { sender: " +213555000111 ", to: "+213555123456", templateId: "wat_1" },
    { idempotencyKey: "order-A-1234-shipped" },
  );

  assert.deepEqual(calls[0].body, { sender: "+213555000111", to: "+213555123456", templateId: "wat_1" });
  assert.equal(calls[0].headers.get("idempotency-key"), "order-A-1234-shipped");
});

test("keyed sends retry transient failures with the same key; get retries too", async () => {
  const answers = [() => json({ error: "service_unavailable", message: "Busy" }, 503), () => json({ data: message })];
  const { sdk, calls } = fixture((url, init, count) => answers[count - 1](), { maxRetries: 1 });
  const sent = await sdk.whatsapp.messages.send(send, { idempotencyKey: "key-1" });

  assert.equal(sent.error, null);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.get("idempotency-key"), "key-1");

  const reads = [() => json({ error: "too_many_requests" }, 429), () => json({ data: { ...message, content: null } })];
  const reader = fixture((url, init, count) => reads[count - 1](), { maxRetries: 1 });
  const read = await reader.sdk.whatsapp.messages.get("msg_1");

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
  const result = await sdk.whatsapp.messages.send(send);

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
  const { sdk, calls } = fixture(() => json({ message: "WhatsApp message fetched", data: details }));
  const result = await sdk.whatsapp.messages.get("msg_1");

  assert.deepEqual(result.data, details);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].url, "https://api-connect.nxiom.com/api/v1/messaging/whatsapp/messages/msg_1");
  assert.equal(calls[0].headers.get("idempotency-key"), null);
});

test("invalid send and get arguments fail before fetch", async () => {
  const { sdk, calls } = fixture();
  const invalid = [
    { ...send, sender: "was_1" },
    { ...send, sender: "0555000111" },
    { ...send, to: "+0555" },
    { ...send, templateId: " " },
    { ...send, variables: [] },
    { ...send, variables: { body: { 1: 2 } } },
    { ...send, variables: { body: { "first name": "Amina" } } },
    { ...send, variables: { body: { 1: "x".repeat(1025) } } },
  ];

  for (const params of invalid) {
    assert.throws(() => sdk.whatsapp.messages.send(params), NexiomValidationError, JSON.stringify(params));
  }

  assert.throws(() => sdk.whatsapp.messages.send(send, { idempotencyKey: "has space" }), NexiomValidationError);
  assert.throws(() => sdk.whatsapp.messages.send(send, { idempotencyKey: "k".repeat(201) }), NexiomValidationError);
  assert.throws(() => sdk.whatsapp.messages.get(""), NexiomValidationError);
  assert.throws(() => sdk.whatsapp.messages.get(".."), NexiomValidationError);
  assert.equal(calls.length, 0);
});
