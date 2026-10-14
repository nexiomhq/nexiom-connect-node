import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import {
  NexiomConnect,
  NexiomValidationError,
  NexiomWebhookVerificationError,
} from "../dist/index.js";

const secret = "whsec_test_secret_value";
const event = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "email.delivered",
  schema_version: 1,
  data: {
    id: "delivery_1",
    message_id: "message_1",
    recipient: "reader@example.com",
    occurred_at: "2026-10-14T10:00:00.000Z",
  },
  created_at: "2026-10-14T10:00:00.000Z",
};

const now = () => Math.floor(Date.now() / 1000);

/** Signs like the backend: HMAC-SHA256 of `${timestamp}.${payload}` keyed with the full secret. */
function sign(payload, { timestamp = now(), key = secret } = {}) {
  const signature = createHmac("sha256", key).update(`${timestamp}.${payload}`).digest("hex");

  return {
    "x-nexiom-timestamp": String(timestamp),
    "x-nexiom-signature": signature,
  };
}

const webhooks = new NexiomConnect({ apiKey: "nc_test_key" }).webhooks;

function reasonOf(callback) {
  try {
    callback();
  } catch (error) {
    assert.ok(error instanceof NexiomWebhookVerificationError, `unexpected ${error}`);
    assert.equal(error.name, "NexiomWebhookVerificationError");
    return error.reason;
  }

  assert.fail("constructEvent accepted a request it should refuse");
}

test("the client exposes webhooks.constructEvent only, in ESM and CommonJS", () => {
  assert.deepEqual(Object.getOwnPropertyNames(Object.getPrototypeOf(webhooks)), [
    "constructor",
    "constructEvent",
  ]);

  const cjs = createRequire(import.meta.url)("../dist/index.cjs");
  assert.equal(typeof cjs.NexiomWebhookVerificationError, "function");
  assert.equal(typeof new cjs.NexiomConnect({ apiKey: "nc_test_key" }).webhooks.constructEvent, "function");
});

test("a signed request returns its event, from a string or a Buffer body", () => {
  const payload = JSON.stringify(event);
  const headers = sign(payload);

  assert.deepEqual(webhooks.constructEvent(payload, headers, secret), event);
  assert.deepEqual(webhooks.constructEvent(Buffer.from(payload), headers, secret), event);
  assert.deepEqual(
    webhooks.constructEvent(new TextEncoder().encode(payload), headers, secret),
    event,
  );
});

test("headers are read case-insensitively from Headers, Node headers, and plain objects", () => {
  const payload = JSON.stringify(event);
  const signed = sign(payload);

  const fetchHeaders = new Headers({
    "X-Nexiom-Timestamp": signed["x-nexiom-timestamp"],
    "X-Nexiom-Signature": signed["x-nexiom-signature"],
  });
  const upperCase = {
    "X-NEXIOM-TIMESTAMP": signed["x-nexiom-timestamp"],
    "X-NEXIOM-SIGNATURE": signed["x-nexiom-signature"].toUpperCase(),
  };
  // Node's IncomingHttpHeaders and PHP-style lists may carry an array.
  const lists = {
    "x-nexiom-timestamp": [signed["x-nexiom-timestamp"]],
    "x-nexiom-signature": [signed["x-nexiom-signature"]],
    "content-type": "application/json",
  };

  for (const headers of [fetchHeaders, upperCase, lists]) {
    assert.equal(webhooks.constructEvent(payload, headers, secret).id, event.id);
  }
});

test("missing or malformed signature headers are refused", () => {
  const payload = JSON.stringify(event);
  const signed = sign(payload);

  assert.equal(
    reasonOf(() => webhooks.constructEvent(payload, {}, secret)),
    "missing_headers",
  );
  assert.equal(
    reasonOf(() =>
      webhooks.constructEvent(payload, { "x-nexiom-timestamp": signed["x-nexiom-timestamp"] }, secret),
    ),
    "missing_headers",
  );
  assert.equal(
    reasonOf(() => webhooks.constructEvent(payload, { ...signed, "x-nexiom-signature": "  " }, secret)),
    "missing_headers",
  );

  for (const timestamp of ["1e9", "-10", "12.5", "soon", "99999999999999999999"]) {
    assert.equal(
      reasonOf(() =>
        webhooks.constructEvent(payload, { ...signed, "x-nexiom-timestamp": timestamp }, secret),
      ),
      "invalid_timestamp",
      timestamp,
    );
  }
});

