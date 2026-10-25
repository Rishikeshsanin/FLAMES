/**
 * Deterministic classic FLAMES algorithm. No network access or tracking.
 * Match letter graphemes one-to-one and expose paired positions for the UI.
 */
export const OUTCOMES = Object.freeze({
  F: 'Friends', L: 'Love', A: 'Affection',
  M: 'Marriage', E: 'Enemies', S: 'Siblings'
});

const graphemes = new Intl.Segmenter('und', {granularity:'grapheme'});

export function tokenizeName(input) {
  if (typeof input !== 'string') throw new TypeError('Name must be a string');
  const tokens = [];
  let graphemeIndex = 0;
  for (const {segment, index} of graphemes.segment(input.normalize('NFC'))) {
    if (/^\p{L}/u.test(segment)) {
      tokens.push({letter:segment.toLowerCase().normalize('NFC'), index:graphemeIndex, offset:index});
    }
    graphemeIndex++;
  }
  return tokens;
}

export function calculateFlames(name1, name2) {
  const left=tokenizeName(name1), right=tokenizeName(name2);
  if (!left.length || !right.length) {
    return {status:'invalid-input', reason:'both-names-must-contain-letters',
      pairs:[], unmatchedLeft:[], unmatchedRight:[], remainingCount:0,
      elimination:[], letter:null, result:null};
  }
  const availableRight=new Map();
  right.forEach((token, rightIndex) => {
    const queue=availableRight.get(token.letter) ?? [];
    queue.push(rightIndex);
    availableRight.set(token.letter, queue);
  });
  const usedRight=new Set(), pairs=[], unmatchedLeft=[];
  left.forEach((token,leftIndex)=>{
    const queue=availableRight.get(token.letter);
    if (queue?.length) {
      const rightIndex=queue.shift();
      usedRight.add(rightIndex);
      pairs.push({letter:token.letter,leftIndex,rightIndex,
        leftGraphemeIndex:token.index,rightGraphemeIndex:right[rightIndex].index});
    } else unmatchedLeft.push({...token,tokenIndex:leftIndex});
  });
  const unmatchedRight=right.flatMap((token,tokenIndex)=>
    usedRight.has(tokenIndex)?[]:[{...token,tokenIndex}]);
  const remainingCount=unmatchedLeft.length+unmatchedRight.length;
  if (remainingCount===0) {
    return {status:'no-unmatched-letters',reason:'zero-count',pairs,
      unmatchedLeft,unmatchedRight,remainingCount,elimination:[],letter:null,result:null};
  }
  const survivors=Object.keys(OUTCOMES), elimination=[];
  let cursor=0;
  while (survivors.length>1) {
    cursor=(cursor+remainingCount-1)%survivors.length;
    const before=[...survivors];
    const [removed]=survivors.splice(cursor,1);
    elimination.push({round:elimination.length+1,before,removed,
      after:[...survivors],countedPosition:cursor});
  }
  const letter=survivors[0];
  return {status:'ok',reason:null,pairs,unmatchedLeft,unmatchedRight,
    remainingCount,elimination,letter,result:OUTCOMES[letter]};
}

/** Only genuine user-supplied names are considered, never invented spellings. */
export function nameVariants(original,fullName='',nicknames=[]) {
  const candidates=[{name:original,source:'original'}];
  if (typeof fullName==='string' && fullName.trim()) {
    const parts=fullName.trim().split(/\s+/u);
    candidates.push({name:parts.join(' '),source:'full-name'});
    if (parts.length>1) {
      candidates.push({name:parts[0],source:'first-name'});
      candidates.push({name:parts[0]+' '+parts.at(-1),source:'first-last'});
    }
  }
  for (const name of nicknames.slice(0,10)) {
    if (typeof name==='string' && name.trim())
      candidates.push({name:name.trim(),source:'nickname'});
  }
  const seen=new Set();
  return candidates.filter(({name})=>{
    const key=tokenizeName(name).map(x=>x.letter).join('|');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function exploreAlternatives(personA,personB,desiredLetter=null) {
  if (desiredLetter!==null && !Object.hasOwn(OUTCOMES,desiredLetter))
    throw new RangeError('Unknown FLAMES outcome');
  const a=nameVariants(personA.original,personA.fullName,personA.nicknames??[]);
  const b=nameVariants(personB.original,personB.fullName,personB.nicknames??[]);
  const combinations=[];
  for (const left of a) for (const right of b) {
    const outcome=calculateFlames(left.name,right.name);
    combinations.push({left,right,status:outcome.status,letter:outcome.letter,
      result:outcome.result,remainingCount:outcome.remainingCount});
  }
  return {combinations,matching:desiredLetter===null?combinations:
    combinations.filter(x=>x.letter===desiredLetter)};
}
