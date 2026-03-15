# 房间内多用户光标位置及左右键点击实时同步：方案设计与评审

## 目标与约束

- 同步内容：用户光标位置 (x/y) 与左右键点击状态
- 心跳与超时：300ms 未收到更新即冻结 UI，并显示最后位置
- 增量广播：坐标变化 > 2px 或按键状态改变即推包；含心跳保活
- 包体：单条上行更新包体 ≤ 32B
- 插值与预测：三次 Hermite 插值平滑轨迹，预测窗口 80ms
- 限流：单机上行 ≤ 30 pkt/s；下行合并广播 ≤ 50 pkt/s
- 可靠性：同洲端到端延迟 P99 ≤ 120ms；5% 丢包时肉眼无卡顿（30% FEC）；房间 50 人服务端 CPU ≤ 1 核 30%
- 安全：坐标数据端到端 AES-GCM-128 加密；点击经显式授权掩码脱敏
- 交付：单测、压测脚本、可交互 Demo、Dockerfile、Prometheus 指标

## 技术选型（至少两套可行栈）

### 方案 A：WebSocket（二进制帧）+ LWW/CRDT（按用户流）+ 批量广播 + XOR-FEC + AES-GCM

- 传输：WebSocket（TCP），二进制帧（固定布局，接近 Protobuf/Flatbuffers 的效果）
- 一致性：每个用户一条“状态流”，采用 LWW-Register（以 seq/时间戳为胜者）实现 CRDT 化的最终一致
- 可靠性：服务端 20ms tick 合并广播（50 pkt/s）；每 3 帧生成 1 帧 XOR parity（≈33% 冗余）
- 安全：E2E AES-GCM（8B IV + 64-bit tag）加密坐标与点击；明文仅含 seq 与发送者短 ID
- 优势：移动端兼容好；实现/运维成本低；复用现有房间服务
- 劣势：TCP 可能引入 head-of-line 阻塞；“丢包”更多体现为延迟抖动而非真实丢包

### 方案 B：WebRTC DataChannel（unreliable/unordered）+ LWW/CRDT + 端到端加密 + FEC

- 传输：WebRTC DataChannel（SCTP/DTLS/UDP），配置为 unordered + maxRetransmits=0（近似 UDP 语义）
- 一致性：同样使用 LWW-Register（按用户流）或更强 CRDT
- 可靠性：天然可能出现丢包，需要应用层 30% FEC（XOR parity / RaptorQ 等）
- 安全：DTLS 已加密传输；若需要服务器不可见的 E2E，再叠加应用层 AES-GCM
- 优势：低延迟、无 TCP HOL；更贴近“联机同步”需求
- 劣势：必须有信令（可复用 WebSocket）；复杂网络需要 TURN（成本与运维显著上升）；移动端兼容与电量需评估

### 六项指标量化对比（同洲、50人、单用户上行 30 pkt/s）

| 指标 | 方案 A：WS Binary + 批量广播 | 方案 B：WebRTC DC（不可靠） |
|---|---:|---:|
| 延迟（P50/P99） | 40–80ms / 90–150ms（受 HOL 影响） | 25–60ms / 70–120ms（更稳） |
| 带宽（单客户端下行） | ≈ 70KB/s（50/s × 1.4KB batch） | Mesh：O(N) 放大；Star/转发：与 WS 接近 |
| 一致性 | 最终一致（LWW-CRDT）；无需 OT | 最终一致（LWW-CRDT）；无需 OT |
| 容错 | TCP 重传掩盖丢包但可能放大尾延迟；支持回退 | 需 FEC/预测对抗丢包；可回退到 WS |
| 穿透能力 | 依赖 HTTPS/WSS 出口，穿透一般强 | STUN 一般可；复杂网络需 TURN（成本） |
| 移动端兼容性 | 高（浏览器/小程序 WebSocket 生态成熟） | 中（WebRTC 兼容/策略更复杂） |

建议：优先落地方案 A（接入成本低、可复用现有房间系统）；并保留向方案 B 迁移的协议抽象与回退路径。

## 数据模型

### 逻辑状态对象（概念模型）

