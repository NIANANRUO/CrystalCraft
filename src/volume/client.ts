import type { VolumeData, VolumeSettings } from '../types/crystal';
import type { buildVolumeGeometry } from './geometry';
export function createVolumeTask(data:VolumeData,settings:VolumeSettings){
  let cancel=()=>{};
  const promise=new Promise<ReturnType<typeof buildVolumeGeometry>>((resolve,reject)=>{
    const worker=new Worker(new URL('../workers/volume.worker.ts',import.meta.url),{type:'module'});
    const finish=()=>{clearTimeout(timer);worker.terminate();};
    const timer=setTimeout(()=>{finish();reject(new Error('体数据生成超时，请提高采样步长。'));},30000);
    cancel=()=>{finish();reject(new Error('体数据生成已取消。'));};
    worker.onmessage=event=>{finish();if(event.data.ok)resolve(event.data.result);else reject(new Error(event.data.message));};
    worker.onerror=()=>{finish();reject(new Error('体数据 Worker 启动失败，请刷新页面。'));};
    worker.postMessage({data,settings});
  });
  return {promise,cancel:()=>cancel()};
}
