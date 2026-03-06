import { readFile, writeFile } from "fs/promises";

const instructions = await readFile("instrukce.txt", "utf-8");
const n = parseInt(instructions.trim());

const tasks = Array.from({ length: n + 1 }, (_, i) =>
  writeFile(`${i}.txt`, `Soubor ${i}`)
);

await Promise.all(tasks);

console.log(`Successfully created ${n + 1} files (0.txt – ${n}.txt).`);
