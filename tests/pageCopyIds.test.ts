import test from 'node:test';
import assert from 'node:assert/strict';
import {pageCopyReference,pageCopyUrls} from '../src/react/pageCopyIds.ts';

const ids=new Map([['paint','copy-paint'],['clip','copy-clip'],[':react:','copy-react']]);

test('clone-local paint, clip and mask URLs keep their references',()=>{
 assert.equal(pageCopyUrls('fill:url(#paint);clip-path:url("#clip");mask:url(\'#paint\')',ids),
  'fill:url("#copy-paint");clip-path:url("#copy-clip");mask:url("#copy-paint")');
 assert.equal(pageCopyUrls('url(#\\:react\\:)',ids),'url("#copy-react")');
 assert.equal(pageCopyUrls('url(#\\70 aint)',ids),'url("#copy-paint")');
});

test('SVG href references change only when the copied subtree owns the definition',()=>{
 assert.equal(pageCopyReference('#paint',ids),'#copy-paint');
 assert.equal(pageCopyReference('#outside',ids),'#outside');
 assert.equal(pageCopyReference('https://example.test/art.svg#paint',ids),'https://example.test/art.svg#paint');
});

test('external assets, colors and unknown paint references remain unchanged',()=>{
 const value='color:#fff;background:url(https://example.test/art.svg#paint);fill:url(#outside)';
 assert.equal(pageCopyUrls(value,ids),value);
});
