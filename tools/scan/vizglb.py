# write a minimal glb with POSITION, NORMAL, COLOR_0 (uint8 normalized) for label visualisation
import numpy as np, json, struct
def write(path,pos,nor,idx,rgb):
    bufs=[pos.astype(np.float32).tobytes(),nor.astype(np.float32).tobytes(),np.c_[rgb,np.full(len(rgb),255)].astype(np.uint8).tobytes(),idx.astype(np.uint32).tobytes()]
    off=[];o=0;bv=[]
    for i,b in enumerate(bufs): bv.append({"buffer":0,"byteOffset":o,"byteLength":len(b)}); o+=len(b); o+=(-o)%4; bufs[i]=b+b'\0'*((-len(b))%4)
    n=len(pos)
    acc=[{"bufferView":0,"componentType":5126,"count":n,"type":"VEC3","min":pos.min(0).tolist(),"max":pos.max(0).tolist()},
         {"bufferView":1,"componentType":5126,"count":n,"type":"VEC3"},
         {"bufferView":2,"componentType":5121,"normalized":True,"count":n,"type":"VEC4"},
         {"bufferView":3,"componentType":5125,"count":idx.size,"type":"SCALAR"}]
    j={"asset":{"version":"2.0"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],"meshes":[{"primitives":[{"attributes":{"POSITION":0,"NORMAL":1,"COLOR_0":2},"indices":3}]}],
       "accessors":acc,"bufferViews":bv,"buffers":[{"byteLength":o}]}
    js=json.dumps(j).encode(); js+=b' '*((-len(js))%4); bin_=b''.join(bufs)
    with open(path,'wb') as f:
        f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(bin_))); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js); f.write(struct.pack('<II',len(bin_),0x004E4942)); f.write(bin_)
