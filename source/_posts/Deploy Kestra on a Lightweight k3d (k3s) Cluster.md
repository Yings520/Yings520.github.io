---
title: Deploy Kestra on a Lightweight k3d (k3s) Cluster
date: 2025-07-20 19:06:28
cover: /img/kestra_20250720.png
category: 
  - Workflows Orchestration
tags: 
  - Kestra
---
# Deploy Kestra on a Lightweight k3d (k3s) Cluster — A Practical Guide

This post shows a simple, developer-friendly way to run **Kestra** on a **local k3d (k3s) Kubernetes cluster** powered by **Docker Desktop**. We’ll also cover a very common pain point: **using your own local Docker images** inside Kestra workflows when the **Docker task runner (DinD)** is involved.

---

## What you’ll get

By the end, you will have:

* A k3d cluster with a **built-in local container registry**
* A **PostgreSQL** database (Kestra metadata store) exposed via **NodePort**
* **Kestra** installed via Helm and reachable from your laptop
* A clear solution for **running workflows with Docker images stored in your local registry**

---

## Prerequisites

Make sure you have:

* Docker Desktop
* `k3d`
* `kubectl`
* `helm`
* `jq` (for patching the DinD container args)

---

## 1) Create a k3d cluster with a local registry

Create the cluster and let k3d create a local registry for you:

```bash
k3d cluster create kestra --registry-create kestra-registry
```

What this does (good news: you don’t need to do these manually):

* Creates a local registry container (e.g. `k3d-kestra-registry`)
* Connects the registry to the cluster network
* Writes the correct registry config for k3s/containerd
* Registry listens on **5000 inside the cluster**, and is mapped to a **random host port** on your machine

Find the registry’s exposed host port:

```bash
docker ps -f name=kestra-registry
```

Example: if you see host port `58046`, that’s what you’ll push to.

---

## 2) Push your custom image into the local registry

Assume you built an image locally: `kestra-dev:latest`. Tag and push it to the registry:

```bash
docker tag kestra-dev:latest localhost:58046/kestra-dev:latest
docker push localhost:58046/kestra-dev:latest
```

Inside the cluster, it will be referenced as:

```yaml
image: kestra-registry:5000/kestra-dev:latest
imagePullPolicy: IfNotPresent
```

Because `kestra-registry:5000` is the **in-cluster registry address**.

### Quick verification: can Kubernetes run the image?

```bash
kubectl run test-registry \
  --image=kestra-registry:5000/kestra-dev:latest \
  --restart=Never --command -- tail -f /dev/null

kubectl describe pod test-registry
```

If the Pod becomes `Running`, your registry is working.

---

## 3) Install PostgreSQL (Kestra metadata DB) via Helm

We’ll install Bitnami PostgreSQL and expose it with NodePort `30432`.

```bash
mkdir -p charts && cd charts
helm repo add bitnami https://charts.bitnami.com/bitnami || true
helm repo update
helm pull bitnami/postgresql --untar
cd ..

NS=default
helm upgrade --install alfredx-postgresql ./charts/postgresql -n $NS \
  --set auth.username=alfredx \
  --set auth.password='YOUR_PASSWORD' \
  --set auth.database=kestra \
  --set primary.service.type=NodePort \
  --set primary.service.nodePorts.postgresql=30432 \
  --set primary.service.ports.postgresql=5432
```

This matches a known-working setup: service is NodePort, `port: 5432`, `nodePort: 30432`.

Check status:

```bash
kubectl get pods -n default -w
kubectl get svc alfredx-postgresql -n default -o wide
```

---

## 4) (Optional) Map ports from the k3d cluster to your host

If you want to reach NodePorts via `localhost:<nodePort>` on your laptop, you can **add port mappings** to an existing cluster (experimental, but handy):

```bash
k3d cluster edit kestra --port-add 30432:30432@server:0
k3d cluster edit kestra --port-add 30080:30080@server:0
k3d cluster edit kestra --port-add 30081:30081@server:0
```

---

## 5) Install Kestra via Helm

### 5.1 Create required Kubernetes secrets (example)

Create secrets that your flows may need (S3 credentials in this example). **Do not commit real keys**—use your own secret values:

```bash
kubectl create secret generic s3-credentials -n default \
  --from-literal=AWS_ACCESS_KEY_ID='YOUR_KEY' \
  --from-literal=AWS_SECRET_ACCESS_KEY='YOUR_SECRET'
```

(Your original notes show this exact pattern. )

### 5.2 Install Kestra

```bash
helm upgrade --install alfredx kestra/kestra -f values.yaml -n default
kubectl get pods -n default -w
```

### 5.3 Expose Kestra service via NodePort

Expose:

* UI/API: `30080 -> 8080`
* Management: `30081 -> 8081`

```bash
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

Now you can typically open:

* `http://localhost:30080` (Kestra UI)

---

## 6) The “local image + Docker runner (DinD)” trap — and how to fix it

If you run tasks with the **Docker task runner**, Kestra often uses **DinD (Docker-in-Docker)**. Important consequence:

> DinD is its own Docker daemon. It does **not** automatically use the node’s image cache or registry settings.

So even if Kubernetes can pull `kestra-registry:5000/...`, your workflow may fail because DinD tries to use **HTTPS** by default or doesn’t trust your HTTP registry.

You typically need two fixes:

### Fix A — Make k3s/containerd treat the registry as HTTP

Write `/etc/rancher/k3s/registries.yaml` inside the k3d node:

```bash
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

If you have agent nodes, apply the same change there too.

### Fix B — Tell Kestra’s Docker runner (DinD) to trust the registry (HTTP)

You have three practical options.

#### Option 1: Set it per task (most direct)

```yaml
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

#### Option 2: Set it globally in Kestra config (applies to all Docker tasks)

```yaml
plugins:
  configurations:
    - type: io.kestra.plugin.scripts.runner.docker.Docker
      values:
        insecure-registries:
          - kestra-registry:5000
```

#### Option 3: Patch the DinD container args (durable “cluster-level” fix)

Automatically locate the DinD container index and append an insecure-registry arg:

```bash
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

Then verify:

```bash
NEWPOD=$(kubectl get pod -n default -l app.kubernetes.io/component=worker -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n default "$NEWPOD" -c kestra-worker-docker-dind -- sh -lc '
docker info | sed -n "/Insecure Registries/,\$p"
'
```

You should see `kestra-registry:5000` under *Insecure Registries*.

---

## Suggested “daily workflow” for iterating images

Whenever your task image changes:

```bash
docker build -t kestra-dev:latest .
docker tag kestra-dev:latest localhost:58046/kestra-dev:latest
docker push localhost:58046/kestra-dev:latest
```

The cluster will pick up the updated image from the local registry.
