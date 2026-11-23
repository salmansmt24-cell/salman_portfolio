"use client";
import { useMemo, useState } from "react";

export type CollectionItem = {
  id:number; module:string; title:string; description:string; subtitle:string;
  image_path:string; link_url:string; sort_order:number; is_published:boolean; created_at:string|null;
};
type Draft = Omit<CollectionItem,"id"|"created_at">;
const MODULES = [
  {value:"services",label:"Services"},{value:"portfolio",label:"Portfolio"},
  {value:"skills",label:"Skills"},{value:"experience",label:"Experience"},{value:"education",label:"Education"},
];
const blank = (module="services"):Draft=>({module,title:"",description:"",subtitle:"",image_path:"",link_url:"",sort_order:0,is_published:true});
export default function CollectionsManager({initialItems}:{initialItems:CollectionItem[]}) {
  const [items,setItems]=useState(initialItems);
  const [module,setModule]=useState("all");
  const [draft,setDraft]=useState<Draft>(blank());
  const [editing,setEditing]=useState<number|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [media,setMedia]=useState<{id:number;filename:string}[]>([]);
  const [mediaOpen,setMediaOpen]=useState(false);
  const [mediaLoading,setMediaLoading]=useState(false);
  const [mediaError,setMediaError]=useState("");
  const filtered=useMemo(()=>items.filter(item=>module==="all"||item.module===module),[items,module]);
  function startEdit(item:CollectionItem) {
    setEditing(item.id);setDraft({module:item.module,title:item.title,description:item.description,subtitle:item.subtitle||"",image_path:item.image_path||"",link_url:item.link_url||"",sort_order:item.sort_order,is_published:item.is_published});setError("");setNotice("");
    document.getElementById("collection-form")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function reset() {setEditing(null);setDraft(blank(module==="all"?"services":module));setError("");}
  async function openMedia() {
    setMediaOpen(v=>!v);setMediaError("");
    if(media.length)return;
    setMediaLoading(true);
    try {const r=await fetch("/api/admin/media");const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load media");setMedia(d.items||[]);}
    catch(e){setMediaError(e instanceof Error?e.message:"Could not load media");}
    finally{setMediaLoading(false);}
  }
  async function uploadImage(file?:File) {
    if(!file)return;
    if(file.size>3_000_000){setError("Choose an image under 3 MB.");return;}
    setBusy(true);setError("");setNotice("");
    try {
      const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file);});
      const r=await fetch("/api/admin/media",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({filename:file.name,data})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"Upload failed");
      setDraft(old=>({...old,image_path:d.path}));setMedia(old=>[d.item,...old.filter(x=>x.id!==d.item.id)]);setNotice("Image uploaded. Save the collection item to apply it.");
    } catch(e){setError(e instanceof Error?e.message:"Image upload failed.");}
    finally{setBusy(false);}
  }
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      const res=await fetch("/api/admin/items",{method:editing?"PUT":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(editing?{...draft,id:editing}:draft)});
      const data=await res.json();if(!res.ok)throw new Error(data.error||"Save failed");
      if(editing)setItems(old=>old.map(item=>item.id===editing?data.item:item));else setItems(old=>[data.item,...old]);
      setNotice(editing?"Collection item updated.":"New collection item created.");reset();
    } catch(e){setError(e instanceof Error?e.message:"Something went wrong.");}
    finally{setBusy(false);}
  }
  async function remove(item:CollectionItem) {
    if(!window.confirm(`Delete "${item.title}"? This cannot be undone.`))return;
    setBusy(true);setError("");setNotice("");
    try {const res=await fetch("/api/admin/items",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:item.id})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Delete failed");setItems(old=>old.filter(x=>x.id!==item.id));setNotice("Item deleted.");if(editing===item.id)reset();}
    catch(e){setError(e instanceof Error?e.message:"Delete failed.");}
    finally{setBusy(false);}
  }
  return <div className="collections">
    <style>{`.collections{color:#1b2940}.collection-layout{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.5fr);gap:16px;align-items:start}.c-panel{background:#fff;border:1px solid #e6ebf2;border-radius:13px;padding:18px;min-width:0}.c-panel h2{font-size:15px;margin:0 0 15px}.c-field{display:grid;gap:6px;margin:12px 0}.c-field label{font-size:11px;font-weight:700;color:#52627a}.c-field input,.c-field textarea,.c-field select,.c-toolbar select{width:100%;padding:10px 11px;border:1px solid #dce4ef;border-radius:8px;background:#fff;color:#26364d;font:13px Arial,sans-serif}.c-field textarea{min-height:95px;resize:vertical}.c-image-preview{display:block;width:100%;max-width:300px;height:170px;object-fit:contain;background:#f4f6fa;border:1px solid #e6ebf2;border-radius:9px;margin-top:9px}.c-image-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.c-image-btn{border:0;border-radius:8px;padding:9px 11px;background:#edf2f8;color:#285db4;font-size:11px;font-weight:700;cursor:pointer}.c-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;margin-top:10px}.c-media-choice{border:1px solid #dce4ef;background:#fff;border-radius:8px;padding:6px;cursor:pointer;min-width:0}.c-media-choice img{width:100%;height:65px;object-fit:contain;background:#f4f6fa}.c-media-choice span{display:block;font-size:10px;overflow-wrap:anywhere;margin-top:4px}.c-thumb{width:74px;height:60px;object-fit:cover;border-radius:7px;background:#f2f4f7;flex-shrink:0}.c-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.c-check{display:flex;align-items:center;gap:8px;font-size:12px;color:#596981;margin:14px 0}.c-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.c-btn{border:0;border-radius:8px;padding:10px 14px;background:#285db4;color:#fff;font-size:12px;font-weight:700;cursor:pointer}.c-btn.secondary{background:#edf2f8;color:#42536b}.c-btn.danger{background:#fff0f0;color:#b33b3b}.c-btn:disabled{opacity:.5;cursor:not-allowed}.c-alert{font-size:12px;margin:10px 0;color:#b33b3b}.c-success{font-size:12px;margin:10px 0;color:#16865b}.c-toolbar{display:flex;gap:8px;align-items:center;margin-bottom:12px}.c-toolbar select{max-width:190px}.c-count{font-size:11px;color:#8492a7;margin-left:auto}.c-list{display:grid;gap:9px}.c-item{border:1px solid #e8edf4;border-radius:10px;padding:13px;display:flex;gap:12px;align-items:flex-start}.c-item-main{min-width:0;flex:1}.c-item h3{font-size:13px;margin:0 0 5px;overflow-wrap:anywhere}.c-item p{font-size:11px;color:#8390a3;line-height:1.5;margin:0 0 8px;overflow-wrap:anywhere}.c-meta{display:flex;gap:6px;flex-wrap:wrap}.c-tag{font-size:9px;padding:4px 7px;border-radius:20px;background:#eef2f8;color:#63738a}.c-tag.live{background:#e8f7ef;color:#178452}.c-item-actions{display:flex;gap:6px;flex-wrap:wrap}.c-item-actions button{font-size:10px;padding:7px 9px}.c-empty{text-align:center;color:#97a3b3;padding:30px 12px;font-size:12px}@media(max-width:850px){.collection-layout{grid-template-columns:1fr}}@media(max-width:520px){.c-row{grid-template-columns:1fr}.c-toolbar{flex-wrap:wrap}.c-count{width:100%;margin:0}}`}</style>
    <div className="collection-layout">
      <form id="collection-form" className="c-panel" onSubmit={submit}>
        <h2>{editing?"Edit collection item":"Add collection item"}</h2>
        <div className="c-field"><label htmlFor="c-module">Collection</label><select id="c-module" value={draft.module} onChange={e=>setDraft(d=>({...d,module:e.target.value}))}>{MODULES.map(m=><option value={m.value} key={m.value}>{m.label}</option>)}</select></div>
        <div className="c-field"><label htmlFor="c-title">Title *</label><input id="c-title" maxLength={255} required value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="Item title"/></div>
        <div className="c-field"><label htmlFor="c-subtitle">Subtitle</label><input id="c-subtitle" maxLength={255} value={draft.subtitle} onChange={e=>setDraft(d=>({...d,subtitle:e.target.value}))} placeholder="Short supporting line"/></div>
        <div className="c-field"><label htmlFor="c-description">Description *</label><textarea id="c-description" required maxLength={20000} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} placeholder="Describe this item…"/></div>
        <div className="c-field"><label htmlFor="c-image">Project image</label><input id="c-image" maxLength={500} value={draft.image_path} onChange={e=>setDraft(d=>({...d,image_path:e.target.value}))} placeholder="Upload or choose an image"/>
          {draft.image_path&&<img className="c-image-preview" src={draft.image_path.startsWith("http")?draft.image_path:draft.image_path.startsWith("/")?draft.image_path:"/"+draft.image_path} alt="Selected project preview"/>}
          <div className="c-image-tools"><label className="c-image-btn">Upload image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void uploadImage(e.target.files?.[0]);e.target.value="";}} style={{display:"none"}}/></label><button type="button" className="c-image-btn" onClick={()=>void openMedia()} disabled={busy||mediaLoading}>Choose from Media Library</button></div>
          {mediaOpen&&<div style={{border:"1px solid #e6ebf2",borderRadius:9,padding:10,marginTop:9}}><strong style={{fontSize:12}}>Media Library</strong>{mediaLoading?<p style={{fontSize:11,color:"#8190a5"}}>Loading images…</p>:mediaError?<p className="c-alert">{mediaError}</p>:media.length?<div className="c-media-grid">{media.map(item=><button type="button" className="c-media-choice" key={item.id} onClick={()=>{setDraft(d=>({...d,image_path:"api/media/"+item.id}));setMediaOpen(false);}}><img src={"/api/media/"+item.id} alt={item.filename}/><span>{item.filename}</span></button>)}</div>:<p style={{fontSize:11,color:"#8190a5"}}>No images yet. Upload one above.</p>}</div>}
        </div>
        <div className="c-field"><label htmlFor="c-link">Link URL</label><input id="c-link" maxLength={500} value={draft.link_url} onChange={e=>setDraft(d=>({...d,link_url:e.target.value}))} placeholder="https://example.com"/></div>
        <div className="c-row"><div className="c-field"><label htmlFor="c-order">Sort order</label><input id="c-order" type="number" min="0" max="100000" value={draft.sort_order} onChange={e=>setDraft(d=>({...d,sort_order:Number(e.target.value)}))}/></div></div>
        <label className="c-check"><input type="checkbox" checked={draft.is_published} onChange={e=>setDraft(d=>({...d,is_published:e.target.checked}))}/> Published and visible</label>
        {error&&<p className="c-alert" role="alert">{error}</p>}{notice&&<p className="c-success" role="status">{notice}</p>}
        <div className="c-actions"><button className="c-btn" disabled={busy}>{busy?"Saving…":editing?"Update item":"Create item"}</button>{editing&&<button type="button" className="c-btn secondary" onClick={reset} disabled={busy}>Cancel edit</button>}</div>
      </form>
      <section className="c-panel">
        <h2>Saved items</h2>
        <div className="c-toolbar"><select aria-label="Filter collection" value={module} onChange={e=>setModule(e.target.value)}><option value="all">All collections</option>{MODULES.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select><span className="c-count">{filtered.length} items</span></div>
        <div className="c-list">{filtered.map(item=><article className="c-item" key={item.id}>
          <div className="c-item-main">{item.image_path&&<img className="c-thumb" src={item.image_path.startsWith("http")?item.image_path:item.image_path.startsWith("/")?item.image_path:"/"+item.image_path} alt={item.title}/>}<h3>{item.title}</h3><p>{item.subtitle?item.subtitle+" · ":""}{item.description.slice(0,150)}{item.description.length>150?"…":""}</p><div className="c-meta"><span className="c-tag">{MODULES.find(m=>m.value===item.module)?.label||item.module}</span><span className={"c-tag "+(item.is_published?"live":"")}>{item.is_published?"Published":"Draft"}</span><span className="c-tag">Order {item.sort_order}</span></div></div>
          <div className="c-item-actions"><button className="c-btn secondary" type="button" onClick={()=>startEdit(item)} disabled={busy}>Edit</button><button className="c-btn danger" type="button" onClick={()=>remove(item)} disabled={busy}>Delete</button></div>
        </article>)}{filtered.length===0&&<div className="c-empty">No items in this collection yet. Use the form to add the first one.</div>}</div>
      </section>
    </div>
  </div>;
}
