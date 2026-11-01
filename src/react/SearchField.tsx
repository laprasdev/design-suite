import {forwardRef,type InputHTMLAttributes} from 'react';
import {searchCopy} from './interfaceCopy.ts';

// The subject is the only placeholder input; labels can name a narrower context.
// A search's subject (its placeholder), its narrower label, its text and its density.
export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>,'onChange'|'value'> {
 subject: string;
 label?: string;
 value: string;
 onChange(value: string): void;
 density?: string;
}
export const SearchField=forwardRef<HTMLInputElement,SearchFieldProps>(function SearchField({subject,label,value,onChange,className='',density,...props},ref) {
 const placeholder=searchCopy.placeholder(subject);
 return <input {...props} ref={ref} data-density={density} className={`search-field ${className}`} type="search" aria-label={label||placeholder} placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>;
});
