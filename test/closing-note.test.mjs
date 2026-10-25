import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const markup=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styles=readFileSync(new URL('../privacy.css',import.meta.url),'utf8');

test('closing message celebrates living and kindness without promising a FLAMES prediction',()=>{
 assert.match(markup,/One life\. <em>So many moments worth sharing\.<\/em>/);
 assert.match(markup,/The loveliest stories grow at their own pace/);
 assert.match(markup,/love-letter-section/);
 assert.match(markup,/id="loveLetterTitle"/);
 assert.doesNotMatch(markup,/privacy, in plain words/i);
});
test('entry notice remains clear without duplicate footer privacy panel',()=>{
 assert.match(markup,/class="[^"]*entry-consent/);
 assert.match(markup,/both entered names/);
 assert.match(markup,/saved for testing/);
 assert.match(markup,/Names are kept up to 30 days/);
 assert.doesNotMatch(markup,/class="privacy-note"/);
 assert.doesNotMatch(markup,/href="#privacy"/);
 assert.doesNotMatch(styles,/\\.privacy-note/);
});
test('closing note is responsive and respects reduced motion',()=>{
 assert.match(styles,/@media\(max-width:540px\)/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(styles,/\.love-letter-section/);
});
