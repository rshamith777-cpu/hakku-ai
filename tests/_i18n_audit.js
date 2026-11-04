const fs = require('fs');
const files = ['public/app.js', 'public/app2.js', 'public/app3.js', 'public/app4.js'];
const seen = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  // text between > and < that isn't a T() call, emoji, number, or symbol
  for (const m of s.matchAll(/>\s*([A-Za-z][A-Za-z '&\/-]{3,})\s*</g)) {
    const t = m[1].trim();
    if (!seen.has(t)) { seen.add(t); console.log(f + '  >' + t + '<'); }
  }
  // mono-label style hardcoded strings in attributes/placeholders
  for (const m of s.matchAll(/placeholder="([^"$\{][^"]{3,})"/g)) {
    const t = m[1];
    if (!seen.has(t) && /[a-z]{3}/.test(t)) { seen.add(t); console.log(f + '  PH:' + t); }
  }
}
