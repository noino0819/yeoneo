// Next 밖에서 실행되는 스크립트용 .env.local 로더
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".env.local");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
