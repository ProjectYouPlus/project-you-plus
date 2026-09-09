const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const root = process.cwd();
const parts = Array.from({ length: 9 }, (_, i) =>
  path.join(root, "bundle-v7", `part${String(i + 1).padStart(2, "0")}`)
);

for (const part of parts) {
  if (!fs.existsSync(part)) {
    console.error(`Missing Project You+ bundle part: ${part}`);
    process.exit(1);
  }
}

const encoded = parts.map((p) => fs.readFileSync(p, "utf8").trim()).join("");
const gz = Buffer.from(encoded, "base64");

const sha = crypto.createHash("sha256").update(gz).digest("hex");
const expected = "cd30699b50410970382844e615a8c785351fbfcb59cd6f17ce782428ae803e2f";

if (sha !== expected) {
  console.error(`Project You+ source checksum mismatch: ${sha}`);
  process.exit(1);
}

const raw = zlib.gunzipSync(gz);
const files = JSON.parse(raw.toString("utf8"));

for (const [relativePath, contentBase64] of Object.entries(files)) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(contentBase64, "base64"));
}

console.log(`Project You+ source restored (${Object.keys(files).length} files).`);
