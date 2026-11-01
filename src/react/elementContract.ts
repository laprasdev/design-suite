// A view's DOM contract: the class it renders and the selector checks use for it.
export interface ElementContract {
 readonly className: string;
 readonly selector: string;
}
export const element=(className: string)=>Object.freeze({className,selector:`.${className}`});
