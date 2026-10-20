import type { CrystalStructure } from './types/crystal';
import type { ProjectState } from './project';
import type { ImportProgress } from './parsers/vaspVolumeStream';
type Result={kind:'project';state:ProjectState}|{kind:'structure';structure:CrystalStructure};
let active:{worker:Worker;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|null=null;
export function cancelImport(){if(!active)return;const current=active;active=null;clearTimeout(current.timer);current.worker.terminate();current.reject(new Error('解析已取消。'));}
function run(message:{file:File}|{text:string;filename:string},progress?:((p:ImportProgress)=>void)):Promise<Result>{
  cancelImport();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./workers/import.worker.ts',import.meta.url),{type:'module'});
    const finish=()=>{if(active?.worker===worker){clearTimeout(active.timer);active=null;}worker.terminate();};
    const timer=setTimeout(()=>{finish();reject(new Error('解析超时，请缩小文件或降低网格后重试。'));},'file'in message?300000:30000);
    active={worker,reject,timer};
    worker.onmessage=event=>{if(active?.worker!==worker)return;if(event.data.type==='progress'){progress?.(event.data.progress);return;}finish();if(event.data.ok)resolve(event.data.result);else reject(new Error(event.data.message));};
    worker.onerror=()=>{if(active?.worker!==worker)return;finish();reject(new Error('无法启动文件解析，请刷新页面后重试。'));};
    worker.postMessage(message);
  });
}
export const parseImportedFile=(text:string,filename:string)=>run({text,filename});
export const parseImportedBlob=(file:File,progress?:(p:ImportProgress)=>void)=>run({file},progress);
