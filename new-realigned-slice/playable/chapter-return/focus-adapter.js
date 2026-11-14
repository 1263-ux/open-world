// Opt-in adapter around the real presentation. No host state or scene mutation.
export function installReturnAccessibility({ui,host,doc=document,win=window,fallback=()=>doc.querySelector('#sound-toggle')}){
 const {echo,skip,caption,label}=ui.elements;let active=false,previous=null,pending=false;const isolation=new Map();
 echo.setAttribute('role','dialog');echo.setAttribute('aria-modal','true');label.id ||= 'chapter-return-label';echo.setAttribute('aria-labelledby',label.id);caption.setAttribute('aria-live','polite');caption.setAttribute('aria-atomic','true');
 const usable=e=>!!e&&e.isConnected!==false&&!e.disabled&&!e.hidden&&!e.closest?.('[hidden],[inert]')&&e.getClientRects().length>0;
 const focused=()=>!doc.hidden&&doc.hasFocus();
 const controls=()=>[...echo.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(usable);
 function isolate(){for(let branch=echo;branch&&branch!==doc.body;branch=branch.parentElement){const parent=branch.parentElement;if(!parent)break;for(const sibling of parent.children){if(sibling===branch||isolation.has(sibling))continue;isolation.set(sibling,sibling.inert);sibling.inert=true;}}}
 function restoreIsolation(){for(const [node,value] of isolation)node.inert=value;isolation.clear();}
 function enterFocus(){if(active&&focused()){const target=controls()[0]??(usable(skip)?skip:null);if(target){target.focus({preventScroll:true});pending=false;}}}
 function update(){const next=host.snapshot().owner==='echo';if(next&&!active){previous=doc.activeElement;active=true;pending=true;isolate();enterFocus();}else if(!next&&active){active=false;pending=false;restoreIsolation();if(focused()){const target=usable(previous)?previous:fallback();if(usable(target))target.focus({preventScroll:true});}previous=null;}else if(next&&active){isolate();if(pending)enterFocus();}}
 function key(e){if(!active||host.snapshot().owner!=='echo'||!focused())return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();host.skip();return;}if(e.key!=='Tab')return;const list=controls();if(!list.length){e.preventDefault();return;}const i=list.indexOf(doc.activeElement);if(i<0||(e.shiftKey&&i===0)||(!e.shiftKey&&i===list.length-1)){e.preventDefault();(e.shiftKey?list.at(-1):list[0]).focus({preventScroll:true});}}
 function focus(){if(pending)enterFocus();}doc.addEventListener('keydown',key,true);win.addEventListener('focus',focus);
 return{update,dispose(){doc.removeEventListener('keydown',key,true);win.removeEventListener('focus',focus);restoreIsolation();active=false;pending=false;previous=null;}};
}
