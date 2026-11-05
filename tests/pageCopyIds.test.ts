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

test('computed absolute URLs remap only definitions in the same document',()=>{
 const document='https://example.test/workspace?view=page#current';
 assert.equal(pageCopyUrls('url("https://example.test/workspace?view=page#paint")',ids,document),
  'url("#copy-paint")');
 const other='url("https://example.test/workspace?view=other#paint")';
 assert.equal(pageCopyUrls(other,ids,document),other);
 assert.equal(pageCopyUrls('url("https://example.test/art.svg#paint")',ids,document),
  'url("https://example.test/art.svg#paint")');
});

test('copied authored stylesheet assets retain their stylesheet-relative location',()=>{
 assert.equal(pageCopyUrls('fill:url(#paint);background:url(../art/tile.svg)',ids,
  'https://example.test/page','https://example.test/styles/theme.css'),
  'fill:url("#copy-paint");background:url("https://example.test/art/tile.svg")');
 assert.equal(pageCopyUrls('fill:url(page#paint)',ids,'https://example.test/app/page',
  'https://example.test/styles/theme.css'),'fill:url("https://example.test/styles/page#paint")');
});
