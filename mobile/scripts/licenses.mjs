// Regenerates src/about/licenses.json (open-source libraries shown on the About screen).
// Run after adding or upgrading dependencies: npm run licenses
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const repoUrl = (repo) => {
  const url = typeof repo === "string" ? repo : repo?.url;
  if (!url) return null;
  return url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
};

const libraries = Object.keys(pkg.dependencies)
  .map((name) => {
    const dep = JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8"));
    const license = typeof dep.license === "string" ? dep.license : (dep.license?.type ?? "Không rõ");
    const author = typeof dep.author === "string" ? dep.author.replace(/\s*[<(].*$/, "") : (dep.author?.name ?? null);
    return {
      name,
      version: dep.version,
      license,
      author,
      url: repoUrl(dep.repository) ?? dep.homepage ?? `https://www.npmjs.com/package/${name}`,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(join(root, "src", "about", "licenses.json"), JSON.stringify(libraries, null, 2) + "\n");
console.log(`${libraries.length} libraries → src/about/licenses.json`);
