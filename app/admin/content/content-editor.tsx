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
    <style>{`.editor{--ce-ink:#17233b;--ce-muted:#73819a;--ce-line:#e3e9f2;--ce-accent:#2563eb;color:var(--ce-ink);font-family:Inter,"DM Sans",ui-sans-serif,system-ui,sans-serif}
.editor .toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 230px;gap:12px;margin:22px 0 14px;padding:14px;background:#fff;border:1px solid #e4eaf3;border-radius:16px;box-shadow:0 5px 20px rgba(23,42,80,.035)}
.editor .toolbar input,.editor .toolbar select{width:100%;min-width:0;box-sizing:border-box;border:1px solid #dce4f0;border-radius:10px;padding:13px 14px;background:#f9fbff;color:#243654;font-size:13px;outline:none}
.editor .toolbar input:focus,.editor .toolbar select:focus{border-color:#6da2ff;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.editor .count{font-size:12px;color:#7d8aa1;line-height:1.5}
.editor .field-list{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px!important;margin-top:14px!important;align-items:start}
.editor .field{min-width:0;background:#fff!important;border:1px solid #e2e9f3!important;border-radius:14px!important;padding:17px!important;box-shadow:0 4px 16px rgba(28,48,85,.035)!important;transition:border-color .18s,box-shadow .18s}
.editor .field:hover{border-color:#cbdaf0!important;box-shadow:0 8px 22px rgba(28,48,85,.06)!important}
.editor .field-top{align-items:flex-start;gap:14px;margin-bottom:11px}
.editor .field label{min-width:0;font-size:12px!important;font-weight:750!important;line-height:1.45;color:#263957!important;overflow-wrap:anywhere}
.editor .field code{max-width:45%;font-size:10px;color:#91a0b5;line-height:1.45;text-align:right;overflow-wrap:anywhere}
.editor .field textarea,.editor .field input[type=text]{width:100%;box-sizing:border-box;border:1px solid #dce5f1!important;border-radius:10px!important;padding:12px 13px!important;font:13px/1.6 Inter,"DM Sans",sans-serif!important;color:#273a59!important;background:#f9fbff!important;transition:border-color .15s,box-shadow .15s}
.editor .field textarea{min-height:88px;resize:vertical}
.editor .field textarea:focus,.editor .field input[type=text]:focus{border-color:#70a4ff!important;box-shadow:0 0 0 3px rgba(37,99,235,.09)!important;outline:none}
.editor .field-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px;padding-top:11px;border-top:1px solid #f0f3f8}
.editor .field-actions small{margin-right:auto;color:#c24141;font-size:11px}
.editor .save{border:1px solid #2563eb!important;border-radius:9px!important;padding:9px 14px!important;background:#2563eb!important;color:#fff!important;font-size:11px!important;font-weight:750!important;cursor:pointer}
.editor .save:disabled{opacity:.42;cursor:not-allowed}
.editor .saved{display:inline-flex;align-items:center;gap:5px;color:#16835d;font-size:11px;font-weight:700}
.editor .saved:before{content:"";width:6px;height:6px;border-radius:50%;background:#20b486}
.editor .image-action{display:inline-flex;align-items:center;border:1px solid #d9e5f8!important;border-radius:9px!important;padding:9px 12px!important;background:#f2f7ff!important;color:#2865c7!important;font-size:11px!important;font-weight:750!important;cursor:pointer}
.editor .image-preview{width:100%;max-width:240px;height:145px;object-fit:contain;background:#f6f8fc;border:1px solid #e6ecf5;border-radius:10px;margin-top:11px}
.editor .media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:9px;margin-top:10px}
.editor .media-choice{border:1px solid #dce5f1;background:#fff;border-radius:9px;padding:7px;text-align:left;cursor:pointer;min-width:0}
.editor .media-choice img{width:100%;height:76px;object-fit:contain;background:#f4f6fa}
.editor .media-choice span{display:block;font-size:10px;overflow-wrap:anywhere;margin-top:5px}
.editor .section-head{font-size:11px;color:#71809a;text-transform:uppercase;letter-spacing:1px;font-weight:800;margin:18px 0 9px}
@media(max-width:1100px){.editor .field-list{grid-template-columns:1fr!important}.editor .toolbar{grid-template-columns:1fr 210px}}
@media(max-width:680px){.editor .toolbar{grid-template-columns:1fr;padding:10px}.editor .field{padding:13px!important}.editor .field-top{display:block}.editor .field code{display:block;max-width:100%;text-align:left;margin-top:4px}.editor .field-actions{flex-wrap:wrap}}
`}</style>
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
        </>:field.type==="textarea"||value.length>130?<textarea id={field.key} value={value} onChange={e=>setValues(old=>({...old,[field.key]:e.target.value}))}/>:<input id={field.key} type="text" value={value} onChange={e=>setValues(old=>({...old,[field.key]:e.target.value}))}/>}
        <div className="field-actions">{errors[field.key]&&<small>{errors[field.key]}</small>}{isSaved?<span className="saved">Saved</span>:<span className="count">Unsaved</span>}<button className="save" disabled={busy===field.key||isSaved} onClick={()=>save(field)}>{busy===field.key?"Saving…":"Save field"}</button></div>
      </article>;
    })}</div>
    {filtered.length===0&&<p className="count" style={{padding:30,textAlign:"center"}}>No matching fields found.</p>}
  </div>;
}
