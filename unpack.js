const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = process.cwd();
const partNames = [
  "source.bundle.part1",
  "source.bundle.part2",
  "source.bundle.part3",
  "source.bundle.part4a",
  "source.bundle.part4b",
  "source.bundle.part5",
];

for (const partName of partNames) {
  if (!fs.existsSync(path.join(root, partName))) {
    console.error(`Project You+ source bundle is missing ${partName}.`);
    process.exit(1);
  }
}

const encoded = partNames
  .map((partName) => fs.readFileSync(path.join(root, partName), "utf8").trim())
  .join("");

const archive = zlib.gunzipSync(Buffer.from(encoded, "base64"));
const files = JSON.parse(archive.toString("utf8"));

for (const [relativePath, contentBase64] of Object.entries(files)) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(contentBase64, "base64"));
}

console.log(`Project You+ source restored (${Object.keys(files).length} files).`);
