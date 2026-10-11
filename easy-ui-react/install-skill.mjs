import {
  lstat,
  mkdir,
  readFile,
  readlink,
  symlink,
  unlink,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function isPackageSkill(target) {
  // Recognize installed package paths even after the old package is removed.
  if (
    target.endsWith(
      join("node_modules", "@easypost", "easy-ui", "skills", "easy-ui"),
    )
  )
    return true;
  try {
    const manifest = JSON.parse(
      await readFile(join(target, "../../package.json"), "utf8"),
    );
    return manifest.name === "@easypost/easy-ui";
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

if (process.env.EASY_UI_SKIP_SKILL_INSTALL !== "1") {
  const global =
    process.argv.includes("--global") ||
    process.env.npm_config_global === "true";
  const project = global
    ? homedir()
    : resolve(
        process.env.npm_config_local_prefix ||
          process.env.INIT_CWD ||
          process.cwd(),
      );
  const source = fileURLToPath(new URL("./skills/easy-ui", import.meta.url));
  for (const directory of [".agents", ".claude"]) {
    const destination = join(project, directory, "skills", "easy-ui");
    try {
      try {
        const existing = await lstat(destination);
        if (!existing.isSymbolicLink()) continue;
        const target = resolve(
          dirname(destination),
          await readlink(destination),
        );
        if (target === source || !(await isPackageSkill(target))) continue;
        await unlink(destination);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await mkdir(dirname(destination), { recursive: true });
      await symlink(
        process.platform === "win32"
          ? source
          : relative(dirname(destination), source),
        destination,
        process.platform === "win32" ? "junction" : "dir",
      );
      console.log(`Easy UI skill installed: ${destination}`);
    } catch (error) {
      // Optional agent setup must not prevent installing the component library.
      console.warn(`Easy UI skill setup skipped: ${error.message}`);
    }
  }
}
