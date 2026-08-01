# Strike Arena UE5 正式版技术蓝图

当前仓库是公开网页大厅与 Three.js 战斗原型。照片级正式版应作为独立的 Unreal Engine 5 客户端开发；网页保留账号、新闻、地图展示、版本下载和启动入口。若必须在网页中直接运行 UE5，需要另建 GPU 云服务器并使用 Pixel Streaming，GitHub Pages 本身不能运行 UE5 客户端。

## 推荐技术基线

- 引擎：Unreal Engine 5，Lumen、Nanite、Virtual Shadow Maps、World Partition。
- 扫描资产：RealityCapture 生成地形与建筑扫描模型，Quixel Megascans 补充岩石、植被和表面材质。
- 角色与枪械：Blender/Maya 负责拓扑、装配和绑定，ZBrush 负责高模，Substance 3D Painter 输出 PBR 材质。
- 动作：Xsens 动捕清洗后进入 Motion Matching 数据库；瞄准、持枪和受击使用 Control Rig、IK 与程序化叠加。
- 音频：Wwise 或 FMOD；枪口、弹着点、室内外空间和材质表面分别建立事件与衰减曲线。
- 版本控制：Perforce Streams；源资产、引擎工程、构建产物分流管理，二进制资产启用独占签出。

## 工程模块

```text
Source/StrikeArena/
  Character/       True First-Person、相机稳定、移动状态
  Weapons/         武器状态机、弹簧后坐力、换弹、附件
  Ballistics/      实体弹道、穿透、跳弹、材质响应
  Animation/       Motion Matching、IK、Control Rig
  Audio/           Wwise/FMOD 事件和空间声学参数
  Maps/            World Partition、数据层、关卡规则
  Network/         服务器权威、相关性、预测、延迟补偿
  UI/              大厅、HUD、设置、战绩
```

## 三个真实感核心

### True First-Person

全身只使用一个骨骼模型，摄像机跟随 Head Bone，但不直接复制头骨的全部旋转。身体动画输出高频位移，相机稳定器保留低频重心变化并过滤脚步冲击；瞄准点由相机与枪口双重校验，避免枪管穿墙后仍能射击。

### 程序化武器

后坐力用临界阻尼弹簧计算位置和旋转，按武器、姿态、附件和连续射击热度改变冲量。鼠标转向产生惯性摆动，呼吸、移动、受击和贴墙姿态作为独立 Additive 层混合，不使用一条固定开火动画覆盖全部状态。

### 服务器权威弹道

客户端生成预测弹道和视觉曳光，服务器使用相同初速、质量、重力和阻力参数复算。碰撞材质提供密度、硬度、厚度与跳弹临界角；穿透后按剩余能量计算伤害和偏转。服务器只确认命中结果，客户端预测失败时平滑校正。

## 资产与性能预算

- 静态扫描物开启 Nanite；角色、武器和可变形物保持 Skeletal Mesh LOD 链。
- 纹理默认使用虚拟纹理；粗糙度、金属度、环境遮蔽打包为 ORM。
- 重复道具使用 ISM/HISM，建筑模块做 HLOD，远景由 World Partition 流送。
- Lumen 硬件光追作为高档选项；默认提供软件 Lumen 与关闭 Lumen 的性能档。
- 接入 DLSS、FSR 和 XeSS，并提供动态分辨率目标帧率。
- 帧时间、显存、Draw Call、骨骼数量、动画数据库和网络带宽均纳入每周自动测试。

## 地图生产流程

1. 灰盒阶段先验证三路结构、A/B 点、出生距离、交战时间和回防路线。
2. RealityCapture 导入扫描场景，清理破面、碰撞和不可见区域，建立 Nanite/HLOD。
3. 用 Megascans 补足地表、植被和小型道具，统一尺度、湿度、污渍和材质参数。
4. 添加物理材质、声学空间、遮挡、导航和网络相关性体积。
5. 在目标最低配置上完成 GPU、CPU、显存和网络压力测试后再进入美术封版。

## 网页与 UE5 的连接

网页继续部署到 GitHub Pages。正式客户端由 CDN 分发，网页按钮通过自定义协议启动本地启动器；登录令牌应由后端签发短期票据，客户端只交换一次性授权码。Pixel Streaming 作为试玩入口时，应独立部署信令、TURN、GPU 实例与会话调度服务。
