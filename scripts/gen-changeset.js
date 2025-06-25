const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const nxJson = require("../nx.json");

// 1. Load package.json and extract PNPM workspace globs
const pkgJson = require("../package.json");
const workspaceGlobs = pkgJson.workspaces?.packages || [];

const realPackages = workspaceGlobs
  .flatMap(glob => {
    const baseDir = glob.replace("/*", "");
    if (!fs.existsSync(baseDir)) return [];
    return fs
      .readdirSync(baseDir)
      .map(dir => path.join(baseDir, dir))
      .filter(pkgDir => fs.existsSync(path.join(pkgDir, "package.json")));
  })
  .map(pkgDir => {
    const pkg = require(path.resolve(pkgDir, "package.json"));
    return pkg.name;
  });

// 2. Get changed files (vs origin/main)
function getChangedFiles(base = "origin/main") {
  try {
    const output = execSync(`git diff --name-only ${base}`).toString();
    return output.split("\n").map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.error("❌ Failed to get changed files:", e.message);
    process.exit(1);
  }
}

// 3. Use Nx to get affected projects
function getAffectedProjects(files) {
  try {
    const raw = execSync(`pnpm nx show projects --affected --files=${files.join(" ")}`).toString();
    return raw.split("\n").map(s => s.trim()).filter(Boolean);
  } catch (e) {
    console.error("❌ Failed to get affected projects:", e.message);
    process.exit(1);
  }
}

// 4. Map Nx project names to package names (only include real workspace packages)
function mapNxProjectsToPackageNames(projects) {
  return projects
    .map(project => {
      const relPath = nxJson.projects?.[project];
      if (!relPath) return null;

      const pkgJsonPath = path.resolve(relPath, "package.json");
      if (!fs.existsSync(pkgJsonPath)) return null;

      const pkg = require(pkgJsonPath);
      return pkg.name;
    })
    .filter(name => realPackages.includes(name));
}


// 5. Write the changeset file
function createChangesetFile(pkgNames, files) {
  const header = "---\n" + pkgNames.map(p => `${p}: patch`).join("\n") + "\n---\n\n";
  const body = `Auto-bump due to changes in:\n${files.join("\n")}`;
  const slug = `auto-${Date.now()}`;
  const dir = path.resolve(".changeset");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, `${slug}.md`), header + body);
  console.log(`✅ Created .changeset/${slug}.md`);
}

// === RUN ===

const changedFiles = getChangedFiles();
if (changedFiles.length === 0) {
  console.log("✅ No file changes since origin/main");
  process.exit(0);
}

const affectedProjects = getAffectedProjects(changedFiles);
if (affectedProjects.length === 0) {
  console.log("✅ No affected Nx projects");
  process.exit(0);
}

const affectedPackages = mapNxProjectsToPackageNames(affectedProjects);
if (affectedPackages.length === 0) {
  console.log("✅ No affected packages (ignoring utils like 'common')");
  process.exit(0);
}

createChangesetFile(affectedPackages, changedFiles);
