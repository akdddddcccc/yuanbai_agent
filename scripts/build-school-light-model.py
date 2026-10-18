"""Offline model authoring only. Requires numpy and fast-simplification 0.2.0.
Windows deployment uses the reviewed compressed asset; no Python is needed."""
import json,struct,pathlib,numpy as np,fast_simplification as fs,zlib,sys
p=pathlib.Path(__file__).resolve().parents[1]/'public/models/yuanbai-precise-v2.glb';raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];d=json.loads(raw[20:20+n]);b=raw[28+n:];sizes={'VEC3':3,'VEC2':2,'SCALAR':1}
def read(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];return np.frombuffer(b,dtype=dt,count=a['count']*sizes[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1).copy()
o={k:v for k,v in d.items() if k not in ['buffers','bufferViews','accessors']};o['bufferViews']=[];o['accessors']=[];blob=bytearray();before=after=0

def write(a,typ,ct):
 while len(blob)%4:blob.append(0)
 view=len(o['bufferViews']);off=len(blob);blob.extend(a.tobytes());o['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':a.nbytes});ac={'bufferView':view,'componentType':ct,'count':len(a),'type':typ}
 if typ=='VEC3':ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 o['accessors'].append(ac);return len(o['accessors'])-1
for mesh in o['meshes']:
 for prim in mesh['primitives']:
  v=read(prim['attributes']['POSITION']);f=read(prim['indices']).reshape(-1,3);before+=len(f)
  if d['materials'][prim['material']]['name']!='MAT_METAL_WHITE':
   original_normal=read(prim['attributes']['NORMAL']);allv=np.concatenate([v,original_normal],axis=1).astype('<f4');allv,inv=np.unique(allv,axis=0,return_inverse=True);ix=inv[f].reshape(-1)
   prim['attributes']={'POSITION':write(allv[:,:3].copy(),'VEC3',5126),'NORMAL':write(allv[:,3:].copy(),'VEC3',5126)};prim['indices']=write(ix.astype('<u2' if len(allv)<65536 else '<u4'),'SCALAR',5123 if len(allv)<65536 else 5125);after+=len(f);continue
  v,inv=np.unique(np.round(v,5),axis=0,return_inverse=True);f=inv[f]

  original_v,original_f=v,f
  if len(f)>100: v,f=fs.simplify(v,f,target_count=max(60,int(len(f)*.06)),agg=5)
  if not len(f): v,f=original_v,original_f
  # Flat shaded triangles, welded by both position and normal: keep architectural hard edges.
  a=v[f];normal=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);length=np.linalg.norm(normal,axis=1);keep=length>1e-10; a=a[keep];normal=normal[keep]/length[keep,None];after+=len(a)
  allv=np.concatenate([a.reshape(-1,3),np.repeat(normal,3,axis=0)],axis=1).round(5).astype('<f4');allv,ix=np.unique(allv,axis=0,return_inverse=True)
  prim['attributes']={'POSITION':write(allv[:,:3].copy(),'VEC3',5126),'NORMAL':write(allv[:,3:].copy(),'VEC3',5126)};prim['indices']=write(ix.astype('<u2' if len(allv)<65536 else '<u4'),'SCALAR',5123 if len(allv)<65536 else 5125)
o['buffers']=[{'byteLength':len(blob)}];o['asset']['generator']='Yuanbai school conservative material-boundary simplification';j=json.dumps(o,separators=(',',':')).encode();j+=b' '*(-len(j)%4);blob+=b'\0'*(-len(blob)%4);result=struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/yuanbai-light.glb').write_bytes(result);print({'before':before,'after':after,'bytes':len(result),'gzip':len(zlib.compress(result,9))})
