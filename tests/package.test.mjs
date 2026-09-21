import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

test("packed package supports ESM, CommonJS, and TypeScript", () => {
  const temporary = mkdtempSync(join(tmpdir(), "nexiom-connect-package-"));
  const env = { ...process.env, npm_config_cache: join(temporary, "cache") };

  try {
    const packed = JSON.parse(
      execFileSync(npm, ["pack", "--ignore-scripts", "--json", "--pack-destination", temporary], {
        encoding: "utf8",
        env,
      }),
    )[0];

    const paths = packed.files.map((file) => file.path);

    for (const required of [
      "LICENSE",
      "NOTICE",
      "README.md",
      "dist/index.js",
      "dist/index.d.ts",
      "dist/index.cjs",
      "dist/index.d.cts",
    ]) {
      assert.ok(paths.includes(required), required);
    }

    assert.ok(
      paths.every(
        (path) =>
          !path.startsWith("tests/") &&
          !path.startsWith(".github/") &&
          !path.startsWith("docs/") &&
          !path.startsWith("scripts/") &&
          !path.includes(".env"),
      ),
    );

    writeFileSync(
      join(temporary, "package.json"),
      JSON.stringify({ private: true, type: "module" }),
    );

    execFileSync(
      npm,
      [
        "install",
        join(temporary, packed.filename),
        "--ignore-scripts",
        "--offline",
        "--no-audit",
        "--no-fund",
      ],
      { cwd: temporary, stdio: "inherit", env },
    );
    for (const file of ["esm.mjs", "cjs.cjs"]) {
      writeFileSync(join(temporary, file), readFileSync(`tests/fixtures/${file}`));
      execFileSync(process.execPath, [file], { cwd: temporary, stdio: "inherit" });
    }

    for (const ext of ["mts", "cts"]) {
      writeFileSync(
        join(temporary, `consumer.${ext}`),
        readFileSync(`tests/types/consumer.${ext}`),
      );
    }
    writeFileSync(join(temporary, "tsconfig.json"), readFileSync("tests/types/tsconfig.json"));
    execFileSync(
      process.execPath,
      [resolve("node_modules/typescript/bin/tsc"), "-p", join(temporary, "tsconfig.json")],
      { stdio: "inherit" },
    );
    console.log(
      `Verified packed ESM, CommonJS, declarations, and publish contents (${packed.size} bytes).`,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
