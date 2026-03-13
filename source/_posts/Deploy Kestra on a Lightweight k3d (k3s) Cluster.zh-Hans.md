---
title: 基于k3d Cluster的Kestra部署指南
date: 2025-07-20 19:06:28
cover: /img/deploy-kestra-on-a-lightweight-k3d-k3s-cluster/cover-shared.png
category: 
  - Workflows Orchestration
tags: 
  - Kestra
lang: zh-Hans
translation_key: post-Deploy-Kestra-on-a-Lightweight-k3d-k3s-Cluster
slug: Deploy-Kestra-on-a-Lightweight-k3d-k3s-Cluster
---
### 一、创建集群和初始化

```
# 创建k3d集群和k3d集群镜像
k3d cluster create kestra --registry-create kestra-registry
```

**意味着：**

* **k3d 已经自动帮你创建了一个名为 **`k3d-kestra-registry` 的本地镜像仓库容器；
* **并且自动将该 registry 与集群网络连接好；**
* **同时也自动为 k3s 节点写入了正确的 **`/etc/rancher/k3s/registries.yaml` 配置（你不需要再手动复制）；
* **registry 默认监听的是 ****5000 端口**，k3d 会把它暴露到宿主机的一个随机端口（可用 `docker ps` 查看）。

**下一步，确认 registry 端口：**

```
docker ps -f name=kestra-registry
```

![](/img/deploy-kestra-on-a-lightweight-k3d-k3s-cluster/fig-01-registry-port-mapping.png)

**这里 **`58046` 就是宿主机暴露的端口。

** 推送镜像到本地 registry:**

**假设你的镜像是 **`kestra-dev:latest`，端口号是 `58046`，执行：

```
docker tag kestra-dev:latest localhost:58046/kestra-dev:latest
docker push localhost:58046/kestra-dev:latest
```

**推送成功后，registry 内部会保存为：**

```
kestra-registry:5000/kestra-dev:latest
```

**在 Kestra / Kubernetes 中使用该镜像**

**现在你可以在任何 Pod、Deployment 或 Kestra 流程中这样写：**

```
image: kestra-registry:5000/kestra-dev:latest
imagePullPolicy: IfNotPresent
```

> **说明：**
>
> * `kestra-registry:5000` 是集群内部的服务名；
> * `IfNotPresent` 防止每次都去拉取；
> * **由于 k3d 已自动配置了 registry，因此无需额外 registries.yaml。**

**✅ 验证镜像是否可用**

**创建一个测试 Pod：**

```
kubectl run test-registry \
  --image=kestra-registry:5000/kestra-dev:latest \
  --restart=Never --command -- tail -f /dev/null
```

**然后查看状态：**

```
kubectl describe pod test-registry
```

**如果状态为 **`Running`，说明 k3d 的托管 registry 工作正常，Kestra 在运行任务时也能直接使用你本地推送的镜像。

![](/img/deploy-kestra-on-a-lightweight-k3d-k3s-cluster/fig-02-registry-pod-running.jpg)

**⚙️ 补充建议**

* **若后续需要查看 registry 中已有镜像，可进入 registry 容器查看：**

  ```
  docker exec -it kestra-registry /bin/sh
  ls /var/lib/registry/docker/registry/v2/repositories/
  ```
* **每次更新镜像后，只需重新执行：**

  ```
  docker build ...
  docker tag ...
  docker push ...
  ```

  **集群会自动从本地 registry 获取最新版。**

### 二.安装数据库postgresql

**需要分别安装postgresql 和kestra，首先安装postgresql数据库。**

```
# 1) 拉取到本地并解包
mkdir -p charts && cd charts
helm repo add bitnami https://charts.bitnami.com/bitnami || true
helm repo update
helm pull bitnami/postgresql --untar
cd ..

# 2) 用本地路径安装
NS=default
helm upgrade --install alfredx-postgresql ./charts/postgresql -n $NS \
  --set auth.username=alfredx \
  --set auth.password=tamira123 \
  --set auth.database=kestra \
  --set primary.service.type=NodePort \
  --set primary.service.nodePorts.postgresql=30432 \
  --set primary.service.ports.postgresql=5432
```

**成功后快速自检**

```
kubectl get pods -n default -w
kubectl get svc alfredx-postgresql -n default -o wide
```

**期待看到：**

* **Service 类型为 ****NodePort**
* `port: 5432`
* `nodePort: 30432`

**为了便于通过本地机器通过localhost:30432 方式访问该数据库，如不想重建集群，可以****给现有集群补一条端口映射**（实验性功能，某些版本只支持给 loadbalancer 或需要启用 serverlb；若失败就用方案 C）：

```
# 给现有集群添加端口（实验性）
k3d cluster edit kestra --port-add 30432:30432@server:0
k3d cluster edit kestra --port-add 30080:30080@server:0
k3d cluster edit kestra --port-add 30081:30081@server:0

```

> `k3d cluster edit --port-add` 支持给现有集群追加端口映射（标注为 experimental）

### 三、安装 kestra

**1.先为kestra创建k3d集群的密钥：**

``` 
kubectl create secret generic s3-credentials -n default \
  --from-literal=AWS_ACCESS_KEY_ID='YOUR_KEY' \
  --from-literal=AWS_SECRET_ACCESS_KEY='YOUR_SECRET'
```

**2.安装kestra：**

```
helm upgrade --install alfredx kestra/kestra -f values.yaml -n default                                 
kubectl get pods -n default -w
```

![](/img/deploy-kestra-on-a-lightweight-k3d-k3s-cluster/fig-03-kestra-install-status.jpg)

