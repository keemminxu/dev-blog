---
layout: post
title: "Godot 오브젝트 풀로 화살 50개 동시 스폰하기"
title_en: "Godot Object Pool Pattern for Mass Arrow Spawning"
excerpt_en: "Implementing a generic object pool in Godot 4.4 GDScript to handle spawning 50+ arrow obstacles simultaneously from a circular arena edge without frame drops."
date: 2026-04-02 23:30:00 +0900
categories: [godot]
tags: [godot, gdscript, object-pool, optimization, 2d-game, spawn-system]
excerpt: "instantiate()와 queue_free()를 반복하면 50개 이상 동시 스폰 시 버벅인다. 오브젝트 풀로 미리 만들어두고 재사용하면 된다."
---

2D 회피 게임을 만들고 있는데, 시간이 지나면 화살이 한번에 50개 이상 쏟아져야 한다. 처음에는 매번 `instantiate()`로 생성하고 화면 밖으로 나가면 `queue_free()`로 지웠다. 적은 수에서는 괜찮은데, 50개씩 한꺼번에 만들고 지우면 프레임이 튄다.

해결법은 간단하다. 미리 만들어두고 껐다 켰다 하면 된다.

## 오브젝트 풀 기본 구조

```gdscript
# scripts/pool/object_pool.gd
class_name ObjectPool
extends Node

@export var pool_scene: PackedScene   # 풀링할 씬
@export var initial_size: int = 50    # 시작할 때 미리 만들 개수
@export var max_size: int = 200       # 최대 한도
@export var container: Node2D         # 오브젝트가 들어갈 부모 노드

var _available: Array[Node] = []
var _active_count: int = 0
```

핵심은 두 가지다. 미리 만들어두는 `_prewarm()`과, 꺼내고/돌려놓는 `get_object()`/`release()`.

```gdscript
func _ready() -> void:
    _prewarm()

func _prewarm() -> void:
    for i in initial_size:
        var obj := pool_scene.instantiate()
        container.add_child(obj)
        _deactivate(obj)
```

`_prewarm()`에서 `initial_size`만큼 인스턴스를 미리 만들어서 비활성 상태로 둔다. 게임 시작할 때 한번만 부하가 걸리고, 이후에는 생성 비용이 없다.

## 활성화/비활성화

여기가 좀 까다롭다. 단순히 `visible = false`만 하면 안 된다. `_process`도 꺼야 하고, Area2D면 충돌 감지도 꺼야 한다.

```gdscript
func _activate(obj: Node) -> void:
    obj.visible = true
    obj.set_process(true)
    obj.set_physics_process(true)
    if obj is Area2D:
        (obj as Area2D).monitoring = true
        (obj as Area2D).monitorable = true

func _deactivate(obj: Node) -> void:
    obj.visible = false
    obj.set_process(false)
    obj.set_physics_process(false)
    if obj is Area2D:
        (obj as Area2D).monitoring = false
        (obj as Area2D).monitorable = false
    if obj is Node2D:
        (obj as Node2D).position = Vector2(-9999, -9999)
```

비활성화할 때 위치를 `-9999`로 보내는 건, 혹시라도 한 프레임 동안 충돌이 남아있는 경우를 방지하기 위해서다.

## 꺼내기/반환

```gdscript
func get_object() -> Node:
    var obj: Node = null
    if _available.size() > 0:
        obj = _available.pop_back()
    elif _active_count + _available.size() < max_size:
        # 풀이 비었지만 한도 내면 새로 만듦
        obj = pool_scene.instantiate()
        container.add_child(obj)
    else:
        return null   # 한도 초과

    _activate(obj)
    _active_count += 1
    return obj

func release(obj: Node) -> void:
    _deactivate(obj)
    _active_count -= 1
    if not _available.has(obj):
        _available.append(obj)
```

`get_object()`는 비활성 풀에서 하나 꺼내고, 없으면 `max_size`까지 새로 만든다. `release()`는 비활성화하고 다시 풀에 넣는다.

## 스포너에서 쓰기

화살 종류가 4개(일반, 빠른, 큰, 추적)라서 풀도 4개 만들었다.

```gdscript
# game.gd _ready()에서
var _obstacle_scenes: Array[PackedScene] = [
    preload("res://scenes/obstacles/obstacle.tscn"),
    preload("res://scenes/obstacles/obstacle_fast.tscn"),
    preload("res://scenes/obstacles/obstacle_large.tscn"),
    preload("res://scenes/obstacles/obstacle_homing.tscn"),
]

for scene in _obstacle_scenes:
    var pool := ObjectPool.new()
    pool.pool_scene = scene
    pool.initial_size = 30
    pool.max_size = 120
    pool.container = obstacle_container
    add_child(pool)
    _obstacle_pools.append(pool)
```