```ts
type VersionVector = Record<string, number>;

interface CursorState {
  userId: string;
  x: number;
  y: number;
  buttonsMask: number;          // bit0=Left, bit1=Right
  authorizedButtonsMask: number;// 只有授权位才允许被传播/展示
  timestampMs: number;
  vv: VersionVector;            // 对光标状态流可退化为 { userId: seq }
}
```

### 线上的“≤32B”上行包体（实现模型）

为了满足 32B 约束并支持 E2E AES-GCM，使用固定长度二进制帧：

- **明文头（4B）**：type(1) + flags(1) + seq(2)
- **IV（8B）**
- **密文（8B）+ tag（8B）= 16B**

合计：1 + 1 + 2 + 8 + 16 = **28B**

其中密文解开后是：

- x(int16) + y(int16) + buttons(uint8) + authorizedButtons(uint8) + t16(uint16)

### RTT 内冲突消解

光标是“每用户一条状态流”，冲突主要来自乱序/重复：

- 以 `(seq)` 作为版本向量的该用户分量
- 接收端对同一用户只接受 `seq` 严格前进（考虑 16-bit 回绕：diff in (0, 32768)）
- 不需要 OT；CRDT 退化为每用户的 LWW-Register

该规则在**单次接收**即可决定保留/丢弃，满足 “一个 RTT 内消解”。

## 同步策略

### 心跳与超时

- 发送端：每 200ms 强制发送一次当前状态（即使不动）
- 接收端：若某用户 300ms 未更新，标记 frozen，UI 固定最后位置并降低透明度

### 增量广播与限流

- 推包触发：`Δpos > 2px` 或 `buttonsMask` 变化 或 心跳到期
- 上行限流：token bucket，≤ 30 pkt/s
- 下行聚合：服务端 20ms tick（≤ 50 pkt/s）合并为 batch

### 插值与预测

- 以接收时间戳构建样本 (p0,t0)、(p1,t1)
- 速度估计：`v = (p1 - p0) / (t1 - t0)`
- Hermite：用同一速度构造 m0/m1，预测窗口 80ms

### 30% 前向纠错（FEC）

- 服务端每 3 个 batch 生成 1 个 parity（XOR）包，冗余 ≈ 33%
- 能恢复每组中**最多 1 个丢失包**（5% 丢包下概率足够低，配合预测可达“肉眼无卡顿”）

## 可靠性与性能评审

- P99 ≤ 120ms：20ms 聚合 + 80ms 预测窗口 + 同洲网络 RTT 典型 20–60ms
- 5% 丢包：不可靠通道下用 33% XOR parity + 预测插值填补间隙
- 50 人房间：单房间下行约 70KB/s/客户端，服务端 egress 约 3.5MB/s；XOR/FEC 是内存带宽级别操作，CPU 开销低

## 安全与隐私

- 坐标与点击：AES-GCM-128 端到端加密（房间密钥通过 URL hash 携带，服务端不可见）
- GCM tag 选用 64-bit 以满足 32B 约束；若不要求 32B，可升级到 96-bit IV + 128-bit tag
- 点击脱敏：默认不共享点击；用户在协作面板显式开启左键/右键共享开关，形成授权掩码

## 测试与验收

- 单元测试（Vitest）：冲突消解、Hermite 预测、限流阈值
  - `src/collaboration/cursor/cursorSync.test.ts`
- 集成压测脚本：50 客户端随机移动/点击 5 分钟，输出延迟分布
  - `backend/scripts/cursor_load_test.js`
- 可交互 Demo：加入同一房间后，画布上实时显示其他用户光标与点击

## 线上监控与 SLO

- Prometheus metrics（服务端 `/metrics`）：
  - `cursor_sync_delay_seconds{room_id=...}`（服务端 relay 延迟）
  - `cursor_lost_packets_total{room_id=...}`（按 seq gap 估算）

## 回退策略

- 若浏览器不支持 WebCrypto / AES-GCM 或出现解密失败：仅渲染位置（可选）或禁用光标同步并提示
- 若引入 WebRTC：保留 WebSocket 作为信令与数据回退通道

