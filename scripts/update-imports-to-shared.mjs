import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const exts = new Set([".ts", ".tsx"]);
const skipDirs = new Set(["node_modules", ".next", "backend"]);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile() && exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

const replacements = [
  {
    re: /from\s+"@\/lib\/interface\//g,
    to: 'from "@shared/interfaces/',
  },
  {
    re: /from\s+"@\/lib\/utils\/objDefaultValidation"/g,
    to: 'from "@shared/utils/objDefaultValidation"',
  },
  {
    re: /from\s+"@\/lib\/utils\/personalDetailsValidation"/g,
    to: 'from "@shared/utils/personalDetailsValidation"',
  },
  {
    re: /from\s+"@\/lib\/utils\/addressValidation"/g,
    to: 'from "@shared/utils/addressValidation"',
  },
  {
    re: /from\s+"@\/lib\/utils\/isBusinessOpenNow"/g,
    to: 'from "@shared/utils/isBusinessOpenNow"',
  },
];

const files = walk(root);
let changed = 0;

for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  let next = orig;
  for (const { re, to } of replacements) next = next.replace(re, to);
  if (next !== orig) {
    fs.writeFileSync(f, next, "utf8");
    changed++;
  }
}

console.log(JSON.stringify({ updatedFiles: changed }, null, 2));

