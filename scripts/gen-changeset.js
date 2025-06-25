const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("❌ Usage: pnpm gen:changeset -- <changed files>");
  process.exit(1);
}

const raw = execSync(`pnpm nx show projects --affected --files=${files.join(" ")}`).toString();
const affected = raw.split("\n").map(s => s.trim()).filter(Boolean);
if (!affected.length) {
  console.log("✅ No affected workspaces found");
  process.exit(0);
}

const header = "---\n" + affected.map(p => `${p}: patch`).join("\n") + "\n---\n\n";
const body = `Auto-bump for changes in: ${files.join(", ")}`;
const slug = `auto-${Date.now()}`;
fs.writeFileSync(path.join(".changeset", `${slug}.md`), header + body);
console.log(`✅ Created .changeset/${slug}.md`);
