const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = process.cwd();
const payloadPath = path.join(root, "source.bundle.b64");
if (!fs.existsSync(payloadPath)) {
  console.error("Project You+ source bundle is missing.");
  process.exit(1);
}

const encoded = fs.readFileSync(payloadPath, "utf8").trim();
const archive = zlib.gunzipSync(Buffer.from(encoded, "base64"));
const files = JSON.parse(archive.toString("utf8"));

for (const [relativePath, contentBase64] of Object.entries(files)) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(contentBase64, "base64"));
}

console.log(`Project You+ source restored (${Object.keys(files).length} files).`);
