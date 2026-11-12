require('dotenv').config();
const express=require('express'),Database=require('better-sqlite3'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),
crypto=require('crypto'),multer=require('multer'),nodemailer=require('nodemailer'),rateLimit=require('express-rate-limit'),fs=require('fs');
const {JWT_SECRET,FILE_KEY,SMTP_URL,MAIL_FROM,PORT=3000}=process.env;
if(!JWT_SECRET||!/^[0-9a-f]{64}$/i.test(FILE_KEY||'')) throw new Error('Set JWT_SECRET and a 64-hex FILE_KEY in .env');
const KEY=Buffer.from(FILE_KEY,'hex'), mailer=SMTP_URL?nodemailer.createTransport(SMTP_URL):null;
fs.mkdirSync('data/files',{recursive:true});
const db=new Database('data/safe.db');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,name TEXT,pass TEXT,vault TEXT,verified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS codes(email TEXT,purpose TEXT,hash TEXT,exp INTEGER,tries INTEGER DEFAULT 0,PRIMARY KEY(email,purpose));
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,uid INTEGER,name TEXT,grp TEXT,size INTEGER,iv TEXT,tag TEXT,created INTEGER);`);

const GMAIL=/^[a-z0-9._%+-]+@gmail\.com$/i, strong=p=>typeof p==='string'&&p.length>=8&&p.length<=128;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const tok=(id,scope,exp)=>jwt.sign({id,scope},JWT_SECRET,{expiresIn:exp});
const need=scope=>(req,res,next)=>{try{const t=jwt.verify((req.headers[scope==='vault'?'x-vault-token':'authorization']||'').replace('Bearer ',''),JWT_SECRET);
  if(t.scope!==scope)throw 0;req.uid=t.id;next()}catch{res.status(401).json({error:'Unauthorized'})}};

// ---- 6-digit email codes: hashed, expire in 10 min, 5 tries max ----
async function sendCode(email,purpose){
  const code=String(crypto.randomInt(100000,1000000));
  db.prepare('REPLACE INTO codes(email,purpose,hash,exp,tries) VALUES(?,?,?,?,0)').run(email,purpose,sha(email+purpose+code),Date.now()+6e5);
  if(mailer) await mailer.sendMail({from:MAIL_FROM,to:email,subject:'Your Private Safe code',text:`Your 6-digit code is ${code}. It expires in 10 minutes. If you did not ask for it, ignore this email.`});
  else console.log(`[DEV] code for ${email} (${purpose}): ${code}`);
}
function checkCode(email,purpose,code){
  const r=db.prepare('SELECT * FROM codes WHERE email=? AND purpose=?').get(email,purpose);
  if(!r||r.exp<Date.now()||r.tries>=5)return false;
  const ok=crypto.timingSafeEqual(Buffer.from(r.hash),Buffer.from(sha(email+purpose+String(code))));
  if(ok)db.prepare('DELETE FROM codes WHERE email=? AND purpose=?').run(email,purpose);
  else db.prepare('UPDATE codes SET tries=tries+1 WHERE email=? AND purpose=?').run(email,purpose);
  return ok;
}

const app=express(); app.use(express.json({limit:'50kb'}));
const limit=rateLimit({windowMs:15*60e3,max:20,standardHeaders:true}); app.use(['/auth','/vault'],limit);
const A=fn=>(q,s,n)=>Promise.resolve(fn(q,s,n)).catch(e=>{console.error(e);s.status(500).json({error:'Server error'})});

// ---- Account (Gmail ID is verified by a code sent to that inbox) ----
app.post('/auth/register',A(async(q,s)=>{
  const email=String(q.body.email||'').trim().toLowerCase(),{password,name}=q.body;
  if(!GMAIL.test(email))return s.status(400).json({error:'Enter a valid Gmail ID'});
  if(!strong(password))return s.status(400).json({error:'Password needs 8+ characters'});
  const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(u&&u.verified)return s.status(409).json({error:'Account already exists. Log in instead.'});
  const h=await bcrypt.hash(password,12);
  if(u)db.prepare('UPDATE users SET pass=?,name=? WHERE email=?').run(h,name||'',email);
  else db.prepare('INSERT INTO users(email,name,pass) VALUES(?,?,?)').run(email,name||'',h);
  await sendCode(email,'signup'); s.json({ok:true});
}));
app.post('/auth/verify',(q,s)=>{
  const email=String(q.body.email||'').toLowerCase();
  if(!checkCode(email,'signup',q.body.code))return s.status(400).json({error:'Wrong or expired code'});
  db.prepare('UPDATE users SET verified=1 WHERE email=?').run(email);
  const u=db.prepare('SELECT id FROM users WHERE email=?').get(email); s.json({token:tok(u.id,'login','12h')});
});
app.post('/auth/login',A(async(q,s)=>{
  const u=db.prepare('SELECT * FROM users WHERE email=? AND verified=1').get(String(q.body.email||'').toLowerCase());
  if(!u||!(await bcrypt.compare(String(q.body.password||''),u.pass)))return s.status(401).json({error:'Email or password is wrong'});
  s.json({token:tok(u.id,'login','12h'),name:u.name,hasVault:!!u.vault});
}));
app.get('/me',need('login'),(q,s)=>s.json(db.prepare('SELECT email,name,vault IS NOT NULL AS hasVault FROM users WHERE id=?').get(q.uid)));
app.patch('/me',need('login'),(q,s)=>{const n=String(q.body.name||'').trim().slice(0,60);if(!n)return s.status(400).json({error:'Name required'});
  db.prepare('UPDATE users SET name=? WHERE id=?').run(n,q.uid);s.json({ok:true})});

// ---- Privacy (vault) password ----
app.post('/vault/set',need('login'),A(async(q,s)=>{
  const u=db.prepare('SELECT vault FROM users WHERE id=?').get(q.uid);
  if(u.vault)return s.status(409).json({error:'Already set'}); if(!strong(q.body.password))return s.status(400).json({error:'8+ characters'});
  db.prepare('UPDATE users SET vault=? WHERE id=?').run(await bcrypt.hash(q.body.password,12),q.uid);s.json({vaultToken:tok(q.uid,'vault','15m')});
}));
app.post('/vault/unlock',need('login'),A(async(q,s)=>{
  const u=db.prepare('SELECT vault FROM users WHERE id=?').get(q.uid);
  if(!u.vault||!(await bcrypt.compare(String(q.body.password||''),u.vault)))return s.status(401).json({error:'Wrong privacy password'});
  s.json({vaultToken:tok(q.uid,'vault','15m')});
}));
app.post('/vault/change',need('login'),A(async(q,s)=>{            // old password first, then new
  const u=db.prepare('SELECT vault FROM users WHERE id=?').get(q.uid);
  if(!(await bcrypt.compare(String(q.body.oldPassword||''),u.vault)))return s.status(401).json({error:'Old password is wrong'});
  if(!strong(q.body.newPassword))return s.status(400).json({error:'8+ characters'});
  db.prepare('UPDATE users SET vault=? WHERE id=?').run(await bcrypt.hash(q.body.newPassword,12),q.uid);s.json({ok:true});
}));
app.post('/vault/forgot',need('login'),A(async(q,s)=>{            // "Try another way": code to the account Gmail
  const u=db.prepare('SELECT email FROM users WHERE id=?').get(q.uid);await sendCode(u.email,'vault');s.json({ok:true});
}));
app.post('/vault/reset',need('login'),A(async(q,s)=>{
  const u=db.prepare('SELECT email FROM users WHERE id=?').get(q.uid);
  if(!checkCode(u.email,'vault',q.body.code))return s.status(400).json({error:'Wrong or expired code'});
  if(!strong(q.body.newPassword))return s.status(400).json({error:'8+ characters'});
  db.prepare('UPDATE users SET vault=? WHERE id=?').run(await bcrypt.hash(q.body.newPassword,12),q.uid);s.json({vaultToken:tok(q.uid,'vault','15m')});
}));

// ---- Files: encrypted at rest (AES-256-GCM), grouped by type ----
const group=(m,n)=>/^image\//.test(m)?'Photos':/^video\//.test(m)?'Videos':/^audio\//.test(m)?'Audio':
  (/pdf|word|sheet|presentation|text|csv/.test(m)||/\.(docx?|xlsx?|pptx?|pdf|txt|csv)$/i.test(n))?'Documents':'Others';
const up=multer({storage:multer.memoryStorage(),limits:{fileSize:100*1024*1024,files:50}});
app.post('/files',need('vault'),up.array('files'),(q,s)=>{
  const ins=db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?)'),out=[];
  for(const f of q.files||[]){
    const id=crypto.randomUUID(),iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',KEY,iv);
    fs.writeFileSync(`data/files/${id}`,Buffer.concat([c.update(f.buffer),c.final()]));
    const g=group(f.mimetype,f.originalname);
    ins.run(id,q.uid,f.originalname,g,f.size,iv.toString('hex'),c.getAuthTag().toString('hex'),Date.now());out.push({id,name:f.originalname,group:g});
  } s.json({stored:out});   // app deletes the originals only after this succeeds
});
app.get('/files',need('vault'),(q,s)=>s.json(q.query.group
  ?db.prepare('SELECT id,name,grp,size FROM files WHERE uid=? AND grp=? ORDER BY created DESC').all(q.uid,q.query.group)
  :db.prepare('SELECT id,name,grp,size FROM files WHERE uid=? ORDER BY created DESC').all(q.uid)));
app.get('/files/:id',need('vault'),(q,s)=>{
  const f=db.prepare('SELECT * FROM files WHERE id=? AND uid=?').get(q.params.id,q.uid);if(!f)return s.sendStatus(404);
  const d=crypto.createDecipheriv('aes-256-gcm',KEY,Buffer.from(f.iv,'hex'));d.setAuthTag(Buffer.from(f.tag,'hex'));
  s.attachment(f.name).send(Buffer.concat([d.update(fs.readFileSync(`data/files/${f.id}`)),d.final()]));
});
app.delete('/files/:id',need('vault'),(q,s)=>{
  const f=db.prepare('SELECT id FROM files WHERE id=? AND uid=?').get(q.params.id,q.uid);if(!f)return s.sendStatus(404);
  fs.rmSync(`data/files/${f.id}`,{force:true});db.prepare('DELETE FROM files WHERE id=?').run(f.id);s.json({ok:true});
});
app.listen(PORT,()=>console.log('Private Safe API on :'+PORT));
