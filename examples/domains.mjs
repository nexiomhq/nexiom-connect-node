import { NexiomConnect } from "@nexiom/connect";

const nexiomConnect = new NexiomConnect({
  apiKey: process.env.NEXIOM_API_KEY,
});

const { data, error } = await nexiomConnect.domains.create({
  domain: "mail.example.com",
});

if (error) {
  console.error(error.message);
  process.exitCode = 1;
} else {
  for (const record of data.dns_records ?? []) {
    console.log(record.record_type, record.name, record.value);
  }
}
