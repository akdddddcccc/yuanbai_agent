"""Lossless geometry consolidation for the supplied, untransformed GLB. Requires numpy."""
import collections, hashlib, json, pathlib, re, struct, sys
import numpy as np

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
raw = source.read_bytes()
magic, version, length = struct.unpack_from('<4sII', raw)
assert magic == b'glTF' and version == 2 and length == len(raw)
json_length, kind = struct.unpack_from('<II', raw, 12)
assert kind == 0x4e4f534a
doc = json.loads(raw[20:20+json_length])
bin_length, kind = struct.unpack_from('<II', raw, 20+json_length)
assert kind == 0x004e4942
binary = raw[28+json_length:28+json_length+bin_length]
assert not doc.get('images') and not doc.get('animations') and not doc.get('skins')
types = {5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}
widths = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def read(i):
    a=doc['accessors'][i]; v=doc['bufferViews'][a['bufferView']]
    assert not a.get('sparse') and not a.get('normalized')
    dtype=np.dtype(types[a['componentType']]); width=widths[a['type']]
    return np.ndarray((a['count'],width),dtype=dtype,buffer=binary,
        offset=v.get('byteOffset',0)+a.get('byteOffset',0),
        strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize)).copy()

buckets=collections.defaultdict(list); names=collections.defaultdict(list)
removed=[]
for node in doc['nodes']:
    assert not any(k in node for k in ['matrix','translation','rotation','scale','children'])
    name=node.get('name','')
    if name == 'YB_V004_CLOSED_THICK_GROUND':
        removed.append(name)
        continue
    match=re.match(r'YB_(A\d{2})_',name)
    connector=re.match(r'(YB_ROUTE_.+?)_(?:STRINGER|TREAD|RAIL|POST)',name) or re.match(r'(YB_EXT_STAIR_A\d{2})_',name) or re.match(r'(YB_ATRIUM_(?:LEFT|RIGHT))_',name)
    group=match[1] if match else ('connector_'+connector[1] if connector else 'stable')
    names[group].append(name)
    for p in doc['meshes'][node['mesh']]['primitives']:
        assert p.get('mode',4)==4
        attrs={k:read(v) for k,v in p['attributes'].items()}
        attrs.setdefault('TEXCOORD_0',np.zeros((len(attrs['POSITION']),2),dtype='<f4'))
        idx=read(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(attrs['POSITION']))
        buckets[group,p.get('material',0)].append((attrs,idx))

out={'asset':{'version':'2.0','generator':'Yuanbai lossless material/group consolidation'},
     'materials':doc['materials'],'extensionsUsed':doc.get('extensionsUsed',[]),
     'nodes':[],'meshes':[],'accessors':[],'bufferViews':[],'scenes':[{'nodes':[]}],'scene':0}
blob=bytearray()
def write(a,typ,component):
    while len(blob)%4: blob.append(0)
    view=len(out['bufferViews']); offset=len(blob); data=a.tobytes();blob.extend(data)
    out['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
    ac={'bufferView':view,'componentType':component,'count':len(a),'type':typ}
    if typ=='VEC3': ac.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
    out['accessors'].append(ac);return len(out['accessors'])-1
triangles=0
for group in names:
    children=[]
    for (g,material),parts in buckets.items():
        if g!=group: continue
        positions=[];normals=[];uvs=[];indices=[];offset=0
        for attrs,idx in parts:
            positions.append(attrs['POSITION']);normals.append(attrs['NORMAL']);uvs.append(attrs['TEXCOORD_0'])
            indices.append(idx.astype('<u4')+offset);offset+=len(attrs['POSITION'])
        p=np.concatenate(positions);n=np.concatenate(normals);uv=np.concatenate(uvs);ix=np.concatenate(indices)
        triangles+=len(ix)//3
        primitive={'attributes':{'POSITION':write(p,'VEC3',5126),'NORMAL':write(n,'VEC3',5126),
                   'TEXCOORD_0':write(uv,'VEC2',5126)},'indices':write(ix,'SCALAR',5125),'material':material}
        children.append(len(out['nodes']))
        out['nodes'].append({'name':f'{group}_{doc["materials"][material]["name"]}','mesh':len(out['meshes'])})
        out['meshes'].append({'primitives':[primitive]})
    out['scenes'][0]['nodes'].append(len(out['nodes']))
    out['nodes'].append({'name':'YB_stable_stairs_and_bridges' if group=='stable' else (f'YB_{group}' if group.startswith('connector_') else f'YB_mass_{group}'),
                         'children':children})
out['buffers']=[{'byteLength':len(blob)}]
j=json.dumps(out,separators=(',',':')).encode();j+=b' '*((-len(j))%4);blob+=b'\0'*((-len(blob))%4)
result=struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(result)
report={'sourceSHA256':hashlib.sha256(raw).hexdigest(),'sourceBytes':len(raw),'optimizedBytes':len(result),
        'sourceNodes':len(doc['nodes']),'sourcePrimitives':sum(len(m['primitives']) for m in doc['meshes']),
        'optimizedPrimitives':len(out['meshes']),'triangles':triangles,'materials':len(doc['materials']),
        'textures':0,'removedNodes':removed,'groups':{k:len(v) for k,v in names.items()},'sourceNodeNames':names}
target.with_suffix('.report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='sourceNodeNames'},ensure_ascii=False))

# Small versioned chunks retain compatibility with the existing static deployment.
chunkdir=target.parent/'yuanbai-precise-v3'
chunkdir.mkdir(exist_ok=True)
chunks=[]
for i,start in enumerate(range(0,len(result),688128)):
    data=result[start:start+688128];name=f'part-{i:02}.bin';(chunkdir/name).write_bytes(data);chunks.append({'name':name,'bytes':len(data)})
(chunkdir/'manifest.json').write_text(json.dumps({'bytes':len(result),'parts':chunks}),encoding='utf-8')
