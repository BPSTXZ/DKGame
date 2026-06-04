export const heroConfig = [
  {
    id: 'vampire', name: '吸血鬼', class: 'Vampire', iconColor: '#8b0000',
    quote: '"鲜血...才是最甜美的琼浆。"',
    traits: '狡诈、嗜血 | 消耗战与强力黏附',
    stats: 'HP: 100 | 移速: 55',
    skill: { name: '尖牙吸附', desc: '碰撞时黏附敌人持续吸血并减速，残血时吸血效率翻倍。觉醒：发射多枚追踪尖牙，倍增吸血效率。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/vampire/吸血鬼笑.mp3',
    isSpecial: false
  },
  {
    id: 'spider', name: '蜘蛛', class: 'Spider', iconColor: '#767cdf',
    quote: '"落入我的网中，你就无处可逃了。"',
    traits: '敏捷、阴险 | 远程控制与拉扯风筝',
    stats: 'HP: 80 | 移速: 30',
    skill: { name: '蛛丝束缚', desc: '周期性向周围粘黏蛛网，触碰后造成减速控制。觉醒：获得短暂无敌并暴增移速。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/spider/蜘蛛侠.mp3',
    isSpecial: false
  },
  {
    id: 'berserker', name: '狂战士', class: 'Berserker', iconColor: '#8b4513',
    quote: '"我的双斧，渴望着杀戮！"',
    traits: '狂暴、鲁莽 | 近战爆发与大范围伤害',
    stats: 'HP: 120 | 移速: 60 | 转速: 20',
    skill: { name: '旋风斩', desc: '挥舞双斧旋转，斧刃造成全额伤害，斧柄造成半额伤害，附带减速。扣血将转换为属性提升。觉醒：双斧攻击范围、转速与移速暴增。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/berserker/狂战士.mp3',
    isSpecial: false
  },
  {
    id: 'gambler', name: '赌徒', class: 'Gambler', iconColor: '#2e8b57',
    quote: '"命运的轮盘，今天会停在哪里？"',
    traits: '莫测、高风险 | 概率爆发与追踪连击',
    stats: 'HP: 100 | 移速: 65',
    skill: { name: '命运骰子', desc: '投掷骰子发射同点数追踪卡牌，连续同点数可倍增卡牌量。点数6额外附带减速。觉醒：下三次骰子点数必为6。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/Gambler/我要验牌.mp3',
    isSpecial: false
  },
  {
    id: 'malaoshi', name: '马老师', class: 'MaLaoshi', iconColor: '#cccccc',
    quote: '"年轻人不讲武德，来，骗！来，偷袭！"',
    traits: '宗师、化劲 | 多段弹幕与全屏控制',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '混元太极', desc: '每1.5秒发射松果糖豆。阶段性掉血时释放全图混元劲击退敌人。觉醒：触发闪电五连鞭，必中且高额减速，每次造成7点伤害。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/MaLaoshi/耗子尾汁.mp3',
    isSpecial: false
  },
  {
    id: 'huaqiang', name: '华强', class: 'HuaQiang', iconColor: '#26272d',
    quote: '"你这瓜保熟吗？"',
    traits: '凶狠、压制 | 场地封锁与磁吸爆发',
    stats: 'HP: 100 | 移速: 65',
    skill: { name: '劈瓜刀法', desc: '发射贯穿砍刀(携带40%概率破障)，撞墙后变为场地陷阱。觉醒：释放磁吸立场，瞬间回收全场砍刀造成大量伤害。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/huaqiang/这瓜保熟吗.mp3',
    isSpecial: false
  },
  {
    id: 'van', name: '白袜尊者', class: 'Van', iconColor: '#d4b264',
    quote: '"Do you like van♂游戏"',
    traits: '狂热、执念 | 脱战暴走与强力压制',
    stats: 'HP: 100 | 移速: 70',
    skill: { name: '背刺攻击', desc: '脱战3秒后移速翻倍(急色)。碰撞触发瞬移背刺，将敌方压制并造成连续打桩伤害。觉醒：生成全屏力场，触发强化版深度压制。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/van/选择.mp3',
    isSpecial: false
  },
  {
    id: 'sunwukong', name: '猴哥', class: 'SunWukong', iconColor: '#fbd73a',
    quote: '"俺老孙来也！"',
    traits: '齐天大圣、金刚不坏 | 如意金箍与分身爆发',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '如意金箍棒', desc: '金箍棒环绕周身旋转，每4秒变长变粗一次造成更高伤害。受击时20%概率触发金刚不坏，免疫本次及后续连段伤害。觉醒：大闹天宫，分出三个分身弹射全场，并同步释放超大范围的强化金箍棒。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/SunWukong/老孙来也.mp3',
    isSpecial: false
  },
  {
    id: 't1000', name: 'T1000', class: 'T1000',
    iconColor: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #a0a6b8 40%, #404040 100%)',
    quote: '"I\'ll be back."',
    traits: '液态金属、变形穿刺 | 碎片标记与追踪爆发',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '变形刺刃', desc: '每2.5秒伸出刺刃攻击附加流血。受击时20%概率液化自愈(受击伤害减半，同时回复5点血量)，随后生成液态碎片。碎片命中叠加标记触发暴击伤害，未命中化为场地陷阱。觉醒时激活所有陷阱碎片进行追踪打击并添加标记。' },
    audioSrc: null,
    isSpecial: true
  },
  {
    id: 'onepunchman', name: '一拳超人', class: 'OnePunchMan',
    iconColor: '#ffff00',
    quote: '"我变秃了，也变强了。"',
    traits: '无敌、秒杀 | 怒气爆发与一击必杀',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '普通一拳', desc: '受到敌方伤害时积累怒气(每次2%~10%)，满怒释放普通一拳，沿途破除场地障碍与陷阱，命中直接秒杀。觉醒：认真一拳，立刻全屏清场并瞬移至敌方身前触发秒杀。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/OnePunchMan/选择.mp3',
    isSpecial: false
  },
  {
    id: 'queens', name: 'S女王', class: 'QueenS',
    iconColor: 'linear-gradient(to right, #2d004d, #ff007f)',
    quote: '"乖乖臣服于我吧。"',
    traits: '控制、爆发 | 连续鞭笞与牵引',
    stats: 'HP: 100 | 移速: 65',
    skill: { name: '赏赐耳光', desc: '敌方靠近时将其控在身前，连续扇8次耳光后推开。若连续2秒未触发，则甩出狗链将敌方强行拉回并掌掴。觉醒：鞭笞惩戒，掷出追踪必中狗链，拉至身前进行6次狂暴鞭笞。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/QueenS/选择.mp3',
    isSpecial: false
  },
  {
    id: 'dragonking', name: '龙王赘婿', class: 'DragonKing',
    iconColor: '#002b36',
    quote: '"三年之期已到，恭迎龙王回归！"',
    traits: '隐忍、爆发 | 弹射消耗与强化效果',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '太乙神针', desc: '每2秒发射神针，命中敌方造成伤害，命中自身恢复生命并加速。受击积攒隐忍值，满100触发【三年之期】。觉醒：真太乙神针，五针齐发，各自附带灼烧、冻结、减速、连击和强效自疗。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/DragonKing/三年已到.mp3',
    isSpecial: false
  },
  {
    id: 'thunderflash', name: '霹雳闪', class: 'ThunderFlash',
    iconColor: '#f9a825',
    quote: '"集中一点,登峰造极！"',
    traits: '极速、贯穿 | 蓄力弹射与六连绝杀',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '壹之型·霹雳一闪', desc: '碰壁时蓄力0.3秒，随后朝敌方超高速弹射并贯穿，造成高额伤害，弹射与蓄力期间处于霸体。弹射结束后冷却1秒。觉醒：霹雳一闪·六连，立刻开始蓄力弹射，碰壁后瞬间再次蓄力，连续弹射6次，造成巨额伤害！' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/thunderflash/霹雳一闪.mp3',
    isSpecial: false
  },
  {
    id: 'bomber', name: '炸弹人', class: 'Bomber',
    iconColor: '#333333',
    quote: '"艺术就是爆炸！"',
    traits: '地雷布设 | 炸弹强化与范围压制',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '高爆艺术', desc: '每1.5秒投掷炸弹，命中粘附引爆，未命中变为减速地雷(20%概率踩中即爆)。踩圈升级，升级提升伤害、减速效果、爆炸范围，最多升级4次。觉醒：艺术就是爆炸，立即向四周掷出3枚强化地雷。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/Bomber/艺术爆炸.mp3',
    isSpecial: false
  },
  {
    id: 'flameartist', name: '戏炎师', class: 'FlameArtist',
    iconColor: '#ff4500',
    quote: '"让火焰净化一切！"',
    traits: '布场消耗 | 扇形喷火与火种引燃',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '戏炎弄火', desc: '每2秒喷火，在区域内生成火种。敌方触碰火种叠加标记，满4层触发引燃造成持续伤害。自身拾取火种获得移速加成。觉醒：焚天炼狱，双向全屏旋转喷火并大量生成火种。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/FlameArtist/引燃.mp3',
    isSpecial: false
  },
  {
    id: 'crimson_blade', name: '绯刃狂想', class: 'CrimsonBlade',
    iconColor: '#1a0b2e',
    quote: '"绯红的线，织就终幕的重奏。"',
    traits: '陷阱控制 | 瞬间爆发与持续连击',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '绯线斩', desc: '每4秒蓄力斩出一道延伸至边界的斩痕。直击造成高伤，未命中留下的斩痕若被触碰将触发刀气三连击。觉醒：终幕五重奏，全场随机释放五道强化斩痕。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/CrimsonBlade/选择.mp3',
    isSpecial: false
  },
  {
    id: 'jueshiyouwu', name: '绝世油物', class: 'JueShiYouWu',
    iconColor: '#ffcc00',
    quote: '"我要对你实行我的爱情专属权~"',
    traits: '精神污染 | 无限追踪与分身满屏',
    stats: 'HP: 100 | 移速: 60',
    skill: { name: '如影随形', desc: '若2秒未造成碰撞伤害则进入追踪模式，速度线性递增，命中后恢复基础移速。觉醒：油物重奏，分裂4个同样具备追踪能力的分身，分身成功碰撞一次或5秒后消失。' },
    audioSrc: import.meta.env.BASE_URL + 'assets/audio/JueShiYouWu/bgm.mp3',
    isSpecial: true
  },
  {
    id: 'coming_soon', name: '敬请期待', class: 'None', iconColor: '#222222',
    quote: '"神秘的力量正在苏醒..."',
    traits: '未知 | ???',
    stats: 'HP: ??? | 移速: ???',
    skill: { name: '未知', desc: '该英雄正在设计中，敬请期待。' },
    audioSrc: null,
    disabled: true,
    isSpecial: false
  }
];
