import { chromium } from 'playwright';
import { calculateFlames } from '../engine.mjs';

const base='http://127.0.0.1:8765';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
let fails=0;
{
 const page=await browser.newPage({viewport:{width:1024,height:820},reducedMotion:'no-preference'});
 try{
  await page.route('**/api/research',route=>route.fulfill({status:201,contentType:'application/json',body:'{"ok":true}'}));
  await page.goto(base);await page.locator('#firstName').fill('Rishi');await page.locator('#secondName').fill('Maria');await page.locator('#speed').selectOption('quick');await page.locator('#nameForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.letter-tile.is-matched').length>=2);
  const matched=await page.locator('.letter-tile.is-matched').count(),all=calculateFlames('Rishi','Maria').pairs.length*2;
  if(matched>=all)throw new Error('all matching pairs were struck simultaneously');
  console.log('PASS sequential timing: first pair strikes before the next pair');
 }catch(error){fails++;console.error('FAIL sequential timing: '+error.stack)}finally{await page.close()}
}
for(const width of [320,390,430,768,1366]){
 const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'});
 try{
  const research=[];
  await page.route('**/api/research',async route=>{research.push({method:route.request().method(),body:route.request().postDataJSON()});await route.fulfill({status:route.request().method()==='POST'?201:200,contentType:'application/json',body:'{"ok":true}'})});
  const res=await page.goto(base,{waitUntil:'domcontentloaded'});
  if(res.status()!==200)throw new Error('page HTTP '+res.status());
  await page.locator('#firstName').fill('Rishi');
  await page.locator('#secondName').fill('Maria');
  await page.locator('#speed').selectOption('quick');
  if(!(await page.locator('.entry-consent').textContent()).includes('saved for testing'))throw new Error('missing storage notice');
  await page.locator('#nameForm button[type="submit"]').click();
  await page.locator('#strikeScene').waitFor({state:'visible'});
  const actual=calculateFlames('Rishi','Maria');
  const pairLabels=page.locator('#strikeCount');
  if(!(await pairLabels.textContent()).includes('/ '+actual.pairs.length+' pairs'))
   throw new Error('strike pair count wrong');
  await page.waitForTimeout(200);
  await page.locator('#skipSequence').evaluate(el=>{if(!el.closest('section').hidden)el.click()});
  await page.waitForFunction(()=>!document.querySelector('#eliminationScene').hidden||!document.querySelector('#resultScene').hidden);
  await page.locator('#skipElimination').evaluate(el=>{if(!el.closest('section').hidden)el.click()});
  await page.locator('#resultScene').waitFor({state:'visible'});
  const result=await page.locator('#resultTitle').textContent();
  if(result!==actual.result)throw new Error('result mismatch: '+result+' expected '+actual.result);
  if(research.filter(x=>x.method==='POST').length!==1)throw new Error('initial attempt was not recorded exactly once');
  const storedAttempt=research.find(x=>x.method==='POST').body;
  if(storedAttempt.name_one!=='Rishi'||storedAttempt.name_two!=='Maria'||storedAttempt.names_consent!==true)
    throw new Error('both names were not submitted with the calculation');
  await page.locator('#watchAgain').click();
  await page.locator('#strikeScene').waitFor({state:'visible'});
  if(research.filter(x=>x.method==='POST').length!==1)throw new Error('replay created a duplicate attempt');
  await page.locator('#skipSequence').evaluate(el=>{if(!el.closest('section').hidden)el.click()});await page.waitForFunction(()=>!document.querySelector('#eliminationScene').hidden||!document.querySelector('#resultScene').hidden);await page.locator('#skipElimination').evaluate(el=>{if(!el.closest('section').hidden)el.click()});
  await page.locator('#likedNo').click();
  await page.locator('#whatIfScene').waitFor({state:'visible'});
  await page.locator('#fullFirst').fill('Rishi Kumar');
  await page.locator('#fullSecond').fill('Maria Rose');
  await page.locator('#variationForm button[type="submit"]').click();
  if(!(await page.locator('#variationResults').textContent()).trim())
    throw new Error('variation explorer empty');
  if(!research.some(x=>x.method==='PATCH'&&x.body.wants_change===true))throw new Error('feedback was not associated with the attempt');
  await page.locator('#backToResult').click();
  await page.locator('#resultScene').waitFor({state:'visible'});
  await page.locator('#playAgain').click();
  await page.locator('#entryScene').waitFor({state:'visible'});
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  if(dims.scroll>dims.viewport+5)throw new Error('horizontal overflow '+JSON.stringify(dims));
  console.log('PASS '+width+'px: notice → names → strikes → FLAMES → replay dedupe → feedback → alternatives → restart');
  if(width===390)await page.screenshot({path:'flames-mobile.png',fullPage:true});
 }catch(error){
  fails++;console.error('FAIL '+width+'px: '+error.stack);
 }finally{await page.close()}
}
await browser.close();
if(fails)process.exit(1);
