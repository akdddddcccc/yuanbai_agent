// 根据“元白楼大型参考.3dm”中的 12 个主体体块重建。
// Rhino 原文件以厘米为单位；这里按 1:40 缩放，并把 Rhino Z 轴映射为 Three.js Y 轴。
export const YUANBAI_MASSES = [
  { id: "east-north", position: [4.0, 0, -3.78], size: [1.5, .75, 1.5], rotation: 0, finish: "brick" },
  { id: "north-court", position: [2.26, 0, -4.02], size: [1.5, .75, 1.5], rotation: .262, finish: "concrete" },
  { id: "north-core", position: [0.01, 0, -4.27], size: [1.5, 1.0, 1.5], rotation: 0, finish: "brickDark" },
  { id: "north-tower", position: [.22, 0, -2.13], size: [1.5, 2.25, 1.5], rotation: -.524, finish: "brick" },
  { id: "east-tower", position: [4.19, 0, -1.85], size: [1.5, 1.75, 1.5], rotation: .436, finish: "concrete" },
  { id: "east-middle", position: [4.38, 0, .05], size: [1.5, 1.75, 1.5], rotation: 0, finish: "concrete" },
  { id: "court-tower", position: [2.25, 0, -.03], size: [1.5, 2.5, 1.5], rotation: .436, finish: "brick" },
  { id: "central-tower", position: [0, 0, 0], size: [1.5, 3.5, 1.5], rotation: 0, finish: "concrete" },
  { id: "south-core", position: [0, 0, 2.25], size: [1.5, 2.75, 1.5], rotation: 0, finish: "concrete" },
  { id: "west-tower", position: [-4.25, 0, 0], size: [1.5, 2.0, 1.5], rotation: 0, finish: "brick" },
  {
    id: "west-courtyard",
    position: [-2.13, 0, 3.25],
    size: [5.75, 1.5, 4.0],
    rotation: 0,
    finish: "brick",
    // L 形低层对应 Rhino 里 12 顶点的 Brep，而不是用包围盒替代。
    footprint: [
      [-2.87, 2], [-2.87, -2], [-.87, -2], [-.87, 0], [2.88, 0], [2.88, 2],
    ],
  },
  { id: "west-core", position: [-2.25, 0, 0], size: [1.5, 2.5, 1.5], rotation: 0, finish: "concrete" },
];

// 连接点来自 Rhino 中 5 个 Extrusion 的起止位置。
// 网页里改成带踏步、平台和栏杆的稳定连接体，发声时不参与爆炸运动。
export const YUANBAI_CONNECTIONS = [
  // anchor 指定唯一跟随体块。连接体只继承这一栋楼的位移，不同时受两端楼体拉扯。
  { id: "south-link", anchor: "south-core", from: [0, 2.75, 3.0], to: [-1.13, 1.5, 3.25], width: .42 },
  { id: "north-link", anchor: "north-tower", from: [.38, 1.79, -3.05], to: [.04, 1.06, -3.48], width: .34 },
  { id: "west-link", anchor: "west-core", from: [-3.03, 2.47, 0], to: [-3.47, 2.03, 0], width: .34 },
  { id: "roof-link", anchor: "north-core", from: [.84, .97, -4.22], to: [1.45, .78, -3.87], width: .3 },
  { id: "east-link", anchor: "court-tower", from: [3.22, 2.19, -.19], to: [3.66, 1.72, .07], width: .34 },
];

export const YUANBAI_COURTYARD = {
  position: [2.43, .018, 2.18],
  brickRadii: [1.18, .86, .54],
  grassRadii: [1.02, .7],
};
