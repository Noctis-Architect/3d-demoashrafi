# s2keep: copy a stage2 file keeping only some slots (e.g. drop scanned legs that the page rebuilds in code)
# usage: python3 s2keep.py <in-prefix> <out-prefix> slot [slot ...]
import sys, json, numpy as np
src, dst, keep = sys.argv[1], sys.argv[2], sys.argv[3:]
m = json.load(open(src + '.json')); b = open(src + '.bin', 'rb').read(); o = 0; out = []; metas = []
for s in m['slots']:
    n = s['nv'] * 12 + s['nv'] * 12 + s['nv'] * 8 + s['nv'] + s['ni'] * 4
    if s['slot'] in keep: out.append(b[o:o + n]); metas.append(s)
    o += n
open(dst + '.bin', 'wb').write(b''.join(out)); json.dump(dict(m, slots=metas), open(dst + '.json', 'w'))
print('kept', [s['slot'] for s in metas])