**3.将服务端口暴露出来，代码如下：**

```
kubectl patch svc alfredx-kestra -n default -p '{
  "spec": {
    "type": "NodePort",
    "ports": [
      {"name":"http","port":8080,"protocol":"TCP","targetPort":8080,"nodePort":30080},
      {"name":"management","port":8081,"protocol":"TCP","targetPort":8081,"nodePort":30081}
    ]
  }
}'
```

### 四、kestra在k3d集群中使用task.docker.runner.使用本地镜像遇到的问题(搭建本地私镜像仓库)

![](/img/deploy-kestra-on-a-lightweight-k3d-k3s-cluster/fig-04-dind-insecure-registry-error.jpg)

**解决方法：**

1. **在 k3d 节点里写入 **`/etc/rancher/k3s/registries.yaml`

> **目标：让 ****k3s/containerd** 明确 `kestra-registry:5000` 是 **HTTP**（否则会默认为 HTTPS）。

**在 server 节点里创建 registries.yaml**

```
docker exec -it k3d-kestra-server-0 sh -lc '
mkdir -p /etc/rancher/k3s && cat > /etc/rancher/k3s/registries.yaml << "EOF"
mirrors:
  "kestra-registry:5000":
    endpoint:
      - "http://kestra-registry:5000"

configs:
  "kestra-registry:5000":
    tls:
      insecure_skip_verify: true
EOF
cat /etc/rancher/k3s/registries.yaml
'
```

> **如果你还有 agent 节点（例如 **`k3d-kestra-agent-0`），对每个 agent 也执行一遍上面的命令（把容器名换掉）。

2. **让 Kestra 的 Docker 任务运行器也信任 HTTP 仓库**

> **关键点：Kestra 的任务运行器是 ****DinD**（独立的 Docker 守护进程），它不会用到节点的镜像缓存；所以要明确告诉它 `kestra-registry:5000` 是不安全（HTTP）仓库。

**方式 1：在 ****任务** 里声明（最直接）

**把你的任务改成下面这种（示例用 **`shell.Commands`，其他类型用法相同）：

```
tasks:
  - id: my_task
    type: io.kestra.plugin.scripts.shell.Commands
    containerImage: kestra-registry:5000/kestra-dev:latest
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      config: |
        {
          "insecure-registries": ["kestra-registry:5000"]
        }
    commands:
      - echo "it works"
```

> **这样 DinD 就不会再强行用 HTTPS 去连你的 registry 了。**

**方式 2：全局启用（所有 Docker 任务都生效）**

**如果你想****所有工作流的 Docker 任务**都继承这项设置，可在 Kestra 的应用配置里加入 **插件全局配置**（大致如下；具体你放到 Helm 的 `configurations.application` 里）：

```
plugins:
  configurations:
    - type: io.kestra.plugin.scripts.runner.docker.Docker
      values:
        insecure-registries:
          - kestra-registry:5000
```

**核心：B. 让 Kestra 的 Docker 任务运行器也信任 HTTP 仓库**

> **关键点：Kestra 的任务运行器是 ****DinD**（独立的 Docker 守护进程），它不会用到节点的镜像缓存；所以要明确告诉它 `kestra-registry:5000` 是不安全（HTTP）仓库。

### 方式 1：在 **任务** 里声明（最直接）

**把你的任务改成下面这种（示例用 **`shell.Commands`，其他类型用法相同）：

```
tasks:
  - id: my_task
    type: io.kestra.plugin.scripts.shell.Commands
    containerImage: kestra-registry:5000/kestra-dev:latest
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      config: |
        {
          "insecure-registries": ["kestra-registry:5000"]
        }
    commands:
      - echo "it works"
```

> **这样 DinD 就不会再强行用 HTTPS 去连你的 registry 了。**

### 方式 2：全局启用（所有 Docker 任务都生效）

**如果你想****所有工作流的 Docker 任务**都继承这项设置，可在 Kestra 的应用配置里加入 **插件全局配置**（大致如下；具体你放到 Helm 的 `configurations.application` 里）：

```
plugins:
  configurations:
    - type: io.kestra.plugin.scripts.runner.docker.Docker
      values:
        insecure-registries:
          - kestra-registry:5000
```

**核心：**

#### 方案一（推荐）：给 DinD 永久追加启动参数

1. **找到 DinD 容器在 Deployment 中的索引：**

**记下 `kestra-worker-docker-dind` 的索引（从 0 开始）。如果不想算索引，用下面的自动脚本。**

2. **自动找索引并打 JSON Patch（不会覆盖已有 args，只是****追加**一条）：

```
IDX=$(kubectl get deploy -n default alfredx-kestra-worker -o json \
  | jq -r '.spec.template.spec.containers
           | to_entries[]
           | select(.value.name=="kestra-worker-docker-dind")
           | .key')

kubectl patch deploy -n default alfredx-kestra-worker --type='json' -p="[
  {\"op\":\"add\", \"path\":\"/spec/template/spec/containers/${IDX}/args/-\",
   \"value\":\"--insecure-registry=kestra-registry:5000\"}
]"
```

3. **等滚动完成、容器重启后验证：**

```
NEWPOD=$(kubectl get pod -n default -l app.kubernetes.io/component=worker -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n default "$NEWPOD" -c kestra-worker-docker-dind -- sh -lc '
docker info | sed -n "/Insecure Registries/,\$p"
'
```

```
Insecure Registries:
  kestra-registry:5000
  127.0.0.0/8
  ::1/128
```

**到这里就大功告成了。！！！！！！恭喜完结撒花🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉**
