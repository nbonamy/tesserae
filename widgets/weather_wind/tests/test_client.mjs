import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Run the real widget without its Chart.js dependency: no hourly points are
// needed to exercise the solar footer and wind bearing markup.
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export default function render', 'function render');
const render = new Function(`${source}\nreturn render;`)();
for (const [from, label, towards] of [[0, 'N', 180], [90, 'E', 270], [180, 'S', 360], [270, 'W', 450]]) {
  const shadow = { host: { clientWidth: 800 }, innerHTML: '' };
  render(shadow, { data: { wind_direction: from, sunrise: '06:29', sunset: '16:41', now: 7, feels_like: 5 } });
  assert.ok(shadow.innerHTML.includes(`rotate(${towards}deg)`));
  assert.ok(shadow.innerHTML.includes(`hr-wind-direction">${label}<`));
  assert.ok(shadow.innerHTML.includes('Sunrise 06:29'));
  assert.ok(shadow.innerHTML.includes('Sunset 16:41'));
  assert.ok(shadow.innerHTML.includes('FEELS LIKE 5°'));
}
console.log('Solar footer and four cardinal wind bearings pass.');
