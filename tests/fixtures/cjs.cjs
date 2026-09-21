const assert = require("node:assert/strict");
const { NexiomConnect } = require("@nexiom/connect");

async function main() {
  const nexiomConnect = new NexiomConnect({
    apiKey: "nc_test",
    fetch: async () =>
      Response.json({
        data: { messageId: "message_1", totalQueued: 1, deliveryIds: ["delivery_1"] },
      }),
  });

  const { data, error } = await nexiomConnect.emails.send({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Hello",
    text: "Hello",
  });

  assert.equal(error, null);
  assert.equal(data.messageId, "message_1");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
