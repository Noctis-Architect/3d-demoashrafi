// stage1: raw GLB -> simplified mesh (positions+uv aware), recomputed smooth normals, per-vertex sampled base color.
// usage: node stage1.mjs <raw.glb> <out-prefix> <error>
const M = process.env.HOME + '/.npm-global/lib/node_modules/@gltf-transform/cli/node_modules/';
const { NodeIO, Document } = await import(M + '@gltf-transform/core/dist/index.js');
const { MeshoptSimplifier } = await import(M + 'meshoptimizer/index.js');
const sharp = (await import(M + 'sharp/dist/index.mjs')).default;
import fs from 'fs';

const [src, out, errS, nwS] = process.argv.slice(2);
const NW = +(nwS ?? 0.5);
const ERR = +errS;
await MeshoptSimplifier.ready;
const io = new NodeIO();
const doc = await io.read(src);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute('POSITION').getArray(), UV = prim.getAttribute('TEXCOORD_0').getArray();
let I = prim.getIndices().getArray(); I = I instanceof Uint32Array ? I : Uint32Array.from(I);
const nv0 = P.length / 3;
console.log('in verts', nv0, 'tris', I.length / 3);

// simplify: positions + uv (uv weight keeps normal-map alignment), seams handled by meshopt
const N0 = prim.getAttribute('NORMAL').getArray();
const attrs = new Float32Array(nv0 * 5); for (let i = 0; i < nv0; i++) { attrs[i * 5] = UV[i * 2]; attrs[i * 5 + 1] = UV[i * 2 + 1]; attrs[i * 5 + 2] = N0[i * 3]; attrs[i * 5 + 3] = N0[i * 3 + 1]; attrs[i * 5 + 4] = N0[i * 3 + 2]; }
const [I2, err] = MeshoptSimplifier.simplifyWithAttributes(I, P, 3, attrs, 5, [0.5, 0.5, NW, NW, NW], null, 0, ERR, []);
const [remap, nv] = MeshoptSimplifier.compactMesh(I2); // I2 rewritten in place to compact indices; remap old->new
const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
for (let o = 0; o < nv0; o++) { const n = remap[o]; if (n === 0xffffffff) continue; pos.set(P.subarray(o * 3, o * 3 + 3), n * 3); uv.set(UV.subarray(o * 2, o * 2 + 2), n * 2); }
const idx = I2;
console.log('out verts', nv, 'tris', idx.length / 3, 'err', err);

// smooth normals, area weighted, shared across seam duplicates (same position)
const pr = MeshoptSimplifier.generatePositionRemap(pos, 3);
const acc = new Float32Array(nv * 3);
for (let t = 0; t < idx.length; t += 3) {
  const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  for (const k of [idx[t], idx[t + 1], idx[t + 2]]) { const r = pr[k] * 3; acc[r] += nx; acc[r + 1] += ny; acc[r + 2] += nz; }
}
const nor = new Float32Array(nv * 3);
for (let o = 0; o < nv0; o++) { const n = remap[o]; if (n === 0xffffffff) continue; nor.set(N0.subarray(o * 3, o * 3 + 3), n * 3); }
if (process.env.RECALC) for (let i = 0; i < nv; i++) { const r = pr[i] * 3; const l = Math.hypot(acc[r], acc[r + 1], acc[r + 2]) || 1; nor[i * 3] = acc[r] / l; nor[i * 3 + 1] = acc[r + 1] / l; nor[i * 3 + 2] = acc[r + 2] / l; }

// sample base color per vertex (bilinear)
const mat = prim.getMaterial();
const img = mat.getBaseColorTexture().getImage();
const { data, info } = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const col = new Uint8Array(nv * 3);
for (let i = 0; i < nv; i++) {
  let x = uv[i * 2] * W - 0.5, y = uv[i * 2 + 1] * H - 0.5;
  x = Math.min(W - 1.001, Math.max(0, x)); y = Math.min(H - 1.001, Math.max(0, y));
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const g = (xx, yy) => data[(yy * W + xx) * 3 + c];
    col[i * 3 + c] = Math.round(g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy);
  }
}
fs.writeFileSync(out + '.bin', Buffer.concat([pos, nor, uv, idx].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength)).concat([Buffer.from(col)])));
fs.writeFileSync(out + '.json', JSON.stringify({ nv, ni: idx.length }));
// normal map passthrough
fs.writeFileSync(out + '_normal.png', Buffer.from(mat.getNormalTexture().getImage()));

// test glb: simplified geometry with original material, for render comparison
const d2 = new Document(); const b = d2.createBuffer();
const mk = (a, t) => d2.createAccessor().setArray(a).setType(t).setBuffer(b);
const m2 = d2.createMaterial('m').setBaseColorTexture(d2.createTexture().setImage(img).setMimeType('image/jpeg'));
const p2 = d2.createPrimitive().setAttribute('POSITION', mk(pos, 'VEC3')).setAttribute('NORMAL', mk(nor, 'VEC3')).setAttribute('TEXCOORD_0', mk(uv, 'VEC2')).setIndices(mk(idx, 'SCALAR')).setMaterial(m2);
d2.createScene().addChild(d2.createNode().setMesh(d2.createMesh().addPrimitive(p2)));
await io.write(out + '_test.glb', d2);
console.log('done');
