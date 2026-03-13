# Bilingual Post Template (EN + zh-Hans)

## 1. File naming (recommended)

Create a pair of posts for each article:

- English: `source/_posts/<Post Title>.md`
- Chinese: `source/_posts/<Post Title>.zh-Hans.md`

Example:

- `source/_posts/Building a Data Pipeline with Airflow.md`
- `source/_posts/Building a Data Pipeline with Airflow.zh-Hans.md`

## 2. Required front-matter rules

Both files must keep the same:

- `translation_key`
- `slug` (recommended to keep URLs aligned)

Language-specific fields:

- English file: `lang: en`
- Chinese file: `lang: zh-Hans`

## 3. Image directory naming convention (recommended)

Use one shared image folder per article under `source/img/`:

- `source/img/<post_key>/`

Recommended `post_key`:

- same as slug, lowercase kebab-case
- example: `airflow-data-pipeline`

### Example structure

```text
source/img/airflow-data-pipeline/
├── cover-shared.png
├── arch-shared.png
├── arch-en.png
├── arch-zh.png
├── step-01-shared.png
├── step-02-en.png
└── step-02-zh.png
```

### Naming convention

- Shared image (no language text): `*-shared.*`
- English image: `*-en.*`
- Chinese image: `*-zh.*`

## 4. Markdown image usage

English post:

```md
![Architecture](/img/airflow-data-pipeline/arch-en.png)
```

Chinese post:

```md
![架构图](/img/airflow-data-pipeline/arch-zh.png)
```

Shared image in both:

```md
![Cover](/img/airflow-data-pipeline/cover-shared.png)
```

## 5. English post template (`.md`)

```md
---
title: Building a Data Pipeline with Airflow
date: 2026-02-27 10:00:00
lang: en
translation_key: post-airflow-data-pipeline
slug: airflow-data-pipeline
cover: /img/airflow-data-pipeline/cover-shared.png
category:
  - Data Engineering
tags:
  - Airflow
  - ETL
---

# Building a Data Pipeline with Airflow

## Summary

Write the English version here.

## Architecture

![Architecture](/img/airflow-data-pipeline/arch-en.png)
```

## 6. Chinese post template (`.zh-Hans.md`)

```md
---
title: 使用 Airflow 构建数据流水线
date: 2026-02-27 10:00:00
lang: zh-Hans
translation_key: post-airflow-data-pipeline
slug: airflow-data-pipeline
cover: /img/airflow-data-pipeline/cover-shared.png
category:
  - 数据工程
tags:
  - Airflow
  - ETL
---

# 使用 Airflow 构建数据流水线

## 摘要

这里写中文版内容。

## 架构

![架构图](/img/airflow-data-pipeline/arch-zh.png)
```

## 7. Fast workflow (recommended)

1. Create English post.
2. Copy it to `*.zh-Hans.md`.
3. Update `lang`, `title`, and translated content.
4. Keep `translation_key` and `slug` identical in both files.
5. Put images into `source/img/<post_key>/`.
