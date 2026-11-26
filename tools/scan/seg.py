import numpy as np, sys, scipy.sparse as sp
from load import *
from vizglb import write
S='/tmp/scan-work/s1/'
PAL=np.array([[200,200,200],[220,40,40],[40,90,220],[40,180,60],[230,190,40],[160,60,200]])
def adj(pos,idx):
    _,w=np.unique(pos,axis=0,return_inverse=True); w=w.ravel(); t=w[idx]; n=w.max()+1
    r=np.r_[t[:,0],t[:,1],t[:,2],t[:,1],t[:,2],t[:,0]]; c=np.r_[t[:,1],t[:,2],t[:,0],t[:,0],t[:,1],t[:,2]]
    A=sp.csr_matrix((np.ones(len(r),np.float32),(r,c)),shape=(n,n)); A.data[:]=1; A=A+sp.identity(n,format='csr'); return A,w,n
def smooth(lab,A,w,n,k,it):
    # majority filter over welded vertices
    L=np.zeros(n,np.int64); L[w]=lab
    for _ in range(it):
        H=np.stack([A@(L==i).astype(np.float32) for i in range(k)],1); L=H.argmax(1)
    return L[w]
def diffuse(f,A,w,n,it):
    D=sp.diags(1/np.asarray(A.sum(1)).ravel()); An=D@A; F=np.zeros(n,np.float32)
    np.add.at(F,w,f); cnt=np.bincount(w,minlength=n); F/=np.maximum(cnt,1)
    for _ in range(it): F=An@F
    return F[w]
def hsv(col):
    c=col.astype(np.float32)/255; mx=c.max(1); mn=c.min(1); return mx, (mx-mn)/(mx+1e-6), c
def seg(name):
    pos,nor,uv,idx,col=load(S+name); v,s,c=hsv(col); y=pos[:,1]
    if name=='chaise':
        lab=((c[:,0]-np.maximum(c[:,1],c[:,2])>0.12)).astype(int); k=2   # 1 = red upholstery
    elif name=='console':
        lab=np.zeros(len(pos),int); k=1
    elif name=='chester':
        lab=np.zeros(len(pos),int); k=3; x,z=pos[:,0],pos[:,2]
        lab[(v>0.33)&(s<0.3)&(y<-0.03)&(np.abs(z)>0.40)]=1             # frame near arm ends (by colour)
        lab[(y<-0.066)&(nor[:,1]>-0.7)]=1                               # seat rail: clean horizontal cut
        lab[(v>0.36)&(s<0.3)&(np.abs(z)>0.43)]=1                       # arm-front scroll posts
        inbox=(y>0.0)&(x>-0.155)&(x<0.07)&(np.abs(z)>0.03)&(np.abs(z)<0.40)
        bl=(c[:,2]-c[:,0])/(v+1e-3)
        lab[y<-0.093]=1
        A,w,n=adj(pos,idx); f=diffuse((inbox&(bl<0.3)).astype(np.float32),A,w,n,12)
        lab[inbox&(f>0.4)]=2                                            # purple pillows
    elif name=='sectional':
        lab=np.zeros(len(pos),int); k=3
        lab[(v<0.25)&(y<-0.12)]=1                                      # dark wood legs
        x,z=pos[:,0],pos[:,2]; ls=np.load(S+name+'_ls.npy')
        inbox=(y>-0.005)&(x>-0.29)&(x<0.08)&(((z>0.27)&(z<0.47))|((z<-0.2)&(z>-0.48)))
        A,w,n=adj(pos,idx); f=diffuse((inbox&(ls>9)).astype(np.float32),A,w,n,int(sys.argv[3]))
        np.save(S+name+'_f.npy',f)
        seat=((y<0.03)&(nor[:,1]>0.6))|(np.abs(z)>0.438)|(x<-0.262)
        cand=inbox&(f>float(sys.argv[4]))&~seat
        backface=(nor[:,0]>0.8)&(np.abs(nor[:,1])<0.4)&(x<-0.21)          # upright front of the back cushions
        ok=inbox&~seat&~backface; P=(cand&ok).astype(np.float32)
        D=(diffuse(P,A,w,n,8)>0.12)&ok; E=diffuse(D.astype(np.float32),A,w,n,8)>0.8   # closing: fill holes in pillows
        lab[(E|(P>0))&ok]=2                                             # patterned throw pillows
    A,w,n=adj(pos,idx); lab=smooth(lab,A,w,n,k,int(sys.argv[2]) if len(sys.argv)>2 else 3)
    np.save(S+name+'_lab.npy',lab)
    for i in range(k): print(name,i,'%.3f'%(lab==i).mean(),'#%02x%02x%02x'%tuple(col[lab==i].mean(0).astype(int)) if (lab==i).any() else '')
    write(S+name+'_lab.glb',pos,nor,idx,PAL[lab])
seg(sys.argv[1])
