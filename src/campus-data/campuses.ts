import type { CampusData, CampusId } from '../shared/contracts';
const source = 'https://www.tyut.edu.cn/xxgk1/xydl.htm';
export const campuses: Record<CampusId, CampusData> = {
  huyu: { id: 'huyu', name: '虎峪校区', englishName: 'HUYU CAMPUS', description: '从北门出发，沿着书香与课堂的线索，发现校园的小故事。', questOrder: ['hy-north-gate','hy-library','hy-meihua'], landmarks: [
    { id:'hy-north-gate',name:'北门',subtitle:'探索从这里开始',position:[0,-22],size:[12,5,3],shape:'gate',color:'#d6a47c',facts:'虎峪校区北门名称有官方资料依据。当前门楼造型为原创占位，外观与尺寸尚待照片校准。',source:'https://www.tyut.edu.cn/xxgk1/xydl.htm',status:'schematic'},
    { id:'hy-library',name:'图书馆',subtitle:'给知识一个坐标',position:[3,0],size:[11,8,8],shape:'library',color:'#c87056',facts:'官方虎峪校园示意图标注图书馆。此处位置关系用于体验原型，不提供精确导航。',source,status:'schematic'},
    { id:'hy-meihua',name:'梅花教室',subtitle:'在课堂旁停留片刻',position:[-13,1],size:[8,5,8],shape:'teaching',color:'#d7b88a',facts:'梅花教室见学校公开校园图。本轮简化体块不是建筑外观的精确复原。',source,status:'schematic'},
  ]},
  yingxi: { id:'yingxi',name:'迎西校区',englishName:'YINGXI CAMPUS',description:'由南侧入口走向清泽园，在建筑与绿意之间收集校园印象。',questOrder:['yx-south-gate','yx-office','yx-garden'],landmarks:[
    {id:'yx-south-gate',name:'南侧入口',subtitle:'迎泽西大街一侧',position:[0,22],size:[12,5,3],shape:'gate',color:'#cba582',facts:'学校校园图显示迎泽西大街一侧入口。这里采用“南侧入口”描述，门名与现场细节待核验。',source,status:'schematic'},
    {id:'yx-office',name:'办公楼',subtitle:'校园轴线上的一站',position:[0,9],size:[12,6,6],shape:'office',color:'#d18b66',facts:'办公楼名称与大致相对位置参考学校公开校园图，尺寸及外观尚未现场核实。',source,status:'schematic'},
    {id:'yx-garden',name:'清泽园',subtitle:'把一段时间留给绿意',position:[0,-5],size:[12,1,10],shape:'garden',color:'#799a78',facts:'清泽园见官方校园图。园林与树木为原创程序化示意，不是实测布置。',source,status:'schematic'},
    {id:'yx-mechanical',name:'机械馆',subtitle:'另一种校园记忆',position:[-15,-5],size:[8,7,10],shape:'teaching',color:'#c5b199',facts:'机械馆名称参考官方校园示意图。模型仅表达位置与体量，不代表准确建筑风貌。',source,status:'schematic'},
  ]},
};
