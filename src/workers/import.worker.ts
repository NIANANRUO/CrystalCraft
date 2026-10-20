import { importStructure } from '../importStructure';
import { parseProject } from '../project';
import {volumeKind} from '../volume/data';
import {parseVaspVolumeFile} from '../parsers/vaspVolumeStream';
self.onmessage = async (event: MessageEvent<{ text?: string; filename?: string;file?:File }>) => {
  try {
    const file=event.data.file,filename=file?.name??event.data.filename!;
    let result;
    if(file&&volumeKind(filename))result={kind:'structure',structure:await parseVaspVolumeFile(file,progress=>self.postMessage({type:'progress',progress}))};
    else {const text=file?await file.text():event.data.text!;result=filename.toLowerCase().endsWith('.crystalcraft.json')?{kind:'project',state:parseProject(text)}:{kind:'structure',structure:importStructure(text,filename)};}
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, message: error instanceof Error ? error.message : String(error) }); }
};
