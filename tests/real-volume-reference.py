"""Independent, bounded-memory numerical reference. Does not modify inputs."""
import sys,json,hashlib
from pathlib import Path
import numpy as np

results=[]
for filename in sys.argv[1:]:
    path=Path(filename)
    with path.open('r',encoding='utf-8') as stream:
        title=stream.readline().strip(); scale=float(stream.readline()); matrix=np.array([[float(v) for v in stream.readline().split()[:3]] for _ in range(3)])*scale
        symbols=stream.readline().split(); counts=[int(v) for v in stream.readline().split()]; mode=stream.readline().strip()
        if mode.lower().startswith('s'): mode=stream.readline().strip()
        atoms=np.array([[float(v) for v in stream.readline().split()[:3]] for _ in range(sum(counts))])
        channels=[]; dimensions=None
        while True:
            line=stream.readline()
            if not line: break
            if not line.strip(): continue
            if line.lower().startswith('augmentation occupancies'):
                remaining=int(line.split()[-1])
                while remaining>0: remaining-=len(stream.readline().split())
                continue
            dims=tuple(int(v) for v in line.split()); assert len(dims)==3
            dimensions=dims; count=int(np.prod(dims)); consumed=0; total=0.; minimum=float('inf'); maximum=-float('inf'); samples={}
            indices={0,count-1,dims[0]//2+(dims[1]//2)*dims[0]+(dims[2]//2)*dims[0]*dims[1]}
            for atom in atoms[[i for i in (0,70,71,73) if i<len(atoms)]]:
                i,j,k=np.rint(atom*np.array(dims)).astype(int)%np.array(dims); indices.add(int(i+j*dims[0]+k*dims[0]*dims[1]))
            while consumed<count:
                lines=[]; expected=0
                for _ in range(4096):
                    row=stream.readline()
                    if not row: raise ValueError('truncated data')
                    lines.append(row); expected+=len(row.split())
                    if consumed+expected>=count: break
                values=np.fromstring(' '.join(lines).replace('D','E').replace('d','e'),sep=' ')
                assert values.size==expected and consumed+values.size<=count and np.isfinite(values).all()
                minimum=min(minimum,float(values.min()));maximum=max(maximum,float(values.max()));total+=float(values.sum(dtype=np.float64))
                for i in indices:
                    if consumed<=i<consumed+len(values):samples[str(i)]=float(values[i-consumed])
                consumed+=len(values)
            channels.append({'count':count,'rawMin':minimum,'rawMax':maximum,'rawMean':total/count,'samples':samples})
    digest=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):digest.update(block)
    results.append({'name':path.name,'bytes':path.stat().st_size,'sha256':digest.hexdigest(),'atoms':int(sum(counts)),'volume':abs(float(np.linalg.det(matrix))),'dimensions':dimensions,'channels':channels})
    print(json.dumps(results[-1],ensure_ascii=True),flush=True)
output=Path('docs/qa/real-volume');output.mkdir(parents=True,exist_ok=True)
(output/'reference.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
