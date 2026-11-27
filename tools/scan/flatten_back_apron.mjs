// flatten_back_apron: the chaise's back rail under the seat as a plain band (like the product photo): carving on its
// outer face pressed onto the face's plane, scalloped/drop bottom edge straightened. Only that band moves
// (|x| < XMAX, back side), symmetric in x, so the rest of the scan and its left/right symmetry are untouched.
// Moved vertices get flat normals and a UV on a neutral texel of the scan normal map (no baked carving shading).
//   node flatten_back_apron.mjs <model.js> <slot> [XMAX=0.6] [YB=0.395] [YT=0.455] [ZF=-0.2945]
const M = process.env.HOME + '/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const { MeshoptDecoder, MeshoptEncoder } = await import(M + 'meshoptimizer/index.js');
import fs from 'fs';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const [file, slot, a1, a2, a3, a4] = process.argv.slice(2);
const XMAX = +(a1 ?? 0.6), YB = +(a2 ?? 0.395), YT = +(a3 ?? 0.455), ZF = +(a4 ?? -0.2945), BLEND = 0.05, UVN = 0.0041;
let js = fs.readFileSync(file, 'utf8');
const mod = (await import('file://' + fs.realpathSync(file) + '?' + Date.now())).default;
const s = mod.slots.find(q => q.slot === slot);
const vb = new Uint8Array(s.nv * 16); MeshoptDecoder.decodeVertexBuffer(vb, s.nv, 16, Buffer.from(s.vb, 'base64'));
const dv = new DataView(vb.buffer), H = mod.half, C = mod.center;
const gp = (i, k) => dv.getInt16(i * 16 + k * 2, true) / 32767 * H + C[k], sp = (i, k, v) => dv.setInt16(i * 16 + k * 2, Math.round((v - C[k]) / H * 32767), true);
const gn = (i, k) => dv.getInt8(i * 16 + 8 + k) / 127, sn = (i, k, v) => dv.setInt8(i * 16 + 8 + k, Math.round(v * 127));
const shs = []; for (let i = 0; i < s.nv; i += 7) shs.push(vb[i * 16 + 6]); shs.sort((a, b) => a - b); const SHM = shs[shs.length >> 1];
let moved = 0;
for (let i = 0; i < s.nv; i++) {
  const x = gp(i, 0), y = gp(i, 1), z = gp(i, 2), ax = Math.abs(x);
  if (ax >= XMAX + BLEND || z > -0.12 || y < 0.30 || y > YT) continue;
  const w = ax <= XMAX ? 1 : 1 - (ax - XMAX) / BLEND;   // fade out toward the back legs
  let ch = false, face = false, bot = false;
  if (z < -0.27) { sp(i, 2, z + (ZF - z) * w); ch = face = true; }                  // carving relief -> the band's plane
  if (y < YB) { sp(i, 1, y + (YB - y) * w); ch = bot = true; }                       // scallops / drop -> straight bottom
  if (ch && w > 0.5) {
    const nz = gn(i, 2), ny = gn(i, 1);
    const n = face && (!bot || -nz >= -ny) ? [0, 0, -1] : [0, -1, 0];
    for (let k = 0; k < 3; k++) sn(i, k, n[k]);
    vb[i * 16 + 6] = SHM;   // no baked carving shadow on the plain band
    dv.setUint16(i * 16 + 12, Math.round(UVN * 65535), true); dv.setUint16(i * 16 + 14, Math.round(UVN * 65535), true);
    moved++;
  }
}
const ev = Buffer.from(MeshoptEncoder.encodeVertexBuffer(vb, s.nv, 16)).toString('base64');
js = js.replace(`vb: '${s.vb}'`, () => `vb: '${ev}'`);
fs.writeFileSync(file, js);
console.log('back apron: flattened', moved, 'vertices');
