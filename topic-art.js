// 小尺寸可辨認的主題向量圖：SVG 與 Canvas 共用同一組路徑，公仔和名單保持一致。
const ink = '#513e34';
const path = (d, fill, stroke = ink, width = 2) => ({ d, fill, stroke, width });
const oval = (x, y, rx, ry, fill, stroke = ink, width = 2) => path(`M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0`, fill, stroke, width);
const line = (d, color = ink, width = 3) => path(d, 'none', color, width);
const eyes = (x1, x2, y, r = 4) => [oval(x1,y,r,r,ink,'none'),oval(x2,y,r,r,ink,'none'),oval(x1-1,y-1,1.2,1.2,'#fff','none'),oval(x2-1,y-1,1.2,1.2,'#fff','none')];
const icon = (label, features, shapes) => ({ label, features, shapes });
const mammal = (label, kind) => {
  const hyena = kind === 'hyena', okapi = kind === 'okapi', meerkat = kind === 'meerkat', wombat = kind === 'wombat';
  const fur = hyena ? '#c89f69' : okapi ? '#684733' : meerkat ? '#d7b27d' : wombat ? '#ad9276' : '#b68c60';
  const capybara = kind === 'capybara';
  const earHeight = capybara ? 10 : okapi ? 23 : wombat ? 13 : 17;
  const shapes = [oval(64,88,meerkat?25:34,30,fur),oval(43,33,13,earHeight,fur),oval(85,33,13,earHeight,fur),oval(43,33,7,earHeight*.6,'#e8c4a2'),oval(85,33,7,earHeight*.6,'#e8c4a2'),oval(64,capybara?67:63,38,capybara?29:34,fur)];
  if (meerkat) shapes.push(oval(45,58,11,13,'#6b5345'),oval(83,58,11,13,'#6b5345'),oval(64,85,19,15,'#f5dfb8'));
  else shapes.push(oval(64,capybara?83:79,capybara?31:26,capybara?21:18,wombat?'#d8c1a8':'#e1b98c'));
  shapes.push(...eyes(46,82,58),oval(64,74,wombat?10:7,6,ink,'none'),line('M64 80v5m-9 1q9 7 18 0'));
  if(hyena){for(const [x,y] of [[39,88],[87,86],[47,104],[76,108],[64,98]])shapes.push(oval(x,y,4,5,'#63462f','none'));shapes.push(line('M36 41l-7-13m60 13 8-13','#654632',5))}
  if(okapi){shapes.push(path('M39 94h50l-4 23H43Z','#f0e6cf'),line('M41 99h46m-45 8h43','#5f4032',5),line('M52 29l-2-13m26 13 2-13','#bba785',5),oval(50,15,4,4,'#eee1c0'),oval(78,15,4,4,'#eee1c0'));}
  return icon(label,okapi?'短頸、長耳、雙角與後腿斑紋':meerkat?'直立姿態與深色眼罩':hyena?'圓耳、深色口鼻與斑點':wombat?'短圓耳、寬鼻與敦實身軀':'短耳、鈍口鼻與無尾的敦實身軀',shapes);
};
const bird = (label, kind) => {
  const hornbill=kind==='hornbill',toucan=kind==='toucan',hoatzin=kind==='hoatzin',humming=kind==='hummingbird',kiwi=kind==='kiwi',ostrich=kind==='ostrich',frigate=kind==='frigatebird',lyre=kind==='lyrebird',runner=kind==='roadrunner';
  const color = humming?'#328c65':hoatzin?'#9d6e3d':kiwi?'#957447':runner?'#9b8f77':lyre?'#96704b':'#38444a';
  const shapes=[];
  if(lyre)shapes.push(line('M40 87C-4 53 13 8 34 14C44 21 31 32 25 24M45 86C87 53 78 9 57 15C46 22 59 33 66 24','#b49a75',9),line('M28 27L40 82M59 27L44 82M23 40L41 83M65 40L43 83','#dfcaa5',3));
  if(frigate)shapes.push(path('M61 69L7 28Q13 65 47 83L32 115L64 95L88 116L79 80Q111 62 121 27Z',color));
  if(humming)shapes.push(path('M58 69Q20 14 12 35Q16 65 48 83Z','#79c2b3'),path('M65 66Q73 13 91 20Q94 51 73 80Z','#b9ddd7'));
  if(runner)shapes.push(path('M44 79L7 49L19 90L46 101Z','#64594c'));
  shapes.push(oval(59,84,kiwi?38:ostrich?32:29,kiwi?29:ostrich?25:31,color));
  if(ostrich){shapes.push(path('M67 79Q66 49 77 27L87 27Q78 57 81 79Z','#d6b18b'),oval(85,26,13,14,'#d6b18b'),oval(51,86,20,15,'#f4f1e3'),line('M48 106v16m22-16v16','#a77857',5));}
  else {shapes.push(oval(77,55,23,24,color));if(!kiwi&&!humming&&!frigate)shapes.push(oval(65,86,17,23,hoatzin?'#c5a773':'#f4edd9'));}
  if(hornbill||toucan){shapes.push(path('M82 48Q120 37 123 57Q116 78 87 73Z',toucan?'#f2ac36':'#f0bc43'));shapes.push(path('M101 47Q121 43 123 57L114 65Z',toucan?'#d95f3c':'#f0da7b'));if(hornbill)shapes.push(path('M85 45Q91 21 112 31L119 45Z','#f3bf39'));}
  else shapes.push(path(kiwi?'M91 53L124 74L94 64Z':humming?'M93 48L125 37L96 56Z':ostrich?'M96 24L113 28L97 32Z':'M94 52L117 58L94 65Z','#dfaa47'));
  if(hoatzin){shapes.push(oval(79,51,14,15,'#6aa0ba'),line('M66 36l-9-17m16 14-2-20m9 19 5-18m3 22 12-13','#d0a65d',5));}
  if(runner)shapes.push(path('M59 38L70 20L76 32L86 19L89 39Z','#78664e'));
  if(frigate)shapes.push(oval(76,78,18,23,'#e9614e'));
  shapes.push(oval(ostrich?88:kiwi?83:82,ostrich?24:kiwi?54:51,4,4,hoatzin?'#d9593e':ink,'none'),oval(ostrich?87:81,ostrich?23:kiwi?53:50,1.2,1.2,'#fff','none'));
  if(!frigate&&!humming&&!ostrich)shapes.push(line('M48 110v10m22-10v10m-27 1h11m11 0h11','#a67846',4));
  return icon(label,hornbill?'巨大黃色盔突與長喙':toucan?'巨大彩色長喙、黑身與淺色喉胸':hoatzin?'褐色身體、冠羽、藍色眼周與紅眼':lyre?'琴形長尾':frigate?'黑羽、分叉尾與紅色喉囊':humming?'細長喙與懸停雙翼':kiwi?'圓身、長喙與退化翅膀':ostrich?'長頸長腿、黑白羽色':runner?'冠羽、長尾與善跑長腿':'鳥類',shapes);
};
const primate = (label, aye = false) => icon(label,aye?'大耳、長門牙與特長中指':'極大的雙眼、大耳與細長手指',[
 oval(64,91,27,25,aye?'#696054':'#bc9368'),oval(27,40,19,23,aye?'#716557':'#bd946c'),oval(101,40,19,23,aye?'#716557':'#bd946c'),oval(27,40,12,16,'#e2b9a5'),oval(101,40,12,16,'#e2b9a5'),oval(64,58,39,35,aye?'#716557':'#bc9368'),oval(44,55,19,21,'#f7dda3'),oval(84,55,19,21,'#f7dda3'),...eyes(44,84,55,aye?9:12),oval(64,78,5,4,ink,'none'),line('M59 85q5 4 10 0'),line(aye?'M90 99l20-40m-16 43 18-19m-24 14 12-10':'M84 103l22-21m-22 22 27-9m-26 11 26 1','#b69a78',5),...(aye?[path('M59 85h10v9H59Z','#fff8e6')]:[])
]);
const sea = (label, kind) => {
 const ray=kind==='ray',sunfish=kind==='sunfish',manatee=kind==='manatee',sperm=kind==='sperm-whale',narwhal=kind==='narwhal',mosasaur=kind==='mosasaur',gar=kind==='gar';const color=manatee?'#90a9a4':sunfish?'#acc1c4':mosasaur?'#589e91':gar?'#8b9c76':'#6da7bb';let shapes=[];
 if(ray)shapes=[path('M64 20Q53 43 8 62Q26 94 62 83Q103 98 121 62Q80 40 64 20Z','#77a9ae'),line('M64 82Q66 106 89 121','#4e7b83',5),...eyes(54,74,48,3),line('M55 64q9 7 18 0','#466e75',2)];
 else if(sunfish)shapes=[path('M55 42L69 6L82 47M55 90L70 124L82 83',color),oval(66,66,35,41,color),path('M92 40Q117 65 92 94L88 79L95 66L88 52Z','#7f9da4'),oval(45,54,5,5,ink,'none'),line('M30 72q-8 7 1 11'),line('M71 62l-10 14 16 5','#e0e9dc',4)];
 else if(gar)shapes=[path('M24 49Q68 27 103 57L123 39L118 86L100 72Q54 105 22 80L5 79L5 68L28 59Z',color),path('M56 45l16-20 14 25M60 87l18 18 8-20','#69825d'),oval(31,55,4,4,ink,'none'),line('M7 71h29','#3f5143',3),line('M43 56l8 8-7 9m14-18 8 8-7 9m14-18 8 8-7 9m14-18 8 8-7 9','#bfc9a0',3)];
 else if(mosasaur)shapes=[path('M19 39Q57 26 88 62Q105 77 123 52L117 90Q96 110 69 81L41 88L11 66L5 62L5 48Z',color),path('M51 75L36 108L66 90M80 81L78 110L97 93','#317d74'),oval(26,47,4,4,ink,'none'),line('M10 58l29 6'),path('M17 60l4 8 4-6 5 9 5-7','#fff6df')];
 else {shapes=[path(manatee?'M89 65Q128 43 126 79Q124 105 91 87Z':'M88 71L120 42L116 70L125 88L95 88Z',color),oval(sperm?53:58,71,sperm?43:42,manatee?34:29,color),oval(sperm?32:36,65,sperm?24:22,manatee?26:24,color),path('M61 82Q72 120 88 99L78 80Z',color),oval(25,59,4,4,ink,'none'),line('M16 77q14 7 27 0','#4b6b6d',3)];if(manatee)shapes.push(oval(23,78,16,12,'#b6c8bb'),line('M14 73L4 67m10 13L3 82m24-7 10-8','#55736c',2));if(narwhal)shapes.push(path('M14 68L3 14L26 65Z','#ece0b6'),line('M8 36l10-4m-7 15 10-4','#b6a67e',2));if(sperm)shapes.push(path('M11 38Q8 38 8 47V78Q8 89 24 89H56L64 56L59 36Z',color),oval(25,59,4,4,ink,'none'),line('M11 80h38','#4b6b6d',3));}
 return icon(label,ray?'菱形胸鰭盤與細長尾':sunfish?'側扁圓身、上下高鰭與短尾部':manatee?'圓口鼻、前肢鰭與寬槳形尾':narwhal?'從口部伸出的長牙':sperm?'巨大方頭與下顎':mosasaur?'長吻、尖牙、四肢鰭與長尾':gar?'長狹吻、利齒與菱形硬鱗':'海洋生物',shapes);
};

