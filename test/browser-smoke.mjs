import { chromium } from 'playwright';
import { calculateFlames } from '../engine.mjs';

const base='http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let fails=0;
for(const width of [320,390,768,1366]){
 const page=await browser.newPage({viewport:{width,height:820},reducedMotion:'reduce'});
 try{
  const res=await page.goto(base,{waitUntil:'domcontentloaded'});
  if(res.status()!==200)throw new Error('page HTTP '+res.status());
  await page.locator('#firstName').fill('Rishi');
  await page.locator('#secondName').fill('Maria');
  await page.locator('#speed').selectOption('quick');
  await page.locator('#nameForm button[type="submit"]').click();
  await page.locator('#strikeScene').waitFor({state:'visible'});
  const actual=calculateFlames('Rishi','Maria');
  const pairLabels=page.locator('#strikeCount');
  if(!(await pairLabels.textContent()).includes('/ '+actual.pairs.length+' pairs'))
   throw new Error('strike pair count wrong');
  await page.waitForTimeout(200);
  await page.locator('#skipSequence').click();
  await page.locator('#eliminationScene').waitFor({state:'visible'});
  await page.locator('#skipElimination').click();
  await page.locator('#resultScene').waitFor({state:'visible'});
  const result=await page.locator('#resultTitle').textContent();
  if(result!==actual.result)throw new Error('result mismatch: '+result+' expected '+actual.result);
  await page.locator('#likedNo').click();
  await page.locator('#whatIfScene').waitFor({state:'visible'});
  await page.locator('#fullFirst').fill('Rishi Kumar');
  await page.locator('#fullSecond').fill('Maria Rose');
  await page.locator('#variationForm button[type="submit"]').click();
  if(!(await page.locator('#variationResults').textContent()).trim())
    throw new Error('variation explorer empty');
  await page.locator('#backToResult').click();
  await page.locator('#resultScene').waitFor({state:'visible'});
  await page.locator('#playAgain').click();
  await page.locator('#entryScene').waitFor({state:'visible'});
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  if(dims.scroll>dims.viewport+5)throw new Error('horizontal overflow '+JSON.stringify(dims));
  console.log('PASS '+width+'px: names → strikes → FLAMES → result → alternatives → restart');
  if(width===390)await page.screenshot({path:'flames-mobile.png',fullPage:true});
 }catch(error){
  fails++;console.error('FAIL '+width+'px: '+error.stack);
 }finally{await page.close()}
}
await browser.close();
if(fails)process.exit(1);
