/** Dated official campus stories, not new quests or a claim that an event is current. */
export interface CampusStory { text: string; invitation: string; source: string; date: string }
export const CAMPUS_STORIES: Readonly<Record<string, CampusStory>> = {
  'hy-meihua': { text: '2026年5月，师生曾在梅花教室 M2 学习播种，再到碧园餐厅东侧种下百日菊。校园的绿意，也有同学们亲手参与的一份。', invitation: '看看教室与绿植如何相接；这里的模型花床不代表报道中的种植地点。', source: 'https://gongqingtuan.tyut.edu.cn/info/1019/32971.htm', date: '2026-05-29' },
  'hy-library': { text: '2023年迎新时，学校图书馆曾邀请同学在入学与毕业时，于同一地点留影；虎峪读者服务中心也参与了迎新。', invitation: '找一个你愿意多年后再次回来的位置。', source: 'https://www.lib.tyut.edu.cn/info/1274/2875.htm', date: '2023-09-05' },
  'hy-training': { text: '2025年“五育杯”篮球赛在虎峪训练馆收官。来自不同学院和校区的队伍，在这里把平日的练习变成比赛。', invitation: '从外侧看看训练馆的轮廓；本体验不提供室内球赛。', source: 'https://tyxy.tyut.edu.cn/info/1175/10344.htm', date: '2025-06-18' },
  'yx-mechanical': { text: '2024年11月，一场校园迷你马拉松从机械馆出发，又回到这里。它不只是工科建筑，也曾是一群人一起出发的地方。', invitation: '退后一点，让钟楼与两侧楼翼一起入镜。', source: 'https://mc.tyut.edu.cn/info/1060/9545.htm', date: '2024-11-15' },
  'yx-garden': { text: '2019年国际档案日期间，清泽园曾展出学校人物、实物与校园实景的档案图片。这里的树荫之外，也装过一段看得见的校史。', invitation: '给今天的园景留影；历史图片展并非当前正在举办的活动。', source: 'https://www.tyut.edu.cn/info/1026/13156.htm', date: '2019-06-10' },
  'yx-library': { text: '2026年5月，迎西图书馆举办材料学科书展，把教师著作、师生荐书与科研成果放在一起。书本里的问题，也能走向实验台。', invitation: '在外部停留片刻，想一个你愿意继续了解的材料问题。', source: 'https://lib.tyut.edu.cn/info/1275/7254.htm', date: '2026-05-16' },
};
