import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function checksum(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

const prompts = [
  "The quick brown fox jumps over the lazy dog near the river bank. Birds sing softly in the morning light while clouds drift across the pale blue sky above the quiet village.",
  "Technology has transformed the way we communicate with each other. From simple letters to instant messages, the speed of human connection continues to grow at a remarkable pace.",
  "Every great achievement begins with a single step forward. The journey may be long and difficult, but those who persist will find that their efforts are rewarded in unexpected ways.",
  "The ocean waves crashed against the rocky shore as the sun began to set behind the distant mountains. A cool breeze carried the scent of salt and pine through the evening air.",
  "Learning a new skill requires patience and dedication. Whether it is playing music, writing code, or mastering a sport, consistent practice is the key to steady improvement.",
  "The old library stood at the corner of the street, its shelves filled with stories from every corner of the world. Each book held a different adventure waiting to be discovered.",
  "Clear communication is essential in every aspect of life. The ability to express ideas simply and listen carefully can make the difference between success and failure in any project.",
  "Rain fell steadily on the tin roof, creating a gentle rhythm that filled the small cabin. Inside, a warm fire crackled softly as the evening settled into peaceful silence.",
  "The garden was full of color in the early spring. Bright flowers bloomed along the winding path, and the sweet fragrance of blossoms attracted butterflies from the nearby meadow.",
  "Science and curiosity have always driven humanity forward. By asking questions and seeking answers, we have built a world that our ancestors could never have imagined possible.",
];

async function main() {
  // Season 0
  await prisma.season.upsert({
    where: { id: "season-0" },
    update: {},
    create: {
      id: "season-0",
      name: "Season 0",
      status: "active",
    },
  });

  // Prompts
  for (const text of prompts) {
    const normalized = normalize(text);
    const hash = checksum(normalized);
    await prisma.promptCatalog.upsert({
      where: { checksum: hash },
      update: {},
      create: {
        text,
        normalizedText: normalized,
        checksum: hash,
      },
    });
  }

  console.log(`Seeded: 1 season, ${prompts.length} prompts`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
