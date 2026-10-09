import { NexiomConnect } from "@nexiom/connect";

const nexiomConnect = new NexiomConnect({
  apiKey: process.env.NEXIOM_API_KEY,
});

const { data, error } = await nexiomConnect.templates.list({
  status: "published",
});

if (error) {
  console.error(error.message);
  process.exitCode = 1;
} else {
  for (const template of data.items) {
    console.log(template.id, template.name);
  }
}
