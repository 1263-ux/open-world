import { describe, expect, it } from 'vitest';
import { wrapCJK } from '../../games/hks/src/wrapCJK';

describe('Hks displayed card and knowledge text wrapping',()=>{
  it.each([
    '单梁 20  CD 3.8s  射程 120',
    '首跳 5  CD 4.1s  搜敌范围 290',
    '每跳 3 伤害  CD 5s  范围 100  持续 4s',
    '命中回复木质结构 4 HP，持续 0.3 秒',
  ])('retains every character and keeps numeric values and units intact: %s',text=>{
    for(const capacity of [8,12,16,20]) {
      const wrapped=wrapCJK(text,'12px',capacity*12);
      expect(wrapped.replaceAll('\n','')).toBe(text);
      const tokens=text.match(/[+-]?\d+(?:\.\d+)?(?:[\t ]*(?:HP|px|ms|s|%|秒|次|米|点))?/gu) ?? [];
      for(const token of tokens)expect(wrapped).toContain(token);
    }
  });
  it('preserves explicit and blank lines and does not split decimals or adjacent units',()=>{
    const result=wrapCJK('第一行\n\n冷却 3.8s  回复 10 HP\n末行','12px',96);
    expect(result).toContain('\n\n');expect(result).toContain('3.8s');expect(result).toContain('10 HP');
    expect(result.replaceAll('\n','')).toBe('第一行冷却 3.8s  回复 10 HP末行');
  });
  it('retains CR, Unicode line and paragraph separators and supplementary characters',()=>{
    const text='甲\r\n乙\u2028丙\u2029丁\r戊😀';
    expect(wrapCJK(text,'12px',1200)).toBe(text);
    const wrapped=wrapCJK(text,'12px',24);
    expect(wrapped.replaceAll('\n','')).toBe(text.replaceAll('\n',''));
  });
  it('terminates on tiny widths without splitting a longer numeric token',()=>{
    expect(wrapCJK('射程 120','12px',12)).toContain('120');
    expect(wrapCJK('3.8s','12px',1)).toBe('3.8s');
    expect(wrapCJK('120','bad',100)).toBe('120');
  });
});
