import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

const INSTRUCTIONS_FILE = "instrukce.txt";

// Check if instrukce.txt exists
if (!existsSync(INSTRUCTIONS_FILE)) {
  console.log(`Error: "${INSTRUCTIONS_FILE}" not found.`);
  process.exit(1);
}

// Read instrukce.txt
const instructions = await readFile(INSTRUCTIONS_FILE, "utf-8");
const [sourceFile, destinationFile] = instructions.trim().split(/\s+/);

if (!sourceFile || !destinationFile) {
  console.log(`Error: "${INSTRUCTIONS_FILE}" must contain two filenames separated by a space.`);
  process.exit(1);
}

// Check if source file exists
if (!existsSync(sourceFile)) {
  console.log(`Error: Source file "${sourceFile}" not found.`);
  process.exit(1);
}

// Read source and write to destination (creates destination if it doesn't exist)
const content = await readFile(sourceFile, "utf-8");
await writeFile(destinationFile, content, "utf-8");

console.log(`Done! Copied "${sourceFile}" → "${destinationFile}".`);