export const TOPIC_ART = {
 'animal:capybara':mammal('水豚','capybara'), 'animal:wombat':mammal('袋熊','wombat'), 'animal:meerkat':mammal('狐獴','meerkat'), 'animal:hyena':mammal('斑點鬣狗','hyena'), 'animal:okapi':icon('霍加狓','長耳、短角、棕色身軀與白色後腿條紋',[
 path('M26 59Q54 48 85 62L98 54L101 65L92 74V117H81V83L56 84V116H44V83L28 81Z','#684733'),
 path('M25 69L17 35L31 30L44 68Z','#684733'),oval(22,33,15,23,'#684733'),
 oval(9,15,7,13,'#684733'),oval(35,14,7,13,'#684733'),line('M20 15V6m10 11 2-10','#baa281',4),
 path('M9 44Q22 50 35 41L33 54H14Z','#e4d4b2'),oval(16,31,3,3,ink,'none'),
 path('M45 89H56V117H44Z','#eee5cf'),path('M81 86H92V117H81Z','#eee5cf'),
 line('M45 95h10m-10 8h10m-10 8h10m27-17h9m-9 9h9m-9 9h9','#5c4031',4),line('M97 57q17 15 12 36','#684733',4)
 ]),
 'animal:hoatzin':bird('麝雉','hoatzin'), 'animal:hornbill':bird('大犀鳥','hornbill'), 'animal:toucan':bird('巨嘴鳥','toucan'), 'animal:lyrebird':bird('琴鳥','lyrebird'), 'animal:frigatebird':bird('軍艦鳥','frigatebird'), 'animal:hummingbird':bird('蜂鳥','hummingbird'), 'animal:kiwi':bird('奇異鳥','kiwi'), 'animal:ostrich':bird('鴕鳥','ostrich'), 'animal:roadrunner':bird('走鵑','roadrunner'),
 'animal:tarsier':primate('眼鏡猴'), 'animal:ayeaye':primate('指猴',true),
 'animal:manatee':sea('海牛','manatee'), 'animal:ray':sea('魟魚','ray'), 'animal:sunfish':sea('翻車魚','sunfish'), 'animal:narwhal':sea('獨角鯨','narwhal'), 'animal:sperm-whale':sea('抹香鯨','sperm-whale'), 'animal:mosasaur':sea('蒼龍','mosasaur'), 'animal:gar':sea('鱷雀鱔','gar'),
 'animal:axolotl':icon('美西螈','兩側各三枝外鰓、寬頭與四肢',[
  path('M51 88Q62 117 101 106Q117 101 113 80Q102 102 77 88Z','#eaa9b2'),line('M33 49L9 27m23 31L6 54m26 13L10 82m85-33 24-22m-24 31 27-4m-27 13 23 15','#d77993',8),line('M16 34L14 23m5 17-13-1m108-5 1-11m-6 17 13-1','#dc8fa2',4),oval(64,68,41,29,'#f4c6cf'),...eyes(46,82,66),line('M52 80q12 9 24 0'),path('M40 91l-9 15 14-5m43-10 9 15-14-5','#efb6c2')]),
 'animal:caecilian':icon('蚓螈','無肢、環狀體節與小眼睛',[
  path('M30 39C-2 61 13 112 60 112C105 112 126 80 105 57C84 32 56 57 74 73C87 85 103 74 101 65C113 91 72 109 45 91C26 78 38 64 47 58Z','#a08aa8'),oval(37,44,23,18,'#b9a0bd'),...eyes(26,45,40,2.7),line('M24 52q10 5 20 0'),line('M23 68l18 7m-16 9 17 3m-2 17 7-17m14 20 1-16m18 12-6-15m22 4-12-10','#d9c7db',3)]),
 'animal:tardigrade':icon('水熊蟲','四對短足、分節軀幹與圓形口器',[
  ...[38,57,77,96].flatMap(y=>[path(`M43 ${y}L23 ${y+8}L30 ${y+17}L48 ${y+7}`,'#e0c299'),path(`M85 ${y}L105 ${y+8}L98 ${y+17}L80 ${y+7}`,'#e0c299')]),oval(64,65,29,47,'#edd3ad'),...[46,66,86].map(y=>line(`M39 ${y}q25 9 50 0`,'#ccb28b',3)),oval(64,29,24,20,'#f1dcbb'),oval(64,28,10,9,'#947956'),oval(64,28,4,4,'#4e4435','none')]),
 'animal:platypus':icon('鴨嘴獸','寬扁嘴、卵生哺乳類身軀與扁尾',[
  path('M86 75Q121 68 122 91Q115 114 84 101Z','#88674e'),oval(63,78,33,32,'#9d7959'),oval(53,48,30,27,'#ad8c67'),...eyes(37,68,43),oval(51,65,30,13,'#829b9d'),line('M28 65h46','#4d6f74',2),path('M34 98L22 114L48 109m35-12 14 16-26-5','#829b9d')]),
 'animal:pangolin':icon('穿山甲','長吻、長尾與重疊鱗片',[
  path('M29 82Q30 26 72 31Q115 35 113 84Q109 112 65 113Q111 98 100 77Q80 102 46 95L25 108L14 94Z','#a48b5c'),path('M43 66L9 83L36 89L52 79Z','#ceb488'),oval(31,77,3,3,ink,'none'),...[[49,47],[69,42],[88,50],[50,65],[71,61],[91,70],[63,80],[83,89]].map(([x,y])=>path(`M${x-9} ${y-5}L${x} ${y+9}L${x+9} ${y-5}Z`,'#c1a975','#806c48',1.5))]),
 'animal:naked-mole-rat':icon('裸鼴鼠','稀疏毛髮、皺褶皮膚與突出門牙',[
  oval(65,79,39,31,'#e4b7a6'),oval(45,52,32,29,'#edc1b1'),oval(22,39,9,10,'#d99f93'),oval(62,34,8,9,'#d99f93'),...eyes(30,53,48,2.5),oval(22,66,10,9,'#dc9e92'),path('M24 71h15v19H26Z','#fff6d8'),line('M32 72v15','#c8b38e',2),line('M65 57q-8 12 0 22m11-17q-8 12 0 22m12-12q-7 12-1 20','#cb998b',2)]),
 'animal:flying-squirrel':icon('飛鼠','前後肢間的滑翔皮膜與蓬鬆尾巴',[
  path('M83 97Q126 120 121 70Q111 28 101 55Q112 82 91 78Z','#b29470'),path('M31 47L8 24L18 94L45 111L64 94L84 110L106 91L117 23L92 48Z','#d4b993'),oval(63,69,25,33,'#b59670'),oval(47,32,10,14,'#b59670'),oval(80,32,10,14,'#b59670'),oval(64,48,28,25,'#c8ab84'),...eyes(49,79,46,6),oval(64,58,5,4,ink,'none')]),
 'animal:snow-leopard':icon('雪豹','灰白毛、黑色斑點與粗長尾巴',[
  path('M88 94Q121 119 119 70Q116 44 104 56Q109 79 94 80Z','#cbd1ce'),oval(65,85,30,29,'#d7dbd5'),oval(37,30,14,16,'#d7dbd5'),oval(90,30,14,16,'#d7dbd5'),oval(64,56,37,32,'#e5e6dd'),oval(64,77,23,15,'#f5f1e2'),...eyes(47,81,55),oval(64,71,6,5,'#9f8b89'),...[[40,38],[86,38],[32,60],[94,63],[45,88],[79,93],[62,104],[108,78]].map(([x,y])=>oval(x,y,3.5,4,'#5a6869','none'))]),
 'animal:mantis-shrimp':icon('雀尾螳螂蝦','柄眼、折疊拳狀捕肢與多彩分節身軀',[
  path('M72 86L117 102L103 117L82 105Z','#41a899'),oval(64,76,24,35,'#52b49b'),line('M45 65h38m-40 15h43m-36 15h29','#eee098',4),line('M50 47L40 24m37 23 11-23','#49a199',6),oval(38,23,11,10,'#d6df81'),oval(90,23,11,10,'#d6df81'),...eyes(38,90,23,4),path('M46 56L19 48L12 64L35 75Z','#dc8f58'),path('M80 56L107 48L115 64L93 75Z','#dc8f58'),line('M30 86L13 93m82-7 18 7','#577e8a',4)]),
 'animal:wildebeest':icon('牛羚','向外彎角、長臉與下頷鬚',[
  path('M39 29Q10 44 9 15Q20 33 42 17M88 29Q118 44 119 15Q108 33 86 17','#71604c'),oval(64,63,29,43,'#9f9d8d'),path('M38 46L18 38L24 59L40 62M89 46L110 38L104 59L88 62','#a6a392'),oval(64,88,25,20,'#7d837b'),...eyes(47,81,58),path('M49 102L58 124L65 113L74 123L80 101Z','#585d54'),line('M52 91l1 3m23-3-1 3',ink,4)]),
 'plant:baobab':icon('非洲麵包樹','儲水的粗大樹幹與稀疏冠枝',[
  path('M37 116L44 52L29 35L40 24L55 39L58 12H72L75 39L94 20L104 32L86 54L93 116Z','#b68d5f'),...[ [28,29,24,14],[51,17,24,13],[80,20,25,13],[102,38,21,14] ].map(([x,y,rx,ry])=>oval(x,y,rx,ry,'#79a66b','#4e7550',2)),line('M53 64l-4 40m25-46 7 47','#d0ac7c',4)]),
 'habitat:termite-mound':icon('白蟻丘','高聳土丘與可通氣的孔洞',[
  path('M12 116L26 91L34 55L47 70L56 15L67 8L74 55L85 39L99 86L116 117Z','#c59565'),path('M26 115L37 76L45 102L59 49L66 94L82 65L99 116Z','#d5aa78','none'),...[ [53,78,4,8],[72,44,3,7],[87,96,4,7],[40,103,3,6] ].map(([x,y,rx,ry])=>oval(x,y,rx,ry,'#7c5d42','none'))]),
 'space:mercury-venus':icon('水星與金星','無環的灰色隕坑岩石行星與黃白厚雲行星',[
  oval(41,50,31,31,'#a9a399','#776e67'),oval(31,41,8,8,'#8e8880','none'),oval(49,58,10,9,'#8e8880','none'),oval(29,64,5,5,'#c8c1b3','none'),
  oval(85,85,33,33,'#e7bf79','#a7895c'),line('M60 70q23-10 49 5m-56 9q31-9 63 6m-58 7q30-5 49 8','#f5dfae',5)
 ]),
 'space:ice-giants':icon('天王星與海王星','淡藍色天王星與深藍色有雲帶的海王星',[
  oval(40,47,30,30,'#a0d4d8','#5d929e'),line('M20 34q22-4 43 7m-48 9q23-4 48 8','#bde5e4',4),
  oval(86,87,32,32,'#3973c0','#335783'),line('M63 75q23-7 48 4m-54 9q25-5 59 8','#78a9d9',4),oval(99,94,7,3,'#244c87','none')
 ]),
 'space:pluto':icon('冥王星','灰褐色矮行星、淡藍大氣薄邊與心形冰原',[
  oval(64,64,52,52,'#c8e6f1','#87bdd3',2),oval(64,64,48,48,'#c4aa8c','#907d69'),path('M23 43Q45 21 61 36L53 51L29 61Z','#9e826d','none'),path('M25 79Q46 62 66 81L56 105L38 100Z','#aa8a72','none'),
  path('M66 58C52 38 38 58 54 72L70 88L88 70C109 51 86 40 78 56L73 64Z','#eee4cf','none'),oval(89,32,7,4,'#dcc8a9','none')
 ]),
 'vehicle:drone':icon('無人機','四個旋翼、無人座艙與機身攝影機',[
  line('M32 34l64 59m0-59L32 93','#698b9a',10),...[ [27,28],[101,28],[27,98],[101,98] ].map(([x,y])=>oval(x,y,23,12,'#c8e5e7','#4a6d7b',3)),oval(64,62,21,20,'#8bb5c1'),path('M49 81h30v20H49Z','#9bbfc8'),oval(64,91,8,8,'#405f70'),oval(62,89,3,3,'#9fdddd','none')]),
 'vehicle:tank':icon('M1戰車','履帶、裝甲砲塔與長砲管',[
  path('M17 72L30 50H85L104 72Z','#93a57a'),path('M43 52V31H81L92 50Z','#acb791'),path('M77 36L120 29L122 40L81 48Z','#7e9267'),path('M9 74H111L122 91L111 112H16L5 95Z','#718361'),...[27,49,71,93].map(x=>oval(x,94,12,12,'#b5bda2')),line('M13 77h96m-94 32h96','#4e6349',3)]),
 'vehicle:submarine':icon('潛艦','水下流線船體、潛望鏡與尾舵，沒有觀光潛艇舷窗',[
  path('M85 64L114 41L111 72L122 95L90 84Z','#668b9d'),oval(58,78,49,28,'#8cabb6'),path('M49 53V31H72V55Z','#809fac'),line('M60 31V15h19','#627d88',8),line('M28 68h53','#c3d5d9',4),line('M12 96q46 15 91-2','#678d9d',4)]),
};

const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function iconMarkup(key) {
 const art=TOPIC_ART[key];
 if(!art)return `<span class="topic-emoji" data-icon="${escape(key)}">${escape(key)}</span>`;
 return `<svg class="topic-icon" data-icon="${escape(key)}" viewBox="0 0 128 128" role="img" aria-label="${escape(art.label)}" focusable="false">${art.shapes.map(s=>`<path d="${s.d}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
}
export function paintIcon(ctx,key,x,y,size) {
 const art=TOPIC_ART[key];
 if(!art){ctx.fillText(key,x,y);return;}
 ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/128,size/128);
 ctx.lineCap='round';ctx.lineJoin='round';
 for(const shape of art.shapes){const p=new Path2D(shape.d);if(shape.fill!=='none'){ctx.fillStyle=shape.fill;ctx.fill(p)}if(shape.stroke!=='none'){ctx.strokeStyle=shape.stroke;ctx.lineWidth=shape.width;ctx.stroke(p)}}
 ctx.restore();
}
