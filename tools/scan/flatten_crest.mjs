// flatten_crest: squash the pointed leaf at the top centre of the chaise crest (made by mirroring the scan's left half)
// down to a soft dip between the two scrolls. Only vertices with |x| < W and y > Y0 move (vertical scale, faded out
// toward |x| = W), so everything else, and the left/right symmetry, stays exactly as it is.
//   node flatten_crest.mjs <model.js> <slot> [W=0.022] [Y0=0.80] [S=0.5]
const M = process.env.HOME + '/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const { MeshoptDecoder, MeshoptEncoder } = await import(M + 'meshoptimizer/index.js');
import fs from 'fs';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const [file, slot, Ws, Y0s, Ss] = process.argv.slice(2); const W = +(Ws ?? 0.022), Y0 = +(Y0s ?? 0.80), S = +(Ss ?? 0.5);
let js = fs.readFileSync(file, 'utf8');
const mod = (await import('file://' + fs.realpathSync(file) + '?' + Date.now())).default;
const s = mod.slots.find(q => q.slot === slot);
const vb = new Uint8Array(s.nv * 16); MeshoptDecoder.decodeVertexBuffer(vb, s.nv, 16, Buffer.from(s.vb, 'base64'));
const dv = new DataView(vb.buffer), q = k => i => dv.getInt16(i * 16 + k * 2, true) / 32767 * mod.half + mod.center[k];
let moved = 0;
for (let i = 0; i < s.nv; i++) {
  const x = q(0)(i), y = q(1)(i); if (Math.abs(x) >= W || y <= Y0) continue;
  const f = 1 - (1 - S) * (1 - (x / W) ** 2);           // S at the centre, 1 (no change) at |x| = W
  const y2 = Y0 + (y - Y0) * f;
  dv.setInt16(i * 16 + 2, Math.round((y2 - mod.center[1]) / mod.half * 32767), true); moved++;
}
const ev = Buffer.from(MeshoptEncoder.encodeVertexBuffer(vb, s.nv, 16)).toString('base64');
js = js.replace(`vb: '${s.vb}'`, () => `vb: '${ev}'`);
fs.writeFileSync(file, js);
console.log('crest: moved', moved, 'vertices');
