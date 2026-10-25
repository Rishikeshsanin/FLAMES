import {calculateFlames, exploreAlternatives, OUTCOMES, tokenizeName} from './engine.mjs';
import {RESEARCH_API_URL, CONSENT_VERSION} from './research-config.mjs';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?15:ms));
const schemes = {
 F:['Friends','✿','the cutest bonds start with a little friendship.','BESTIE ENERGY'],
 L:['Love','♥','somewhere between the letters, a little spark took flight.','LOVE IS IN THE AIR'],
 A:['Affection','🦋','soft smiles and little moments can mean so much.','A GENTLE SPARK'],
 M:['Marriage','💍','wedding bells? the alphabet is feeling dramatic today!','STORYBOOK ENDING'],
 E:['Enemies','⚡','a legendary rivalry... or just the best plot twist?','PLOT TWIST'],
 S:['Siblings','✌','forever-together, partners-in-chaos energy!','PARTNERS IN CHAOS'],
 zero:['Perfect Tie','∞','every letter found its pair, so there are none left to count.','ALL LETTERS MATCHED']
};
const state = {a:'',b:'',data:null,run:0,sound:false,audio:null,feedback:null,attempt:null,parent:null,alternative:false,desired:null,session:null,deletionToken:null,recorded:false,previousResult:null,variations:[]};
const timing = {dreamy:[1200,550,950],normal:[700,330,530],quick:[340,170,320]};
const durations = () => timing[$('speed').value]||timing.dreamy;
function scene(which) {
 const ids=['entryScene','strikeScene','eliminationScene','resultScene','whatIfScene'];
 for(const id of ids) $(id).hidden=id!==which;
 const p=which==='entryScene'?1:which==='strikeScene'||which==='eliminationScene'?2:3;
 document.querySelectorAll('[data-progress]').forEach(el=>el.classList.toggle('active',Number(el.dataset.progress)<=p));
}
function tone(freq=600) {
 if(!state.sound)return;
 try {
 state.audio??=new (window.AudioContext||window.webkitAudioContext)();
 const c=state.audio, o=c.createOscillator(),g=c.createGain();
 o.type='sine';o.frequency.value=freq;g.gain.value=.03;
 g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);
 o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.13);
 } catch {}
}
function msg(text) {
 const el=$('toast');el.textContent=text;el.hidden=false;
 clearTimeout(msg.timeout);msg.timeout=setTimeout(()=>el.hidden=true,3000);
}
function tiles(lineId,name) {
 const line=$(lineId);line.replaceChildren();
 return tokenizeName(name).map(t=>{
  const d=document.createElement('span');d.className='letter-tile';d.textContent=t.letter.toUpperCase();
  line.append(d);return d;
 });
}
function burst(x,y) {
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const layer=$('effectsLayer'),bounds=layer.getBoundingClientRect();
 for(let i=0;i<7;i++){
  const e=document.createElement('span');e.className='spark-particle';e.textContent=i%2?'✧':'♥';
  e.style.left=(x-bounds.left)+'px';e.style.top=(y-bounds.top)+'px';
  const angle=i*Math.PI*2/7;
  e.style.setProperty('--dx',Math.round(Math.cos(angle)*55)+'px');
  e.style.setProperty('--dy',Math.round(Math.sin(angle)*55)+'px');
  layer.append(e);setTimeout(()=>e.remove(),800);
 }
}
function thread(a,b){
 const layer=$('effectsLayer'),rect=layer.getBoundingClientRect(),ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
 const x1=ar.left+ar.width/2-rect.left,y1=ar.top+ar.height/2-rect.top;
 const x2=br.left+br.width/2-rect.left,y2=br.top+br.height/2-rect.top;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('class','strike-thread');
 svg.style.position='absolute';svg.style.inset='0';svg.style.width='100%';svg.style.height='100%';
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');
 path.setAttribute('d','M '+x1+' '+y1+' Q '+((x1+x2)/2+25)+' '+((y1+y2)/2)+' '+x2+' '+y2);
 svg.append(path);layer.append(svg);setTimeout(()=>svg.remove(),950);
}
async function striking(id){
 scene('strikeScene');$('leftLabel').textContent=state.a;$('rightLabel').textContent=state.b;
 $('effectsLayer').replaceChildren();
 const left=tiles('leftLetters',state.a),right=tiles('rightLetters',state.b);
 const pairs=state.data.pairs,du=durations();
 $('strikeMessage').textContent='looking for letters that belong together...';
 $('strikeCount').textContent='0 / '+pairs.length+' pairs';$('countFill').style.width='0%';
 await sleep(550);
 for(let i=0;i<pairs.length;i++){
  if(state.run!==id)return;
  const p=pairs[i],a=left[p.leftIndex],b=right[p.rightIndex];
  if(!a||!b)continue;
  a.classList.add('is-active');b.classList.add('is-active');
  thread(a,b);tone(560+(i%5)*90);
  $('strikeMessage').textContent='one '+p.letter.toUpperCase()+' found another ♡';
  await sleep(du[0]*.42);
  if(state.run!==id)return;
  a.classList.remove('is-active');b.classList.remove('is-active');
  a.classList.add('is-matched');b.classList.add('is-matched');
  const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
  burst((ar.left+br.left+ar.width)/2,(ar.top+br.top+ar.height)/2);
  $('strikeCount').textContent=(i+1)+' / '+pairs.length+' pairs';
  $('countFill').style.width=(100*(i+1)/Math.max(pairs.length,1))+'%';
  await sleep(du[0]*.58);
 }
 if(state.run!==id)return;
 state.data.unmatchedLeft.forEach(t=>left[t.tokenIndex]?.classList.add('is-unmatched'));
 state.data.unmatchedRight.forEach(t=>right[t.tokenIndex]?.classList.add('is-unmatched'));
 $('strikeMessage').textContent=pairs.length?'the matching letters have found each other ✨':'no matching letters... what a plot twist!';
 await sleep(du[2]+600);
 if(id===state.run)void eliminating(id);
}
function circle() {
 const node=$('flamesCircle');node.replaceChildren();
 Object.keys(OUTCOMES).forEach((letter,i)=>{
 const el=document.createElement('span');el.className='flame-chip';el.textContent=letter;el.dataset.letter=letter;
 const angle=i*Math.PI/3-Math.PI/2;
 const radius=window.matchMedia('(max-width:540px)').matches?101:125;
 el.style.transform='translate('+Math.cos(angle)*radius+'px,'+Math.sin(angle)*radius+'px)';
 node.append(el);
 });
}
async function eliminating(id){
 if(state.run!==id)return;
 if(state.data.status!=='ok'){showResult(id);return;}
 scene('eliminationScene');circle();
 $('eliminationDesc').textContent=state.data.remainingCount+' unmatched letters. Count around the FLAMES circle...';
 await sleep(durations()[2]);
 for(const step of state.data.elimination){
  if(id!==state.run)return;
  const node=$('flamesCircle').querySelector('[data-letter="'+step.removed+'"]');
  node?.classList.add('is-counted');
  $('eliminationMessage').textContent='round '+step.round+' · '+step.removed+' disappears...';
  tone(450+step.round*70);
  await sleep(durations()[1]);
  if(id!==state.run)return;
  node?.classList.add('is-eliminated');
  await sleep(durations()[1]);
 }
 if(id!==state.run)return;
 $('eliminationMessage').textContent='and the final letter is... ♡';
 $('flamesCircle').querySelector('[data-letter="'+state.data.letter+'"]')?.classList.add('is-winner');
 await sleep(1000);
 showResult(id);
}
function showResult(id){
 if(id!==state.run)return;
 scene('resultScene');
 const p=schemes[state.data.letter||'zero'];
 $('resultKicker').textContent=p[3];$('resultTitle').textContent=p[0];
 $('resultIllustration').textContent=p[1];$('resultDescription').textContent=p[2];
 $('resultNames').textContent=state.a+' ♡ '+state.b;
 $('feedbackNote').textContent='';
 document.querySelectorAll('.feedback-button').forEach(b=>b.disabled=false);
 tone(840);
}
function newRound(a,b,alt=false,parent=null,previousResult=null,variations=[]){
 ++state.run;state.a=a.trim();state.b=b.trim();
 state.data=calculateFlames(state.a,state.b);
 if(state.data.status==='invalid-input'){msg('both names must contain letters ♡');return;}
 state.alternative=alt;state.parent=parent;state.attempt=crypto.randomUUID();state.recorded=false;
 state.previousResult=previousResult;state.variations=variations;
 state.feedback=null;state.desired=null;
 $('firstName').value=state.a;$('secondName').value=state.b;
 $('experience').scrollIntoView({behavior:'smooth',block:'start'});
 void striking(state.run);void recordAttempt();
}
$('heroStart').onclick=()=>{$('experience').scrollIntoView({behavior:'smooth'});$('firstName').focus({preventScroll:true});};
$('soundToggle').onclick=()=>{
 state.sound=!state.sound;
 $('soundToggle').setAttribute('aria-pressed',String(state.sound));
 $('soundToggle').innerHTML=state.sound?'♫ <span>sound on</span>':'♫ <span>sound off</span>';
 tone();
};
$('nameForm').onsubmit=e=>{
 e.preventDefault();
 const a=$('firstName').value.trim(),b=$('secondName').value.trim();
 if(calculateFlames(a,b).status==='invalid-input'){
  $('inputError').textContent='both names need at least one letter ♡';$('inputError').hidden=false;return;
 }
 $('inputError').hidden=true;newRound(a,b);
};
$('skipSequence').onclick=()=>{++state.run;void eliminating(state.run);};
$('skipElimination').onclick=()=>{++state.run;showResult(state.run);};
function getSession(){
 if(state.session)return state.session;
 try{
   const s=sessionStorage.getItem('flames-session-v1');
   state.session=s||crypto.randomUUID();
   sessionStorage.setItem('flames-session-v1',state.session);
 }catch{state.session=crypto.randomUUID()}
 return state.session;
}
function getDeletionToken(){
 if(state.deletionToken)return state.deletionToken;
 try{
  const stored=sessionStorage.getItem('flames-delete-token-v1');
  if(stored)state.deletionToken=stored;
  else {state.deletionToken=crypto.randomUUID()+crypto.randomUUID();sessionStorage.setItem('flames-delete-token-v1',state.deletionToken)}
 }catch{state.deletionToken=crypto.randomUUID()+crypto.randomUUID()}
 return state.deletionToken;
}
async function sendResearch(method,event){
 try {
  const r=await fetch(RESEARCH_API_URL,{method,headers:{'content-type':'application/json'},body:JSON.stringify(event),keepalive:true});
  if(!r.ok)throw new Error('unavailable');
  return true;
 }catch{msg('sharing is temporarily unavailable — your game still works');return false}
}
async function recordAttempt(){
 if(state.recorded)return;
 state.recorded=true;
 const ok=await sendResearch('POST',{
  session_id:getSession(),attempt_id:state.attempt,parent_attempt_id:state.parent,
  occurred_at:new Date().toISOString(),consent_version:CONSENT_VERSION,algorithm_version:'1.1.0',
  is_alternative:state.alternative,previous_result_letter:state.previousResult,
  analytics_consent:true,names_consent:true,deletion_token:getDeletionToken(),
  name_one:state.a,name_two:state.b,variations:state.variations
 });
 if(!ok)state.recorded=false;
}
async function recordFeedback(liked,wantsChange){
 if(!state.recorded)return;
 await sendResearch('PATCH',{session_id:getSession(),attempt_id:state.attempt,
  liked_result:liked,wants_change:wantsChange,desired_letter:state.desired});
}
$('likedYes').onclick=()=>{
 state.feedback=true;$('feedbackNote').textContent='awww, the universe is blushing! 💗';
 document.querySelectorAll('.feedback-button').forEach(b=>b.disabled=true);
 void recordFeedback(true,false);
};
$('likedNo').onclick=()=>{
 state.feedback=false;void recordFeedback(false,true);scene('whatIfScene');
};
$('watchAgain').onclick=()=>{++state.run;void striking(state.run)};
$('playAgain').onclick=()=>{++state.run;state.parent=null;scene('entryScene');$('firstName').value='';$('secondName').value='';$('firstName').focus();};
$('backToResult').onclick=()=>scene('resultScene');
$('variationForm').onsubmit=e=>{
 e.preventDefault();
 const nick=id=>$(id).value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,10);
 const one={original:state.a,fullName:$('fullFirst').value,nicknames:nick('nickFirst')};
 const two={original:state.b,fullName:$('fullSecond').value,nicknames:nick('nickSecond')};
 const desired=$('desiredResult').value||null;state.desired=desired;
 void recordFeedback(false,true);
 const data=exploreAlternatives(one,two,desired);
 const current=tokenizeName(state.a).map(x=>x.letter).join('')+'|'+tokenizeName(state.b).map(x=>x.letter).join('');
 const matches=data.matching.filter(row=>row.status==='ok'&&(
  tokenizeName(row.left.name).map(x=>x.letter).join('')+'|'+tokenizeName(row.right.name).map(x=>x.letter).join(''))!==current);
 const root=$('variationResults');root.replaceChildren();
 const note=document.createElement('p');note.className='variation-status';
 note.textContent=matches.length?'Cupid found '+matches.length+' genuine alternative combinations ♡':'None of those real name variations reached that ending. You can try another nickname!';
 root.append(note);
 matches.slice(0,30).forEach(item=>{
  const row=document.createElement('div');row.className='variation-item';
  const detail=document.createElement('div'),title=document.createElement('span'),origin=document.createElement('small');
  title.textContent=item.left.name+' ♡ '+item.right.name;
  origin.textContent=item.left.source+' × '+item.right.source;
  detail.append(title,origin);
  const letter=document.createElement('b');letter.textContent=schemes[item.letter][0];
  const action=document.createElement('button');action.type='button';action.textContent='watch ✨';
   action.onclick=()=>newRound(item.left.name,item.right.name,true,state.attempt,state.data.letter,[
    ...(item.left.source==='original'?[]:[{person_side:1,variation_type:item.left.source,name_value:item.left.name}]),
    ...(item.right.source==='original'?[]:[{person_side:2,variation_type:item.right.source,name_value:item.right.name}])
   ]);
  row.append(detail,letter,action);root.append(row);
 });
};
$('deleteSharedData').onclick=async()=>{
 const status=$('privacyStatus');
 if(!state.session){status.textContent='No shared session exists in this browser.';return}
 status.textContent='Deleting…';
 const ok=await sendResearch('DELETE',{session_id:getSession(),deletion_token:getDeletionToken()});
 if(ok){
  status.textContent='Your shared session was deleted.';state.session=null;state.deletionToken=null;
  try{sessionStorage.removeItem('flames-session-v1');sessionStorage.removeItem('flames-delete-token-v1')}catch{}
 }else status.textContent='Deletion is temporarily unavailable. Please try again.';
};
$('shareResult').onclick=async()=>{
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1200;
 const c=canvas.getContext('2d');
 const g=c.createLinearGradient(0,0,1000,1200);g.addColorStop(0,'#fff5f7');g.addColorStop(1,'#f4cadb');
 c.fillStyle=g;c.fillRect(0,0,1000,1200);
 c.strokeStyle='#df9bb6';c.lineWidth=4;c.strokeRect(55,55,890,1090);
 c.textAlign='center';c.fillStyle='#b55380';c.font='40px Georgia';c.fillText('✦  FLAMES  ✦',500,180);
 c.fillStyle='#db4780';c.font='160px Georgia';c.fillText(schemes[state.data.letter||'zero'][1],500,475);
 c.font='85px Georgia';c.fillText(schemes[state.data.letter||'zero'][0],500,660);
 c.fillStyle='#87425f';c.font='36px Georgia';
 let names=state.a+' ♡ '+state.b;
 while(c.measureText(names).width>840&&names.length>8)names=names.slice(0,-4)+'…';
 c.fillText(names,500,755);
 c.font='28px Georgia';c.fillText('a tiny game of fate · just for fun',500,1020);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob)return msg('could not create the card');
 const file=new File([blob],'flames-memory.png',{type:'image/png'});
 if(navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:'My FLAMES result'});return}catch{}
 }
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
 setInterval(()=>{
  if(document.hidden)return;
  const el=document.createElement('span');el.className='floating-heart';el.textContent=Math.random()>.5?'♡':'✧';
  el.style.left=Math.random()*100+'%';el.style.bottom='-40px';
  $('floating-hearts').append(el);setTimeout(()=>el.remove(),16000);
 },2900);
}
