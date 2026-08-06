import fs from "fs";
import path from "path";

const hits: string[] = [];
function walk(d: string) {
  if (!fs.existsSync(d)) return;
  let list: fs.Dirent[];
  try {
    list = fs.readdirSync(d, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of list) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith(".js")) {
      const s = fs.readFileSync(p, "utf8");
      if (/AUTH_|TRUST|trustedHost|isUntrustedHost/i.test(s)) {
        hits.push(p);
      }
    }
  }
}
for (const p of ["next", "next-auth", "@auth"]) {
  walk(path.join("node_modules", p));
}
console.log(hits.slice(0, 30).join("\n"));

