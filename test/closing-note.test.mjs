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
test('storage notice stays discoverable and accessible',()=>{
 assert.match(markup,/class="entry-consent"/);
 assert.match(markup,/href="#privacy"/);
 assert.match(markup,/<details class="privacy-note" id="privacy">/);
 assert.match(markup,/<summary>♡ how your names are stored/);
 assert.match(markup,/Names expire after 30 days/);
});
test('closing note is responsive and respects reduced motion',()=>{
 assert.match(styles,/@media\(max-width:540px\)/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(styles,/\.love-letter-section/);
});
