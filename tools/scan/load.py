import numpy as np, json
def load(pref):
    m=json.load(open(pref+'.json')); nv,ni=m['nv'],m['ni']; b=open(pref+'.bin','rb').read(); o=0
    def take(dt,n):
        nonlocal o; a=np.frombuffer(b,dt,n,o); o+=a.nbytes; return a
    pos=take(np.float32,nv*3).reshape(-1,3); nor=take(np.float32,nv*3).reshape(-1,3); uv=take(np.float32,nv*2).reshape(-1,2)
    idx=take(np.uint32,ni).reshape(-1,3); col=take(np.uint8,nv*3).reshape(-1,3)
    return pos,nor,uv,idx,col
def kmeans(X,k,it=30,seed=0):
    r=np.random.default_rng(seed); C=X[r.choice(len(X),k,replace=False)]
    for _ in range(it):
        d=((X[:,None,:]-C[None])**2).sum(-1); l=d.argmin(1)
        C=np.array([X[l==i].mean(0) if (l==i).any() else C[i] for i in range(k)])
    return C,l
def shells(pos,idx):
    # weld by exact position then union-find over triangles
    _,inv=np.unique(pos,axis=0,return_inverse=True); inv=inv.ravel()
    t=inv[idx]; n=inv.max()+1; par=np.arange(n)
    def find(a):
        r=a
        while par[r]!=r: r=par[r]
        while par[a]!=r: par[a],a=r,par[a]
        return r
    for a,b,c in t:
        ra,rb,rc=find(a),find(b),find(c)
        if ra!=rb: par[rb]=ra
        rc=find(c); ra=find(a)
        if ra!=rc: par[rc]=ra
    root=np.array([find(i) for i in range(n)])
    _,lab=np.unique(root[t[:,0]],return_inverse=True)
    return lab.ravel()  # shell id per triangle
