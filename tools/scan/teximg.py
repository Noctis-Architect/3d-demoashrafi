import json,struct,io,numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
def glbimage(path,i=0):
    f=open(path,'rb').read(); l=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+l]); bo=20+l+8
    im=j['images'][i]; bv=j['bufferViews'][im['bufferView']]; s=bo+bv.get('byteOffset',0)
    return Image.open(io.BytesIO(f[s:s+bv['byteLength']]))
def localstd(img,uv,r=6):
    a=np.asarray(img.convert('L'),np.float32); H,W=a.shape
    # integral images for box std
    I=np.pad(a,((1,0),(1,0))).cumsum(0).cumsum(1); I2=np.pad(a*a,((1,0),(1,0))).cumsum(0).cumsum(1)
    x=np.clip((uv[:,0]*W).astype(int),r,W-r-1); y=np.clip((uv[:,1]*H).astype(int),r,H-r-1)
    def box(I): return I[y+r+1,x+r+1]-I[y-r,x+r+1]-I[y+r+1,x-r]+I[y-r,x-r]
    n=(2*r+1)**2; m=box(I)/n; return np.sqrt(np.maximum(box(I2)/n-m*m,0))
