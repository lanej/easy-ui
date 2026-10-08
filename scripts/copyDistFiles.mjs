import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Removes fields unnecessary for distribution from a package.json
 * file contents.
 *
 * @param {string} pkgFileContent package.json file contents
 * @param {{ preserveExports?: boolean }} options Keep exports relative to the published dist root.
 */
export function cleanPkgJsonForDist(
  pkgFileContent,
  { preserveExports = false } = {},
) {
  const restPkg = JSON.parse(pkgFileContent);
  const { exports } = restPkg;
  for (const key of [
    "scripts",
    "devDependencies",
    "exports",
    "publishConfig",
    "files",
  ])
    delete restPkg[key];
  if (preserveExports && exports) {
    const rebase = (value) => {
      if (typeof value === "string") return value.replace(/^\.\/dist\//, "./");
      if (Array.isArray(value)) return value.map(rebase);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, target]) => [key, rebase(target)]),
        );
      return value;
    };
    restPkg.exports = rebase(exports);
  }
  return JSON.stringify(restPkg, null, 2);
}

/*
 * Copies a single specified file to a dist folder, optionally transforming it.
 */
function createDistFileCopier(outFolder) {
  return (inFile, { transform } = { transform: (c) => c }) => {
    const filename = path.basename(inFile);
    if (!fs.existsSync(inFile)) {
      throw new Error(`Can't find ${filename} file`);
    }
    const outFilePath = path.join(outFolder, filename);
    const fileContent = fs.readFileSync(inFile, { encoding: "utf8" });
    const transformed = transform(fileContent);
    if (!fs.existsSync(outFolder)) {
      fs.mkdirSync(outFolder);
    }
    fs.writeFileSync(outFilePath, transformed, { encoding: "utf8" });
  };
}

/*
 * Copies dist files (package.json, README.md) from a project's root to its dist
 * folder for distribution. Removes some fields that aren't relevant for dist.
 */
function run() {
  const copyFile = createDistFileCopier(path.join(process.cwd(), "./dist"));
  copyFile(path.join(process.cwd(), "./package.json"), {
    transform: cleanPkgJsonForDist,
  });
  copyFile(path.join(process.cwd(), "./README.md"));
  copyFile(path.join(process.cwd(), "./CHANGELOG.md"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
}
