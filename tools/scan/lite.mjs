// Re-simplify an encoded assets/models/<id>.js: decode slots, simplify (pos+uv+normal aware), re-encode. Other fields kept.
// usage: node lite.mjs <in.js> <out.js> <slot>=<targetRatio> ...
const M = process.env.HOME + '/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await import(M + 'meshoptimizer/index.js');
import fs from 'fs';
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const [src, out, ...ratios] = process.argv.slice(2);
const R = Object.fromEntries(ratios.map(r => { const [k, v] = r.split('='); return [k, +v]; }));
let js = fs.readFileSync(src, 'utf8');
const mod = await import('file://' + fs.realpathSync(src));
const Md = mod.default;
const S = 16;
for (const s of Md.slots) {
  const r = R[s.slot]; if (!r) continue;
  const vb = new Uint8Array(s.nv * S); MeshoptDecoder.decodeVertexBuffer(vb, s.nv, S, Buffer.from(s.vb, 'base64'));
  const ib = new Uint32Array(s.ni); MeshoptDecoder.decodeIndexBuffer(new Uint8Array(ib.buffer), s.ni, 4, Buffer.from(s.ib, 'base64'));
  const dv = new DataView(vb.buffer);
  const pos = new Float32Array(s.nv * 3), attr = new Float32Array(s.nv * 5);
  for (let i = 0; i < s.nv; i++) { const b = i * S;
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = dv.getInt16(b + k * 2, true) / 32767;
    attr[i * 5] = dv.getUint16(b + 12, true) / 65535; attr[i * 5 + 1] = dv.getUint16(b + 14, true) / 65535;
    for (let k = 0; k < 3; k++) attr[i * 5 + 2 + k] = dv.getInt8(b + 8 + k) / 127; }
  const target = Math.floor(s.ni * r / 3) * 3;
  const [I2, err] = MeshoptSimplifier.simplifyWithAttributes(ib, pos, 3, attr, 5, [1, 1, 0.3, 0.3, 0.3], null, target, 0.01, ['LockBorder']);
  const [remap, nv] = MeshoptEncoder.reorderMesh(I2, true, false);
  const nb = new Uint8Array(nv * S);
  for (let i = 0; i < s.nv; i++) { const j = remap[i]; if (j === 0xffffffff) continue; nb.set(vb.subarray(i * S, i * S + S), j * S); }
  const ev = Buffer.from(MeshoptEncoder.encodeVertexBuffer(nb, nv, S)).toString('base64');
  const ei = Buffer.from(MeshoptEncoder.encodeIndexBuffer(new Uint8Array(I2.buffer, I2.byteOffset, I2.byteLength), I2.length, 4)).toString('base64');
  // error in metres (positions are normalised by half)
  console.log(s.slot, 'tris', s.ni / 3, '->', I2.length / 3, 'verts', s.nv, '->', nv, 'err mm', (err * Md.dims[0] * 1000).toFixed(2));
  js = js.replace(`nv: ${s.nv}, ni: ${s.ni},`, `nv: ${nv}, ni: ${I2.length},`).replace(`vb: '${s.vb}'`, () => `vb: '${ev}'`).replace(`ib: '${s.ib}'`, () => `ib: '${ei}'`);
}
fs.writeFileSync(out, js);
console.log('size MB', (js.length / 1048576).toFixed(2));
