# components: connected pieces of a stage1 mesh (bbox, colour) -> s1/<id>_vc.npy (seg.py uses it to drop scenery)
import numpy as np, sys, scipy.sparse as sp
from scipy.sparse.csgraph import connected_components
from load import load
name=sys.argv[1]; pos,nor,uv,idx,col=load('/tmp/scan-work/s1/'+name)
_,w=np.unique(pos,axis=0,return_inverse=True); w=w.ravel(); t=w[idx]; n=w.max()+1
A=sp.coo_matrix((np.ones(len(t)*3),(np.r_[t[:,0],t[:,1],t[:,2]],np.r_[t[:,1],t[:,2],t[:,0]])),shape=(n,n))
nc,cl=connected_components(A,directed=False); vc=cl[w]
print(name,'verts',len(pos),'components',nc)
u,cnt=np.unique(vc,return_counts=True); o=np.argsort(-cnt)
for c in o[:25]:
  m=vc==c; p=pos[m]; print(c,cnt[c],'min',p.min(0).round(3),'max',p.max(0).round(3),'col',np.median(col[m],0).astype(int))
np.save('/tmp/scan-work/s1/'+name+'_vc.npy',vc)
