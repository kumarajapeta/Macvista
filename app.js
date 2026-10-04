let medicines=[]; let cart=[]; let pendingAdminAction=null;

async function api(url, opts={}) {
  const r=await fetch(url, opts);
  if(!r.ok) {
    const body=await r.json().catch(()=>({}));
    const error=new Error(body.error||`Request failed (${r.status})`);
    error.status=r.status;
    throw error;
  }
  return r.json();
}
async function loadStats(){
  const s=await api("/api/stats");
  const stats={
    statMedicines:s.totalMedicines,
    statUnits:s.totalUnits.toLocaleString(),
    statLow:s.lowStock,
    statCategories:s.categories
  };
  for(const [id,value] of Object.entries(stats)){
    const element=document.getElementById(id);
    if(element)element.textContent=value;
  }
}
async function loadCategories(){
  const categorySelect=document.getElementById("category");
  const selectedCategory=categorySelect?.value||"all";
  const all=await api("/api/medicines");
  const cats=[...new Set(all.map(x=>x.category))].sort();
  if(categorySelect){
    categorySelect.innerHTML='<option value="all">All categories</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
    categorySelect.value=cats.includes(selectedCategory)?selectedCategory:"all";
  }
  updateFeaturedMedicine(all);
}
function updateFeaturedMedicine(items){
  if(!document.getElementById("featuredName"))return;
  const available=items.filter(x=>Number(x.stock)>0);
  const medicine=available[0];
  const name=document.getElementById("featuredName");
  const pack=document.getElementById("featuredPack");
  const units=document.getElementById("featuredUnits");
  const price=document.getElementById("featuredPrice");
  const stockBar=document.getElementById("featuredStockBar");
  const requestButton=document.getElementById("featuredRequestButton");
  if(!medicine){
    name.textContent="No medicines available";
    pack.textContent="There are currently no items in stock";
    units.textContent="0 units";
    price.textContent="—";
    stockBar.style.width="0%";
    requestButton.disabled=true;
    requestButton.onclick=null;
    return;
  }
  const maxStock=Math.max(...available.map(x=>Number(x.stock)));
  name.textContent=medicine.name;
  pack.textContent=[medicine.form,medicine.pack].filter(Boolean).join(" • ");
  units.textContent=`${medicine.stock} units`;
  price.textContent=`₹${Number(medicine.price).toFixed(2)} / pack`;
  stockBar.style.width=`${Number(medicine.stock)/maxStock*100}%`;
  requestButton.disabled=false;
  requestButton.onclick=()=>addToCart(medicine.id);
}
async function loadMedicines(){
  if(!document.getElementById("search") || !document.getElementById("category") || !document.getElementById("catalogGrid"))return;
  const q=encodeURIComponent(document.getElementById("search").value||"");
  const c=encodeURIComponent(document.getElementById("category").value||"all");
  medicines=await api(`/api/medicines?q=${q}&category=${c}`);
  catalogGrid.innerHTML=medicines.map(card).join("");
}
async function refreshCatalog(button){
  const status=document.getElementById("catalogRefreshStatus");
  button.disabled=true;
  button.setAttribute("aria-busy","true");
  status.textContent="Refreshing inventory…";
  try{
    await Promise.all([loadStats(),loadCategories()]);
    await loadMedicines();
    status.textContent=`Results updated at ${new Date().toLocaleTimeString()}.`;
  }catch(error){
    status.textContent=`Unable to refresh results: ${error.message}`;
  }finally{
    button.disabled=false;
    button.removeAttribute("aria-busy");
  }
}
function card(x){
  const cls=x.stock<=20?"low":"";
  const label=x.stock<=0?"Out of Stock":x.stock<=20?"Low Stock":"In Stock";
  return `<article class="medicine-card">
    <span class="badge ${cls}">${label}</span>
    <div class="med-image"><img src="${escapeAttr(x.image||"/assets/medicine-default.svg")}" alt="${escapeAttr(x.name)}"><button class="med-image-delete" type="button" aria-label="Delete ${escapeAttr(x.name)}" title="Delete ${escapeAttr(x.name)}" onclick="requestAdminAccess(()=>removeMedicine(${x.id}))">−</button></div>
    <div class="med-cat">${escapeHtml(x.category)}</div>
    <h3>${escapeHtml(x.name)}</h3><div class="generic">${escapeHtml(x.generic)} • ${escapeHtml(x.form)}</div>
    <div class="med-meta"><span>${escapeHtml(x.pack)}</span><b>₹${Number(x.price).toFixed(2)}</b></div>
    <div class="med-meta"><span>Available</span><b>${x.stock} units</b></div>
    <div class="med-actions"><button onclick="showDetails(${x.id})">Details</button><button class="primary" ${x.stock<=0?"disabled":""} onclick="addToCart(${x.id})">Request +</button></div>
  </article>`;
}
function showDetails(id){
  const x=medicines.find(m=>m.id===id);
  modalContent.innerHTML=`<div class="eyebrow"><span></span> MEDICINE DETAIL</div><h2>${escapeHtml(x.name)}</h2><div class="admin-preview"><div><div><b>${escapeHtml(x.brand||"Generic")}</b><p>${escapeHtml(x.generic)} • ${escapeHtml(x.form)} • ${escapeHtml(x.pack)}</p><p>Current stock: <strong>${x.stock} units</strong></p><p>Indicative price: <strong>₹${Number(x.price).toFixed(2)}</strong></p></div></div></div>`;
  modal.classList.remove("hidden");
}
async function addToCart(id){
  const x=medicines.find(m=>m.id===id) || await starterLookup(id);
  if(!x || x.stock<=0) return;
  cart.push(x);
  modalContent.innerHTML=`<div class="eyebrow"><span></span> REQUEST ADDED</div><h2>${escapeHtml(x.name)}</h2><p style="color:#777">Added to your medicine request list.</p><div class="med-actions"><button onclick="closeModal()">Continue browsing</button><button class="primary" onclick="openRequest()">Open request (${cart.length})</button></div>`;
  modal.classList.remove("hidden");
}
async function starterLookup(id){ return (await api("/api/medicines")).find(x=>x.id===id); }
function openRequest(){
  modalContent.innerHTML=`<div class="eyebrow"><span></span> MEDICINE REQUEST</div><h2>Request ${cart.length} item${cart.length!==1?"s":""}</h2>
  <div class="admin-list">${cart.map((x,i)=>`<div class="admin-row"><span>${escapeHtml(x.name)} × 1</span><b>₹${Number(x.price).toFixed(2)}</b></div>`).join("")}</div>
  <div style="height:16px"></div><form onsubmit="submitOrder(event)"><div class="form-grid">
  <label>Name<input required name="name" placeholder="Doctor / store / buyer"></label><label>Phone<input required name="phone" placeholder="Mobile number"></label>
  <label class="full">Notes<textarea name="notes" rows="3" style="width:100%;margin-top:6px;border:1px solid #ddd;padding:11px" placeholder="Prescription/reference or delivery notes"></textarea></label>
  </div><button class="btn btn-dark" style="margin-top:16px">Submit request →</button></form>`;
}
async function submitOrder(e){
  e.preventDefault();
  const fd=new FormData(e.target); const data={customer:{name:fd.get("name"),phone:fd.get("phone")},notes:fd.get("notes"),items:cart.map(x=>({id:x.id,name:x.name,qty:1}))};
  const r=await api("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  cart=[];
  modalContent.innerHTML=`<div class="eyebrow"><span></span> REQUEST RECEIVED</div><h2>Thank you.</h2><p style="color:#777">Your request reference is <strong>${r.orderId}</strong>. This starter project stores the request locally.</p><button class="btn btn-dark" onclick="closeModal()">Done</button>`;
}
function showAdminLogin(message=""){
  modalContent.innerHTML=`<div class="eyebrow"><span></span> ADMINISTRATOR SIGN IN</div><h2>Inventory access</h2>
  <p>Sign in with the administrator credentials configured for this server.</p><form onsubmit="loginAdmin(event)"><div class="form-grid">
  <label class="full">Username<input required name="username" autocomplete="username"></label>
  <label class="full">Password<input required type="password" name="password" autocomplete="current-password"></label>
  </div><p id="adminLoginMessage" role="status" style="color:#a24a42">${escapeHtml(message)}</p>
  <div style="display:flex;gap:10px;align-items:center"><button class="btn btn-dark">Sign in →</button><button class="text-btn" type="button" onclick="continueAsCustomer()">Continue as customer</button></div></form>`;
  modal.classList.remove("hidden");
}
function continueAsCustomer(){
  pendingAdminAction=null;
  closeModal();
}
async function requestAdminAccess(action){
  try{
    const session=await api("/api/admin/session");
    if(session.authenticated){action();return;}
    pendingAdminAction=action;
    const message=session.configured
      ? ""
      : "Administrator sign-in is not configured. Set MEDICINESTOCK_ADMIN_USERNAME and MEDICINESTOCK_ADMIN_PASSWORD, then restart the server.";
    showAdminLogin(message);
  }catch(error){
    showAdminLogin(`Unable to check administrator sign-in: ${error.message}`);
  }
}
async function loginAdmin(event){
  event.preventDefault();
  const form=event.target;
  const button=form.querySelector('button[type="submit"]')||form.querySelector("button");
  const message=document.getElementById("adminLoginMessage");
  button.disabled=true;
  message.textContent="Signing in…";
  try{
    const fields=new FormData(form);
    await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:fields.get("username"),password:fields.get("password")})});
    const action=pendingAdminAction;
    pendingAdminAction=null;
    action?.();
  }catch(error){
    message.textContent=error.message;
    button.disabled=false;
  }
}
async function logoutAdmin(){
  await api("/api/admin/logout",{method:"POST"});
  pendingAdminAction=null;
  showAdminLogin("You have signed out.");
}
function openAdmin(){
  requestAdminAccess(renderAdminDesk);
}
function renderAdminDesk(){
  modalContent.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:start;gap:12px"><div><div class="eyebrow"><span></span> ADMIN INVENTORY DESK</div><h2>Manage medicines</h2></div><button class="filter-btn" type="button" onclick="logoutAdmin()">Sign out</button></div>
  <form onsubmit="addMedicine(event)"><div class="form-grid">
  <label>Name<input required name="name" placeholder="Medicine name"></label><label>Generic<input name="generic"></label>
  <label>Brand<input name="brand"></label><label>Category<input name="category" placeholder="Pain Relief"></label>
  <label>Form<input name="form" value="Tablet"></label><label>Pack<input name="pack" placeholder="10 tablets"></label>
  <label>Stock<input type="number" name="stock" value="0"></label><label>Price<input type="number" step="0.01" name="price" value="0"></label>
  <label class="full">Image URL<div style="display:flex;gap:8px;margin-top:6px"><input name="image" placeholder="/assets/medicine-default.svg"><button class="filter-btn" type="button" onclick="document.getElementById('medicineImageFile').click()">Upload image</button><input id="medicineImageFile" type="file" accept="image/*" hidden onchange="uploadMedicineImage(this)"></div><span id="imageUploadStatus" role="status" style="display:block;margin-top:6px"></span></label>
  </div><button class="btn btn-dark" style="margin-top:16px">Add medicine +</button></form>
  <div class="admin-list" id="adminList"></div>`;
  modal.classList.remove("hidden"); renderAdminList();
}
function showStockAlerts(){
  requestAdminAccess(showStockAlertsPanel);
}
async function showStockAlertsPanel(){
  modalContent.innerHTML='<div class="eyebrow"><span></span> STOCK ALERTS</div><h2>Inventory needing attention</h2><p>Low stock means 20 units or fewer. Out-of-stock medicines are listed separately.</p><div id="stockAlertList" class="admin-list">Loading stock alerts…</div><button class="btn btn-dark" style="margin-top:16px" onclick="openAdmin()">Manage inventory →</button>';
  modal.classList.remove("hidden");
  const list=document.getElementById("stockAlertList");
  try{
    const items=await api("/api/medicines");
    const alerts=items.filter(x=>Number(x.stock)<=20);
    list.innerHTML=alerts.length?alerts.map(x=>`<div class="admin-row"><span><b>${escapeHtml(x.name)}</b><br>${Number(x.stock)<=0?"Out of stock":"Low stock"} • ${Number(x.stock)} units</span></div>`).join(""):'<p>All medicines have more than 20 units in stock.</p>';
  }catch(error){
    list.textContent=`Unable to load stock alerts: ${error.message}`;
  }
}
function openImageUpload(){
  requestAdminAccess(()=>{
    renderAdminDesk();
    document.getElementById("medicineImageFile").click();
  });
}
function showCapturedOrders(){
  requestAdminAccess(showCapturedOrdersPanel);
}
async function showCapturedOrdersPanel(){
  modalContent.innerHTML='<div class="eyebrow"><span></span> ORDER CAPTURE</div><h2>Medicine requests</h2><div id="capturedOrders" class="admin-list">Loading saved requests…</div>';
  modal.classList.remove("hidden");
  const list=document.getElementById("capturedOrders");
  try{
    const orders=await api("/api/orders");
    list.innerHTML=orders.length?orders.map(order=>`<article class="admin-row" style="display:block"><div style="display:flex;justify-content:space-between;gap:12px"><b>${escapeHtml(order.orderId)}</b><span>${escapeHtml(new Date(order.createdAt).toLocaleString())}</span></div><p><b>${escapeHtml(order.customer?.name||"")}</b> • ${escapeHtml(order.customer?.phone||"")}</p><p>${(Array.isArray(order.items)?order.items:[]).map(item=>`${escapeHtml(item.name)} × ${Number(item.qty)||1}`).join(", ")||"No items"}</p>${order.notes?`<p>${escapeHtml(order.notes)}</p>`:""}</article>`).join(""):'<p>No requests have been submitted yet. Requests submitted from the catalog are saved here.</p>';
  }catch(error){
    list.textContent=`Unable to load saved requests: ${error.message}`;
  }
}
function showLocalStorage(){
  requestAdminAccess(showLocalStoragePanel);
}
async function showLocalStoragePanel(){
  modalContent.innerHTML='<div class="eyebrow"><span></span> LOCAL JSON STORAGE</div><h2>Your data, saved locally</h2><p>Inventory and medicine requests are stored by this app on this computer.</p><div id="storageSummary" class="admin-list">Checking saved data…</div>';
  modal.classList.remove("hidden");
  const summary=document.getElementById("storageSummary");
  try{
    const [items,orders]=await Promise.all([api("/api/medicines"),api("/api/orders")]);
    summary.innerHTML=`<div class="admin-row"><span>Inventory: <b>${items.length} medicines</b><br><small>data/medicines.json</small></span><button onclick="downloadLocalJson('medicines')">Download JSON</button></div><div class="admin-row"><span>Requests: <b>${orders.length} orders</b><br><small>data/orders.json</small></span><button onclick="downloadLocalJson('orders')">Download JSON</button></div><p>Changes are saved automatically when medicines or requests are added or updated.</p>`;
  }catch(error){
    summary.textContent=`Unable to read locally saved data: ${error.message}`;
  }
}
async function downloadLocalJson(type){
  const filename=type==="orders"?"orders":"medicines";
  const data=await api(type==="orders"?"/api/orders":"/api/medicines");
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const link=document.createElement("a");
  link.href=url;
  link.download=`${filename}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function uploadMedicineImage(input){
  const file=input.files[0];
  if(!file)return;
  const status=document.getElementById("imageUploadStatus");
  const button=input.parentElement.querySelector("button");
  if(!file.type.startsWith("image/")){
    status.textContent="Choose an image file.";
    input.value="";
    return;
  }
  if(file.size>5*1024*1024){
    status.textContent="Image must be 5 MB or smaller.";
    input.value="";
    return;
  }
  const formData=new FormData();
  formData.append("image",file);
  button.disabled=true;
  status.textContent="Uploading image…";
  try{
    const result=await api("/api/upload",{method:"POST",body:formData});
    document.querySelector('#modalContent input[name="image"]').value=result.url;
    status.textContent="Image uploaded successfully.";
  }catch(error){
    status.textContent=`Image upload failed: ${error.message}`;
    input.value="";
  }finally{
    button.disabled=false;
  }
}
async function renderAdminList(){
  const all=await api("/api/medicines");
  const el=document.getElementById("adminList"); if(!el)return;
  el.innerHTML=all.map(x=>`<div class="admin-row"><span><b>${escapeHtml(x.name)}</b><br>${x.stock} units • ₹${Number(x.price).toFixed(2)}</span><span><button onclick="changeStock(${x.id},${x.stock-1})">−</button><button onclick="changeStock(${x.id},${x.stock+1})">+</button><button onclick="removeMedicine(${x.id})">Delete</button></span></div>`).join("");
}
async function addMedicine(e){
  e.preventDefault(); const fd=new FormData(e.target); const obj=Object.fromEntries(fd.entries()); obj.stock=Number(obj.stock); obj.price=Number(obj.price);
  await api("/api/medicines",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(obj)});
  e.target.reset(); await renderAdminList(); await loadCategories(); await loadMedicines(); await loadStats();
}
async function changeStock(id,stock){ await api(`/api/medicines/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({stock})}); await renderAdminList(); await loadCategories(); await loadMedicines(); await loadStats(); }
async function removeMedicine(id){
  if(!confirm("Delete this medicine?"))return;
  try{
    await api(`/api/medicines/${id}`,{method:"DELETE"});
    await renderAdminList();
    await Promise.all([loadCategories(),loadMedicines(),loadStats()]);
  }catch(error){
    alert(`Unable to delete medicine: ${error.message}`);
  }
}
function closeModal(){modal.classList.add("hidden");pendingAdminAction=null}
function scrollToSection(id){document.getElementById(id).scrollIntoView({behavior:"smooth"})}
function scrollProviderCategories(direction){
  const track=document.getElementById("providerTrack");
  const maxScroll=track.scrollWidth-track.clientWidth;
  if(direction>0 && track.scrollLeft>=maxScroll-8) {
    track.scrollTo({left:0,behavior:"smooth"});
    return;
  }
  if(direction<0 && track.scrollLeft<=8) {
    track.scrollTo({left:maxScroll,behavior:"smooth"});
    return;
  }
  const item=track.querySelector(".provider-mark");
  const gap=parseFloat(getComputedStyle(track).columnGap)||0;
  track.scrollBy({left:direction*(item.getBoundingClientRect().width+gap),behavior:"smooth"});
}
function startProviderCarousel(){
  const track=document.getElementById("providerTrack");
  if(!track)return;
  const carousel=track.closest(".provider-carousel");
  const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduceMotion)return;
  track.scrollLeft=track.scrollWidth-track.clientWidth;
  let paused=false;
  const timer=window.setInterval(()=>{
    if(paused || document.hidden || track.scrollWidth<=track.clientWidth+8)return;
    scrollProviderCategories(-1);
  },2200);
  carousel.addEventListener("pointerenter",()=>{paused=true});
  carousel.addEventListener("pointerleave",()=>{paused=false});
  carousel.addEventListener("focusin",()=>{paused=true});
  carousel.addEventListener("focusout",event=>{
    if(!carousel.contains(event.relatedTarget))paused=false;
  });
  window.addEventListener("pagehide",()=>window.clearInterval(timer),{once:true});
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(s){return escapeHtml(s)}
document.addEventListener("DOMContentLoaded",async()=>{
  startProviderCarousel();
  await loadStats();
  await loadCategories();
  if(document.getElementById("catalogGrid"))await loadMedicines();
});