test("timestamps outside the tolerance are refused in both directions", () => {
  const payload = JSON.stringify(event);

  for (const offset of [-301, 301]) {
    const headers = sign(payload, { timestamp: now() + offset });
    assert.equal(
      reasonOf(() => webhooks.constructEvent(payload, headers, secret)),
      "timestamp_out_of_tolerance",
    );
  }

  const old = sign(payload, { timestamp: now() - 280 });
  assert.equal(webhooks.constructEvent(payload, old, secret).id, event.id);

  const older = sign(payload, { timestamp: now() - 500 });
  assert.equal(webhooks.constructEvent(payload, older, secret, { tolerance: 600 }).id, event.id);
  assert.equal(
    reasonOf(() => webhooks.constructEvent(payload, older, secret, { tolerance: 60 })),
    "timestamp_out_of_tolerance",
  );
});

test("a changed body, timestamp, secret, or signature is refused", () => {
  const payload = JSON.stringify(event);
  const headers = sign(payload);

  // Re-serialized JSON no longer matches the signed bytes.
  const reformatted = JSON.stringify(event, null, 2);
  const cases = [
    () => webhooks.constructEvent(reformatted, headers, secret),
    () => webhooks.constructEvent(payload.replace("delivered", "bounced"), headers, secret),
    () =>
      webhooks.constructEvent(
        payload,
        { ...headers, "x-nexiom-timestamp": String(Number(headers["x-nexiom-timestamp"]) - 1) },
        secret,
      ),
    () => webhooks.constructEvent(payload, headers, "whsec_another_secret"),
    // The prefix is part of the key.
    () => webhooks.constructEvent(payload, headers, secret.replace("whsec_", "")),
    () => webhooks.constructEvent(payload, { ...headers, "x-nexiom-signature": "a".repeat(64) }, secret),
    () => webhooks.constructEvent(payload, { ...headers, "x-nexiom-signature": "not-hex" }, secret),
    () =>
      webhooks.constructEvent(
        payload,
        { ...headers, "x-nexiom-signature": headers["x-nexiom-signature"].slice(0, 62) },
        secret,
      ),
  ];

  for (const verify of cases) {
    assert.equal(reasonOf(verify), "invalid_signature");
  }
});

test("a correctly signed body that is not an event envelope is refused", () => {
  const bodies = [
    "not json",
    "[]",
    JSON.stringify({ ...event, id: 1 }),
    JSON.stringify({ ...event, data: null }),
    JSON.stringify({ ...event, data: [] }),
    JSON.stringify({ id: event.id, type: event.type, data: event.data }),
  ];

  for (const payload of bodies) {
    assert.equal(
      reasonOf(() => webhooks.constructEvent(payload, sign(payload), secret)),
      "invalid_payload",
      payload,
    );
  }

  const invalidUtf8 = Buffer.from([0x7b, 0xff, 0x7d]);
  const signature = createHmac("sha256", secret)
    .update(`${now()}.`)
    .update(invalidUtf8)
    .digest("hex");
  assert.equal(
    reasonOf(() =>
      webhooks.constructEvent(
        invalidUtf8,
        { "x-nexiom-timestamp": String(now()), "x-nexiom-signature": signature },
        secret,
      ),
    ),
    "invalid_payload",
  );
});

test("unknown event types are verified and returned", () => {
  const payload = JSON.stringify({ ...event, type: "email.future_event" });
  assert.equal(webhooks.constructEvent(payload, sign(payload), secret).type, "email.future_event");
});

test("invalid arguments are programming errors, not verification failures", () => {
  const payload = JSON.stringify(event);
  const headers = sign(payload);

  for (const call of [
    () => webhooks.constructEvent(event, headers, secret),
    () => webhooks.constructEvent(payload, null, secret),
    () => webhooks.constructEvent(payload, headers, ""),
    () => webhooks.constructEvent(payload, headers, secret, { tolerance: 0 }),
    () => webhooks.constructEvent(payload, headers, secret, { tolerance: 1.5 }),
  ]) {
    assert.throws(call, NexiomValidationError);
  }
});

test("signatures match Node's HMAC-SHA256 for every block boundary and key length", () => {
  const timestamp = now();

  for (const length of [0, 1, 46, 47, 48, 54, 55, 56, 63, 64, 65, 119, 120, 127, 128, 1000, 70_000]) {
    for (const keyLength of [1, 32, 63, 64, 65, 200]) {
      const key = `whsec_${randomBytes(keyLength).toString("base64url")}`.slice(0, keyLength + 6);
      const body = JSON.stringify({ ...event, padding: "x".repeat(length) });
      const headers = sign(body, { timestamp, key });

      assert.equal(webhooks.constructEvent(body, headers, key).id, event.id, `${length}/${keyLength}`);
    }
  }

  const unicode = JSON.stringify({ ...event, data: { ...event.data, recipient: "مرحبا 👋" } });
  assert.equal(webhooks.constructEvent(unicode, sign(unicode), secret).data.recipient, "مرحبا 👋");
});
