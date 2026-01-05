import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  REST
} from "discord.js";

import vision from "@google-cloud/vision";
import * as deepl from "deepl-node";

/* ---------- CLIENT ---------- */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ---------- ENV ---------- */

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const GOOGLE_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (!DISCORD_TOKEN || !DEEPL_API_KEY || !GOOGLE_JSON) {
  throw new Error("Missing environment variables");
}

/* ---------- GOOGLE OCR ---------- */

const credentials = JSON.parse(GOOGLE_JSON);
const visionClient = new vision.ImageAnnotatorClient({ credentials });

/* ---------- DEEPL ---------- */

const translator = new deepl.Translator(DEEPL_API_KEY);

/* ---------- COMMAND ---------- */

const commands = [
  new SlashCommandBuilder()
    .setName("translatejp")
    .setDescription("Translate Japanese text or image to English")
    .addStringOption(o =>
      o.setName("text").setDescription("Japanese text")
    )
    .addAttachmentOption(o =>
      o.setName("image").setDescription("Image with Japanese text")
    )
];

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

/* ---------- REGISTER COMMAND ---------- */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log("Slash command registered.");
});

/* ---------- HANDLER ---------- */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "translatejp") return;

  await interaction.deferReply({ ephemeral: true });

  let jpText = interaction.options.getString("text");
  const image = interaction.options.getAttachment("image");

  try {
    if (!jpText && image) {
      const [result] = await visionClient.textDetection(image.url);
      jpText = result.fullTextAnnotation?.text;
    }

    if (!jpText) {
      return interaction.editReply("Please provide Japanese text or an image.");
    }

    const result = await translator.translateText(jpText, "ja", "en");

    await interaction.editReply(`**Translation:**\n${result.text}`);
  } catch (err) {
    console.error(err);
    await interaction.editReply("Failed to translate.");
  }
});

/* ---------- LOGIN ---------- */

client.login(DISCORD_TOKEN);
