"use client";
import { useMemo, useState } from "react";
type MediaItem = {id:number;filename:string;mime_type:string;size_bytes:number};

type Field = {key:string;section:string;label:string;type:string;value:string};
export default function ContentEditor({fields}:{fields:Field[]}) {
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.key,f.value])));
  const [saved,setSaved]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState<string>("");
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [query,setQuery]=useState("");
  const [section,setSection]=useState("All sections");
  const [media,setMedia]=useState<MediaItem[]>([]);
  const [mediaField,setMediaField]=useState("");
  const [mediaLoading,setMediaLoading]=useState(false);
  const [mediaError,setMediaError]=useState("");
  const sections=useMemo(()=>["All sections",...Array.from(new Set(fields.map(f=>f.section)))],[fields]);
  const filtered=useMemo(()=>fields.filter(f=>(section==="All sections"||f.section===section)&&(!query||f.label.toLowerCase().includes(query.toLowerCase())||f.key.toLowerCase().includes(query.toLowerCase())||values[f.key].toLowerCase().includes(query.toLowerCase()))),[fields,section,query,values]);
  async function save(field:Field) {
    setBusy(field.key);setErrors(old=>({...old,[field.key]:""}));
    try {
      const res=await fetch("/api/admin/content",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:field.key,value:values[field.key]})});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Save failed");
      setSaved(old=>({...old,[field.key]:values[field.key]}));
    } catch(e) {setErrors(old=>({...old,[field.key]:e instanceof Error?e.message:"Save failed"}));}
    finally {setBusy("");}
  }
  async function openLibrary(key:string) {
    setMediaField(old=>old===key?"":key);setMediaError("");
    if(media.length)return;
    setMediaLoading(true);
    try {const r=await fetch("/api/admin/media");const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load media");setMedia(d.items||[]);}
    catch(e){setMediaError(e instanceof Error?e.message:"Could not load media");}
    finally{setMediaLoading(false);}
  }
  async function uploadImage(field:Field,file?:File) {
    if(!file)return;
    setErrors(old=>({...old,[field.key]:""}));
    if(file.size>3_000_000){setErrors(old=>({...old,[field.key]:"Choose an image under 3 MB."}));return;}
    setBusy(field.key);
    try {
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file);});
      const r=await fetch("/api/admin/media",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({filename:file.name,data})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Upload failed");
      setValues(old=>({...old,[field.key]:d.path}));setMedia(old=>[d.item,...old.filter(x=>x.id!==d.item.id)]);setMediaField("");
    } catch(e){setErrors(old=>({...old,[field.key]:e instanceof Error?e.message:"Upload failed"}));}
    finally{setBusy("");}
  }
  const dirty=fields.filter(f=>values[f.key]!==f.value && values[f.key]!==saved[f.key]).length;
  return <div className="editor">
    <style>{`.editor{color:#1b2940}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.toolbar input,.toolbar select{border:1px solid #dce4ef;border-radius:9px;padding:11px 13px;background:white;color:#34435a;font-size:13px}.toolbar input{flex:1;min-width:220px}.field-list{display:grid;gap:10px}.field{background:#fff;border:1px solid #e7edf5;border-radius:12px;padding:15px}.field-top{display:flex;justify-content:space-between;gap:12px;margin-bottom:9px}.field label{font-size:12px;font-weight:700;color:#33445e}.field code{font-size:10px;color:#9aa6b6;overflow-wrap:anywhere}.field textarea,.field input{width:100%;border:1px solid #dfe6ef;border-radius:8px;padding:10px 11px;font:13px/1.5 inherit;color:#34435a;background:#fcfdff}.field textarea{min-height:76px;resize:vertical}.field-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:9px}.field-actions small{margin-right:auto;color:#b45309;font-size:11px}.save{border:0;border-radius:8px;padding:8px 13px;background:#285db4;color:#fff;font-size:11px;font-weight:700;cursor:pointer}.save:disabled{opacity:.5;cursor:not-allowed}.saved{color:#16865b;font-size:11px}.count{font-size:12px;color:#8592a6}.image-action{border:0;border-radius:8px;padding:8px 12px;background:#edf3ff;color:#285db4;font-size:11px;font-weight:700;cursor:pointer}.image-preview{width:100%;max-width:220px;height:145px;object-fit:contain;background:#f4f6fa;border:1px solid #e7edf5;border-radius:9px;margin-top:10px}.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:9px;margin-top:10px}.media-choice{border:1px solid #dce4ef;background:#fff;border-radius:8px;padding:7px;text-align:left;cursor:pointer;min-width:0}.media-choice img{width:100%;height:76px;object-fit:contain;background:#f4f6fa}.media-choice span{display:block;font-size:10px;overflow-wrap:anywhere;margin-top:5px}.section-head{font-size:11px;color:#74839a;text-transform:uppercase;letter-spacing:1px;font-weight:800;margin:18px 0 9px}`}</style>
    <div className="toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by field name, key or value…"/><select value={section} onChange={e=>setSection(e.target.value)}>{sections.map(s=><option key={s}>{s}</option>)}</select></div>
    <div className="count">Showing {filtered.length} of {fields.length} content fields · {dirty} unsaved changes</div>
    <div className="field-list" style={{marginTop:14}}>{filtered.map(field=>{
      const value=values[field.key]??"";const isSaved=Object.prototype.hasOwnProperty.call(saved,field.key)?saved[field.key]===value:field.value===value;
      return <article className="field" key={field.key}><div className="field-top"><label htmlFor={field.key}>{field.label||field.key}</label><code>{field.key}</code></div>
        {field.type==="image"?<>
          <input id={field.key} type="text" value={value} onChange={e=>setValues(old=>({...old,[field.key]:e.target.value}))} placeholder="Image path or URL"/>
          {value&&<img className="image-preview" src={value.startsWith("http")?value:value.startsWith("/")?value:"/"+value} alt={field.label||"Selected image"}/>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
            <label className="image-action">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy===field.key} onChange={e=>{void uploadImage(field,e.target.files?.[0]);e.target.value="";}} style={{display:"none"}}/></label>
            <button type="button" className="image-action" disabled={mediaLoading||busy===field.key} onClick={()=>void openLibrary(field.key)}>Choose from Media Library</button>
          </div>
          {mediaField===field.key&&<div style={{marginTop:10,padding:10,border:"1px solid #e7edf5",borderRadius:9}}><strong style={{fontSize:12}}>Select an image</strong>{mediaLoading?<p className="count">Loading images…</p>:mediaError?<p role="alert">{mediaError}</p>:media.length?<div className="media-grid">{media.map(item=><button type="button" className="media-choice" key={item.id} onClick={()=>{setValues(old=>({...old,[field.key]:"api/media/"+item.id}));setMediaField("");}}><img src={"/api/media/"+item.id} alt={item.filename}/><span>{item.filename}</span></button>)}</div>:<p className="count">No images uploaded yet. Upload an image to add one.</p>}</div>}
        </>:field.type==="textarea"||value.length>130?<textarea id={field.key} value={value} onChange={e=>setValues(old=>({...old,[field.key]:e.target.value}))}/>:<input id={field.key} type="text" value={value} onChange={e=>setValues(old=>({...old,[field.key]:e.target.value}))}/>
        <div className="field-actions">{errors[field.key]&&<small>{errors[field.key]}</small>}{isSaved?<span className="saved">Saved</span>:<span className="count">Unsaved</span>}<button className="save" disabled={busy===field.key||isSaved} onClick={()=>save(field)}>{busy===field.key?"Saving…":"Save field"}</button></div>
      </article>;
    })}</div>
    {filtered.length===0&&<p className="count" style={{padding:30,textAlign:"center"}}>No matching fields found.</p>}
  </div>;
}
