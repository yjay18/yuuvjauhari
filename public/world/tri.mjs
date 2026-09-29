await until(`window.__scene !== undefined`, 120000);
await sleep(300);
const ev = (s) => evaluate(s);
await ev(`__scene.pause(); __scene.advance(13); true`); // every full mesh built
for (const v of ['overview', 'hub', 'shipped', 'more', 'education', 'work', 'contact']) {
  const r = await ev(`(() => { __scene.jump('${v}'); __scene.advance(0.2); const g = __scene.three.scene.getObjectByName('houses'); const s = __scene.stats(); g.visible = false; const s2 = __scene.stats(); g.visible = true; return { calls: s.calls, tris: s.triangles, houseCalls: s.calls - s2.calls, houseTris: s.triangles - s2.triangles }; })()`);
  console.log(v, JSON.stringify(r));
}
