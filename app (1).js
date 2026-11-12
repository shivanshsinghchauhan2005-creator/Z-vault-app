const G={Photos:['🖼️','image/*'],Videos:['🎬','video/*'],Audio:['🎵','audio/*'],Documents:['📄','.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'],Others:['📦','*/*']};
const TH={Sky:['#4a7bd8','#1d2f6f'],Night:['#2b3f7a','#0b1229'],Sunset:['#f08a5d','#6a2c70'],Forest:['#3fa37a','#124b3a']};
const $=id=>document.getElementById(id);let S={},mode='c',cur='',C=null;
try{S=JSON.parse(localStorage.getItem('psafe')||'{}')}catch(e){}S.files=S.files||[];
const save=()=>{try{localStorage.setItem('psafe',JSON.stringify(S))}catch(e){toast('Storage full')}};
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('psafe:'+s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const show=id=>{document.querySelectorAll('.scr').forEach(s=>s.classList.toggle('hide',s.id!==id));document.querySelectorAll('.sheet').forEach(s=>s.classList.add('hide'));window.scrollTo(0,0)};
function toast(t){const e=$('toast');e.textContent=t;e.classList.remove('hide');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hide'),2600)}
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function theme(n){const t=TH[n]||TH.Sky;S.theme=n;document.documentElement.style.setProperty('--bg1',t[0]);document.documentElement.style.setProperty('--bg2',t[1]);save()}
document.querySelectorAll('input[type=password]').forEach(i=>{const w=document.createElement('div');w.className='pw';i.before(w);w.append(i);const b=document.createElement('button');b.type='button';b.textContent='👁';b.setAttribute('aria-label','Show password');b.onclick=()=>{i.type=i.type==='password'?'text':'password'};w.append(b)});
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>home());
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('.sheet').classList.add('hide'));
function route(){if(S.vh&&S.perm){$('lw').textContent='Welcome back, '+S.name;show('lock')}else if(S.vh)show('perm');else if(S.name)show('vault');else if(S.eh)show('profile');else show('auth')}
// verification code (demo shows the code on screen; the real backend emails it to the Gmail ID)
function askCode(next){C={code:String(100000+Math.floor(Math.random()*900000)),next};$('cs').textContent='Sent to '+S.email;$('demo').textContent='Demo only: your code is '+C.code+'. The real app emails it.';$('cd').value='';$('e6').textContent='';show('code')}
$('b6').onclick=()=>{if($('cd').value.trim()!==C.code)return $('e6').textContent='Wrong code. Try again.';C.next()};$('rs').onclick=()=>{askCode(C.next);toast('New code sent')};
$('tc').onclick=()=>{mode='c';$('tc').className='on';$('tl').className='';$('b1').textContent='Continue'};
$('tl').onclick=()=>{mode='l';$('tl').className='on';$('tc').className='';$('b1').textContent='Log in'};
$('b1').onclick=async()=>{const e=$('em').value.trim().toLowerCase(),p=$('pw').value;
 if(!/^[a-z0-9._%+-]+@gmail\.com$/.test(e))return $('e1').textContent='Enter a valid Gmail ID (name@gmail.com).';
 if(p.length<8)return $('e1').textContent='Password needs at least 8 characters.';
 const h=await hash(e+p);$('e1').textContent='';
 if(mode==='c'){S={eh:h,email:e,name:'',vh:'',perm:0,files:[],theme:S.theme};save();askCode(()=>show('profile'))}
 else{if(S.eh!==h)return $('e1').textContent='Email or password is wrong.';route()}};