타입당 30개씩, 총 120개를 미리 만들어둔다. 스포너에서는 이렇게 쓴다.

```gdscript
func _spawn_single_obstacle(valid_indices: Array, speed_multiplier: float) -> void:
    var pool_index: int = valid_indices[randi() % valid_indices.size()]
    var pool: ObjectPool = pools[pool_index]
    var obstacle: Node2D = pool.get_object()
    if not obstacle:
        return

    # 원형 가장자리에서 스폰
    var spawn_angle: float = randf() * TAU
    var spawn_pos: Vector2 = ARENA_CENTER + Vector2.from_angle(spawn_angle) * (ARENA_RADIUS + 50)
    obstacle.position = spawn_pos

    # 방향: 원 중심 쪽으로 + 약간 흔들림
    var to_center: Vector2 = (ARENA_CENTER - spawn_pos).normalized()
    var jitter: float = randf_range(-deg_to_rad(30), deg_to_rad(30))
    var direction: Vector2 = to_center.rotated(jitter)

    obstacle.initialize(direction, base_speed * speed_multiplier)
```

## 반환 타이밍

화살이 경기장 밖으로 충분히 벗어나면 풀에 돌려보낸다. `VisibleOnScreenNotifier2D` 대신 거리 계산으로 했다. 원형 경기장이라 사각형 화면 기준 판정보다 원 중심 거리가 더 정확하다.

```gdscript
# obstacle.gd
signal exited_arena

const ARENA_CENTER := Vector2(640, 360)
const ARENA_RADIUS: float = 320.0
const EXIT_MARGIN: float = 200.0

func _process(delta: float) -> void:
    position += direction * speed * delta

    if position.distance_to(ARENA_CENTER) > ARENA_RADIUS + EXIT_MARGIN:
        exited_arena.emit()
```

스포너가 이 시그널을 받아서 `pool.release(obstacle)`를 호출한다.

## 시그널 중복 연결 문제

풀에서 꺼낼 때마다 시그널을 연결하면 같은 오브젝트에 시그널이 중복으로 붙는다. 두 번째 스폰부터 콜백이 두 번 호출되고, 세 번째는 세 번... 이런 식으로 쌓인다.

처음에 이거 때문에 한참 헤맸다. 해결법은 인스턴스 ID로 연결 여부를 추적하는 것이다.

```gdscript
var _connected_instances: Dictionary = {}

# 스폰할 때
var instance_id: int = obstacle.get_instance_id()
if not _connected_instances.has(instance_id):
    obstacle.body_entered.connect(collision_handler.on_obstacle_body_entered)
    _connected_instances[instance_id] = true
```

오브젝트 풀에서 꺼낸 노드는 같은 인스턴스가 반복적으로 활성화/비활성화되기 때문에, 시그널은 최초 한 번만 연결하면 된다.

## 난이도별 스폰 개수

시간이 지나면 한번에 스폰되는 개수가 늘어나야 한다.

```gdscript
var DIFFICULTY_TABLE: Array[Dictionary] = [
    {"level": 1, "threshold_sec": 0.0,   "spawn_count_min": 1,  "spawn_count_max": 2},
    {"level": 2, "threshold_sec": 15.0,  "spawn_count_min": 2,  "spawn_count_max": 4},
    {"level": 3, "threshold_sec": 30.0,  "spawn_count_min": 4,  "spawn_count_max": 8},
    {"level": 4, "threshold_sec": 60.0,  "spawn_count_min": 8,  "spawn_count_max": 15},
    {"level": 5, "threshold_sec": 90.0,  "spawn_count_min": 15, "spawn_count_max": 30},
    {"level": 6, "threshold_sec": 120.0, "spawn_count_min": 30, "spawn_count_max": 50},
]

func get_spawn_count() -> int:
    var entry := _get_current_entry()
    return randi_range(entry["spawn_count_min"], entry["spawn_count_max"])
```

타이머가 만료될 때마다 `get_spawn_count()`만큼 `_spawn_single_obstacle()`을 루프로 돌린다. 120초 넘으면 한번에 30~50개가 쏟아진다. 풀이 미리 만들어져 있으니까 프레임 드랍 없이 처리된다.

## 게임오버 시 일괄 반환

게임이 끝나면 활성 상태인 화살을 전부 풀에 돌려보내야 한다.

```gdscript
func game_over() -> void:
    obstacle_spawner.stop_spawning()
    for pool in _obstacle_pools:
        pool.release_all()
```

`release_all()`은 컨테이너의 visible한 자식을 전부 비활성화한다. `queue_free()` 대신 비활성화만 하기 때문에, 재시작할 때 다시 풀에서 꺼내 쓸 수 있다.
