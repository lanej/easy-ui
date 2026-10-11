import { lstat, mkdir, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.EASY_UI_SKIP_SKILL_INSTALL !== "1") {
  const global =
    process.argv.includes("--global") ||
    process.env.npm_config_global === "true";
  const project = global
    ? homedir()
    : resolve(process.env.INIT_CWD || process.cwd());
  const source = fileURLToPath(new URL("./skills/easy-ui", import.meta.url));
  for (const directory of [".agents", ".claude"]) {
    const destination = join(project, directory, "skills", "easy-ui");
    try {
      try {
        await lstat(destination);
        continue; // Preserve existing skills, including links managed elsewhere.
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
