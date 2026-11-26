// encode: stage2 slot meshes -> assets/models/<id>.js (meshopt-compressed geometry embedded as base64)
// usage: node encode.mjs <s2-prefix> <out.js> <id> <normalMapUrl>
const M = process.env.HOME + '/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const { MeshoptEncoder } = await import(M + 'meshoptimizer/index.js');
import fs from 'fs';
await MeshoptEncoder.ready;
const [pref, out, id, nmap] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(pref + '.json'));
const bin = fs.readFileSync(pref + '.bin');
let o = 0;
const take = (T, n) => { const a = new T(bin.buffer.slice(bin.byteOffset + o, bin.byteOffset + o + n * T.BYTES_PER_ELEMENT)); o += n * T.BYTES_PER_ELEMENT; return a; };
const slots = meta.slots.map(s => ({ ...s, pos: take(Float32Array, s.nv * 3), nor: take(Float32Array, s.nv * 3), uv: take(Float32Array, s.nv * 2), shade: take(Uint8Array, s.nv), idx: take(Uint32Array, s.ni) }));

// one uniform quantisation box for the whole model (keeps normals valid, no non-uniform scale)
const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const s of slots) for (let i = 0; i < s.nv; i++) for (let k = 0; k < 3; k++) { const v = s.pos[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
const ctr = mn.map((v, k) => (v + mx[k]) / 2), half = Math.max(...mx.map((v, k) => (v - mn[k]) / 2));

const STRIDE = 16, res = [];
let total = 0;
for (const s of slots) {
  // vertex-cache + fetch friendly order (also makes the encoder far more effective)
  const idx = Uint32Array.from(s.idx);
  const [remap, nv] = MeshoptEncoder.reorderMesh(idx, true, false);
  const vb = new Uint8Array(nv * STRIDE), dv = new DataView(vb.buffer);
  for (let i = 0; i < s.nv; i++) {
    const j = remap[i]; if (j === 0xffffffff) continue; const b = j * STRIDE;
    for (let k = 0; k < 3; k++) dv.setInt16(b + k * 2, Math.round((s.pos[i * 3 + k] - ctr[k]) / half * 32767), true);
    dv.setUint8(b + 6, s.shade[i]);
    const nx = s.nor[i * 3], ny = s.nor[i * 3 + 1], nz = s.nor[i * 3 + 2], l = Math.hypot(nx, ny, nz) || 1;
    dv.setInt8(b + 8, Math.round(nx / l * 127)); dv.setInt8(b + 9, Math.round(ny / l * 127)); dv.setInt8(b + 10, Math.round(nz / l * 127));
    dv.setUint16(b + 12, Math.round(Math.min(1, Math.max(0, s.uv[i * 2])) * 65535), true);
    dv.setUint16(b + 14, Math.round(Math.min(1, Math.max(0, s.uv[i * 2 + 1])) * 65535), true);
  }
  const ev = MeshoptEncoder.encodeVertexBuffer(vb, nv, STRIDE);
  const ei = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(idx.buffer), idx.length, 4);
  total += ev.length + ei.length;
  res.push({ slot: s.slot, color: s.color, nv, ni: idx.length, vb: Buffer.from(ev).toString('base64'), ib: Buffer.from(ei).toString('base64') });
  console.log(s.slot, 'verts', nv, 'tris', idx.length / 3, 'vb', (ev.length / 1048576).toFixed(2) + 'MB', 'ib', (ei.length / 1048576).toFixed(2) + 'MB');
}
const js = `/* ${id}: هندسه دقیق مدل سه‌بعدی (همان فرم و کنده‌کاری فایل اصلی)، فشرده با meshopt.
   این فایل خودکار ساخته شده؛ دستی ویرایش نشود. ساخت مدل در assets/scan.js است. */
export default {
  id: ${JSON.stringify(id)},
  dims: ${JSON.stringify(meta.dims)},          // عرض، ارتفاع، عمق (متر)
  center: ${JSON.stringify(ctr.map(v => +v.toFixed(6)))}, half: ${+half.toFixed(6)},
  normalMap: ${JSON.stringify(nmap)},
  slots: [
${res.map(r => `    { slot: ${JSON.stringify(r.slot)}, color: ${JSON.stringify(r.color)}, nv: ${r.nv}, ni: ${r.ni},\n      vb: '${r.vb}',\n      ib: '${r.ib}' }`).join(',\n')}
  ]
};
`;
fs.writeFileSync(out, js);
console.log('total', (total / 1048576).toFixed(2), 'MB ->', (js.length / 1048576).toFixed(2), 'MB js');
