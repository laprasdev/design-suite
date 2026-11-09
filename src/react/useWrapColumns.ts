import {useLayoutEffect,useState,type RefObject} from 'react';

/** The columns of a wrapping grid of `count` cells: as many as fit, then evened so no row is left short. */
export function evenColumns(count: number,width: number,cell: number,gap: number) {
  const fitting=Math.max(1,Math.floor((width+gap)/(cell+gap)));
  return Math.ceil(count/Math.ceil(count/fitting));
}

/**
 * The columns that make the grid's cells closest to square in `width` by `height`: only counts that divide `count` are
 * tried, so every row is full, and more rows only while each stays at least `cell` tall. A frame whose height holds
 * none of them keeps the evened columns above.
 */
export function squarestColumns(count: number,width: number,height: number,cell: number,gap: number) {
  const even=evenColumns(count,width,cell,gap),fewest=Math.ceil(count/even);
  let best=even,bestSkew=Infinity;
  for(let rows=fewest;rows<=count;rows++){
    if(count%rows!==0)continue;
    const columns=count/rows;
    const cellWidth=(width-(columns-1)*gap)/columns,cellHeight=(height-(rows-1)*gap)/rows;
    if(cellWidth<cell||cellHeight<cell)break;
    const skew=Math.abs(Math.log(cellWidth/cellHeight));
    if(skew<bestSkew){best=columns;bestSkew=skew;}
  }
  return best;
}

/**
 * The column count of the wrapping grid that is `frame`, kept as its size changes; undefined until measured. The gap
 * is the frame's own computed column gap, the one its CSS lays the cells and sizes the glyphs by.
 */
export function useWrapColumns(frame: RefObject<HTMLElement|null>,count: number,cell: number) {
  const [columns,setColumns]=useState<number>();
  useLayoutEffect(()=>{
    const node=frame.current;
    if(!node)return;
    const measure=()=>{
      const gap=parseFloat(getComputedStyle(node).columnGap);
      setColumns(squarestColumns(count,node.clientWidth,node.clientHeight,cell,gap));
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(node);
    return()=>observer.disconnect();
  },[frame,count,cell]);
  return columns;
}
