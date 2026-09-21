import { NexiomConnect } from "@nexiom/connect";

const nexiomConnect = new NexiomConnect({
  apiKey: process.env.NEXIOM_API_KEY,
});

const { data, error } = await nexiomConnect.contacts.create({
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
});

if (error) {
  console.error(error.message);
  process.exitCode = 1;
} else {
  console.log(data.id);
}
