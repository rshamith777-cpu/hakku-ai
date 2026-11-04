const fs = require('fs');
const files = ['public/app.js', 'public/app2.js', 'public/app3.js', 'public/app4.js', 'public/boot.js'];
const js = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const html = fs.readFileSync('public/index.html', 'utf8');

const called = new Set([...js.matchAll(/(?<![\w.$])([a-zA-Z_][\w$]{2,})\s*\(/g)].map(m => m[1]));
const defined = new Set([...js.matchAll(/function\s+([a-zA-Z_][\w$]*)/g)].map(m => m[1]));
const builtin = new Set(['function','if','for','while','switch','catch','return','typeof','new','String','Number','Boolean','Array','Object','Math','Date','JSON','Promise','fetch','parseInt','parseFloat','isNaN','Set','Map','Uint8Array','TextEncoder','crypto','btoa','atob','alert','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','matchMedia','getComputedStyle','encodeURIComponent','decodeURIComponent','Error','AbortController','URLSearchParams','performance','structuredClone','Intl','Function','require','console']);
const missing = [...called].filter(f => !defined.has(f) && !builtin.has(f));
console.log('missing functions:', missing.length ? missing.join(', ') : 'NONE');

const cssClasses = new Set([...html.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
const used = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/class="([^"]+)"/g)) {
    for (let c of m[1].split(/\s+/)) {
      c = c.trim();
      if (!c || c.includes('$') || c.includes('{')) continue;
      used.add(c);
    }
  }
}
const tw = /^(flex|grid|gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|min|max|text|bg|border|rounded|font|items|justify|space|inline|block|hidden|absolute|relative|sticky|fixed|top|left|right|bottom|z|opacity|overflow|shadow|transition|duration|ease|animate|hover|focus|ring|uppercase|lowercase|truncate|whitespace|leading|tracking|col|row|sm|md|lg|xl|print|no|sr|select|appearance|outline|cursor|divide|place|content|self|order|basis|grow|shrink|aspect|object|list|whitespace|break|decoration|italic|not-italic|underline|antialiased|backdrop|blur|filter|invert|grayscale)/;
const unknown = [...used].filter(c => !cssClasses.has(c) && !tw.test(c) && !c.includes(':') && !/^(p|m|w|h|text|bg|border|gap|space|grid|flex|rounded|font|max|min|top|left|right|bottom|z|opacity|col|row)[-\d]/.test(c));
console.log('unknown css classes:', unknown.length ? unknown.join(', ') : 'NONE');
