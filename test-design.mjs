import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('./studio.css',import.meta.url),'utf8');

test('revised theme and AI settings actions are present in the local HTML website',()=>{
  assert.match(html,/href="\.\/studio\.css"/);
  assert.match(html,/id="settingsBtn"[^>]*>[\s\S]*?AI Settings/);
  assert.match(html,/id="themeBtn"[^>]*>[\s\S]*?Light mode/);
  assert.match(app,/function renderThemeButton\(/);
  assert.match(app,/saveStore\('aitlas-light',light\)/);
});
test('real processing state renders and clears animated output loader',()=>{
  assert.match(app,/function showProcessingLoader\(/);
  assert.match(app,/class="ai-wait"/);
  assert.match(app,/if\(busy\)showProcessingLoader\(\)/);
  assert.match(app,/finally\{setBusy\(false\)\}/);
  assert.match(app,/const stage=\$\('aiWaitStage'\);if\(stage\)stage\.textContent=/);
  assert.match(app,/setOutput\(result/);
  assert.match(app,/outputError\(/);
});
test('tool jelly, loader, light theme, mobile and reduced motion styles exist',()=>{
  for(const selector of ['@keyframes jelly-card','@keyframes jelly-icon','@keyframes wait-orbit','.ai-wait','body.light .tool-card','@media(max-width:460px)','@media(prefers-reduced-motion:reduce)'])assert.ok(css.includes(selector),selector);
});

test('hover cannot restart fade-in or briefly hide cards',()=>{
 assert.match(css,/\.tool-card \{[^}]*opacity:1;visibility:visible;animation:none;/);
 assert.match(css,/\.tool-card:is\(:hover,:focus-visible\) \{[^}]*animation:none;/);
 assert.match(css,/\.tool-card:is\(:hover,:focus-visible\) \.card-icon \{animation:jelly-icon/);
 assert.doesNotMatch(css,/\.tool-card:is\(:hover,:focus-visible\)[^{]*\{[^}]*animation:jelly-card/);
});
