export const LETTER = Object.freeze([
 '你好，邮差。','谢谢你带它去看了云。','我以前总觉得，小鱼一定很无聊。',
 '每次放学回来，我都会给它讲今天发生的事情。','今天下雨了，我想，如果它也能出去看看就好了。',
 '后来我发现，其实它一直都在认真听。','谢谢你陪它度过了一个下午。','明天放学，我还会给它讲故事的。',''
]);
export function fullLetterCues(facts) {
 const shots=['letter','cloud-transit','actual-fold','fish-attention','actual-fold',facts.cloudStationarySeconds>0?'fish-quiet-observed':'cloud-transit','cloud-transit','child-attaches-sky-drawing','office-keeps-drawing'];
 const durations=[4,6,6,7,7,7,6,7,3];
 return LETTER.map((text,i)=>({id:`V-LETTER-${String(i+1).padStart(2,'0')}`,text,shot:shots[i],seconds:durations[i],voice:null,captionMode:'temporary-full-letter-subtitles',memoryKind:i===3||i===7?'authored-story':i===5&&facts.cloudStationarySeconds>0?'observed-quiet-fish-not-seated-reenactment':'authored-staging-of-mainline',note:i===6?'Fictional story afternoon, no real-time dwell requirement':null}));
}
