// A leaving page is still painted after its live source has gone. Give each
// copied definition its own identity, keeping every reference inside the copy.
const COPY_ID_PREFIX='bd-page-copy';
const COPY_STYLE_ATTRIBUTE='data-bd-page-copy-style';
const ID_REFERENCES=new Set([
 'for','form','list','headers','aria-labelledby','aria-describedby','aria-controls',
 'aria-owns','aria-activedescendant','aria-details','aria-errormessage','aria-flowto',
]);
let serial=0;
const decodedIdentifier=(value: string)=>value.replace(/\\([\da-f]{1,6}\s?|.)/gi,(_,escaped: string)=>
 /^[\da-f]/i.test(escaped)?String.fromCodePoint(parseInt(escaped.trim(),16)):escaped);

export function pageCopyReference(value: string,ids: ReadonlyMap<string,string>,documentUrl?: string): string {
 let fragment=value;
 if(!fragment.startsWith('#')) {
  if(!documentUrl)return value;
  try {
   const reference=new URL(value,documentUrl),document=new URL(documentUrl);
   fragment=reference.hash;reference.hash='';document.hash='';
   if(reference.href!==document.href)return value;
  }catch{return value;}
 }
 const id=ids.get(decodedIdentifier(fragment.slice(1)));
 return id?`#${id}`:value;
}
export function pageCopyUrls(value: string,ids: ReadonlyMap<string,string>,
 documentUrl?: string,baseUrl?: string): string {
 return value.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi,
  (original,double: string|undefined,single: string|undefined,bare: string|undefined)=>{
   const reference=(double??single??bare??'').trim();let resolved=reference;
   if(baseUrl&&!reference.startsWith('#')) {
    try {resolved=new URL(reference,baseUrl).href;}catch{/* Keep a non-URL CSS value unchanged. */}
   }
   const mapped=pageCopyReference(resolved,ids,documentUrl);
   return mapped===reference?original:`url("${mapped}")`;
  });
}
function selectors(value: string,ids: ReadonlyMap<string,string>) {
 for(const [id,replacement] of ids) {
  const escaped=CSS.escape(id).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  value=value.replace(new RegExp(`#${escaped}(?![\\w-])`,'g'),`#${replacement}`);
 }
 return value;
}
// Keep each selector branch's own specificity when adding a zero-specificity scope.
function selectorBranches(value: string) {
 const parts: string[]=[];let start=0,depth=0,quote='';
 for(let index=0;index<value.length;index++) {
  const character=value[index];
  if(character==='\\'){index++;continue;}
  if(quote){if(character===quote)quote='';continue;}
  if(character==='"'||character==="'"){quote=character;continue;}
  if(character==='('||character==='[')depth++;
  else if(character===')'||character===']')depth--;
  else if(character===','&&depth===0){parts.push(value.slice(start,index).trim());start=index+1;}
 }
 parts.push(value.slice(start).trim());return parts;
}
function pageCopyStyles(value: string,ids: ReadonlyMap<string,string>,roots: readonly string[],includeRoot=true) {
 const sheet=new CSSStyleSheet();
 sheet.replaceSync(pageCopyUrls(value,ids));
 const scope=`:where(${roots.map(id=>`#${CSS.escape(id)}`).join(',')})`;
 const selves=includeRoot?roots:roots.slice(1);
 const self=selves.length?`:where(${selves.map(id=>`#${CSS.escape(id)}`).join(',')})`:null;
 const visit=(rules: CSSRuleList,nested=false)=>{
  for(const rule of rules) {
   const styled=rule instanceof CSSStyleRule;
   if(styled) {
    const selector=selectors(rule.selectorText,ids);
    rule.selectorText=nested?selector:selectorBranches(selector)
     .flatMap(branch=>[...(self?[`${self}:is(${branch})`]:[]),`${scope} :is(${branch})`]).join(',');
   }
   if(rule instanceof CSSGroupingRule)visit(rule.cssRules,nested||styled);
  }
 };
 visit(sheet.cssRules);
 return [...sheet.cssRules].map(rule=>rule.cssText).join('\n');
}
function authoredPageStyles(document: Document) {
 const rulesText=(rules: CSSRuleList): string=>[...rules].map(rule=>{
  if(rule instanceof CSSStyleRule)return rule.cssText;
  if(rule instanceof CSSImportRule&&rule.styleSheet) {
   if(rule.layerName!=null||rule.supportsText!=null)return '';
   const text=read(rule.styleSheet);
   return rule.media.mediaText?`@media ${rule.media.mediaText}{${text}}`:text;
  }
  if(rule instanceof CSSGroupingRule) {
   const text=rulesText(rule.cssRules),opening=rule.cssText.slice(0,rule.cssText.indexOf('{'));
   return text?`${opening}{${text}}`:'';
  }
  return '';
 }).join('\n');
 const read=(sheet: CSSStyleSheet): string=>{
  let rules: CSSRuleList;
  try {rules=sheet.cssRules;}catch{return '';}
  const text=pageCopyUrls(rulesText(rules),new Map(),document.URL,sheet.href??document.baseURI);
  return sheet.media.mediaText?`@media ${sheet.media.mediaText}{${text}}`:text;
 };
 return [...document.styleSheets,...document.adoptedStyleSheets].filter(sheet=>!sheet.disabled&&
  !(sheet.ownerNode instanceof Element&&sheet.ownerNode.hasAttribute(COPY_STYLE_ATTRIBUTE))).map(read).join('\n');
}
function nextCopyId(document: Document) {
 let id: string;
 do {id=`${COPY_ID_PREFIX}-${++serial}`;} while(document.getElementById(id));
 return id;
}
// Pass the matching live source to retain appearance owned by outside CSS,
// including ID selectors that will no longer match after the copy is renamed.
// A constructed wrapper can keep its own layout while copying its source's children.
export function remapPageCopyIds(copy: HTMLElement,source?: HTMLElement,includeRoot=true): HTMLStyleElement|null {
 const nodes=[copy,...copy.querySelectorAll('*')],ids=new Map<string,string>();
 for(const node of nodes) {
  const id=node.getAttribute('id');
  if(!id)continue;
  const replacement=nextCopyId(copy.ownerDocument);
  if(!ids.has(id))ids.set(id,replacement);
  node.setAttribute('id',replacement);
 }
 if(source?.id&&!ids.has(source.id)) {
  if(!copy.id)copy.id=nextCopyId(copy.ownerDocument);
  ids.set(source.id,copy.id);
 }
 if(!ids.size)return null;
 if(!copy.id)copy.id=nextCopyId(copy.ownerDocument);
 const documentUrl=source?.ownerDocument.URL??copy.ownerDocument.URL;
 const referenced=new Set(nodes.filter(node=>node instanceof SVGElement&&node.localName==='use')
  .map(node=>pageCopyReference(node.getAttribute('href')??node.getAttribute('xlink:href')??'',
   ids,documentUrl).slice(1)));
 const reusable=nodes.filter(node=>node instanceof SVGElement&&referenced.has(node.id));
 const roots=[copy.id,...reusable.map(node=>node.id)];
 for(const node of nodes) {
  for(const attribute of [...node.attributes]) {
   if(attribute.name==='id')continue;
   let value=pageCopyUrls(attribute.value,ids,documentUrl);
   if(attribute.localName==='href')value=pageCopyReference(value,ids,documentUrl);
   if(ID_REFERENCES.has(attribute.name))value=value.split(/\s+/).map(id=>ids.get(id)??id).join(' ');
   if(value!==attribute.value)node.setAttributeNS(attribute.namespaceURI,attribute.name,value);
  }
  if(node.localName==='style') {
   node.textContent=pageCopyStyles(node.textContent??'',ids,roots,includeRoot);
   node.setAttribute(COPY_STYLE_ATTRIBUTE,'');
  }
 }
 if(source) {
  const style=copy.ownerDocument.createElement('style');
  style.setAttribute(COPY_STYLE_ATTRIBUTE,'');
  style.textContent=pageCopyStyles(authoredPageStyles(source.ownerDocument),ids,roots,includeRoot);
  return style;
 }
 return null;
}