$('b2').onclick=()=>{const n=$('nm').value.trim();if(!n)return $('e2').textContent='Please enter your name.';S.name=n;save();show('vault')};
async function newPw(a,b,err){if(a.length<8){err.textContent='Use at least 8 characters.';return}if(a!==b){err.textContent='Passwords do not match.';return}err.textContent='';return hash('vault'+a)}
$('b3').onclick=async()=>{const h=await newPw($('v1').value,$('v2').value,$('e3'));if(!h)return;S.vh=h;save();$('v1').value=$('v2').value='';S.perm?(toast('New password set'),home()):show('perm')};
$('b4').onclick=()=>{S.perm=1;save();home()};
$('b5').onclick=async()=>{if(await hash('vault'+$('lp').value)!==S.vh)return $('e5').textContent='Wrong privacy password.';$('lp').value='';$('e5').textContent='';home()};
$('alt').onclick=$('alt2').onclick=()=>{$('vt').textContent='Set new password';askCode(()=>show('vault'))};
$('m1').onclick=()=>{show('chpw')};$('m2').onclick=()=>{$('ed1').textContent=S.email;$('ed2').value=S.name;show('edit')};$('m3').onclick=route;$('mn').onclick=()=>$('mnu').classList.remove('hide');
$('b7').onclick=async()=>{if(await hash('vault'+$('o1').value)!==S.vh)return $('e7').textContent='Old password is wrong.';const h=await newPw($('o2').value,$('o3').value,$('e7'));if(!h)return;S.vh=h;save();['o1','o2','o3'].forEach(i=>$(i).value='');toast('Password changed');home()};
$('b8').onclick=()=>{const n=$('ed2').value.trim();if(!n)return $('e8').textContent='Name cannot be empty.';S.name=n;save();toast('Profile saved');home()};
$('sw').innerHTML=Object.keys(TH).map(n=>`<i data-t="${n}" title="${n}" style="background:linear-gradient(${TH[n][0]},${TH[n][1]})"></i>`).join('');
document.querySelectorAll('#sw i').forEach(i=>i.onclick=()=>{theme(i.dataset.t);mark()});const mark=()=>document.querySelectorAll('#sw i').forEach(i=>i.classList.toggle('on',i.dataset.t===(S.theme||'Sky')));
function home(){$('hi').textContent='Hi, '+S.name;$('cnt').textContent=S.files.length;mark();
 $('grid').innerHTML=Object.keys(G).map(k=>{const f=S.files.filter(x=>x.g===k),t=f.find(x=>x.t);return `<button class="sq" data-g="${k}">${t?`<img src="${t.t}" alt="">`:''}<div class="e">${G[k][0]}</div><div><b>${k}</b><span>${f.length} file${f.length==1?'':'s'}</span></div></button>`}).join('');
 document.querySelectorAll('.sq').forEach(b=>b.onclick=()=>open(b.dataset.g));show('home')}
function open(g){cur=g;$('gt').textContent=G[g][0]+' '+g;const f=S.files.filter(x=>x.g===g);
 $('fg').innerHTML=f.map(x=>`<div class="fs">${x.t?`<img src="${x.t}" alt="">`:G[g][0]+`<small>${esc(x.n)}</small>`}<button class="x" data-id="${x.id}" aria-label="Delete">✕</button></div>`).join('');
 $('ge').textContent=f.length?'':'No files in this group yet.';
 document.querySelectorAll('.x').forEach(b=>b.onclick=()=>{S.files=S.files.filter(x=>x.id!=b.dataset.id);save();open(cur)});show('group')}
$('ch').innerHTML=Object.keys(G).map(k=>`<button class="btn" data-k="${k}">${G[k][0]} ${k}</button>`).join('');
document.querySelectorAll('#ch .btn').forEach(b=>b.onclick=()=>{$('choose').classList.add('hide');launch(b.dataset.k)});
$('add').onclick=()=>$('choose').classList.remove('hide');$('add2').onclick=()=>launch(cur);
function launch(g){$('pick').accept=G[g][1];$('pick').dataset.g=g;$('pick').click()}   // opens the phone’s files of that type only
function thumb(f){return new Promise(r=>{try{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>{const c=document.createElement('canvas'),s=Math.min(1,160/Math.max(i.width,i.height));c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);r(c.toDataURL('image/jpeg',.6))};i.onerror=()=>r('');i.src=u}catch(e){r('')}})}
$('pick').onchange=async e=>{const list=[...e.target.files],g=e.target.dataset.g;e.target.value='';
 for(const f of list)S.files.push({id:Date.now()+Math.random(),n:f.name,s:f.size,g,t:g==='Photos'?await thumb(f):''});
 save();toast(list.length+' file'+(list.length==1?'':'s')+' added to the Safe');!$('group').classList.contains('hide')?open(cur):home()};
theme(S.theme||'Sky');route();
