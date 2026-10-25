import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFlames, tokenizeName, OUTCOMES, nameVariants, exploreAlternatives } from '../engine.mjs';
const check=(a,b)=>calculateFlames(a,b);

test('formatting changes outcome neither count nor result; animation indices still reflect typed letters',()=>{
  const a=check('  A-l ! e x 99','maria'), b=check('Alex','maria');
  assert.equal(a.letter,b.letter);
  assert.equal(a.remainingCount,b.remainingCount);
  assert.notEqual(a.pairs[0].leftGraphemeIndex,b.pairs[0].leftGraphemeIndex);
});

test('Unicode canonical composition and positions',()=>{
  assert.deepEqual(tokenizeName('É & e\u0301'),tokenizeName('E\u0301 & é'));
  assert.deepEqual(tokenizeName('A - B').map(x=>x.index),[0,4]);
});

test('invalid names produce no fabricated outcome',()=>{
  for (const value of ['',' !!! ','123'])
    assert.equal(check(value,'Alex').status,'invalid-input');
});

test('all letters cancel: zero is explicit, not a fake outcome',()=>{
  const r=check('Alex','alex');
  assert.equal(r.status,'no-unmatched-letters');
  assert.equal(r.result,null);
  assert.equal(r.pairs.length,4);
});

test('repeated characters cancel one-to-one',()=>{
  const r=check('aaabb','aab');
  assert.deepEqual(r.pairs.map(x=>x.letter),['a','a','b']);
  assert.equal(r.remainingCount,2);
  assert.equal(r.unmatchedLeft.length,2);
  assert.equal(r.unmatchedRight.length,0);
});

test('disjoint names leave all letters',()=>{
  const r=check('abc','xyz');
  assert.equal(r.pairs.length,0);
  assert.equal(r.remainingCount,6);
});

test('exactly five eliminations yield the valid final letter',()=>{
  for (const [a,b] of [['Alex','Maria'],['Rishi','Harini'],['abcdef','xyz'],['a','bb']]) {
    const r=check(a,b);
    assert.equal(r.status,'ok');
    assert.equal(r.elimination.length,5);
    assert.equal(new Set(r.elimination.map(x=>x.removed)).size,5);
    assert.equal(r.result,OUTCOMES[r.letter]);
  }
});

test('swapping the two names preserves the result',()=>{
  const names=['Alice','Bob','Priya','Rahul','Mira','Noah','Ananya','Rishi','Élodie'];
  for (const a of names) for (const b of names) {
    assert.equal(check(a,b).remainingCount,check(b,a).remainingCount);
    assert.equal(check(a,b).letter,check(b,a).letter);
  }
});

test('full names and nicknames are not fabricated or duplicated',()=>{
  const variants=nameVariants('Rishi','Rishi Kumar Reddy',['Rishi','Rish','Rish']);
  assert.deepEqual(variants.map(x=>x.name),
    ['Rishi','Rishi Kumar Reddy','Rishi Reddy','Rish']);
});

test('desired result merely filters genuine alternatives',()=>{
  const x=exploreAlternatives(
    {original:'Alex',fullName:'Alex Miller',nicknames:['Lex']},
    {original:'Maria',fullName:'Maria Rose',nicknames:['Mia']},'L');
  assert.ok(x.combinations.length>1);
  assert.ok(x.matching.every(c=>c.letter==='L'));
  assert.ok(x.combinations.every(c=>c.letter===check(c.left.name,c.right.name).letter));
  assert.throws(()=>exploreAlternatives({original:'A'},{original:'B'},'Z'),RangeError);
});

test('25,000 seeded random name pairs satisfy cancellation and animation invariants',()=>{
  let seed=0x5f3759df;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const letters='aaabbbcdefghijklmno';
  const name=()=>Array.from({length:1+Math.floor(rand()*22)},
    ()=>letters[Math.floor(rand()*letters.length)]).join('');
  for(let k=0;k<25000;k++) {
    const a=name(),b=name(),r=check(a,b);
    const size=tokenizeName(a).length+tokenizeName(b).length;
    assert.equal(r.remainingCount,size-2*r.pairs.length);
    assert.equal(new Set(r.pairs.map(x=>x.leftIndex)).size,r.pairs.length);
    assert.equal(new Set(r.pairs.map(x=>x.rightIndex)).size,r.pairs.length);
    assert.equal(r.unmatchedLeft.length+r.unmatchedRight.length,r.remainingCount);
    assert.equal(r.letter,check(b,a).letter);
    assert.equal(r.letter,check(a,b).letter);
    if (r.status==='ok') {
      assert.equal(r.elimination.length,5);
      let remaining=['F','L','A','M','E','S'];
      for(const step of r.elimination) {
        assert.deepEqual(step.before,remaining);
        assert.equal(remaining[step.countedPosition],step.removed);
        remaining=remaining.filter(x=>x!==step.removed);
        assert.deepEqual(step.after,remaining);
      }
      assert.equal(remaining[0],r.letter);
    } else assert.equal(r.status,'no-unmatched-letters');
  }
});

test('independent slow circular counting agrees for unmatched counts 1..200',()=>{
  function reference(count) {
    const active=['F','L','A','M','E','S'];
    let index=0;
    while(active.length>1) {
      for(let i=1;i<count;i++) index=(index+1)%active.length;
      active.splice(index,1);
      index%=active.length;
    }
    return active[0];
  }
  for(let count=1;count<=200;count++) {
    const result=count===1?check('aa','a'):check('a'.repeat(count-1),'b');
    assert.equal(result.remainingCount,count);
    assert.equal(result.letter,reference(count));
  }
});
