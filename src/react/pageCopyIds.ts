// A leaving page is still painted after its live source has gone. Give each
// copied definition its own identity, keeping every reference inside the copy.
const COPY_ID_PREFIX='bd-page-copy';
const ID_REFERENCES=new Set([
 'for','form','list','headers','aria-labelledby','aria-describedby','aria-controls',
 'aria-owns','aria-activedescendant','aria-details','aria-errormessage','aria-flowto',
]);
let serial=0;
const decodedIdentifier=(value: string)=>value.replace(/\\([\da-f]{1,6}\s?|.)/gi,(_,escaped: string)=>
 /^[\da-f]/i.test(escaped)?String.fromCodePoint(parseInt(escaped.trim(),16)):escaped);

export function pageCopyReference(value: string,ids: ReadonlyMap<string,string>): string {
 if(!value.startsWith('#'))return value;
 const id=ids.get(decodedIdentifier(value.slice(1)));
 return id?`#${id}`:value;
}
export function pageCopyUrls(value: string,ids: ReadonlyMap<string,string>): string {
 return value.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi,
  (original,double: string|undefined,single: string|undefined,bare: string|undefined)=>{
   const reference=(double??single??bare??'').trim(),mapped=pageCopyReference(reference,ids);
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
function pageCopyStyles(value: string,ids: ReadonlyMap<string,string>,rootId: string) {
 const sheet=new CSSStyleSheet();
 sheet.replaceSync(pageCopyUrls(value,ids));
 const scope=`:where(#${CSS.escape(rootId)})`;
 const visit=(rules: CSSRuleList,nested=false)=>{
  for(const rule of rules) {
   const styled=rule instanceof CSSStyleRule;
   if(styled) {
    const selector=selectors(rule.selectorText,ids);
    rule.selectorText=nested?selector:`${scope}:is(${selector}), ${scope} :is(${selector})`;
   }
   if(rule instanceof CSSGroupingRule)visit(rule.cssRules,nested||styled);
  }
 };
 visit(sheet.cssRules);
 return [...sheet.cssRules].map(rule=>rule.cssText).join('\n');
}
function nextCopyId(document: Document) {
 let id: string;
 do {id=`${COPY_ID_PREFIX}-${++serial}`;} while(document.getElementById(id));
 return id;
}
export function remapPageCopyIds(copy: HTMLElement) {
 const nodes=[copy,...copy.querySelectorAll('*')],ids=new Map<string,string>();
 for(const node of nodes) {
  const id=node.getAttribute('id');
  if(!id)continue;
  const replacement=nextCopyId(copy.ownerDocument);
  if(!ids.has(id))ids.set(id,replacement);
  node.setAttribute('id',replacement);
 }
 if(!ids.size)return;
 if(!copy.id)copy.id=nextCopyId(copy.ownerDocument);
 for(const node of nodes) {
  for(const attribute of [...node.attributes]) {
   if(attribute.name==='id')continue;
   let value=pageCopyUrls(attribute.value,ids);
   if(attribute.localName==='href')value=pageCopyReference(value,ids);
   if(ID_REFERENCES.has(attribute.name))value=value.split(/\s+/).map(id=>ids.get(id)??id).join(' ');
   if(value!==attribute.value)node.setAttributeNS(attribute.namespaceURI,attribute.name,value);
  }
  if(node.localName==='style')node.textContent=pageCopyStyles(node.textContent??'',ids,copy.id);
 }
}
