import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJourney, journeyStage, recordJourneyFlight, recordJourneyPhoto } from '../../src/games/journey';
import { JOURNEY_STORAGE_KEY, loadJourney, parseJourney, saveJourney } from '../../src/games/journey-storage';
import { loadPhotoStamps, savePhotoStamps } from '../../src/games/photography';
const completePhotos=()=>['hall','garden','platform'].reduce(recordJourneyPhoto,createJourney('test'));
afterEach(()=>vi.unstubAllGlobals());
describe('current run journal and compatible storage',()=>{
  it('requires current photos then successful flight; retry cannot erase photos',()=>{
    let state=createJourney('test');expect(journeyStage(state)).toBe('hall');
    expect(recordJourneyFlight(state,{success:true,score:20})).toBe(state);
    state=completePhotos();expect(journeyStage(state)).toBe('flight');
    expect(recordJourneyFlight(state,{success:false,score:20})).toBe(state);
    state=recordJourneyFlight(state,{success:true,score:20});expect(journeyStage(state)).toBe('complete');
    expect(recordJourneyFlight(state,{success:true,score:25}).bestFlight).toBe(20);
    expect(createJourney('restart')).toMatchObject({photos:[],flightCompleted:false,bestFlight:null});
  });
  it('deduplicates allowed photos, accepts out of order, rejects invalid scores',()=>{
    const state=recordJourneyPhoto(createJourney('test'),'platform');expect(journeyStage(state)).toBe('hall');
    expect(recordJourneyPhoto(state,'platform')).toBe(state);expect(recordJourneyPhoto(state,'unknown')).toBe(state);
    const ready=completePhotos();for(const score of [0,-1,NaN,Infinity,121])expect(recordJourneyFlight(ready,{success:true,score})).toBe(ready);
  });
  it('roundtrips only its own key and never writes pixels or old quest/photo keys',()=>{
    const map=new Map<string,string>([['campus-atlas:quests','old'],['campus-atlas:photo-stamps:v1','["hall","garden"]']]);
    const port={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);}};
    const state=recordJourneyFlight(completePhotos(),{success:true,score:22});expect(saveJourney(state,port)).toBe(true);expect(loadJourney(port)).toEqual(state);
    expect(map.size).toBe(3);expect(map.get('campus-atlas:quests')).toBe('old');expect(map.get('campus-atlas:photo-stamps:v1')).toBe('["hall","garden"]');
    expect(map.get(JOURNEY_STORAGE_KEY)).not.toMatch(/data:image|position|velocity/);
  });
  it('preserves old photo IDs but historical stamps cannot finish a fresh run',()=>{
    const setItem=vi.fn();vi.stubGlobal('localStorage',{getItem:()=> '["hall","garden","obsolete","hall"]',setItem});
    expect(loadPhotoStamps()).toEqual(['hall','garden']);savePhotoStamps(['garden','hall','obsolete']);
    expect(setItem).toHaveBeenCalledWith('campus-atlas:photo-stamps:v1','["hall","garden"]');
    expect(journeyStage(createJourney('new'))).toBe('hall');expect(loadJourney({getItem:()=>null,setItem})).toBeNull();
  });
  it('rejects future versions, malformed schema and malicious numeric values',()=>{
    const state=createJourney('test');for(const patch of [{version:2},{sessionId:'../bad'},{checkpoint:'roof'},{photos:null},{bestFlight:NaN},{bestFlight:Infinity},{bestFlight:-1},{flightCompleted:'true'},{tutorialSeen:1}])expect(parseJourney({...state,...patch})).toBeNull();
    expect(parseJourney(null)).toBeNull();expect(parseJourney('bad')).toBeNull();
    expect(parseJourney({...state,photos:['hall','hall','unknown'],flightCompleted:true,bestFlight:20})).toMatchObject({photos:['hall'],flightCompleted:false});
  });
  it('degrades to memory on malformed JSON, unavailable storage and denied/quota access',()=>{
    const denied={getItem:()=>{throw new DOMException('denied','SecurityError');},setItem:()=>{throw new DOMException('quota','QuotaExceededError');}};
    expect(loadJourney(denied)).toBeNull();expect(saveJourney(createJourney('test'),denied)).toBe(false);
    expect(loadJourney({getItem:()=>'{bad',setItem:()=>{}})).toBeNull();expect(saveJourney(createJourney('test'),null)).toBe(false);
    vi.stubGlobal('localStorage',denied);expect(loadPhotoStamps()).toEqual([]);expect(()=>savePhotoStamps(['hall'])).not.toThrow();
  });
});
